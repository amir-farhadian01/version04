/**
 * /api/services — Service definitions CRUD
 * 
 * All monetary values in cents (integer).
 * Soft-delete via archivedAt (never hard-delete).
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';

const router = Router();

// --- Validation schemas ---
const createServiceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  category: z.string().max(100).nullable().optional(),
  price: z.number().int().min(0, 'Price must be >= 0 in cents'),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

const updateServiceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.string().max(100).nullable().optional(),
  price: z.number().int().min(0).optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

// --- GET /api/services — list authenticated user's services (excludes archived) ---
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const where: Record<string, unknown> = {
      providerId: req.user!.userId,
    };
    if (!includeArchived) {
      where.archivedAt = null;
    }

    const services = await prisma.service.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        category: true,
        price: true,
        description: true,
        imageUrl: true,
        rating: true,
        reviewsCount: true,
        createdAt: true,
        archivedAt: true,
        providerId: true,
        serviceCatalogId: true,
      },
    });

    res.json({ data: services });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load services';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// --- GET /api/services/:id — get a single service ---
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const service = await prisma.service.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        title: true,
        category: true,
        price: true,
        description: true,
        imageUrl: true,
        rating: true,
        reviewsCount: true,
        createdAt: true,
        archivedAt: true,
        providerId: true,
        serviceCatalogId: true,
        provider: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    if (!service) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Service not found' });
    }

    res.json({ data: service });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load service';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// --- POST /api/services — create a new service ---
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      });
    }

    const service = await prisma.service.create({
      data: {
        title: parsed.data.title,
        category: parsed.data.category ?? null,
        price: parsed.data.price,
        description: parsed.data.description ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        providerId: req.user!.userId,
      },
      select: {
        id: true,
        title: true,
        category: true,
        price: true,
        description: true,
        imageUrl: true,
        createdAt: true,
      },
    });

    res.status(201).json({ data: service });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create service';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// --- PUT /api/services/:id — update a service ---
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updateServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      });
    }

    const service = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Service not found' });
    }
    if (service.providerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'You can only edit your own services' });
    }

    const updated = await prisma.service.update({
      where: { id: req.params.id },
      data: parsed.data,
      select: {
        id: true,
        title: true,
        category: true,
        price: true,
        description: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update service';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// --- POST /api/services/:id/archive — soft-delete (archive) a service ---
router.post('/:id/archive', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Service not found' });
    }
    if (service.providerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'You can only archive your own services' });
    }

    await prisma.service.update({
      where: { id: req.params.id },
      data: { archivedAt: new Date() },
    });

    res.json({ data: { id: req.params.id, archived: true } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to archive service';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// --- POST /api/services/:id/unarchive — restore an archived service ---
router.post('/:id/unarchive', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Service not found' });
    }
    if (service.providerId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'You can only unarchive your own services' });
    }

    await prisma.service.update({
      where: { id: req.params.id },
      data: { archivedAt: null },
    });

    res.json({ data: { id: req.params.id, archived: false } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to unarchive service';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

export default router;