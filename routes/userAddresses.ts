import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { prisma } from '../lib/db.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── List all addresses for current user ───────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const addresses = await prisma.userAddress.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ items: addresses });
  } catch (err) {
    console.error('GET /user-addresses error:', err);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

// ─── Create a new address ──────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { label, street, city, province, postalCode, country, latitude, longitude, isDefault } = req.body;

    if (!label || !street || !city || !province || !postalCode) {
      return res.status(400).json({ error: 'label, street, city, province, and postalCode are required' });
    }

    // If setting as default, unset any existing default
    if (isDefault) {
      await prisma.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await prisma.userAddress.create({
      data: {
        userId,
        label: String(label).trim(),
        street: String(street).trim(),
        city: String(city).trim(),
        province: String(province).trim(),
        postalCode: String(postalCode).trim(),
        country: String(country ?? 'CA').trim(),
        latitude: latitude != null ? Number(latitude) : 0,
        longitude: longitude != null ? Number(longitude) : 0,
        isDefault: isDefault === true,
      },
    });

    res.status(201).json(address);
  } catch (err) {
    console.error('POST /user-addresses error:', err);
    res.status(500).json({ error: 'Failed to create address' });
  }
});

// ─── Update an address ─────────────────────────────────────────────────────
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { label, street, city, province, postalCode, country, latitude, longitude, isDefault } = req.body;

    // Verify ownership
    const existing = await prisma.userAddress.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = String(label).trim();
    if (street !== undefined) data.street = String(street).trim();
    if (city !== undefined) data.city = String(city).trim();
    if (province !== undefined) data.province = String(province).trim();
    if (postalCode !== undefined) data.postalCode = String(postalCode).trim();
    if (country !== undefined) data.country = String(country).trim();
    if (latitude !== undefined) data.latitude = Number(latitude);
    if (longitude !== undefined) data.longitude = Number(longitude);

    // Handle default toggle
    if (isDefault === true) {
      await prisma.userAddress.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      data.isDefault = true;
    } else if (isDefault === false) {
      data.isDefault = false;
    }

    const updated = await prisma.userAddress.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PUT /user-addresses/:id error:', err);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// ─── Soft-delete (archive) an address ──────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const existing = await prisma.userAddress.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Address not found' });
    }

    await prisma.userAddress.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /user-addresses/:id error:', err);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// ─── Set as default address ────────────────────────────────────────────────
router.put('/:id/default', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const existing = await prisma.userAddress.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Unset all defaults, then set this one
    await prisma.userAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    const updated = await prisma.userAddress.update({
      where: { id },
      data: { isDefault: true },
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /user-addresses/:id/default error:', err);
    res.status(500).json({ error: 'Failed to set default address' });
  }
});

export default router;
