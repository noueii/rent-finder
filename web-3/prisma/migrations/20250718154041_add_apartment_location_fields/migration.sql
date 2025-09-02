/*
  Warnings:

  - Added the required column `type` to the `ScrapingSource` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Apartment" ADD COLUMN     "area" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "prefecture" TEXT,
ADD COLUMN     "scrapingSourceId" TEXT,
ADD COLUMN     "ward" TEXT;

-- AlterTable
ALTER TABLE "List" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "ScrapingSource" ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password" TEXT;

-- CreateIndex
CREATE INDEX "Apartment_scrapingSourceId_idx" ON "Apartment"("scrapingSourceId");

-- AddForeignKey
ALTER TABLE "Apartment" ADD CONSTRAINT "Apartment_scrapingSourceId_fkey" FOREIGN KEY ("scrapingSourceId") REFERENCES "ScrapingSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
