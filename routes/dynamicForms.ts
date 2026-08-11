import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate, isAdmin } from '../lib/auth.middleware.js';
import { generateFormSchema } from '../lib/aiFormGenerator.js';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const GenerateFormSchema = z.object({
  serviceName: z.string().min(2).max(200),
  category: z.string().min(1).max(100),
  description: z.string().min(10).max(2000),
  businessType: z.string().min(1).max(100),
  existingSchema: z.array(z.record(z.unknown())).optional(),
});

const SaveTemplateSchema = z.object({
  schema: z.array(z.record(z.unknown())).min(1).max(20),
  generatedByAi: z.boolean().default(false),
  aiPrompt: z.string().optional(),
  aiModel: z.string().optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/service-catalog/:catalogId/form-template
 * Get active form template for a service.
 * Used by order wizard to render dynamic fields.
 * PUBLIC — no auth required (customer-facing).
 */
router.get(
  '/:catalogId/form-template',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { catalogId } = req.params as { catalogId: string };

      const template = await prisma.serviceFormTemplate.findFirst({
        where: { serviceCatalogId: catalogId, isActive: true },
        orderBy: { version: 'desc' },
        select: {
          id: true,
          version: true,
          schema: true,
          generatedByAi: true,
          publishedAt: true,
        },
      });

      if (!template) {
        // Fallback: return the catalog's existing dynamicFieldsSchema if no versioned template
        const catalog = await prisma.serviceCatalog.findUnique({
          where: { id: catalogId },
          select: { dynamicFieldsSchema: true },
        });
        if (!catalog) {
          res.status(404).json({ code: 'NOT_FOUND', message: 'Service catalog not found' });
          return;
        }
        res.json({
          data: {
            source: 'catalog_legacy',
            schema: catalog.dynamicFieldsSchema ?? [],
          },
        });
        return;
      }

      res.json({
        data: {
          source: 'versioned_template',
          templateId: template.id,
          version: template.version,
          schema: template.schema,
          generatedByAi: template.generatedByAi,
          publishedAt: template.publishedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/service-catalog/:catalogId/form-template/generate
 * Admin triggers AI generation of a form schema.
 * Returns the generated schema for review — does NOT publish automatically.
 */
router.post(
  '/admin/:catalogId/form-template/generate',
  authenticate,
  isAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { catalogId } = req.params as { catalogId: string };
      const input = GenerateFormSchema.parse(req.body);

      const catalog = await prisma.serviceCatalog.findUnique({
        where: { id: catalogId },
        select: { id: true, name: true, category: true },
      });
      if (!catalog) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Service catalog not found' });
        return;
      }

      // Generate schema using Gemini
      const generated = await generateFormSchema({
        serviceName: input.serviceName || catalog.name,
        category: input.category || catalog.category?.name || 'General',
        description: input.description,
        businessType: input.businessType,
        existingSchema: input.existingSchema as unknown[],
      });

      // Get next version number
      const latestVersion = await prisma.serviceFormTemplate.findFirst({
        where: { serviceCatalogId: catalogId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (latestVersion?.version ?? 0) + 1;

      // Save as draft (isActive: false — admin must publish explicitly)
      const adminId = (req as unknown as { user: { id: string } }).user?.id;
      const template = await prisma.serviceFormTemplate.create({
        data: {
          serviceCatalogId: catalogId,
          version: nextVersion,
          isActive: false,
          schema: generated.fields as object[],
          generatedByAi: true,
          aiPrompt: input.description,
          aiModel: generated.aiModel,
          publishedById: adminId,
        },
      });

      res.status(201).json({
        data: {
          templateId: template.id,
          version: template.version,
          schema: generated.fields,
          generatedByAi: true,
          aiModel: generated.aiModel,
          status: 'draft',
          message: 'Schema generated. Review and publish when ready.',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/service-catalog/:catalogId/form-template/:templateId/publish
 * Admin publishes a draft template (deactivates all previous versions).
 */
router.post(
  '/admin/:catalogId/form-template/:templateId/publish',
  authenticate,
  isAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { catalogId, templateId } = req.params as { catalogId: string; templateId: string };

      const template = await prisma.serviceFormTemplate.findUnique({ where: { id: templateId } });
      if (!template || template.serviceCatalogId !== catalogId) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Template not found' });
        return;
      }
      if (template.isActive) {
        res.status(409).json({ code: 'ALREADY_ACTIVE', message: 'Template is already active' });
        return;
      }

      // Transaction: deactivate all others, activate this one
      const [, published] = await prisma.$transaction([
        prisma.serviceFormTemplate.updateMany({
          where: { serviceCatalogId: catalogId, isActive: true },
          data: { isActive: false },
        }),
        prisma.serviceFormTemplate.update({
          where: { id: templateId },
          data: {
            isActive: true,
            publishedAt: new Date(),
          },
        }),
      ]);

      res.json({ data: published });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/admin/service-catalog/:catalogId/form-template/:templateId
 * Admin manually edits a draft template schema.
 */
router.put(
  '/admin/:catalogId/form-template/:templateId',
  authenticate,
  isAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { catalogId, templateId } = req.params as { catalogId: string; templateId: string };
      const input = SaveTemplateSchema.parse(req.body);

      const template = await prisma.serviceFormTemplate.findUnique({ where: { id: templateId } });
      if (!template || template.serviceCatalogId !== catalogId) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Template not found' });
        return;
      }
      if (template.isActive) {
        res.status(409).json({
          code: 'CANNOT_EDIT_ACTIVE',
          message: 'Cannot edit an active template. Create a new version instead.',
        });
        return;
      }

      const updated = await prisma.serviceFormTemplate.update({
        where: { id: templateId },
        data: { schema: input.schema },
      });

      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/service-catalog/:catalogId/form-template
 * Admin: List all template versions for a service.
 */
router.get(
  '/admin/:catalogId/form-template',
  authenticate,
  isAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { catalogId } = req.params as { catalogId: string };

      const templates = await prisma.serviceFormTemplate.findMany({
        where: { serviceCatalogId: catalogId },
        orderBy: { version: 'desc' },
      });

      res.json({ data: templates });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
