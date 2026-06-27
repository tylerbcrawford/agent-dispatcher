// src/web/components/TaskFilterBar.tsx
import { useState, useEffect, useRef } from 'react'
import type { Task, TaskStatus, Priority, Bucket } from '@shared/types'
import { STATUS_BADGES } from './TaskCard'

// --- Filter types ---
export interface TaskFilters {
  statuses: TaskStatus[]
  priorities: Priority[]
  buckets: Bucket[]
  categories: string[]
  hasPlan: 'any' | 'yes' | 'no'
  maxMinutes: number | null
  affects: string[]
  searchText: string
}

export const DEFAULT_FILTERS: TaskFilters = {
  statuses: [],
  priorities: [],
  buckets: [],
  categories: [],
  hasPlan: 'any',
  maxMinutes: null,
  affects: [],
  searchText: '',
}

// --- Filter function ---
export function applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter(task => {
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false
    if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false
    if (filters.buckets.length > 0 && !filters.buckets.includes(task.bucket)) return false
    if (filters.categories.length > 0 && !filters.categories.includes(task.category)) return false
    if (filters.hasPlan === 'yes' && !task.planLink) return false
    if (filters.hasPlan === 'no' && task.planLink) return false
    if (filters.maxMinutes !== null && task.timeMinutes > filters.maxMinutes) return false
    if (filters.affects.length > 0 && !filters.affects.some(a => task.affects.includes(a))) return false
    if (filters.searchText) {
      const q = filters.searchText.toLowerCase()
      if (!task.name.toLowerCase().includes(q) && !task.description.toLowerCase().includes(q)) return false
    }
    return true
  })
}

function countActiveFilters(filters: TaskFilters): number {
  let count = 0
  if (filters.statuses.length > 0) count++
  if (filters.priorities.length > 0) count++
  if (filters.buckets.length > 0) count++
  if (filters.categories.length > 0) count++
  if (filters.maxMinutes !== null) count++
  if (filters.affects.length > 0) count++
  return count
}

function isFiltersActive(filters: TaskFilters): boolean {
  return countActiveFilters(filters) > 0 || filters.searchText.length > 0
}

// --- Component ---
interface Props {
  tasks: Task[]
  filters: TaskFilters
  onChange: (filters: TaskFilters) => void
  onReset: () => void
  resultCount: number
  filtersExpanded: boolean
  onToggleFilters: () => void
}

type DropdownId = 'status' | 'priority' | 'stage' | 'category' | 'time' | 'plan' | 'affects' | null

const ALL_BUCKETS: Bucket[] = ['running', 'review', 'ready', 'needs-planning', 'blocked', 'manual', 'done']

const BUCKET_LABELS: Record<Bucket, string> = {
  running: 'Running',
  review: 'Needs Review',
  ready: 'Ready',
  'needs-planning': 'Needs Planning',
  blocked: 'Blocked',
  manual: 'Manual',
  done: 'Done',
}

const TIME_OPTIONS = [
  { label: 'Any', value: null },
  { label: '30 min or less', value: 30 },
  { label: '1 hr or less', value: 60 },
  { label: '2 hrs or less', value: 120 },
  { label: 'Over 2 hrs (invert)', value: -1 },
]

const ALL_STATUSES: TaskStatus[] = [
  'needs-planning', 'plan-review', 'ready',
  'in-progress', 'in-review', 'done', 'blocked', 'manual',
]

const ALL_PRIORITIES: Priority[] = ['HIGH', 'MEDIUM', 'LOW']

const PRIORITY_LABELS: Record<Priority, string> = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
}

