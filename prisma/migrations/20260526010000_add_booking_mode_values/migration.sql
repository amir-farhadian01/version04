-- AlterEnum: Replace BookingMode values
-- Old: auto_appointment, negotiation, inherit_from_catalog
-- New: booking, direct_booking, hybrid, quote_first, walk_in, inherit_from_catalog
--
-- PostgreSQL cannot remove values from an enum, so we:
-- 1. Drop the default on the column (so we can alter the type)
-- 2. Create a new enum type with the desired values
-- 3. Alter the column to use the new type with a CASE expression mapping old→new
-- 4. Drop the old type
-- 5. Rename the new type
-- 6. Re-add the default

-- Step 1: Drop the default
ALTER TABLE "ProviderServicePackage" ALTER COLUMN "bookingMode" DROP DEFAULT;

-- Step 2: Create the new enum
CREATE TYPE "BookingMode_new" AS ENUM ('booking', 'direct_booking', 'hybrid', 'quote_first', 'walk_in', 'inherit_from_catalog');

-- Step 3: Alter the column using a CASE expression to map old values to new
ALTER TABLE "ProviderServicePackage"
  ALTER COLUMN "bookingMode" TYPE "BookingMode_new"
  USING (
    CASE "bookingMode"::text
      WHEN 'auto_appointment' THEN 'direct_booking'::"BookingMode_new"
      WHEN 'negotiation' THEN 'quote_first'::"BookingMode_new"
      WHEN 'inherit_from_catalog' THEN 'inherit_from_catalog'::"BookingMode_new"
      ELSE 'inherit_from_catalog'::"BookingMode_new"
    END
  );

-- Step 4: Drop the old enum
DROP TYPE "BookingMode";

-- Step 5: Rename the new enum to the original name
ALTER TYPE "BookingMode_new" RENAME TO "BookingMode";

-- Step 6: Re-add the default
ALTER TABLE "ProviderServicePackage" ALTER COLUMN "bookingMode" SET DEFAULT 'inherit_from_catalog';
