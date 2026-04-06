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
  'Verduras y Hortalizas':  '#d1fae5',
  'Frutas':                 '#fce7f3',
  'Carnes':                 '#fee2e2',
  'Pescados y Mariscos':    '#dbeafe',
  'Lácteos y Huevos':       '#fef3c7',
  'Legumbres y Cereales':   '#ede9fe',
  'Pasta y Arroz':          '#fef9c3',
  'Conservas y Preparados': '#cffafe',
  'Condimentos y Especias': '#ffedd5',
  'Aceites y Vinagres':     '#ecfccb',
  'Guisos':                 '#fde8d1',
  'Comer fuera':            '#e2e8f0',
  'Otros':                  '#fef08a',
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

function getWeekKey(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday + offset * 7)
  const weekOfMonth = Math.ceil(monday.getDate() / 7)
  const M = monday.getMonth() + 1
  const D = monday.getDate()
  const Y = monday.getFullYear()
  return `${Y}-W${weekOfMonth}-${M}-${D}`
}

function getMondayFromKey(weekKey) {
  const parts = weekKey.split('-')
  const year = parseInt(parts[0])
  const month = parseInt(parts[2]) - 1
  const day = parseInt(parts[3])
  return new Date(year, month, day)
}

function formatWeekRange(weekKey) {
  const monday = getMondayFromKey(weekKey)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d) =>
    d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `${fmt(monday)} – ${fmt(sunday)}`
}

function getDayDate(weekKey, dayIdx) {
  const monday = getMondayFromKey(weekKey)
  const d = new Date(monday)
  d.setDate(monday.getDate() + dayIdx)
  return d
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

function getDietWarnings(slots, ingredients, colorOverrides) {
  const dayCats = DAYS.map((_, dayIdx) => {
    const daySlots = slots.filter((s) => s.day_idx === dayIdx)
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
        warnings.push({ category: dayCats[runStart], days: DAYS.slice(runStart, i) })
      }
      runStart = i
    }
  }
  return warnings
}

// ─── DnD components ───────────────────────────────────────────────────────────

