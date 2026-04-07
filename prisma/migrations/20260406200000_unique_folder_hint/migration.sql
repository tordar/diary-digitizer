-- Add unique constraint to books.folder_hint
CREATE UNIQUE INDEX "books_folder_hint_key" ON "books"("folder_hint");
ALTER TABLE "books" ADD CONSTRAINT "books_folder_hint_key" UNIQUE USING INDEX "books_folder_hint_key";
