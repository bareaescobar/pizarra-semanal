import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
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

const DISH_KEYWORDS = {
  'Carnes':                ['pollo', 'pechuga', 'muslo', 'ternera', 'cerdo', 'cordero', 'pavo', 'conejo', 'costilla', 'albóndiga', 'hamburguesa', 'filete', 'chuleta', 'lomo', 'salchicha', 'chorizo', 'carne'],
  'Pescados y Mariscos':   ['merluza', 'salmón', 'atún', 'bacalao', 'gambas', 'langostino', 'mejillón', 'pulpo', 'calamar', 'sepia', 'dorada', 'lubina', 'sardina', 'boquerón', 'rape', 'pescado', 'marisco'],
  'Verduras y Hortalizas': ['ensalada', 'espinaca', 'brócoli', 'zanahoria', 'calabacín', 'pimiento', 'berenjena', 'tomate', 'lechuga', 'menestra', 'verdura', 'acelga'],
  'Pasta y Arroz':         ['pasta', 'macarrón', 'espagueti', 'arroz', 'paella', 'fideos', 'lasaña', 'risotto', 'canelón', 'tallarín'],
  'Legumbres y Cereales':  ['lentejas', 'garbanzos', 'alubias', 'judías', 'fabes', 'potaje', 'fabada'],
  'Guisos':                ['guiso', 'estofado', 'cocido', 'puchero', 'caldo', 'sopa', 'crema', 'puré', 'caldereta', 'rabo'],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function getDominantCategory(ingredientIds, allIngredients, dishName) {
  if (ingredientIds?.length) {
    const counts = {}
    for (const id of ingredientIds) {
      const ing = allIngredients.find((i) => i.id === id)
      if (ing) counts[ing.category] = (counts[ing.category] || 0) + 1
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (top) return top
  }
  return dishName ? guessCategoryFromName(dishName) : null
}

function getDominantCategoryColor(ingredientIds, allIngredients) {
  const cat = getDominantCategory(ingredientIds, allIngredients)
  return cat ? (CATEGORY_COLORS[cat] ?? null) : null
}

function guessCategoryFromName(name) {
  const lower = name.toLowerCase()
  for (const [cat, kws] of Object.entries(DISH_KEYWORDS)) {
    if (kws.some((kw) => lower.includes(kw))) return cat
  }
  return null
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

async function callGemini(dishName, effortLevel, ingredientNames) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY no configurada')

  const effortDesc =
    effortLevel === 1
      ? 'fácil (usando preparados y conservas)'
      : effortLevel === 2
      ? 'medio (mezcla de frescos y preparados)'
      : 'casero (todo desde cero con ingredientes frescos)'

  const prompt = `Eres un asistente de cocina español. Para el plato "${dishName}" con nivel de esfuerzo ${effortDesc}, necesito dos cosas:
1. Ingredientes de esta lista que se necesitan para el plato: ${ingredientNames.join(', ')}
2. Ingredientes adicionales importantes para este plato que NO aparecen en la lista anterior (máximo 5, nombres simples en español)

Responde ÚNICAMENTE con este JSON (sin texto adicional):
{"existing": ["nombre exacto tal como aparece en la lista", ...], "new": ["ingrediente nuevo en español", ...]}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: 'application/json' },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Gemini error ${res.status}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Respuesta vacía de Gemini')
  const parsed = JSON.parse(text)
  return {
    existing: Array.isArray(parsed.existing) ? parsed.existing : [],
    new: Array.isArray(parsed.new) ? parsed.new : [],
  }
}

async function callGeminiRecipe(dishName) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY no configurada')
  const prompt = `Explica cómo preparar "${dishName}" de forma sencilla para un cocinero doméstico. Máximo 6 pasos cortos y claros. Responde en español, sin formato markdown, solo texto plano con pasos numerados.`
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `Error ${res.status}`) }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Respuesta vacía')
  return text.trim()
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

function DraggableCustomShoppingItem({ item, isPurchased, onCheck, onDelete }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: `shopping-custom-${item.id}` })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 }
  return (
    <div ref={setNodeRef} style={style} className={`shopping-item${isPurchased ? ' purchased' : ''}`}>
      <span ref={setActivatorNodeRef} className="shopping-drag-handle" {...attributes} {...listeners}>⠿</span>
      <input type="checkbox" checked={isPurchased} onChange={onCheck} />
      <span className="shopping-item-name">{titleCase(item.name)}</span>
      <button className="postit-btn delete" style={{ opacity: 0.5, flexShrink: 0 }} onPointerDown={(e) => e.stopPropagation()} onClick={onDelete}><X size={10} /></button>
    </div>
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

function DraggablePostit({ slot, ingredients, colorOverrides, onEdit, onDelete, onContextMenu }) {
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
      className={`postit${isDragging ? ' dragging' : ''}`}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, slot) }}
    >
      <PostitContent
        slot={slot}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleRef={setActivatorNodeRef}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  )
}

function PostitContent({ slot, onEdit, onDelete, dragHandleRef, dragListeners, dragAttributes }) {
  const effort = slot.effort_override || 1
  return (
    <>
      <div className="postit-header">
        <span className="postit-name">{titleCase(slot.dish_name)}</span>
        <div className="postit-actions">
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

function DishModal({ mode, slot, dayIdx, slotKey, startDayOfWeek, ingredients, slots, onClose, onSave, onIngredientAdded, savedRecipes = [], initialName = '' }) {
  const [dishName, setDishName] = useState(mode === 'edit' ? slot.dish_name : initialName)
  const [effort, setEffort] = useState(mode === 'edit' ? (slot.effort_override || 1) : 1)
  const [selectedIds, setSelectedIds] = useState(mode === 'edit' ? (slot.ingredient_ids || []) : [])
  const [search, setSearch] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [addingCustom, setAddingCustom] = useState(false)
  const [aiNewSuggestions, setAiNewSuggestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showSugg, setShowSugg] = useState(false)
  const inputRef = useRef(null)

  const suggestions = useMemo(() => {
    if (!dishName.trim()) return []
    const q = dishName.toLowerCase()
    return savedRecipes.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 6)
  }, [dishName, savedRecipes])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

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

  // Ordenar por uso DESC, luego alfabético; filtrar por búsqueda
  const filteredIngredients = useMemo(() => {
    const q = search.toLowerCase().trim()
    const sorted = [...ingredients].sort((a, b) => {
      const ua = usageCount[a.id] || 0
      const ub = usageCount[b.id] || 0
      if (ub !== ua) return ub - ua
      return a.name.localeCompare(b.name, 'es')
    })
    if (!q) return sorted
    return sorted.filter((i) => i.name.toLowerCase().includes(q))
  }, [ingredients, usageCount, search])

  const exactMatch = search.trim()
    ? ingredients.some((i) => i.name.toLowerCase() === search.toLowerCase().trim())
    : true

  const toggleIngredient = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleAddCustom = async () => {
    const name = search.trim()
    if (!name || addingCustom) return
    setAddingCustom(true)
    try {
      const newIng = await dbInsert('v2_ingredients', { name, category: 'Otros', is_custom: true })
      onIngredientAdded(newIng)
      setSelectedIds((prev) => [...prev, newIng.id])
      setSearch('')
    } catch (e) {
      setError('Error al añadir ingrediente: ' + e.message)
    } finally {
      setAddingCustom(false)
    }
  }

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

            {/* Buscador */}
            <div className="ingredient-search-wrap">
              <Search size={14} className="ingredient-search-icon" />
              <input
                className="ingredient-search"
                placeholder="Buscar ingrediente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="ingredient-search-clear" onClick={() => setSearch('')}>
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="chips-area">
              {/* Selected chips at top */}
              {filteredIngredients.filter((i) => selectedIds.includes(i.id)).map((ing) => (
                <button
                  key={ing.id}
                  className={`chip selected${(usageCount[ing.id] || 0) > 0 ? ' used' : ''}`}
                  onClick={() => toggleIngredient(ing.id)}
                  title={usageCount[ing.id] ? `Usado en ${usageCount[ing.id]} plato(s)` : ''}
                >
                  {ing.name}
                  {(usageCount[ing.id] || 0) > 0 && (
                    <span className="chip-usage">{usageCount[ing.id]}</span>
                  )}
                </button>
              ))}

              {/* Separator between selected and unselected */}
              {filteredIngredients.some((i) => selectedIds.includes(i.id)) &&
               filteredIngredients.some((i) => !selectedIds.includes(i.id)) && (
                <div className="chips-separator" />
              )}

              {/* Unselected chips */}
              {filteredIngredients.filter((i) => !selectedIds.includes(i.id)).map((ing) => (
                <button
                  key={ing.id}
                  className={`chip${(usageCount[ing.id] || 0) > 0 ? ' used' : ''}`}
                  onClick={() => toggleIngredient(ing.id)}
                  title={usageCount[ing.id] ? `Usado en ${usageCount[ing.id]} plato(s)` : ''}
                >
                  {ing.name}
                  {(usageCount[ing.id] || 0) > 0 && (
                    <span className="chip-usage">{usageCount[ing.id]}</span>
                  )}
                </button>
              ))}

              {search.trim() && !exactMatch && (
                <button
                  className="chip chip-add-custom"
                  onClick={handleAddCustom}
                  disabled={addingCustom}
                >
                  <Plus size={11} />
                  {addingCustom ? 'Añadiendo…' : `Añadir "${search.trim()}"`}
                </button>
              )}

              {filteredIngredients.length === 0 && !search.trim() && (
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No hay ingredientes</span>
              )}

              {aiNewSuggestions.length > 0 && (
                <div className="ai-new-section">
                  <span className="ai-new-label">✨ Sugeridos por IA — no están en tu lista</span>
                  {aiNewSuggestions.map((name) => (
                    <button
                      key={name}
                      className="chip chip-ai-new"
                      onClick={() => handleAddAiNew(name)}
                    >
                      <Plus size={11} />
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {selectedIds.length} ingrediente{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''}
              </div>
            )}
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

function RecipePostit({ item, onUpdate, onDelete, onSelect, ingredients = [], usageCount = 0 }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: `recipe-${item.id}` })
  const [editing, setEditing] = useState(!item.name)
  const [draft, setDraft] = useState(item.name)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState(item.description || '')
  const [tagInput, setTagInput] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => { setNotesDraft(item.description || '') }, [item.description])

  const category = getDominantCategory([], ingredients, item.name)
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
        <button
          className={`postit-btn${hasNotes || notesOpen ? ' notes-active' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setNotesOpen((o) => !o)}
          title={notesOpen ? 'Cerrar notas' : 'Notas y etiquetas'}
        >
          <Tag size={11} />
        </button>
        <div ref={setActivatorNodeRef} {...listeners} {...attributes} className="drag-handle" title="Arrastrar al tablero">
          <GripVertical size={12} />
        </div>
      </div>
    </div>
  )
}

// ─── AutoMenuModal ─────────────────────────────────────────────────────────────

function AutoMenuModal({ slots, poolItems, savedRecipes, ingredients, weekKey, nextWeekKey, startDayOfWeek, onClose, onConfirm }) {
  function shuffleArr(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function generate() {
    const candidates = [...new Set([
      ...poolItems.filter((p) => p.dish_name).map((p) => p.dish_name),
      ...savedRecipes.filter((r) => r.name).map((r) => r.name),
    ])]
    if (!candidates.length) return []

    const proposals = []

    for (const slot of SLOTS) {
      const shuffled = shuffleArr(candidates)
      let si = 0

      for (let i = 0; i < 7; i++) {
        const absIdx = (startDayOfWeek + i) % 7
        const colWk = startDayOfWeek + i >= 7 ? nextWeekKey : weekKey
        const existing = slots.find(
          (s) => s.day_idx === absIdx && s.slot_key === slot.key && s.week_key === colWk
        )
        if (existing) {
          proposals.push({ displayDay: i, slotKey: slot.key, dishName: existing.dish_name, isExisting: true })
          continue
        }

        const prevEntry = proposals.find((p) => p.displayDay === i - 1 && p.slotKey === slot.key)
        const prevCat = prevEntry ? getDominantCategory([], ingredients, prevEntry.dishName) : null

        let chosen = null
        for (let attempt = 0; attempt < shuffled.length; attempt++) {
          const candidate = shuffled[(si + attempt) % shuffled.length]
          const cat = getDominantCategory([], ingredients, candidate)
          if (!prevCat || !cat || cat !== prevCat) {
            chosen = candidate
            si = (si + attempt + 1) % shuffled.length
            break
          }
        }
        if (!chosen) { chosen = shuffled[si % shuffled.length]; si = (si + 1) % shuffled.length }
        proposals.push({ displayDay: i, slotKey: slot.key, dishName: chosen, isExisting: false })
      }
    }
    return proposals
  }

  const [proposals, setProposals] = useState(() => generate())

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal auto-menu-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Sugerencia de semana</h2>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
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
                {Array.from({ length: 7 }, (_, i) => {
                  const entry = proposals.find((p) => p.displayDay === i && p.slotKey === slot.key)
                  const cat = entry ? getDominantCategory([], ingredients, entry.dishName) : null
                  const bg = entry && !entry.isExisting ? (cat ? (CATEGORY_PASTELS[cat] ?? CATEGORY_PASTELS['Otros']) : CATEGORY_PASTELS['Otros']) : undefined
                  return (
                    <div key={i} className={`auto-menu-cell${entry?.isExisting ? ' existing' : ' proposed'}`} style={bg ? { background: bg } : {}}>
                      {entry ? titleCase(entry.dishName) : '—'}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
          {proposals.length === 0 && (
            <p className="auto-menu-empty">Añade platos a tu despensa o recetas para poder generar un menú.</p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setProposals(generate())}>
            <RotateCcw size={14} /> Re-generar
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn"
            disabled={proposals.filter((p) => !p.isExisting).length === 0}
            onClick={() => onConfirm(proposals.filter((p) => !p.isExisting))}
          >
            Guardar propuesta
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PoolPostit ───────────────────────────────────────────────────────────────

function PoolPostit({ item, ingredients, onUpdate, onDelete, onContextMenu }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: `pool-${item.id}` })
  const [editing, setEditing] = useState(!item.dish_name)
  const [draft, setDraft] = useState(item.dish_name)
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const category = getDominantCategory([], ingredients, item.dish_name)
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
          <button className="postit-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => setEditing(true)} title="Editar nombre">
            <Pencil size={11} />
          </button>
          <button className="postit-btn delete" onPointerDown={(e) => e.stopPropagation()} onClick={onDelete}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div className="postit-footer">
        <div />
        <div ref={setActivatorNodeRef} {...listeners} {...attributes} className="drag-handle" title="Arrastrar al tablero">
          <GripVertical size={12} />
        </div>
      </div>
    </div>
  )
}

// ─── PostitContextMenu ────────────────────────────────────────────────────────

function PostitContextMenu({ menu, onRecipe, onCopy, onMove, onSendToPool, onChangeType, onClose }) {
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
      style={{ top: menu.y, left: menu.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
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

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const hash = await sha256Hex(password)
      const users = await dbGet('v2_users', { username: username.trim().toLowerCase() })
      if (!users.length) {
        setError(`Usuario "${username.trim()}" no encontrado. ¿Ejecutaste supabase-migration.sql?`)
      } else if (users[0].password_hash !== hash) {
        setError('Contraseña incorrecta.')
      } else {
        onLogin({ id: users[0].id, username: users[0].username })
      }
    } catch (err) {
      setError('Error de conexión: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>🗒️ Pizarra Semanal</h1>
        <p className="login-sub">Inicia sesión para gestionar tu pizarra</p>
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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

async function callGeminiProposals(prefs, history) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY no configurada')
  const histStr = history.length ? history.slice(0, 30).join(', ') : 'ninguna'
  const prompt = `Eres un asistente de cocina española. Sugiere 5 ideas de platos sencillos basándote en estas preferencias:
- Tipo de comida: ${prefs.mealType || 'cualquiera'}
- Tiempo máximo: ${prefs.maxTime || 'sin límite'}
- Ingrediente principal o restricción: ${prefs.mainOrAvoid || 'sin restricción'}
- Otras notas: ${prefs.notes || 'ninguna'}

El usuario ya tiene en su historial: ${histStr}. Sugiere recetas DIFERENTES a las del historial cuando sea posible.

Responde ÚNICAMENTE con este JSON (sin markdown):
{"proposals":[{"name":"Nombre del plato","description":"Descripción muy breve en 1-2 frases"}]}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: 'application/json' },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Error ${res.status}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Respuesta vacía')
  const parsed = JSON.parse(text)
  return Array.isArray(parsed.proposals) ? parsed.proposals : []
}

function AIRecipeProposalsModal({ savedRecipes, onClose, onAdd }) {
  const [step, setStep] = useState('form') // 'form' | 'list'
  const [prefs, setPrefs] = useState({ mealType: '', maxTime: '', mainOrAvoid: '', notes: '' })
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [recipeView, setRecipeView] = useState(null) // { name, body, loading }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const list = await callGeminiProposals(prefs, savedRecipes.map((r) => r.name))
      setProposals(list)
      setStep('list')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function viewRecipe(name) {
    setRecipeView({ name, body: null, loading: true, error: null })
    try {
      const body = await callGeminiRecipe(name)
      setRecipeView({ name, body, loading: false, error: null })
    } catch (e) {
      setRecipeView({ name, body: null, loading: false, error: e.message })
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>💡 Propuestas IA</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {step === 'form' && (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Cuéntanos qué te apetece y la IA propondrá 5 platos sencillos basados en tu historial.
              </p>
              <div className="form-field">
                <label className="form-label">Tipo de comida</label>
                <div className="effort-selector">
                  {['Comida', 'Cena', 'Cualquiera'].map((t) => (
                    <button
                      key={t}
                      className={`effort-btn${prefs.mealType === t ? ' selected-1' : ''}`}
                      onClick={() => setPrefs((p) => ({ ...p, mealType: t }))}
                      type="button"
                    >{t}</button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Tiempo máximo</label>
                <div className="effort-selector">
                  {['15 min', '30 min', '1 h', 'Sin prisa'].map((t) => (
                    <button
                      key={t}
                      className={`effort-btn${prefs.maxTime === t ? ' selected-2' : ''}`}
                      onClick={() => setPrefs((p) => ({ ...p, maxTime: t }))}
                      type="button"
                    >{t}</button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Ingrediente principal o lo que evitar</label>
                <input
                  className="form-input"
                  placeholder="Ej: pollo, sin gluten…"
                  value={prefs.mainOrAvoid}
                  onChange={(e) => setPrefs((p) => ({ ...p, mainOrAvoid: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Otras notas</label>
                <input
                  className="form-input"
                  placeholder="Ej: ligero, casero…"
                  value={prefs.notes}
                  onChange={(e) => setPrefs((p) => ({ ...p, notes: e.target.value }))}
                />
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
                      <div className="proposal-desc">{p.description}</div>
                      <div className="proposal-actions">
                        <button className="btn btn-ghost" type="button" onClick={() => viewRecipe(p.name)}>
                          Ver receta
                        </button>
                        <button className="btn btn-primary" type="button" onClick={() => onAdd(p.name)}>
                          <Plus size={12} /> Añadir
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
            <button className="btn btn-ghost" onClick={() => setStep('form')}>Volver</button>
          )}
          {step === 'form' && (
            <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? 'Generando…' : 'Generar propuestas'}
            </button>
          )}
        </div>
      </div>

      {recipeView && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setRecipeView(null)} style={{ zIndex: 250 }}>
          <div className="modal">
            <div className="modal-header">
              <h3>🍳 {titleCase(recipeView.name)}</h3>
              <button className="modal-close" onClick={() => setRecipeView(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {recipeView.loading ? (
                <div className="ai-loading"><div className="spinner" />Cargando receta…</div>
              ) : recipeView.error ? (
                <p style={{ color: 'var(--red)', fontSize: 13 }}>{recipeView.error}</p>
              ) : (
                <div className="recipe-content">
                  {recipeView.body.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} style={{ marginBottom: 8, lineHeight: 1.6 }}>{line}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRecipeView(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('currentUser') || 'null') } catch { return null }
  })

  function handleLogin(user) {
    localStorage.setItem('currentUser', JSON.stringify(user))
    setCurrentUser(user)
  }
  function handleLogout() {
    localStorage.removeItem('currentUser')
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
  const [aiProposalsOpen, setAiProposalsOpen] = useState(false)

  // ─── DB-backed mutations (writes broadcast via Supabase realtime) ──────────
  async function reloadPool() {
    try { setPoolItems(await dbGet('v2_pool_items')) } catch {}
  }
  async function addPoolItem(item) {
    const row = { id: Date.now().toString(), dish_name: '', effort: 1, ...item }
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
    const row = { id: Date.now().toString(), name }
    setSavedRecipes((prev) => [...prev, row])
    try { await dbInsert('v2_saved_recipes', row) } catch { reloadRecipes() }
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
    const row = { id: Date.now().toString(), week_key: weekKey, ...item }
    setCustomItems((prev) => [...prev, row])
    try { await dbInsert('v2_custom_items', row) } catch { reloadCustomItems() }
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
  const [recipeSort, setRecipeSort] = useState('recent')
  const [selectedTag, setSelectedTag] = useState(null)
  const [autoMenuOpen, setAutoMenuOpen] = useState(false)

  const initDone = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
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
    const channels = [
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

  async function handleCopySlot(dayIdx, slotKey) {
    if (!copyingSlot) return
    try {
      await handleSaveDish({
        dishName: copyingSlot.dish_name,
        effort: copyingSlot.effort_override || 1,
        selectedIds: copyingSlot.ingredient_ids || [],
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

  async function handleMoveSlot(dayIdx, slotKey) {
    if (!movingSlot) return
    try {
      if (movingSlot.isPool) {
        await handleSaveDish({ dishName: movingSlot.dish_name, effort: 1, selectedIds: [], dayIdx, slotKey })
        deletePoolItem(movingSlot.id)
      } else {
        const absIdx = (startDayOfWeek + dayIdx) % 7
        const colWk = startDayOfWeek + dayIdx >= 7 ? nextWeekKey : weekKey
        await dbUpdate('v2_board_slots', movingSlot.id, {
          week_key: colWk,
          day_idx: absIdx,
          slot_key: slotKey,
          position: Date.now(),
        })
        setSlots((prev) => prev.map((s) =>
          s.id === movingSlot.id ? { ...s, week_key: colWk, day_idx: absIdx, slot_key: slotKey } : s
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
    setPurchasedIds((prev) => {
      const next = new Set(prev)
      if (next.has('custom_' + id)) next.delete('custom_' + id)
      else next.add('custom_' + id)
      return next
    })
  }

  async function handleAutoMenuConfirm(proposals) {
    setAutoMenuOpen(false)
    for (const p of proposals) {
      try {
        await handleSaveDish({ dishName: p.dishName, effort: 1, selectedIds: [], dayIdx: p.displayDay, slotKey: p.slotKey })
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
          selectedIds: [],
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
    setPurchasedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
    setPurchasedIds(new Set())

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
  const dietWarnings = useMemo(() => getDietWarnings(slots, ingredients, colorOverrides, startDayOfWeek, weekKey, nextWeekKey), [slots, ingredients, colorOverrides, startDayOfWeek, weekKey, nextWeekKey])

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
    if (recipeSearch.trim()) {
      const q = recipeSearch.toLowerCase()
      result = result.filter((r) => r.name.toLowerCase().includes(q))
    }
    if (recipeSort === 'az') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    } else if (recipeSort === 'category') {
      result = [...result].sort((a, b) => {
        const catA = getDominantCategory([], ingredients, a.name) || 'Ω'
        const catB = getDominantCategory([], ingredients, b.name) || 'Ω'
        return catA.localeCompare(catB, 'es') || a.name.localeCompare(b.name, 'es')
      })
    } else if (recipeSort === 'rating') {
      result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name, 'es'))
    }
    return result
  }, [savedRecipes, recipeSearch, recipeSort, ingredients, selectedTag])

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <span>Cargando pizarra…</span>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🗒️ Pizarra Semanal</h1>
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
        <button className="logout-btn" onClick={handleLogout} title={`Cerrar sesión (${currentUser.username})`}>
          <LogOut size={14} />
          <span className="logout-name">{currentUser.username}</span>
        </button>
      </header>

      <div className="app-body">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="app-main">
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
          {dietWarnings.length > 0 && (
            <div className="diet-warnings">
              {dietWarnings.map((w, i) => (
                <div key={i} className="diet-warning">
                  ⚠️ <strong>{w.category}</strong> varios días seguidos: {w.days.join(', ')}
                </div>
              ))}
            </div>
          )}
            <div className="board">
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
                  {DAYS.map((_, i) => {
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
                            colorOverrides={colorOverrides}
                            onEdit={() => setEditModal(s)}
                            onDelete={handleDelete}
                            onContextMenu={(e, slot) => setContextMenu({ x: e.clientX, y: e.clientY, slot })}
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
                  })}
                </React.Fragment>
              ))}
            </div>

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
                const cat = colorOverrides[s.id] || getDominantCategory(s.ingredient_ids, ingredients, s.dish_name)
                const bg = cat ? (CATEGORY_PASTELS[cat] ?? CATEGORY_PASTELS['Otros']) : CATEGORY_PASTELS['Otros']
                return <div className="postit-overlay" style={{ background: bg }}><span className="postit-name">{titleCase(s.dish_name)}</span></div>
              })()}
            </DragOverlay>
        </div>{/* /board-wrapper */}

        <div className="dishes-tray">
          <div className="tray-tabs">
            <button className={`tray-tab${trayTab === 'pool' ? ' active' : ''}`} onClick={() => setTrayTab('pool')}>
              Mi despensa
            </button>
            <button className={`tray-tab${trayTab === 'recipes' ? ' active' : ''}`} onClick={() => setTrayTab('recipes')}>
              Recetas{savedRecipes.length > 0 && <span className="tray-tab-count">{savedRecipes.length}</span>}
            </button>
            {trayTab === 'pool' && (
              <button className="btn-add-slot tray-add-btn" onClick={() => addPoolItem()}>
                <Plus size={11} /> Nuevo
              </button>
            )}
            {trayTab === 'recipes' && (
              <>
                <button className="btn-add-slot tray-add-btn" onClick={() => addRecipe('')}>
                  <Plus size={11} /> Receta
                </button>
                <button className="btn-add-slot tray-add-btn tray-ai-btn" onClick={() => setAiProposalsOpen(true)}>
                  <Lightbulb size={11} /> IA
                </button>
                <button className="btn-add-slot tray-add-btn" onClick={() => setAutoMenuOpen(true)} title="Sugerir semana automáticamente">
                  <Wand2 size={11} /> Sugerir
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
                  {poolItems.map((item) => (
                    <PoolPostit
                      key={item.id}
                      item={item}
                      ingredients={ingredients}
                      onUpdate={(updated) => updatePoolItem(item.id, { dish_name: updated.dish_name })}
                      onDelete={() => deletePoolItem(item.id)}
                      onContextMenu={(e, slot) => setContextMenu({ x: e.clientX, y: e.clientY, slot, isPool: true })}
                    />
                  ))}
                </div>
              </div>
            </DroppableTrayZone>
          )}

          {trayTab === 'recipes' && (
            <DroppableTrayZone id="drop-recipes">
              <div className="tray-tab-content">
                {savedRecipes.length > 0 && (
                  <div className="recipe-controls">
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
                    <input
                      className="recipe-search-input"
                      placeholder="Buscar receta…"
                      value={recipeSearch}
                      onChange={(e) => setRecipeSearch(e.target.value)}
                    />
                    <div className="recipe-sort-btns">
                      {[['recent', '↕ Recientes'], ['az', 'A–Z'], ['category', 'Categoría'], ['rating', '⭐ Valoración']].map(([key, label]) => (
                        <button key={key} className={`recipe-sort-btn${recipeSort === key ? ' active' : ''}`} onClick={() => setRecipeSort(key)}>{label}</button>
                      ))}
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
                      usageCount={recipeUsageCount[recipe.name?.toLowerCase()] || 0}
                      onSelect={() => { if (recipe.name) { setPendingRecipeName(recipe.name); setTrayTab('pool') } }}
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
                <button className="sidebar-icon-btn" title="Desmarcar todo" onClick={() => setPurchasedIds(new Set())}>
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
                          <div key={ingredient.id} className={`shopping-item${purchasedIds.has(ingredient.id) ? ' purchased' : ''}`}>
                            <input type="checkbox" checked={purchasedIds.has(ingredient.id)} onChange={() => togglePurchased(ingredient.id)} />
                            <span className="shopping-item-name"
                              onMouseEnter={(e) => setPopover({ ingredient, position: { x: e.clientX, y: e.clientY } })}
                              onMouseLeave={() => setPopover(null)}
                            >{titleCase(ingredient.name)}</span>
                            <span className="shopping-item-dishes">{dishes.length}</span>
                          </div>
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

      <button className="fab" onClick={() => setShoppingOpen(true)} title="Lista de la compra">
        <ShoppingCart size={22} />
        {totalItems > 0 && <span className="fab-badge">{totalItems}</span>}
      </button>

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
          onRecipe={(slot) => setRecipeModal(slot)}
          onCopy={(slot) => { setCopyingSlot(slot); setMovingSlot(null); showToast(`Copiando "${titleCase(slot.dish_name)}" — elige dónde pegar`) }}
          onMove={(slot) => { setMovingSlot(slot); setCopyingSlot(null); showToast(`Moviendo "${titleCase(slot.dish_name)}" — elige destino`) }}
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

      {aiProposalsOpen && (
        <AIRecipeProposalsModal
          savedRecipes={savedRecipes}
          onClose={() => setAiProposalsOpen(false)}
          onAdd={(name) => { addToSavedRecipes(name); showToast(`"${titleCase(name)}" añadida a recetas`) }}
        />
      )}

      {autoMenuOpen && (
        <AutoMenuModal
          slots={slots}
          poolItems={poolItems}
          savedRecipes={savedRecipes}
          ingredients={ingredients}
          weekKey={weekKey}
          nextWeekKey={nextWeekKey}
          startDayOfWeek={startDayOfWeek}
          onClose={() => setAutoMenuOpen(false)}
          onConfirm={handleAutoMenuConfirm}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
