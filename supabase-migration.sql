-- ─── Pizarra Semanal v3: multi-user + realtime sync ───
-- Ejecuta este SQL una vez en el SQL Editor de Supabase Dashboard.
-- Ruta: https://supabase.com/dashboard → tu proyecto → SQL Editor → New query → pegar y Run

-- Usuarios (login)
create table if not exists v2_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- Pool / Mi despensa
create table if not exists v2_pool_items (
  id text primary key,
  dish_name text default '',
  effort int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Recetas guardadas
create table if not exists v2_saved_recipes (
  id text primary key,
  name text default '',
  description text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Artículos extra de la lista de la compra (por semana)
create table if not exists v2_custom_items (
  id text primary key,
  week_key text not null,
  name text not null,
  category text default 'Otros',
  created_at timestamptz default now()
);

-- Ingredientes ya comprados (descartados de la lista) por semana
create table if not exists v2_dismissed (
  week_key text not null,
  ingredient_id text not null,
  primary key (week_key, ingredient_id)
);

-- Cambios de tipo (color override) por slot
create table if not exists v2_color_overrides (
  slot_id text primary key,
  type_key text not null
);

-- ─── Desactivar RLS y conceder permisos al rol anónimo ───
-- Necesario para que la clave anónima del navegador pueda leer/escribir.
alter table v2_users          disable row level security;
alter table v2_pool_items     disable row level security;
alter table v2_saved_recipes  disable row level security;
alter table v2_custom_items   disable row level security;
alter table v2_dismissed      disable row level security;
alter table v2_color_overrides disable row level security;

grant all on v2_users          to anon, authenticated;
grant all on v2_pool_items     to anon, authenticated;
grant all on v2_saved_recipes  to anon, authenticated;
grant all on v2_custom_items   to anon, authenticated;
grant all on v2_dismissed      to anon, authenticated;
grant all on v2_color_overrides to anon, authenticated;

-- ─── Usuario por defecto (zeta / tatiguapa) ───
insert into v2_users (username, password_hash) values
  ('zeta', '639acb9b2ff0dfb039e4d830207eb64cbddce2ceb338e6a6ae3733aaf953378d')
on conflict (username) do nothing;

-- ─── Habilitar realtime para sincronización entre dispositivos ───
-- Si alguna tabla ya estaba en la publicación, este bloque da error inocuo;
-- puedes ignorarlo o ejecutar cada línea por separado.
alter publication supabase_realtime add table v2_board_slots;
alter publication supabase_realtime add table v2_pool_items;
alter publication supabase_realtime add table v2_saved_recipes;
alter publication supabase_realtime add table v2_custom_items;
alter publication supabase_realtime add table v2_dismissed;
alter publication supabase_realtime add table v2_color_overrides;
alter publication supabase_realtime add table v2_shopping_lists;

-- ─── Forzar recarga del esquema en PostgREST ───
notify pgrst, 'reload schema';
