-- Add is_guest column to User model for guest checkout flow
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "is_guest" BOOLEAN NOT NULL DEFAULT false;
