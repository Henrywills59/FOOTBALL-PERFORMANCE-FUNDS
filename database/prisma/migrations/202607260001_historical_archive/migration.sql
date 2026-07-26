CREATE TABLE "historical_archive_records" (
  "id" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "valueType" TEXT NOT NULL,
  "displayValue" TEXT NOT NULL,
  "reportingPeriod" TEXT,
  "archiveNotes" TEXT,
  "evidenceReference" TEXT,
  "visible" BOOLEAN NOT NULL DEFAULT false,
  "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "lastReviewedAt" TIMESTAMP(3),
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "historical_archive_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "historical_archive_records_metricKey_key" ON "historical_archive_records"("metricKey");
CREATE INDEX "historical_archive_records_visible_idx" ON "historical_archive_records"("visible");
CREATE INDEX "historical_archive_records_reviewStatus_idx" ON "historical_archive_records"("reviewStatus");
