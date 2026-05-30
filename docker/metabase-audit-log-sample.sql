-- Metabase: Admin → Databases → Add database → PostgreSQL
--   Host: postgres   Port: 5432   Database: neighborly_db (app DB, not only metabase_db)
--   User / Password: same as DB_USER / DB_PASSWORD in compose
-- Then run a native query or model on the table below:

SELECT
  id,
  "timestamp",
  action,
  "resourceType",
  "resourceId",
  metadata::text AS metadata_json
FROM "AuditLog"
ORDER BY "timestamp" DESC
LIMIT 500;

-- Note: these are app-persisted events; container stdout streams are in Dozzle (/dozzle or port 8888).
