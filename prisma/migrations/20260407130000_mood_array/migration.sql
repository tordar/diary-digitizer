ALTER TABLE "entry_metadata" ADD COLUMN "mood_new" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "entry_metadata" SET "mood_new" = ARRAY["mood"] WHERE "mood" IS NOT NULL;
ALTER TABLE "entry_metadata" DROP COLUMN "mood";
ALTER TABLE "entry_metadata" RENAME COLUMN "mood_new" TO "mood";
