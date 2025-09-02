-- AlterTable
ALTER TABLE "ApartmentList" ADD COLUMN     "designScore" DOUBLE PRECISION,
ADD COLUMN     "locationScore" DOUBLE PRECISION,
ADD COLUMN     "scoredAt" TIMESTAMP(3);
