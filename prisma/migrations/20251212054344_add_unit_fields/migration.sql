/*
  Warnings:

  - You are about to alter the column `quantity` on the `ProductRawMaterial` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,3)`.

*/
-- AlterTable
ALTER TABLE "ProductRawMaterial" ADD COLUMN     "unit" TEXT DEFAULT 'unit',
ALTER COLUMN "quantity" SET DEFAULT 1,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "RawMaterial" ADD COLUMN     "unit" TEXT DEFAULT 'unit';
