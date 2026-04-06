CREATE TABLE recipe_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz DEFAULT now(),
  recipe_id   uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  event_type  text NOT NULL,
  note        text
);

CREATE INDEX recipe_events_recipe_id ON recipe_events(recipe_id);

-- RLS: anyone can read; you can only insert your own events; no updates or deletes
ALTER TABLE recipe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all"   ON recipe_events FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert own" ON recipe_events FOR INSERT WITH CHECK (auth.uid() = user_id);
