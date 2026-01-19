-- CreateTable
CREATE TABLE "FBRSetting" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT 'https://esp.fbr.gov.pk:8244/FBR/v1/api/Live/PostData',
    "bearer_token" TEXT NOT NULL,
    "pos_id" TEXT NOT NULL,
    "usin" TEXT NOT NULL DEFAULT 'USIN0',
    "payment_mode" INTEGER NOT NULL DEFAULT 2,
    "invoice_type" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FBRSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FBRSetting_client_id_key" ON "FBRSetting"("client_id");

-- AddForeignKey
ALTER TABLE "FBRSetting" ADD CONSTRAINT "FBRSetting_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
