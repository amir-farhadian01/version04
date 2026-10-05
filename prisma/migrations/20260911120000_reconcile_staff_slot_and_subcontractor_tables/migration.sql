-- Guarded reconciliation for schema-present / migration-missing legacy tables.
-- This migration is intentionally forward-only: it creates absent compatible
-- objects and aborts instead of dropping, renaming, or coercing existing data.

DO $reconcile$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type type_record
    JOIN pg_namespace namespace_record ON namespace_record.oid = type_record.typnamespace
    WHERE namespace_record.nspname = 'public' AND type_record.typname = 'SubcontractStatus'
  ) THEN
    CREATE TYPE "SubcontractStatus" AS ENUM (
      'pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled'
    );
  ELSIF (
    SELECT array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder)
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'SubcontractStatus'
  ) <> ARRAY['pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled']::TEXT[] THEN
    RAISE EXCEPTION 'Existing SubcontractStatus enum is incompatible';
  END IF;
END
$reconcile$;

DO $reconcile$
BEGIN
  IF to_regclass('public.subcontractor_assignments') IS NULL THEN
    CREATE TABLE "subcontractor_assignments" (
      "id" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "prime_workspace_id" TEXT NOT NULL,
      "sub_workspace_id" TEXT NOT NULL,
      "assigned_staff_id" TEXT,
      "status" "SubcontractStatus" NOT NULL DEFAULT 'pending',
      "prime_share_percent" DOUBLE PRECISION NOT NULL DEFAULT 100,
      "sub_share_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "notes" TEXT,
      "agreed_at" TIMESTAMP(3),
      "started_at" TIMESTAMP(3),
      "completed_at" TIMESTAMP(3),
      "rejected_at" TIMESTAMP(3),
      "rejection_reason" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "subcontractor_assignments_pkey" PRIMARY KEY ("id")
    );
  ELSIF EXISTS (
    SELECT 1
    FROM (VALUES
      ('id', 'text', 'NO'),
      ('orderId', 'text', 'NO'),
      ('prime_workspace_id', 'text', 'NO'),
      ('sub_workspace_id', 'text', 'NO'),
      ('assigned_staff_id', 'text', 'YES'),
      ('status', 'USER-DEFINED', 'NO'),
      ('prime_share_percent', 'double precision', 'NO'),
      ('sub_share_percent', 'double precision', 'NO'),
      ('notes', 'text', 'YES'),
      ('agreed_at', 'timestamp without time zone', 'YES'),
      ('started_at', 'timestamp without time zone', 'YES'),
      ('completed_at', 'timestamp without time zone', 'YES'),
      ('rejected_at', 'timestamp without time zone', 'YES'),
      ('rejection_reason', 'text', 'YES'),
      ('created_at', 'timestamp without time zone', 'NO'),
      ('updated_at', 'timestamp without time zone', 'NO')
    ) AS expected(column_name, data_type, is_nullable)
    LEFT JOIN information_schema.columns actual
      ON actual.table_schema = 'public'
      AND actual.table_name = 'subcontractor_assignments'
      AND actual.column_name = expected.column_name
    WHERE actual.column_name IS NULL
       OR actual.data_type <> expected.data_type
       OR actual.is_nullable <> expected.is_nullable
  ) THEN
    RAISE EXCEPTION 'Existing subcontractor_assignments table is incompatible';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subcontractor_assignments'
      AND column_name = 'status'
      AND (udt_schema <> 'public' OR udt_name <> 'SubcontractStatus')
  ) THEN
    RAISE EXCEPTION 'Existing subcontractor_assignments.status enum is incompatible';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    JOIN pg_class table_record ON table_record.oid = constraint_record.conrelid
    JOIN pg_namespace namespace_record ON namespace_record.oid = table_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND table_record.relname = 'subcontractor_assignments'
      AND constraint_record.contype = 'p'
      AND ARRAY(
        SELECT attribute.attname::TEXT
        FROM unnest(constraint_record.conkey) WITH ORDINALITY AS key(attnum, position)
        JOIN pg_attribute attribute ON attribute.attrelid = constraint_record.conrelid AND attribute.attnum = key.attnum
        ORDER BY key.position
      ) = ARRAY['id']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'Existing subcontractor_assignments primary key is incompatible';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subcontractor_assignments'
      AND is_nullable = 'NO' AND column_default IS NULL AND is_identity = 'NO' AND is_generated = 'NEVER'
      AND column_name NOT IN ('id', 'orderId', 'prime_workspace_id', 'sub_workspace_id', 'updated_at')
  ) THEN
    RAISE EXCEPTION 'Existing subcontractor_assignments has an incompatible required extra column';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subcontractor_assignments'
      AND (
        (column_name = 'status' AND (column_default IS NULL OR column_default NOT LIKE '%pending%'))
        OR (column_name = 'prime_share_percent' AND (column_default IS NULL OR column_default::TEXT NOT LIKE '%100%'))
        OR (column_name = 'sub_share_percent' AND (column_default IS NULL OR column_default::TEXT NOT LIKE '%0%'))
        OR (column_name = 'created_at' AND (column_default IS NULL OR lower(column_default) NOT LIKE '%current_timestamp%'))
      )
  ) THEN
    RAISE EXCEPTION 'Existing subcontractor_assignments defaults are incompatible';
  END IF;
