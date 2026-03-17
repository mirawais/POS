/*
  Warnings:

  - A unique constraint covering the columns `[client_id,code]` on the table `Coupon` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[client_id,sku]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[client_id,sku]` on the table `RawMaterial` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('GROCERY', 'RESTAURANT');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED', 'BILLING_REQUESTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'MANAGER';
ALTER TYPE "Role" ADD VALUE 'WAITER';
ALTER TYPE "Role" ADD VALUE 'KITCHEN';

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_client_id_fkey";

-- DropIndex
DROP INDEX "Coupon_code_key";

-- DropIndex
DROP INDEX "Product_sku_key";

-- DropIndex
DROP INDEX "RawMaterial_sku_key";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "active_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "business_type" "BusinessType" NOT NULL DEFAULT 'GROCERY',
ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "contact_number" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "inactive_date" TIMESTAMP(3),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tech_contact" TEXT;

-- AlterTable
ALTER TABLE "InvoiceSetting" ADD COLUMN     "day_closing_time" TEXT,
ADD COLUMN     "font_size" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "show_price_decimals" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "is_favorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_unlimited" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RawMaterial" ADD COLUMN     "is_unlimited" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "customer_name" TEXT,
ADD COLUMN     "customer_phone" TEXT,
ADD COLUMN     "kitchen_note" TEXT,
ADD COLUMN     "order_status" "OrderStatus",
ADD COLUMN     "order_type" "OrderType",
ADD COLUMN     "table_number" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissions" JSONB,
ALTER COLUMN "client_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_client_id_code_key" ON "Coupon"("client_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_client_id_sku_key" ON "Product"("client_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "RawMaterial_client_id_sku_key" ON "RawMaterial"("client_id", "sku");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
