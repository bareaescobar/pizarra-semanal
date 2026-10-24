-- Pizarra Semanal – Migration v3: seguridad (RLS + solo usuarios autenticados)
-- Aplicar DESPUÉS de desplegar la versión del frontend que usa Supabase Auth.

do $$
declare t text;
begin
  foreach t in array array[
    'v2_ingredients','v2_dishes','v2_dish_ingredients','v2_board_slots','v2_shopping_lists',
    'v2_pool_items','v2_saved_recipes','v2_custom_items','v2_dismissed','v2_color_overrides','app_data'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "allow_all" on public.%I', t);
    execute format('drop policy if exists "allow_all_%s" on public.%I', t, t);
    execute format('drop policy if exists "authenticated_all" on public.%I', t);
    execute format('create policy "authenticated_all" on public.%I for all to authenticated using (true) with check (true)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Tabla del login antiguo: solo accesible desde la Edge Function (service role)
alter table public.v2_users enable row level security;
revoke all on public.v2_users from anon, authenticated;

notify pgrst, 'reload schema';
