// src/web/components/PrioritiesPage.tsx
// Drag-to-rank project priority editor. Weights auto-compute from position (linear decay).
import { useState, useRef, useEffect } from 'react'
import type { ProjectConfig, ClientMessage } from '@shared/types'

interface PrioritiesPageProps {
  projects: ProjectConfig[]
  send: (msg: ClientMessage) => void
  scoring: boolean
}

// Static Tailwind color maps — JIT-safe (no dynamic class construction)
const WEIGHT_COLORS = {
  high: 'bg-green-900/40 text-green-300 border-green-500/30',
  mid: 'bg-yellow-900/40 text-yellow-300 border-yellow-500/30',
  low: 'bg-gray-800 text-gray-400 border-gray-600',
} as const

function weightColorClass(weight: number): string {
  if (weight >= 80) return WEIGHT_COLORS.high
  if (weight >= 50) return WEIGHT_COLORS.mid
  return WEIGHT_COLORS.low
}

function computeWeights(ranked: ProjectConfig[]): Map<string, number> {
  const total = ranked.length
  if (total === 0) return new Map()
  return new Map(ranked.map((p, i) => {
    const rank = i + 1
    const weight = total <= 10
      ? Math.max(10, 100 - (rank - 1) * 10)
      : Math.max(10, Math.round(100 * (1 - (rank - 1) / (total - 1)) * 0.9 + 10))
    return [p.id, weight]
  }))
}

function sortByWeight(projects: ProjectConfig[]): ProjectConfig[] {
  return [...projects].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight
    return a.name.localeCompare(b.name)
  })
}

