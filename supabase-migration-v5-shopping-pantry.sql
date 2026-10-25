-- Pizarra Semanal – Migration v5: compra persistente, despensa con ingredientes, tiempo/ligereza en recetas
-- (solo añade; no borra nada)

create table if not exists public.v2_purchased (
  week_key text not null,
  item_key text not null,
  primary key (week_key, item_key)
);
alter table public.v2_purchased enable row level security;
create policy "authenticated_all" on public.v2_purchased for all to authenticated using (true) with check (true);
revoke all on public.v2_purchased from anon;
grant select, insert, update, delete on public.v2_purchased to authenticated;
alter publication supabase_realtime add table public.v2_purchased;

alter table public.v2_custom_items add column if not exists source text;

alter table public.v2_pool_items add column if not exists kind text not null default 'dish';
alter table public.v2_pool_items add column if not exists ingredient_id uuid references public.v2_ingredients(id) on delete set null;
alter table public.v2_pool_items add column if not exists location text;
alter table public.v2_pool_items add column if not exists note text;

alter table public.v2_saved_recipes add column if not exists time_min int;
alter table public.v2_saved_recipes add column if not exists light text;

notify pgrst, 'reload schema';
