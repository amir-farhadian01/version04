import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/db.js';
import { createPasswordResetToken } from '../lib/passwordReset.js';
import { authenticate, isAdmin, requireRole, AuthRequest } from '../lib/auth.middleware.js';
import {
  buildDefaultDependencyCatalog,
  catalogToText,
  isDependencyCatalogV1,
  type DependencyCatalogV1,
} from '../lib/dependencyCatalog.js';
import { getAdminUsersList, getAdminUserIds } from '../lib/adminUsersList.js';
import { fetchAdminUserFull } from '../lib/adminUserDetail.js';
import { computeAdminOverviewStats, computeOrdersSubmittedTrend } from '../lib/adminOverviewStats.js';

const router = Router();
router.use(authenticate, isAdmin);

// POST /api/admin/change-password — legacy body shape supported; uses Bearer session (no Firebase token)
router.post('/change-password', async (req: AuthRequest, res: Response) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  try {
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.userId,
        action: 'ADMIN_PASSWORD_RESET',
        resourceType: 'user',
        resourceId: userId,
        metadata: { message: 'Admin reset password via API' },
      },
    });
    res.json({ success: true, message: 'Password updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function sendAdminUsersV2(req: AuthRequest, res: Response, forcedSegment?: 'clients' | 'providers') {
  try {
    const result = await getAdminUsersList(req, forcedSegment);
    res.setHeader('X-Admin-Users-V2', '1');
    res.status(result.status).json(result.body);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/users/clients — same filters as /users?segment=clients
router.get('/users/clients', async (req: AuthRequest, res: Response) => {
  await sendAdminUsersV2(req, res, 'clients');
});

// GET /api/admin/users/providers
router.get('/users/providers', async (req: AuthRequest, res: Response) => {
  await sendAdminUsersV2(req, res, 'providers');
});

// POST /api/admin/users/bulk — delete requires owner|platform_admin (requireRole)
router.post(
  '/users/bulk',
  (req: AuthRequest, res: Response, next) => {
    const a = (req.body as { action?: string })?.action;
    if (a === 'delete') return requireRole('owner', 'platform_admin')(req, res, next);
    next();
  },
  async (req: AuthRequest, res: Response) => {
  const { ids, action } = req.body as { ids?: unknown; action?: string };
  if (!Array.isArray(ids) || !ids.length || typeof action !== 'string') {
    return res.status(400).json({ error: 'Expected { ids: string[], action: string }' });
  }
  const userIds = ids.filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (!userIds.length) return res.status(400).json({ error: 'No valid ids' });
  const allowed = new Set(['activate', 'suspend', 'verify', 'unverify', 'delete']);
  if (!allowed.has(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  const actorId = req.user!.userId;
  try {
    let affected = 0;
    if (action === 'delete') {
      await prisma.$transaction(async (tx) => {
        for (const id of userIds) {
          await tx.user.delete({ where: { id } });
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'ADMIN_BULK_DELETE',
              resourceType: 'user',
              resourceId: id,
              metadata: { bulk: true },
            },
          });
          affected += 1;
        }
      });
    } else {
      const data =
        action === 'activate'
          ? { status: 'active' as const }
          : action === 'suspend'
            ? { status: 'suspended' as const }
            : action === 'verify'
              ? { isVerified: true }
              : { isVerified: false };
      const auditAction =
        action === 'activate'
          ? 'ADMIN_BULK_ACTIVATE'
          : action === 'suspend'
            ? 'ADMIN_BULK_SUSPEND'
            : action === 'verify'
              ? 'ADMIN_BULK_VERIFY'
              : 'ADMIN_BULK_UNVERIFY';
      await prisma.$transaction(async (tx) => {
        for (const id of userIds) {
          await tx.user.update({ where: { id }, data });
          await tx.auditLog.create({
            data: {
              actorId,
              action: auditAction,
              resourceType: 'user',
              resourceId: id,
              metadata: { bulk: true, action },
            },
          });
          affected += 1;
        }
      });
    }
    res.json({ success: true, affected });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
);

// GET /api/admin/users/ids — all ids matching current filters (bulk “select all matching”)
router.get('/users/ids', async (req: AuthRequest, res: Response) => {
  try {
    const result = await getAdminUserIds(req);
    res.setHeader('X-Admin-Users-V2', '1');
    res.status(result.status).json(result.body);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users/:id/full
router.get('/users/:id/full', async (req: AuthRequest, res: Response) => {
  try {
    const payload = await fetchAdminUserFull(req.params.id);
    if (!payload) return res.status(404).json({ error: 'User not found' });
    res.setHeader('X-Admin-Users-V2', '1');
    res.json(payload);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users — paginated admin grid
router.get('/users', async (req: AuthRequest, res: Response) => {
  await sendAdminUsersV2(req, res);
});

// PUT /api/admin/users/:id
router.put('/users/:id', async (req: AuthRequest, res: Response) => {
  const { role, status, isVerified, creditLimit, firstName, lastName, displayName, email, phone, gender, address, bio } = req.body;

  // Input validation — reject malformed email and empty displayName.
  if (email !== undefined && email !== null) {
    const emailStr = String(email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
  }
  if (displayName !== undefined && typeof displayName === 'string' && displayName.trim() === '') {
    return res.status(400).json({ error: 'displayName cannot be empty' });
  }

  try {
    // Check for duplicate email (if email is being changed)
    if (email !== undefined) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail && existingEmail.id !== req.params.id) {
        return res.status(409).json({ error: 'Email already in use by another user' });
      }
    }

    // Check for duplicate displayName (case-insensitive, if displayName is being changed)
    if (displayName !== undefined && displayName !== '') {
      const normalized = displayName.toLowerCase();
      const existingDisplayName = await prisma.user.findUnique({ where: { normalizedDisplayName: normalized } });
      if (existingDisplayName && existingDisplayName.id !== req.params.id) {
        return res.status(409).json({ error: 'Username already in use by another user' });
      }
    }

    const data: any = {};
    if (role) data.role = role;
    if (status) data.status = status;
    if (isVerified !== undefined) data.isVerified = isVerified;
    if (creditLimit !== undefined) data.creditLimit = parseFloat(creditLimit);
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (displayName !== undefined) {
      data.displayName = displayName;
      data.normalizedDisplayName = displayName.toLowerCase();
    }
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (gender !== undefined) data.gender = gender;
    if (address !== undefined) data.address = address;
    if (bio !== undefined) data.bio = bio;

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
      // Never expose password hash, refresh token, or other sensitive fields.
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        displayName: true,
        username: true,
        role: true,
        staffRole: true,
        status: true,
        isVerified: true,
        mfaEnabled: true,
        companyId: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.userId,
        action: `Updated user ${req.params.id}`,
        resourceType: 'user',
        resourceId: req.params.id,
        metadata: data,
      },
    });

    res.json(updated);
  } catch (err: any) {
    // Handle Prisma unique constraint errors gracefully
    if (err.code === 'P2002') {
      const target = err.meta?.target as string[] | undefined;
      if (target?.includes('normalizedDisplayName')) {
        return res.status(409).json({ error: 'Username already in use by another user' });
      }
      if (target?.includes('email')) {
        return res.status(409).json({ error: 'Email already in use by another user' });
      }
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/reset-password-email — send password reset email to user
router.post('/users/:id/reset-password-email', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate a real, single-use reset token and log the link. Wire a mail
    // provider (SendGrid/Resend/SES) here to actually deliver the email.
    const token = await createPasswordResetToken(user.id);
    const resetLink = `${req.protocol}://${req.get('host')}/auth/reset-password?token=${token}`;
    console.log(`[ADMIN] Password reset email for ${user.email}: ${resetLink}`);

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.userId,
        action: 'ADMIN_SEND_RESET_PASSWORD_EMAIL',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { email: user.email, message: 'Admin triggered password reset email' },
      },
    });

    res.json({ success: true, message: `Password reset email sent to ${user.email}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireRole('owner', 'platform_admin'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/kyc
router.get('/kyc', async (req: AuthRequest, res: Response) => {
  const { status } = req.query as any;
  try {
    const kyc = await prisma.kYC.findMany({
      where: status ? { status } : {},
      include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(kyc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/kyc/:id
router.put('/kyc/:id', async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  try {
    const kyc = await prisma.kYC.update({ where: { id: req.params.id }, data: { status } });
    if (status === 'verified') {
      const company = await prisma.company.findFirst({ where: { owner: { kyc: { id: req.params.id } } } });
      if (company) {
        await prisma.company.update({ where: { id: company.id }, data: { kycStatus: 'verified' } });
      }
      await prisma.user.update({ where: { id: kyc.userId }, data: { isVerified: true } });
    }
    res.json(kyc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/audit-log?limit=10 — overview feed (new); see /audit-logs for legacy full list
router.get('/audit-log', async (req: AuthRequest, res: Response) => {
  try {
    const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 10;
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 10));
    const items = await prisma.auditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/transactions
router.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        customer: { select: { id: true, displayName: true, email: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: 'desc' },
    });
    res.json(transactions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stats/orders-trend?days=7 — submitted orders per UTC day
router.get('/stats/orders-trend', async (_req: AuthRequest, res: Response) => {
  try {
    const daysRaw =
      typeof _req.query.days === 'string' ? parseInt(String(_req.query.days), 10) : 7;
    const days = Math.min(90, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));
    const series = await computeOrdersSubmittedTrend(days);
    res.json(series);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stats — platform overview KPIs (DB-backed; revenue from order/package/contract snapshots, not Stripe)
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const stats = await computeAdminOverviewStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/config
router.get('/config', async (req: AuthRequest, res: Response) => {
  try {
    let config = await prisma.systemConfig.findUnique({ where: { key: 'global' } });
    if (!config) {
      config = await prisma.systemConfig.create({
        data: { key: 'global', taxRate: 0, commissionRate: 10, paymentMethods: ['platform', 'cash'] },
      });
    }
    // Extract Stripe fields from integrations JSON
    const integrations = (config.integrations as Record<string, unknown>) ?? {};
    const stripeConfig = (integrations.stripe as Record<string, unknown>) ?? {};
    res.json({
      ...config,
      stripePublishableKey: stripeConfig.publishableKey ?? null,
      stripeSecretKey: stripeConfig.secretKey ?? null,
      stripeWebhookSecret: stripeConfig.webhookSecret ?? null,
      stripeEnabled: stripeConfig.enabled ?? false,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/config
router.put('/config', async (req: AuthRequest, res: Response) => {
  try {
    const { id: _id, key: _key, stripePublishableKey, stripeSecretKey, stripeWebhookSecret, stripeEnabled, ...rest } = req.body;

    // Build the integrations JSON with Stripe config
    const existing = await prisma.systemConfig.findUnique({ where: { key: 'global' } });
    const existingIntegrations = (existing?.integrations as Record<string, unknown>) ?? {};
    const integrations = {
      ...existingIntegrations,
      stripe: {
        publishableKey: stripePublishableKey ?? null,
        secretKey: stripeSecretKey ?? null,
        webhookSecret: stripeWebhookSecret ?? null,
        enabled: stripeEnabled ?? false,
      },
    };

    const config = await prisma.systemConfig.upsert({
      where: { key: 'global' },
      update: { ...rest, integrations: integrations as object, updatedAt: new Date() },
      create: { key: 'global', ...rest, integrations: integrations as object },
    });

    // Return with flattened Stripe fields for the frontend
    const stripeConfig = (config.integrations as Record<string, unknown>)?.stripe as Record<string, unknown> ?? {};
    res.json({
      ...config,
      stripePublishableKey: stripeConfig.publishableKey ?? null,
      stripeSecretKey: stripeConfig.secretKey ?? null,
      stripeWebhookSecret: stripeConfig.webhookSecret ?? null,
      stripeEnabled: stripeConfig.enabled ?? false,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/legal-policies
router.get('/legal-policies', async (req: AuthRequest, res: Response) => {
  try {
    const policies = await prisma.legalPolicy.findMany({ orderBy: { updatedAt: 'desc' } });
    res.json(policies);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/legal-policies
router.post('/legal-policies', async (req: AuthRequest, res: Response) => {
  const { title, content, version } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Missing fields' });
  try {
    const policy = await prisma.legalPolicy.create({ data: { title, content, version } });
    res.status(201).json(policy);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/pages
router.get('/pages', async (req: AuthRequest, res: Response) => {
  try {
    const pages = await prisma.page.findMany({ orderBy: { lastEdit: 'desc' } });
    res.json(pages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/pages
router.post('/pages', async (req: AuthRequest, res: Response) => {
  const { title, slug, content, status } = req.body;
  if (!title || !slug || !content) return res.status(400).json({ error: 'Missing fields' });
  try {
    const page = await prisma.page.create({ data: { title, slug, content, status: status || 'draft' } });
    res.status(201).json(page);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/pages/:id
router.put('/pages/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id: _id, ...data } = req.body;
    const page = await prisma.page.update({ where: { id: req.params.id }, data: { ...data, lastEdit: new Date() } });
    res.json(page);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/pages/:id
router.delete('/pages/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.page.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Dependency catalog (per-environment stack / versions; editable in admin) ─
router.get('/dependency-catalog', async (req: AuthRequest, res: Response) => {
  try {
    let config = await prisma.systemConfig.findUnique({ where: { key: 'global' } });
    if (!config) {
      config = await prisma.systemConfig.create({
        data: { key: 'global', taxRate: 0, commissionRate: 10, paymentMethods: ['platform', 'cash'] },
      });
    }
    let catalog = config.dependencyCatalog as unknown;
    if (!catalog || !isDependencyCatalogV1(catalog)) {
      const built = buildDefaultDependencyCatalog();
      config = await prisma.systemConfig.update({
        where: { key: 'global' },
        data: { dependencyCatalog: built as object, updatedAt: new Date() },
      });
      catalog = built;
    }
    res.json({ catalog });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/dependency-catalog',
  requireRole('owner', 'platform_admin', 'developer'),
  async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as unknown;
    if (!isDependencyCatalogV1(body)) {
      return res.status(400).json({
        error: 'Invalid catalog: need { version: 1, defaultProfile, profiles: { [name]: [{ category, name, spec }] } }',
      });
    }
    const config = await prisma.systemConfig.upsert({
      where: { key: 'global' },
      update: { dependencyCatalog: body as object, updatedAt: new Date() },
      create: {
        key: 'global',
        taxRate: 0,
        commissionRate: 10,
        paymentMethods: ['platform', 'cash'],
        dependencyCatalog: body as object,
      },
    });
    res.json({ catalog: config.dependencyCatalog });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/dependency-catalog/reset', requireRole('owner', 'platform_admin', 'developer'), async (req: AuthRequest, res: Response) => {
  try {
    const built = buildDefaultDependencyCatalog();
    const config = await prisma.systemConfig.upsert({
      where: { key: 'global' },
      update: { dependencyCatalog: built as object, updatedAt: new Date() },
      create: {
        key: 'global',
        taxRate: 0,
        commissionRate: 10,
        paymentMethods: ['platform', 'cash'],
        dependencyCatalog: built as object,
      },
    });
    res.json({ catalog: config.dependencyCatalog as DependencyCatalogV1 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dependency-catalog/export.txt', async (req: AuthRequest, res: Response) => {
  try {
    const profile = typeof req.query.profile === 'string' && req.query.profile ? req.query.profile : undefined;
    let config = await prisma.systemConfig.findUnique({ where: { key: 'global' } });
    let catalog = config?.dependencyCatalog as unknown;
    if (!catalog || !isDependencyCatalogV1(catalog)) {
      const built = buildDefaultDependencyCatalog();
      catalog = built;
    }
    const c = catalog as DependencyCatalogV1;
    const key = profile && c.profiles[profile] ? profile : c.defaultProfile;
    const text = catalogToText(c, key);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dependencies-${key}.txt"`);
    res.send(text);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users/emails?role=<UserRole>
// Returns a list of user emails filtered by role.
// Restricted to owner and platform_admin only.
const VALID_ROLES = [
  'owner', 'platform_admin', 'developer', 'support',
  'finance', 'customer', 'provider', 'staff',
] as const;

router.get(
  '/users/emails',
  requireRole('owner', 'platform_admin'),
  async (req: AuthRequest, res: Response) => {
    const { role } = req.query as { role?: string };

    if (!role) {
      return res.status(400).json({ error: 'role query param is required' });
    }

    if (!VALID_ROLES.includes(role as any)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    try {
      const users = await prisma.user.findMany({
        where: { role: role as any },
        select: { email: true },
      });
      const emails = users.map((u) => u.email);
      res.json({ role, count: emails.length, emails });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /api/admin/content-queue — unified moderation queue (pending media + flagged posts)
router.get('/content-queue', async (req: AuthRequest, res: Response) => {
  try {
    const [pendingMedia, flaggedPosts] = await Promise.all([
      prisma.mediaAsset.findMany({
        where: { moderationStatus: 'PENDING', archivedAt: null },
        include: { uploader: { select: { id: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.post.findMany({
        where: {
          archivedAt: null,
          mediaAsset: { moderationStatus: 'PENDING' },
        },
        include: {
          author: { select: { id: true, displayName: true } },
          mediaAsset: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    res.json({ pendingMedia, flaggedPosts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
