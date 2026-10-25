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

async function callModel(key: string, model: string, prompt: string, asJson: boolean, extraParts: unknown[] = [], temperature?: number) {
  return await fetch(`${API}/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [...extraParts, { text: prompt }] }],
      generationConfig: asJson
        ? { response_mime_type: 'application/json', temperature: temperature ?? 0.8 }
        : { temperature: temperature ?? 0.6 },
    }),
  })
}

async function gemini(prompt: string, asJson = true, extraParts: unknown[] = [], temperature?: number): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new Error('Falta el secreto GEMINI_API_KEY en Supabase')

  let model = resolvedModel || PREFERRED_MODEL
  let res = await callModel(key, model, prompt, asJson, extraParts, temperature)
  if (res.status === 404) {
    const alt = await pickAvailableModel(key)
    if (alt && alt !== model) {
      model = alt
      res = await callModel(key, model, prompt, asJson, extraParts, temperature)
    }
  }
  if ((res.status === 429 || res.status === 503) && res.ok === false) {
    await new Promise((r) => setTimeout(r, 1500))
    res = await callModel(key, model, prompt, asJson, extraParts, temperature)
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

// ── Importar una receta desde un enlace ─────────────────────────────────────
// Lee lo mismo que vería una vista previa de enlace (etiquetas og:, datos estructurados de receta, vídeo público
// si es accesible) y, si no hay nada legible (p. ej. Instagram pide iniciar sesión), pide al usuario que pegue el texto.

const URL_RE = /https?:\/\/[^\s<>"')\]]+/i
function extractUrl(...vals: unknown[]): string | null {
  for (const v of vals) {
    const m = String(v ?? '').match(URL_RE)
    if (m) return m[0].replace(/[.,;:!?]+$/, '')
  }
  return null
}

// Solo sitios públicos con nombre de dominio: nada de localhost, redes internas ni direcciones IP
function isPublicHost(host: string): boolean {
  const h = host.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return false
  if (/^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return false
  return h.includes('.')
}

async function safeFetch(url: string, init: RequestInit = {}, maxRedirects = 4): Promise<{ res: Response; finalUrl: string }> {
  let current = url
  for (let i = 0; i <= maxRedirects; i++) {
    const u = new URL(current)
    if (!/^https?:$/.test(u.protocol) || !isPublicHost(u.hostname) || (u.port && !['80', '443'].includes(u.port))) {
      throw new Error('Ese enlace no está permitido')
    }
    const res = await fetch(current, { ...init, redirect: 'manual', signal: AbortSignal.timeout(12000) })
    const loc = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && loc) { current = new URL(loc, current).toString(); continue }
    return { res, finalUrl: current }
  }
  throw new Error('Demasiadas redirecciones')
}

async function readBytes(res: Response, maxBytes: number): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const reader = res.body?.getReader()
  if (!reader) return { bytes: new Uint8Array(0), truncated: false }
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.length
    if (total > maxBytes) { truncated = true; await reader.cancel(); break }
  }
  const out = new Uint8Array(Math.min(total, maxBytes))
  let off = 0
  for (const c of chunks) {
    const take = Math.min(c.length, out.length - off)
    if (take <= 0) break
    out.set(c.subarray(0, take), off)
    off += take
  }
  return { bytes: out, truncated }
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function decodeHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function metaContent(html: string, key: string): string | null {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*?content=["']([^"']*)["']`, 'i').exec(html)
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${k}["']`, 'i').exec(html)
  const v = (a || b)?.[1]
  return v ? decodeHtml(v).trim() : null
}

function isoDurationToMin(v: unknown): number | null {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(v ?? ''))
  if (!m) return null
  const mins = Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0)
  return mins > 0 ? mins : null
}

function findRecipes(node: any, out: any[] = []): any[] {
  if (!node) return out
  if (Array.isArray(node)) { node.forEach((n) => findRecipes(n, out)); return out }
  if (typeof node === 'object') {
    const t = node['@type']
    if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) out.push(node)
    if (node['@graph']) findRecipes(node['@graph'], out)
  }
  return out
}

