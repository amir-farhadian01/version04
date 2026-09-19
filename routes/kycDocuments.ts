import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { Router, type Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, type AuthRequest } from '../lib/auth.middleware.js';

const router = Router();
const privateDir = path.join(process.cwd(), 'private-uploads', 'kyc');
fs.mkdirSync(privateDir, { recursive: true });
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, privateDir),
    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, allowedMimeTypes.has(file.mimetype)),
});

type DocumentRow = { id: string; ownerId: string; storagePath: string; fileName: string; mimeType: string; sizeBytes: number };
const adminRoles = new Set(['owner', 'platform_admin', 'support']);

function signingSecret(): string {
  const value = process.env.KYC_DOCUMENT_SIGNING_SECRET || process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('KYC document signing is not configured');
  return value;
}

export function signKycDocumentAccess(id: string, expires: number, secret = signingSecret()): string {
  return createHmac('sha256', secret).update(`${id}.${expires}`).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyKycDocumentAccess(id: string, expires: number, supplied: string, nowSeconds = Math.floor(Date.now() / 1000), secret = signingSecret()): boolean {
  return Number.isInteger(expires) && expires >= nowSeconds && safeEqual(signKycDocumentAccess(id, expires, secret), supplied);
}

async function loadDocument(id: string): Promise<DocumentRow | null> {
  const rows = await prisma.$queryRaw<DocumentRow[]>`
    SELECT "id", "ownerId", "storagePath", "fileName", "mimeType", "sizeBytes" FROM "KycDocument" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function assertKycDocumentsOwned(userId: string, references: string[]): Promise<boolean> {
  const ids = references.map((value) => value.startsWith('kyc-document://') ? value.slice('kyc-document://'.length) : '').filter(Boolean);
  if (ids.length !== references.length || new Set(ids).size !== ids.length) return false;
  for (const id of ids) {
    const document = await loadDocument(id);
    if (!document || document.ownerId !== userId) return false;
  }
  return true;
}

router.post('/', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'A JPEG, PNG, WebP, or PDF document is required' });
  try {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "KycDocument" ("id", "ownerId", "storagePath", "fileName", "mimeType", "sizeBytes", "createdAt")
      VALUES (${id}, ${req.user!.userId}, ${req.file.path}, ${req.file.originalname}, ${req.file.mimetype}, ${req.file.size}, NOW())
    `;
    res.status(201).json({ documentId: id, reference: `kyc-document://${id}` });
  } catch {
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    res.status(500).json({ error: 'Document upload failed' });
  }
});

router.get('/:id/access', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const document = await loadDocument(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (document.ownerId !== req.user!.userId && !adminRoles.has(req.user!.role)) return res.status(403).json({ error: 'Forbidden' });
    const expires = Math.floor(Date.now() / 1000) + 300;
    res.json({ url: `/api/kyc/v2/documents/${document.id}/content?expires=${expires}&signature=${signKycDocumentAccess(document.id, expires)}`, expiresAt: new Date(expires * 1000).toISOString() });
  } catch {
    res.status(503).json({ error: 'Document access is temporarily unavailable' });
  }
});

router.get('/:id/content', async (req, res: Response) => {
  try {
    const expires = Number(req.query.expires);
    const supplied = typeof req.query.signature === 'string' ? req.query.signature : '';
    if (!verifyKycDocumentAccess(req.params.id, expires, supplied)) {
      return res.status(403).json({ error: 'Invalid or expired document URL' });
    }
    const document = await loadDocument(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    const resolved = path.resolve(document.storagePath);
    if (!resolved.startsWith(`${path.resolve(privateDir)}${path.sep}`)) return res.status(403).json({ error: 'Invalid document path' });
    res.type(document.mimeType);
    res.setHeader('content-disposition', `inline; filename="${path.basename(document.fileName).replace(/"/g, '')}"`);
    res.setHeader('cache-control', 'private, no-store');
    res.sendFile(resolved);
  } catch {
    res.status(403).json({ error: 'Invalid or expired document URL' });
  }
});

export default router;
