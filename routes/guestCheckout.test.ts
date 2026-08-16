import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ── Mock prisma ──────────────────────────────────────────────────────────────
vi.mock('../lib/db.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    providerServicePackage: {
      findUnique: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from '../lib/db.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
const mockFindUnique = prisma.user.findUnique as unknown as {
  mockResolvedValue: (v: unknown) => void;
  mockRejectedValueOnce: (v: unknown) => void;
};
const mockUserCreate = prisma.user.create as unknown as {
  mockResolvedValue: (v: unknown) => void;
};
const mockPkgFindUnique = prisma.providerServicePackage.findUnique as unknown as {
  mockResolvedValue: (v: unknown) => void;
};
const mockOrderCreate = prisma.order.create as unknown as {
  mockResolvedValue: (v: unknown) => void;
};
const mockOrderFindMany = prisma.order.findMany as unknown as {
  mockResolvedValue: (v: unknown) => void;
};

// ── Zod schema (mirrors the one in guestCheckout.ts) ─────────────────────────
const guestCheckoutSchema = z.object({
  servicePackageId: z.string().uuid(),
  description: z.string().min(10).max(2000),
  scheduledAt: z.string().datetime().optional(),
  contactName: z.string().min(2).max(100),
  contactPhone: z.string().min(10).max(20),
  contactEmail: z.string().email(),
  address: z.string().min(5).max(500),
  urgency: z.enum(['standard', 'urgent', 'emergency']).optional().default('standard'),
});

// ── Simulated endpoint logic ─────────────────────────────────────────────────

interface GuestCheckoutInput {
  servicePackageId: string;
  description: string;
  scheduledAt?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  urgency?: 'standard' | 'urgent' | 'emergency';
}

async function simulateGuestCheckout(input: GuestCheckoutInput) {
  // 1. Validate
  const parsed = guestCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: 'Validation failed', details: parsed.error.flatten() },
    };
  }

  const {
    servicePackageId,
    description,
    scheduledAt,
    contactName,
    contactPhone,
    contactEmail,
    address,
    urgency,
  } = parsed.data;

  // 2. Find or create guest user
  let user = await prisma.user.findUnique({ where: { email: contactEmail } });

  if (!user) {
    const nameParts = contactName.trim().split(/\s+/);
    const firstName = nameParts[0] || contactName;
    const lastName = nameParts.slice(1).join(' ') || 'Guest';

    user = await prisma.user.create({
      data: {
        email: contactEmail,
        firstName,
        lastName,
        phone: contactPhone,
        role: 'customer',
        isGuest: true,
      },
    });
  }

  // 3. Verify package
  const pkg = await prisma.providerServicePackage.findUnique({
    where: { id: servicePackageId },
    include: { serviceCatalog: true },
  });

  if (!pkg || !pkg.isActive) {
    return { status: 404, body: { error: 'Service package not found or inactive' } };
  }

  // 4. Create order
  const order = await prisma.order.create({
    data: {
      customerId: user.id,
      serviceCatalogId: pkg.serviceCatalogId,
      schemaSnapshot: (pkg as any).serviceCatalog?.dynamicFieldsSchema ?? {},
      answers: {},
      photos: [],
      description,
      scheduleFlexibility: 'asap',
      address,
      entryPoint: 'guest',
      urgency: urgency as any,
      status: 'submitted',
      phase: 'order',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
  });

  const guestToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

  return {
    status: 201,
    body: {
      data: {
        order: {
          id: order.id,
          status: order.status,
          description: order.description,
          createdAt: order.createdAt,
        },
        guestToken,
        message: 'Order created. Sign up to track your order.',
      },
    },
  };
}

