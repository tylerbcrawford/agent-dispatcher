// src/web/components/TaskCard.tsx
import { useState } from 'react'
import type { Task, AgentSession, TaskStatus, ClientMessage, RunMode } from '@shared/types'
import type { ModeDefaults } from '../hooks/usePreferences'
import ConversationThread from './ConversationThread'
import ElapsedTime from './ElapsedTime'
import StatusIndicator from './StatusIndicator'
import { CheckIcon, CopyIcon, EditIcon, GearIcon, PlayIcon, TrashIcon } from './icons'

interface Props {
  task: Task
  activeAgent: AgentSession | null
  onSpawn: (mode: 'plan' | 'implement') => void
  onEdit: (task: Task) => void
  onDelete: (taskId: number) => void
  onMarkDone: (taskId: number) => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  projectLabel?: string
  onNavigateQueue?: () => void
  onViewPlan?: () => void
  expanded: boolean
  onToggle: () => void
  borderClass?: string
  leftBorderClass?: string
  send: (msg: ClientMessage) => void
  onViewTerminal?: (agentId: string) => void
  onNavigateAgents?: () => void
  preferences: Record<Exclude<RunMode, 'custom'>, ModeDefaults>
}

export const STATUS_BADGES: Record<TaskStatus, { label: string; className: string; color: string; pulse?: boolean; shape?: 'circle' | 'diamond' | 'triangle' }> = {
  'needs-planning': { label: 'Needs Plan', className: 'bg-yellow-900/40 text-yellow-300', color: 'text-yellow-400' },
  'plan-review': { label: 'Plan Review', className: 'bg-purple-900/40 text-purple-300', color: 'text-purple-400' },
  'ready': { label: 'Ready', className: 'bg-green-900/40 text-green-300', color: 'text-green-400' },
  'in-progress': { label: 'Running', className: 'bg-blue-900/40 text-blue-300', color: 'text-blue-400', pulse: true },
  'in-review': { label: 'In Review', className: 'bg-purple-900/40 text-purple-300', color: 'text-purple-300' },
  'done': { label: 'Done', className: 'bg-gray-800 text-gray-400', color: 'text-gray-500' },
  'blocked': { label: 'Blocked', className: 'bg-gray-800 text-gray-500', color: 'text-red-400' },
  'manual': { label: 'Manual', className: 'bg-red-900/40 text-red-300', color: 'text-red-400' },
}

