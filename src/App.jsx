import { useState, useEffect, useCallback, useRef } from 'react'
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
} from 'lucide-react'
import { dbGet, dbInsert, dbUpdate, dbDelete, dbUpsert } from './supabase.js'
import { INGREDIENT_CATEGORIES, DEFAULT_INGREDIENTS } from './ingredients.js'

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const SLOTS = [
  { key: 'lunch', label: 'Comida' },
  { key: 'dinner', label: 'Cena' },
]
const EFFORT_LABELS = { 1: '🟢 Fácil', 2: '🟡 Medio', 3: '🔴 Casero' }

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
  // key: YYYY-W{n}-{M}-{D}
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

async function callGemini(dishName, effortLevel, ingredientNames) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY no configurada')

  const effortDesc =
    effortLevel === 1
      ? 'fácil (usando preparados y conservas)'
      : effortLevel === 2
      ? 'medio (mezcla de frescos y preparados)'
      : 'casero (todo desde cero con ingredientes frescos)'

  const prompt = `Eres un asistente de cocina español. Para el plato "${dishName}" con nivel de esfuerzo ${effortDesc}, selecciona los ingredientes necesarios de esta lista exacta: ${ingredientNames.join(', ')}. Responde ÚNICAMENTE con un array JSON de nombres exactos tal como aparecen en la lista, sin añadir ningún ingrediente que no esté en la lista. Ejemplo: ["Pasta (espaguetis)", "Tomate triturado (lata)", "Ajo"]`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${apiKey}`,
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
  return JSON.parse(text)
}

// ─── DnD components ───────────────────────────────────────────────────────────

function DroppableCell({ id, children, className }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`board-cell${isOver ? ' drag-over' : ''}${className ? ' ' + className : ''}`}
    >
      {children}
    </div>
  )
}

function DraggablePostit({ slot, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: slot.id,
  })
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`postit${isDragging ? ' dragging' : ''}`}
    >
      <PostitContent slot={slot} onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}

function PostitContent({ slot, onEdit, onDelete }) {
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
            <div
              key={n}
              className={`effort-dot${n <= effort ? ` active-${effort}` : ''}`}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// ─── DishModal (shared for Add and Edit) ─────────────────────────────────────

function DishModal({ mode, slot, dayIdx, slotKey, ingredients, onClose, onSave }) {
  const [dishName, setDishName] = useState(mode === 'edit' ? slot.dish_name : '')
  const [effort, setEffort] = useState(
    mode === 'edit' ? (slot.effort_override || 1) : 1
  )
  const [selectedIds, setSelectedIds] = useState(
    mode === 'edit' ? (slot.ingredient_ids || []) : []
  )
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  const toggleIngredient = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleAiSuggest = async () => {
    if (!dishName.trim()) return
    setAiLoading(true)
    setError(null)
    try {
      const names = ingredients.map((i) => i.name)
      const suggested = await callGemini(dishName.trim(), effort, names)
      const suggestedIds = ingredients
        .filter((i) => suggested.includes(i.name))
        .map((i) => i.id)
      setSelectedIds(suggestedIds)
    } catch (e) {
      setError('Error al contactar Gemini: ' + e.message)
    } finally {
      setAiLoading(false)
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
  const dayLabel = mode === 'add' ? ` — ${DAYS[dayIdx]}, ${SLOTS.find(s => s.key === slotKey)?.label}` : ''

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

          {/* AI */}
          <div className="form-field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

            <div className="chips-area">
              {INGREDIENT_CATEGORIES.map((cat) => {
                const catIngredients = ingredients.filter((i) => i.category === cat)
                if (!catIngredients.length) return null
                return catIngredients.map((ing) => (
                  <button
                    key={ing.id}
                    className={`chip${selectedIds.includes(ing.id) ? ' selected' : ''}`}
                    onClick={() => toggleIngredient(ing.id)}
                  >
                    {ing.name}
                  </button>
                ))
              })}
            </div>
          </div>

          {error && <div style={{ color: '#f87171', fontSize: 12 }}>{error}</div>}
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
    <div
      className="popover"
      style={{ top: position.y + 12, left: position.x }}
    >
      <div className="popover-title">{ingredient.name}</div>
      {dishNames.map((name, i) => (
        <div key={i} className="popover-dish">• {name}</div>
      ))}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [slots, setSlots] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [addModal, setAddModal] = useState(null) // {dayIdx, slotKey}
  const [editModal, setEditModal] = useState(null) // slot
  const [shoppingOpen, setShoppingOpen] = useState(false)
  const [purchasedIds, setPurchasedIds] = useState(new Set())
  const [activeId, setActiveId] = useState(null) // drag
  const [popover, setPopover] = useState(null) // {ingredient, position}
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)

  const weekKey = getWeekKey(weekOffset)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // ─── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    initApp()
  }, [])

  useEffect(() => {
    if (ingredients.length > 0) loadSlots()
  }, [weekKey, ingredients])

  async function initApp() {
    try {
      let ings = await dbGet('v2_ingredients')
      if (!ings.length) {
        // Seed
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

      // Load dish info for each slot
      const dishIds = [...new Set(boardSlots.map((s) => s.dish_id))]
      const enriched = await Promise.all(
        boardSlots.map(async (s) => {
          // Get dish name
          const dishes = await dbGet('v2_dishes', { id: s.dish_id })
          const dish = dishes[0]
          // Get ingredient ids for this effort level
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

  // ─── Add dish ───────────────────────────────────────────────────────────────

  async function handleSaveDish({ dishName, effort, selectedIds, dayIdx, slotKey }) {
    // Upsert dish
    let dish
    const existing = await dbGet('v2_dishes', { name: dishName })
    if (existing.length) {
      dish = existing[0]
    } else {
      dish = await dbInsert('v2_dishes', { name: dishName, effort_default: effort })
    }

    // Upsert dish_ingredients for this effort level
    // Delete existing for this dish+effort, then insert new
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

    // Insert board slot
    const boardSlot = await dbInsert('v2_board_slots', {
      week_key: weekKey,
      day_idx: dayIdx,
      slot_key: slotKey,
      position: Date.now(),
      dish_id: dish.id,
      effort_override: effort,
    })

    // Update local state
    setSlots((prev) => [
      ...prev,
      {
        ...boardSlot,
        dish_name: dishName,
        ingredient_ids: selectedIds,
      },
    ])
  }

  // ─── Edit dish ──────────────────────────────────────────────────────────────

  async function handleEditDish({ dishName, effort, selectedIds, slot }) {
    let dish
    if (dishName !== slot.dish_name) {
      const existing = await dbGet('v2_dishes', { name: dishName })
      if (existing.length) {
        dish = existing[0]
      } else {
        dish = await dbInsert('v2_dishes', { name: dishName, effort_default: effort })
      }
    } else {
      const dishes = await dbGet('v2_dishes', { id: slot.dish_id })
      dish = dishes[0]
    }

    // Update dish_ingredients for this effort level
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

    // Update board slot
    await dbUpdate('v2_board_slots', slot.id, {
      dish_id: dish.id,
      effort_override: effort,
    })

    // Update local state
    setSlots((prev) =>
      prev.map((s) =>
        s.id === slot.id
          ? { ...s, dish_id: dish.id, dish_name: dishName, effort_override: effort, ingredient_ids: selectedIds }
          : s
      )
    )
  }

  // ─── Delete slot ────────────────────────────────────────────────────────────

  async function handleDelete(slotId) {
    try {
      await dbDelete('v2_board_slots', slotId)
      setSlots((prev) => prev.filter((s) => s.id !== slotId))
    } catch (e) {
      showToast('Error al eliminar: ' + e.message)
    }
  }

  // ─── Drag & drop ────────────────────────────────────────────────────────────

  function handleDragStart({ active }) {
    setActiveId(active.id)
  }

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const [newDayIdx, newSlotKey] = over.id.split('-')
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
          s.id === slot.id
            ? { ...s, day_idx: parseInt(newDayIdx), slot_key: newSlotKey }
            : s
        )
      )
    } catch (e) {
      showToast('Error al mover plato: ' + e.message)
    }
  }

  // ─── Shopping list ──────────────────────────────────────────────────────────

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

  // ─── Active slot for DragOverlay ────────────────────────────────────────────

  const activeSlot = activeId ? slots.find((s) => s.id === activeId) : null

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8' }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    )
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1>📋 Pizarra Semanal</h1>
        <div className="week-nav">
          <button onClick={() => setWeekOffset((w) => w - 1)} title="Semana anterior">
            <ChevronLeft size={16} />
          </button>
          <span>{formatWeekRange(weekKey)}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)} title="Semana siguiente">
            <ChevronRight size={16} />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} style={{ fontSize: 11, padding: '3px 8px', width: 'auto' }}>
              Hoy
            </button>
          )}
        </div>
      </header>

      <div className="app-body">
        {/* Board */}
        <div className="board-wrapper">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="board">
              {/* Header row */}
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

              {/* Slot rows */}
              {SLOTS.map((slot) => (
                <>
                  <div key={slot.key + '-label'} className="board-slot-label">{slot.label}</div>
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
                            onEdit={() => setEditModal(s)}
                            onDelete={handleDelete}
                          />
                        ))}
                        <div className="board-cell-add">
                          <button
                            className="btn-add-slot"
                            onClick={() => setAddModal({ dayIdx, slotKey: slot.key })}
                          >
                            <Plus size={12} />
                            <span>Añadir</span>
                          </button>
                        </div>
                      </DroppableCell>
                    )
                  })}
                </>
              ))}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeSlot && (
                <div className="postit-overlay">
                  <PostitContent slot={activeSlot} onEdit={() => {}} onDelete={() => {}} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Sidebar */}
        <>
          {shoppingOpen && (
            <div className="sidebar-overlay" onClick={() => setShoppingOpen(false)} />
          )}
          <aside className={`sidebar${shoppingOpen ? ' mobile-open' : ''}`}>
            <div className="sidebar-header">
              <h2>
                <ShoppingCart size={16} />
                Lista de la compra
                {totalItems > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--accent-hover)', marginLeft: 4 }}>
                    ({totalItems})
                  </span>
                )}
              </h2>
              <button
                className="sidebar-mobile-close modal-close"
                onClick={() => setShoppingOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="sidebar-body">
              {shoppingList.length === 0 ? (
                <p className="sidebar-empty">
                  Añade platos al tablero para ver los ingredientes aquí.
                </p>
              ) : (
                <>
                  {shoppingList.map(({ category, items }) => (
                    <div key={category} className="shopping-category">
                      <div className="shopping-category-title">{category}</div>
                      {items.map(({ ingredient, dishes }) => (
                        <div
                          key={ingredient.id}
                          className={`shopping-item${purchasedIds.has(ingredient.id) ? ' purchased' : ''}`}
                          onMouseEnter={(e) =>
                            setPopover({
                              ingredient,
                              position: { x: e.clientX, y: e.clientY },
                            })
                          }
                          onMouseLeave={() => setPopover(null)}
                        >
                          <input
                            type="checkbox"
                            checked={purchasedIds.has(ingredient.id)}
                            onChange={() => togglePurchased(ingredient.id)}
                          />
                          <span className="shopping-item-name">{ingredient.name}</span>
                          <span className="shopping-item-dishes">{dishes.length}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {purchasedIds.size > 0 && (
                    <button
                      className="btn-clear-purchased"
                      onClick={() => setPurchasedIds(new Set())}
                    >
                      Limpiar comprados ({purchasedIds.size})
                    </button>
                  )}
                </>
              )}
            </div>
          </aside>
        </>
      </div>

      {/* FAB móvil */}
      <button className="fab" onClick={() => setShoppingOpen(true)} title="Lista de la compra">
        <ShoppingCart size={22} />
        {totalItems > 0 && <span className="fab-badge">{totalItems}</span>}
      </button>

      {/* Modals */}
      {addModal && (
        <DishModal
          mode="add"
          dayIdx={addModal.dayIdx}
          slotKey={addModal.slotKey}
          ingredients={ingredients}
          onClose={() => setAddModal(null)}
          onSave={handleSaveDish}
        />
      )}
      {editModal && (
        <DishModal
          mode="edit"
          slot={editModal}
          ingredients={ingredients}
          onClose={() => setEditModal(null)}
          onSave={handleEditDish}
        />
      )}

      {/* Popover */}
      {popover && (
        <IngredientPopover
          ingredient={popover.ingredient}
          slots={slots}
          position={popover.position}
        />
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
