import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { prisma } from '../lib/db.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── List all cars for current user ────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const cars = await prisma.userCar.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ items: cars });
  } catch (err) {
    console.error('GET /user-cars error:', err);
    res.status(500).json({ error: 'Failed to fetch cars' });
  }
});

// ─── Create a new car ──────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { label, make, model, year, color, plate, isDefault } = req.body;

    if (!label || !make || !model) {
      return res.status(400).json({ error: 'label, make, and model are required' });
    }

    // If setting as default, unset any existing default
    if (isDefault) {
      await prisma.userCar.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const car = await prisma.userCar.create({
      data: {
        userId,
        label: String(label).trim(),
        make: String(make).trim(),
        model: String(model).trim(),
        year: year != null ? Number(year) : null,
        color: color != null ? String(color).trim() : null,
        plate: plate != null ? String(plate).trim() : null,
        isDefault: isDefault === true,
      },
    });

    res.status(201).json(car);
  } catch (err) {
    console.error('POST /user-cars error:', err);
    res.status(500).json({ error: 'Failed to create car' });
  }
});

// ─── Update a car ──────────────────────────────────────────────────────────
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { label, make, model, year, color, plate, isDefault } = req.body;

    // Verify ownership
    const existing = await prisma.userCar.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = String(label).trim();
    if (make !== undefined) data.make = String(make).trim();
    if (model !== undefined) data.model = String(model).trim();
    if (year !== undefined) data.year = Number(year);
    if (color !== undefined) data.color = String(color).trim();
    if (plate !== undefined) data.plate = String(plate).trim();

    // Handle default toggle
    if (isDefault === true) {
      await prisma.userCar.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      data.isDefault = true;
    } else if (isDefault === false) {
      data.isDefault = false;
    }

    const updated = await prisma.userCar.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PUT /user-cars/:id error:', err);
    res.status(500).json({ error: 'Failed to update car' });
  }
});

// ─── Soft-delete (archive) a car ───────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const existing = await prisma.userCar.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Car not found' });
    }

    await prisma.userCar.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /user-cars/:id error:', err);
    res.status(500).json({ error: 'Failed to delete car' });
  }
});

// ─── Set as default car ────────────────────────────────────────────────────
router.put('/:id/default', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const existing = await prisma.userCar.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Unset all defaults, then set this one
    await prisma.userCar.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    const updated = await prisma.userCar.update({
      where: { id },
      data: { isDefault: true },
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /user-cars/:id/default error:', err);
    res.status(500).json({ error: 'Failed to set default car' });
  }
});

export default router;
