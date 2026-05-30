import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/db.js';
import { authenticate, requireRole, AuthRequest } from '../lib/auth.middleware.js';
import { setUserLocation } from '../lib/locationCache.js';

const router = Router();

// GET /api/users/me/stats - Get user statistics for profile
router.get('/me/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get request counts
    const [
      totalRequests,
      completedRequests,
      activeContracts,
      servicesCount,
      avgRating,
      reviewsCount,
    ] = await Promise.all([
      // Total requests as customer
      prisma.request.count({
        where: { customerId: userId },
      }),
      // Completed requests
      prisma.request.count({
        where: {
          customerId: userId,
          status: 'completed',
        },
      }),
      // Active contracts
      prisma.contract.count({
        where: {
          OR: [
            { customerId: userId },
            { providerId: userId },
          ],
          status: 'active',
        },
      }),
      // Services count (for providers)
      prisma.service.count({
        where: { providerId: userId },
      }),
      // Average rating from services
      prisma.service.aggregate({
        where: { providerId: userId },
        _avg: { rating: true },
        _sum: { reviewsCount: true },
      }),
      // Total reviews count
      prisma.service.aggregate({
        where: { providerId: userId },
        _sum: { reviewsCount: true },
      }),
    ]);

    res.json({
      totalRequests,
      completedRequests,
      pendingRequests: totalRequests - completedRequests,
      activeContracts,
      servicesCount,
      rating: avgRating._avg?.rating ?? 0,
      reviewsCount: reviewsCount._sum?.reviewsCount ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, email: true, displayName: true, firstName: true, lastName: true,
        role: true, status: true, companyId: true, isVerified: true, avatarUrl: true,
        bio: true, location: true, phone: true, address: true, mfaEnabled: true, createdAt: true,
        accountPreferences: true, googleId: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { googleId, ...rest } = user;
    res.json({ ...rest, googleLinked: !!googleId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/me/change-password
router.post('/me/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.password) {
      return res.status(400).json({ error: 'Password is not set for this account. Use Google or reset first.' });
    }
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/me/account-preferences
router.get('/me/account-preferences', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { accountPreferences: true },
    });
    res.json((user?.accountPreferences as object) || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/me/account-preferences
router.put('/me/account-preferences', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body;
    if (body === undefined || body === null || typeof body !== 'object') {
      return res.status(400).json({ error: 'JSON object body required' });
    }
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { accountPreferences: body as any },
      select: { accountPreferences: true },
    });
    res.json(user.accountPreferences || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/me
router.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const { displayName, firstName, lastName, phone, bio, location, address, avatarUrl, password, mfaEnabled, lat, lng } = req.body;
  try {
    const data: any = {};
    if (displayName !== undefined) data.displayName = displayName;
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (phone !== undefined) data.phone = phone;
    if (bio !== undefined) data.bio = bio;
    if (location !== undefined) data.location = location;
    if (address !== undefined) data.address = typeof address === 'string' ? address : null;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (mfaEnabled !== undefined) data.mfaEnabled = Boolean(mfaEnabled);
    if (password) data.password = await bcrypt.hash(password, 12);

    // If lat/lng are provided, update the new locationLat/locationLng fields
    const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
    if (hasCoords) {
      data.locationLat = lat;
      data.locationLng = lng;
    }

    // If firstName and lastName are provided but displayName is not, auto-generate displayName
    if (firstName && lastName && !displayName) {
      data.displayName = `${firstName} ${lastName}`.trim();
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: {
        id: true, email: true, displayName: true, firstName: true, lastName: true,
        role: true, status: true, companyId: true, avatarUrl: true, bio: true,
        location: true, phone: true, address: true, isVerified: true, mfaEnabled: true, createdAt: true, googleId: true,
        accountPreferences: true,
      },
    });

    // If location or coords changed, update the Redis cache
    if (hasCoords) {
      await setUserLocation(req.user!.userId, lat, lng);
    } else if (location !== undefined && user.location) {
      // If only a location string was provided but no coords, try to parse as JSON
      try {
        const parsed = JSON.parse(user.location) as { lat: number; lng: number };
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          await setUserLocation(req.user!.userId, parsed.lat, parsed.lng);
        }
      } catch {
        // location is a plain string, not JSON — skip cache update
      }
    }

    const { googleId, ...rest } = user;
    res.json({ ...rest, googleLinked: !!googleId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/me/become-provider — requires verified personal KYC
router.post('/me/become-provider', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const verified = await prisma.kYC.findFirst({
      where: { userId: req.user!.userId, type: 'personal', status: 'verified' },
    });
    if (!verified) {
      return res.status(400).json({ error: 'Personal KYC verification required' });
    }
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { role: 'provider', status: 'pending_verification' },
      select: {
        id: true, email: true, displayName: true, role: true, status: true,
        companyId: true, isVerified: true, avatarUrl: true, bio: true,
        location: true, phone: true,
      },
    });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, email: true, displayName: true, role: true, status: true,
        companyId: true, isVerified: true, avatarUrl: true, bio: true, createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
