import { Pool } from "pg";

const mediaDbUrl =
  process.env.MEDIA_DATABASE_URL ||
  "postgresql://postgres:EagleRock901@postgres-media:5432/media_db";

const pool = new Pool({ connectionString: mediaDbUrl });

let ensured = false;

export async function ensureMediaSchema(): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      uploader_id TEXT,
      url TEXT NOT NULL,
      storage_path TEXT,
      file_name TEXT,
      mime_type TEXT,
      media_kind TEXT NOT NULL DEFAULT 'image',
      file_size_bytes BIGINT,
      source TEXT NOT NULL DEFAULT 'uploads',
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS media_assets_created_at_idx ON media_assets(created_at DESC);
    CREATE INDEX IF NOT EXISTS media_assets_kind_idx ON media_assets(media_kind);
  `);
  ensured = true;
}

function kindFromMime(mime: string | null | undefined): "image" | "video" | "other" {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "other";
}

export async function addMediaAsset(input: {
  uploaderId?: string | null;
  url: string;
  storagePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await ensureMediaSchema();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await pool.query(
    `
      INSERT INTO media_assets (
        id, uploader_id, url, storage_path, file_name, mime_type, media_kind, file_size_bytes, source, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'uploads',$9)
    `,
    [
      id,
      input.uploaderId || null,
      input.url,
      input.storagePath || null,
      input.fileName || null,
      input.mimeType || null,
      kindFromMime(input.mimeType),
      input.fileSizeBytes ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
}

export async function listRecentMedia(limit = 100): Promise<any[]> {
  await ensureMediaSchema();
  const rows = await pool.query(
    `SELECT id, uploader_id AS "uploaderId", url, file_name AS "fileName", mime_type AS "mimeType",
            media_kind AS "mediaKind", file_size_bytes AS "fileSizeBytes", created_at AS "createdAt"
       FROM media_assets
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows.rows;
}

