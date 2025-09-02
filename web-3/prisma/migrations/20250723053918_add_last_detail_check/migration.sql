-- AlterTable
ALTER TABLE "Apartment" ADD COLUMN     "lastDetailCheck" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Apartment_removed_idx" ON "Apartment"("removed");

-- CreateIndex
CREATE INDEX "Apartment_lastDetailCheck_idx" ON "Apartment"("lastDetailCheck");
