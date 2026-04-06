/*
  Warnings:

  - You are about to drop the column `search_vector` on the `transcriptions` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "entry_metadata" DROP CONSTRAINT "entry_metadata_entry_id_fkey";

-- DropForeignKey
ALTER TABLE "pages" DROP CONSTRAINT "pages_book_id_fkey";

-- DropForeignKey
ALTER TABLE "processing_jobs" DROP CONSTRAINT "processing_jobs_page_id_fkey";

-- DropForeignKey
ALTER TABLE "transcriptions" DROP CONSTRAINT "transcriptions_entry_id_fkey";

-- DropIndex
DROP INDEX "entries_book_id_idx";

-- DropIndex
DROP INDEX "entries_date_idx";

-- DropIndex
DROP INDEX "entries_status_idx";

-- DropIndex
DROP INDEX "entry_metadata_people_idx";

-- DropIndex
DROP INDEX "entry_metadata_places_idx";

-- DropIndex
DROP INDEX "entry_metadata_themes_idx";

-- DropIndex
DROP INDEX "entry_metadata_topics_idx";

-- DropIndex
DROP INDEX "transcriptions_search_vector_idx";

-- AlterTable
ALTER TABLE "transcriptions" DROP COLUMN "search_vector";

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_metadata" ADD CONSTRAINT "entry_metadata_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Missing indexes from previous migration
CREATE INDEX IF NOT EXISTS "pages_book_id_idx" ON "pages" ("book_id");
CREATE INDEX IF NOT EXISTS "pages_entry_id_idx" ON "pages" ("entry_id");
CREATE INDEX IF NOT EXISTS "processing_jobs_status_idx" ON "processing_jobs" ("status");

-- Recreate indexes dropped above
CREATE INDEX "entries_book_id_idx" ON "entries" ("book_id");
CREATE INDEX "entries_date_idx" ON "entries" ("date");
CREATE INDEX "entries_status_idx" ON "entries" ("status");

-- Recreate GIN indexes on entry_metadata arrays
CREATE INDEX "entry_metadata_topics_idx" ON "entry_metadata" USING GIN ("topics");
CREATE INDEX "entry_metadata_people_idx" ON "entry_metadata" USING GIN ("people");
CREATE INDEX "entry_metadata_places_idx" ON "entry_metadata" USING GIN ("places");
CREATE INDEX "entry_metadata_themes_idx" ON "entry_metadata" USING GIN ("themes");
