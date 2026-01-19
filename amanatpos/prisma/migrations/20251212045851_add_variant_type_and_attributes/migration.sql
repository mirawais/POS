/*
  Warnings:

  - You are about to drop the column `color` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'VARIANT';

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "color",
DROP COLUMN "size",
ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "low_stock_at" INTEGER,
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0;
