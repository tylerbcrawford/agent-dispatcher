// src/web/components/TaskBoard.tsx
import { useState, useEffect } from 'react'
import type { Task, Priority, Bucket, AgentSession, ClientMessage, PromptLibraryMeta, ProjectConfig, QueueItem, DiffData } from '@shared/types'
import TaskCard from './TaskCard'
import StatusIndicator from './StatusIndicator'
import SpawnDialog from './SpawnDialog'
import TaskEditDialog from './TaskEditDialog'
import TaskFilterBar, { type TaskFilters, DEFAULT_FILTERS, applyFilters } from './TaskFilterBar'
import FullscreenPlanReview from './FullscreenPlanReview'
import NeedsYouStrip from './NeedsYouStrip'

const PRIORITY_ORDER: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

// Sort by score descending (nulls last), then by priority as tiebreaker
const sortByScore = (tasks: Task[]) =>
  [...tasks].sort((a, b) => {
    const sa = a.score ?? -1
    const sb = b.score ?? -1
    if (sa !== sb) return sb - sa
    return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
  })

const sortByPriority = (tasks: Task[]) =>
  [...tasks].sort((a, b) => {
    // If both have scores, use score descending
    if (a.score != null && b.score != null && a.score !== b.score) return b.score - a.score
    return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
  })

const BUCKET_ORDER: { key: Bucket; label: string; collapsible?: boolean }[] = [
  { key: 'running',        label: 'Running' },
  { key: 'review',         label: 'Needs Review' },
  { key: 'ready',          label: 'Ready' },
  { key: 'needs-planning', label: 'Needs Planning' },
  { key: 'blocked',        label: 'Blocked' },
  { key: 'manual',         label: 'Manual' },
  { key: 'done',           label: 'Done', collapsible: true },
]

export type ViewMode = 'bucketed' | 'ranked'

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
  queue: QueueItem[]
  selectionMode: boolean
  onExitSelectionMode: () => void
  searchText?: string
  filtersExpanded?: boolean
  onToggleFilters?: () => void
  planContents?: Record<string, string | null>
  requestPlanContent?: (taskId: number, projectId: string) => void
  viewMode?: ViewMode
  onViewTerminal: (agentId: string) => void
  diffs: Record<string, DiffData>
  requestDiff: (agentId: string) => void
}

