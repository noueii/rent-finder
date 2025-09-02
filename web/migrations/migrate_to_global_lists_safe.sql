-- Safe Migration: Convert UserList to GlobalList
-- This migration handles existing data and can be run multiple times safely

BEGIN TRANSACTION;

-- 1. Check if UserList table exists and has data
CREATE TABLE IF NOT EXISTS "migration_temp_check" (
    "has_user_list" INTEGER DEFAULT 0,
    "has_global_list" INTEGER DEFAULT 0
);

-- Check if tables exist
INSERT INTO "migration_temp_check" ("has_user_list", "has_global_list")
SELECT 
    (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='UserList') > 0,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='GlobalList') > 0;

-- 2. Create GlobalList table if it doesn't exist
CREATE TABLE IF NOT EXISTS "GlobalList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create indexes for GlobalList
CREATE INDEX IF NOT EXISTS "GlobalList_type_idx" ON "GlobalList"("type");
CREATE UNIQUE INDEX IF NOT EXISTS "GlobalList_type_key" ON "GlobalList"("type");

-- 4. Insert default global lists (only if they don't exist)
INSERT OR IGNORE INTO "GlobalList" ("id", "name", "type", "description", "createdAt", "updatedAt")
VALUES 
    ('gl_share_' || lower(hex(randomblob(8))), 'Shared Apartments', 'share', 'Apartments shared by the community', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('gl_like_' || lower(hex(randomblob(8))), 'Liked Apartments', 'like', 'Apartments liked by the community', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('gl_hide_' || lower(hex(randomblob(8))), 'Hidden Apartments', 'hide', 'Apartments hidden from view', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('gl_star_' || lower(hex(randomblob(8))), 'Starred Apartments', 'star', 'Apartments starred by the community', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 5. Create new ApartmentList table with proper structure
CREATE TABLE IF NOT EXISTS "ApartmentList_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apartmentId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "addedBy" TEXT,
    CONSTRAINT "ApartmentList_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApartmentList_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GlobalList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 6. Create indexes for new ApartmentList
CREATE UNIQUE INDEX IF NOT EXISTS "ApartmentList_new_apartmentId_listId_key" ON "ApartmentList_new"("apartmentId", "listId");
CREATE INDEX IF NOT EXISTS "ApartmentList_new_listId_idx" ON "ApartmentList_new"("listId");
CREATE INDEX IF NOT EXISTS "ApartmentList_new_apartmentId_idx" ON "ApartmentList_new"("apartmentId");

-- 7. Migrate data from UserList to GlobalList if UserList exists
-- Use a CTE to deduplicate entries and keep the earliest one
WITH migration_data AS (
    SELECT 
        al.apartmentId,
        gl.id as listId,
        MIN(COALESCE(al.addedAt, CURRENT_TIMESTAMP)) as addedAt,
        GROUP_CONCAT(DISTINCT al.notes) as notes,
        GROUP_CONCAT(DISTINCT ul.userId) as addedBy
    FROM "ApartmentList" al
    JOIN "UserList" ul ON al.listId = ul.id
    JOIN "GlobalList" gl ON gl.type = (
        CASE 
            WHEN ul.type = 'saved' THEN 'share'
            WHEN ul.type = 'starred' THEN 'star'
            WHEN ul.type = 'liked' THEN 'like'
            WHEN ul.type = 'blocked' THEN 'hide'
            ELSE ul.type
        END
    )
    WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='UserList')
    AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='ApartmentList')
    GROUP BY al.apartmentId, gl.id
)
INSERT OR IGNORE INTO "ApartmentList_new" ("id", "apartmentId", "listId", "addedAt", "notes", "addedBy")
SELECT 
    'al_' || lower(hex(randomblob(12))),
    apartmentId,
    listId,
    addedAt,
    notes,
    addedBy
FROM migration_data;

-- 8. Drop old ApartmentList table and rename new one
DROP TABLE IF EXISTS "ApartmentList";
ALTER TABLE "ApartmentList_new" RENAME TO "ApartmentList";

-- 9. Clean up migration temp table
DROP TABLE IF EXISTS "migration_temp_check";

-- 10. Drop UserList table if it exists (after migration is complete)
DROP TABLE IF EXISTS "UserList";

COMMIT;