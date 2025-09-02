-- AlterTable
ALTER TABLE "Apartment" ADD COLUMN     "preferredStationId" TEXT;

-- AddForeignKey
ALTER TABLE "Apartment" ADD CONSTRAINT "Apartment_preferredStationId_fkey" FOREIGN KEY ("preferredStationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
