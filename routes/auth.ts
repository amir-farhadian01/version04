import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';
import prisma from '../lib/db.js';
import { generateTokenPair, verifyRefreshToken, signAccessToken } from '../lib/jwt.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { publish } from '../lib/bus.js';
import { authLimiter } from '../lib/rateLimiter.js';
import { blacklistToken } from '../lib/tokenBlacklist.js';
import { createPasswordResetToken, consumePasswordResetToken } from '../lib/passwordReset.js';
import {
  normalizeUsername,
  isValidUsername,
  generateUsername,
  suggestUsername,
} from '../lib/username.js';

const router = Router();

function getRequestIp(req: Request): string | undefined {
  const x = req.headers['x-forwarded-for'];
  if (typeof x === 'string' && x) return x.split(',')[0]!.trim();
  if (Array.isArray(x) && x[0]) return x[0]!.split(',')[0]!.trim();
  return req.socket?.remoteAddress ?? (req as { ip?: string }).ip;
}

/** Short label from User-Agent (no new dependencies). */
function normalizeEmail(email: string): string {
  const [local, domain] = email.toLowerCase().trim().split('@');
  if (!domain) return email.toLowerCase().trim();
  // Gmail: strip dots and +alias
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return local.replace(/\./g, '').split('+')[0] + '@' + domain;
  }
  return local + '@' + domain;
}

function userAgentToShortLabel(ua: string | undefined): string | null {

  if (!ua?.trim()) return null;
  let os = '';
  if (/Windows NT 10\.0|Windows NT 11/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X ([\d._]+)/i.test(ua)) {
    const m = ua.match(/Mac OS X ([\d._]+)/i);
    os = m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/Android ([\d.]+)/i.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/i);
    os = m ? `Android ${m[1]}` : 'Android';
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    const m = ua.match(/OS ([\d_]+)/i);
    const v = m ? m[1].replace(/_/g, '.') : '';
    if (/iPhone/.test(ua)) os = v ? `iPhone / iOS ${v}` : 'iPhone';
    else if (/iPad/.test(ua)) os = v ? `iPad / iOS ${v}` : 'iPad';
    else os = v ? `iOS ${v}` : 'iOS';
  } else if (/Linux/i.test(ua)) os = 'Linux';
  else os = 'Device';
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/\bChrome\//.test(ua) && !/Edg|OPR\//.test(ua)) browser = 'Chrome';
  else if (/\bSafari\//.test(ua) && !/\bChrome\//.test(ua)) browser = 'Safari';
  else if (/\bFirefox\//.test(ua)) browser = 'Firefox';
  return `${os} / ${browser}`.slice(0, 200);
}

async function touchUserSessionOnAuth(req: Request, userId: string): Promise<void> {
  try {
    const ip = getRequestIp(req) ?? null;
    const lastDevice = userAgentToShortLabel(req.headers['user-agent'] as string | undefined);
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), lastSeenAt: new Date(), lastIp: ip, lastDevice },
    });
  } catch (e) {
    console.warn('touchUserSessionOnAuth failed', e);
  }
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const OWNER_EMAIL = 'amirfarhadian569@gmail.com';
const rpName = 'Neighborly App';

