-- Restore the Norwegian FTS tsvector column dropped by the cascade migration
ALTER TABLE transcriptions
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('norwegian',
      coalesce(corrected_text, raw_text, ''))
  ) STORED;

-- GIN index on search vector
CREATE INDEX transcriptions_search_vector_idx
  ON transcriptions USING GIN (search_vector);