export default function PrioritiesPage({ projects, send, scoring }: PrioritiesPageProps) {
  const activeProjects = projects.filter(p => p.active)

  const [rankedProjects, setRankedProjects] = useState<ProjectConfig[]>([])
  const [savedOrder, setSavedOrder] = useState<string[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [savedReasons, setSavedReasons] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)

  // DnD state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const pointerDrag = useRef<{ fromIndex: number; currentIndex: number; pointerId: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  // Tap-to-select for mobile
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  // Sync from server state (initializes on mount + re-syncs when server broadcasts)
  const prevIdKey = useRef('')
  useEffect(() => {
    const sorted = sortByWeight(activeProjects)
    const idKey = sorted.map(p => `${p.id}:${p.weight}:${p.weightReason}`).join(',')
    if (idKey !== prevIdKey.current) {
      prevIdKey.current = idKey
      setRankedProjects(sorted)
      setSavedOrder(sorted.map(p => p.id))
      const r: Record<string, string> = {}
      for (const p of sorted) r[p.id] = p.weightReason ?? ''
      setReasons(r)
      setSavedReasons({ ...r })
      setSelectedIndex(null)
    }
  }, [activeProjects])

  const weights = computeWeights(rankedProjects)

  // Dirty check
  const currentOrder = rankedProjects.map(p => p.id)
  const orderDirty = currentOrder.join(',') !== savedOrder.join(',')
  const reasonsDirty = Object.keys(reasons).some(id => reasons[id] !== (savedReasons[id] ?? ''))
  const isDirty = orderDirty || reasonsDirty

  // --- DnD handlers (follows ManageGroupsDialog pattern) ---
  function reorderProjects(fromIndex: number, targetIndex: number) {
    if (fromIndex === targetIndex) return
    setRankedProjects(prev => {
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(targetIndex, 0, moved)
      return updated
    })
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
    setSelectedIndex(null)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDropIndex(index)
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      setDropIndex(null)
      return
    }
    reorderProjects(dragIndex, targetIndex)
    setDragIndex(null)
    setDropIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDropIndex(null)
  }

  // Pointer drag works on touch devices, where native HTML5 drag events are unreliable.
  function findPointerDropIndex(clientY: number): number | null {
    // Track index + distance as separate primitives — assigning an object to a
    // closed-over `let` inside forEach makes TS narrow it to `null` at the return.
    let bestIndex: number | null = null
    let bestDistance = Infinity

    rowRefs.current.forEach((row, index) => {
      if (!row) return
      const rect = row.getBoundingClientRect()
      const centerY = rect.top + rect.height / 2
      const distance = Math.abs(clientY - centerY)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })

    return bestIndex
  }

  function handlePointerDragStart(e: React.PointerEvent, index: number) {
    if (!e.isPrimary || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerDrag.current = { fromIndex: index, currentIndex: index, pointerId: e.pointerId, moved: false }
    setDragIndex(index)
    setDropIndex(index)
    setSelectedIndex(null)
  }

  function handlePointerDragMove(e: React.PointerEvent) {
    const drag = pointerDrag.current
    if (!drag || drag.pointerId !== e.pointerId) return
    e.preventDefault()
    const targetIndex = findPointerDropIndex(e.clientY)
    if (targetIndex === null) return
    drag.moved = true
    drag.currentIndex = targetIndex
    setDropIndex(targetIndex)
  }

  function finishPointerDrag(e: React.PointerEvent) {
    const drag = pointerDrag.current
    if (!drag || drag.pointerId !== e.pointerId) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    pointerDrag.current = null
    if (drag.moved) {
      suppressClick.current = true
      reorderProjects(drag.fromIndex, drag.currentIndex)
      window.setTimeout(() => {
        suppressClick.current = false
      }, 0)
    }
    setDragIndex(null)
    setDropIndex(null)
  }

  // --- Tap-to-select + arrow move (mobile fallback) ---
  function handleTap(index: number) {
    if (suppressClick.current) return
    setSelectedIndex(prev => prev === index ? null : index)
  }

  function moveSelected(direction: -1 | 1) {
    if (selectedIndex === null) return
    const newIndex = selectedIndex + direction
    if (newIndex < 0 || newIndex >= rankedProjects.length) return
    setRankedProjects(prev => {
      const updated = [...prev]
      const [moved] = updated.splice(selectedIndex, 1)
      updated.splice(newIndex, 0, moved)
      return updated
    })
    setSelectedIndex(newIndex)
  }

  // --- Save: batch update + rescore ---
  function handleSave() {
    const weightEntries = rankedProjects.map(p => ({
      projectId: p.id,
      weight: weights.get(p.id) ?? 50,
      reason: reasons[p.id] || undefined,
    }))
    send({ type: 'update_project_weights_batch', weights: weightEntries })
    send({ type: 'rescore_all' })
    setSavedOrder(rankedProjects.map(p => p.id))
    setSavedReasons({ ...reasons })
    setToast('Saved & rescoring')
    setTimeout(() => setToast(null), 5000)
  }

  // --- Reset: revert to saved state ---
  function handleReset() {
    const restored = savedOrder
      .map(id => activeProjects.find(p => p.id === id))
      .filter((p): p is ProjectConfig => !!p)
    setRankedProjects(restored)
    setReasons({ ...savedReasons })
    setSelectedIndex(null)
  }

  if (rankedProjects.length === 0) {
    return <div className="text-center text-gray-500 py-16">No active projects</div>
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-heading font-bold text-white">Project Priorities</h1>
        <p className="text-sm text-gray-500 mt-1">
          Drag to reorder. Weights auto-calculate from position.
        </p>
      </div>

      {/* Ranked list */}
      <div className="space-y-1">
        {rankedProjects.map((project, index) => {
          const weight = weights.get(project.id) ?? 50
          const isSelected = selectedIndex === index
          const isDragging = dragIndex === index
          const showDropAbove = dropIndex === index && dragIndex !== null && dragIndex > index
          const showDropBelow = dropIndex === index && dragIndex !== null && dragIndex < index

          return (
            <div key={project.id}>
              {/* Drop indicator line — above */}
              {showDropAbove && (
                <div className="h-0.5 bg-blue-500 rounded-full mx-2 mb-0.5" />
              )}

              <div
                draggable
                ref={(el) => { rowRefs.current[index] = el }}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => handleTap(index)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all select-none ${
                  isDragging
                    ? 'opacity-30 border-gray-700 bg-gray-900'
                    : isSelected
                      ? 'border-blue-500/50 bg-blue-950/20'
                      : 'border-gray-700 bg-gray-900 hover:border-gray-600 cursor-grab active:cursor-grabbing'
                }`}
              >
                {/* Rank number */}
                <span className="text-xs text-gray-600 font-mono w-5 text-right flex-shrink-0">
                  {index + 1}
                </span>

                {/* Drag handle */}
                <span
                  onPointerDown={(e) => handlePointerDragStart(e, index)}
                  onPointerMove={handlePointerDragMove}
                  onPointerUp={finishPointerDrag}
                  onPointerCancel={finishPointerDrag}
                  className="text-gray-600 text-sm flex-shrink-0 cursor-grab active:cursor-grabbing touch-none px-1 -mx-1"
                  aria-label={`Reorder ${project.name}`}
                >
                  ⠿
                </span>

                {/* Icon + Name + Reason */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{project.icon}</span>
                    <span className="text-sm text-gray-200 font-medium truncate">{project.name}</span>
                  </div>
                  <input
                    type="text"
                    value={reasons[project.id] ?? ''}
                    onChange={(e) => {
                      e.stopPropagation()
                      setReasons(prev => ({ ...prev, [project.id]: e.target.value }))
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDragStart={(e) => e.stopPropagation()}
                    draggable={false}
                    placeholder="Reason..."
                    className="w-full mt-1 bg-transparent text-xs text-gray-500 placeholder-gray-700 focus:text-gray-300 focus:outline-none border-b border-transparent focus:border-gray-600 transition-colors"
                  />
                </div>

                {/* Weight badge */}
                <span className={`text-xs font-mono px-2 py-0.5 rounded border flex-shrink-0 ${weightColorClass(weight)}`}>
                  {weight}
                </span>

                {/* Mobile: up/down arrows when selected */}
                {isSelected && (
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSelected(-1) }}
                      disabled={index === 0}
                      className="text-xs text-blue-400 disabled:text-gray-700 hover:text-blue-300 transition-colors px-1"
                    >
                      ▲
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSelected(1) }}
                      disabled={index === rankedProjects.length - 1}
                      className="text-xs text-blue-400 disabled:text-gray-700 hover:text-blue-300 transition-colors px-1"
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>

              {/* Drop indicator line — below */}
              {showDropBelow && (
                <div className="h-0.5 bg-blue-500 rounded-full mx-2 mt-0.5" />
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
        <button
          onClick={handleReset}
          disabled={!isDirty}
          className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || scoring}
          className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-500/80 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded transition-colors"
        >
          {scoring ? 'Scoring...' : 'Save & Rescore'}
        </button>
      </div>

      {/* Toast — matches taskWriteError pattern in App.tsx */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded-lg text-sm">
          {toast}
        </div>
      )}
    </div>
  )
}