// ─── Update Profile ─────────────────────────────────────────────────────────
router.post('/update-profile', authenticate, async (req: AuthRequest, res: Response) => {
  const { displayName } = req.body as { displayName?: string };
  if (!displayName || displayName.trim().length < 2) {
    return res.status(400).json({ error: 'Display name must be at least 2 characters' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { displayName: displayName.trim(), isVerified: true },
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        phone: user.phone,
        role: user.role,
        companyId: user.companyId,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Register ────────────────────────────────────────────────────────────────
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const { email, password, displayName, role = 'customer', phone, username, firstName, lastName } = req.body;
  if (!email || !password || !displayName)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Normalize email and check uniqueness
    const normalizedEmail = normalizeEmail(email);
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) return res.status(409).json({ error: 'Email already registered' });

    const existingByNormalized = await prisma.user.findUnique({ where: { normalizedEmail } });
    if (existingByNormalized) return res.status(409).json({ error: 'Email already registered' });

    // Check for duplicate displayName (case-insensitive)
    const normalizedDisplayName = displayName.toLowerCase();
    const existingDisplayName = await prisma.user.findUnique({ where: { normalizedDisplayName } });
    if (existingDisplayName) return res.status(409).json({ error: 'Display name already taken' });

    // Check for duplicate phone (if provided)
    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) return res.status(409).json({ error: 'Phone number already registered' });
    }

    // ─── Username generation ──────────────────────────────────────────────
    let chosenUsername: string;
    if (username && typeof username === 'string' && username.trim()) {
      chosenUsername = normalizeUsername(username);
      if (!isValidUsername(chosenUsername)) {
        return res.status(400).json({ error: 'Invalid username format. Use 3-30 characters, letters/numbers/dashes only.' });
      }
      // Check uniqueness against users and history
      const existingUserByUsername = await prisma.user.findUnique({ where: { normalizedUsername: chosenUsername } });
      if (existingUserByUsername) return res.status(409).json({ error: 'Username already taken' });
      const existingHistory = await prisma.usernameHistory.findUnique({ where: { username: chosenUsername } });
      if (existingHistory) return res.status(409).json({ error: 'Username already taken (reserved)' });
    } else {
      // Auto-generate from firstName/lastName/displayName
      const baseFirstName = firstName || (displayName ? displayName.split(' ')[0] : '');
      const baseLastName = lastName || (displayName ? displayName.split(' ').slice(1).join(' ') : '');
      chosenUsername = generateUsername(baseFirstName, baseLastName || undefined);
      // Check uniqueness, append suffix if needed
      let existingCheck = await prisma.user.findUnique({ where: { normalizedUsername: chosenUsername } });
      let historyCheck = await prisma.usernameHistory.findUnique({ where: { username: chosenUsername } });
      let attempts = 0;
      while ((existingCheck || historyCheck) && attempts < 10) {
        chosenUsername = suggestUsername(chosenUsername);
        existingCheck = await prisma.user.findUnique({ where: { normalizedUsername: chosenUsername } });
        historyCheck = await prisma.usernameHistory.findUnique({ where: { username: chosenUsername } });
        attempts++;
      }
    }

    const hashed = await bcrypt.hash(password, 12);
    const assignedRole = email === OWNER_EMAIL ? 'owner' : role;

    const regIp = getRequestIp(req) ?? null;
    const user = await prisma.user.create({
      data: {
        email,
        normalizedEmail,
        password: hashed,
        displayName,
        normalizedDisplayName,
        username: chosenUsername,
        normalizedUsername: chosenUsername,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        role: assignedRole as any,
        isVerified: email === OWNER_EMAIL,
        registrationIp: regIp,
      },
    });

    // Record username in history
    await prisma.usernameHistory.create({
      data: { userId: user.id, username: chosenUsername, isActive: true },
    });

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      username: user.username ?? undefined,
    });
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });

    await publish('user.registered', { userId: user.id, email: user.email, role: user.role });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        role: user.role,
        companyId: user.companyId,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Login ───────────────────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const { login, password } = req.body;
  if (!login || !password) return res.status(400).json({ error: 'Missing credentials' });

  try {
    // login can be: email, normalizedDisplayName (username), or phone
    let user = await prisma.user.findUnique({ where: { email: login } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { normalizedDisplayName: login.toLowerCase() } });
    }
    if (!user) {
      // Use findFirst for phone since it's nullable and may not be in the generated unique type
      user = await prisma.user.findFirst({ where: { phone: login } });
    }

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Account not found. Please check your credentials.', code: 'USER_NOT_FOUND' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password', code: 'INVALID_PASSWORD' });
    }

    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      username: user.username ?? undefined,
    });
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });
    await touchUserSessionOnAuth(req, user.id);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        role: user.role,
        companyId: user.companyId,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Forgot / Reset Password ────────────────────────────────────────────────
