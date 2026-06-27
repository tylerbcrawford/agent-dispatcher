// src/web/components/TaskCard.tsx
import { useState } from 'react'
import type { Task, AgentSession, TaskStatus, ClientMessage, DiffData, ProjectConfig } from '@shared/types'
import StatusIndicator from './StatusIndicator'
import { CheckIcon, CopyIcon, EditIcon, PlayIcon, RestoreIcon, TrashIcon } from './icons'
import AgentControls from './AgentControls'

interface Props {
  task: Task
  agent: AgentSession | null
  onSpawn: (mode: 'plan' | 'implement') => void
  onEdit: (task: Task) => void
  onDelete: () => void
  onMarkDone: () => void
  onRestore: () => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  projectLabel?: string
  onViewPlan?: () => void
  expanded: boolean
  onToggle: () => void
  send: (msg: ClientMessage) => void
  onViewTerminal: (agentId: string) => void
  diffs: Record<string, DiffData>
  requestDiff: (agentId: string) => void
  projects: ProjectConfig[]
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

export default function TaskCard({ task, agent, onSpawn, onEdit, onDelete, onMarkDone, onRestore, selectionMode, selected, onToggleSelect, projectLabel, onViewPlan, expanded, onToggle, send, onViewTerminal, diffs, requestDiff, projects }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const agentIsActive = !!agent && ['running', 'waiting', 'stalled'].includes(agent.state)

  return (
    <div className={`group bg-gray-900 border rounded-lg overflow-hidden transition-colors ${selected ? 'border-red-500/50 bg-red-950/10' : 'border-gray-700'}`}>
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
        {task.score != null && (
          <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">{task.score}</span>
        )}
        <span className="font-medium truncate min-w-0 flex-1 text-gray-200">{task.name}</span>
        {/* Pulsing blue dot when agent is active and card is collapsed */}
        {!expanded && agent && (agent.state === 'running' || agent.state === 'waiting') && (
          <StatusIndicator color="text-blue-400" pulse />
        )}
      </div>

      {/* Expanded body — animated via grid-rows */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-5 pb-4">
            {/* Meta row — meta left, CTA right */}
            <div className="flex items-center justify-between mt-1 text-sm text-gray-400">
              <div className="flex items-center gap-3 flex-wrap">
                {projectLabel && (
                  <span className="bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{projectLabel}</span>
                )}
                <span>{task.priority}</span>
                <span>{task.timeEstimate}</span>
                {task.category && (
                  <span>{task.category}</span>
                )}
              </div>

              {/* Inline CTA */}
              {(task.status === 'ready' && !agentIsActive) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSpawn('implement') }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-500/40 text-blue-400 hover:bg-blue-900/20 hover:border-blue-500/70 text-xs transition-colors"
                >
                  <PlayIcon />
                  <span>Launch</span>
                </button>
              )}
              {task.status === 'needs-planning' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSpawn('plan') }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-500/40 text-blue-400 hover:bg-blue-900/20 hover:border-blue-500/70 text-xs transition-colors"
                >
                  <PlayIcon />
                  <span>Plan</span>
                </button>
              )}
            </div>

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
              <div className="flex mt-2">
                <button
                  onClick={onViewPlan}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
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
            {agent && (
              <AgentControls
                agent={agent}
                projects={projects}
                send={send}
                onViewTerminal={onViewTerminal}
                diffs={diffs}
                requestDiff={requestDiff}
              />
            )}

            {/* Status messages */}
            {task.status === 'plan-review' && (
              <div className="mt-3">
                <span className="text-xs text-gray-500">Awaiting review in queue</span>
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
              <div className="flex mt-3">
                {showActions ? (
                  <div className="flex items-center gap-3">
                    {task.status !== 'done' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onMarkDone() }}
                        className="text-gray-500 hover:text-gray-300 transition-all p-1"
                        title="Mark done"
                      >
                        <CheckIcon />
                      </button>
                    )}
                    {task.status === 'done' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRestore() }}
                        className="text-gray-500 hover:text-gray-300 transition-all p-1"
                        title="Restore to ready"
                      >
                        <RestoreIcon />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(task.description || task.name)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                      }}
                      className="text-gray-500 hover:text-blue-400 transition-all p-1"
                      title={copied ? 'Copied!' : 'Copy task'}
                    >
                      {copied ? <span className="text-xs text-blue-400">Copied!</span> : <CopyIcon />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(task) }}
                      className="text-gray-500 hover:text-gray-300 transition-all p-1"
                      title="Edit task"
                    >
                      <EditIcon />
                    </button>
                    {!agent && (
                      confirmDelete ? (
                        <span className="flex gap-1 items-center">
                          <span className="text-xs text-gray-400">Delete?</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); setConfirmDelete(false) }}
                            className="text-xs text-red-400 hover:text-red-300 px-1 py-0.5 transition-colors font-medium"
                          >
                            Yes
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
                            className="text-xs text-gray-500 hover:text-gray-300 px-1 py-0.5 transition-colors"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
                          className="text-gray-500 hover:text-red-400 transition-all p-1"
                          title="Delete task"
                        >
                          <TrashIcon />
                        </button>
                      )
                    )}
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowActions(true) }}
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
