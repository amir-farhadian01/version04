-- Add unique constraint to displayName
ALTER TABLE "User" ADD CONSTRAINT "User_displayName_key" UNIQUE ("displayName");
