// src/web/components/ManageGroupsDialog.tsx
import { useState, useRef } from 'react'
import type { ProjectConfig, ProjectGroup, GroupColor } from '@shared/types'
import { GROUP_COLORS } from './styles'

const COLOR_ORDER: GroupColor[] = ['blue', 'green', 'yellow', 'red', 'purple', 'gray']

interface Props {
  open: boolean
  onClose: () => void
  groups: ProjectGroup[]
  projects: ProjectConfig[]
  onSave: (groups: ProjectGroup[]) => void
}

export default function ManageGroupsDialog({ open, onClose, groups, projects, onSave }: Props) {
  const [localGroups, setLocalGroups] = useState<ProjectGroup[]>([])
  const [editingName, setEditingName] = useState<string | null>(null)
  // Tap-to-move: selected project for mobile (also works on desktop as fallback)
  const [selectedProject, setSelectedProject] = useState<{ projectId: string; fromGroupId: string | null } | null>(null)
  const dragItem = useRef<{ projectId: string; fromGroupId: string | null } | null>(null)
  const dragGroupItem = useRef<string | null>(null)

  // Reset local state when dialog opens
  const prevOpen = useRef(false)
  if (open && !prevOpen.current) {
    setLocalGroups(groups.map(g => ({ ...g, projectIds: [...g.projectIds] })))
    setEditingName(null)
    setSelectedProject(null)
  }
  prevOpen.current = open

  if (!open) return null

  const groupedIds = new Set(localGroups.flatMap(g => g.projectIds))
  const ungrouped = projects.filter(p => !groupedIds.has(p.id))
  const projectMap = new Map(projects.map(p => [p.id, p]))

  function addGroup() {
    const id = `group-${Date.now()}`
    setLocalGroups(prev => [...prev, { id, name: 'New Group', color: 'blue', projectIds: [] }])
    setEditingName(id)
  }

  function deleteGroup(groupId: string) {
    setLocalGroups(prev => prev.filter(g => g.id !== groupId))
  }

  function renameGroup(groupId: string, name: string) {
    setLocalGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g))
  }

  function cycleColor(groupId: string) {
    setLocalGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g
      const idx = COLOR_ORDER.indexOf(g.color as GroupColor)
      const next = COLOR_ORDER[(idx + 1) % COLOR_ORDER.length]
      return { ...g, color: next }
    }))
  }

  // --- Move project between groups (shared by DnD and tap-to-move) ---
  function moveProject(projectId: string, fromGroupId: string | null, toGroupId: string | null) {
    if (fromGroupId === toGroupId) return

    setLocalGroups(prev => {
      let updated = prev.map(g => ({
        ...g,
        projectIds: g.projectIds.filter(id => id !== projectId),
      }))
      if (toGroupId) {
        updated = updated.map(g =>
          g.id === toGroupId ? { ...g, projectIds: [...g.projectIds, projectId] } : g
        )
      }
      return updated
    })
  }

  // --- Tap-to-move: tap project to select, tap group to place ---
  function handleProjectTap(projectId: string, fromGroupId: string | null) {
    if (selectedProject?.projectId === projectId) {
      setSelectedProject(null)
    } else {
      setSelectedProject({ projectId, fromGroupId })
    }
  }

  function handleGroupTap(toGroupId: string | null) {
    if (!selectedProject) return
    moveProject(selectedProject.projectId, selectedProject.fromGroupId, toGroupId)
    setSelectedProject(null)
  }

  // --- HTML5 drag-and-drop (desktop) ---
  function handleProjectDragStart(projectId: string, fromGroupId: string | null) {
    dragItem.current = { projectId, fromGroupId }
    setSelectedProject(null)
  }

  function handleProjectDrop(toGroupId: string | null) {
    if (!dragItem.current) return
    moveProject(dragItem.current.projectId, dragItem.current.fromGroupId, toGroupId)
    dragItem.current = null
  }

  function handleGroupDragStart(groupId: string) {
    dragGroupItem.current = groupId
  }

  function handleGroupDrop(targetGroupId: string) {
    if (!dragGroupItem.current || dragGroupItem.current === targetGroupId) {
      dragGroupItem.current = null
      return
    }
    setLocalGroups(prev => {
      const fromIdx = prev.findIndex(g => g.id === dragGroupItem.current)
      const toIdx = prev.findIndex(g => g.id === targetGroupId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const updated = [...prev]
      const [moved] = updated.splice(fromIdx, 1)
      updated.splice(toIdx, 0, moved)
      return updated
    })
    dragGroupItem.current = null
  }

  function handleSave() {
    onSave(localGroups)
    onClose()
  }

  const isSelected = (projectId: string) => selectedProject?.projectId === projectId

  function renderProjectItem(projectId: string, fromGroupId: string | null) {
    const p = projectMap.get(projectId)
    if (!p) return null
    const selected = isSelected(p.id)
    return (
      <div
        key={p.id}
        draggable
        onDragStart={() => handleProjectDragStart(p.id, fromGroupId)}
        onClick={() => handleProjectTap(p.id, fromGroupId)}
        className={`px-3 py-2 text-sm rounded flex items-center gap-2 select-none transition-colors ${
          selected
            ? 'bg-blue-900/50 text-blue-200 border border-blue-500/50'
            : 'text-gray-300 bg-gray-800 hover:bg-gray-800 border border-transparent cursor-grab active:cursor-grabbing'
        }`}
      >
        <span className="text-gray-600 text-xs">⠿</span>
        <span className="flex-1">{p.name}</span>
        {selected && <span className="text-xs text-blue-400">tap a group</span>}
      </div>
    )
  }

  // Show a "move here" indicator on groups when a project is selected
  function renderMoveTarget(toGroupId: string | null) {
    if (!selectedProject || selectedProject.fromGroupId === toGroupId) return null
    return (
      <button
        onClick={() => handleGroupTap(toGroupId)}
        className="w-full px-3 py-1.5 text-xs text-blue-400 bg-blue-950/30 border border-dashed border-blue-500/30 rounded transition-colors hover:bg-blue-900/30"
      >
        Move here
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-lg w-[480px] max-h-[80vh] flex flex-col max-md:rounded-none max-md:w-full max-md:h-full max-md:max-h-full"
      >
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold">Manage Groups</h2>
          <button
            onClick={addGroup}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            + Add Group
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Groups */}
          {localGroups.map(group => {
            const colors = GROUP_COLORS[group.color] ?? GROUP_COLORS.gray
            return (
              <div
                key={group.id}
                draggable
                onDragStart={() => handleGroupDragStart(group.id)}
                onDragOver={e => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragGroupItem.current) {
                    handleGroupDrop(group.id)
                  } else {
                    handleProjectDrop(group.id)
                  }
                }}
                className={`border-l-2 ${colors.border} rounded-r`}
              >
                {/* Group header */}
                <div className="px-3 py-2 flex items-center gap-2">
                  <button
                    onClick={() => cycleColor(group.id)}
                    className={`w-3 h-3 rounded-full ${colors.dot} hover:ring-2 hover:ring-white/20 transition-all flex-shrink-0`}
                    title="Cycle color"
                  />
                  {editingName === group.id ? (
                    <input
                      autoFocus
                      value={group.name}
                      onChange={e => renameGroup(group.id, e.target.value)}
                      onBlur={() => setEditingName(null)}
                      onKeyDown={e => { if (e.key === 'Enter') setEditingName(null) }}
                      className="bg-transparent border-b border-gray-600 text-sm font-medium focus:outline-none focus:border-blue-500 flex-1 min-w-0"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingName(group.id)}
                      className={`text-sm font-medium ${colors.heading} hover:underline flex-1 text-left min-w-0 truncate`}
                    >
                      {group.name}
                    </button>
                  )}
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xs flex-shrink-0"
                    title="Delete group"
                  >
                    ✕
                  </button>
                </div>
                {/* Group projects */}
                <div className="px-2 pb-2 space-y-1 min-h-[32px]">
                  {renderMoveTarget(group.id)}
                  {group.projectIds.length === 0 && !selectedProject && (
                    <div className="px-3 py-1.5 text-xs text-gray-600 italic">Drop projects here</div>
                  )}
                  {group.projectIds.map(id => renderProjectItem(id, group.id))}
                </div>
              </div>
            )
          })}

          {/* Ungrouped */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleProjectDrop(null) }}
            className="border-l-2 border-gray-700 rounded-r"
          >
            <div className="px-3 py-2 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-600 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-500">Ungrouped</span>
            </div>
            <div className="px-2 pb-2 space-y-1 min-h-[32px]">
              {renderMoveTarget(null)}
              {ungrouped.length === 0 && localGroups.length > 0 && !selectedProject && (
                <div className="px-3 py-1.5 text-xs text-gray-600 italic">All projects are grouped</div>
              )}
              {ungrouped.map(p => renderProjectItem(p.id, null))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-500/80 rounded transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