END
$reconcile$;

DO $reconcile$
DECLARE incompatible_index TEXT;
BEGIN
  SELECT expected.index_name INTO incompatible_index
  FROM (VALUES
    ('subcontractor_assignments_orderId_key', true, ARRAY['orderId']::TEXT[]),
    ('subcontractor_assignments_orderId_idx', false, ARRAY['orderId']::TEXT[]),
    ('subcontractor_assignments_prime_workspace_id_status_idx', false, ARRAY['prime_workspace_id', 'status']::TEXT[]),
    ('subcontractor_assignments_sub_workspace_id_status_idx', false, ARRAY['sub_workspace_id', 'status']::TEXT[])
  ) AS expected(index_name, is_unique, columns)
  JOIN pg_class index_class ON index_class.relname = expected.index_name
  JOIN pg_namespace index_namespace ON index_namespace.oid = index_class.relnamespace AND index_namespace.nspname = 'public'
  LEFT JOIN pg_index actual ON actual.indexrelid = index_class.oid
  LEFT JOIN pg_class table_class ON table_class.oid = actual.indrelid
  WHERE actual.indexrelid IS NULL
     OR table_class.relname <> 'subcontractor_assignments'
     OR actual.indisunique <> expected.is_unique
     OR ARRAY(
       SELECT attribute.attname::TEXT
       FROM unnest(actual.indkey) WITH ORDINALITY AS key(attnum, position)
       JOIN pg_attribute attribute ON attribute.attrelid = actual.indrelid AND attribute.attnum = key.attnum
       ORDER BY key.position
     ) <> expected.columns
  LIMIT 1;
  IF incompatible_index IS NOT NULL THEN
    RAISE EXCEPTION 'Existing index % is incompatible', incompatible_index;
  END IF;
END
$reconcile$;

CREATE UNIQUE INDEX IF NOT EXISTS "subcontractor_assignments_orderId_key"
  ON "subcontractor_assignments"("orderId");
CREATE INDEX IF NOT EXISTS "subcontractor_assignments_orderId_idx"
  ON "subcontractor_assignments"("orderId");
CREATE INDEX IF NOT EXISTS "subcontractor_assignments_prime_workspace_id_status_idx"
  ON "subcontractor_assignments"("prime_workspace_id", "status");
CREATE INDEX IF NOT EXISTS "subcontractor_assignments_sub_workspace_id_status_idx"
  ON "subcontractor_assignments"("sub_workspace_id", "status");

