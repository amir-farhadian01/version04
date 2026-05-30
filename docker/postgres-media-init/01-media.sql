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