export default function TaskFilterBar({ tasks, filters, onChange, onReset, resultCount, filtersExpanded, onToggleFilters }: Props) {
  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const allCategories = [...new Set(tasks.map(t => t.category))].filter(Boolean).sort()
  const allAffects = [...new Set(tasks.flatMap(t => t.affects))].filter(Boolean).sort()
  const active = isFiltersActive(filters)
  const activeCount = countActiveFilters(filters)

  function toggleDropdown(id: DropdownId) {
    setOpenDropdown(prev => prev === id ? null : id)
  }

  function toggleArrayFilter<K extends 'statuses' | 'priorities' | 'categories' | 'affects' | 'buckets'>(
    key: K, value: TaskFilters[K][number]
  ) {
    const arr = filters[key] as string[]
    const next = arr.includes(value as string)
      ? arr.filter(v => v !== value)
      : [...arr, value as string]
    onChange({ ...filters, [key]: next })
  }

  function chipCls(isActive: boolean) {
    if (isActive) return 'border-blue-500/50 text-blue-300 bg-blue-950/40'
    return 'border-gray-600 text-gray-400 hover:border-gray-500'
  }

  return (
    <div ref={barRef} className="mb-4 space-y-2">
      {/* Top row: active filter count + reset (toggle button is in the board toolbar) */}
      {(active || filtersExpanded) && (
        <div className="flex items-center justify-center gap-2">
          {activeCount > 0 && (
            <span className="text-xs text-blue-400">{activeCount} active</span>
          )}
          {active && (
            <button
              onClick={() => onReset()}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Reset
            </button>
          )}
          {active && (
            <span className="text-xs text-gray-500">
              {resultCount}/{tasks.length}
            </span>
          )}
        </div>
      )}


      {/* Expanded filter chips */}
      {filtersExpanded && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <div className="relative">
            <button
              onClick={() => toggleDropdown('status')}
              className={`text-xs border rounded px-2.5 py-1.5 transition-colors ${chipCls(filters.statuses.length > 0)}`}
            >
              Status{filters.statuses.length > 0 && ` (${filters.statuses.length})`}
            </button>
            {openDropdown === 'status' && (
              <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded z-40 w-max">
                {ALL_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleArrayFilter('statuses', s)}
                    className={`flex items-center justify-between w-full px-2.5 py-1 hover:bg-gray-800/60 text-xs transition-colors ${
                      filters.statuses.includes(s) ? 'text-blue-300' : 'text-gray-400'
                    }`}
                  >
                    {STATUS_BADGES[s].label}
                    {filters.statuses.includes(s) && <span className="text-blue-400 ml-2">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => toggleDropdown('priority')}
              className={`text-xs border rounded px-2.5 py-1.5 transition-colors ${chipCls(filters.priorities.length > 0)}`}
            >
              Priority{filters.priorities.length > 0 && ` (${filters.priorities.length})`}
            </button>
            {openDropdown === 'priority' && (
              <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded z-40 w-max">
                {ALL_PRIORITIES.map(p => (
                  <button
                    key={p}
                    onClick={() => toggleArrayFilter('priorities', p)}
                    className={`flex items-center justify-between w-full px-2.5 py-1 hover:bg-gray-800/60 text-xs transition-colors ${
                      filters.priorities.includes(p) ? 'text-blue-300' : 'text-gray-400'
                    }`}
                  >
                    {PRIORITY_LABELS[p]}
                    {filters.priorities.includes(p) && <span className="text-blue-400 ml-2">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => toggleDropdown('stage')}
              className={`text-xs border rounded px-2.5 py-1.5 transition-colors ${chipCls(filters.buckets.length > 0)}`}
            >
              Stage{filters.buckets.length > 0 && ` (${filters.buckets.length})`}
            </button>
            {openDropdown === 'stage' && (
              <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded z-40 w-max">
                {ALL_BUCKETS.map(b => (
                  <button
                    key={b}
                    onClick={() => toggleArrayFilter('buckets', b)}
                    className={`flex items-center justify-between w-full px-2.5 py-1 hover:bg-gray-800/60 text-xs transition-colors ${
                      filters.buckets.includes(b) ? 'text-blue-300' : 'text-gray-400'
                    }`}
                  >
                    {BUCKET_LABELS[b]}
                    {filters.buckets.includes(b) && <span className="text-blue-400 ml-2">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {allCategories.length > 0 && (
            <div className="relative">
              <button
                onClick={() => toggleDropdown('category')}
                className={`text-xs border rounded px-2.5 py-1.5 transition-colors ${chipCls(filters.categories.length > 0)}`}
              >
                Type{filters.categories.length > 0 && ` (${filters.categories.length})`}
              </button>
              {openDropdown === 'category' && (
                <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded z-40 w-max">
                  {allCategories.map(c => (
                    <button
                      key={c}
                      onClick={() => toggleArrayFilter('categories', c)}
                      className={`flex items-center justify-between w-full px-2.5 py-1 hover:bg-gray-800/60 text-xs transition-colors ${
                        filters.categories.includes(c) ? 'text-blue-300' : 'text-gray-400'
                      }`}
                    >
                      {c}
                      {filters.categories.includes(c) && <span className="text-blue-400 ml-2">●</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => toggleDropdown('time')}
              className={`text-xs border rounded px-2.5 py-1.5 transition-colors ${chipCls(filters.maxMinutes !== null)}`}
            >
              Time{filters.maxMinutes !== null && ` (${filters.maxMinutes}m)`}
            </button>
            {openDropdown === 'time' && (
              <div className="absolute top-full right-0 mt-1 bg-gray-900 border border-gray-700 rounded z-40 w-max">
                {TIME_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      onChange({ ...filters, maxMinutes: opt.value })
                      setOpenDropdown(null)
                    }}
                    className={`block w-full text-left px-2.5 py-1 hover:bg-gray-800/60 text-xs transition-colors ${
                      filters.maxMinutes === opt.value ? 'text-blue-300' : 'text-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {allAffects.length > 0 && (
            <div className="relative">
              <button
                onClick={() => toggleDropdown('affects')}
                className={`text-xs border rounded px-2.5 py-1.5 transition-colors ${chipCls(filters.affects.length > 0)}`}
              >
                Affects{filters.affects.length > 0 && ` (${filters.affects.length})`}
              </button>
              {openDropdown === 'affects' && (
                <div className="absolute top-full right-0 mt-1 bg-gray-900 border border-gray-700 rounded z-40 w-max max-h-48 overflow-y-auto">
                  {allAffects.map(a => (
                    <button
                      key={a}
                      onClick={() => toggleArrayFilter('affects', a)}
                      className={`flex items-center justify-between w-full px-2.5 py-1 hover:bg-gray-800/60 text-xs transition-colors ${
                        filters.affects.includes(a) ? 'text-blue-300' : 'text-gray-400'
                      }`}
                    >
                      {a}
                      {filters.affects.includes(a) && <span className="text-blue-400 ml-2">●</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
