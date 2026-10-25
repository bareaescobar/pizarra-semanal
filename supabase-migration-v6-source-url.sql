-- Enlace de origen de una receta (importada desde Instagram, YouTube, un blog…)
alter table public.v2_saved_recipes add column if not exists source_url text;
