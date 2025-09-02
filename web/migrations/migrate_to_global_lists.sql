-- Migration: Convert UserList to GlobalList
-- This migration converts user-specific lists to global lists

-- 1. Create new GlobalList table
CREATE TABLE IF NOT EXISTS "GlobalList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- 2. Create indexes for GlobalList
CREATE INDEX IF NOT EXISTS "GlobalList_type_idx" ON "GlobalList"("type");
CREATE UNIQUE INDEX IF NOT EXISTS "GlobalList_type_key" ON "GlobalList"("type");

-- 3. Insert default global lists (only if they don't exist)
INSERT OR IGNORE INTO "GlobalList" ("id", "name", "type", "description", "createdAt", "updatedAt")
VALUES 
    (lower(hex(randomblob(16))), 'Shared Apartments', 'share', 'Apartments shared by the community', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (lower(hex(randomblob(16))), 'Liked Apartments', 'like', 'Apartments liked by the community', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (lower(hex(randomblob(16))), 'Hidden Apartments', 'hide', 'Apartments hidden from view', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (lower(hex(randomblob(16))), 'Starred Apartments', 'star', 'Apartments starred by the community', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 4. Create temporary table for ApartmentList with new schema
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

-- 5. Create indexes for new ApartmentList
CREATE UNIQUE INDEX IF NOT EXISTS "ApartmentList_new_apartmentId_listId_key" ON "ApartmentList_new"("apartmentId", "listId");
CREATE INDEX IF NOT EXISTS "ApartmentList_new_listId_idx" ON "ApartmentList_new"("listId");
CREATE INDEX IF NOT EXISTS "ApartmentList_new_apartmentId_idx" ON "ApartmentList_new"("apartmentId");

-- 6. Migrate existing data from UserList to GlobalList
-- Map old list types to new ones
WITH global_list_mapping AS (
    SELECT 
        CASE 
            WHEN ul.type = 'saved' THEN 'share'
            WHEN ul.type = 'starred' THEN 'star'
            WHEN ul.type = 'liked' THEN 'like'
            WHEN ul.type = 'blocked' THEN 'hide'
            ELSE ul.type
        END as new_type,
        al.apartmentId,
        al.addedAt,
        al.notes,
        ul.userId as addedBy
    FROM "ApartmentList" al
    JOIN "UserList" ul ON al.listId = ul.id
)
INSERT INTO "ApartmentList_new" ("id", "apartmentId", "listId", "addedAt", "notes", "addedBy")
SELECT 
    lower(hex(randomblob(16))),
    glm.apartmentId,
    gl.id,
    glm.addedAt,
    glm.notes,
    glm.addedBy
FROM global_list_mapping glm
JOIN "GlobalList" gl ON gl.type = glm.new_type
WHERE NOT EXISTS (
    SELECT 1 FROM "ApartmentList_new" aln 
    WHERE aln.apartmentId = glm.apartmentId AND aln.listId = gl.id
);

-- 7. Drop old tables and rename new ones
DROP TABLE IF EXISTS "ApartmentList";
ALTER TABLE "ApartmentList_new" RENAME TO "ApartmentList";

-- 8. Since we're removing user dependency, we need to update related tables
-- Remove UserList references from User model (if you want to keep User table for other purposes)
-- Otherwise, you can drop the entire User-related tables

-- Note: The UserList table will be automatically dropped when you run prisma migrate
-- since it's no longer in the schema