function DroppableCell({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`board-cell${isOver ? ' drag-over' : ''}`}>
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
        <span className="postit-name">{slot.dish_name}</span>
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

function DishModal({ mode, slot, dayIdx, slotKey, ingredients, slots, onClose, onSave, onIngredientAdded }) {
  const [dishName, setDishName] = useState(mode === 'edit' ? slot.dish_name : '')
  const [effort, setEffort] = useState(mode === 'edit' ? (slot.effort_override || 1) : 1)
  const [selectedIds, setSelectedIds] = useState(mode === 'edit' ? (slot.ingredient_ids || []) : [])
  const [search, setSearch] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [addingCustom, setAddingCustom] = useState(false)
  const [aiNewSuggestions, setAiNewSuggestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

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
  const dayLabel = mode === 'add' ? ` — ${DAYS[dayIdx]}, ${SLOTS.find((s) => s.key === slotKey)?.label}` : ''

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{title}{dayLabel}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {/* Nombre */}
          <div className="form-field">
            <label className="form-label">Nombre del plato</label>
            <input
              ref={inputRef}
              className="form-input"
              placeholder="Ej: Pasta carbonara"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !aiLoading && handleAiSuggest()}
            />
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
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
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
            {item.dish_name || <em style={{ opacity: 0.5 }}>sin nombre</em>}
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

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekKey = getWeekKey(weekOffset)

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
  const [clearedWeek, setClearedWeekRaw] = useState(() => localStorage.getItem('clearedWeek') || null)
  const listCleared = clearedWeek === weekKey
  const [contextMenu, setContextMenu] = useState(null)
  const [recipeModal, setRecipeModal] = useState(null)
  const [copyingSlot, setCopyingSlot] = useState(null)
  const [movingSlot, setMovingSlot] = useState(null)
  const [colorOverrides, setColorOverridesRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem('colorOverrides') || '{}') } catch { return {} }
  })
  const [customItems, setCustomItemsRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem('customItems') || '[]') } catch { return [] }
  })
  const [customInput, setCustomInput] = useState('')
  const [poolItems, setPoolItemsRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dishPool') || '[]') } catch { return [] }
  })
  const setPoolItems = (val) => {
    const next = typeof val === 'function' ? val(poolItems) : val
    setPoolItemsRaw(next)
    localStorage.setItem('dishPool', JSON.stringify(next))
  }

  const setClearedWeek = (val) => {
    setClearedWeekRaw(val)
    if (val) localStorage.setItem('clearedWeek', val)
    else localStorage.removeItem('clearedWeek')
  }
  const setColorOverrides = (val) => {
    const next = typeof val === 'function' ? val(colorOverrides) : val
    setColorOverridesRaw(next)
    localStorage.setItem('colorOverrides', JSON.stringify(next))
  }
  const setCustomItems = (val) => {
    const next = typeof val === 'function' ? val(customItems) : val
    setCustomItemsRaw(next)
    localStorage.setItem('customItems', JSON.stringify(next))
  }

  const initDone = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    initApp()
  }, [])

  useEffect(() => {
    if (ingredients.length > 0) loadSlots()
  }, [weekKey, ingredients])

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
      const boardSlots = await dbGet('v2_board_slots', { week_key: weekKey })
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
    } catch (e) {
      showToast('Error al cargar semana: ' + e.message)
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

    const boardSlot = await dbInsert('v2_board_slots', {
      week_key: weekKey,
      day_idx: dayIdx,
      slot_key: slotKey,
      position: Date.now(),
      dish_id: dish.id,
      effort_override: effort,
    })

    setSlots((prev) => [
      ...prev,
      { ...boardSlot, dish_name: dishName, ingredient_ids: selectedIds },
    ])
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

    await dbUpdate('v2_board_slots', slot.id, { dish_id: dish.id, effort_override: effort })

    setSlots((prev) =>
      prev.map((s) =>
        s.id === slot.id
          ? { ...s, dish_id: dish.id, dish_name: dishName, effort_override: effort, ingredient_ids: selectedIds }
          : s
      )
    )
  }

  async function handleDelete(slotId) {
    try {
      await dbDelete('v2_board_slots', slotId)
      setSlots((prev) => prev.filter((s) => s.id !== slotId))
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
        setPoolItems((prev) => prev.filter((p) => p.id !== movingSlot.id))
      } else {
        await dbUpdate('v2_board_slots', movingSlot.id, {
          day_idx: dayIdx,
          slot_key: slotKey,
          position: Date.now(),
        })
        setSlots((prev) => prev.map((s) =>
          s.id === movingSlot.id ? { ...s, day_idx: dayIdx, slot_key: slotKey } : s
        ))
      }
      setMovingSlot(null)
      showToast('Plato movido ✓')
    } catch (e) {
      showToast('Error al mover: ' + e.message)
    }
  }

  function handleChangeType(slotId, typeKey) {
    setColorOverrides((prev) => ({ ...prev, [slotId]: typeKey }))
  }

  function addCustomItem(name) {
    const category = guessCategoryForItem(name, ingredients)
    setCustomItems((prev) => [...prev, { id: Date.now().toString(), name, category }])
  }
  function removeCustomItem(id) {
    setCustomItems((prev) => prev.filter((i) => i.id !== id))
  }
  function toggleCustomItem(id) {
    setPurchasedIds((prev) => {
      const next = new Set(prev)
      if (next.has('custom_' + id)) next.delete('custom_' + id)
      else next.add('custom_' + id)
      return next
    })
  }

  function handleDragStart({ active }) {
    setActiveId(active.id)
  }

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return
    const [newDayIdx, newSlotKey] = over.id.split('-')
    if (isNaN(parseInt(newDayIdx))) return

    // Tray item dropped on board
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
          dayIdx: parseInt(newDayIdx),
          slotKey: newSlotKey,
        })
      } catch (e) {
        showToast('Error al añadir plato: ' + e.message)
      }
      return
    }

    const slot = slots.find((s) => s.id === active.id)
    if (!slot) return
    if (String(slot.day_idx) === newDayIdx && slot.slot_key === newSlotKey) return
    try {
      await dbUpdate('v2_board_slots', slot.id, {
        day_idx: parseInt(newDayIdx),
        slot_key: newSlotKey,
        position: Date.now(),
      })
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slot.id ? { ...s, day_idx: parseInt(newDayIdx), slot_key: newSlotKey } : s
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

  const totalItems = shoppingList.reduce((acc, cat) => acc + cat.items.length, 0)

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
    setSavingList(true)
    try {
      const itemsToSave = shoppingList.map((cat) => ({
        category: cat.category,
        items: cat.items.map(({ ingredient }) => ({
          id: ingredient.id,
          name: ingredient.name,
        })),
      }))
      await dbInsert('v2_shopping_lists', {
        week_key: weekKey,
        saved_at: new Date().toISOString(),
        items: itemsToSave,
      })
      setPurchasedIds(new Set())
      setClearedWeek(weekKey)
      showToast('Lista guardada en historial ✓')
      if (historyOpen) loadShoppingHistory()
    } catch (e) {
      showToast('Error al guardar lista: ' + e.message)
    } finally {
      setSavingList(false)
    }
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
  const dietWarnings = useMemo(() => getDietWarnings(slots, ingredients, colorOverrides), [slots, ingredients, colorOverrides])

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
          <button onClick={() => setWeekOffset((w) => w - 1)} title="Semana anterior">
            <ChevronLeft size={16} />
          </button>
          <span>{formatWeekRange(weekKey)}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)} title="Semana siguiente">
            <ChevronRight size={16} />
          </button>
          {weekOffset !== 0 && (
            <button className="btn-today" onClick={() => setWeekOffset(0)}>
              Hoy
            </button>
          )}
        </div>
      </header>

      <div className="app-body">
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
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="board">
              <div className="board-header-empty" />
              {DAYS.map((day, i) => {
                const date = getDayDate(weekKey, i)
                return (
                  <div key={day} className={`board-day-header${isToday(date) ? ' today' : ''}`}>
                    <div className="day-name">{day}</div>
                    <div className="day-date">
                      {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                )
              })}

              {SLOTS.map((slot) => (
                <React.Fragment key={slot.key}>
                  <div className="board-slot-label">{slot.label}</div>
                  {DAYS.map((_, dayIdx) => {
                    const cellId = `${dayIdx}-${slot.key}`
                    const cellSlots = slots.filter(
                      (s) => s.day_idx === dayIdx && s.slot_key === slot.key
                    )
                    return (
                      <DroppableCell key={cellId} id={cellId}>
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
                            className={`btn-add-slot${copyingSlot || movingSlot ? ' copy-target' : ''}`}
                            onClick={() => {
                              if (copyingSlot) handleCopySlot(dayIdx, slot.key)
                              else if (movingSlot) handleMoveSlot(dayIdx, slot.key)
                              else setAddModal({ dayIdx, slotKey: slot.key })
                            }}
                          >
                            <Plus size={12} />
                            <span>{copyingSlot ? 'Pegar aquí' : movingSlot ? 'Mover aquí' : 'Añadir'}</span>
                          </button>
                        </div>
                      </DroppableCell>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeId && (
                String(activeId).startsWith('pool-')
                  ? (() => {
                      const p = poolItems.find((x) => x.id === String(activeId).replace('pool-', ''))
                      return p ? <div className="tray-dish-overlay">{p.dish_name || '…'}</div> : null
                    })()
                  : (() => {
                      const s = slots.find((x) => x.id === activeId)
                      return s ? <div className="postit-overlay"><PostitContent slot={s} onEdit={() => {}} onDelete={() => {}} dragHandleRef={null} /></div> : null
                    })()
              )}
            </DragOverlay>
          </DndContext>

          <div className="dishes-tray">
            <div className="dishes-tray-header">
              <span className="dishes-tray-label">Mi despensa — post-its sin día asignado</span>
              <button
                className="btn-add-slot"
                style={{ width: 'auto', padding: '3px 10px', fontSize: 11 }}
                onClick={() => setPoolItems((prev) => [...prev, { id: Date.now().toString(), dish_name: '', effort: 1 }])}
              >
                <Plus size={11} /> Nuevo
              </button>
            </div>
            <div className="dishes-tray-list">
              {poolItems.map((item) => (
                <PoolPostit
                  key={item.id}
                  item={item}
                  ingredients={ingredients}
                  onUpdate={(updated) => setPoolItems((prev) => prev.map((p) => p.id === item.id ? updated : p))}
                  onDelete={() => setPoolItems((prev) => prev.filter((p) => p.id !== item.id))}
                  onContextMenu={(e, slot) => setContextMenu({ x: e.clientX, y: e.clientY, slot, isPool: true })}
                />
              ))}
            </div>
          </div>
        </div>

        <>
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
                <button className="sidebar-icon-btn" title="Historial de listas" onClick={handleOpenHistory}>
                  <History size={16} />
                </button>
                <button className="sidebar-mobile-close modal-close" onClick={() => setShoppingOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="sidebar-body">
              {listCleared ? (
                <div className="sidebar-empty">
                  <div style={{ fontSize: 32 }}>✓</div>
                  <div style={{ marginTop: 8, fontWeight: 600, color: 'var(--text)' }}>Lista guardada</div>
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    Consulta el historial con el icono del reloj
                  </div>
                  <button
                    style={{ marginTop: 16, fontSize: 12, background: 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '4px 14px', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit' }}
                    onClick={() => setClearedWeek(null)}
                  >
                    Volver a la lista
                  </button>
                </div>
              ) : shoppingList.length === 0 ? (
                <p className="sidebar-empty">
                  Añade platos al tablero para ver los ingredientes aquí.
                </p>
              ) : (
                <>
                  {(() => {
                    // Merge custom items into their categories
                    const allCategories = [...new Set([
                      ...shoppingList.map((c) => c.category),
                      ...customItems.map((i) => i.category || 'Otros'),
                    ])]
                    return allCategories.map((category) => {
                      const regular = shoppingList.find((c) => c.category === category)?.items || []
                      const custom = customItems.filter((i) => (i.category || 'Otros') === category)
                      if (!regular.length && !custom.length) return null
                      return (
                        <div key={category} className="shopping-category">
                          <div className="shopping-category-title">{category}</div>
                          {regular.map(({ ingredient, dishes }) => (
                            <div key={ingredient.id} className={`shopping-item${purchasedIds.has(ingredient.id) ? ' purchased' : ''}`}>
                              <input type="checkbox" checked={purchasedIds.has(ingredient.id)} onChange={() => togglePurchased(ingredient.id)} />
                              <span className="shopping-item-name"
                                onMouseEnter={(e) => setPopover({ ingredient, position: { x: e.clientX, y: e.clientY } })}
                                onMouseLeave={() => setPopover(null)}
                              >{ingredient.name}</span>
                              <span className="shopping-item-dishes">{dishes.length}</span>
                            </div>
                          ))}
                          {custom.map((item) => (
                            <div key={item.id} className={`shopping-item${purchasedIds.has('custom_' + item.id) ? ' purchased' : ''}`}>
                              <input type="checkbox" checked={purchasedIds.has('custom_' + item.id)} onChange={() => toggleCustomItem(item.id)} />
                              <span className="shopping-item-name">{item.name}</span>
                              <button className="postit-btn delete" style={{ opacity: 0.5, flexShrink: 0 }} onPointerDown={(e) => e.stopPropagation()} onClick={() => removeCustomItem(item.id)}><X size={10} /></button>
                            </div>
                          ))}
                        </div>
                      )
                    })
                  })()}
                  {purchasedIds.size > 0 && (
                    <button
                      className="btn-clear-purchased"
                      onClick={handleSaveAndClear}
                      disabled={savingList}
                    >
                      {savingList ? 'Guardando…' : `Guardar y limpiar (${purchasedIds.size})`}
                    </button>
                  )}
                </>
              )}
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
        </>
      </div>

      <button className="fab" onClick={() => setShoppingOpen(true)} title="Lista de la compra">
        <ShoppingCart size={22} />
        {totalItems > 0 && <span className="fab-badge">{totalItems}</span>}
      </button>

      {addModal && (
        <DishModal
          mode="add"
          dayIdx={addModal.dayIdx}
          slotKey={addModal.slotKey}
          ingredients={ingredients}
          slots={slots}
          onClose={() => setAddModal(null)}
          onSave={handleSaveDish}
          onIngredientAdded={handleIngredientAdded}
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
          onCopy={(slot) => { setCopyingSlot(slot); setMovingSlot(null); showToast(`Copiando "${slot.dish_name}" — elige dónde pegar`) }}
          onMove={(slot) => { setMovingSlot(slot); setCopyingSlot(null); showToast(`Moviendo "${slot.dish_name}" — elige destino`) }}
          onSendToPool={(slot) => {
            setPoolItems((prev) => [...prev, { id: Date.now().toString(), dish_name: slot.dish_name, effort: 1 }])
            handleDelete(slot.id)
            showToast(`"${slot.dish_name}" movido a la despensa`)
          }}
          onChangeType={handleChangeType}
          onClose={() => setContextMenu(null)}
        />
      )}

      {recipeModal && (
        <RecipeModal slot={recipeModal} onClose={() => setRecipeModal(null)} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
