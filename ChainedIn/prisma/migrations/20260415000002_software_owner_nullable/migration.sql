-- SQLite cannot ALTER COLUMN to drop NOT NULL, so we recreate the table.

-- Step 1: new table with nullable ownerId and SET NULL on delete
CREATE TABLE "Software_new" (
    "id"          TEXT     NOT NULL PRIMARY KEY,
    "ownerId"     TEXT,
    "name"        TEXT     NOT NULL,
    "slug"        TEXT     NOT NULL,
    "description" TEXT,
    "ecosystem"   TEXT     NOT NULL DEFAULT 'other',
    "repoUrl"     TEXT,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Software_owner_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Step 2: copy existing data
INSERT INTO "Software_new" SELECT * FROM "Software";

-- Step 3: swap tables
DROP TABLE "Software";
ALTER TABLE "Software_new" RENAME TO "Software";

-- Step 4: recreate unique index
CREATE UNIQUE INDEX "Software_slug_key" ON "Software"("slug");
