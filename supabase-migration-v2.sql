-- Pizarra Semanal – Migration v2
-- Adds rating and tags columns to v2_saved_recipes

ALTER TABLE v2_saved_recipes ADD COLUMN IF NOT EXISTS rating int DEFAULT NULL;
ALTER TABLE v2_saved_recipes ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

-- Tell PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
