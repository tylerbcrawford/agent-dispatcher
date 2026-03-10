// src/web/components/TaskBoard.tsx
import { useState, useEffect } from 'react'
import type { Task, Priority, Bucket, AgentSession, ClientMessage, PromptLibraryMeta, ProjectConfig, RunMode } from '@shared/types'
import type { ModeDefaults } from '../hooks/usePreferences'
import TaskCard from './TaskCard'
import SpawnDialog from './SpawnDialog'
import TaskEditDialog from './TaskEditDialog'
import TaskFilterBar, { type TaskFilters, DEFAULT_FILTERS, applyFilters } from './TaskFilterBar'
import FullscreenPlanReview from './FullscreenPlanReview'

const PRIORITY_ORDER: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
const sortByPriority = (tasks: Task[]) =>
  [...tasks].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))

const BUCKET_ORDER: { key: Bucket; label: string; accent: string; collapsible?: boolean }[] = [
  { key: 'running',        label: 'Running',        accent: 'blue' },
  { key: 'review',         label: 'Needs Review',   accent: 'purple' },
  { key: 'ready',          label: 'Ready',          accent: 'green' },
  { key: 'needs-planning', label: 'Needs Planning', accent: 'yellow' },
  { key: 'blocked',        label: 'Blocked',        accent: 'red' },
  { key: 'manual',         label: 'Manual',         accent: 'red' },
  { key: 'done',           label: 'Done',           accent: 'gray', collapsible: true },
]

// Static class maps — Tailwind JIT can't detect dynamic `border-${accent}-500` templates
const BORDER_COLORS: Record<string, { normal: string; focused: string }> = {
  blue:   { normal: 'border-blue-500/30',   focused: 'border-blue-500/60' },
  purple: { normal: 'border-purple-500/30', focused: 'border-purple-500/60' },
  green:  { normal: 'border-green-500/30',  focused: 'border-green-500/60' },
  yellow: { normal: 'border-yellow-500/30', focused: 'border-yellow-500/60' },
  red:    { normal: 'border-red-500/30',    focused: 'border-red-500/60' },
  orange: { normal: 'border-orange-500/30', focused: 'border-orange-500/60' },
  gray:   { normal: 'border-gray-500/30',   focused: 'border-gray-500/60' },
}

// Left accent border colors per bucket — Tailwind JIT safe
const LEFT_BORDER_COLORS: Record<string, string> = {
  blue:   'border-l-blue-500',
  purple: 'border-l-purple-500',
  green:  'border-l-green-500',
  yellow: 'border-l-yellow-500',
  red:    'border-l-red-500',
  orange: 'border-l-orange-500',
  gray:   'border-l-gray-600',
}

interface Props {
  tasks: Task[]
  agents: AgentSession[]
  send: (msg: ClientMessage) => void
  currentProject: string
  promptLibrary: PromptLibraryMeta | null
  projects: ProjectConfig[]
  showAllProjects: boolean
  showCreate: boolean
  onCloseCreate: () => void
  selectionMode: boolean
  onExitSelectionMode: () => void
  onNavigateQueue?: () => void
  onNavigateAgents?: () => void
  onViewTerminal?: (agentId: string) => void
  searchText?: string
  filtersExpanded?: boolean
  onToggleFilters?: () => void
  planContents?: Record<string, string | null>
  requestPlanContent?: (taskId: number, projectId: string) => void
  preferences: Record<Exclude<RunMode, 'custom'>, ModeDefaults>
}