DO $reconcile$
DECLARE incompatible_constraint TEXT;
BEGIN
  SELECT expected.constraint_name INTO incompatible_constraint
  FROM (VALUES
    ('subcontractor_assignments_orderId_fkey', 'Order', ARRAY['orderId']::TEXT[], ARRAY['id']::TEXT[], 'c', 'c'),
    ('subcontractor_assignments_prime_workspace_id_fkey', 'Company', ARRAY['prime_workspace_id']::TEXT[], ARRAY['id']::TEXT[], 'r', 'c'),
    ('subcontractor_assignments_sub_workspace_id_fkey', 'Company', ARRAY['sub_workspace_id']::TEXT[], ARRAY['id']::TEXT[], 'r', 'c'),
    ('subcontractor_assignments_assigned_staff_id_fkey', 'User', ARRAY['assigned_staff_id']::TEXT[], ARRAY['id']::TEXT[], 'n', 'c')
  ) AS expected(constraint_name, referenced_table, local_columns, referenced_columns, delete_action, update_action)
  JOIN pg_constraint actual ON actual.conname = expected.constraint_name
  JOIN pg_class local_table ON local_table.oid = actual.conrelid
  JOIN pg_namespace local_namespace ON local_namespace.oid = local_table.relnamespace AND local_namespace.nspname = 'public'
  LEFT JOIN pg_class referenced_table ON referenced_table.oid = actual.confrelid
  WHERE actual.contype <> 'f'
     OR local_table.relname <> 'subcontractor_assignments'
     OR referenced_table.relname <> expected.referenced_table
     OR actual.confdeltype::TEXT <> expected.delete_action
     OR actual.confupdtype::TEXT <> expected.update_action
     OR ARRAY(
       SELECT attribute.attname::TEXT
       FROM unnest(actual.conkey) WITH ORDINALITY AS key(attnum, position)
       JOIN pg_attribute attribute ON attribute.attrelid = actual.conrelid AND attribute.attnum = key.attnum
       ORDER BY key.position
     ) <> expected.local_columns
     OR ARRAY(
       SELECT attribute.attname::TEXT
       FROM unnest(actual.confkey) WITH ORDINALITY AS key(attnum, position)
       JOIN pg_attribute attribute ON attribute.attrelid = actual.confrelid AND attribute.attnum = key.attnum
       ORDER BY key.position
     ) <> expected.referenced_columns
  LIMIT 1;
  IF incompatible_constraint IS NOT NULL THEN
    RAISE EXCEPTION 'Existing constraint % is incompatible', incompatible_constraint;
  END IF;
END
$reconcile$;

