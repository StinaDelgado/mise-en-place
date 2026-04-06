CREATE TABLE recipes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  forked_from           uuid REFERENCES recipes(id),

  -- Identity
  title                 text NOT NULL,
  description           text,
  source_url            text,
  source_type           text,
  original_content      text,

  -- Recipe content
  yield_amount          text,
  yield_servings        integer,
  prep_time_mins        integer,
  cook_time_mins        integer,
  ingredients           jsonb NOT NULL DEFAULT '[]',
  steps                 jsonb NOT NULL DEFAULT '[]',
  tags                  text[] NOT NULL DEFAULT '{}',
  notes                 text,

  -- Media
  cover_image_path      text,

  -- State
  is_draft              boolean NOT NULL DEFAULT true,
  extraction_confidence text
);

-- Auto-update updated_at on edit
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Full-text search
ALTER TABLE recipes ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(notes, '')
    )
  ) STORED;

CREATE INDEX recipes_search_idx ON recipes USING GIN(search_vector);
CREATE INDEX recipes_tags_idx   ON recipes USING GIN(tags);
CREATE INDEX recipes_created_by ON recipes(created_by);

-- RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all"   ON recipes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert own" ON recipes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "edit own"   ON recipes FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "delete own" ON recipes FOR DELETE USING (auth.uid() = created_by);
