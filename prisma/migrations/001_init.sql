-- CreateEnum
CREATE TYPE "ScrapeStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameJa" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "transfers" JSONB,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apartment" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceSite" TEXT NOT NULL,
    "sourceListingId" TEXT,
    "title" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "unitNumber" TEXT,
    "rentMonthly" INTEGER NOT NULL,
    "managementFee" INTEGER,
    "keyMoney" DOUBLE PRECISION,
    "deposit" DOUBLE PRECISION,
    "size" DOUBLE PRECISION NOT NULL,
    "sizeJo" DOUBLE PRECISION,
    "layout" TEXT NOT NULL,
    "layoutDetails" JSONB,
    "prefecture" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "ward" TEXT,
    "address" TEXT NOT NULL,
    "addressDetails" JSONB,
    "buildingType" TEXT,
    "buildingAge" INTEGER,
    "buildYear" INTEGER,
    "totalFloors" INTEGER,
    "floor" TEXT,
    "features" TEXT[],
    "nearbyFacilities" TEXT[],
    "imageUrls" TEXT[],
    "floorPlanUrl" TEXT,
    "stationId" TEXT NOT NULL,
    "walkingMinutes" INTEGER NOT NULL,
    "additionalStations" JSONB,
    "availableFrom" TIMESTAMP(3),
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lastVerified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Apartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "rentMonthly" INTEGER NOT NULL,
    "managementFee" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Search" (
    "id" TEXT NOT NULL,
    "targetStationId" TEXT NOT NULL,
    "targetStationName" TEXT NOT NULL,
    "maxCommuteMinutes" INTEGER NOT NULL,
    "filters" JSONB,
    "stationsSearched" INTEGER NOT NULL,
    "totalResults" INTEGER NOT NULL,
    "resultsReturned" INTEGER NOT NULL,
    "searchDurationMs" INTEGER,
    "sessionId" TEXT,
    "userId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchStation" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "commuteMinutes" INTEGER NOT NULL,
    "transferCount" INTEGER NOT NULL,

    CONSTRAINT "SearchStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchResult" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "commuteMinutes" INTEGER NOT NULL,
    "transferCount" INTEGER NOT NULL,
    "routeDetails" JSONB,
    "relevanceScore" DOUBLE PRECISION,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "SearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeJob" (
    "id" TEXT NOT NULL,
    "sourceSite" TEXT NOT NULL,
    "targetUrl" TEXT,
    "targetStation" TEXT,
    "status" "ScrapeStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "itemsScraped" INTEGER,
    "itemsNew" INTEGER,
    "itemsUpdated" INTEGER,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "defaultStation" TEXT,
    "savedFilters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchParams" JSONB NOT NULL,
    "emailAlerts" BOOLEAN NOT NULL DEFAULT false,
    "alertFrequency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Station_name_idx" ON "Station"("name");

-- CreateIndex
CREATE INDEX "Station_nameJa_idx" ON "Station"("nameJa");

-- CreateIndex
CREATE UNIQUE INDEX "Apartment_sourceUrl_key" ON "Apartment"("sourceUrl");

-- CreateIndex
CREATE INDEX "Apartment_stationId_rentMonthly_idx" ON "Apartment"("stationId", "rentMonthly");

-- CreateIndex
CREATE INDEX "Apartment_rentMonthly_size_idx" ON "Apartment"("rentMonthly", "size");

-- CreateIndex
CREATE INDEX "Apartment_layout_idx" ON "Apartment"("layout");

-- CreateIndex
CREATE INDEX "Apartment_isAvailable_rentMonthly_idx" ON "Apartment"("isAvailable", "rentMonthly");

-- CreateIndex
CREATE INDEX "Apartment_sourceSite_sourceListingId_idx" ON "Apartment"("sourceSite", "sourceListingId");

-- CreateIndex
CREATE INDEX "PriceHistory_apartmentId_recordedAt_idx" ON "PriceHistory"("apartmentId", "recordedAt");

-- CreateIndex
CREATE INDEX "Search_targetStationId_idx" ON "Search"("targetStationId");

-- CreateIndex
CREATE INDEX "Search_createdAt_idx" ON "Search"("createdAt");

-- CreateIndex
CREATE INDEX "SearchStation_stationId_idx" ON "SearchStation"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchStation_searchId_stationId_key" ON "SearchStation"("searchId", "stationId");

-- CreateIndex
CREATE INDEX "SearchResult_apartmentId_idx" ON "SearchResult"("apartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchResult_searchId_apartmentId_key" ON "SearchResult"("searchId", "apartmentId");

-- CreateIndex
CREATE INDEX "ScrapeJob_status_priority_idx" ON "ScrapeJob"("status", "priority");

-- CreateIndex
CREATE INDEX "ScrapeJob_sourceSite_targetStation_idx" ON "ScrapeJob"("sourceSite", "targetStation");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_apartmentId_key" ON "Favorite"("userId", "apartmentId");

-- AddForeignKey
ALTER TABLE "Apartment" ADD CONSTRAINT "Apartment_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchStation" ADD CONSTRAINT "SearchStation_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchStation" ADD CONSTRAINT "SearchStation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchResult" ADD CONSTRAINT "SearchResult_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchResult" ADD CONSTRAINT "SearchResult_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;