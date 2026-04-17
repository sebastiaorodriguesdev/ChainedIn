-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Software" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "ecosystem" TEXT NOT NULL DEFAULT 'other',
    "repoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Software_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Software" ("createdAt", "description", "ecosystem", "id", "name", "ownerId", "repoUrl", "slug", "updatedAt") SELECT "createdAt", "description", "ecosystem", "id", "name", "ownerId", "repoUrl", "slug", "updatedAt" FROM "Software";
DROP TABLE "Software";
ALTER TABLE "new_Software" RENAME TO "Software";
CREATE UNIQUE INDEX "Software_slug_key" ON "Software"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