export default function TaskBoard({ tasks, agents, send, currentProject, promptLibrary, projects, showAllProjects, showCreate, onCloseCreate, selectionMode, onExitSelectionMode, onNavigateQueue, onNavigateAgents, onViewTerminal, searchText = '', filtersExpanded, onToggleFilters, planContents = {}, requestPlanContent, preferences }: Props) {
  const [spawnTask, setSpawnTask] = useState<Task | null>(null)
  const [defaultMode, setDefaultMode] = useState<'plan' | 'implement'>('implement')
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [doneExpanded, setDoneExpanded] = useState(false)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [pendingPlanView, setPendingPlanView] = useState<{ taskId: number; taskName: string; projectName?: string } | null>(null)
  const [fullscreenPlan, setFullscreenPlan] = useState<{ content: string; taskName: string; projectName?: string } | null>(null)

  // Open fullscreen when runner responds with plan content
  useEffect(() => {
    if (!pendingPlanView) return
    const content = planContents[pendingPlanView.taskId]
    if (content === undefined) return // not arrived yet
    setPendingPlanView(null)
    if (content !== null) {
      setFullscreenPlan({ content, taskName: pendingPlanView.taskName, projectName: pendingPlanView.projectName })
    }
  }, [planContents, pendingPlanView])

  const categories = [...new Set(tasks.map(t => t.category))].filter(Boolean)
  const effectiveFilters = { ...filters, searchText }
  const filteredTasks = filtersExpanded
    ? applyFilters(tasks, effectiveFilters)
    : searchText
      ? applyFilters(tasks, { ...DEFAULT_FILTERS, searchText })
      : tasks

  // Build agentByTask first so bucket grouping can use it
  const agentByTask = new Map<number, AgentSession>()
  for (const agent of agents) {
    if (agent.state === 'running' || agent.state === 'waiting') {
      agentByTask.set(agent.taskId, agent)
    }
  }

  // Tasks with an active agent are hoisted into the running bucket regardless of stored bucket
  const tasksByBucket: Record<Bucket, Task[]> = {
    running: sortByPriority(filteredTasks.filter(t => t.bucket === 'running' || agentByTask.has(t.id))),
    review: sortByPriority(filteredTasks.filter(t => t.bucket === 'review' && !agentByTask.has(t.id))),
    ready: sortByPriority(filteredTasks.filter(t => t.bucket === 'ready' && !agentByTask.has(t.id))),
    'needs-planning': sortByPriority(filteredTasks.filter(t => t.bucket === 'needs-planning' && !agentByTask.has(t.id))),
    blocked: sortByPriority(filteredTasks.filter(t => t.bucket === 'blocked' && !agentByTask.has(t.id))),
    manual: sortByPriority(filteredTasks.filter(t => t.bucket === 'manual' && !agentByTask.has(t.id))),
    done: sortByPriority(filteredTasks.filter(t => t.bucket === 'done' && !agentByTask.has(t.id))),
  }

  // Focus mode: highlight review if it has items, else ready, else nothing
  const focusBucket: Bucket | null =
    tasksByBucket.review.length > 0 ? 'review' :
    tasksByBucket.ready.length > 0 ? 'ready' :
    null

  function handleDelete(taskId: number) {
    send({ type: 'delete_task', projectId: currentProject, taskId })
  }

  function toggleSelect(taskId: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return
    send({ type: 'delete_tasks', projectId: currentProject, taskIds: [...selectedIds] })
    setSelectedIds(new Set())
    onExitSelectionMode()
    setConfirmBulkDelete(false)
  }

  function exitSelectionMode() {
    onExitSelectionMode()
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
  }

  function taskKey(task: Task) {
    return `${task.projectId}-${task.id}`
  }

  function renderTaskCard(task: Task, cardBorderClass: string, leftBorderClass?: string) {
    return (
      <TaskCard
        key={taskKey(task)}
        borderClass={cardBorderClass}
        leftBorderClass={leftBorderClass}
        task={task}
        activeAgent={agentByTask.get(task.id) ?? null}
        onSpawn={(mode) => {
          setDefaultMode(mode)
          setSpawnTask(task)
        }}
        onEdit={(t) => setEditTask(t)}
        onDelete={handleDelete}
        onMarkDone={(taskId) => send({ type: 'update_task', projectId: currentProject, taskId, patch: { status: 'done' } })}
        selectionMode={selectionMode}
        selected={selectedIds.has(task.id)}
        onToggleSelect={() => toggleSelect(task.id)}
        projectLabel={showAllProjects ? (() => {
          const proj = projects.find(p => p.id === task.projectId)
          return proj ? proj.name : undefined
        })() : undefined}
        onNavigateQueue={
          (task.status === 'plan-review' || task.status === 'in-review')
            ? () => onNavigateQueue?.()
            : undefined
        }
        onViewPlan={requestPlanContent && task.status !== 'needs-planning' ? () => {
          const proj = projects.find(p => p.id === task.projectId)
          setPendingPlanView({ taskId: task.id, taskName: task.name, projectName: proj?.name })
          requestPlanContent(task.id, task.projectId)
        } : undefined}
        expanded={expandedTaskId === taskKey(task)}
        onToggle={() => setExpandedTaskId(prev =>
          prev === taskKey(task) ? null : taskKey(task)
        )}
        send={send}
        onViewTerminal={onViewTerminal}
        onNavigateAgents={onNavigateAgents}
        preferences={preferences}
      />
    )
  }

  return (
    <div>
      <TaskFilterBar
        tasks={tasks}
        filters={effectiveFilters}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        resultCount={filteredTasks.length}
        filtersExpanded={filtersExpanded ?? false}
        onToggleFilters={onToggleFilters ?? (() => {})}
      />

      {/* Selection mode bar */}
      {selectionMode && (
        <div className="flex items-center gap-3 mb-3 px-2 py-2 bg-gray-800/50 rounded text-xs">
          <span className="text-gray-400">{selectedIds.size} selected</span>
          {confirmBulkDelete ? (
            <span className="flex items-center gap-1">
              <span className="text-gray-400">Delete?</span>
              <button onClick={handleBulkDelete} className="text-red-400 hover:text-red-300 font-medium">Yes</button>
              <button onClick={() => setConfirmBulkDelete(false)} className="text-gray-500 hover:text-gray-300">No</button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmBulkDelete(true)}
              disabled={selectedIds.size === 0}
              className={selectedIds.size > 0 ? 'text-red-400 hover:text-red-300' : 'text-gray-600 cursor-not-allowed'}
            >
              Delete
            </button>
          )}
          <button onClick={exitSelectionMode} className="text-gray-500 hover:text-gray-300 ml-auto">Done</button>
        </div>
      )}

      {/* Data-driven bucket rendering */}
      {BUCKET_ORDER.map(({ key, label, accent, collapsible }) => {
        const bucketTasks = tasksByBucket[key]
        if (bucketTasks.length === 0) return null
        const isFocused = focusBucket === key
        const borderClass = isFocused ? BORDER_COLORS[accent].focused : BORDER_COLORS[accent].normal
        const leftBorder = LEFT_BORDER_COLORS[accent]

        if (collapsible) {
          return (
            <div key={key} className="mb-6">
              <button
                onClick={() => setDoneExpanded(prev => !prev)}
                className="text-sm font-sans font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1 w-full hover:text-gray-300 transition-colors"
              >
                <span className="text-xs">{doneExpanded ? '▼' : '▶'}</span>
                {label}
                <span className="ml-1 text-gray-500">({bucketTasks.length})</span>
              </button>
              {doneExpanded && (
                <div className="grid gap-3">
                  {bucketTasks.map(t => renderTaskCard(t, borderClass, leftBorder))}
                </div>
              )}
            </div>
          )
        }

        return (
          <div key={key} className="mt-8 mb-6">
            <div className="text-sm font-sans font-bold text-gray-400 uppercase tracking-wide mb-3">
              {label}
              <span className="ml-2 text-gray-500">({bucketTasks.length})</span>
            </div>
            <div className="grid gap-3">
              {bucketTasks.map(t => renderTaskCard(t, borderClass, leftBorder))}
            </div>
          </div>
        )
      })}

      {filteredTasks.length === 0 && tasks.length > 0 && (
        <p className="text-gray-500 text-center py-12">No tasks match the current filters.</p>
      )}

      {tasks.length === 0 && (
        <p className="text-gray-500 text-center py-12">No tasks loaded. Check project configuration.</p>
      )}

      {spawnTask && (
        <SpawnDialog
          task={spawnTask}
          defaultMode={defaultMode}
          send={send}
          onClose={() => setSpawnTask(null)}
          promptLibrary={promptLibrary}
          preferences={preferences[defaultMode]}
        />
      )}

      {(editTask || showCreate) && (
        <TaskEditDialog
          task={editTask}
          categories={categories}
          projectId={currentProject}
          send={send}
          onClose={() => { setEditTask(null); onCloseCreate() }}
        />
      )}

      {fullscreenPlan && (
        <FullscreenPlanReview
          content={fullscreenPlan.content}
          taskName={fullscreenPlan.taskName}
          projectName={fullscreenPlan.projectName}
          readOnly
          onApprove={() => setFullscreenPlan(null)}
          onReject={() => setFullscreenPlan(null)}
          onClose={() => setFullscreenPlan(null)}
        />
      )}
    </div>
  )
}