export default function TaskBoard({ tasks, agents, queue, send, currentProject, promptLibrary, projects, showAllProjects, showCreate, onCloseCreate, selectionMode, onExitSelectionMode, searchText = '', filtersExpanded, onToggleFilters, planContents = {}, requestPlanContent, viewMode = 'bucketed', onViewTerminal, diffs, requestDiff }: Props) {
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

  // Build agentByTask — index ALL states; prefer active (running/waiting/stalled) over finished;
  // break ties by most recent startedAt so the latest run wins.
  // KEY: composite "${projectId}-${taskId}" to avoid collisions in All-Projects view.
  const ACTIVE_AGENT_STATES = ['running', 'waiting', 'stalled']
  const agentByTask = new Map<string, AgentSession>()
  for (const agent of agents) {
    const key = `${agent.projectId}-${agent.taskId}`
    const existing = agentByTask.get(key)
    if (!existing) {
      agentByTask.set(key, agent)
    } else {
      const agentIsActive = ACTIVE_AGENT_STATES.includes(agent.state)
      const existingIsActive = ACTIVE_AGENT_STATES.includes(existing.state)
      // Active beats finished; among equal activity level, prefer more recent startedAt
      if (agentIsActive && !existingIsActive) {
        agentByTask.set(key, agent)
      } else if (agentIsActive === existingIsActive && agent.startedAt > existing.startedAt) {
        agentByTask.set(key, agent)
      }
    }
  }

  // Tasks with an ACTIVE agent are hoisted into the running bucket regardless of stored bucket.
  // Finished agents (completed/errored/suspended) do NOT trigger a hoist — those tasks stay in
  // their own bucket so they remain actionable (e.g. a ready task keeps its Launch button).
  const isActivelyRunning = (t: Task) => {
    const a = agentByTask.get(`${t.projectId}-${t.id}`)
    return !!a && ACTIVE_AGENT_STATES.includes(a.state)
  }
  const tasksByBucket: Record<Bucket, Task[]> = {
    running: sortByPriority(filteredTasks.filter(t => t.bucket === 'running' || isActivelyRunning(t))),
    review: sortByPriority(filteredTasks.filter(t => t.bucket === 'review' && !isActivelyRunning(t))),
    ready: sortByPriority(filteredTasks.filter(t => t.bucket === 'ready' && !isActivelyRunning(t))),
    'needs-planning': sortByPriority(filteredTasks.filter(t => t.bucket === 'needs-planning' && !isActivelyRunning(t))),
    blocked: sortByPriority(filteredTasks.filter(t => t.bucket === 'blocked' && !isActivelyRunning(t))),
    manual: sortByPriority(filteredTasks.filter(t => t.bucket === 'manual' && !isActivelyRunning(t))),
    done: sortByPriority(filteredTasks.filter(t => t.bucket === 'done' && !isActivelyRunning(t))),
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

  function renderTaskCard(task: Task) {
    return (
      <TaskCard
        key={taskKey(task)}
        task={task}
        agent={agentByTask.get(`${task.projectId}-${task.id}`) ?? null}
        onSpawn={(mode) => {
          setDefaultMode(mode)
          setSpawnTask(task)
        }}
        onEdit={(t) => setEditTask(t)}
        onDelete={() => send({ type: 'delete_task', projectId: task.projectId, taskId: task.id })}
        onMarkDone={() => send({ type: 'update_task', projectId: task.projectId, taskId: task.id, patch: { status: 'done' } })}
        onRestore={() => send({ type: 'update_task', projectId: task.projectId, taskId: task.id, patch: { status: 'ready' } })}
        selectionMode={selectionMode}
        selected={selectedIds.has(task.id)}
        onToggleSelect={() => toggleSelect(task.id)}
        projectLabel={showAllProjects ? (() => {
          const proj = projects.find(p => p.id === task.projectId)
          return proj ? proj.name : undefined
        })() : undefined}
        onViewPlan={requestPlanContent && task.hasPlan ? () => {
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
        diffs={diffs}
        requestDiff={requestDiff}
        projects={projects}
      />
    )
  }

  return (
    <div>
      <NeedsYouStrip items={queue} agents={agents} projects={projects} send={send} />
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

      {/* Bucketed view (default) */}
      {viewMode === 'bucketed' && BUCKET_ORDER.map(({ key, label, collapsible }) => {
        const bucketTasks = tasksByBucket[key]
        if (bucketTasks.length === 0) return null

        if (collapsible) {
          return (
            <div key={key} className="mb-6">
              <button
                onClick={() => setDoneExpanded(prev => !prev)}
                className="text-sm font-sans font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center justify-start gap-1 w-full hover:text-gray-300 transition-colors"
              >
                <span className="text-xs">{doneExpanded ? '▼' : '▶'}</span>
                {label}
                <span className="ml-1 text-gray-500">({bucketTasks.length})</span>
              </button>
              {doneExpanded && (
                <div className="grid gap-2">
                  {bucketTasks.map(t => renderTaskCard(t))}
                </div>
              )}
            </div>
          )
        }

        return (
          <div key={key} className="mb-6">
            <div className="text-sm font-sans font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              {key === 'running' && <StatusIndicator color="text-blue-400" pulse />}
              {label}
              <span className="ml-1 text-gray-500">({bucketTasks.length})</span>
            </div>
            <div className="grid gap-2">
              {bucketTasks.map(t => renderTaskCard(t))}
            </div>
          </div>
        )
      })}

      {/* Ranked view — flat list sorted by score descending */}
      {viewMode === 'ranked' && (() => {
        const activeTasks = sortByScore(filteredTasks.filter(t => t.bucket !== 'done'))
        const doneTasks = sortByScore(filteredTasks.filter(t => t.bucket === 'done'))
        return (
          <>
            <div className="text-sm font-sans font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              Ranked Queue
              <span className="ml-1 text-gray-500">({activeTasks.length})</span>
            </div>
            <div className="grid gap-2 mb-6">
              {activeTasks.map((t, i) => (
                <div key={taskKey(t)} className="flex items-start gap-2">
                  <span className="text-xs text-gray-600 font-mono mt-3.5 w-5 text-right flex-shrink-0">{i + 1}</span>
                  <span className="mt-3.5 flex-shrink-0">
                    <StatusIndicator color={t.status === 'in-progress' ? 'text-blue-400' : 'text-gray-600'} pulse={t.status === 'in-progress'} />
                  </span>
                  <div className="flex-1">
                    {renderTaskCard(t)}
                  </div>
                </div>
              ))}
            </div>
            {doneTasks.length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => setDoneExpanded(prev => !prev)}
                  className="text-sm font-sans font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center justify-start gap-1 w-full hover:text-gray-300 transition-colors"
                >
                  <span className="text-xs">{doneExpanded ? '▼' : '▶'}</span>
                  Done
                  <span className="ml-1 text-gray-500">({doneTasks.length})</span>
                </button>
                {doneExpanded && (
                  <div className="grid gap-2">
                    {doneTasks.map(t => renderTaskCard(t))}
                  </div>
                )}
              </div>
            )}
          </>
        )
      })()}

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
        />
      )}

      {(editTask || showCreate) && (
        <TaskEditDialog
          task={editTask}
          categories={categories}
          projectId={editTask?.projectId ?? currentProject}
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
