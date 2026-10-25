import { createClient } from 'npm:@supabase/supabase-js@2'

// Proxy de IA: la clave de Gemini vive solo aquí (secreto GEMINI_API_KEY), nunca en el navegador.
// Solo responde a usuarios con sesión iniciada en la app.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

const API = 'https://generativelanguage.googleapis.com/v1beta'
const PREFERRED_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash'
let resolvedModel: string | null = null

const CATEGORIES = [
  'Verduras y Hortalizas', 'Frutas', 'Carnes', 'Pescados y Mariscos', 'Lácteos y Huevos',
  'Legumbres y Cereales', 'Pasta y Arroz', 'Conservas y Preparados', 'Condimentos y Especias',
  'Aceites y Vinagres', 'Otros',
]
const DISH_TYPES = ['Carnes', 'Pescados y Mariscos', 'Verduras y Hortalizas', 'Pasta y Arroz', 'Legumbres y Cereales', 'Guisos', 'Comer fuera']

// Los modelos de Gemini se retiran con frecuencia: si el configurado da 404, se elige el flash más reciente disponible.
async function pickAvailableModel(key: string): Promise<string | null> {
  const res = await fetch(`${API}/models?key=${key}&pageSize=200`)
  if (!res.ok) return null
  const { models = [] } = await res.json()
  const names: string[] = models
    .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m: any) => String(m.name).replace('models/', ''))
    .filter((n: string) => /flash/.test(n) && !/(lite|image|live|tts|audio|preview|exp|thinking|embedding)/.test(n))
  const version = (n: string) => Number((n.match(/(\d+(?:\.\d+)?)/) || [])[1] || 0)
  names.sort((a, b) => version(b) - version(a))
  return names[0] ?? null
}

async function callModel(key: string, model: string, prompt: string, asJson: boolean) {
  return await fetch(`${API}/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: asJson ? { response_mime_type: 'application/json', temperature: 0.8 } : { temperature: 0.6 },
    }),
  })
}

async function gemini(prompt: string, asJson = true): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new Error('Falta el secreto GEMINI_API_KEY en Supabase')

  let model = resolvedModel || PREFERRED_MODEL
  let res = await callModel(key, model, prompt, asJson)
  if (res.status === 404) {
    const alt = await pickAvailableModel(key)
    if (alt && alt !== model) {
      model = alt
      res = await callModel(key, model, prompt, asJson)
    }
  }
  if ((res.status === 429 || res.status === 503) && res.ok === false) {
    await new Promise((r) => setTimeout(r, 1500))
    res = await callModel(key, model, prompt, asJson)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Gemini respondió ${res.status}`)
  }
  resolvedModel = model
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? ''
  if (!text) throw new Error('Respuesta vacía de Gemini')
  return text
}

function parseJson(text: string) {
  const clean = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  return JSON.parse(clean)
}

const list = (v: unknown, max: number) =>
  Array.isArray(v) ? v.map((x) => String(x).slice(0, 80)).slice(0, max) : []

const STYLE_LABELS: [string, string][] = [
  ['cuisine', 'Cocina'],
  ['method', 'Método de cocinado'],
  ['diet', 'Dieta u objetivo'],
  ['occasion', 'Ocasión'],
]

