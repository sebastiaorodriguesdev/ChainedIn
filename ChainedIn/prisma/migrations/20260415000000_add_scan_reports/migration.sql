-- AlterTable: add apiKey to User
ALTER TABLE "User" ADD COLUMN "apiKey" TEXT;
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");

-- CreateTable: ScanReport
CREATE TABLE "ScanReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalDeps" INTEGER NOT NULL,
    "vulnerableDeps" INTEGER NOT NULL,
    "totalAdvisories" INTEGER NOT NULL,
    "ecosystems" TEXT NOT NULL,
    "scanDurationSecs" REAL NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "findingsJson" TEXT NOT NULL,
    CONSTRAINT "ScanReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ScanReport_userId_idx" ON "ScanReport"("userId");
