/*
  Warnings:

  - You are about to drop the column `scoreBreakdown` on the `ApartmentScore` table. All the data in the column will be lost.
  - You are about to drop the column `targetStationId` on the `ApartmentScore` table. All the data in the column will be lost.
  - You are about to drop the column `targetValues` on the `ApartmentScore` table. All the data in the column will be lost.
  - You are about to drop the column `totalScore` on the `ApartmentScore` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `ApartmentScore` table. All the data in the column will be lost.
  - You are about to drop the column `weights` on the `ApartmentScore` table. All the data in the column will be lost.
  - Added the required column `score` to the `ApartmentScore` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ApartmentScore_calculatedAt_idx";

-- DropIndex
DROP INDEX "ApartmentScore_totalScore_idx";

-- AlterTable
ALTER TABLE "ApartmentScore" DROP COLUMN "scoreBreakdown",
DROP COLUMN "targetStationId",
DROP COLUMN "targetValues",
DROP COLUMN "totalScore",
DROP COLUMN "version",
DROP COLUMN "weights",
ADD COLUMN     "score" DOUBLE PRECISION NOT NULL;

-- CreateIndex
CREATE INDEX "ApartmentScore_score_idx" ON "ApartmentScore"("score" DESC);
