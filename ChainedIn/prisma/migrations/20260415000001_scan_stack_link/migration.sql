-- AlterTable: add stackId to ScanReport
ALTER TABLE "ScanReport" ADD COLUMN "stackId" TEXT REFERENCES "Stack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
