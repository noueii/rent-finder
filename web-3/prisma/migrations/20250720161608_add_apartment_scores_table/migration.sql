-- CreateTable
CREATE TABLE "ApartmentScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "listId" TEXT,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "targetValues" JSONB NOT NULL,
    "weights" JSONB NOT NULL,
    "targetStationId" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ApartmentScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApartmentScore_userId_idx" ON "ApartmentScore"("userId");

-- CreateIndex
CREATE INDEX "ApartmentScore_apartmentId_idx" ON "ApartmentScore"("apartmentId");

-- CreateIndex
CREATE INDEX "ApartmentScore_listId_idx" ON "ApartmentScore"("listId");

-- CreateIndex
CREATE INDEX "ApartmentScore_totalScore_idx" ON "ApartmentScore"("totalScore" DESC);

-- CreateIndex
CREATE INDEX "ApartmentScore_calculatedAt_idx" ON "ApartmentScore"("calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApartmentScore_userId_apartmentId_listId_key" ON "ApartmentScore"("userId", "apartmentId", "listId");

-- AddForeignKey
ALTER TABLE "ApartmentScore" ADD CONSTRAINT "ApartmentScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentScore" ADD CONSTRAINT "ApartmentScore_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentScore" ADD CONSTRAINT "ApartmentScore_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;
