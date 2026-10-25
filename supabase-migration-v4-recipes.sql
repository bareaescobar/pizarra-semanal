-- Pizarra Semanal – Migration v4: tipo de plato y pasos en recetas
alter table public.v2_saved_recipes add column if not exists type text default null;
alter table public.v2_saved_recipes add column if not exists steps text default null;
notify pgrst, 'reload schema';