function instructionsToText(v: any): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(instructionsToText).filter(Boolean).join('\n')
  if (v.itemListElement) return instructionsToText(v.itemListElement)
  return String(v.text ?? v.name ?? '')
}

function parsePage(html: string) {
  const title = metaContent(html, 'og:title') || decodeHtml((/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? '').trim()) || null
  const description = metaContent(html, 'og:description') || metaContent(html, 'description')
  const video = metaContent(html, 'og:video:secure_url') || metaContent(html, 'og:video') || metaContent(html, 'twitter:player:stream')
  let recipe: any = null
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found = findRecipes(JSON.parse(m[1].trim()))
      if (found.length) { recipe = found[0]; break }
    } catch { /* bloque no válido */ }
  }
  const structured = recipe ? {
    name: String(recipe.name ?? ''),
    description: String(recipe.description ?? ''),
    ingredients: (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : []).map((x: unknown) => String(x)),
    steps: instructionsToText(recipe.recipeInstructions),
    total_min: isoDurationToMin(recipe.totalTime) ?? ((isoDurationToMin(recipe.cookTime) ?? 0) + (isoDurationToMin(recipe.prepTime) ?? 0) || null),
    yield: Array.isArray(recipe.recipeYield) ? recipe.recipeYield.join(', ') : String(recipe.recipeYield ?? ''),
    keywords: String(recipe.keywords ?? ''),
  } : null
  return { title, description, video, structured }
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const PREVIEW_UAS = ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)']
const MAX_VIDEO_BYTES = 15 * 1024 * 1024

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

  async import_recipe(b) {
    const url = extractUrl(b.url, b.text)
    // El texto del usuario es lo que haya además del enlace (un "mira esta receta https://…" no cuenta como receta)
    const userText = String(b.text ?? '').replace(new RegExp(URL_RE.source, 'gi'), ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
    if (!url && userText.length < 30) throw new Error('Pega un enlace o el texto de la receta')

    const analyzed = { text: false, structured: false, video: false, youtube: false, user_text: userText.length >= 30 }
    let pageTitle: string | null = null
    let pageDesc: string | null = null
    let structured: ReturnType<typeof parsePage>['structured'] = null
    let videoPart: unknown = null
    let blocked = false
    let host = ''
    let source = url

    if (url) {
      try { host = new URL(url).hostname.replace(/^www\./, '') } catch { throw new Error('El enlace no es válido') }
      const isYouTube = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)
      const isInstagram = /(^|\.)instagram\.com$/.test(host)

      if (isYouTube) {
        // Gemini puede ver los vídeos públicos de YouTube directamente
        videoPart = { file_data: { file_uri: url } }
        analyzed.youtube = true
      }

      const uas = isInstagram ? PREVIEW_UAS : [BROWSER_UA, ...PREVIEW_UAS]
      let page: ReturnType<typeof parsePage> | null = null
      for (const ua of uas) {
        try {
          const { res, finalUrl } = await safeFetch(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.7', Accept: 'text/html,application/xhtml+xml' } })
          if (/\/accounts\/login|\/login\/?(\?|$)/.test(finalUrl) && isInstagram) { blocked = true; continue }
          if (!res.ok) { if (res.status === 401 || res.status === 403 || res.status === 429) blocked = true; continue }
          const { bytes } = await readBytes(res, 1_500_000)
          const parsed = parsePage(new TextDecoder().decode(bytes))
          if (parsed.structured || parsed.description || parsed.video) { page = parsed; source = finalUrl; break }
          blocked = blocked || isInstagram
        } catch { /* se prueba con el siguiente */ }
      }
      if (page) {
        pageTitle = page.title
        // En Instagram, un texto genérico de "inicia sesión" no es la descripción
        const generic = /log in|iniciar sesi|sign up|regístrate/i.test(page.description ?? '') && (page.description ?? '').length < 160
        pageDesc = generic ? null : page.description
        structured = page.structured
        analyzed.structured = !!structured
        analyzed.text = !!(pageDesc && pageDesc.length >= 40)
        if (page.video && !videoPart) {
          try {
            const { res } = await safeFetch(page.video, { headers: { 'User-Agent': PREVIEW_UAS[0], Range: `bytes=0-${MAX_VIDEO_BYTES - 1}` } })
            const len = Number(res.headers.get('content-range')?.split('/')[1] || res.headers.get('content-length') || 0)
            if ((res.status === 200 || res.status === 206) && (!len || len <= MAX_VIDEO_BYTES)) {
              const { bytes, truncated } = await readBytes(res, MAX_VIDEO_BYTES)
              if (!truncated && bytes.length > 10_000) {
                videoPart = { inline_data: { mime_type: res.headers.get('content-type')?.split(';')[0] || 'video/mp4', data: toBase64(bytes) } }
                analyzed.video = true
              }
            }
          } catch { /* sin vídeo: se sigue con el texto */ }
        }
      }
    }

    const hasText = analyzed.user_text || analyzed.structured || analyzed.text
    if (!hasText && !videoPart) {
      return {
        ok: false,
        needText: true,
        blocked,
        host,
        found: { title: pageTitle },
        message: blocked || host.includes('instagram')
          ? 'Instagram no deja leer esta publicación sin iniciar sesión. Copia la descripción de la publicación y pégala aquí.'
          : 'No he podido leer ese enlace. Pega aquí el texto de la receta.',
      }
    }

    const evidence: string[] = []
    if (pageTitle) evidence.push(`TÍTULO DE LA PÁGINA: ${pageTitle}`)
    if (pageDesc) evidence.push(`DESCRIPCIÓN / PIE DE LA PUBLICACIÓN:\n${pageDesc}`)
    if (structured) {
      evidence.push(`RECETA ESTRUCTURADA DE LA PÁGINA:\nNombre: ${structured.name}\nDescripción: ${structured.description}\nIngredientes:\n- ${structured.ingredients.join('\n- ')}\nPasos:\n${structured.steps}\nTiempo total (min): ${structured.total_min ?? 'no indicado'}\nRaciones: ${structured.yield}\nPalabras clave: ${structured.keywords}`)
    }
    if (userText) evidence.push(`TEXTO PEGADO POR EL USUARIO:\n${userText}`)

    const text = await gemini(`Eres un asistente de cocina española. A partir de las fuentes siguientes${videoPart ? ' y del vídeo adjunto (analiza lo que se dice y lo que se ve: ingredientes, cantidades y pasos)' : ''}, extrae UNA receta y escríbela en español de forma simple y estructurada.

${evidence.join('\n\n') || '(Solo hay vídeo)'}

Reglas:
- Usa solo lo que aparece en las fuentes. Si faltan cantidades o pasos, deduce con prudencia y anota en "inferred" qué campos has estimado (por ejemplo "cantidades", "pasos", "tiempo").
- Si el contenido NO es una receta de cocina, devuelve {"is_recipe": false}.
- Ingredientes con nombre simple en español y categoría de esta lista: ${CATEGORIES.join(', ')}. Añade la cantidad si se conoce.
- tipo: uno de ${DISH_TYPES.join(', ')}. ligereza: "ligero", "equilibrado" o "contundente". Tiempo total en minutos (número).
- pasos: texto plano numerado, máximo 8 pasos cortos. Etiquetas: de 1 a 4, en minúsculas, muy cortas.

Responde ÚNICAMENTE con este JSON (sin markdown):
{"is_recipe":true,"name":"","description":"","time_min":0,"light":"ligero","type":"","ingredients":[{"name":"","category":"","quantity":""}],"steps":"","tags":[""],"inferred":[""]}`, true, videoPart ? [videoPart] : [], 0.2)

    const p = parseJson(text)
    if (p.is_recipe === false || !p.name) {
      return { ok: false, notRecipe: true, message: 'No parece una receta de cocina. Si lo es, pega aquí la descripción y vuelve a analizarla.' }
    }
    return {
      ok: true,
      analyzed,
      recipe: {
        name: String(p.name || '').slice(0, 100),
        description: String(p.description || '').slice(0, 300),
        time_min: Number.isFinite(Number(p.time_min)) && Number(p.time_min) > 0 ? Math.round(Number(p.time_min)) : null,
        light: ['ligero', 'equilibrado', 'contundente'].includes(p.light) ? p.light : null,
        type: DISH_TYPES.includes(p.type) ? p.type : null,
        ingredients: (Array.isArray(p.ingredients) ? p.ingredients : []).slice(0, 40).map((i: any) => ({
          name: String(i?.name ?? i ?? '').slice(0, 60),
          category: CATEGORIES.includes(i?.category) ? i.category : 'Otros',
          quantity: String(i?.quantity ?? '').slice(0, 40),
        })).filter((i: any) => i.name),
        steps: String(p.steps || '').slice(0, 3000),
        tags: list(p.tags, 4).map((t: string) => t.toLowerCase().trim()).filter(Boolean),
        inferred: list(p.inferred, 6),
        source_url: source || url || null,
      },
    }
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

    // Lotes de hasta 4 platos pedidos a la vez: el tiempo total es el de un lote, no el de todos
    const CHUNK_MAX = 4
    const chunks = Math.ceil(count / CHUNK_MAX)
    const base = Math.floor(count / chunks)
    const extra = count % chunks
    const sizes = Array.from({ length: chunks }, (_, i) => base + (i < extra ? 1 : 0))
    // Sin un tipo de plato elegido, cada lote se centra en algo distinto para que no se repitan entre sí
    const HINTS = [
      'con pescado o marisco como protagonista',
      'con ave (pollo o pavo) o carne magra',
      'con legumbres, huevo o tofu',
      'con verduras, pasta o arroz como protagonista',
    ]
    const useHints = chunks > 1 && types.length === 0

    const ask = async (n: number, hint: string, exclude: string[] = []) => {
      const known = [...history, ...exclude]
      const text = await gemini(`Eres un asistente de cocina española para una pareja que intenta comer sano y que a veces tiene poco tiempo para cocinar. Propón EXACTAMENTE ${n} plato${n > 1 ? 's' : ''} distinto${n > 1 ? 's' : ''}, sencillos y apetecibles.

Requisitos:
${rules.length ? rules.map((r) => '- ' + r).join('\n') : '- Sin requisitos especiales'}${hint ? `\n- Este lote debe centrarse en platos ${hint} (otros lotes cubren otros tipos)` : ''}

Ya tienen en su recetario: ${known.length ? known.join(', ') : 'nada'}. Propón platos DIFERENTES a esos.

Para cada plato devuelve: nombre, descripción de 1 frase, tiempo total en minutos (número), ligereza ("ligero", "equilibrado" o "contundente"), tipo (uno de: ${DISH_TYPES.join(', ')}), ingredientes (cada uno con nombre simple en español y categoría de esta lista: ${CATEGORIES.join(', ')}), pasos (texto plano numerado, máx. 6 pasos cortos) y etiquetas (de 1 a 4, en minúsculas, muy cortas: estilo de cocina, método, dieta u ocasión; por ejemplo "mediterránea", "airfryer", "tupper", "rápido").

Responde ÚNICAMENTE con este JSON (sin markdown):
{"proposals":[{"name":"","description":"","time_min":0,"light":"ligero","type":"","ingredients":[{"name":"","category":""}],"steps":"","tags":[""]}]}`)
      const p = parseJson(text)
      return (Array.isArray(p.proposals) ? p.proposals : []).slice(0, n).map((x: any) => ({
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
    }

    const results = await Promise.allSettled(sizes.map((n, i) => ask(n, useHints ? HINTS[i % HINTS.length] : '')))
    const got = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    if (!got.length) {
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
      throw failed?.reason ?? new Error('La IA no devolvió propuestas')
    }
    // Sin repetidos entre lotes (mismo nombre sin tildes ni mayúsculas)
    const norm = (n: string) => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    const dedupe = (arr: any[]) => {
      const seen = new Set<string>()
      return arr.filter((x: any) => {
        const k = norm(x.name)
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    }
    let out = dedupe(got).slice(0, count)
    // Si por repetidos faltan platos, se pide solo lo que falta (rara vez ocurre)
    if (out.length < count) {
      try {
        const more = await ask(count - out.length, '', out.map((x: any) => x.name))
        out = dedupe([...out, ...more]).slice(0, count)
      } catch { /* se devuelven los que hay */ }
    }
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