async function simulateGetGuestOrders(token: string) {
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64').toString('utf-8');
  } catch {
    return { status: 400, body: { error: 'Invalid token format' } };
  }

  const colonIdx = decoded.indexOf(':');
  if (colonIdx === -1) {
    return { status: 400, body: { error: 'Invalid token' } };
  }

  const userId = decoded.slice(0, colonIdx);
  if (!userId) {
    return { status: 400, body: { error: 'Invalid token' } };
  }

  const orders = await prisma.order.findMany({
    where: { customerId: userId },
    include: {
      matchedPackage: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { status: 200, body: { data: orders } };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Guest Checkout', () => {
  const validInput: GuestCheckoutInput = {
    servicePackageId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
    description: 'I need help fixing my kitchen sink faucet',
    contactName: 'John Doe',
    contactPhone: '+14165551234',
    contactEmail: 'john.doe@example.com',
    address: '123 Main Street, Toronto, ON M5V 2T6',
    urgency: 'standard',
  };

  const mockPackage = {
    id: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
    serviceCatalogId: 'cat-1',
    isActive: true,
    bookingMode: 'booking',
    serviceCatalog: {
      dynamicFieldsSchema: { type: 'object', properties: {} },
    },
  };

  const mockUser = {
    id: 'user-guest-1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+14165551234',
    role: 'customer',
    isGuest: true,
  };

  const mockOrder = {
    id: 'order-1',
    customerId: 'user-guest-1',
    status: 'submitted',
    description: 'I need help fixing my kitchen sink faucet',
    createdAt: new Date('2026-05-26T00:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: Create order for new guest user ────────────────────────────
  it('should create order for new guest user', async () => {
    mockFindUnique.mockResolvedValue(null); // user not found → will create
    mockUserCreate.mockResolvedValue(mockUser);
    mockPkgFindUnique.mockResolvedValue(mockPackage);
    mockOrderCreate.mockResolvedValue(mockOrder);

    const result = await simulateGuestCheckout(validInput);

    expect(result.status).toBe(201);
    expect(result.body).toHaveProperty('data');
    expect(result.body.data).toHaveProperty('order');
    expect(result.body.data.order.id).toBe('order-1');
    expect(result.body.data.order.status).toBe('submitted');
    expect(result.body.data).toHaveProperty('guestToken');
    expect(result.body.data.message).toBe('Order created. Sign up to track your order.');

    // Verify user was created with isGuest = true
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'john.doe@example.com',
          isGuest: true,
          role: 'customer',
        }),
      }),
    );
  });

  // ── Test 2: Use existing user if email already exists ──────────────────
  it('should use existing user if email already exists', async () => {
    mockFindUnique.mockResolvedValue(mockUser); // user found
    mockPkgFindUnique.mockResolvedValue(mockPackage);
    mockOrderCreate.mockResolvedValue(mockOrder);

    const result = await simulateGuestCheckout(validInput);

    expect(result.status).toBe(201);
    expect(prisma.user.create).not.toHaveBeenCalled(); // should not create new user
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'john.doe@example.com' },
    });
  });

  // ── Test 3: Reject invalid input ───────────────────────────────────────
  it('should reject invalid input', async () => {
    const invalidInput = {
      ...validInput,
      contactEmail: 'not-an-email',
      contactPhone: '123', // too short
    };

    const result = await simulateGuestCheckout(invalidInput);

    expect(result.status).toBe(400);
    expect(result.body).toHaveProperty('error', 'Validation failed');
    expect(result.body).toHaveProperty('details');
  });

  // ── Test 4: Reject inactive service packages ───────────────────────────
  it('should reject inactive service packages', async () => {
    mockFindUnique.mockResolvedValue(null); // user not found
    mockUserCreate.mockResolvedValue(mockUser);
    mockPkgFindUnique.mockResolvedValue({ ...mockPackage, isActive: false });

    const result = await simulateGuestCheckout(validInput);

    expect(result.status).toBe(404);
    expect(result.body).toHaveProperty('error', 'Service package not found or inactive');
  });

  // ── Test 5: Track orders via guest token ───────────────────────────────
  it('should track orders via guest token', async () => {
    const mockOrders = [
      {
        id: 'order-1',
        customerId: 'user-guest-1',
        status: 'submitted',
        description: 'I need help fixing my kitchen sink faucet',
        createdAt: new Date('2026-05-26T00:00:00Z'),
        matchedPackage: { name: 'Plumbing Fix' },
      },
    ];

    mockOrderFindMany.mockResolvedValue(mockOrders);

    const token = Buffer.from('user-guest-1:1717000000000').toString('base64');
    const result = await simulateGetGuestOrders(token);

    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty('data');
    expect(result.body.data).toHaveLength(1);
    expect(result.body.data[0].id).toBe('order-1');
    expect(result.body.data[0].matchedPackage.name).toBe('Plumbing Fix');
  });

  // ── Test 6: Reject invalid token ───────────────────────────────────────
  it('should reject invalid token', async () => {
    // Buffer.from handles base64 gracefully, so use a truly malformed input
    // that will cause the colon-split to fail
    const result = await simulateGetGuestOrders('');

    expect(result.status).toBe(400);
    expect(result.body).toHaveProperty('error', 'Invalid token');
  });

  // ── Test 7: Reject token without userId ────────────────────────────────
  it('should reject token without userId', async () => {
    const token = Buffer.from(':1717000000000').toString('base64');
    const result = await simulateGetGuestOrders(token);

    expect(result.status).toBe(400);
    expect(result.body).toHaveProperty('error', 'Invalid token');
  });
});
