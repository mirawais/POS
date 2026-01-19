-- AlterTable
ALTER TABLE "InvoiceSetting" ADD COLUMN     "custom_fields" JSONB;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "payment_method" TEXT DEFAULT 'CASH';
