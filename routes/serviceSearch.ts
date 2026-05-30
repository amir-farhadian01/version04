/**
 * GET /api/services/search
 * Public endpoint — searches services (ServiceCatalog) and packages (ProviderServicePackage)
 * with optional categoryId filter and pagination.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';

export const router = Router();

const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Search query must be at least 2 characters'),
  categoryId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

interface ServiceResult {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  breadcrumb: string[];
  thumbnailUrl: string | null;
  businessId: string;
  businessName: string;
  businessAvatarUrl: string | null;
  bookingMode: string | null;
  startingPrice: number | null;
  rating: number | null;
  location: { city: string | null; neighbourhood: string | null } | null;
}

interface PackageResult {
  id: string;
  name: string;
  description: string | null;
  serviceId: string;
  serviceName: string;
  businessId: string;
  businessName: string;
  price: number;
  bookingMode: string;
  duration: number | null;
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, categoryId, limit, offset } = searchQuerySchema.parse(req.query);

    // Common where clause for services
    const serviceWhere: Record<string, unknown> = {
      isActive: true,
      archivedAt: null,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ],
    };

    // Optional category filter
    if (categoryId) {
      serviceWhere.categoryId = categoryId;
    }

    // Search services
    const [services, totalServices] = await Promise.all([
      prisma.serviceCatalog.findMany({
        where: serviceWhere as any,
        select: {
          id: true,
          name: true,
          description: true,
          categoryId: true,
          category_: {
            select: {
              id: true,
              name: true,
              parentId: true,
            },
          },
          lockedBookingMode: true,
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.serviceCatalog.count({ where: serviceWhere as any }),
    ]);

    // Search packages with joined workspace info
    const packageWhere: Record<string, unknown> = {
      isActive: true,
      archivedAt: null,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    };

    const [packages, totalPackages] = await Promise.all([
      prisma.providerServicePackage.findMany({
        where: packageWhere as any,
        select: {
          id: true,
          name: true,
          description: true,
          finalPrice: true,
          bookingMode: true,
          durationMinutes: true,
          serviceCatalogId: true,
          workspaceId: true,
          serviceCatalog: {
            select: {
              id: true,
              name: true,
            },
          },
          workspace: {
            select: {
              id: true,
              name: true,
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.providerServicePackage.count({ where: packageWhere as any }),
    ]);

    // Build breadcrumbs for services
    const buildBreadcrumb = (cat: { id: string; name: string; parentId: string | null } | null): string[] => {
      if (!cat) return [];
      return [cat.name];
    };

    // Map service results
    const serviceResults: ServiceResult[] = services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      categoryId: s.categoryId,
      categoryName: s.category_?.name ?? null,
      breadcrumb: buildBreadcrumb(s.category_),
      thumbnailUrl: null,
      businessId: '',
      businessName: '',
      businessAvatarUrl: null,
      bookingMode: s.lockedBookingMode,
      startingPrice: null,
      rating: null,
      location: null,
    }));

    // Map package results
    const packageResults: PackageResult[] = packages.map((p) => {
      const owner = p.workspace?.owner;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        serviceId: p.serviceCatalogId,
        serviceName: p.serviceCatalog?.name ?? '',
        businessId: p.workspaceId,
        businessName: p.workspace?.name ?? '',
        price: Math.round(p.finalPrice * 100), // convert to cents
        bookingMode: p.bookingMode,
        duration: p.durationMinutes,
      };
    });

    res.json({
      data: {
        services: serviceResults,
        packages: packageResults,
        totalServices,
        totalPackages,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
      });
      return;
    }
    throw error;
  }
});