/*
  Warnings:

  - You are about to drop the column `toStation` on the `Route` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[apartmentId,toStationId]` on the table `Route` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `toStationId` to the `Route` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "ListType" ADD VALUE 'CUSTOM';

-- DropForeignKey
ALTER TABLE "SearchSession" DROP CONSTRAINT "SearchSession_userId_fkey";

-- DropIndex
DROP INDEX "Route_apartmentId_toStation_key";

-- AlterTable
ALTER TABLE "Route" DROP COLUMN "toStation",
ADD COLUMN     "toStationId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Route_apartmentId_toStationId_key" ON "Route"("apartmentId", "toStationId");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_toStationId_fkey" FOREIGN KEY ("toStationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchSession" ADD CONSTRAINT "SearchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
