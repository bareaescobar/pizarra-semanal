import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  X,
  Pencil,
  Trash2,
  Sparkles,
  Search,
  History,
  Copy,
  ChefHat,
  Palette,
  GripVertical,
  RotateCcw,
  Share2,
  LogOut,
  Lightbulb,
  Star,
  Tag,
  Wand2,
  BookOpen,
  MoreHorizontal,
  CalendarDays,
  CalendarPlus,
  Package,
} from 'lucide-react'
import supabase, { dbGet, dbInsert, dbUpdate, dbDelete } from './supabase.js'
import { INGREDIENT_CATEGORIES, DEFAULT_INGREDIENTS } from './ingredients.js'

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const SLOTS = [
  { key: 'lunch', label: 'Comida' },
  { key: 'dinner', label: 'Cena' },
]
const EFFORT_LABELS = { 1: '🟢 Fácil', 2: '🟡 Medio', 3: '🔴 Casero' }

const CATEGORY_COLORS = {
  'Verduras y Hortalizas':  '#16a34a',
  'Frutas':                 '#db2777',
  'Carnes':                 '#dc2626',
  'Pescados y Mariscos':    '#2563eb',
  'Lácteos y Huevos':       '#d97706',
  'Legumbres y Cereales':   '#7c3aed',
  'Pasta y Arroz':          '#ca8a04',
  'Conservas y Preparados': '#0891b2',
  'Condimentos y Especias': '#ea580c',
  'Aceites y Vinagres':     '#65a30d',
  'Guisos':                 '#92400e',
  'Comer fuera':            '#6b7280',
  'Otros':                  '#94a3b8',
}

const CATEGORY_PASTELS = {
  'Verduras y Hortalizas':  '#bbf7d0',
  'Frutas':                 '#fbcfe8',
  'Carnes':                 '#fecaca',
  'Pescados y Mariscos':    '#bfdbfe',
  'Lácteos y Huevos':       '#fde68a',
  'Legumbres y Cereales':   '#ddd6fe',
  'Pasta y Arroz':          '#fef08a',
  'Conservas y Preparados': '#a5f3fc',
  'Condimentos y Especias': '#fed7aa',
  'Aceites y Vinagres':     '#d9f99d',
  'Guisos':                 '#fcd34d',
  'Comer fuera':            '#cbd5e1',
  'Otros':                  '#fef9c3',
}

// Types available in context-menu color picker
const FOOD_TYPES = [
  { key: 'Carnes',               label: 'Carnes',       emoji: '🥩' },
  { key: 'Pescados y Mariscos',  label: 'Pescado',      emoji: '🐟' },
  { key: 'Verduras y Hortalizas',label: 'Verduras',     emoji: '🥦' },
  { key: 'Pasta y Arroz',        label: 'Hidratos',     emoji: '🍝' },
  { key: 'Legumbres y Cereales', label: 'Legumbres',    emoji: '🫘' },
  { key: 'Guisos',               label: 'Guisos',       emoji: '🍲' },
  { key: 'Comer fuera',          label: 'Comer fuera',  emoji: '🍽️' },
]

// Categories that should NOT trigger consecutive-day warnings
const ALERT_EXCLUDED = new Set(['Verduras y Hortalizas', 'Condimentos y Especias', 'Aceites y Vinagres', 'Frutas', 'Otros', null])

// Prefijos de palabra (se comparan sin tildes y al inicio de cada palabra: "lenteja" cubre "lentejas")
const DISH_KEYWORDS = {
  'Carnes':                ['pollo', 'pechuga', 'muslo', 'contramuslo', 'alita', 'ternera', 'cerdo', 'cordero', 'pavo', 'conejo', 'costilla', 'albondiga', 'hamburguesa', 'filete', 'chuleta', 'lomo', 'salchicha', 'chorizo', 'carne', 'bistec', 'solomillo', 'secreto', 'pluma', 'jamon', 'bacon', 'panceta', 'cachopo', 'escalope', 'milanesa', 'croqueta', 'pincho', 'brocheta', 'kebab', 'codorniz', 'pato', 'magro', 'morcilla', 'longaniza'],
  'Pescados y Mariscos':   ['merluza', 'salmon', 'atun', 'bacalao', 'gamba', 'langostino', 'mejillon', 'pulpo', 'calamar', 'sepia', 'dorada', 'lubina', 'sardina', 'boqueron', 'rape', 'pescado', 'marisco', 'trucha', 'lenguado', 'rodaballo', 'caballa', 'anchoa', 'almeja', 'berberecho', 'zamburina', 'vieira', 'bonito', 'gallo', 'pescadilla', 'emperador', 'surimi', 'sushi', 'poke', 'chipiron', 'gulas'],
  'Verduras y Hortalizas': ['ensalada', 'espinaca', 'brocoli', 'zanahoria', 'calabacin', 'pimiento', 'berenjena', 'tomate', 'lechuga', 'menestra', 'verdura', 'acelga', 'coliflor', 'champinon', 'setas', 'esparrago', 'alcachofa', 'judias verdes', 'pisto', 'gazpacho', 'salmorejo', 'cebolla', 'calabaza', 'puerro', 'repollo'],
  'Pasta y Arroz':         ['pasta', 'macarron', 'espagueti', 'arroz', 'paella', 'fideua', 'fideo', 'lasana', 'risotto', 'canelon', 'tallarin', 'noqui', 'ravioli', 'tortellini', 'cuscus', 'noodle', 'pizza', 'bocadillo', 'sandwich', 'burrito', 'taco', 'wrap', 'empanada', 'quiche', 'patata', 'puré de patata'],
  'Legumbres y Cereales':  ['lenteja', 'garbanzo', 'alubia', 'judia', 'fabes', 'potaje', 'fabada', 'habas', 'guisantes', 'soja', 'hummus', 'quinoa', 'bulgur', 'cereales', 'avena'],
  'Guisos':                ['guiso', 'estofado', 'cocido', 'puchero', 'caldo', 'sopa', 'crema', 'pure', 'caldereta', 'rabo', 'marmitako', 'carrillera', 'ropa vieja', 'olla', 'pote', 'callos', 'albondigas en salsa'],
  'Comer fuera':           ['restaurante', 'comer fuera', 'fuera', 'menu del dia', 'tapeo', 'tapas', 'pedir', 'takeaway', 'delivery', 'mcdonald', 'burger king', 'telepizza', 'dominos', 'glovo', 'just eat', 'cena fuera', 'comida fuera', 'invitados', 'casa de'],
}

