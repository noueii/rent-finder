-- DropForeignKey
ALTER TABLE "ApartmentImage" DROP CONSTRAINT "ApartmentImage_apartmentId_fkey";

-- DropForeignKey
ALTER TABLE "ApartmentList" DROP CONSTRAINT "ApartmentList_apartmentId_fkey";

-- DropForeignKey
ALTER TABLE "Route" DROP CONSTRAINT "Route_apartmentId_fkey";

-- AddForeignKey
ALTER TABLE "ApartmentImage" ADD CONSTRAINT "ApartmentImage_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentList" ADD CONSTRAINT "ApartmentList_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
