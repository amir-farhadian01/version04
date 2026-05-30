-- AlterEnum: Add wizard, reorder, guest to OrderEntryPoint
ALTER TYPE "OrderEntryPoint" ADD VALUE 'wizard';
ALTER TYPE "OrderEntryPoint" ADD VALUE 'reorder';
ALTER TYPE "OrderEntryPoint" ADD VALUE 'guest';