const ACTIONS: Record<string, (b: any) => Promise<unknown>> = {
  async ping() {
    const text = await gemini('Responde solo con la palabra OK', false)
    return { ok: true, model: resolvedModel, reply: text.slice(0, 20) }
  },

  async dish_ingredients(b) {
    const names = list(b.ingredientNames, 400)
    const effort = b.effortLevel === 1
      ? 'fácil (usando preparados y conservas)'
      : b.effortLevel === 2 ? 'medio (mezcla de frescos y preparados)' : 'casero (todo desde cero con ingredientes frescos)'
    const text = await gemini(`Eres un asistente de cocina española. Para el plato "${String(b.dishName).slice(0, 100)}" con nivel de esfuerzo ${effort}, necesito dos cosas:
1. Ingredientes de esta lista que se necesitan para el plato: ${names.join(', ')}
2. Ingredientes adicionales importantes para este plato que NO aparecen en la lista anterior (máximo 5, nombres simples en español)

Responde ÚNICAMENTE con este JSON (sin texto adicional):
{"existing": ["nombre exacto tal como aparece en la lista"], "new": ["ingrediente nuevo en español"]}`)
    const p = parseJson(text)
    return { existing: list(p.existing, 40), new: list(p.new, 10) }
  },

  async recipe_steps(b) {
    const text = await gemini(`Explica cómo preparar "${String(b.dishName).slice(0, 100)}" de forma sencilla para un cocinero doméstico. Máximo 6 pasos cortos y claros. Responde en español, sin formato markdown, solo texto plano con pasos numerados.`, false)
    return { text: text.trim() }
  },

  async proposals(b) {
    const count = Math.min(15, Math.max(1, Math.floor(Number(b.count) || 5)))
    const f = b.filters || {}
    const rules: string[] = []
    if (f.meal) rules.push(`Para ${String(f.meal).toLowerCase()}`)
    if (f.maxTime) rules.push(`Tiempo total de cocinado de ${Number(f.maxTime)} minutos como máximo`)
    if (f.light) rules.push('Ligeros y bajos en calorías y grasa (máx. ~500 kcal por ración): horno, plancha, vapor, crudos; evita fritos, nata, quesos grasos y salsas pesadas')
    if (f.fewIngredients) rules.push(`Con pocos ingredientes (${Number(f.maxIngredients) || 6} o menos)`)
    const types = list(f.types, 7)
    if (types.length) rules.push(`Tipo de plato: ${types.join(' o ')}`)
    const styles = f.styles || {}
    for (const [k, label] of STYLE_LABELS) {
      const v = list(styles[k], 12)
      if (v.length) rules.push(`${label}: ${v.join(' o ')}`)
    }
    const available = list(f.available, 40)
    if (available.length) rules.push(`Aprovechar estos ingredientes que ya tienen en casa: ${available.join(', ')} (que protagonicen los platos cuando sea posible)`)
    if (f.avoid) rules.push(`Evitar o excluir: ${String(f.avoid).slice(0, 200)}`)
    if (f.notes) rules.push(`Notas: ${String(f.notes).slice(0, 300)}`)
    const history = list(b.history, 60)

    const text = await gemini(`Eres un asistente de cocina española para una pareja que intenta comer sano y que a veces tiene poco tiempo para cocinar. Propón EXACTAMENTE ${count} plato${count > 1 ? 's' : ''} distinto${count > 1 ? 's' : ''}, sencillos y apetecibles.

Requisitos:
${rules.length ? rules.map((r) => '- ' + r).join('\n') : '- Sin requisitos especiales'}

Ya tienen en su recetario: ${history.length ? history.join(', ') : 'nada'}. Propón platos DIFERENTES a esos.

Para cada plato devuelve: nombre, descripción de 1 frase, tiempo total en minutos (número), ligereza ("ligero", "equilibrado" o "contundente"), tipo (uno de: ${DISH_TYPES.join(', ')}), ingredientes (cada uno con nombre simple en español y categoría de esta lista: ${CATEGORIES.join(', ')}), pasos (texto plano numerado, máx. 6 pasos cortos) y etiquetas (de 1 a 4, en minúsculas, muy cortas: estilo de cocina, método, dieta u ocasión; por ejemplo "mediterránea", "airfryer", "tupper", "rápido").

Responde ÚNICAMENTE con este JSON (sin markdown):
{"proposals":[{"name":"","description":"","time_min":0,"light":"ligero","type":"","ingredients":[{"name":"","category":""}],"steps":"","tags":[""]}]}`)
    const p = parseJson(text)
    const out = (Array.isArray(p.proposals) ? p.proposals : []).slice(0, count).map((x: any) => ({
      name: String(x.name || '').slice(0, 100),
      description: String(x.description || '').slice(0, 300),
      time_min: Number.isFinite(Number(x.time_min)) ? Math.round(Number(x.time_min)) : null,
      light: ['ligero', 'equilibrado', 'contundente'].includes(x.light) ? x.light : null,
      type: DISH_TYPES.includes(x.type) ? x.type : null,
      ingredients: (Array.isArray(x.ingredients) ? x.ingredients : []).slice(0, 25).map((i: any) => ({
        name: String(i?.name ?? i ?? '').slice(0, 60),
        category: CATEGORIES.includes(i?.category) ? i.category : 'Otros',
      })).filter((i: any) => i.name),
      steps: String(x.steps || '').slice(0, 2000),
      tags: list(x.tags, 4).map((t: string) => t.toLowerCase().trim()).filter(Boolean),
    })).filter((x: any) => x.name)
    return { proposals: out }
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  // Solo usuarios con sesión (no basta con la clave anónima pública)
  const auth = req.headers.get('Authorization') ?? ''
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return json({ error: 'No autorizado' }, 401)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Petición no válida' }, 400) }
  const handler = ACTIONS[String(body?.action)]
  if (!handler) return json({ error: 'Acción desconocida' }, 400)

  try {
    return json(await handler(body))
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Error de IA' }, 502)
  }
})