router.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return the same generic response to prevent email enumeration.
    if (!user || !user.password) {
      return res.json({ success: true });
    }

    const token = await createPasswordResetToken(user.id);
    const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 8080}`;
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

    // No email transport is configured yet — log the link and surface it in
    // development. Wire a mail provider (SendGrid/Resend/SES) here in production.
    console.log(`[PasswordReset] Reset link for ${user.email}: ${resetLink}`);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Forgot password failed' });
  }
});

router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and newPassword are required' });
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const result = await consumePasswordResetToken(token);
    if (!result.ok || !result.userId) {
      return res.status(400).json({
        error: result.error ?? 'Invalid or expired token',
        code: result.code ?? 'INVALID_TOKEN',
      });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: result.userId },
      data: { password: hashed, refreshToken: null },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Reset password failed' });
  }
});

// ─── Apple Sign-In ────────────────────────────────────────────────────────────
router.post('/apple', authLimiter, async (req: Request, res: Response) => {
  const { identityToken, fullName } = req.body as {
    identityToken?: string;
    fullName?: { givenName?: string; familyName?: string };
  };

  if (!identityToken) {
    return res.status(400).json({ error: 'identityToken is required', code: 'MISSING_IDENTITY_TOKEN' });
  }

  try {
    // Decode the Apple identity token (base64url JWT)
    const parts = identityToken.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid identity token format' });
    }

    const payloadStr = Buffer.from(parts[1]!, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadStr) as {
      sub: string;
      email?: string;
      email_verified?: string | boolean;
      is_private_email?: string | boolean;
      aud: string;
      iss: string;
      iat: number;
      exp: number;
    };

    if (payload.iss !== 'https://appleid.apple.com') {
      return res.status(401).json({ error: 'Invalid token issuer', code: 'INVALID_ISSUER' });
    }
    if (payload.exp && Date.now() > payload.exp * 1000) {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }

    const appleSub = payload.sub;
    const appleEmail = payload.email;
    const isPrivateEmail = payload.is_private_email === 'true' || payload.is_private_email === true;
    const displayName = fullName
      ? [fullName.givenName, fullName.familyName].filter(Boolean).join(' ')
      : undefined;

    // Find or create user
    let user = await prisma.user.findFirst({ where: { appleId: appleSub } });

    if (!user && appleEmail) {
      user = await prisma.user.findUnique({ where: { email: appleEmail } });
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { appleId: appleSub } });
      }
    }

    if (!user) {
      const email = appleEmail || `apple_${appleSub}@neighborly.local`;
      const normalizedEmail = appleEmail ? normalizeEmail(appleEmail) : email;
      const assignedRole = email === OWNER_EMAIL ? 'owner' : 'customer';
      user = await prisma.user.create({
        data: {
          email,
          normalizedEmail,
          displayName: displayName || `User_${appleSub.slice(0, 8)}`,
          appleId: appleSub,
          role: assignedRole as any,
          isVerified: email === OWNER_EMAIL || !isPrivateEmail,
          registrationIp: getRequestIp(req) ?? null,
        },
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });
    }

    const tokens = generateTokenPair({
      userId: user.id, email: user.email, role: user.role,
      username: user.username ?? undefined,
    });
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });
    await touchUserSessionOnAuth(req, user.id);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: tokens.accessToken,
      user: {
        id: user.id, email: user.email, displayName: user.displayName,
        username: user.username, role: user.role, companyId: user.companyId,
        avatarUrl: user.avatarUrl,
        onboardingCompleted: !!user.onboardingCompletedAt,
      },
      needsOnboarding: !user.onboardingCompletedAt,
    });
  } catch (err: any) {
    console.error('Apple auth error:', err.message);
    res.status(401).json({ error: 'Apple authentication failed', code: 'APPLE_AUTH_FAILED' });
  }
});

// ─── Onboarding Completion ────────────────────────────────────────────────────
router.post('/onboarding', authenticate, async (req: AuthRequest, res: Response) => {
  const { interests, latitude, longitude, address, avatarUrl } = req.body as {
    interests?: string[];
    latitude?: number;
    longitude?: number;
    address?: string;
    avatarUrl?: string;
  };

  if (!interests || !Array.isArray(interests) || interests.length < 3) {
    return res.status(400).json({ error: 'Please select at least 3 interests', code: 'MIN_INTERESTS' });
  }

  try {
    const updateData: Record<string, unknown> = {
      onboardingInterests: interests,
      onboardingCompletedAt: new Date(),
    };
    if (latitude !== undefined && longitude !== undefined) {
      updateData.locationLat = latitude;
      updateData.locationLng = longitude;
    }
    if (address) {
      updateData.address = address;
      updateData.location = address;
    }
    if (avatarUrl) updateData.avatarUrl = avatarUrl;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updateData,
      select: {
        id: true, email: true, displayName: true, username: true,
        role: true, companyId: true, avatarUrl: true,
        onboardingCompletedAt: true, onboardingInterests: true, location: true,
      },
    });

    // Create default address if provided
    if (address && latitude !== undefined && longitude !== undefined) {
      await prisma.userAddress.upsert({
        where: { id: `${req.user!.userId}_home` },
        create: {
          id: `${req.user!.userId}_home`,
          userId: req.user!.userId,
          label: 'home', street: address, city: '', province: '', postalCode: '', country: 'CA',
          latitude, longitude, categoryTags: interests, isDefault: true,
        },
        update: { street: address, latitude, longitude, categoryTags: interests },
      });
    }

    await publish('user.onboarding.completed', { userId: user.id, interests });
    res.json({ data: user });
  } catch (err: any) {
    console.error('Onboarding error:', err);
    res.status(500).json({ error: err.message || 'Onboarding failed', code: 'ONBOARDING_FAILED' });
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────
// Accepts either an id_token (from Google One Tap) or an access_token (from OAuth flow)
router.post('/google', authLimiter, async (req: Request, res: Response) => {
  const { idToken, accessToken, email: directEmail, name: directName, picture } = req.body;

  let googleEmail: string | undefined;
  let googleName: string | undefined;
  let googlePicture: string | undefined;
  let googleSub: string | undefined;

  try {
    if (idToken) {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) return res.status(400).json({ error: 'Invalid Google token' });
      googleSub = payload.sub;
      googleEmail = payload.email;
      googleName = payload.name;
      googlePicture = payload.picture;
    } else if (accessToken) {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userInfoRes.ok) return res.status(401).json({ error: 'Invalid Google access token' });
      const userInfo = await userInfoRes.json() as any;
      googleEmail = userInfo.email || directEmail;
      googleName = userInfo.name || directName;
      googlePicture = userInfo.picture || picture;
    } else if (directEmail) {
      googleEmail = directEmail;
      googleName = directName;
      googlePicture = picture;
    } else {
      return res.status(400).json({ error: 'Missing token or email' });
    }

    if (!googleEmail) return res.status(400).json({ error: 'Could not retrieve email' });

    let user = await prisma.user.findUnique({ where: { email: googleEmail } });
    if (!user) {
      const normalizedGoogleEmail = normalizeEmail(googleEmail);
      const assignedRole = googleEmail === OWNER_EMAIL ? 'owner' : 'customer';
      user = await prisma.user.create({
        data: {
          email: googleEmail,
          normalizedEmail: normalizedGoogleEmail,
          displayName: googleName || googleEmail,
          avatarUrl: googlePicture,
          googleId: googleSub || undefined,
          role: assignedRole as any,
          isVerified: googleEmail === OWNER_EMAIL,
          registrationIp: getRequestIp(req) ?? null,
        },
      });
    } else if (googleSub && !user.googleId) {
      await prisma.user.update({ where: { id: user.id }, data: { googleId: googleSub } });
      user = (await prisma.user.findUnique({ where: { id: user.id } }))!;
    }

    const tokens = generateTokenPair({ userId: user.id, email: user.email, role: user.role });
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: tokens.accessToken,
      user: {
        id: user.id, email: user.email, displayName: user.displayName,
        role: user.role, companyId: user.companyId, avatarUrl: user.avatarUrl,
        onboardingCompleted: !!user.onboardingCompletedAt,
      },
      needsOnboarding: !user.onboardingCompletedAt,
    });
  } catch (err: any) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

// POST /api/auth/google/link — link Google to the logged-in account (id_token from GSI / OAuth)
router.post('/google/link', authenticate, async (req: AuthRequest, res: Response) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) return res.status(400).json({ error: 'idToken is required' });
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'GOOGLE_CLIENT_ID is not configured on the server' });
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) return res.status(400).json({ error: 'Invalid Google id_token' });
    const sub = payload.sub;
    const other = await prisma.user.findFirst({
      where: { googleId: sub, NOT: { id: req.user!.userId } },
    });
    if (other) {
      return res.status(409).json({ error: 'This Google account is already linked to another Neighborly account' });
    }
    const email = payload.email;
    if (email) {
      const sameEmail = await prisma.user.findFirst({
        where: { email, NOT: { id: req.user!.userId } },
      });
      if (sameEmail) {
        return res.status(409).json({ error: 'A different account already uses this Google email' });
      }
    }
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { googleId: sub },
    });
    res.json({ success: true, googleLinked: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Google link failed' });
  }
});

// ─── Refresh Token ────────────────────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.refreshToken !== token) return res.status(401).json({ error: 'Invalid refresh token' });

    const newAccessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role });
    await touchUserSessionOnAuth(req, user.id);
    res.json({ accessToken: newAccessToken });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// ─── Logout ──────────────────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Blacklist the access token so it can't be used after logout
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // Blacklist for 15 minutes (matching ACCESS_EXPIRY)
      await blacklistToken(token, 15 * 60);
    }

    await prisma.user.update({ where: { id: req.user!.userId }, data: { refreshToken: null } });
    res.clearCookie('refreshToken');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── Get Me ───────────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, displayName: true, username: true,
        role: true, status: true,
        companyId: true, isVerified: true, avatarUrl: true, bio: true, location: true, phone: true, address: true,
        mfaEnabled: true, createdAt: true, googleId: true, accountPreferences: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { googleId, ...rest } = user;
    res.json({ ...rest, googleLinked: !!googleId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Update Profile (avatar, bio, displayName, address) ─────────────────────
router.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, bio, address, avatarUrl } = req.body as {
      displayName?: string;
      bio?: string;
      address?: string;
      avatarUrl?: string;
    };
    const data: Record<string, unknown> = {};
    if (displayName !== undefined) {
      if (displayName.trim().length < 2) {
        return res.status(400).json({ error: 'Display name must be at least 2 characters' });
      }
      data.displayName = displayName.trim();
      data.normalizedDisplayName = displayName.trim().toLowerCase();
    }
    if (bio !== undefined) data.bio = bio;
    if (address !== undefined) data.address = address;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: {
        id: true, email: true, displayName: true, role: true, phone: true,
        avatarUrl: true, bio: true, address: true, isVerified: true,
        mfaEnabled: true, companyId: true,
      },
    });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Update Phone ────────────────────────────────────────────────────────────
router.put('/me/phone', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone || phone.trim().length < 5) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    const existing = await prisma.user.findUnique({ where: { phone: phone.trim() } });
    if (existing && existing.id !== req.user!.userId) {
      return res.status(409).json({ error: 'Phone number already in use' });
    }
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { phone: phone.trim() },
      select: { phone: true },
    });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Update Email ────────────────────────────────────────────────────────────
router.put('/me/email', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const newEmail = email.trim().toLowerCase();
    const normalizedEmail = normalizeEmail(newEmail);
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== req.user!.userId) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    const existingByNormalized = await prisma.user.findUnique({ where: { normalizedEmail } });
    if (existingByNormalized && existingByNormalized.id !== req.user!.userId) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { email: newEmail, normalizedEmail },
      select: { email: true },
    });
    res.json(user);

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Change Password ─────────────────────────────────────────────────────────
router.put('/me/password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.password) {
      return res.status(400).json({ error: 'Cannot change password for OAuth-only accounts' });
    }
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, refreshToken: null },
    });
    res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Toggle 2FA / MFA ────────────────────────────────────────────────────────
router.put('/me/mfa', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled (boolean) is required' });
    }
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { mfaEnabled: enabled },
      select: { mfaEnabled: true },
    });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── WebAuthn Registration Options ───────────────────────────────────────────
router.post('/register-options', async (req: Request, res: Response) => {
  const { userId, email } = req.body;
  const rpID = (req as any).rpID;
  if (!userId || !email) return res.status(400).json({ error: 'Missing userId or email' });

  try {
    const credentials = await prisma.webAuthnCredential.findMany({ where: { userId } });

    const options = await generateRegistrationOptions({
      rpName, rpID,
      userID: Buffer.from(userId),
      userName: email,
      attestationType: 'none',
      excludeCredentials: credentials.map((c) => ({
        id: c.credentialID,
        type: 'public-key' as const,
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });

    res.cookie('registrationChallenge', options.challenge, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none',
    });
    res.json(options);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── WebAuthn Verify Registration ─────────────────────────────────────────────
router.post('/verify-registration', async (req: Request, res: Response) => {
  const { userId, body } = req.body;
  const expectedChallenge = req.cookies.registrationChallenge;
  const rpID = (req as any).rpID;
  const origin = (req as any).origin;

  if (!userId || !body || !expectedChallenge)
    return res.status(400).json({ error: 'Missing data or challenge' });

  try {
    const verification = await verifyRegistrationResponse({
      response: body as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      await prisma.webAuthnCredential.create({
        data: {
          userId,
          credentialID: Buffer.from(credential.id).toString('base64'),
          credentialPublicKey: Buffer.from(credential.publicKey).toString('base64'),
          counter: BigInt(credential.counter),
          transports: JSON.stringify(body.response.transports || []),
        },
      });
      res.json({ verified: true });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── WebAuthn Login Options ───────────────────────────────────────────────────
router.post('/login-options', async (req: Request, res: Response) => {
  const { email } = req.body;
  const rpID = (req as any).rpID;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const credentials = await prisma.webAuthnCredential.findMany({ where: { userId: user.id } });
    if (!credentials.length) return res.status(400).json({ error: 'No credentials registered' });

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map((c) => ({
        id: c.credentialID,
        type: 'public-key' as const,
        transports: c.transports ? JSON.parse(c.transports) : [],
      })),
      userVerification: 'preferred',
    });

    res.cookie('authenticationChallenge', options.challenge, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none',
    });
    res.cookie('authUserId', user.id, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none',
    });
    res.json(options);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── WebAuthn Verify Login ────────────────────────────────────────────────────
router.post('/verify-login', async (req: Request, res: Response) => {
  const { body } = req.body;
  const expectedChallenge = req.cookies.authenticationChallenge;
  const userId = req.cookies.authUserId;
  const rpID = (req as any).rpID;
  const origin = (req as any).origin;

  if (!body || !expectedChallenge || !userId)
    return res.status(400).json({ error: 'Missing data or challenge' });

  try {
    const credential = await prisma.webAuthnCredential.findUnique({
      where: { credentialID: body.id },
    });
    if (!credential) return res.status(400).json({ error: 'Credential not found' });

    const verification = await verifyAuthenticationResponse({
      response: body as AuthenticationResponseJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialID,
        publicKey: Buffer.from(credential.credentialPublicKey, 'base64'),
        counter: Number(credential.counter),
      },
    });

    if (verification.verified) {
      await prisma.webAuthnCredential.update({
        where: { id: credential.id },
        data: { counter: BigInt(verification.authenticationInfo.newCounter) },
      });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const tokens = generateTokenPair({ userId: user.id, email: user.email, role: user.role });
      await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        verified: true,
        accessToken: tokens.accessToken,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, companyId: user.companyId, avatarUrl: user.avatarUrl },
      });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
