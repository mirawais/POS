-- Step 1: Add order_id as nullable first
ALTER TABLE "Sale" ADD COLUMN "order_id" TEXT;

-- Step 2: Generate order IDs for existing rows
-- Format: ORD-YYYYMMDD-XXXXX
UPDATE "Sale"
SET "order_id" = 'ORD-' || TO_CHAR("created_at", 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT), 1, 5))
WHERE "order_id" IS NULL;

-- Step 3: Make order_id required and unique
ALTER TABLE "Sale" ALTER COLUMN "order_id" SET NOT NULL;
CREATE UNIQUE INDEX "Sale_order_id_key" ON "Sale"("order_id");

-- Step 4: Add returned_quantity with default 0
ALTER TABLE "SaleItem" ADD COLUMN "returned_quantity" INTEGER NOT NULL DEFAULT 0;

