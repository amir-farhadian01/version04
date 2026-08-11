import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, optionalAuth } from '../lib/auth.middleware.js';
import { prisma } from '../lib/db.js';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────

const vehicleTypeEnum = z.enum(['motorcycle', 'car', 'van', 'truck', 'bicycle']);

const createVehicleSchema = z.object({
  type: vehicleTypeEnum,
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(2000).max(2030),
  licensePlate: z.string().min(1),
  capacity_kg: z.number().positive().optional(),
  capacity_m3: z.number().positive().optional(),
});

const rideRequestSchema = z.object({
  vehicleType: vehicleTypeEnum.optional(),
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  packageDescription: z.string().optional(),
  packageWeight_kg: z.number().positive().optional(),
  scheduledAt: z.string().datetime().optional(),
});

// ─── GET /api/transport/vehicles — List driver's vehicles ───

router.get('/vehicles', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const vehicles = await prisma.vehicle.findMany({
      where: { ownerId: userId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: vehicles });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/transport/vehicles — Register a vehicle ──────

router.post('/vehicles', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const input = createVehicleSchema.parse(req.body);
    const vehicle = await prisma.vehicle.create({
      data: { ...input, ownerId: userId },
    });
    res.status(201).json({ data: vehicle });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/transport/ride/estimate — Fare estimate ────────

router.get('/ride/estimate', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = req.query;
    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Pickup and dropoff coordinates required' });
      return;
    }

    // Simple Haversine distance + fare calculation
    const lat1 = Number(pickupLat);
    const lng1 = Number(pickupLng);
    const lat2 = Number(dropoffLat);
    const lng2 = Number(dropoffLng);

    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // Base rates per km (cents)
    const rates: Record<string, number> = {
      bicycle: 50,
      motorcycle: 80,
      car: 120,
      van: 180,
      truck: 250,
    };
    const rate = rates[String(vehicleType)] ?? rates.car;

    const baseFare = 300; // $3.00 base in cents
    const estimatedFare = baseFare + Math.round(distanceKm * rate);
    const estimatedMinutes = Math.round((distanceKm / 30) * 60);

    res.json({
      data: {
        distanceKm: Math.round(distanceKm * 10) / 10,
        estimatedFareCents: estimatedFare,
        estimatedFareDisplay: `$${(estimatedFare / 100).toFixed(2)}`,
        estimatedMinutes,
        vehicleType: vehicleType ?? 'car',
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/transport/ride/request — Request a ride ──────

router.post('/ride/request', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const input = rideRequestSchema.parse(req.body);
    const ride = await prisma.ride.create({
      data: {
        customerId: userId,
        vehicleType: input.vehicleType ?? 'car',
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        dropoffLat: input.dropoffLat,
        dropoffLng: input.dropoffLng,
        packageDescription: input.packageDescription,
        packageWeight_kg: input.packageWeight_kg,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        status: 'pending',
      },
    });
    res.status(201).json({ data: ride });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/transport/rides — My rides (driver or customer) ──

router.get('/rides', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = 20;

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where: {
          OR: [{ customerId: userId }, { driverId: userId }],
          archivedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ride.count({
        where: {
          OR: [{ customerId: userId }, { driverId: userId }],
          archivedAt: null,
        },
      }),
    ]);

    res.json({ data: rides, total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

export default router;