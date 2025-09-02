-- Migration: Add apartment images table and update apartment schema
-- Created: 2024-01-16

-- 1. Add mainImageUrl column to Apartment table
ALTER TABLE Apartment ADD COLUMN mainImageUrl TEXT;

-- 2. Create ApartmentImage table
CREATE TABLE "ApartmentImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apartmentId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageType" TEXT NOT NULL DEFAULT 'general',
    "caption" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "format" TEXT,
    "sourceUrl" TEXT,
    "scrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApartmentImage_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Create indexes for ApartmentImage
CREATE INDEX "ApartmentImage_apartmentId_idx" ON "ApartmentImage"("apartmentId");
CREATE INDEX "ApartmentImage_apartmentId_displayOrder_idx" ON "ApartmentImage"("apartmentId", "displayOrder");
CREATE INDEX "ApartmentImage_imageType_idx" ON "ApartmentImage"("imageType");
CREATE INDEX "ApartmentImage_isActive_idx" ON "ApartmentImage"("isActive");

-- 4. Migrate existing imageUrls data to new structure
-- This script will convert existing JSON imageUrls to the new schema
INSERT INTO ApartmentImage (id, apartmentId, imageUrl, imageType, displayOrder, scrapedAt, createdAt, updatedAt)
SELECT 
    'img_' || Apartment.id || '_' || (row_number() OVER (PARTITION BY Apartment.id ORDER BY json_extract(value, '$')) - 1) as id,
    Apartment.id as apartmentId,
    json_extract(value, '$') as imageUrl,
    'general' as imageType,
    (row_number() OVER (PARTITION BY Apartment.id ORDER BY json_extract(value, '$')) - 1) as displayOrder,
    CURRENT_TIMESTAMP as scrapedAt,
    CURRENT_TIMESTAMP as createdAt,
    CURRENT_TIMESTAMP as updatedAt
FROM Apartment,
     json_each(Apartment.imageUrls)
WHERE Apartment.imageUrls IS NOT NULL 
  AND Apartment.imageUrls != '[]' 
  AND Apartment.imageUrls != ''
  AND json_valid(Apartment.imageUrls);

-- 5. Update mainImageUrl with the first image from imageUrls
UPDATE Apartment 
SET mainImageUrl = (
    SELECT json_extract(value, '$')
    FROM json_each(Apartment.imageUrls)
    WHERE Apartment.imageUrls IS NOT NULL 
      AND Apartment.imageUrls != '[]' 
      AND Apartment.imageUrls != ''
      AND json_valid(Apartment.imageUrls)
    LIMIT 1
)
WHERE imageUrls IS NOT NULL 
  AND imageUrls != '[]' 
  AND imageUrls != ''
  AND json_valid(imageUrls);

-- 6. Add lastScraped column to track scraping history
ALTER TABLE Apartment ADD COLUMN lastScraped DATETIME;

-- Note: We keep the old imageUrls column for now to avoid data loss
-- It can be dropped in a future migration once the new system is verified
-- DROP COLUMN imageUrls; -- Uncomment this line in a future migration