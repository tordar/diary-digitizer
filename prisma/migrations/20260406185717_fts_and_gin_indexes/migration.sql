-- Add tsvector column for Norwegian full-text search
ALTER TABLE transcriptions
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('norwegian',
      coalesce(corrected_text, raw_text, ''))
  ) STORED;

-- GIN index on search vector
CREATE INDEX transcriptions_search_vector_idx
  ON transcriptions USING GIN (search_vector);

-- GIN indexes on array columns in entry_metadata
CREATE INDEX entry_metadata_topics_idx
  ON entry_metadata USING GIN (topics);

CREATE INDEX entry_metadata_people_idx
  ON entry_metadata USING GIN (people);

CREATE INDEX entry_metadata_places_idx
  ON entry_metadata USING GIN (places);

CREATE INDEX entry_metadata_themes_idx
  ON entry_metadata USING GIN (themes);

-- Index entries by date for timeline queries
CREATE INDEX entries_date_idx ON entries (date);
CREATE INDEX entries_status_idx ON entries (status);
CREATE INDEX entries_book_id_idx ON entries (book_id);

-- Seed default settings
INSERT INTO settings (key, value) VALUES
  ('ollama_url', 'http://localhost:11434'),
  ('ollama_model', 'qwen2.5vl:7b'),
  ('confidence_threshold', '0.85'),
  ('default_language', 'no'),
  ('prompt_template', 'default');