// En empate gana la categoría "principal" del plato antes que las de acompañamiento
const MAIN_CATEGORY_ORDER = ['Carnes', 'Pescados y Mariscos', 'Guisos', 'Legumbres y Cereales', 'Pasta y Arroz', 'Comer fuera']

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Id único: la hora en milisegundos sola se repite al crear varios elementos en el mismo instante
function newId() {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0')
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function titleCase(str) {
  if (!str) return ''
  return String(str)
    .toLocaleLowerCase('es')
    .replace(/(^|\s|[-/])([\p{L}])/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('es'))
}

// startDayOfWeek: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
function getWeekKey(offset = 0, startDayOfWeek = 0) {
  const today = new Date()
  const todayDow = (today.getDay() + 6) % 7 // Mon=0..Sun=6
  const daysSinceStart = (todayDow - startDayOfWeek + 7) % 7
  const d = new Date(today)
  d.setDate(today.getDate() - daysSinceStart + offset * 7)
  const Y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  return `${Y}-${M}-${D}`
}

function getDayDate(weekKey, dayIdx) {
  const [y, m, d] = weekKey.split('-').map(Number)
  return new Date(y, m - 1, d + dayIdx)
}

function formatWeekRange(weekKey, startDayOfWeek = 0) {
  const start = getDayDate(weekKey, startDayOfWeek)
  const end = getDayDate(weekKey, startDayOfWeek + 6)
  const fmt = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(end)}`
}

function dayNameForIdx(dayIdx, startDayOfWeek) {
  return DAYS[(startDayOfWeek + dayIdx) % 7]
}

function isToday(date) {
  const now = new Date()
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  )
}

function slotRotation(slotId) {
  let hash = 0
  const str = String(slotId)
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff
  }
  return (((hash % 1000) / 1000) * 5 - 2.5).toFixed(2)
}

function normalizeText(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Puntuación por categoría según el nombre del plato (coincidencia al inicio de palabra)
function scoreNameCategories(name) {
  const n = ` ${normalizeText(name)}`
  const scores = {}
  let firstCat = null
  let firstPos = Infinity
  for (const [cat, kws] of Object.entries(DISH_KEYWORDS)) {
    for (const kw of kws) {
      const pos = n.indexOf(` ${normalizeText(kw)}`)
      if (pos === -1) continue
      scores[cat] = (scores[cat] || 0) + 3
      if (pos < firstPos) { firstPos = pos; firstCat = cat }
    }
  }
  // Lo primero que nombra el plato suele ser lo principal ("Lentejas con chorizo", "Pasta con gambas")
  if (firstCat) scores[firstCat] += 1.5
  return scores
}

function pickTopCategory(scores) {
  const entries = Object.entries(scores)
  if (!entries.length) return null
  const rank = (cat) => { const i = MAIN_CATEGORY_ORDER.indexOf(cat); return i === -1 ? 99 : i }
  return entries.sort((a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]))[0][0]
}

// Combina el nombre (peso alto) con los ingredientes: los ingredientes "principales"
// (carne, pescado, legumbres, pasta…) pesan más que verduras o condimentos de acompañamiento.
function getDominantCategory(ingredientIds, allIngredients, dishName) {
  const scores = dishName ? scoreNameCategories(dishName) : {}
  for (const id of ingredientIds || []) {
    const ing = allIngredients.find((i) => i.id === id)
    if (!ing) continue
    const w = MAIN_CATEGORY_ORDER.includes(ing.category) ? 1 : 0.3
    scores[ing.category] = (scores[ing.category] || 0) + w
  }
  return pickTopCategory(scores)
}

function getDominantCategoryColor(ingredientIds, allIngredients) {
  const cat = getDominantCategory(ingredientIds, allIngredients)
  return cat ? (CATEGORY_COLORS[cat] ?? null) : null
}

function guessCategoryFromName(name) {
  return pickTopCategory(scoreNameCategories(name))
}

function guessCategoryForItem(name, ingredients) {
  const q = name.toLowerCase().trim()
  const exact = ingredients.find((i) => i.name.toLowerCase() === q)
  if (exact) return exact.category
  const partial = ingredients.find(
    (i) => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase())
  )
  if (partial) return partial.category
  return guessCategoryFromName(name) || 'Otros'
}

// ─── IA (Gemini) ──────────────────────────────────────────────────────────────
// Las llamadas pasan por la Edge Function "ai" de Supabase: la clave de Gemini vive allí como secreto
// y la función solo responde a usuarios con sesión iniciada.

async function callAI(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('ai', { body: { action, ...payload } })
  if (error) {
    let msg = error.message
    try { msg = (await error.context.json()).error || msg } catch {}
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

async function callGemini(dishName, effortLevel, ingredientNames) {
  return await callAI('dish_ingredients', { dishName, effortLevel, ingredientNames })
}

async function callGeminiRecipe(dishName) {
  return (await callAI('recipe_steps', { dishName })).text
}

function getDietWarnings(slots, ingredients, colorOverrides, startDayOfWeek = 0, weekKey = null, nextWeekKey = null) {
  const dayCats = Array.from({ length: 7 }, (_, dayIdx) => {
    const absIdx = (startDayOfWeek + dayIdx) % 7
    const colWk = weekKey && startDayOfWeek + dayIdx >= 7 ? nextWeekKey : weekKey
    const daySlots = slots.filter((s) => s.day_idx === absIdx && (colWk === null || s.week_key === colWk))
    if (!daySlots.length) return null
    const counts = {}
    for (const s of daySlots) {
      const override = colorOverrides[s.id]
      if (override) {
        counts[override] = (counts[override] || 0) + 3
      } else {
        for (const ingId of s.ingredient_ids || []) {
          const ing = ingredients.find((i) => i.id === ingId)
          if (ing && !ALERT_EXCLUDED.has(ing.category)) {
            counts[ing.category] = (counts[ing.category] || 0) + 1
          }
        }
      }
    }
    if (!Object.keys(counts).length) return null
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  })

  const warnings = []
  let runStart = 0
  for (let i = 1; i <= 7; i++) {
    const same = i < 7 && dayCats[i] === dayCats[runStart] && dayCats[runStart] && !ALERT_EXCLUDED.has(dayCats[runStart])
    if (!same) {
      const len = i - runStart
      if (len >= 2 && dayCats[runStart] && !ALERT_EXCLUDED.has(dayCats[runStart])) {
        warnings.push({ category: dayCats[runStart], days: Array.from({ length: i - runStart }, (_, k) => dayNameForIdx(runStart + k, startDayOfWeek)) })
      }
      runStart = i
    }
  }
  return warnings
}

// ─── DnD components ───────────────────────────────────────────────────────────

function DroppableCell({ id, children, isToday: isTodayCol }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`board-cell${isOver ? ' drag-over' : ''}${isTodayCol ? ' today-col' : ''}`}>
      {children}
    </div>
  )
}

function DroppableTrayZone({ id, children, className = '' }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`tray-drop-zone${isOver ? ' tray-drop-over' : ''} ${className}`}>
      {children}
    </div>
  )
}

// Fila única de la lista de la compra: mismo aspecto para ingredientes de platos y artículos manuales.
// note = de dónde viene ("Paella, Lentejas" / "para: Lentejas" / "extra").
function ShoppingRow({ name, checked, onCheck, note, onRemove, removeTitle, handle, nameProps = {}, rowRef, style }) {
  return (
    <div ref={rowRef} style={style} className={`shopping-item${checked ? ' purchased' : ''}`}>
      {handle || <span className="shopping-drag-spacer" />}
      <input type="checkbox" checked={checked} onChange={onCheck} />
      <div className="shopping-item-text" onClick={onCheck}>
        <span className="shopping-item-name" {...nameProps}>{titleCase(name)}</span>
        {note && <span className="shopping-item-note">{note}</span>}
      </div>
      <button className="shopping-item-remove" title={removeTitle} onPointerDown={(e) => e.stopPropagation()} onClick={onRemove}>
        <X size={12} />
      </button>
    </div>
  )
}

function DraggableCustomShoppingItem({ item, isPurchased, onCheck, onDelete }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: `shopping-custom-${item.id}` })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 }
  return (
    <ShoppingRow
      rowRef={setNodeRef}
      style={style}
      name={item.name}
      checked={isPurchased}
      onCheck={onCheck}
      note={item.source ? `para: ${titleCase(item.source)}` : 'extra'}
      onRemove={onDelete}
      removeTitle="Quitar de la lista"
      handle={<span ref={setActivatorNodeRef} className="shopping-drag-handle" {...attributes} {...listeners}>⠿</span>}
    />
  )
}

function DroppableShoppingCat({ category, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `shopping-cat-${category}` })
  return (
    <div ref={setNodeRef} className={`shopping-category${isOver ? ' shopping-cat-over' : ''}`}>
      {children}
    </div>
  )
}

function DraggablePostit({ slot, ingredients, colorOverrides, onEdit, onDelete, onContextMenu, onOpen, wholeDrag = false }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: slot.id })
  const overrideCategory = colorOverrides?.[slot.id] || null
  const category = overrideCategory || getDominantCategory(slot.ingredient_ids, ingredients, slot.dish_name)
  const bgColor = category ? (CATEGORY_PASTELS[category] ?? CATEGORY_PASTELS['Otros']) : CATEGORY_PASTELS['Otros']
  const accentColor = category ? (CATEGORY_COLORS[category] ?? CATEGORY_COLORS['Otros']) : CATEGORY_COLORS['Otros']
  const rotation = slotRotation(slot.id)
  const style = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    '--base-rotate': `${rotation}deg`,
    background: bgColor,
    '--postit-accent': accentColor,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`postit${isDragging ? ' dragging' : ''}${wholeDrag ? ' whole-drag' : ''}`}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, slot) }}
      {...(wholeDrag ? { ...listeners, ...attributes } : {})}
    >
      <PostitContent
        slot={slot}
        onEdit={onEdit}
        onDelete={onDelete}
        onOpen={onOpen}
        onMenu={(pos) => onContextMenu(pos, slot)}
        dragHandleRef={wholeDrag ? undefined : setActivatorNodeRef}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  )
}

function PostitContent({ slot, onEdit, onDelete, onOpen, onMenu, dragHandleRef, dragListeners, dragAttributes }) {
  const effort = slot.effort_override || 1
  return (
    <>
      <div className="postit-header">
        <span
          className="postit-name"
          onDoubleClick={() => onOpen?.(slot)}
          onClick={() => { if (window.matchMedia('(pointer: coarse)').matches) onOpen?.(slot) }}
          title="Doble clic para ver la receta"
        >{titleCase(slot.dish_name)}</span>
        <div className="postit-actions">
          {onMenu && (
            <button
              className="postit-btn"
              title="Más opciones"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                const r = e.currentTarget.getBoundingClientRect()
                onMenu({ clientX: r.left, clientY: r.bottom + 4 })
              }}
            >
              <MoreHorizontal size={12} />
            </button>
          )}
          <button
            className="postit-btn"
            title="Editar"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEdit(slot) }}
          >
            <Pencil size={11} />
          </button>
          <button
            className="postit-btn delete"
            title="Eliminar"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(slot.id) }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div className="postit-footer">
        <div className="effort-dots">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`effort-dot${n <= effort ? ` active-${effort}` : ''}`} />
          ))}
        </div>
        {onMenu && (
          <button
            className="postit-btn postit-more-touch"
            title="Más opciones"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              const r = e.currentTarget.getBoundingClientRect()
              onMenu({ clientX: r.left, clientY: r.bottom + 4 })
            }}
          >
            <MoreHorizontal size={14} />
          </button>
        )}
        {dragHandleRef && (
          <div
            ref={dragHandleRef}
            {...dragListeners}
            {...dragAttributes}
            className="drag-handle"
            title="Arrastrar"
          >
            <GripVertical size={12} />
          </div>
        )}
      </div>
    </>
  )
}

// ─── DishModal ────────────────────────────────────────────────────────────────

// Selector de ingredientes reutilizable: buscador + chips. Al elegir un ingrediente el texto
// se borra y el foco vuelve al buscador para escribir el siguiente. Enter elige el primer resultado.
function IngredientPicker({ ingredients, selectedIds, onChange, usageCount = {}, onIngredientAdded, onError, children }) {
  const [search, setSearch] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const searchRef = useRef(null)

  // Ordenar por uso DESC, luego alfabético; filtrar por búsqueda
  const filteredIngredients = useMemo(() => {
    const q = normalizeText(search).trim()
    const sorted = [...ingredients].sort((a, b) => {
      const ua = usageCount[a.id] || 0
      const ub = usageCount[b.id] || 0
      if (ub !== ua) return ub - ua
      return a.name.localeCompare(b.name, 'es')
    })
    if (!q) return sorted
    return sorted.filter((i) => normalizeText(i.name).includes(q))
  }, [ingredients, usageCount, search])

  const exactMatch = search.trim()
    ? ingredients.some((i) => normalizeText(i.name) === normalizeText(search).trim())
    : true

  const clearSearch = () => {
    setSearch('')
    searchRef.current?.focus()
  }

  const toggleIngredient = (id) => {
    onChange((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    if (search) clearSearch()
  }

  const handleAddCustom = async () => {
    const name = search.trim()
    if (!name || addingCustom) return
    setAddingCustom(true)
    try {
      const newIng = await dbInsert('v2_ingredients', { name, category: 'Otros', is_custom: true })
      onIngredientAdded(newIng)
      onChange((prev) => [...prev, newIng.id])
      clearSearch()
    } catch (e) {
      onError?.('Error al añadir ingrediente: ' + e.message)
    } finally {
      setAddingCustom(false)
    }
  }

  const handleSearchKey = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    e.stopPropagation()
    if (!search.trim()) return
    const exact = filteredIngredients.find((i) => normalizeText(i.name) === normalizeText(search).trim())
    const target = exact || filteredIngredients.find((i) => !selectedIds.includes(i.id))
    if (target) {
      if (selectedIds.includes(target.id)) clearSearch()
      else toggleIngredient(target.id)
    } else if (!exactMatch) {
      handleAddCustom()
    }
  }

  const chip = (ing, selected) => (
    <button
      key={ing.id}
      type="button"
      className={`chip${selected ? ' selected' : ''}${(usageCount[ing.id] || 0) > 0 ? ' used' : ''}`}
      onClick={() => toggleIngredient(ing.id)}
      title={usageCount[ing.id] ? `Usado en ${usageCount[ing.id]} plato(s)` : ''}
    >
      {ing.name}
      {(usageCount[ing.id] || 0) > 0 && <span className="chip-usage">{usageCount[ing.id]}</span>}
    </button>
  )

  return (
    <>
      <div className="ingredient-search-wrap">
        <Search size={14} className="ingredient-search-icon" />
        <input
          ref={searchRef}
          className="ingredient-search"
          placeholder="Buscar ingrediente… (Enter para añadir)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKey}
          enterKeyHint="done"
        />
        {search && (
          <button type="button" className="ingredient-search-clear" onClick={clearSearch}>
            <X size={12} />
          </button>
        )}
      </div>

      <div className="chips-area">
        {/* Seleccionados arriba (siempre visibles, aunque el filtro no los incluya) */}
        {ingredients.filter((i) => selectedIds.includes(i.id)).map((ing) => chip(ing, true))}

        {selectedIds.length > 0 && filteredIngredients.some((i) => !selectedIds.includes(i.id)) && (
          <div className="chips-separator" />
        )}

        {filteredIngredients.filter((i) => !selectedIds.includes(i.id)).map((ing) => chip(ing, false))}

        {search.trim() && !exactMatch && (
          <button type="button" className="chip chip-add-custom" onClick={handleAddCustom} disabled={addingCustom}>
            <Plus size={11} />
            {addingCustom ? 'Añadiendo…' : `Añadir "${search.trim()}"`}
          </button>
        )}

        {filteredIngredients.length === 0 && !search.trim() && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No hay ingredientes</span>
        )}

        {children}
      </div>

      {selectedIds.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {selectedIds.length} ingrediente{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''}
        </div>
      )}
    </>
  )
}

function DishModal({ mode, slot, dayIdx, slotKey, startDayOfWeek, ingredients, slots, onClose, onSave, onIngredientAdded, savedRecipes = [], initialName = '', dishIngMap = {} }) {
  const [dishName, setDishName] = useState(mode === 'edit' ? slot.dish_name : initialName)
  const [effort, setEffort] = useState(mode === 'edit' ? (slot.effort_override || 1) : 1)
  const [selectedIds, setSelectedIdsRaw] = useState(mode === 'edit' ? (slot.ingredient_ids || []) : [])
  const [touched, setTouched] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiNewSuggestions, setAiNewSuggestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showSugg, setShowSugg] = useState(false)
  const inputRef = useRef(null)

  // Cualquier cambio manual de ingredientes desactiva la precarga automática
  const setSelectedIds = (updater) => { setTouched(true); setSelectedIdsRaw(updater) }

  const suggestions = useMemo(() => {
    if (!dishName.trim()) return []
    const q = dishName.toLowerCase()
    return savedRecipes.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 6)
  }, [dishName, savedRecipes])

  // Ingredientes ya guardados para este plato y nivel de esfuerzo
  const savedIds = dishIngMap[dishName.trim().toLowerCase()]?.[effort] || []

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  // Al añadir un plato que ya conocemos, se precargan sus ingredientes guardados
  useEffect(() => {
    if (mode !== 'add' || touched) return
    setSelectedIdsRaw(savedIds)
  }, [mode, touched, dishName, effort, dishIngMap])

  // Calcular uso de cada ingrediente en los slots actuales
  const usageCount = useMemo(() => {
    const map = {}
    for (const s of slots) {
      for (const id of s.ingredient_ids || []) {
        map[id] = (map[id] || 0) + 1
      }
    }
    return map
  }, [slots])

  const handleAiSuggest = async () => {
    if (!dishName.trim()) return
    setAiLoading(true)
    setError(null)
    setAiNewSuggestions([])
    try {
      const names = ingredients.map((i) => i.name)
      const { existing, new: newSuggestions } = await callGemini(dishName.trim(), effort, names)
      const suggestedIds = ingredients.filter((i) => existing.includes(i.name)).map((i) => i.id)
      setSelectedIds(suggestedIds)
      const trulyNew = newSuggestions.filter(
        (name) => !ingredients.some((i) => i.name.toLowerCase() === name.toLowerCase())
      )
      setAiNewSuggestions(trulyNew)
    } catch (e) {
      setError('Error al contactar Gemini: ' + e.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleAddAiNew = async (name) => {
    try {
      const newIng = await dbInsert('v2_ingredients', { name, category: 'Otros', is_custom: true })
      onIngredientAdded(newIng)
      setSelectedIds((prev) => [...prev, newIng.id])
      setAiNewSuggestions((prev) => prev.filter((n) => n !== name))
    } catch (e) {
      setError('Error al añadir: ' + e.message)
    }
  }

  const handleSave = async () => {
    if (!dishName.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ dishName: dishName.trim(), effort, selectedIds, slot, dayIdx, slotKey })
      onClose()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const title = mode === 'edit' ? 'Editar plato' : 'Añadir plato'
  const dayLabel = mode === 'add' ? ` — ${dayNameForIdx(dayIdx, startDayOfWeek ?? 0)}, ${SLOTS.find((s) => s.key === slotKey)?.label}` : ''

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{title}{dayLabel}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {/* Nombre */}
          <div className="form-field autocomplete-wrap">
            <label className="form-label">Nombre del plato</label>
            <input
              ref={inputRef}
              className="form-input"
              placeholder="Ej: Pasta carbonara"
              value={dishName}
              enterKeyHint="done"
              onChange={(e) => { setDishName(e.target.value); setShowSugg(true) }}
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (dishName.trim()) handleSave() } }}
            />
            {showSugg && suggestions.length > 0 && (
              <div className="autocomplete-list">
                {suggestions.map((r) => (
                  <button
                    key={r.id}
                    className="autocomplete-item"
                    onMouseDown={(e) => { e.preventDefault(); setDishName(r.name); setShowSugg(false) }}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Esfuerzo */}
          <div className="form-field">
            <label className="form-label">Nivel de esfuerzo</label>
            <div className="effort-selector">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  className={`effort-btn${effort === n ? ` selected-${n}` : ''}`}
                  onClick={() => setEffort(n)}
                >
                  {EFFORT_LABELS[n]}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredientes */}
          <div className="form-field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="form-label">Ingredientes</label>
              <button
                className="ai-suggest-btn"
                onClick={handleAiSuggest}
                disabled={aiLoading || !dishName.trim()}
              >
                <Sparkles size={13} />
                {aiLoading ? 'Consultando IA…' : 'Sugerir con IA'}
              </button>
            </div>

            {aiLoading && (
              <div className="ai-loading">
                <div className="spinner" />
                <span>Gemini está eligiendo ingredientes…</span>
              </div>
            )}

            {mode === 'add' && savedIds.length > 0 && (
              <div className="saved-ingredients-hint">
                ✓ {savedIds.length} ingrediente{savedIds.length !== 1 ? 's' : ''} guardado{savedIds.length !== 1 ? 's' : ''} de esta receta.
                Desmarca los que ya tengas en casa para que no vayan a la lista de la compra.
              </div>
            )}

            <IngredientPicker
              ingredients={ingredients}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              usageCount={usageCount}
              onIngredientAdded={onIngredientAdded}
              onError={setError}
            >
              {aiNewSuggestions.length > 0 && (
                <div className="ai-new-section">
                  <span className="ai-new-label">✨ Sugeridos por IA — no están en tu lista</span>
                  {aiNewSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="chip chip-ai-new"
                      onClick={() => handleAddAiNew(name)}
                    >
                      <Plus size={11} />
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </IngredientPicker>
          </div>

          {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !dishName.trim()}
          >
            {saving ? 'Guardando…' : mode === 'edit' ? 'Actualizar' : 'Añadir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Popover ─────────────────────────────────────────────────────────────────

function IngredientPopover({ ingredient, slots, position }) {
  const dishNames = slots
    .filter((s) => s.ingredient_ids?.includes(ingredient.id))
    .map((s) => s.dish_name)

  if (!dishNames.length) return null

  return (
    <div className="popover" style={{ top: position.y + 12, left: position.x }}>
      <div className="popover-title">{ingredient.name}</div>
      {dishNames.map((name, i) => (
        <div key={i} className="popover-dish">• {name}</div>
      ))}
    </div>
  )
}

// ─── ShoppingHistoryModal ────────────────────────────────────────────────────

function ShoppingHistoryModal({ history, onClose }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Historial de compras</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="history-list">
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              No hay listas guardadas aún.
            </p>
          ) : (
            history.map((entry) => {
              const isOpen = expanded === entry.id
              const date = new Date(entry.saved_at).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })
              const total = entry.items?.reduce((acc, cat) => acc + (cat.items?.length || 0), 0) || 0
              return (
                <div key={entry.id} className="history-entry">
                  <button
                    className="history-entry-header"
                    onClick={() => setExpanded(isOpen ? null : entry.id)}
                  >
                    <div>
                      <div className="history-entry-date">{date}</div>
                      <div className="history-entry-meta">{total} ingredientes · semana {entry.week_key}</div>
                    </div>
                    <span className="history-entry-toggle">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="history-entry-body">
                      {(entry.items || []).map((cat) => (
                        <div key={cat.category} className="history-cat">
                          <div className="history-cat-title">{cat.category}</div>
                          {cat.items.map((item) => (
                            <div key={item.id} className="history-cat-item">
                              • {item.name}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ─── RecipePostit ─────────────────────────────────────────────────────────────

function RecipePostit({ item, onUpdate, onDelete, onSelect, onOpenDetail, onCart, onPlan, ingredients = [], savedIds = [], usageCount = 0 }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: `recipe-${item.id}` })
  const [editing, setEditing] = useState(!item.name)
  const [draft, setDraft] = useState(item.name)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState(item.description || '')
  const [tagInput, setTagInput] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => { setNotesDraft(item.description || '') }, [item.description])

  const category = item.type || getDominantCategory(savedIds, ingredients, item.name)
  const bgColor = category ? (CATEGORY_PASTELS[category] ?? CATEGORY_PASTELS['Otros']) : CATEGORY_PASTELS['Otros']
  const rotation = slotRotation(item.id)
  const style = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    '--base-rotate': `${rotation}deg`,
    background: bgColor,
    opacity: isDragging ? 0.4 : 1,
  }

  function commitEdit() {
    const trimmed = draft.trim()
    if (!trimmed) { onDelete(); return }
    setEditing(false)
    if (trimmed !== item.name) onUpdate({ name: trimmed })
  }

  function setRating(r) {
    onUpdate({ rating: item.rating === r ? null : r })
  }

  function commitNotes() {
    const trimmed = notesDraft.trim()
    const current = item.description || ''
    if (trimmed !== current) onUpdate({ description: trimmed || null })
  }

  function addTag() {
    const trimmed = tagInput.trim().toLowerCase()
    if (!trimmed) return
    const current = item.tags || []
    if (!current.includes(trimmed)) onUpdate({ tags: [...current, trimmed] })
    setTagInput('')
  }

  function removeTag(tag) {
    onUpdate({ tags: (item.tags || []).filter((t) => t !== tag) })
  }

  const tags = item.tags || []
  const hasNotes = !!item.description

  return (
    <div ref={setNodeRef} style={style} className="postit pool-postit recipe-postit">
      <div className="postit-header">
        {editing ? (
          <input
            ref={inputRef}
            className="pool-name-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); else if (e.key === 'Escape') onDelete() }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="postit-name"
            style={{ cursor: 'pointer' }}
            onDoubleClick={() => setEditing(true)}
            onClick={() => onSelect?.()}
            title="Clic para usar · doble clic para editar"
          >
            {item.name ? titleCase(item.name) : <em style={{ opacity: 0.5 }}>sin nombre</em>}
          </span>
        )}
        <div className="postit-actions">
          <button className="postit-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => setEditing(true)} title="Editar nombre">
            <Pencil size={11} />
          </button>
          <button className="postit-btn delete" onPointerDown={(e) => e.stopPropagation()} onClick={onDelete}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      <div className="recipe-star-row" onPointerDown={(e) => e.stopPropagation()}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`recipe-star${(item.rating || 0) >= n ? ' active' : ''}`}
            onClick={() => setRating(n)}
            title={`${n} estrella${n > 1 ? 's' : ''}`}
          >★</button>
        ))}
        {item.time_min ? <span className="recipe-meta" title="Tiempo de preparación">⏱{item.time_min}'</span> : null}
        {item.light === 'ligero' ? <span className="recipe-meta" title="Ligero">🥗</span> : null}
        {usageCount > 0 && <span className="recipe-usage">{usageCount}×</span>}
      </div>

      {tags.length > 0 && (
        <div className="recipe-tags-row" onPointerDown={(e) => e.stopPropagation()}>
          {tags.map((tag) => (
            <span key={tag} className="recipe-tag">
              {tag}
              <button className="recipe-tag-remove" onClick={() => removeTag(tag)}>×</button>
            </span>
          ))}
        </div>
      )}

      {!notesOpen && hasNotes && (
        <div
          className="recipe-notes-preview"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setNotesOpen(true)}
          title="Ver notas"
        >
          {item.description}
        </div>
      )}

      {notesOpen && (
        <div onPointerDown={(e) => e.stopPropagation()}>
          <textarea
            className="recipe-notes-input"
            placeholder="Notas, trucos, ingredientes clave…"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={commitNotes}
            rows={3}
          />
          <div className="recipe-tag-input-row">
            <input
              className="recipe-tag-input"
              placeholder="Etiqueta…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            />
            <button className="recipe-tag-add-btn" onClick={addTag}>+</button>
          </div>
        </div>
      )}

      <div className="postit-footer">
        <div className="recipe-footer-btns">
          <button
            className={`postit-btn${hasNotes || notesOpen ? ' notes-active' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setNotesOpen((o) => !o)}
            title={notesOpen ? 'Cerrar notas' : 'Notas y etiquetas'}
          >
            <Tag size={11} />
          </button>
          <button className="postit-btn plan-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => onPlan?.()} title="Añadir al menú">
            <CalendarPlus size={12} />
          </button>
          <button
            className={`postit-btn${item.steps ? ' notes-active' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onOpenDetail?.()}
            title="Tipo, pasos e ingredientes"
          >
            <BookOpen size={11} />
          </button>
          {savedIds.length > 0 && (
            <button
              className="postit-btn recipe-cart-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onCart?.()}
              title={`Añadir sus ${savedIds.length} ingredientes a la compra`}
            >
              <ShoppingCart size={11} />
              <span>{savedIds.length}</span>
            </button>
          )}
        </div>
        <div ref={setActivatorNodeRef} {...listeners} {...attributes} className="drag-handle" title="Arrastrar al tablero">
          <GripVertical size={12} />
        </div>
      </div>
    </div>
  )
}

// ─── RecipeDetailModal ─────────────────────────────────────────────────────────

// Ingredientes guardados de un plato: el primer nivel de esfuerzo que tenga alguno
function savedIngredientIds(dishIngMap, name, preferredEffort) {
  const byEffort = dishIngMap[(name || '').trim().toLowerCase()] || {}
  if (preferredEffort && byEffort[preferredEffort]?.length) return byEffort[preferredEffort]
  for (const e of [1, 2, 3]) if (byEffort[e]?.length) return byEffort[e]
  return []
}

function RecipeDetailModal({ recipe, ingredients, dishIngMap, onClose, onSave, onIngredientAdded, onCart }) {
  const [effort, setEffort] = useState(() => {
    const byEffort = dishIngMap[(recipe.name || '').trim().toLowerCase()] || {}
    return [1, 2, 3].find((e) => byEffort[e]?.length) || 1
  })
  const [selectedIds, setSelectedIds] = useState(() => savedIngredientIds(dishIngMap, recipe.name))
  const [type, setType] = useState(recipe.type || '')
  const [steps, setSteps] = useState(recipe.steps || '')
  const [timeMin, setTimeMin] = useState(recipe.time_min || null)
  const [light, setLight] = useState(recipe.light || '')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const autoType = getDominantCategory(selectedIds, ingredients, recipe.name)

  const changeEffort = (n) => {
    setEffort(n)
    setSelectedIds(dishIngMap[(recipe.name || '').trim().toLowerCase()]?.[n] || [])
  }

  const handleAiSteps = async () => {
    setAiLoading(true)
    setError(null)
    try {
      setSteps(await callGeminiRecipe(recipe.name))
    } catch (e) {
      setError('Error al contactar la IA: ' + e.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ recipe, effort, ingredientIds: selectedIds, type, steps, timeMin, light })
      onClose()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>📖 {titleCase(recipe.name)}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {/* Tipo de plato */}
          <div className="form-field">
            <label className="form-label">Tipo de plato</label>
            <div className="type-selector">
              <button
                type="button"
                className={`type-btn${type === '' ? ' selected' : ''}`}
                onClick={() => setType('')}
              >
                ✨ Automático{autoType && type === '' ? `: ${FOOD_TYPES.find((f) => f.key === autoType)?.label || autoType}` : ''}
              </button>
              {FOOD_TYPES.map((ft) => (
                <button
                  key={ft.key}
                  type="button"
                  className={`type-btn${type === ft.key ? ' selected' : ''}`}
                  style={type === ft.key ? { background: CATEGORY_PASTELS[ft.key], borderColor: CATEGORY_COLORS[ft.key] } : {}}
                  onClick={() => setType(ft.key)}
                >
                  {ft.emoji} {ft.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tiempo y ligereza */}
          <div className="form-field">
            <label className="form-label">Tiempo y ligereza</label>
            <div className="type-selector" style={{ marginBottom: 8 }}>
              {[[15, '⚡ 15 min'], [30, '30 min'], [45, '45 min'], [60, '1 h o más']].map(([n, label]) => (
                <button key={n} type="button" className={`type-btn${timeMin === n ? ' selected' : ''}`} onClick={() => setTimeMin(timeMin === n ? null : n)}>{label}</button>
              ))}
            </div>
            <div className="type-selector">
              {[['ligero', '🥗 Ligero'], ['equilibrado', '⚖️ Equilibrado'], ['contundente', '🍖 Contundente']].map(([k, label]) => (
                <button key={k} type="button" className={`type-btn${light === k ? ' selected' : ''}`} onClick={() => setLight(light === k ? '' : k)}>{label}</button>
              ))}
            </div>
          </div>

          {/* Ingredientes */}
          <div className="form-field">
            <label className="form-label">Ingredientes guardados</label>
            <div className="effort-selector" style={{ marginBottom: 8 }}>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`effort-btn${effort === n ? ` selected-${n}` : ''}`}
                  onClick={() => changeEffort(n)}
                >
                  {EFFORT_LABELS[n]}
                </button>
              ))}
            </div>
            <IngredientPicker
              ingredients={ingredients}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              onIngredientAdded={onIngredientAdded}
              onError={setError}
            />
          </div>

          {/* Pasos */}
          <div className="form-field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="form-label">Pasos</label>
              <button type="button" className="ai-suggest-btn" onClick={handleAiSteps} disabled={aiLoading}>
                <Sparkles size={13} />
                {aiLoading ? 'Consultando IA…' : 'Generar con IA'}
              </button>
            </div>
            <textarea
              className="recipe-steps-input"
              placeholder={'1. Sofreír la cebolla\n2. Añadir el arroz…'}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={6}
            />
          </div>

          {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-ghost"
            onClick={() => onCart(recipe, selectedIds)}
            disabled={selectedIds.length === 0}
            title="Elegir qué ingredientes añadir a la lista de la compra"
          >
            <ShoppingCart size={14} /> Al carrito
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── RecipeCartModal ───────────────────────────────────────────────────────────

function RecipeCartModal({ recipe, ingredientIds, ingredients, onClose, onConfirm }) {
  const items = ingredientIds
    .map((id) => ingredients.find((i) => i.id === id))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const [checked, setChecked] = useState(() => new Set(items.map((i) => i.id)))

  const toggle = (id) => setChecked((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>🛒 {titleCase(recipe.name)}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            Elige qué ingredientes añadir a la lista de la compra de esta semana. Desmarca los que ya tengas.
          </p>
          {items.length === 0 ? (
            <p style={{ fontSize: 13 }}>Esta receta aún no tiene ingredientes guardados.</p>
          ) : (
            <div className="cart-ingredient-list">
              {items.map((ing) => (
                <label key={ing.id} className="cart-ingredient">
                  <input type="checkbox" checked={checked.has(ing.id)} onChange={() => toggle(ing.id)} />
                  <span>{titleCase(ing.name)}</span>
                  <span className="cart-ingredient-cat">{ing.category}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            disabled={checked.size === 0}
            onClick={() => onConfirm(items.filter((i) => checked.has(i.id)))}
          >
            Añadir {checked.size} a la compra
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AutoMenuModal ─────────────────────────────────────────────────────────────

const AUTO_MENU_DEFAULTS = {
  slots: { lunch: true, dinner: true },
  days: [true, true, true, true, true, true, true],
  fromPool: true,
  fromRecipes: true,
  tag: '',
  minRating: 0,
  preferRated: true,
  preferNovel: true,
  avoidSameType: true,
  balanceTypes: true,
  noRepeat: true,
  maxTime: null,
  onlyLight: false,
  fewIngredients: false,
  types: [],
  pantryMode: 'prefer',
}

function loadAutoMenuOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem('autoMenuOptions') || 'null')
    return saved ? { ...AUTO_MENU_DEFAULTS, ...saved, slots: { ...AUTO_MENU_DEFAULTS.slots, ...saved.slots } } : AUTO_MENU_DEFAULTS
  } catch {
    return AUTO_MENU_DEFAULTS
  }
}

function AutoMenuModal({
  slots, allSlots, poolItems, savedRecipes, ingredients, dishIngMap, allTags, availableIds = [],
  weekKey, nextWeekKey, startDayOfWeek, onClose, onConfirm, onOpenRecipe, hidden = false, tabs = null,
}) {
  const [opts, setOptsRaw] = useState(loadAutoMenuOptions)
  const isMobile = useIsMobile()
  const [showOpts, setShowOpts] = useState(false)
  const [sheetKey, setSheetKey] = useState(null)
  const [swapQuery, setSwapQuery] = useState('')
  const [swapping, setSwapping] = useState(false)
  const [avail, setAvail] = useState([])
  const [showAvail, setShowAvail] = useState(false)
  const setOpts = (patch) => setOptsRaw((o) => {
    const next = { ...o, ...patch }
    try { localStorage.setItem('autoMenuOptions', JSON.stringify(next)) } catch {}
    return next
  })

  const recipeByName = useMemo(() => {
    const m = new Map()
    for (const r of savedRecipes) if (r.name) m.set(r.name.trim().toLowerCase(), r)
    return m
  }, [savedRecipes])

  // Última vez que se usó cada plato (para priorizar los que hace más que no se repiten)
  const lastUsed = useMemo(() => {
    const m = {}
    for (const s of allSlots) {
      if (!s.dish_name || s.dish_name === '?') continue
      const t = getDayDate(s.week_key, s.day_idx).getTime()
      const k = s.dish_name.trim().toLowerCase()
      if (!m[k] || t > m[k]) m[k] = t
    }
    return m
  }, [allSlots])

  const typeOf = (name) => {
    const r = recipeByName.get(name.trim().toLowerCase())
    return r?.type || getDominantCategory(savedIngredientIds(dishIngMap, name), ingredients, name)
  }

  const candidates = useMemo(() => {
    const m = new Map()
    const add = (name) => {
      const k = (name || '').trim().toLowerCase()
      if (k && !m.has(k)) m.set(k, name.trim())
    }
    if (opts.fromPool) poolItems.forEach((p) => add(p.dish_name))
    if (opts.fromRecipes) savedRecipes.forEach((r) => add(r.name))
    return [...m.entries()]
      .filter(([k, name]) => {
        const r = recipeByName.get(k)
        if (opts.tag && !(r?.tags || []).includes(opts.tag)) return false
        if (opts.minRating && (r?.rating || 0) < opts.minRating) return false
        if (opts.maxTime && !(r?.time_min && r.time_min <= opts.maxTime)) return false
        if (opts.onlyLight && r?.light !== 'ligero') return false
        if (opts.fewIngredients) {
          const n = savedIngredientIds(dishIngMap, name).length
          if (!(n >= 1 && n <= 6)) return false
        }
        if (opts.types.length && !opts.types.includes(typeOf(name))) return false
        if (avail.length && opts.pantryMode === 'only') {
          if (!savedIngredientIds(dishIngMap, name).some((id) => avail.includes(id))) return false
        }
        return true
      })
      .map(([, name]) => name)
  }, [opts.fromPool, opts.fromRecipes, opts.tag, opts.minRating, opts.maxTime, opts.onlyLight, opts.fewIngredients, opts.types, opts.pantryMode, avail, dishIngMap, poolItems, savedRecipes, recipeByName])

  const cellKey = (i, slotKey) => `${i}-${slotKey}`

  // Genera propuestas: lo que ya está en el tablero y lo que el usuario ha elegido (✓) se mantiene;
  // solo se vuelven a sortear las celdas no elegidas.
  function generate(prev = {}) {
    const result = {}
    const used = new Set()
    const typeCount = {}
    const countType = (name) => {
      const t = typeOf(name)
      if (t && !ALERT_EXCLUDED.has(t)) typeCount[t] = (typeCount[t] || 0) + 1
    }

    // 1) fijar lo existente y lo elegido
    for (let i = 0; i < 7; i++) {
      for (const slot of SLOTS) {
        const absIdx = (startDayOfWeek + i) % 7
        const colWk = startDayOfWeek + i >= 7 ? nextWeekKey : weekKey
        const existing = slots.find((s) => s.day_idx === absIdx && s.slot_key === slot.key && s.week_key === colWk)
        const k = cellKey(i, slot.key)
        if (existing) {
          result[k] = { dishName: existing.dish_name, isExisting: true, selected: false }
        } else if (prev[k]?.selected) {
          result[k] = { ...prev[k] }
        } else continue
        used.add(result[k].dishName.trim().toLowerCase())
        countType(result[k].dishName)
      }
    }

    // 2) rellenar el resto
    const now = Date.now()
    for (let i = 0; i < 7; i++) {
      if (!opts.days[i]) continue
      for (const slot of SLOTS) {
        const k = cellKey(i, slot.key)
        if (result[k] || !opts.slots[slot.key]) continue
        const neighbours = [
          result[cellKey(i - 1, slot.key)],
          result[cellKey(i, SLOTS.find((s) => s.key !== slot.key).key)],
        ].filter(Boolean).map((c) => typeOf(c.dishName))

        let best = null
        let bestScore = -Infinity
        for (const name of candidates) {
          const key = name.toLowerCase()
          if (opts.noRepeat && used.has(key)) continue
          const t = typeOf(name)
          const countable = t && !ALERT_EXCLUDED.has(t)
          let score = Math.random()
          if (opts.preferRated) {
            const rating = recipeByName.get(key)?.rating
            if (rating) score += (rating - 3) * 0.4
          }
          if (opts.preferNovel) {
            const days = lastUsed[key] ? (now - lastUsed[key]) / 86400000 : 60
            score += Math.min(days, 60) / 60 * 1.5
          }
          if (avail.length && opts.pantryMode !== 'ignore') {
            const overlap = savedIngredientIds(dishIngMap, name).filter((id) => avail.includes(id)).length
            score += Math.min(overlap, 3) * 1.2
          }
          if (opts.avoidSameType && countable && neighbours.includes(t)) score -= 3
          if (opts.balanceTypes && countable) score -= 0.8 * (typeCount[t] || 0)
          if (score > bestScore) { bestScore = score; best = name }
        }
        if (best) {
          result[k] = { dishName: best, isExisting: false, selected: false }
          used.add(best.toLowerCase())
          countType(best)
        }
      }
    }
    return result
  }

  const [proposals, setProposals] = useState(() => generate())

  // Al cambiar los ajustes se vuelven a sortear las propuestas no elegidas
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    setProposals((p) => generate(p))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, avail])

  const entries = Object.entries(proposals)
  const proposed = entries.filter(([, p]) => !p.isExisting)
  const selectedCount = proposed.filter(([, p]) => p.selected).length

  const toggleSelected = (k) => setProposals((p) => ({ ...p, [k]: { ...p[k], selected: !p[k].selected } }))
  const setAllSelected = (value) => setProposals((p) => Object.fromEntries(
    Object.entries(p).map(([k, v]) => [k, v.isExisting ? v : { ...v, selected: value }])
  ))
  const removeCell = (k) => { setProposals((p) => { const n = { ...p }; delete n[k]; return n }); setSheetKey(null) }
  const rerollCell = (k) => {
    setProposals((p) => {
      const rest = { ...p }
      delete rest[k]
      const fresh = generate(rest)
      return fresh[k] ? { ...p, [k]: fresh[k] } : p
    })
  }
  const swapCell = (k, name) => {
    setProposals((p) => ({ ...p, [k]: { dishName: name, isExisting: false, selected: true } }))
    setSwapping(false)
    setSwapQuery('')
  }

  const swapOptions = useMemo(() => {
    const q = normalizeText(swapQuery).trim()
    const all = [...new Set([...poolItems.map((p) => p.dish_name), ...savedRecipes.map((r) => r.name)].filter(Boolean).map((n) => n.trim()))]
    return all.filter((n) => !q || normalizeText(n).includes(q)).sort((a, b) => a.localeCompare(b, 'es')).slice(0, 30)
  }, [swapQuery, poolItems, savedRecipes])

  // Celda de propuesta (día + comida): la comparten la cuadrícula de escritorio y la lista por días del móvil
  const renderProposalCell = (i, slot) => {
                  const k = cellKey(i, slot.key)
                  const entry = proposals[k]
                  if (!entry) return <div key={k} className="auto-menu-cell empty">—</div>
                  const cat = entry.isExisting ? null : typeOf(entry.dishName)
                  const bg = !entry.isExisting ? (CATEGORY_PASTELS[cat] ?? CATEGORY_PASTELS['Otros']) : undefined
                  return (
                    <div
                      key={k}
                      className={`auto-menu-cell${entry.isExisting ? ' existing' : ' proposed'}${entry.selected ? ' chosen' : ''}${sheetKey === k ? ' open' : ''}`}
                      style={bg ? { background: bg } : {}}
                      onClick={() => { setSheetKey(sheetKey === k ? null : k); setSwapping(false) }}
                      title="Ver la receta"
                    >
                      {!entry.isExisting && (
                        <input
                          type="checkbox"
                          className="auto-cell-check"
                          checked={entry.selected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelected(k)}
                          title="Elegir: se guarda en el menú y no se vuelve a sortear"
                        />
                      )}
                      <span>{titleCase(entry.dishName)}</span>
                    </div>
                  )
  }

  const sheet = sheetKey ? proposals[sheetKey] : null
  const sheetRecipe = sheet ? recipeByName.get(sheet.dishName.trim().toLowerCase()) : null
  const sheetIngredients = sheet
    ? savedIngredientIds(dishIngMap, sheet.dishName).map((id) => ingredients.find((i) => i.id === id)).filter(Boolean)
    : []
  const sheetType = sheet ? typeOf(sheet.dishName) : null

  return (
    <div className="modal-backdrop" style={hidden ? { display: 'none' } : undefined} onClick={onClose}>
      <div className="modal auto-menu-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {tabs || <h2>Sugerencia de semana</h2>}
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="auto-menu-toolbar">
            <button className={`auto-menu-opts-btn${showOpts ? ' active' : ''}`} onClick={() => setShowOpts((v) => !v)}>
              ⚙️ Ajustes {showOpts ? '▴' : '▾'}
            </button>
            <span className="auto-menu-count">{candidates.length} platos disponibles</span>
            <span style={{ flex: 1 }} />
            <button className="auto-menu-link" onClick={() => setAllSelected(true)}>Elegir todo</button>
            <button className="auto-menu-link" onClick={() => setAllSelected(false)}>Ninguno</button>
          </div>

          {showOpts && (
            <div className="auto-menu-opts">
              <div className="auto-opt-group">
                <span className="auto-opt-title">Atajos</span>
                <button className="auto-day-chip" onClick={() => setOpts({ maxTime: 15, onlyLight: false })}>⚡ Rápidas</button>
                <button className="auto-day-chip" onClick={() => setOpts({ onlyLight: true, maxTime: null })}>🥗 Ligeras</button>
                <button className="auto-day-chip" onClick={() => { setAvail(availableIds); setOpts({ pantryMode: 'prefer' }) }}>🧊 Con lo que tengo</button>
                <button className="auto-day-chip" onClick={() => { setAvail([]); setOpts({ maxTime: null, onlyLight: false, fewIngredients: false, types: [], tag: '', minRating: 0 }) }}>Limpiar filtros</button>
              </div>
              <div className="auto-opt-group">
                <span className="auto-opt-title">Tiempo</span>
                {[[15, '⚡ ≤ 15 min'], [30, '≤ 30 min'], [45, '≤ 45 min']].map(([n, label]) => (
                  <button key={n} className={`auto-day-chip${opts.maxTime === n ? ' on' : ''}`} onClick={() => setOpts({ maxTime: opts.maxTime === n ? null : n })}>{label}</button>
                ))}
                <label className="auto-opt-check"><input type="checkbox" checked={opts.onlyLight} onChange={(e) => setOpts({ onlyLight: e.target.checked })} />Solo ligeras</label>
                <label className="auto-opt-check"><input type="checkbox" checked={opts.fewIngredients} onChange={(e) => setOpts({ fewIngredients: e.target.checked })} />Pocos ingredientes (≤ 6)</label>
              </div>
              <div className="auto-opt-group">
                <span className="auto-opt-title">Tipo</span>
                {FOOD_TYPES.map((ft) => (
                  <button
                    key={ft.key}
                    className={`auto-day-chip${opts.types.includes(ft.key) ? ' on' : ''}`}
                    onClick={() => setOpts({ types: opts.types.includes(ft.key) ? opts.types.filter((t) => t !== ft.key) : [...opts.types, ft.key] })}
                  >
                    {ft.emoji} {ft.label}
                  </button>
                ))}
              </div>
              <div className="auto-opt-group">
                <span className="auto-opt-title">Ingredientes</span>
                {availableIds.length > 0 && (
                  <button className="auto-day-chip" onClick={() => setAvail(availableIds)}>🧊 Mi despensa ({availableIds.length})</button>
                )}
                <button className={`auto-day-chip${showAvail ? ' on' : ''}`} onClick={() => setShowAvail((v) => !v)}>
                  Elegir{avail.length ? ` (${avail.length})` : ''}
                </button>
                {avail.length > 0 && (
                  <>
                    <select className="auto-opt-select" value={opts.pantryMode} onChange={(e) => setOpts({ pantryMode: e.target.value })}>
                      <option value="prefer">Priorizar los que usen estos</option>
                      <option value="only">Solo los que usen estos</option>
                      <option value="ignore">Ignorar</option>
                    </select>
                    <button className="auto-menu-link" onClick={() => setAvail([])}>Quitar</button>
                  </>
                )}
              </div>
              {showAvail && (
                <IngredientPicker
                  ingredients={ingredients}
                  selectedIds={avail}
                  onChange={setAvail}
                  onIngredientAdded={() => {}}
                  onError={() => {}}
                />
              )}
              <div className="auto-opt-group">
                <span className="auto-opt-title">Rellenar</span>
                {SLOTS.map((s) => (
                  <label key={s.key} className="auto-opt-check">
                    <input type="checkbox" checked={opts.slots[s.key]} onChange={(e) => setOpts({ slots: { ...opts.slots, [s.key]: e.target.checked } })} />
                    {s.label}
                  </label>
                ))}
              </div>
              <div className="auto-opt-group">
                <span className="auto-opt-title">Días</span>
                {Array.from({ length: 7 }, (_, i) => (
                  <button
                    key={i}
                    className={`auto-day-chip${opts.days[i] ? ' on' : ''}`}
                    onClick={() => setOpts({ days: opts.days.map((d, j) => (j === i ? !d : d)) })}
                  >
                    {DAYS[(startDayOfWeek + i) % 7].slice(0, 3)}
                  </button>
                ))}
              </div>
              <div className="auto-opt-group">
                <span className="auto-opt-title">Elegir entre</span>
                <label className="auto-opt-check"><input type="checkbox" checked={opts.fromPool} onChange={(e) => setOpts({ fromPool: e.target.checked })} />Mi despensa</label>
                <label className="auto-opt-check"><input type="checkbox" checked={opts.fromRecipes} onChange={(e) => setOpts({ fromRecipes: e.target.checked })} />Recetas</label>
                {allTags.length > 0 && (
                  <select className="auto-opt-select" value={opts.tag} onChange={(e) => setOpts({ tag: e.target.value })}>
                    <option value="">Cualquier etiqueta</option>
                    {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                <select className="auto-opt-select" value={opts.minRating} onChange={(e) => setOpts({ minRating: Number(e.target.value) })}>
                  <option value={0}>Cualquier valoración</option>
                  <option value={3}>★ 3 o más</option>
                  <option value={4}>★ 4 o más</option>
                  <option value={5}>★ 5</option>
                </select>
              </div>
              <div className="auto-opt-group">
                <span className="auto-opt-title">Criterios</span>
                <label className="auto-opt-check"><input type="checkbox" checked={opts.noRepeat} onChange={(e) => setOpts({ noRepeat: e.target.checked })} />No repetir platos en la semana</label>
                <label className="auto-opt-check"><input type="checkbox" checked={opts.avoidSameType} onChange={(e) => setOpts({ avoidSameType: e.target.checked })} />Evitar el mismo tipo seguido</label>
                <label className="auto-opt-check"><input type="checkbox" checked={opts.balanceTypes} onChange={(e) => setOpts({ balanceTypes: e.target.checked })} />Equilibrar tipos de plato</label>
                <label className="auto-opt-check"><input type="checkbox" checked={opts.preferRated} onChange={(e) => setOpts({ preferRated: e.target.checked })} />Priorizar las mejor valoradas</label>
                <label className="auto-opt-check"><input type="checkbox" checked={opts.preferNovel} onChange={(e) => setOpts({ preferNovel: e.target.checked })} />Priorizar las que hace más que no comes</label>
              </div>
            </div>
          )}

          {isMobile ? (
            <div className="auto-days">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="auto-day-row">
                  <div className="auto-day-label">
                    <strong>{DAYS[(startDayOfWeek + i) % 7].slice(0, 3)}</strong>
                    <span>{getDayDate(weekKey, startDayOfWeek + i).getDate()}</span>
                  </div>
                  {SLOTS.map((slot) => (
                    <div key={slot.key} className="auto-day-cell">
                      <span className="auto-day-slot">{slot.label}</span>
                      {renderProposalCell(i, slot)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
          <div className="auto-menu-grid">
            <div className="auto-menu-corner" />
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="auto-menu-col-header">
                {DAYS[(startDayOfWeek + i) % 7].slice(0, 3)}
              </div>
            ))}
            {SLOTS.map((slot) => (
              <React.Fragment key={slot.key}>
                <div className="auto-menu-row-label">{slot.label}</div>
                {Array.from({ length: 7 }, (_, i) => renderProposalCell(i, slot))}
              </React.Fragment>
            ))}
          </div>
          )}

          {entries.length === 0 && (
            <p className="auto-menu-empty">No hay platos con estos ajustes. Añade platos a la despensa o a las recetas, o relaja los filtros.</p>
          )}
          <p className="auto-menu-note">
            Marca ☑ los platos que quieras: solo esos se guardan en el menú y no cambian al re-generar.
            Pulsa un plato para ver su receta.
          </p>

          {sheet && (
            <div className="auto-sheet">
              <div className="auto-sheet-head">
                <strong>{titleCase(sheet.dishName)}</strong>
                {sheetType && (
                  <span className="auto-sheet-type" style={{ background: CATEGORY_PASTELS[sheetType] }}>
                    {FOOD_TYPES.find((f) => f.key === sheetType)?.label || sheetType}
                  </span>
                )}
                {sheet.isExisting && <span className="auto-sheet-type">ya en el menú</span>}
                {sheetRecipe?.rating ? <span className="auto-sheet-stars">{'★'.repeat(sheetRecipe.rating)}</span> : null}
                <button className="auto-menu-link" style={{ marginLeft: 'auto' }} onClick={() => setSheetKey(null)}>Cerrar</button>
              </div>

              {sheetIngredients.length > 0 ? (
                <div className="auto-sheet-section">
                  <span className="auto-sheet-label">Ingredientes</span>
                  <div className="auto-sheet-chips">
                    {sheetIngredients.map((ing) => <span key={ing.id} className="auto-sheet-chip">{titleCase(ing.name)}</span>)}
                  </div>
                </div>
              ) : (
                <p className="auto-sheet-muted">Sin ingredientes guardados todavía.</p>
              )}
              {sheetRecipe?.steps && (
                <div className="auto-sheet-section">
                  <span className="auto-sheet-label">Pasos</span>
                  <p className="auto-sheet-text">{sheetRecipe.steps}</p>
                </div>
              )}
              {sheetRecipe?.description && (
                <div className="auto-sheet-section">
                  <span className="auto-sheet-label">Notas</span>
                  <p className="auto-sheet-text">{sheetRecipe.description}</p>
                </div>
              )}

              <div className="auto-sheet-actions">
                <button className="btn btn-ghost" onClick={() => onOpenRecipe(sheet.dishName)}>
                  <Pencil size={13} /> {sheetRecipe ? 'Editar receta' : 'Crear receta'}
                </button>
                {!sheet.isExisting && (
                  <>
                    <button className="btn btn-ghost" onClick={() => setSwapping((v) => !v)}>Cambiar por…</button>
                    <button className="btn btn-ghost" onClick={() => rerollCell(sheetKey)}><RotateCcw size={13} /> Otro al azar</button>
                    <button className="btn btn-ghost" onClick={() => removeCell(sheetKey)}>Quitar</button>
                  </>
                )}
              </div>

              {swapping && !sheet.isExisting && (
                <div className="auto-swap">
                  <input
                    className="form-input"
                    placeholder="Buscar plato o receta…"
                    value={swapQuery}
                    onChange={(e) => setSwapQuery(e.target.value)}
                    autoFocus
                  />
                  <div className="auto-swap-list">
                    {swapOptions.map((n) => (
                      <button key={n} className="autocomplete-item" onClick={() => swapCell(sheetKey, n)}>{titleCase(n)}</button>
                    ))}
                    {swapOptions.length === 0 && <span className="auto-sheet-muted">Sin resultados</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setProposals((p) => generate(p))}>
            <RotateCcw size={14} /> Re-generar
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            disabled={selectedCount === 0}
            onClick={() => onConfirm(
              proposed.filter(([, p]) => p.selected).map(([k, p]) => {
                const [day, ...rest] = k.split('-')
                return { displayDay: Number(day), slotKey: rest.join('-'), dishName: p.dishName }
              })
            )}
          >
            Guardar {selectedCount || ''} {selectedCount === 1 ? 'elegido' : 'elegidos'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Despensa: platos e ingredientes disponibles ──────────────────────────────

const PANTRY_LOCATIONS = [
  { key: 'freezer', label: 'Congelador', emoji: '🧊' },
  { key: 'fridge', label: 'Nevera', emoji: '❄️' },
  { key: 'pantry', label: 'Despensa', emoji: '🥫' },
]

function PantryModal({ mode, item, ingredients, onClose, onSave, onIngredientAdded }) {
  const editing = !!item
  const [name, setName] = useState(item?.dish_name || '')
  const [selectedIds, setSelectedIds] = useState([])
  const [location, setLocation] = useState(item?.location || '')
  const [note, setNote] = useState(item?.note || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const pickingIngredients = mode === 'ingredient' && !editing
  const canSave = pickingIngredients ? selectedIds.length > 0 : name.trim().length > 0

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await onSave({ id: item?.id, mode, name: name.trim(), ingredientIds: selectedIds, location: location || null, note: note.trim() || null })
      onClose()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>
            {editing ? 'Editar' : mode === 'ingredient' ? '🥕 Ingredientes disponibles' : '🍲 Plato en la despensa'}
          </h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {pickingIngredients ? (
            <div className="form-field">
              <label className="form-label">¿Qué tienes?</label>
              <IngredientPicker
                ingredients={ingredients}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
                onIngredientAdded={onIngredientAdded}
                onError={setError}
              />
            </div>
          ) : (
            <div className="form-field">
              <label className="form-label">{mode === 'ingredient' ? 'Ingrediente' : 'Plato'}</label>
              <input
                className="form-input"
                value={name}
                disabled={mode === 'ingredient'}
                placeholder="Ej: Lasaña casera"
                onChange={(e) => setName(e.target.value)}
                autoFocus={mode === 'dish'}
              />
            </div>
          )}

          <div className="form-field">
            <label className="form-label">Dónde está</label>
            <div className="type-selector">
              {PANTRY_LOCATIONS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  className={`type-btn${location === l.key ? ' selected' : ''}`}
                  onClick={() => setLocation(location === l.key ? '' : l.key)}
                >
                  {l.emoji} {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Nota (opcional)</label>
            <input
              className="form-input"
              value={note}
              placeholder="Ej: 2 raciones, caduca el viernes…"
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            />
          </div>

          {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar' : pickingIngredients ? `Añadir ${selectedIds.length || ''}` : 'Añadir'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PantryIngredientChip({ item, ingredient, onEdit, onDelete }) {
  const loc = PANTRY_LOCATIONS.find((l) => l.key === item.location)
  const bg = CATEGORY_PASTELS[ingredient?.category] ?? CATEGORY_PASTELS['Otros']
  return (
    <div className="pantry-chip" style={{ background: bg }}>
      {loc && <span title={loc.label}>{loc.emoji}</span>}
      <button className="pantry-chip-name" onClick={onEdit} title="Editar">{titleCase(item.dish_name)}</button>
      {item.note && <span className="pantry-chip-note">{item.note}</span>}
      <button className="pantry-chip-x" onClick={onDelete} title="Quitar de la despensa"><X size={11} /></button>
    </div>
  )
}

// ─── PoolPostit ───────────────────────────────────────────────────────────────

function PoolPostit({ item, ingredients, onUpdate, onDelete, onContextMenu, onEditDetails, onPlan, typeOverride = null, savedIds = [] }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: `pool-${item.id}` })
  const [editing, setEditing] = useState(!item.dish_name)
  const [draft, setDraft] = useState(item.dish_name)
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const category = typeOverride || getDominantCategory(savedIds, ingredients, item.dish_name)
  const bgColor = category ? (CATEGORY_PASTELS[category] ?? CATEGORY_PASTELS['Otros']) : CATEGORY_PASTELS['Otros']
  const rotation = slotRotation(item.id)

  const style = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    '--base-rotate': `${rotation}deg`,
    background: bgColor,
    opacity: isDragging ? 0.4 : 1,
  }

  function commitEdit() {
    setEditing(false)
    onUpdate({ ...item, dish_name: draft.trim() || item.dish_name })
  }

  // Adapt pool item to the slot shape expected by context menu
  const slotLike = { id: item.id, dish_name: item.dish_name, ingredient_ids: [], isPool: true }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="postit pool-postit"
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, slotLike) }}
    >
      <div className="postit-header">
        {editing ? (
          <input
            ref={inputRef}
            className="pool-name-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit() }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="postit-name" onDoubleClick={() => setEditing(true)} title="Doble clic para editar">
            {item.dish_name ? titleCase(item.dish_name) : <em style={{ opacity: 0.5 }}>sin nombre</em>}
          </span>
        )}
        <div className="postit-actions">
          <button className="postit-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => onEditDetails?.()} title="Editar (nombre, dónde está, nota)">
            <Pencil size={11} />
          </button>
          <button className="postit-btn delete" onPointerDown={(e) => e.stopPropagation()} onClick={onDelete}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div className="postit-footer">
        {(item.location || item.note) ? (
          <span className="pool-loc" title={item.note || ''}>
            {PANTRY_LOCATIONS.find((l) => l.key === item.location)?.emoji} {item.note}
          </span>
        ) : <div />}
        <button className="postit-btn plan-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => onPlan?.()} title="Añadir al menú">
          <CalendarPlus size={14} />
        </button>
        <div ref={setActivatorNodeRef} {...listeners} {...attributes} className="drag-handle" title="Arrastrar al tablero">
          <GripVertical size={12} />
        </div>
      </div>
    </div>
  )
}

// ─── PostitContextMenu ────────────────────────────────────────────────────────

function PostitContextMenu({ menu, onOpen, onEdit, onDelete, onRecipe, onCopy, onMove, onSendToPool, onChangeType, onClose }) {
  const [showTypes, setShowTypes] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{
        top: Math.max(8, Math.min(menu.y, window.innerHeight - 300)),
        left: Math.max(8, Math.min(menu.x, window.innerWidth - 200)),
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!menu.isPool && (
        <button className="context-menu-item" onMouseDown={() => { onOpen(menu.slot); onClose() }}>
          <BookOpen size={13} /> Ver receta e ingredientes
        </button>
      )}
      {!menu.isPool && (
        <button className="context-menu-item" onMouseDown={() => { onEdit(menu.slot); onClose() }}>
          <Pencil size={13} /> Editar plato
        </button>
      )}
      <button className="context-menu-item" onMouseDown={() => { onRecipe(menu.slot); onClose() }}>
        <ChefHat size={13} /> Buscar receta IA
      </button>
      <button className="context-menu-item" onMouseDown={() => { onMove(menu.slot); onClose() }}>
        <ChevronRight size={13} /> Mover
      </button>
      {!menu.isPool && (
        <button className="context-menu-item" onMouseDown={() => { onCopy(menu.slot); onClose() }}>
          <Copy size={13} /> Copiar
        </button>
      )}
      {!menu.isPool && (
        <button className="context-menu-item" onMouseDown={() => { onSendToPool(menu.slot); onClose() }}>
          <ChevronLeft size={13} /> Mover a la despensa
        </button>
      )}
      <div style={{ position: 'relative' }}>
        <button
          className="context-menu-item"
          onMouseDown={() => setShowTypes((v) => !v)}
        >
          <Palette size={13} /> Cambiar tipo ▸
        </button>
        {showTypes && (
          <div className="context-submenu">
            {FOOD_TYPES.map((ft) => (
              <button
                key={ft.key}
                className="context-menu-item"
                onMouseDown={() => { onChangeType(menu.slot.id, ft.key); onClose() }}
              >
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[ft.key], marginRight: 6 }} />
                {ft.emoji} {ft.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {!menu.isPool && (
        <button className="context-menu-item context-menu-danger" onMouseDown={() => { onDelete(menu.slot); onClose() }}>
          <Trash2 size={13} /> Eliminar del menú
        </button>
      )}
    </div>
  )
}

// ─── RecipeModal ──────────────────────────────────────────────────────────────

function RecipeModal({ slot, onClose }) {
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    callGeminiRecipe(slot.dish_name)
      .then(setContent)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slot.dish_name])

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>🍳 {slot.dish_name}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="ai-loading"><div className="spinner" />Consultando IA…</div>
          ) : error ? (
            <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>
          ) : (
            <div className="recipe-content">
              {content.split('\n').filter(Boolean).map((line, i) => (
                <p key={i} style={{ marginBottom: 8, lineHeight: 1.6 }}>{line}</p>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ─── LoginScreen ─────────────────────────────────────────────────────────────

function LoginScreen() {
  const [username, setUsername] = useState(() => { try { return localStorage.getItem('lastUsername') || '' } catch { return '' } })
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const uname = username.trim().toLowerCase()
      const email = `${uname}@pizarra.app`
      let { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) {
        // Usuario aún no migrado desde el login antiguo: la función lo migra si la contraseña es correcta
        const { data } = await supabase.functions.invoke('legacy-login', { body: { username: uname, password } })
        if (data?.ok) ({ error: authErr } = await supabase.auth.signInWithPassword({ email, password }))
      }
      if (authErr) setError('Usuario o contraseña incorrectos.')
      else { try { localStorage.setItem('lastUsername', uname) } catch {} }
    } catch (err) {
      setError('Error de conexión: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1><img src="/icons/logo.png" alt="" className="app-logo" /> Pizarra Semanal</h1>
        <p className="login-sub">Inicia sesión para gestionar tu pizarra</p>
        <input
          type="text"
          id="username"
          name="username"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus={!username}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <input
          type="password"
          id="password"
          name="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus={!!username}
          autoComplete="current-password"
          required
        />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={busy || !username.trim() || !password}>
          {busy ? 'Comprobando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

// ─── AIRecipeProposalsModal ──────────────────────────────────────────────────

const AI_DEFAULT_PREFS = {
  count: 5,
  meal: '',
  maxTime: null,
  light: false,
  fewIngredients: false,
  types: [],
  available: [],
  avoid: '',
  notes: '',
  styles: { cuisine: [], method: [], diet: [], occasion: [] },
}

// Estilos de cocina (inspirados en los filtros habituales de las webs de recetas: cocina, método/aparato, dieta, ocasión)
const AI_STYLE_GROUPS = [
  { key: 'cuisine', label: '🌍 Cocina del mundo', options: ['Mediterránea', 'Española tradicional', 'Italiana', 'Griega', 'Asiática', 'Japonesa', 'Mexicana', 'India', 'Árabe y marroquí'] },
  { key: 'method', label: '🔥 Cómo se cocina', options: ['Al horno', 'A la plancha', 'Airfryer', 'Al vapor', 'Salteado / wok', 'Olla lenta', 'Olla a presión', 'Una sola olla o sartén', 'Sin cocinar (crudo)'] },
  { key: 'diet', label: '🥗 Dieta y objetivo', options: ['Alto en proteína', 'Bajo en carbohidratos', 'Vegetariano', 'Pescetariano', 'Vegano', 'Sin gluten', 'Sin lactosa', 'Antiinflamatorio'] },
  { key: 'occasion', label: '🍱 Ocasión', options: ['Para tupper', 'Batch cooking', 'Aprovechar sobras', 'Cena ligera', 'Plato único', 'Para invitados', 'Fin de semana con calma'] },
]

// Atajos para los casos más habituales de una pareja que come sano y a veces va con prisa
const AI_PRESETS = [
  { key: 'quick', label: '⚡ Rápido y ligero', apply: { maxTime: 15, light: true, fewIngredients: true } },
  { key: 'calm', label: '🍳 Con calma', apply: { maxTime: null, light: false, fewIngredients: false } },
  { key: 'pantry', label: '🧊 Vaciar la despensa', apply: { __pantry: true } },
]

const LIGHT_LABELS = { ligero: '🥗 Ligero', equilibrado: '⚖️ Equilibrado', contundente: '🍖 Contundente' }

function AIRecipeProposalsModal({ savedRecipes, ingredients, availableIds, onClose, onAdd, hidden = false, tabs = null }) {
  const [step, setStep] = useState('form') // 'form' | 'list'
  const [prefs, setPrefs] = useState(AI_DEFAULT_PREFS)
  const [showIngredients, setShowIngredients] = useState(false)
  const [proposals, setProposals] = useState([])
  const [added, setAdded] = useState(new Set())
  const [open, setOpen] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }))
  const toggleStyle = (group, option) => setPrefs((p) => {
    const cur = p.styles[group]
    return { ...p, styles: { ...p.styles, [group]: cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option] } }
  })
  const toggleType = (t) => set({ types: prefs.types.includes(t) ? prefs.types.filter((x) => x !== t) : [...prefs.types, t] })
  const applyPreset = (preset) => {
    if (preset.apply.__pantry) set({ available: availableIds })
    else set(preset.apply)
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setAdded(new Set())
    setOpen(null)
    try {
      const availableNames = prefs.available.map((id) => ingredients.find((i) => i.id === id)?.name).filter(Boolean)
      const { proposals: list } = await callAI('proposals', {
        count: prefs.count,
        filters: {
          meal: prefs.meal,
          maxTime: prefs.maxTime,
          light: prefs.light,
          fewIngredients: prefs.fewIngredients,
          maxIngredients: 6,
          types: prefs.types,
          available: availableNames,
          avoid: prefs.avoid,
          notes: prefs.notes,
          styles: prefs.styles,
        },
        history: savedRecipes.map((r) => r.name).filter(Boolean),
      })
      setProposals(list)
      setStep('list')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function addOne(p, i) {
    if (added.has(i)) return
    try {
      await onAdd(p)
      setAdded((prev) => new Set(prev).add(i))
    } catch (e) {
      setError('No se pudo añadir: ' + e.message)
    }
  }

  async function addAll() {
    for (const [i, p] of proposals.entries()) await addOne(p, i)
  }

  const chip = (active, label, onClick) => (
    <button type="button" className={`type-btn${active ? ' selected' : ''}`} onClick={onClick}>{label}</button>
  )

  return (
    <div className="modal-backdrop" style={hidden ? { display: 'none' } : undefined} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          {tabs || <h3>💡 Propuestas IA</h3>}
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {step === 'form' && (
            <>
              <div className="type-selector">
                {AI_PRESETS.map((pr) => (
                  <button key={pr.key} type="button" className="type-btn" onClick={() => applyPreset(pr)}>{pr.label}</button>
                ))}
              </div>

              <div className="form-field">
                <label className="form-label">Cuántos platos</label>
                <select className="auto-opt-select" value={prefs.count} onChange={(e) => set({ count: Number(e.target.value) })}>
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Para</label>
                <div className="type-selector">
                  {['Comida', 'Cena'].map((t) => chip(prefs.meal === t, t, () => set({ meal: prefs.meal === t ? '' : t })))}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Tiempo máximo</label>
                <div className="type-selector">
                  {[[15, '⚡ 15 min'], [30, '30 min'], [45, '45 min']].map(([n, label]) => chip(prefs.maxTime === n, label, () => set({ maxTime: prefs.maxTime === n ? null : n })))}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Estilo</label>
                <div className="type-selector">
                  {chip(prefs.light, '🥗 Ligero (pocas calorías y grasa)', () => set({ light: !prefs.light }))}
                  {chip(prefs.fewIngredients, '🧺 Pocos ingredientes (≤ 6)', () => set({ fewIngredients: !prefs.fewIngredients }))}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Tipo de plato</label>
                <div className="type-selector">
                  {FOOD_TYPES.filter((f) => f.key !== 'Comer fuera').map((ft) => chip(prefs.types.includes(ft.label), `${ft.emoji} ${ft.label}`, () => toggleType(ft.label)))}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Estilo de cocina</label>
                <div className="style-groups">
                  {AI_STYLE_GROUPS.map((g) => {
                    const sel = prefs.styles[g.key]
                    return (
                      <details key={g.key} className="style-group">
                        <summary>
                          {g.label}
                          {sel.length > 0 && <span className="style-count">{sel.length}</span>}
                        </summary>
                        <div className="type-selector">
                          {g.options.map((o) => chip(sel.includes(o), o, () => toggleStyle(g.key, o)))}
                        </div>
                      </details>
                    )
                  })}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Ingredientes que quiero aprovechar</label>
                <div className="type-selector" style={{ marginBottom: 6 }}>
                  {availableIds.length > 0 && chip(false, `🧊 Usar mi despensa (${availableIds.length})`, () => set({ available: availableIds }))}
                  {chip(showIngredients, `Elegir ingredientes${prefs.available.length ? ` (${prefs.available.length})` : ''}`, () => setShowIngredients((v) => !v))}
                  {prefs.available.length > 0 && chip(false, 'Quitar todos', () => set({ available: [] }))}
                </div>
                {showIngredients && (
                  <IngredientPicker
                    ingredients={ingredients}
                    selectedIds={prefs.available}
                    onChange={(u) => setPrefs((p) => ({ ...p, available: typeof u === 'function' ? u(p.available) : u }))}
                    onIngredientAdded={() => {}}
                    onError={setError}
                  />
                )}
              </div>

              <div className="form-field">
                <label className="form-label">Evitar</label>
                <input className="form-input" placeholder="Ej: fritos, marisco, picante…" value={prefs.avoid} onChange={(e) => set({ avoid: e.target.value })} />
              </div>
              <div className="form-field">
                <label className="form-label">Otras notas</label>
                <input className="form-input" placeholder="Ej: que sobre para el tupper…" value={prefs.notes} onChange={(e) => set({ notes: e.target.value })} />
              </div>
              {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}
            </>
          )}

          {step === 'list' && (
            <>
              {loading ? (
                <div className="ai-loading"><div className="spinner" />Consultando IA…</div>
              ) : proposals.length === 0 ? (
                <p>Sin propuestas. Vuelve al formulario.</p>
              ) : (
                <div className="proposal-list">
                  {proposals.map((p, i) => (
                    <div key={i} className="proposal-item">
                      <div className="proposal-name">{titleCase(p.name)}</div>
                      <div className="proposal-badges">
                        {p.time_min != null && <span className="auto-sheet-type">⏱ {p.time_min} min</span>}
                        {p.light && <span className="auto-sheet-type">{LIGHT_LABELS[p.light]}</span>}
                        {p.type && <span className="auto-sheet-type" style={{ background: CATEGORY_PASTELS[p.type] }}>{FOOD_TYPES.find((f) => f.key === p.type)?.label || p.type}</span>}
                        {p.ingredients.length > 0 && <span className="auto-sheet-type">{p.ingredients.length} ingredientes</span>}
                      </div>
                      <div className="proposal-desc">{p.description}</div>
                      {open === i && (
                        <div className="proposal-detail">
                          {p.ingredients.length > 0 && (
                            <div className="auto-sheet-chips" style={{ marginBottom: 6 }}>
                              {p.ingredients.map((ing, k) => <span key={k} className="auto-sheet-chip">{titleCase(ing.name)}</span>)}
                            </div>
                          )}
                          {p.steps && <p className="auto-sheet-text">{p.steps}</p>}
                        </div>
                      )}
                      <div className="proposal-actions">
                        <button className="btn btn-ghost" type="button" onClick={() => setOpen(open === i ? null : i)}>
                          {open === i ? 'Ocultar' : 'Ver receta'}
                        </button>
                        <button className="btn btn-primary" type="button" disabled={added.has(i)} onClick={() => addOne(p, i)}>
                          {added.has(i) ? '✓ Añadida' : <><Plus size={12} /> Añadir a recetas</>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}
            </>
          )}
        </div>
        <div className="modal-footer">
          {step === 'list' && !loading && (
            <>
              <button className="btn btn-ghost" onClick={() => { setStep('form'); setError(null) }}>Volver</button>
              {proposals.length > 1 && (
                <button className="btn btn-ghost" onClick={addAll} disabled={added.size === proposals.length}>Añadir todas</button>
              )}
            </>
          )}
          {step === 'form' && (
            <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? 'Generando…' : `Generar ${prefs.count} propuesta${prefs.count !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Asistente (menú de la semana + ideas de recetas) ─────────────────────────

function AssistantTabs({ active, onChange }) {
  return (
    <div className="assistant-tabs" role="tablist">
      <button role="tab" aria-selected={active === 'menu'} className={active === 'menu' ? 'active' : ''} onClick={() => onChange('menu')}>
        📅 Menú de la semana
      </button>
      <button role="tab" aria-selected={active === 'ideas'} className={active === 'ideas' ? 'active' : ''} onClick={() => onChange('ideas')}>
        💡 Ideas de recetas
      </button>
    </div>
  )
}

// ─── Móvil ────────────────────────────────────────────────────────────────────

function useIsMobile(query = '(max-width: 768px)') {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setMatch(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}

// Elige día y comida sin arrastrar (en el móvil no se puede arrastrar entre pantallas)
function PlanPicker({ title, startDayOfWeek, weekKey, initialDay = 0, onClose, onPick }) {
  const [day, setDay] = useState(initialDay)
  const [slotKey, setSlotKey] = useState('lunch')
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal plan-picker">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label className="form-label">Día</label>
            <div className="plan-days">
              {Array.from({ length: 7 }, (_, i) => {
                const date = getDayDate(weekKey, startDayOfWeek + i)
                return (
                  <button key={i} className={`plan-day${day === i ? ' selected' : ''}${isToday(date) ? ' today' : ''}`} onClick={() => setDay(i)}>
                    <span>{DAYS[(startDayOfWeek + i) % 7].slice(0, 3)}</span>
                    <strong>{date.getDate()}</strong>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Comida</label>
            <div className="type-selector">
              {SLOTS.map((sl) => (
                <button key={sl.key} className={`type-btn${slotKey === sl.key ? ' selected' : ''}`} onClick={() => setSlotKey(sl.key)}>{sl.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onPick(day, slotKey)}>Elegir</button>
        </div>
      </div>
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const toUser = (session) => session?.user
      ? { id: session.user.id, username: session.user.user_metadata?.username || session.user.email.split('@')[0] }
      : null
    supabase.auth.getSession().then(({ data }) => { setCurrentUser(toUser(data.session)); setAuthReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setCurrentUser(toUser(session)))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    // 'local': cierra solo este dispositivo (el valor por defecto cierra la sesión en todos los dispositivos)
    await supabase.auth.signOut({ scope: 'local' })
    initDone.current = false
    setCurrentUser(null)
  }

  const [weekOffset, setWeekOffset] = useState(0)
  const [startDayOfWeek, setStartDayOfWeekRaw] = useState(() => parseInt(localStorage.getItem('startDayOfWeek') || '0'))
  const setStartDayOfWeek = (val) => { setStartDayOfWeekRaw(val); localStorage.setItem('startDayOfWeek', val) }
  const weekKey = getWeekKey(weekOffset, 0)
  const nextWeekKey = getWeekKey(weekOffset + 1, 0)

  const [slots, setSlots] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [addModal, setAddModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [shoppingOpen, setShoppingOpen] = useState(false)
  const [purchasedIds, setPurchasedIds] = useState(new Set())
  const [activeId, setActiveId] = useState(null)
  const [popover, setPopover] = useState(null)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [shoppingHistory, setShoppingHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [savingList, setSavingList] = useState(false)
  const [allSlots, setAllSlots] = useState([])
  const [dismissedIds, setDismissedIds] = useState(new Set())
  const [contextMenu, setContextMenu] = useState(null)
  const [recipeModal, setRecipeModal] = useState(null)
  const [copyingSlot, setCopyingSlot] = useState(null)
  const [movingSlot, setMovingSlot] = useState(null)
  const [colorOverrides, setColorOverrides] = useState({})
  const [customItems, setCustomItems] = useState([])
  const [customInput, setCustomInput] = useState('')
  const [poolItems, setPoolItems] = useState([])
  const [savedRecipes, setSavedRecipes] = useState([])

  // ─── DB-backed mutations (writes broadcast via Supabase realtime) ──────────
  async function reloadPool() {
    try { setPoolItems(await dbGet('v2_pool_items')) } catch {}
  }
  async function addPoolItem(item) {
    const row = { id: newId(), dish_name: '', effort: 1, ...item }
    setPoolItems((prev) => [...prev, row])
    try { await dbInsert('v2_pool_items', row) } catch { reloadPool() }
  }
  async function updatePoolItem(id, patch) {
    setPoolItems((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p))
    try { await dbUpdate('v2_pool_items', id, { ...patch, updated_at: new Date().toISOString() }) } catch { reloadPool() }
  }
  async function deletePoolItem(id) {
    setPoolItems((prev) => prev.filter((p) => p.id !== id))
    try { await dbDelete('v2_pool_items', id) } catch { reloadPool() }
  }

  async function reloadRecipes() {
    try { setSavedRecipes(await dbGet('v2_saved_recipes')) } catch {}
  }
  async function addRecipe(name = '') {
    const row = { id: newId(), name }
    setSavedRecipes((prev) => [...prev, row])
    try { await dbInsert('v2_saved_recipes', row) } catch { reloadRecipes() }
    return row.id
  }

  // Abre la ficha de una receta por nombre; si el plato aún no tiene receta, la crea
  async function openRecipeByName(name) {
    const key = (name || '').trim().toLowerCase()
    const found = savedRecipes.find((r) => (r.name || '').trim().toLowerCase() === key)
    setRecipeDetailId(found ? found.id : await addRecipe(name.trim()))
  }
  async function updateRecipe(id, patch) {
    setSavedRecipes((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))
    try { await dbUpdate('v2_saved_recipes', id, { ...patch, updated_at: new Date().toISOString() }) } catch { reloadRecipes() }
  }
  async function deleteRecipe(id) {
    setSavedRecipes((prev) => prev.filter((r) => r.id !== id))
    try { await dbDelete('v2_saved_recipes', id) } catch { reloadRecipes() }
  }
  async function addToSavedRecipes(name) {
    const trimmed = (name || '').trim()
    if (!trimmed) return
    if (savedRecipes.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) return
    await addRecipe(trimmed)
  }

  async function reloadCustomItems() {
    try { setCustomItems(await dbGet('v2_custom_items', { week_key: weekKey })) } catch {}
  }
  async function addCustomItemRow(item) {
    const row = { id: newId(), week_key: weekKey, ...item }
    setCustomItems((prev) => [...prev, row])
    try { await dbInsert('v2_custom_items', row) } catch { reloadCustomItems() }
  }
  // Varios artículos a la vez: una sola escritura (así no pueden pisarse entre sí)
  async function addCustomItemRows(items) {
    if (!items.length) return
    const rows = items.map((item) => ({ id: newId(), week_key: weekKey, ...item }))
    setCustomItems((prev) => [...prev, ...rows])
    try {
      const { error } = await supabase.from('v2_custom_items').insert(rows)
      if (error) throw error
    } catch (e) {
      showToast('No se pudieron guardar los artículos: ' + (e.message || 'error'))
      reloadCustomItems()
    }
  }
  async function removeCustomItemRow(id) {
    setCustomItems((prev) => prev.filter((i) => i.id !== id))
    try { await dbDelete('v2_custom_items', id) } catch { reloadCustomItems() }
  }
  async function updateCustomItemRow(id, patch) {
    setCustomItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i))
    try {
      await supabase.from('v2_custom_items').update(patch).eq('id', id)
    } catch { reloadCustomItems() }
  }
  async function clearCustomItemsThisWeek() {
    const ids = customItems.map((i) => i.id)
    setCustomItems([])
    try {
      await supabase.from('v2_custom_items').delete().eq('week_key', weekKey)
    } catch { reloadCustomItems() }
  }

  async function reloadDismissed() {
    try {
      const rows = await dbGet('v2_dismissed', { week_key: weekKey })
      setDismissedIds(new Set(rows.map((r) => r.ingredient_id)))
    } catch {}
  }
  async function addDismissed(ingredientIds) {
    if (!ingredientIds.length) return
    setDismissedIds((prev) => new Set([...prev, ...ingredientIds]))
    try {
      const rows = ingredientIds.map((id) => ({ week_key: weekKey, ingredient_id: String(id) }))
      await supabase.from('v2_dismissed').upsert(rows, { onConflict: 'week_key,ingredient_id' })
    } catch { reloadDismissed() }
  }
  async function clearDismissed() {
    setDismissedIds(new Set())
    try { await supabase.from('v2_dismissed').delete().eq('week_key', weekKey) } catch { reloadDismissed() }
  }

  // Lo marcado como comprado se guarda por semana y se comparte en tiempo real
  async function reloadPurchased() {
    try {
      const rows = await dbGet('v2_purchased', { week_key: weekKey })
      setPurchasedIds(new Set(rows.map((r) => r.item_key)))
    } catch {}
  }
  async function setPurchased(key, on) {
    setPurchasedIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
    try {
      if (on) await supabase.from('v2_purchased').upsert({ week_key: weekKey, item_key: key }, { onConflict: 'week_key,item_key' })
      else await supabase.from('v2_purchased').delete().eq('week_key', weekKey).eq('item_key', key)
    } catch { reloadPurchased() }
  }
  async function clearPurchased() {
    setPurchasedIds(new Set())
    try { await supabase.from('v2_purchased').delete().eq('week_key', weekKey) } catch { reloadPurchased() }
  }

  async function reloadColorOverrides() {
    try {
      const rows = await dbGet('v2_color_overrides')
      setColorOverrides(Object.fromEntries(rows.map((r) => [r.slot_id, r.type_key])))
    } catch {}
  }
  async function setColorOverride(slotId, typeKey) {
    setColorOverrides((prev) => ({ ...prev, [String(slotId)]: typeKey }))
    try {
      await supabase.from('v2_color_overrides').upsert({ slot_id: String(slotId), type_key: typeKey }, { onConflict: 'slot_id' })
    } catch { reloadColorOverrides() }
  }

  const [trayTab, setTrayTab] = useState('pool')
  const [pendingRecipeName, setPendingRecipeName] = useState(null)
  const [recipeSearch, setRecipeSearch] = useState('')
  const [recipeSort, setRecipeSort] = useState(() => { try { return localStorage.getItem('recipeSort') || 'recent' } catch { return 'recent' } })
  const [selectedTag, setSelectedTag] = useState(null)
  const [assistant, setAssistant] = useState(null) // null | 'menu' | 'ideas'
  const [recipeReverse, setRecipeReverse] = useState(() => { try { return localStorage.getItem('recipeReverse') === '1' } catch { return false } })
  useEffect(() => { try { localStorage.setItem('recipeSort', recipeSort); localStorage.setItem('recipeReverse', recipeReverse ? '1' : '0') } catch {} }, [recipeSort, recipeReverse])
  const [recipeFilters, setRecipeFilters] = useState({ maxTime: null, light: false, few: false, types: [] })
  const [recipeFiltersOpen, setRecipeFiltersOpen] = useState(false)
  const [dishIngMap, setDishIngMap] = useState({})
  const [recipeDetailId, setRecipeDetailId] = useState(null)
  const [cartRecipeId, setCartRecipeId] = useState(null)
  const [cartIdsOverride, setCartIdsOverride] = useState(null)
  const [pantryModal, setPantryModal] = useState(null) // { mode: 'dish' | 'ingredient', item? }
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState('menu') // 'menu' | 'tray'
  const [mobileDay, setMobileDay] = useState(null)   // columna visible en la vista de un día
  const [mobileView, setMobileViewRaw] = useState(() => { try { return localStorage.getItem('mobileView') === 'day' ? 'day' : 'week' } catch { return 'week' } })
  const setMobileView = (v) => { setMobileViewRaw(v); try { localStorage.setItem('mobileView', v) } catch {} }
  const [planPicker, setPlanPicker] = useState(null) // { mode: 'recipe' | 'pool' | 'move' | 'copy', ... }
  const swipe = useRef(null)
  const weekScrollRef = useRef(null)
  useEffect(() => { setMobileDay(null) }, [weekKey, startDayOfWeek])
  // En la vista semanal del móvil se abre mostrando el día de hoy (si está en la semana visible)
  useEffect(() => {
    if (!isMobile || mobileView !== 'week' || mobileTab !== 'menu' || loading) return
    const id = setTimeout(() => {
      const sc = weekScrollRef.current
      const today = sc?.querySelector('.board-day-header.today')
      sc?.scrollTo({ left: today ? Math.max(0, today.offsetLeft - 42) : 0 })
    }, 50)
    return () => clearTimeout(id)
  }, [isMobile, mobileView, mobileTab, weekKey, startDayOfWeek, loading])

  // La despensa mezcla platos e ingredientes disponibles
  const poolDishes = useMemo(() => poolItems.filter((p) => (p.kind || 'dish') === 'dish'), [poolItems])
  const pantryIngredients = useMemo(() => poolItems.filter((p) => p.kind === 'ingredient'), [poolItems])

  async function handleSavePantry({ id, mode, name, ingredientIds, location, note }) {
    if (id) {
      await updatePoolItem(id, mode === 'ingredient' ? { location, note } : { dish_name: name, location, note })
      return
    }
    if (mode === 'ingredient') {
      const already = new Set(pantryIngredients.map((p) => p.ingredient_id))
      for (const ingId of ingredientIds) {
        const ing = ingredients.find((i) => i.id === ingId)
        if (!ing || already.has(ingId)) continue
        await addPoolItem({ kind: 'ingredient', ingredient_id: ingId, dish_name: ing.name, location, note })
      }
      showToast(`${ingredientIds.length} ingrediente${ingredientIds.length !== 1 ? 's' : ''} en la despensa`)
      return
    }
    await addPoolItem({ kind: 'dish', dish_name: name, location, note })
  }

  // nombre de plato (minúsculas) → { nivelEsfuerzo: [ids de ingredientes] }
  async function loadDishIngMap() {
    try {
      const [dishes, dishIngs] = await Promise.all([dbGet('v2_dishes'), dbGet('v2_dish_ingredients')])
      const nameById = Object.fromEntries(dishes.map((d) => [d.id, d.name.toLowerCase()]))
      const map = {}
      for (const di of dishIngs) {
        const n = nameById[di.dish_id]
        if (!n) continue
        if (!map[n]) map[n] = {}
        if (!map[n][di.effort_level]) map[n][di.effort_level] = []
        map[n][di.effort_level].push(di.ingredient_id)
      }
      setDishIngMap(map)
    } catch (e) {
      console.error('Error al cargar ingredientes guardados:', e)
    }
  }

  const initDone = useRef(false)

  const sensors = useSensors(
    // Ratón: arrastra tras 8px. Táctil: pulsación larga (así el scroll del tablero sigue funcionando)
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  )

  useEffect(() => {
    if (!currentUser) return
    if (initDone.current) return
    initDone.current = true
    initApp()
  }, [currentUser])

  useEffect(() => {
    if (ingredients.length > 0) loadSlots()
  }, [weekKey, nextWeekKey, startDayOfWeek, ingredients])

  // Global realtime subscriptions (independent of week)
  useEffect(() => {
    if (!currentUser) return
    reloadPool()
    reloadRecipes()
    reloadColorOverrides()
    const channels = [
      supabase.channel('rt:pool').on('postgres_changes', { event: '*', schema: 'public', table: 'v2_pool_items' }, reloadPool).subscribe(),
      supabase.channel('rt:recipes').on('postgres_changes', { event: '*', schema: 'public', table: 'v2_saved_recipes' }, reloadRecipes).subscribe(),
      supabase.channel('rt:color').on('postgres_changes', { event: '*', schema: 'public', table: 'v2_color_overrides' }, reloadColorOverrides).subscribe(),
      supabase.channel('rt:slots').on('postgres_changes', { event: '*', schema: 'public', table: 'v2_board_slots' }, () => { if (ingredients.length) loadSlots() }).subscribe(),
      supabase.channel('rt:ingredients').on('postgres_changes', { event: '*', schema: 'public', table: 'v2_ingredients' }, async () => {
        try { setIngredients(await dbGet('v2_ingredients')) } catch {}
      }).subscribe(),
      supabase.channel('rt:lists').on('postgres_changes', { event: '*', schema: 'public', table: 'v2_shopping_lists' }, () => { if (historyOpen) loadShoppingHistory() }).subscribe(),
    ]
    return () => channels.forEach((ch) => supabase.removeChannel(ch))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  // Per-week realtime subscriptions
  useEffect(() => {
    if (!currentUser) return
    reloadCustomItems()
    reloadDismissed()
    reloadPurchased()
    const channels = [
      supabase.channel(`rt:purchased:${weekKey}`).on('postgres_changes', { event: '*', schema: 'public', table: 'v2_purchased', filter: `week_key=eq.${weekKey}` }, reloadPurchased).subscribe(),
      supabase.channel(`rt:custom:${weekKey}`).on('postgres_changes', { event: '*', schema: 'public', table: 'v2_custom_items', filter: `week_key=eq.${weekKey}` }, reloadCustomItems).subscribe(),
      supabase.channel(`rt:dismissed:${weekKey}`).on('postgres_changes', { event: '*', schema: 'public', table: 'v2_dismissed', filter: `week_key=eq.${weekKey}` }, reloadDismissed).subscribe(),
    ]
    return () => channels.forEach((ch) => supabase.removeChannel(ch))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, weekKey])

  async function initApp() {
    try {
      let ings = await dbGet('v2_ingredients')
      if (!ings.length) {
        const rows = DEFAULT_INGREDIENTS.map((i) => ({ ...i, is_custom: false }))
        for (const row of rows) {
          await dbInsert('v2_ingredients', row)
        }
        ings = await dbGet('v2_ingredients')
      }
      setIngredients(ings)
      loadDishIngMap()
      setLoading(false)
    } catch (e) {
      showToast('Error al cargar ingredientes: ' + e.message)
      setLoading(false)
    }
  }

  async function loadSlots() {
    try {
      const weekKeys = startDayOfWeek > 0 ? [weekKey, nextWeekKey] : [weekKey]
      const { data: rawSlots, error: slotsErr } = await supabase
        .from('v2_board_slots')
        .select('*')
        .in('week_key', weekKeys)
      if (slotsErr) throw slotsErr
      const boardSlots = rawSlots || []
      if (!boardSlots.length) {
        setSlots([])
        loadAllSlots()
        return
      }
      const enriched = await Promise.all(
        boardSlots.map(async (s) => {
          const dishes = await dbGet('v2_dishes', { id: s.dish_id })
          const dish = dishes[0]
          const dishIngs = await dbGet('v2_dish_ingredients', {
            dish_id: s.dish_id,
            effort_level: s.effort_override || 1,
          })
          return {
            ...s,
            dish_name: dish?.name || '?',
            ingredient_ids: dishIngs.map((di) => di.ingredient_id),
          }
        })
      )
      setSlots(enriched)
      loadAllSlots()
    } catch (e) {
      showToast('Error al cargar semana: ' + e.message)
    }
  }

  async function loadAllSlots() {
    loadDishIngMap()
    try {
      const { data: boardSlots, error } = await supabase.from('v2_board_slots').select('*')
      if (error) throw error
      if (!boardSlots.length) { setAllSlots([]); return }
      const dishIds = [...new Set(boardSlots.map((s) => s.dish_id))]
      const { data: dishes } = await supabase.from('v2_dishes').select('*').in('id', dishIds)
      const dishMap = Object.fromEntries((dishes || []).map((d) => [d.id, d]))
      const { data: dishIngs } = await supabase.from('v2_dish_ingredients').select('*').in('dish_id', dishIds)
      const enriched = boardSlots.map((s) => {
        const dish = dishMap[s.dish_id]
        const ings = (dishIngs || []).filter((di) => di.dish_id === s.dish_id && di.effort_level === (s.effort_override || 1))
        return { ...s, dish_name: dish?.name || '?', ingredient_ids: ings.map((di) => di.ingredient_id) }
      })
      setAllSlots(enriched)
    } catch (e) {
      console.error('Error al cargar todos los slots:', e)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  function handleIngredientAdded(newIng) {
    setIngredients((prev) => [...prev, newIng])
  }

  // selectedIds === null → conservar los ingredientes que el plato ya tiene guardados
  // (así arrastrar un plato desde la despensa o el menú automático no los borra)
  async function handleSaveDish({ dishName, effort, selectedIds, dayIdx, slotKey }) {
    let dish
    const existing = await dbGet('v2_dishes', { name: dishName })
    if (existing.length) {
      dish = existing[0]
    } else {
      dish = await dbInsert('v2_dishes', { name: dishName, effort_default: effort })
    }

    const currentDishIngs = await dbGet('v2_dish_ingredients', {
      dish_id: dish.id,
      effort_level: effort,
    })
    if (selectedIds == null) {
      selectedIds = currentDishIngs.map((di) => di.ingredient_id)
    } else {
      for (const di of currentDishIngs) {
        await dbDelete('v2_dish_ingredients', di.id)
      }
      for (const ingId of selectedIds) {
        await dbInsert('v2_dish_ingredients', {
          dish_id: dish.id,
          ingredient_id: ingId,
          effort_level: effort,
        })
      }
    }

    addToSavedRecipes(dishName)

    const colWeekKey = startDayOfWeek + dayIdx >= 7 ? nextWeekKey : weekKey
    const boardSlot = await dbInsert('v2_board_slots', {
      week_key: colWeekKey,
      day_idx: (startDayOfWeek + dayIdx) % 7,
      slot_key: slotKey,
      position: Date.now(),
      dish_id: dish.id,
      effort_override: effort,
    })

    setSlots((prev) => [
      ...prev,
      { ...boardSlot, dish_name: dishName, ingredient_ids: selectedIds },
    ])
    loadAllSlots()
  }

  async function handleEditDish({ dishName, effort, selectedIds, slot }) {
    let dish
    if (dishName !== slot.dish_name) {
      const existing = await dbGet('v2_dishes', { name: dishName })
      dish = existing.length ? existing[0] : await dbInsert('v2_dishes', { name: dishName, effort_default: effort })
    } else {
      const dishes = await dbGet('v2_dishes', { id: slot.dish_id })
      dish = dishes[0]
    }

    const currentDishIngs = await dbGet('v2_dish_ingredients', {
      dish_id: dish.id,
      effort_level: effort,
    })
    for (const di of currentDishIngs) {
      await dbDelete('v2_dish_ingredients', di.id)
    }
    for (const ingId of selectedIds) {
      await dbInsert('v2_dish_ingredients', {
        dish_id: dish.id,
        ingredient_id: ingId,
        effort_level: effort,
      })
    }

    addToSavedRecipes(dishName)
    await dbUpdate('v2_board_slots', slot.id, { dish_id: dish.id, effort_override: effort })

    setSlots((prev) =>
      prev.map((s) =>
        s.id === slot.id
          ? { ...s, dish_id: dish.id, dish_name: dishName, effort_override: effort, ingredient_ids: selectedIds }
          : s
      )
    )
    loadAllSlots()
  }

  async function handleDelete(slotId) {
    try {
      await dbDelete('v2_board_slots', slotId)
      setSlots((prev) => prev.filter((s) => s.id !== slotId))
      setAllSlots((prev) => prev.filter((s) => s.id !== slotId))
    } catch (e) {
      showToast('Error al eliminar: ' + e.message)
    }
  }

  async function handleCopySlot(dayIdx, slotKey, slotArg) {
    const src = slotArg || copyingSlot
    if (!src) return
    try {
      await handleSaveDish({
        dishName: src.dish_name,
        effort: src.effort_override || 1,
        selectedIds: src.ingredient_ids || [],
        slot: null,
        dayIdx,
        slotKey,
      })
      setCopyingSlot(null)
      showToast('Plato copiado ✓')
    } catch (e) {
      showToast('Error al copiar: ' + e.message)
    }
  }

  async function handleMoveSlot(dayIdx, slotKey, slotArg) {
    const src = slotArg || movingSlot
    if (!src) return
    try {
      if (src.isPool) {
        await handleSaveDish({ dishName: src.dish_name, effort: 1, selectedIds: null, dayIdx, slotKey })
        deletePoolItem(src.id)
      } else {
        const absIdx = (startDayOfWeek + dayIdx) % 7
        const colWk = startDayOfWeek + dayIdx >= 7 ? nextWeekKey : weekKey
        await dbUpdate('v2_board_slots', src.id, {
          week_key: colWk,
          day_idx: absIdx,
          slot_key: slotKey,
          position: Date.now(),
        })
        setSlots((prev) => prev.map((s) =>
          s.id === src.id ? { ...s, week_key: colWk, day_idx: absIdx, slot_key: slotKey } : s
        ))
      }
      setMovingSlot(null)
      showToast('Plato movido ✓')
    } catch (e) {
      showToast('Error al mover: ' + e.message)
    }
  }

  function handleChangeType(slotId, typeKey) {
    setColorOverride(slotId, typeKey)
  }

  function addCustomItem(name) {
    const category = guessCategoryForItem(name, ingredients)
    addCustomItemRow({ name, category })
  }
  function removeCustomItem(id) {
    removeCustomItemRow(id)
  }
  function toggleCustomItem(id) {
    setPurchased('custom_' + id, !purchasedIds.has('custom_' + id))
  }

  // Guarda tipo y pasos en la receta, y sus ingredientes en el plato con el mismo nombre
  // (la misma tabla que usa el menú, así los ingredientes se reutilizan al añadirla al tablero).
  async function handleSaveRecipeDetail({ recipe, effort, ingredientIds, type, steps, timeMin, light }) {
    const name = recipe.name.trim()
    const existing = await dbGet('v2_dishes', { name })
    const dish = existing[0] || await dbInsert('v2_dishes', { name, effort_default: effort })
    const current = await dbGet('v2_dish_ingredients', { dish_id: dish.id, effort_level: effort })
    const keep = new Set(ingredientIds)
    const have = new Set(current.map((di) => di.ingredient_id))
    for (const di of current) {
      if (!keep.has(di.ingredient_id)) await dbDelete('v2_dish_ingredients', di.id)
    }
    for (const ingId of ingredientIds) {
      if (!have.has(ingId)) {
        await dbInsert('v2_dish_ingredients', { dish_id: dish.id, ingredient_id: ingId, effort_level: effort })
      }
    }
    await updateRecipe(recipe.id, { type: type || null, steps: steps.trim() || null, time_min: timeMin || null, light: light || null })
    await loadDishIngMap()
    loadSlots()
    showToast('Receta guardada ✓')
  }

  // Convierte una propuesta de la IA en una receta completa: casa (o crea) sus ingredientes,
  // los guarda en el plato y rellena tipo, tiempo, ligereza y pasos.
  async function handleAddProposal(p) {
    const name = p.name.trim()
    const key = name.toLowerCase()
    let catalog = [...ingredients]
    const ids = []
    for (const ing of p.ingredients) {
      const n = normalizeText(ing.name).trim()
      let match = catalog.find((i) => normalizeText(i.name).trim() === n)
        || catalog.find((i) => normalizeText(i.name).startsWith(n + ' ') || normalizeText(i.name).startsWith(n + ' ('))
      if (!match) {
        const label = ing.name.trim().charAt(0).toUpperCase() + ing.name.trim().slice(1)
        match = await dbInsert('v2_ingredients', { name: label, category: ing.category || 'Otros', is_custom: true })
        handleIngredientAdded(match)
        catalog = [...catalog, match]
      }
      if (!ids.includes(match.id)) ids.push(match.id)
    }

    const existingDishes = await dbGet('v2_dishes', { name })
    const dish = existingDishes[0] || await dbInsert('v2_dishes', { name, effort_default: 1 })
    const have = new Set((await dbGet('v2_dish_ingredients', { dish_id: dish.id, effort_level: 1 })).map((d) => d.ingredient_id))
    for (const id of ids) {
      if (!have.has(id)) await dbInsert('v2_dish_ingredients', { dish_id: dish.id, ingredient_id: id, effort_level: 1 })
    }

    const fields = {
      description: p.description || null,
      steps: p.steps || null,
      type: p.type || null,
      time_min: p.time_min || null,
      light: p.light || null,
    }
    const newTags = (p.tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    const existing = savedRecipes.find((r) => (r.name || '').trim().toLowerCase() === key)
    if (existing) {
      await updateRecipe(existing.id, { ...fields, tags: [...new Set([...(existing.tags || []), ...newTags])] })
    } else {
      const row = { id: newId(), name, ...fields, tags: newTags }
      setSavedRecipes((prev) => [...prev, row])
      await dbInsert('v2_saved_recipes', row)
    }
    await loadDishIngMap()
    showToast(`"${titleCase(name)}" añadida a recetas`)
  }

  // Colocar un plato en un día/comida eligiéndolo en una lista (alternativa al arrastre, sobre todo en el móvil)
  async function handlePlanPick(day, slotKey) {
    const pk = planPicker
    setPlanPicker(null)
    if (!pk) return
    setMobileDay(day)
    try {
      if (pk.mode === 'recipe') {
        setAddModal({ dayIdx: day, slotKey, initialName: pk.name })
      } else if (pk.mode === 'pool') {
        await handleSaveDish({ dishName: pk.item.dish_name, effort: pk.item.effort || 1, selectedIds: null, dayIdx: day, slotKey })
        showToast(`"${titleCase(pk.item.dish_name)}" añadido al menú`)
      } else if (pk.mode === 'move') {
        await handleMoveSlot(day, slotKey, pk.slot)
      } else if (pk.mode === 'copy') {
        await handleCopySlot(day, slotKey, pk.slot)
      }
    } catch (e) {
      showToast('Error: ' + e.message)
    }
  }

  function handleRecipeToCart(selected, recipeName) {
    // No se repiten los que ya están en la lista de extras de esta semana
    const have = new Set(customItems.map((i) => normalizeText(i.name).trim()))
    const fresh = selected.filter((ing) => !have.has(normalizeText(ing.name).trim()))
    addCustomItemRows(fresh.map((ing) => ({ name: ing.name, category: ing.category || 'Otros', source: recipeName })))
    setCartRecipeId(null)
    const skipped = selected.length - fresh.length
    showToast(
      `${fresh.length} ingrediente${fresh.length !== 1 ? 's' : ''} añadido${fresh.length !== 1 ? 's' : ''} a la compra` +
      (skipped ? ` (${skipped} ya estaba${skipped !== 1 ? 'n' : ''})` : '')
    )
  }

  async function handleAutoMenuConfirm(proposals) {
    setAssistant(null)
    for (const p of proposals) {
      try {
        await handleSaveDish({ dishName: p.dishName, effort: 1, selectedIds: null, dayIdx: p.displayDay, slotKey: p.slotKey })
      } catch (e) {
        console.error('Error al guardar plato sugerido:', e)
      }
    }
    showToast('Semana generada ✓')
  }

  function handleDragStart({ active }) {
    setActiveId(active.id)
  }

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return

    // Drop on tray zones
    if (over.id === 'drop-pool') {
      const slot = slots.find((s) => s.id === String(active.id))
      if (!slot) return
      await addPoolItem({ dish_name: slot.dish_name, effort: slot.effort_override || 1 })
      await handleDelete(slot.id)
      showToast(`"${titleCase(slot.dish_name)}" enviado a la despensa`)
      return
    }
    if (over.id === 'drop-recipes') {
      const slot = slots.find((s) => s.id === String(active.id))
      if (slot) {
        await addToSavedRecipes(slot.dish_name)
        setTrayTab('recipes')
        showToast(`"${titleCase(slot.dish_name)}" guardado en recetas`)
        return
      }
      if (String(active.id).startsWith('pool-')) {
        const poolId = String(active.id).replace('pool-', '')
        const poolItem = poolItems.find((p) => p.id === poolId)
        if (poolItem?.dish_name) {
          await addToSavedRecipes(poolItem.dish_name)
          setTrayTab('recipes')
          showToast(`"${titleCase(poolItem.dish_name)}" guardado en recetas`)
        }
      }
      return
    }

    // Shopping list custom item → different category section
    if (String(over.id).startsWith('shopping-cat-')) {
      if (!String(active.id).startsWith('shopping-custom-')) return
      const newCategory = over.id.replace('shopping-cat-', '')
      const customId = String(active.id).replace('shopping-custom-', '')
      await updateCustomItemRow(customId, { category: newCategory })
      return
    }

    const parts = over.id.split('-')
    const newDisplayDay = parseInt(parts[0])
    if (isNaN(newDisplayDay)) return
    const newSlotKey = parts.slice(1).join('-')
    const newAbsIdx = (startDayOfWeek + newDisplayDay) % 7
    const newColWk = startDayOfWeek + newDisplayDay >= 7 ? nextWeekKey : weekKey

    // Recipe chip dropped on board cell → open modal pre-filled
    if (String(active.id).startsWith('recipe-')) {
      const recipeId = String(active.id).replace('recipe-', '')
      const recipe = savedRecipes.find((r) => r.id === recipeId)
      if (!recipe) return
      setAddModal({ dayIdx: newDisplayDay, slotKey: newSlotKey, initialName: recipe.name })
      return
    }

    // Pool item dropped on board
    if (String(active.id).startsWith('pool-')) {
      const poolId = String(active.id).replace('pool-', '')
      const poolItem = poolItems.find((p) => p.id === poolId)
      if (!poolItem || !poolItem.dish_name) return
      try {
        await handleSaveDish({
          dishName: poolItem.dish_name,
          effort: poolItem.effort || 1,
          selectedIds: null,
          slot: null,
          dayIdx: newDisplayDay,
          slotKey: newSlotKey,
        })
      } catch (e) {
        showToast('Error al añadir plato: ' + e.message)
      }
      return
    }

    // Board slot → different board cell
    const slot = slots.find((s) => s.id === active.id)
    if (!slot) return
    if (slot.day_idx === newAbsIdx && slot.slot_key === newSlotKey && slot.week_key === newColWk) return
    try {
      await dbUpdate('v2_board_slots', slot.id, {
        week_key: newColWk,
        day_idx: newAbsIdx,
        slot_key: newSlotKey,
        position: Date.now(),
      })
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slot.id ? { ...s, week_key: newColWk, day_idx: newAbsIdx, slot_key: newSlotKey } : s
        )
      )
    } catch (e) {
      showToast('Error al mover plato: ' + e.message)
    }
  }

  const shoppingList = (() => {
    const ingredientMap = {}
    for (const slot of slots) {
      for (const ingId of slot.ingredient_ids || []) {
        if (dismissedIds.has(ingId)) continue
        if (!ingredientMap[ingId]) ingredientMap[ingId] = []
        if (!ingredientMap[ingId].includes(slot.dish_name)) {
          ingredientMap[ingId].push(slot.dish_name)
        }
      }
    }
    const result = []
    for (const cat of INGREDIENT_CATEGORIES) {
      const items = ingredients
        .filter((i) => i.category === cat && ingredientMap[i.id])
        .map((i) => ({ ingredient: i, dishes: ingredientMap[i.id] }))
      if (items.length) result.push({ category: cat, items })
    }
    return result
  })()

  const totalItems = shoppingList.reduce((acc, cat) => acc + cat.items.length, 0) + customItems.length

  const allItemIds = [
    ...shoppingList.flatMap((cat) => cat.items.map(({ ingredient }) => ingredient.id)),
    ...customItems.map((item) => 'custom_' + item.id),
  ]
  const totalCheckable = allItemIds.length
  const purchasedCount = allItemIds.filter((id) => purchasedIds.has(id)).length

  function togglePurchased(id) {
    setPurchased(id, !purchasedIds.has(id))
  }

  async function handleSaveAndClear() {
    if (savingList) return

    // Solo los ingredientes marcados
    const checkedIngIds = shoppingList
      .flatMap((cat) => cat.items.map(({ ingredient }) => ingredient.id))
      .filter((id) => purchasedIds.has(id))

    // Solo los extras marcados
    const checkedCustom = customItems.filter((item) => purchasedIds.has('custom_' + item.id))

    if (!checkedIngIds.length && !checkedCustom.length) return

    // Limpiar UI optimísticamente
    await addDismissed(checkedIngIds)
    for (const item of checkedCustom) removeCustomItemRow(item.id)
    clearPurchased()

    setSavingList(true)
    try {
      const historyItems = [
        ...shoppingList
          .map((cat) => ({
            category: cat.category,
            items: cat.items
              .filter(({ ingredient }) => checkedIngIds.includes(ingredient.id))
              .map(({ ingredient }) => ({ id: ingredient.id, name: ingredient.name })),
          }))
          .filter((c) => c.items.length),
        ...(checkedCustom.length ? [{ category: 'Extra', items: checkedCustom.map((i) => ({ id: i.id, name: i.name })) }] : []),
      ]
      if (historyItems.length) {
        await dbInsert('v2_shopping_lists', {
          week_key: weekKey,
          saved_at: new Date().toISOString(),
          items: historyItems,
        })
        if (historyOpen) loadShoppingHistory()
      }
      showToast('Seleccionados eliminados ✓')
    } catch (e) {
      showToast('Eliminados (historial no guardado)')
    } finally {
      setSavingList(false)
    }
  }

  function handleShareWhatsApp() {
    if (totalItems === 0) return
    let text = '🛒 Lista de la compra\n\n'
    for (const cat of shoppingList) {
      text += `*${cat.category}*\n`
      for (const { ingredient } of cat.items) {
        text += `• ${ingredient.name}\n`
      }
      text += '\n'
    }
    if (customItems.length) {
      text += `*Extra*\n`
      for (const item of customItems) {
        text += `• ${item.name}\n`
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text.trim())}`, '_blank')
  }

  async function loadShoppingHistory() {
    try {
      const { data, error } = await supabase
        .from('v2_shopping_lists')
        .select('*')
        .order('saved_at', { ascending: false })
        .limit(20)
      if (error) throw error
      setShoppingHistory(data)
    } catch (e) {
      showToast('Error al cargar historial: ' + e.message)
    }
  }

  function handleOpenHistory() {
    setHistoryOpen(true)
    loadShoppingHistory()
  }

  const activeSlot = activeId ? slots.find((s) => s.id === activeId) : null
  // Tipo de plato fijado en la receta (tiene prioridad sobre la detección automática);
  // el cambio manual por postit (menú contextual) tiene prioridad sobre ambos.
  const recipeTypeByName = useMemo(() => {
    const m = {}
    for (const r of savedRecipes) if (r.type && r.name) m[r.name.trim().toLowerCase()] = r.type
    return m
  }, [savedRecipes])
  const effectiveOverrides = useMemo(() => {
    const m = {}
    for (const s of slots) {
      const t = recipeTypeByName[(s.dish_name || '').trim().toLowerCase()]
      if (t) m[s.id] = t
    }
    return { ...m, ...colorOverrides }
  }, [slots, recipeTypeByName, colorOverrides])
  const activeFilterCount = (selectedTag ? 1 : 0) + (recipeFilters.maxTime ? 1 : 0) + (recipeFilters.light ? 1 : 0) + (recipeFilters.few ? 1 : 0) + recipeFilters.types.length
  const dietWarnings = useMemo(() => getDietWarnings(slots, ingredients, effectiveOverrides, startDayOfWeek, weekKey, nextWeekKey), [slots, ingredients, effectiveOverrides, startDayOfWeek, weekKey, nextWeekKey])

  const recipeUsageCount = useMemo(() => {
    const count = {}
    for (const s of allSlots) {
      if (s.dish_name && s.dish_name !== '?') {
        const k = s.dish_name.toLowerCase()
        count[k] = (count[k] || 0) + 1
      }
    }
    return count
  }, [allSlots])

  const allTags = useMemo(() => {
    const tagSet = new Set()
    for (const r of savedRecipes) {
      for (const t of (r.tags || [])) tagSet.add(t)
    }
    return [...tagSet].sort()
  }, [savedRecipes])

  const filteredRecipes = useMemo(() => {
    let result = savedRecipes
    if (selectedTag) {
      result = result.filter((r) => (r.tags || []).includes(selectedTag))
    }
    const rf = recipeFilters
    if (rf.maxTime) result = result.filter((r) => r.time_min && r.time_min <= rf.maxTime)
    if (rf.light) result = result.filter((r) => r.light === 'ligero')
    if (rf.few) {
      result = result.filter((r) => {
        const n = savedIngredientIds(dishIngMap, r.name).length
        return n >= 1 && n <= 6
      })
    }
    if (rf.types.length) {
      result = result.filter((r) => rf.types.includes(r.type || getDominantCategory(savedIngredientIds(dishIngMap, r.name), ingredients, r.name)))
    }
    if (recipeSearch.trim()) {
      const q = recipeSearch.toLowerCase()
      result = result.filter((r) => r.name.toLowerCase().includes(q))
    }
    const byName = (a, b) => a.name.localeCompare(b.name, 'es')
    if (recipeSort === 'az') {
      result = [...result].sort(byName)
    } else if (recipeSort === 'category') {
      result = [...result].sort((a, b) => {
        const catA = a.type || getDominantCategory([], ingredients, a.name) || 'Ω'
        const catB = b.type || getDominantCategory([], ingredients, b.name) || 'Ω'
        return catA.localeCompare(catB, 'es') || byName(a, b)
      })
    } else if (recipeSort === 'rating') {
      result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0) || byName(a, b))
    } else {
      // Recientes: las más nuevas primero (los ids son marcas de tiempo)
      const stamp = (r) => Number(r.id) || new Date(r.created_at || 0).getTime()
      result = [...result].sort((a, b) => stamp(b) - stamp(a))
    }
    return recipeReverse ? [...result].reverse() : result
  }, [savedRecipes, recipeSearch, recipeSort, recipeReverse, ingredients, selectedTag, recipeFilters, dishIngMap])

  if (!authReady) return null
  if (!currentUser) return <LoginScreen />

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <span>Cargando pizarra…</span>
      </div>
    )
  }

  const todayCol = Array.from({ length: 7 }, (_, i) => i).find((i) => isToday(getDayDate(weekKey, startDayOfWeek + i))) ?? -1
  const selectedDay = mobileDay ?? (todayCol >= 0 ? todayCol : 0)

  // Celda (día + comida) del tablero: la usan la cuadrícula de escritorio y la vista de un día del móvil
  const renderCell = (i, slot) => {
                    const absIdx = (startDayOfWeek + i) % 7
                    const colWk = startDayOfWeek + i >= 7 ? nextWeekKey : weekKey
                    const cellId = `${i}-${slot.key}`
                    const cellSlots = slots.filter(
                      (s) => s.day_idx === absIdx && s.slot_key === slot.key && s.week_key === colWk
                    )
                    const isTodayCol = isToday(getDayDate(weekKey, startDayOfWeek + i))
                    return (
                      <DroppableCell key={cellId} id={cellId} isToday={isTodayCol}>
                        {cellSlots.map((s) => (
                          <DraggablePostit
                            key={s.id}
                            slot={s}
                            ingredients={ingredients}
                            colorOverrides={effectiveOverrides}
                            onEdit={() => setEditModal(s)}
                            onDelete={handleDelete}
                            onContextMenu={(e, slot) => setContextMenu({ x: e.clientX, y: e.clientY, slot })}
                            onOpen={(s) => openRecipeByName(s.dish_name)}
                            wholeDrag={isMobile && mobileView === 'week'}
                          />
                        ))}
                        <div className="board-cell-add">
                          <button
                            className={`btn-add-slot${copyingSlot || movingSlot ? ' copy-target' : ''}${pendingRecipeName ? ' copy-target' : ''}${cellSlots.length > 0 ? ' has-items' : ''}`}
                            onClick={() => {
                              if (copyingSlot) handleCopySlot(i, slot.key)
                              else if (movingSlot) handleMoveSlot(i, slot.key)
                              else {
                                setAddModal({ dayIdx: i, slotKey: slot.key, initialName: pendingRecipeName || undefined })
                                setPendingRecipeName(null)
                              }
                            }}
                          >
                            <Plus size={12} />
                            <span>{copyingSlot ? 'Pegar' : movingSlot ? 'Mover aquí' : pendingRecipeName ? 'Usar receta' : 'Añadir'}</span>
                          </button>
                        </div>
                      </DroppableCell>
                    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1><img src="/icons/logo.png" alt="" className="app-logo" /> Pizarra Semanal</h1>
        <div className="week-nav">
          <button onClick={() => setWeekOffset((w) => w - 1)} title="7 días atrás">
            <ChevronLeft size={16} />
          </button>
          <span>{formatWeekRange(weekKey, startDayOfWeek)}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)} title="7 días adelante">
            <ChevronRight size={16} />
          </button>
          {weekOffset !== 0 && (
            <button className="btn-today" onClick={() => setWeekOffset(0)}>
              Hoy
            </button>
          )}
        </div>
        <div className="start-day-picker">
          <span className="start-day-label">Empieza el</span>
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((abbr, i) => (
            <button
              key={i}
              className={`start-day-btn${startDayOfWeek === i ? ' active' : ''}`}
              onClick={() => { setStartDayOfWeek(i); setWeekOffset(0) }}
              title={DAYS[i]}
            >
              {abbr}
            </button>
          ))}
        </div>
        <select
          className="start-day-select"
          value={startDayOfWeek}
          onChange={(e) => { setStartDayOfWeek(Number(e.target.value)); setWeekOffset(0) }}
          aria-label="Día en que empieza la semana"
        >
          {DAYS.map((d, i) => <option key={i} value={i}>Empieza: {d}</option>)}
        </select>
        <button className="logout-btn" onClick={handleLogout} title={`Cerrar sesión (${currentUser.username})`}>
          <LogOut size={14} />
          <span className="logout-name">{currentUser.username}</span>
        </button>
      </header>

      <div className="app-body">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="app-main" data-mtab={isMobile ? mobileTab : 'desktop'}>
        <div className="board-wrapper">
          {(copyingSlot || movingSlot) && (
            <div className="copy-banner">
              {movingSlot ? <ChevronRight size={14} /> : <Copy size={14} />}
              {movingSlot
                ? <>Moviendo <strong>{movingSlot.dish_name}</strong> — elige destino</>
                : <>Copiando <strong>{copyingSlot.dish_name}</strong> — elige dónde pegar</>
              }
              <button onClick={() => { setCopyingSlot(null); setMovingSlot(null) }}><X size={13} /></button>
            </div>
          )}
          {dietWarnings.length > 0 && (isMobile ? (
            <details className="diet-warnings diet-warnings-mobile">
              <summary>⚠️ Variedad: {dietWarnings.length} aviso{dietWarnings.length !== 1 ? 's' : ''}</summary>
              {dietWarnings.map((w, i) => (
                <div key={i} className="diet-warning">
                  <strong>{w.category}</strong> varios días seguidos: {w.days.join(', ')}
                </div>
              ))}
            </details>
          ) : (
            <div className="diet-warnings">
              {dietWarnings.map((w, i) => (
                <div key={i} className="diet-warning">
                  ⚠️ <strong>{w.category}</strong> varios días seguidos: {w.days.join(', ')}
                </div>
              ))}
            </div>
          ))}
            {isMobile && (
              <div className="mobile-toolbar">
                <div className="view-toggle" role="tablist">
                  <button role="tab" aria-selected={mobileView === 'week'} className={mobileView === 'week' ? 'active' : ''} onClick={() => setMobileView('week')}>Semana</button>
                  <button role="tab" aria-selected={mobileView === 'day'} className={mobileView === 'day' ? 'active' : ''} onClick={() => setMobileView('day')}>Día</button>
                </div>
                <button className="mobile-assistant-btn" onClick={() => setAssistant('menu')}>
                  <Sparkles size={14} /> Asistente
                </button>
              </div>
            )}
            {isMobile && mobileView === 'day' ? (
              <div
                className="mobile-day"
                onTouchStart={(e) => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
                onTouchEnd={(e) => {
                  const st = swipe.current
                  if (!st) return
                  const dx = e.changedTouches[0].clientX - st.x
                  const dy = e.changedTouches[0].clientY - st.y
                  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
                    setMobileDay(Math.max(0, Math.min(6, selectedDay + (dx < 0 ? 1 : -1))))
                  }
                }}
              >
                <div className="day-strip">
                  {DAYS.map((_, i) => {
                    const date = getDayDate(weekKey, startDayOfWeek + i)
                    const absIdx = (startDayOfWeek + i) % 7
                    const colWk = startDayOfWeek + i >= 7 ? nextWeekKey : weekKey
                    const count = slots.filter((x) => x.day_idx === absIdx && x.week_key === colWk).length
                    return (
                      <button
                        key={i}
                        className={`day-chip${selectedDay === i ? ' selected' : ''}${isToday(date) ? ' today' : ''}`}
                        onClick={() => setMobileDay(i)}
                      >
                        <span className="day-chip-name">{DAYS[(startDayOfWeek + i) % 7].slice(0, 3)}</span>
                        <span className="day-chip-date">{date.getDate()}</span>
                        <span className="day-chip-dots">{count > 0 ? '●'.repeat(Math.min(count, 4)) : '\u00a0'}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="mobile-day-title">
                  <span>
                    {DAYS[(startDayOfWeek + selectedDay) % 7]}{' '}
                    {getDayDate(weekKey, startDayOfWeek + selectedDay).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                  </span>
                </div>
                {SLOTS.map((slot) => (
                  <section key={slot.key} className="mobile-slot">
                    <h4 className="mobile-slot-title">{slot.label}</h4>
                    {renderCell(selectedDay, slot)}
                  </section>
                ))}
              </div>
            ) : (
            <div className={isMobile ? 'week-scroll' : undefined} ref={weekScrollRef}>
            <div className={`board${isMobile ? ' board-mobile' : ''}`}>
              <div className="board-header-empty" />
              {DAYS.map((_, i) => {
                const date = getDayDate(weekKey, startDayOfWeek + i)
                const name = DAYS[(startDayOfWeek + i) % 7]
                return (
                  <div
                    key={i}
                    className={`board-day-header${isToday(date) ? ' today' : ''}`}
                  >
                    <div className="day-name">{name}</div>
                    <div className="day-date">
                      {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                )
              })}

              {SLOTS.map((slot) => (
                <React.Fragment key={slot.key}>
                  <div className="board-slot-label">{slot.label}</div>
                  {DAYS.map((_, i) => renderCell(i, slot))}
                </React.Fragment>
              ))}
            </div>
            </div>
            )}
        </div>{/* /board-wrapper */}
        <DragOverlay dropAnimation={null}>
              {activeId && (() => {
                if (String(activeId).startsWith('pool-')) {
                  const p = poolItems.find((x) => x.id === String(activeId).replace('pool-', ''))
                  return p ? <div className="tray-dish-overlay">{p.dish_name || '…'}</div> : null
                }
                if (String(activeId).startsWith('recipe-')) {
                  const r = savedRecipes.find((x) => `recipe-${x.id}` === activeId)
                  if (!r) return null
                  const cat = getDominantCategory([], ingredients, r.name)
                  const bg = cat ? (CATEGORY_PASTELS[cat] ?? CATEGORY_PASTELS['Otros']) : CATEGORY_PASTELS['Otros']
                  return <div className="postit-overlay" style={{ background: bg }}><span className="postit-name">{titleCase(r.name)}</span></div>
                }
                if (String(activeId).startsWith('shopping-custom-')) {
                  const customId = String(activeId).replace('shopping-custom-', '')
                  const item = customItems.find((i) => i.id === customId)
                  return item ? <div className="shopping-item-overlay">{titleCase(item.name)}</div> : null
                }
                const s = slots.find((x) => x.id === activeId)
                if (!s) return null
                const cat = effectiveOverrides[s.id] || getDominantCategory(s.ingredient_ids, ingredients, s.dish_name)
                const bg = cat ? (CATEGORY_PASTELS[cat] ?? CATEGORY_PASTELS['Otros']) : CATEGORY_PASTELS['Otros']
                return <div className="postit-overlay" style={{ background: bg }}><span className="postit-name">{titleCase(s.dish_name)}</span></div>
              })()}
            </DragOverlay>

        <div className="dishes-tray">
          <div className="tray-tabs">
            <button className={`tray-tab${trayTab === 'pool' ? ' active' : ''}`} onClick={() => setTrayTab('pool')}>
              Mi despensa
            </button>
            <button className={`tray-tab${trayTab === 'recipes' ? ' active' : ''}`} onClick={() => setTrayTab('recipes')}>
              Recetas{savedRecipes.length > 0 && <span className="tray-tab-count">{savedRecipes.length}</span>}
            </button>
            {trayTab === 'pool' && (
              <>
                <button className="btn-add-slot tray-add-btn" onClick={() => addPoolItem()}>
                  <Plus size={11} /> Plato
                </button>
                <button className="btn-add-slot tray-add-btn" onClick={() => setPantryModal({ mode: 'ingredient' })}>
                  <Plus size={11} /> Ingrediente
                </button>
              </>
            )}
            {trayTab === 'recipes' && (
              <>
                <button className="btn-add-slot tray-add-btn" onClick={() => addRecipe('')}>
                  <Plus size={11} /> Receta
                </button>
                <button className="btn-add-slot tray-add-btn tray-ai-btn" onClick={() => setAssistant('menu')} title="Sugerir el menú de la semana o buscar ideas de recetas con IA">
                  <Sparkles size={11} /> Asistente
                </button>
              </>
            )}
          </div>

          {trayTab === 'pool' && (
            <DroppableTrayZone id="drop-pool">
              <div className="tray-tab-content">
                {movingSlot && !movingSlot.isPool && (
                  <button className="tray-move-zone" onClick={() => {
                    addPoolItem({ dish_name: movingSlot.dish_name })
                    handleDelete(movingSlot.id)
                    setMovingSlot(null)
                    showToast(`"${titleCase(movingSlot.dish_name)}" enviado a la despensa`)
                  }}>
                    ⬇ Soltar aquí en la despensa
                  </button>
                )}
                {pendingRecipeName && (
                  <div className="copy-banner" style={{ marginBottom: 8 }}>
                    <span>Añadiendo "{titleCase(pendingRecipeName)}" — haz clic en un hueco del tablero</span>
                    <button onClick={() => setPendingRecipeName(null)}><X size={13} /></button>
                  </div>
                )}
                <div className="dishes-tray-list">
                  {poolDishes.map((item) => (
                    <PoolPostit
                      key={item.id}
                      item={item}
                      ingredients={ingredients}
                      typeOverride={recipeTypeByName[(item.dish_name || '').trim().toLowerCase()] || null}
                      savedIds={savedIngredientIds(dishIngMap, item.dish_name, item.effort)}
                      onUpdate={(updated) => updatePoolItem(item.id, { dish_name: updated.dish_name })}
                      onDelete={() => deletePoolItem(item.id)}
                      onEditDetails={() => setPantryModal({ mode: 'dish', item })}
                      onPlan={() => setPlanPicker({ mode: 'pool', item })}
                      onContextMenu={(e, slot) => setContextMenu({ x: e.clientX, y: e.clientY, slot, isPool: true })}
                    />
                  ))}
                </div>
                {pantryIngredients.length > 0 && (
                  <div className="pantry-section">
                    <div className="pantry-section-title">🥕 Ingredientes disponibles</div>
                    <div className="pantry-chips">
                      {[...pantryIngredients]
                        .sort((a, b) => (a.location || 'z').localeCompare(b.location || 'z') || a.dish_name.localeCompare(b.dish_name, 'es'))
                        .map((item) => (
                          <PantryIngredientChip
                            key={item.id}
                            item={item}
                            ingredient={ingredients.find((i) => i.id === item.ingredient_id)}
                            onEdit={() => setPantryModal({ mode: 'ingredient', item })}
                            onDelete={() => deletePoolItem(item.id)}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </DroppableTrayZone>
          )}

          {trayTab === 'recipes' && (
            <DroppableTrayZone id="drop-recipes">
              <div className="tray-tab-content">
                {savedRecipes.length > 0 && (
                  <div className="recipe-controls">
                    <div className={`recipe-filters-box${recipeFiltersOpen ? ' open' : ''}`}>
                    {allTags.length > 0 && (
                      <div className="tag-filter-chips">
                        {allTags.map((tag) => (
                          <button
                            key={tag}
                            className={`tag-filter-chip${selectedTag === tag ? ' active' : ''}`}
                            onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="tag-filter-chips">
                      {[[15, '⚡ ≤15 min'], [30, '≤30 min']].map(([n, label]) => (
                        <button key={n} className={`tag-filter-chip${recipeFilters.maxTime === n ? ' active' : ''}`} onClick={() => setRecipeFilters((f) => ({ ...f, maxTime: f.maxTime === n ? null : n }))}>{label}</button>
                      ))}
                      <button className={`tag-filter-chip${recipeFilters.light ? ' active' : ''}`} onClick={() => setRecipeFilters((f) => ({ ...f, light: !f.light }))}>🥗 Ligero</button>
                      <button className={`tag-filter-chip${recipeFilters.few ? ' active' : ''}`} onClick={() => setRecipeFilters((f) => ({ ...f, few: !f.few }))}>🧺 Pocos ingr.</button>
                      {FOOD_TYPES.filter((ft) => ft.key !== 'Comer fuera').map((ft) => (
                        <button
                          key={ft.key}
                          className={`tag-filter-chip${recipeFilters.types.includes(ft.key) ? ' active' : ''}`}
                          onClick={() => setRecipeFilters((f) => ({ ...f, types: f.types.includes(ft.key) ? f.types.filter((t) => t !== ft.key) : [...f.types, ft.key] }))}
                        >{ft.emoji} {ft.label}</button>
                      ))}
                      {(recipeFilters.maxTime || recipeFilters.light || recipeFilters.few || recipeFilters.types.length > 0) && (
                        <button className="tag-filter-chip" onClick={() => setRecipeFilters({ maxTime: null, light: false, few: false, types: [] })}>✕ Limpiar</button>
                      )}
                    </div>
                    </div>
                    <div className="recipe-search-row">
                      <input
                        className="recipe-search-input"
                        placeholder="Buscar receta…"
                        value={recipeSearch}
                        onChange={(e) => setRecipeSearch(e.target.value)}
                      />
                      <button className={`recipe-filters-toggle${recipeFiltersOpen ? ' active' : ''}`} onClick={() => setRecipeFiltersOpen((v) => !v)}>
                        ⚙ Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                      </button>
                    </div>
                    <div className="recipe-sort-btns">
                      {[['recent', 'Recientes'], ['az', 'A–Z'], ['category', 'Categoría'], ['rating', '⭐ Valoración']].map(([key, label]) => (
                        <button key={key} className={`recipe-sort-btn${recipeSort === key ? ' active' : ''}`} onClick={() => setRecipeSort(key)}>{label}</button>
                      ))}
                      <button
                        className="recipe-sort-btn recipe-sort-dir"
                        onClick={() => setRecipeReverse((r) => !r)}
                        title={recipeReverse ? 'Orden invertido (pulsa para volver al normal)' : 'Invertir el orden'}
                      >
                        {recipeReverse ? '↑' : '↓'}
                      </button>
                    </div>
                  </div>
                )}
                {filteredRecipes.length === 0 && (
                  <p className="tray-empty">{savedRecipes.length === 0 ? 'Aún no hay recetas. Se guardan automáticamente al crear platos.' : 'Sin resultados para esa búsqueda.'}</p>
                )}
                <div className="dishes-tray-list">
                  {filteredRecipes.map((recipe) => (
                    <RecipePostit
                      key={recipe.id}
                      item={recipe}
                      ingredients={ingredients}
                      savedIds={savedIngredientIds(dishIngMap, recipe.name)}
                      usageCount={recipeUsageCount[recipe.name?.toLowerCase()] || 0}
                      onOpenDetail={() => setRecipeDetailId(recipe.id)}
                      onPlan={() => setPlanPicker({ mode: 'recipe', name: recipe.name })}
                      onCart={() => setCartRecipeId(recipe.id)}
                      onSelect={() => { if (!recipe.name) return; if (isMobile) setPlanPicker({ mode: 'recipe', name: recipe.name }); else { setPendingRecipeName(recipe.name); setTrayTab('pool') } }}
                      onUpdate={(patch) => updateRecipe(recipe.id, patch)}
                      onDelete={() => deleteRecipe(recipe.id)}
                    />
                  ))}
                </div>
              </div>
            </DroppableTrayZone>
          )}
        </div>
        </div>{/* /app-main */}

        {shoppingOpen && (
          <div className="sidebar-overlay" onClick={() => setShoppingOpen(false)} />
        )}
        <aside className={`sidebar${shoppingOpen ? ' mobile-open' : ''}`}>
          <div className="sidebar-header">
            <h2>
              <ShoppingCart size={16} />
              Lista de la compra
              {totalItems > 0 && <span className="sidebar-count">({totalItems})</span>}
            </h2>
            <div className="sidebar-actions">
              {dismissedIds.size > 0 && (
                <button className="sidebar-icon-btn" title="Restaurar lista" onClick={clearDismissed}>
                  <RotateCcw size={14} />
                </button>
              )}
              {purchasedIds.size > 0 && (
                <button className="sidebar-icon-btn" title="Desmarcar todo" onClick={clearPurchased}>
                  <X size={14} />
                </button>
              )}
              {totalItems > 0 && (
                <button className="sidebar-icon-btn" title="Compartir por WhatsApp" onClick={handleShareWhatsApp}>
                  <Share2 size={15} />
                </button>
              )}
              <button className="sidebar-icon-btn" title="Historial de listas" onClick={handleOpenHistory}>
                <History size={16} />
              </button>
              <button className="sidebar-mobile-close modal-close" onClick={() => setShoppingOpen(false)}>
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="sidebar-body">
            {totalCheckable > 0 && (
              <div className="shopping-progress">
                <div className="shopping-progress-bar">
                  <div className="shopping-progress-fill" style={{ width: `${Math.round((purchasedCount / totalCheckable) * 100)}%` }} />
                </div>
                <span className="shopping-progress-label">{purchasedCount} de {totalCheckable}</span>
              </div>
            )}
            {shoppingList.length === 0 && customItems.length === 0 ? (
              <p className="sidebar-empty">
                Añade platos al tablero o escribe artículos extra para ver la lista aquí.
              </p>
            ) : (
              <>
                {(() => {
                  const allCategories = [...new Set([
                    ...shoppingList.map((c) => c.category),
                    ...customItems.map((i) => i.category || 'Otros'),
                  ])]
                  return allCategories.map((category) => {
                    const regular = shoppingList.find((c) => c.category === category)?.items || []
                    const custom = customItems.filter((i) => (i.category || 'Otros') === category)
                    if (!regular.length && !custom.length) return null
                    return (
                      <DroppableShoppingCat key={category} category={category}>
                        <div className="shopping-category-title" style={{ borderLeft: `3px solid ${CATEGORY_COLORS[category] ?? 'var(--accent)'}`, paddingLeft: 8 }}>{category}</div>
                        {regular.map(({ ingredient, dishes }) => (
                          <ShoppingRow
                            key={ingredient.id}
                            name={ingredient.name}
                            checked={purchasedIds.has(ingredient.id)}
                            onCheck={() => togglePurchased(ingredient.id)}
                            note={dishes.length > 2
                              ? `${dishes.slice(0, 2).map(titleCase).join(', ')} +${dishes.length - 2}`
                              : dishes.map(titleCase).join(', ')}
                            onRemove={() => addDismissed([ingredient.id])}
                            removeTitle="Ya lo tengo: quitar de la lista"
                            nameProps={{
                              onMouseEnter: (e) => setPopover({ ingredient, position: { x: e.clientX, y: e.clientY } }),
                              onMouseLeave: () => setPopover(null),
                            }}
                          />
                        ))}
                        {custom.map((item) => (
                          <DraggableCustomShoppingItem
                            key={item.id}
                            item={item}
                            isPurchased={purchasedIds.has('custom_' + item.id)}
                            onCheck={() => toggleCustomItem(item.id)}
                            onDelete={() => removeCustomItem(item.id)}
                          />
                        ))}
                      </DroppableShoppingCat>
                    )
                  })
                })()}
              </>
            )}
            <div className="shopping-footer-sticky">
              <button
                className="btn-clear-purchased"
                onClick={handleSaveAndClear}
                disabled={savingList || purchasedCount === 0}
                style={{ opacity: purchasedCount === 0 ? 0.45 : 1, marginTop: 0 }}
              >
                {savingList ? 'Guardando…' : 'Guardar seleccionados'}
              </button>
            </div>
            <div className="custom-item-add">
              <input
                type="text"
                className="custom-item-input"
                placeholder="Añadir artículo extra…"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customInput.trim()) {
                    addCustomItem(customInput.trim())
                    setCustomInput('')
                  }
                }}
              />
              <button
                className="custom-item-btn"
                disabled={!customInput.trim()}
                onClick={() => { addCustomItem(customInput.trim()); setCustomInput('') }}
              ><Plus size={13} /></button>
            </div>
          </div>
        </aside>
        </DndContext>
      </div>{/* /app-body */}

      {isMobile && (
        <nav className="mobile-nav">
          <button className={mobileTab === 'menu' && !shoppingOpen ? 'active' : ''} onClick={() => { setMobileTab('menu'); setShoppingOpen(false) }}>
            <CalendarDays size={20} /><span>Menú</span>
          </button>
          <button className={mobileTab === 'tray' && trayTab === 'pool' && !shoppingOpen ? 'active' : ''} onClick={() => { setMobileTab('tray'); setTrayTab('pool'); setShoppingOpen(false) }}>
            <Package size={20} /><span>Despensa</span>
          </button>
          <button className={mobileTab === 'tray' && trayTab === 'recipes' && !shoppingOpen ? 'active' : ''} onClick={() => { setMobileTab('tray'); setTrayTab('recipes'); setShoppingOpen(false) }}>
            <BookOpen size={20} /><span>Recetas</span>
          </button>
          <button className={shoppingOpen ? 'active' : ''} onClick={() => setShoppingOpen(true)}>
            <span className="mobile-nav-icon"><ShoppingCart size={20} />{totalItems > 0 && <span className="fab-badge">{totalItems}</span>}</span>
            <span>Compra</span>
          </button>
        </nav>
      )}

      {addModal && (
        <DishModal
          mode="add"
          dayIdx={addModal.dayIdx}
          slotKey={addModal.slotKey}
          startDayOfWeek={startDayOfWeek}
          ingredients={ingredients}
          slots={slots}
          onClose={() => setAddModal(null)}
          onSave={handleSaveDish}
          onIngredientAdded={handleIngredientAdded}
          savedRecipes={savedRecipes}
          initialName={addModal.initialName || ''}
          dishIngMap={dishIngMap}
        />
      )}
      {editModal && (
        <DishModal
          mode="edit"
          slot={editModal}
          ingredients={ingredients}
          slots={slots}
          onClose={() => setEditModal(null)}
          onSave={handleEditDish}
          onIngredientAdded={handleIngredientAdded}
          savedRecipes={savedRecipes}
        />
      )}

      {popover && (
        <IngredientPopover
          ingredient={popover.ingredient}
          slots={slots}
          position={popover.position}
        />
      )}

      {historyOpen && (
        <ShoppingHistoryModal
          history={shoppingHistory}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {contextMenu && (
        <PostitContextMenu
          menu={contextMenu}
          onOpen={(slot) => openRecipeByName(slot.dish_name)}
          onEdit={(slot) => setEditModal(slot)}
          onDelete={(slot) => handleDelete(slot.id)}
          onRecipe={(slot) => setRecipeModal(slot)}
          onCopy={(slot) => { if (isMobile) { setPlanPicker({ mode: 'copy', slot }); return } setCopyingSlot(slot); setMovingSlot(null); showToast(`Copiando "${titleCase(slot.dish_name)}" — elige dónde pegar`) }}
          onMove={(slot) => { if (isMobile) { setPlanPicker({ mode: 'move', slot }); return } setMovingSlot(slot); setCopyingSlot(null); showToast(`Moviendo "${titleCase(slot.dish_name)}" — elige destino`) }}
          onSendToPool={(slot) => {
            addPoolItem({ dish_name: slot.dish_name })
            handleDelete(slot.id)
            showToast(`"${titleCase(slot.dish_name)}" movido a la despensa`)
          }}
          onChangeType={handleChangeType}
          onClose={() => setContextMenu(null)}
        />
      )}

      {recipeModal && (
        <RecipeModal slot={recipeModal} onClose={() => setRecipeModal(null)} />
      )}

      {/* Asistente: las dos pestañas siguen montadas para no perder lo generado al cambiar de una a otra */}
      {assistant && (
        <AIRecipeProposalsModal
          hidden={assistant !== 'ideas'}
          tabs={<AssistantTabs active={assistant} onChange={setAssistant} />}
          savedRecipes={savedRecipes}
          ingredients={ingredients}
          availableIds={pantryIngredients.map((p) => p.ingredient_id).filter(Boolean)}
          onClose={() => setAssistant(null)}
          onAdd={handleAddProposal}
        />
      )}

      {planPicker && (
        <PlanPicker
          title={planPicker.mode === 'move' ? 'Mover a…' : planPicker.mode === 'copy' ? 'Copiar a…' : 'Añadir al menú'}
          startDayOfWeek={startDayOfWeek}
          weekKey={weekKey}
          initialDay={selectedDay}
          onClose={() => setPlanPicker(null)}
          onPick={handlePlanPick}
        />
      )}

      {pantryModal && (
        <PantryModal
          mode={pantryModal.mode}
          item={pantryModal.item}
          ingredients={ingredients}
          onClose={() => setPantryModal(null)}
          onSave={handleSavePantry}
          onIngredientAdded={handleIngredientAdded}
        />
      )}

      {/* El menú sugerido va antes que el editor de receta para que el editor se abra por encima */}
      {assistant && (
        <AutoMenuModal
          hidden={assistant !== 'menu'}
          tabs={<AssistantTabs active={assistant} onChange={setAssistant} />}
          slots={slots}
          allSlots={allSlots}
          poolItems={poolDishes}
          availableIds={pantryIngredients.map((p) => p.ingredient_id).filter(Boolean)}
          savedRecipes={savedRecipes}
          ingredients={ingredients}
          dishIngMap={dishIngMap}
          allTags={allTags}
          weekKey={weekKey}
          nextWeekKey={nextWeekKey}
          startDayOfWeek={startDayOfWeek}
          onClose={() => setAssistant(null)}
          onConfirm={handleAutoMenuConfirm}
          onOpenRecipe={openRecipeByName}
        />
      )}

      {recipeDetailId && savedRecipes.find((r) => r.id === recipeDetailId) && (
        <RecipeDetailModal
          recipe={savedRecipes.find((r) => r.id === recipeDetailId)}
          ingredients={ingredients}
          dishIngMap={dishIngMap}
          onClose={() => setRecipeDetailId(null)}
          onSave={handleSaveRecipeDetail}
          onIngredientAdded={handleIngredientAdded}
          onCart={(recipe, ids) => { setRecipeDetailId(null); setCartRecipeId(recipe.id); setCartIdsOverride(ids) }}
        />
      )}

      {cartRecipeId && savedRecipes.find((r) => r.id === cartRecipeId) && (
        <RecipeCartModal
          recipe={savedRecipes.find((r) => r.id === cartRecipeId)}
          ingredientIds={cartIdsOverride || savedIngredientIds(dishIngMap, savedRecipes.find((r) => r.id === cartRecipeId).name)}
          ingredients={ingredients}
          onClose={() => { setCartRecipeId(null); setCartIdsOverride(null) }}
          onConfirm={(selected) => { handleRecipeToCart(selected, savedRecipes.find((r) => r.id === cartRecipeId)?.name); setCartIdsOverride(null) }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
