import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default supabase

export async function dbGet(table, filters = {}) {
  let query = supabase.from(table).select('*')
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function dbInsert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) throw error
  return data
}

export async function dbUpdate(table, id, updates) {
  const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function dbDelete(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

export async function dbUpsert(table, row, onConflict) {
  const opts = onConflict ? { onConflict } : {}
  const { data, error } = await supabase.from(table).upsert(row, opts).select().single()
  if (error) throw error
  return data
}
