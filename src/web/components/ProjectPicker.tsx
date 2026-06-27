// src/web/components/ProjectPicker.tsx
// Full-width grouped grid picker for project selection with pinned favorites
import { useState, useEffect, useRef } from 'react'
import { StarIcon, StarFilledIcon } from './icons'
import { GROUP_COLORS } from './styles'
import type { ProjectConfig, ProjectGroup, QueueItem } from '@shared/types'

const STORAGE_KEY = 'ac_pinnedProjects'
const DEFAULT_PINS: string[] = []
const MAX_PINS = 5

interface ProjectPickerProps {
  open: boolean
  projects: ProjectConfig[]
  groups: ProjectGroup[]
  queue: QueueItem[]
  currentProject: string
  showAllProjects: boolean
  projectSort: 'weight' | 'alpha'
  onSelectProject: (id: string) => void
  onSortChange: (sort: 'weight' | 'alpha') => void
  onClose: () => void
}

function loadPins(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return DEFAULT_PINS
}

export default function ProjectPicker({
  open, projects, groups, queue, currentProject, showAllProjects,
  projectSort, onSelectProject, onSortChange, onClose,
}: ProjectPickerProps) {
  const [pins, setPins] = useState<string[]>(loadPins)
  const panelRef = useRef<HTMLDivElement>(null)

  // Persist pins
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins))
  }, [pins])

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Don't close if clicking the header trigger button
        const target = e.target as HTMLElement
        if (target.closest('[data-picker-trigger]')) return
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  if (!open) return null

  function togglePin(id: string) {
    setPins(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id)
      if (prev.length >= MAX_PINS) return prev
      return [...prev, id]
    })
  }

  function getQueueCount(projectId: string): number {
    return queue.filter(i => !i.dismissed && i.projectId === projectId).length
  }

  function selectProject(id: string) {
    onSelectProject(id)
    onClose()
  }

  // Build grouped and ungrouped project lists
  const groupedIds = new Set(groups.flatMap(g => g.projectIds))
  const ungrouped = projects.filter(p => !groupedIds.has(p.id))

  function sortProjects(list: ProjectConfig[]): ProjectConfig[] {
    return [...list].sort((a, b) => {
      if (projectSort === 'weight') return b.weight - a.weight || a.name.localeCompare(b.name)
      return a.name.localeCompare(b.name)
    })
  }

  const pinnedProjects = pins
    .map(id => projects.find(p => p.id === id))
    .filter((p): p is ProjectConfig => !!p)

  return (
    <div
      ref={panelRef}
      className="absolute top-12 left-0 w-full bg-gray-900 border-b border-gray-700 z-40"
    >
      {/* Pinned favorites row */}
      {pinnedProjects.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-800">
          {pinnedProjects.map(p => {
            const count = getQueueCount(p.id)
            const isActive = !showAllProjects && currentProject === p.id
            return (
              <button
                key={p.id}
                onClick={() => selectProject(p.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <StarFilledIcon className="w-3 h-3 text-yellow-500" />
                <span>{p.name}</span>
                {count > 0 && (
                  <span className="text-blue-400 font-normal">·{count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Group grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-0">
        {groups.map(group => {
          const colors = GROUP_COLORS[group.color] || GROUP_COLORS.gray
          const groupProjects = sortProjects(
            group.projectIds
              .map(id => projects.find(p => p.id === id))
              .filter((p): p is ProjectConfig => !!p)
          )
          if (groupProjects.length === 0) return null

          return (
            <div key={group.id} className={`border-l-2 ${colors.border} md:border-l-2`}>
              {/* Group header */}
              <div className="flex items-center gap-2 px-4 py-2">
                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${colors.heading}`}>
                  {group.name}
                </span>
              </div>
              {/* Project rows */}
              {groupProjects.map(p => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  isPinned={pins.includes(p.id)}
                  isActive={!showAllProjects && currentProject === p.id}
                  queueCount={getQueueCount(p.id)}
                  onSelect={() => selectProject(p.id)}
                  onTogglePin={() => togglePin(p.id)}
                  pinsFull={pins.length >= MAX_PINS}
                />
              ))}
            </div>
          )
        })}

        {/* Ungrouped projects */}
        {ungrouped.length > 0 && (
          <div className="border-l-2 border-l-gray-500 md:border-l-2">
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Other
              </span>
            </div>
            {sortProjects(ungrouped).map(p => (
              <ProjectRow
                key={p.id}
                project={p}
                isPinned={pins.includes(p.id)}
                isActive={!showAllProjects && currentProject === p.id}
                queueCount={getQueueCount(p.id)}
                onSelect={() => selectProject(p.id)}
                onTogglePin={() => togglePin(p.id)}
                pinsFull={pins.length >= MAX_PINS}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sort toggle footer */}
      <div className="flex items-center justify-center gap-1 px-3 py-2 border-t border-gray-800">
        <button
          onClick={() => { onSortChange('weight'); localStorage.setItem('ac_projectSort', 'weight') }}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            projectSort === 'weight' ? 'text-white bg-gray-700' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Weight
        </button>
        <button
          onClick={() => { onSortChange('alpha'); localStorage.setItem('ac_projectSort', 'alpha') }}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            projectSort === 'alpha' ? 'text-white bg-gray-700' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          A→Z
        </button>
      </div>
    </div>
  )
}

// Individual project row within a group column
function ProjectRow({
  project, isPinned, isActive, queueCount, onSelect, onTogglePin, pinsFull,
}: {
  project: ProjectConfig
  isPinned: boolean
  isActive: boolean
  queueCount: number
  onSelect: () => void
  onTogglePin: () => void
  pinsFull: boolean
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-4 py-1.5 text-sm transition-colors cursor-pointer group ${
        isActive
          ? 'bg-gray-700 text-white'
          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onTogglePin() }}
        className={`flex-shrink-0 transition-opacity ${
          isPinned
            ? 'text-yellow-500 opacity-100'
            : pinsFull
              ? 'opacity-0 pointer-events-none'
              : 'opacity-0 group-hover:opacity-50 hover:!opacity-100 text-gray-500'
        }`}
        title={isPinned ? 'Unpin' : pinsFull ? 'Max 5 pins' : 'Pin to favorites'}
      >
        {isPinned ? <StarFilledIcon className="w-3.5 h-3.5" /> : <StarIcon className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={onSelect}
        className="flex-1 text-left truncate"
      >
        {project.name}
      </button>
      {queueCount > 0 && (
        <span className="text-blue-400 text-xs font-normal flex-shrink-0">·{queueCount}</span>
      )}
    </div>
  )
}