export default function TaskCard({ task, activeAgent, onSpawn, onEdit, onDelete, onMarkDone, selectionMode, selected, onToggleSelect, projectLabel, onNavigateQueue, onViewPlan, expanded, onToggle, borderClass = 'border-gray-700', leftBorderClass, send, onViewTerminal, onNavigateAgents, preferences }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)

  function handleQuickLaunch(mode: 'plan' | 'implement') {
    const defaults = preferences[mode]
    send({
      type: 'spawn_agent',
      taskId: task.id,
      projectId: task.projectId,
      runMode: mode,
      executionMode: 'single',
      model: defaults.model,
      providerId: defaults.providerId,
      profile: defaults.profile,
      timeLimit: mode === 'plan' ? 30 : 60,
      gitBranch: mode !== 'plan',
      useModelHints: undefined,
    })
  }

  return (
    <div className={`group bg-gray-900 border rounded-lg overflow-hidden transition-colors ${leftBorderClass ? `border-l-[3px] ${leftBorderClass}` : ''} ${selected ? 'border-red-500/50 bg-red-950/10' : borderClass}`}>
      {/* Collapsed header — always visible */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={onToggle}
      >
        {selectionMode && (
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
            className="accent-red-500 w-4 h-4 cursor-pointer flex-shrink-0"
          />
        )}
        <span className="text-base font-medium truncate min-w-0 flex-1 text-gray-300">{task.name}</span>
        {(task.status === 'plan-review' || task.status === 'in-review') && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 flex-shrink-0">
            {task.status === 'plan-review' ? 'Plan' : 'Verify'}
          </span>
        )}
        {/* Pulsing blue dot when agent is active and card is collapsed */}
        {!expanded && activeAgent && (activeAgent.state === 'running' || activeAgent.state === 'waiting') && (
          <StatusIndicator color="text-blue-400" pulse />
        )}
      </div>

      {/* Expanded body — animated via grid-rows */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-5 pb-4">
            {/* Meta chips — small, muted, no pipe separators */}
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              {projectLabel && (
                <span className="bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{projectLabel}</span>
              )}
              <span>{task.priority}</span>
              <span>{task.timeEstimate}</span>
              {task.category && (
                <span>{task.category}</span>
              )}
            </div>

            {/* Action buttons — own dedicated line */}
            {(task.status === 'ready' || task.status === 'needs-planning' || task.status === 'plan-review' || task.status === 'in-review') && !activeAgent && (
              <div className="flex items-center gap-2 mt-3">
                {task.status === 'ready' && (
                  <>
                    <button
                      onClick={() => handleQuickLaunch('implement')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-900/30 border border-green-500/40 text-green-400 hover:bg-green-900/50 hover:border-green-500/70 text-xs transition-colors"
                    >
                      <PlayIcon />
                      <span>Launch</span>
                    </button>
                    <button
                      onClick={() => onSpawn('implement')}
                      className="text-gray-600 hover:text-gray-400 transition-colors p-1"
                      title="Customize launch"
                    >
                      <GearIcon />
                    </button>
                  </>
                )}
                {task.status === 'needs-planning' && (
                  <>
                    <button
                      onClick={() => handleQuickLaunch('plan')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-yellow-900/30 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-900/50 hover:border-yellow-500/70 text-xs transition-colors"
                    >
                      <PlayIcon />
                      <span>Plan</span>
                    </button>
                    <button
                      onClick={() => onSpawn('plan')}
                      className="text-gray-600 hover:text-gray-400 transition-colors p-1"
                      title="Customize plan"
                    >
                      <GearIcon />
                    </button>
                  </>
                )}
                {(task.status === 'plan-review' || task.status === 'in-review') && onNavigateQueue && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onNavigateQueue() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-900/30 border border-purple-500/40 text-purple-400 hover:bg-purple-900/50 hover:border-purple-500/70 text-xs transition-colors"
                  >
                    <PlayIcon />
                    <span>Review</span>
                  </button>
                )}
              </div>
            )}

            {/* Description — truncated to 2 lines, click to expand */}
            {task.description && (
              <p
                className={`text-sm text-gray-500 mt-2 break-words cursor-pointer ${!descExpanded ? 'line-clamp-2' : ''}`}
                onClick={(e) => { e.stopPropagation(); setDescExpanded(prev => !prev) }}
              >
                {task.description}
              </p>
            )}

            {/* View plan link */}
            {onViewPlan && (
              <div className="mt-2">
                <button
                  onClick={onViewPlan}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View plan →
                </button>
              </div>
            )}

            {/* Affects tags */}
            {task.affects.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {task.affects.map(tag => (
                  <span key={tag} className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Inline agent controls */}
            {activeAgent && (
              <div className="mt-3 bg-blue-900/20 border border-blue-700/30 rounded px-3 py-2 space-y-2">
                {/* Status row */}
                <div className="flex items-center gap-2 text-xs">
                  <StatusIndicator
                    color={activeAgent.state === 'running' ? 'text-green-400' : activeAgent.state === 'completed' ? 'text-green-400' : 'text-yellow-400'}
                    pulse={activeAgent.state === 'running'}
                  />
                  <span className="text-blue-400 truncate flex-1">
                    {activeAgent.displayName}
                  </span>
                  <span className="text-gray-500">
                    <ElapsedTime
                      startedAt={activeAgent.startedAt}
                      timeSpent={activeAgent.timeSpent}
                      timeLimit={activeAgent.timeLimit}
                      isRunning={activeAgent.state === 'running'}
                    />
                  </span>
                </div>

                {/* Conversation history (compact, last 3 entries) */}
                {activeAgent.conversationHistory.length > 0 && (
                  <ConversationThread
                    history={activeAgent.conversationHistory.slice(-3)}
                    onSend={(text) => send({ type: 'agent_input', agentId: activeAgent.id, input: text })}
                    showInput={activeAgent.state === 'waiting'}
                    compact
                  />
                )}

                {/* Contextual action + links */}
                <div className="flex items-center gap-2 text-xs">
                  {/* Contextual action button */}
                  {activeAgent.state === 'running' && (
                    <button
                      onClick={() => send({ type: 'stop_agent', agentId: activeAgent.id })}
                      className="bg-red-900/60 hover:bg-red-800/60 text-red-300 px-3 py-1 rounded transition-colors"
                    >
                      Stop
                    </button>
                  )}
                  {activeAgent.state === 'stalled' && (
                    <button
                      onClick={() => send({ type: 'nudge_agent', agentId: activeAgent.id, message: 'Continue working on the task.' })}
                      className="bg-orange-900/60 hover:bg-orange-800/60 text-orange-300 px-3 py-1 rounded transition-colors"
                    >
                      Nudge
                    </button>
                  )}
                  {activeAgent.state === 'completed' && (
                    <button
                      onClick={() => onMarkDone(task.id)}
                      className="bg-green-900/60 hover:bg-green-800/60 text-green-300 px-3 py-1 rounded transition-colors"
                    >
                      Mark Done
                    </button>
                  )}

                  <div className="flex-1" />

                  {/* Links */}
                  {onViewTerminal && ['running', 'waiting', 'stalled'].includes(activeAgent.state) && (
                    <button
                      onClick={() => onViewTerminal(activeAgent.id)}
                      className="text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Terminal
                    </button>
                  )}
                  {onNavigateAgents && (
                    <button
                      onClick={onNavigateAgents}
                      className="text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Details
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Status messages */}
            {task.status === 'plan-review' && (
              <div className="mt-3">
                <span className="text-xs text-purple-400">Awaiting review in queue</span>
              </div>
            )}
            {task.status === 'blocked' && task.depends.length > 0 && (
              <div className="mt-3">
                <span className="text-xs text-gray-500">
                  Blocked by: {task.depends.map(d => `#${d}`).join(', ')}
                </span>
              </div>
            )}

            {/* Action buttons — hidden behind overflow toggle */}
            {!selectionMode && (
              <div className="mt-3">
                {showActions ? (
                  <div className="flex items-center gap-3">
                    {task.status !== 'done' && (
                      <button
                        onClick={() => onMarkDone(task.id)}
                        className="text-gray-500 hover:text-green-400 transition-colors p-1"
                        title="Mark done"
                      >
                        <CheckIcon />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(task.description || task.name)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                      }}
                      className="text-gray-500 hover:text-blue-400 transition-colors p-1"
                      title={copied ? 'Copied!' : 'Copy task'}
                    >
                      {copied ? <span className="text-xs text-blue-400">Copied!</span> : <CopyIcon />}
                    </button>
                    <button
                      onClick={() => onEdit(task)}
                      className="text-gray-500 hover:text-gray-300 transition-colors p-1"
                      title="Edit task"
                    >
                      <EditIcon />
                    </button>
                    {!activeAgent && (
                      confirmDelete ? (
                        <span className="flex gap-1 items-center">
                          <span className="text-xs text-gray-400">Delete?</span>
                          <button
                            onClick={() => { onDelete(task.id); setConfirmDelete(false) }}
                            className="text-xs text-red-400 hover:text-red-300 px-1 py-0.5 transition-colors font-medium"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDelete(false)}
                            className="text-xs text-gray-500 hover:text-gray-300 px-1 py-0.5 transition-colors"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(true)}
                          className="text-gray-500 hover:text-red-400 transition-colors p-1"
                          title="Delete task"
                        >
                          <TrashIcon />
                        </button>
                      )
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowActions(true)}
                    className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
                  >
                    ···
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
