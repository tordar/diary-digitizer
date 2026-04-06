-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('text', 'image', 'mixed', 'special');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('pending_review', 'approved');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'processing', 'done', 'failed');

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folder_hint" TEXT,
    "date_range" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "entry_id" TEXT,
    "file_path" TEXT NOT NULL,
    "original_path" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "page_order" INTEGER NOT NULL DEFAULT 0,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "title" TEXT,
    "date" DATE,
    "date_inferred" BOOLEAN NOT NULL DEFAULT false,
    "entry_type" "EntryType" NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'pending_review',
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcriptions" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "corrected_text" TEXT,
    "language" TEXT NOT NULL DEFAULT 'no',

    CONSTRAINT "transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_metadata" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "mood" TEXT,
    "topics" TEXT[],
    "people" TEXT[],
    "places" TEXT[],
    "themes" TEXT[],

    CONSTRAINT "entry_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "pages_file_hash_key" ON "pages"("file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "transcriptions_entry_id_key" ON "transcriptions"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "entry_metadata_entry_id_key" ON "entry_metadata"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "processing_jobs_page_id_key" ON "processing_jobs"("page_id");

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_metadata" ADD CONSTRAINT "entry_metadata_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