DO $reconcile$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcontractor_assignments_orderId_fkey' AND conrelid = 'public.subcontractor_assignments'::regclass) THEN
    IF EXISTS (
      SELECT 1 FROM "subcontractor_assignments" s
      LEFT JOIN "Order" o ON o."id" = s."orderId"
      WHERE o."id" IS NULL
    ) THEN RAISE EXCEPTION 'Cannot add order FK: orphaned subcontractor assignment'; END IF;
    ALTER TABLE "subcontractor_assignments" ADD CONSTRAINT "subcontractor_assignments_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcontractor_assignments_prime_workspace_id_fkey' AND conrelid = 'public.subcontractor_assignments'::regclass) THEN
    IF EXISTS (
      SELECT 1 FROM "subcontractor_assignments" s
      LEFT JOIN "Company" c ON c."id" = s."prime_workspace_id"
      WHERE c."id" IS NULL
    ) THEN RAISE EXCEPTION 'Cannot add prime workspace FK: orphaned subcontractor assignment'; END IF;
    ALTER TABLE "subcontractor_assignments" ADD CONSTRAINT "subcontractor_assignments_prime_workspace_id_fkey"
      FOREIGN KEY ("prime_workspace_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcontractor_assignments_sub_workspace_id_fkey' AND conrelid = 'public.subcontractor_assignments'::regclass) THEN
    IF EXISTS (
      SELECT 1 FROM "subcontractor_assignments" s
      LEFT JOIN "Company" c ON c."id" = s."sub_workspace_id"
      WHERE c."id" IS NULL
    ) THEN RAISE EXCEPTION 'Cannot add sub workspace FK: orphaned subcontractor assignment'; END IF;
    ALTER TABLE "subcontractor_assignments" ADD CONSTRAINT "subcontractor_assignments_sub_workspace_id_fkey"
      FOREIGN KEY ("sub_workspace_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcontractor_assignments_assigned_staff_id_fkey' AND conrelid = 'public.subcontractor_assignments'::regclass) THEN
    IF EXISTS (
      SELECT 1 FROM "subcontractor_assignments" s
      LEFT JOIN "User" u ON u."id" = s."assigned_staff_id"
      WHERE s."assigned_staff_id" IS NOT NULL AND u."id" IS NULL
    ) THEN RAISE EXCEPTION 'Cannot add assigned staff FK: orphaned subcontractor assignment'; END IF;
    ALTER TABLE "subcontractor_assignments" ADD CONSTRAINT "subcontractor_assignments_assigned_staff_id_fkey"
      FOREIGN KEY ("assigned_staff_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$reconcile$;

DO $reconcile$
BEGIN
  IF to_regclass('public.staff_slot_blocks') IS NULL THEN
    CREATE TABLE "staff_slot_blocks" (
      "id" TEXT NOT NULL,
      "staff_id" TEXT NOT NULL,
      "workspace_id" TEXT NOT NULL,
      "start_at" TIMESTAMP(3) NOT NULL,
      "end_at" TIMESTAMP(3) NOT NULL,
      "reason" TEXT,
      "order_id" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "staff_slot_blocks_pkey" PRIMARY KEY ("id")
    );
  ELSIF EXISTS (
    SELECT 1
    FROM (VALUES
      ('id', 'text', 'NO'),
      ('staff_id', 'text', 'NO'),
      ('workspace_id', 'text', 'NO'),
      ('start_at', 'timestamp without time zone', 'NO'),
      ('end_at', 'timestamp without time zone', 'NO'),
      ('reason', 'text', 'YES'),
      ('order_id', 'text', 'YES'),
      ('created_at', 'timestamp without time zone', 'NO')
    ) AS expected(column_name, data_type, is_nullable)
    LEFT JOIN information_schema.columns actual
      ON actual.table_schema = 'public'
      AND actual.table_name = 'staff_slot_blocks'
      AND actual.column_name = expected.column_name
    WHERE actual.column_name IS NULL
       OR actual.data_type <> expected.data_type
       OR actual.is_nullable <> expected.is_nullable
  ) THEN
    RAISE EXCEPTION 'Existing staff_slot_blocks table is incompatible';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    JOIN pg_class table_record ON table_record.oid = constraint_record.conrelid
    JOIN pg_namespace namespace_record ON namespace_record.oid = table_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND table_record.relname = 'staff_slot_blocks'
      AND constraint_record.contype = 'p'
      AND ARRAY(
        SELECT attribute.attname::TEXT
        FROM unnest(constraint_record.conkey) WITH ORDINALITY AS key(attnum, position)
        JOIN pg_attribute attribute ON attribute.attrelid = constraint_record.conrelid AND attribute.attnum = key.attnum
        ORDER BY key.position
      ) = ARRAY['id']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'Existing staff_slot_blocks primary key is incompatible';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_slot_blocks'
      AND is_nullable = 'NO' AND column_default IS NULL AND is_identity = 'NO' AND is_generated = 'NEVER'
      AND column_name NOT IN ('id', 'staff_id', 'workspace_id', 'start_at', 'end_at')
  ) THEN
    RAISE EXCEPTION 'Existing staff_slot_blocks has an incompatible required extra column';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_slot_blocks'
      AND column_name = 'created_at' AND (column_default IS NULL OR lower(column_default) NOT LIKE '%current_timestamp%')
  ) THEN
    RAISE EXCEPTION 'Existing staff_slot_blocks.created_at default is incompatible';
  END IF;
END
$reconcile$;

DO $reconcile$
DECLARE incompatible_index TEXT;
BEGIN
  SELECT expected.index_name INTO incompatible_index
  FROM (VALUES
    ('staff_slot_blocks_staff_id_start_at_end_at_idx', false, ARRAY['staff_id', 'start_at', 'end_at']::TEXT[]),
    ('staff_slot_blocks_workspace_id_start_at_idx', false, ARRAY['workspace_id', 'start_at']::TEXT[]),
    ('staff_slot_blocks_order_id_idx', false, ARRAY['order_id']::TEXT[])
  ) AS expected(index_name, is_unique, columns)
  JOIN pg_class index_class ON index_class.relname = expected.index_name
  JOIN pg_namespace index_namespace ON index_namespace.oid = index_class.relnamespace AND index_namespace.nspname = 'public'
  LEFT JOIN pg_index actual ON actual.indexrelid = index_class.oid
  LEFT JOIN pg_class table_class ON table_class.oid = actual.indrelid
  WHERE actual.indexrelid IS NULL
     OR table_class.relname <> 'staff_slot_blocks'
     OR actual.indisunique <> expected.is_unique
     OR ARRAY(
       SELECT attribute.attname::TEXT
       FROM unnest(actual.indkey) WITH ORDINALITY AS key(attnum, position)
       JOIN pg_attribute attribute ON attribute.attrelid = actual.indrelid AND attribute.attnum = key.attnum
       ORDER BY key.position
     ) <> expected.columns
  LIMIT 1;
  IF incompatible_index IS NOT NULL THEN
    RAISE EXCEPTION 'Existing index % is incompatible', incompatible_index;
  END IF;
END
$reconcile$;

CREATE INDEX IF NOT EXISTS "staff_slot_blocks_staff_id_start_at_end_at_idx"
  ON "staff_slot_blocks"("staff_id", "start_at", "end_at");
CREATE INDEX IF NOT EXISTS "staff_slot_blocks_workspace_id_start_at_idx"
  ON "staff_slot_blocks"("workspace_id", "start_at");
CREATE INDEX IF NOT EXISTS "staff_slot_blocks_order_id_idx"
  ON "staff_slot_blocks"("order_id");

DO $reconcile$
DECLARE incompatible_constraint TEXT;
BEGIN
  SELECT expected.constraint_name INTO incompatible_constraint
  FROM (VALUES
    ('staff_slot_blocks_staff_id_fkey', 'User', ARRAY['staff_id']::TEXT[], ARRAY['id']::TEXT[], 'c', 'c'),
    ('staff_slot_blocks_workspace_id_fkey', 'Company', ARRAY['workspace_id']::TEXT[], ARRAY['id']::TEXT[], 'c', 'c')
  ) AS expected(constraint_name, referenced_table, local_columns, referenced_columns, delete_action, update_action)
  JOIN pg_constraint actual ON actual.conname = expected.constraint_name
  JOIN pg_class local_table ON local_table.oid = actual.conrelid
  JOIN pg_namespace local_namespace ON local_namespace.oid = local_table.relnamespace AND local_namespace.nspname = 'public'
  LEFT JOIN pg_class referenced_table ON referenced_table.oid = actual.confrelid
  WHERE actual.contype <> 'f'
     OR local_table.relname <> 'staff_slot_blocks'
     OR referenced_table.relname <> expected.referenced_table
     OR actual.confdeltype::TEXT <> expected.delete_action
     OR actual.confupdtype::TEXT <> expected.update_action
     OR ARRAY(
       SELECT attribute.attname::TEXT
       FROM unnest(actual.conkey) WITH ORDINALITY AS key(attnum, position)
       JOIN pg_attribute attribute ON attribute.attrelid = actual.conrelid AND attribute.attnum = key.attnum
       ORDER BY key.position
     ) <> expected.local_columns
     OR ARRAY(
       SELECT attribute.attname::TEXT
       FROM unnest(actual.confkey) WITH ORDINALITY AS key(attnum, position)
       JOIN pg_attribute attribute ON attribute.attrelid = actual.confrelid AND attribute.attnum = key.attnum
       ORDER BY key.position
     ) <> expected.referenced_columns
  LIMIT 1;
  IF incompatible_constraint IS NOT NULL THEN
    RAISE EXCEPTION 'Existing constraint % is incompatible', incompatible_constraint;
  END IF;
END
$reconcile$;

DO $reconcile$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_slot_blocks_staff_id_fkey' AND conrelid = 'public.staff_slot_blocks'::regclass) THEN
    IF EXISTS (
      SELECT 1 FROM "staff_slot_blocks" b LEFT JOIN "User" u ON u."id" = b."staff_id"
      WHERE u."id" IS NULL
    ) THEN RAISE EXCEPTION 'Cannot add staff FK: orphaned staff slot block'; END IF;
    ALTER TABLE "staff_slot_blocks" ADD CONSTRAINT "staff_slot_blocks_staff_id_fkey"
      FOREIGN KEY ("staff_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_slot_blocks_workspace_id_fkey' AND conrelid = 'public.staff_slot_blocks'::regclass) THEN
    IF EXISTS (
      SELECT 1 FROM "staff_slot_blocks" b LEFT JOIN "Company" c ON c."id" = b."workspace_id"
      WHERE c."id" IS NULL
    ) THEN RAISE EXCEPTION 'Cannot add workspace FK: orphaned staff slot block'; END IF;
    ALTER TABLE "staff_slot_blocks" ADD CONSTRAINT "staff_slot_blocks_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$reconcile$;
