// src/web/components/HumanWorkQueue.tsx
import { useState } from 'react'
import type { QueueItem, QueueItemType, ClientMessage, AgentSession, ProjectConfig } from '@shared/types'
import ConversationThread from './ConversationThread'
import PlanViewer from './PlanViewer'
import FullscreenPlanReview from './FullscreenPlanReview'
import MarkdownRenderer from './MarkdownRenderer'
import VerificationViewer from './VerificationViewer'
import StatusIndicator from './StatusIndicator'
import ProjectAvatar from './ProjectAvatar'
import { ExpandIcon } from './icons'
import type { VerificationReport } from '@shared/types'

interface Props {
  items: QueueItem[]
  agents: AgentSession[]
  projects: ProjectConfig[]
  send: (msg: ClientMessage) => void
}

const TYPE_LABELS: Record<QueueItemType, { color: string; shape?: 'circle' | 'diamond' | 'triangle'; label: string; leftBorder: string }> = {
  'agent-question': { color: 'text-yellow-400', label: 'Agent Question', leftBorder: 'border-l-yellow-500' },
  'permission-approval': { color: 'text-blue-400', shape: 'diamond', label: 'Permission Request', leftBorder: 'border-l-blue-500' },
  'plan-review': { color: 'text-purple-400', label: 'Plan Review', leftBorder: 'border-l-purple-500' },
  'output-verification': { color: 'text-blue-300', label: 'Output Verification', leftBorder: 'border-l-blue-400' },
  'stage-approval': { color: 'text-green-400', label: 'Stage Approval', leftBorder: 'border-l-green-500' },
  'manual-work': { color: 'text-orange-400', shape: 'diamond', label: 'Manual Work', leftBorder: 'border-l-orange-500' },
  'stalled-agent': { color: 'text-orange-400', shape: 'triangle', label: 'Stalled Agent', leftBorder: 'border-l-orange-500' },
}

export default function HumanWorkQueue({ items, agents, projects, send }: Props) {
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [showDismissed, setShowDismissed] = useState(false)
  const [fullscreenPlanId, setFullscreenPlanId] = useState<string | null>(null)

  const activeItems = items.filter(i => !i.dismissed)
  const dismissedItems = items.filter(i => i.dismissed)
  const visibleItems = showDismissed ? dismissedItems : activeItems
  const sorted = [...visibleItems].sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)

  const resolve = (itemId: string, action: string, response?: string) => {
    send({ type: 'resolve_queue_item', itemId, action, response: response ?? responses[itemId] })
    setResponses(prev => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  const timeAgo = (ts: number) => {
    const mins = Math.round((Date.now() - ts) / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.round(mins / 60)}h ago`
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          onClick={() => setShowDismissed(false)}
          className={`text-sm transition-colors ${!showDismissed ? 'text-gray-200 font-semibold' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Queue{activeItems.length > 0 && <span className="ml-1 text-gray-400 font-normal text-xs">({activeItems.length})</span>}
        </button>
        {dismissedItems.length > 0 && (
          <button
            onClick={() => setShowDismissed(true)}
            className={`text-sm transition-colors ${showDismissed ? 'text-gray-200 font-semibold' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Dismissed <span className="text-xs font-normal">({dismissedItems.length})</span>
          </button>
        )}
      </div>

      {sorted.length === 0 && !showDismissed && (
        <p className="text-gray-500 text-center py-12">No items need attention. Agents are working autonomously.</p>
      )}
      {sorted.length === 0 && showDismissed && (
        <p className="text-gray-500 text-center py-12">No dismissed items.</p>
      )}

      <div className="grid gap-3">
        {sorted.map(item => {
          const typeInfo = TYPE_LABELS[item.type]
          const agent = item.agentId ? agents.find(a => a.id === item.agentId) : null
          const expanded = expandedItemId === item.id
          return (
            <div key={item.id} className={`bg-gray-900 border border-gray-700 border-l-[3px] ${typeInfo.leftBorder} rounded-lg overflow-hidden hover:border-gray-600 transition-colors`}>
              {/* Collapsed header — always visible */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpandedItemId(prev => prev === item.id ? null : item.id)}
              >
                <StatusIndicator color={typeInfo.color} shape={typeInfo.shape} size="md" />
                <span className="font-medium truncate min-w-0 flex-1">
                  {typeInfo.label}: {item.taskName}
                </span>
                <span className="text-xs text-gray-500 whitespace-nowrap">{timeAgo(item.createdAt)}</span>
              </div>

              {/* Expanded body — animated via grid-rows */}
              <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="px-5 pb-5">
                    {/* Project badge */}
                    {(() => {
                      const proj = projects.find(p => p.id === item.projectId)
                      return proj ? (
                        <span className="inline-flex text-xs bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded items-center gap-1.5 mb-2">
                          <ProjectAvatar name={proj.name} size="sm" />
                          {proj.name}
                        </span>
                      ) : null
                    })()}

                    <p className="text-sm text-gray-300 mt-1">{item.summary}</p>

                    {item.type === 'agent-question' && agent && agent.conversationHistory.length > 0 ? (
                      <div className="mt-3">
                        <ConversationThread
                          history={agent.conversationHistory}
                          onSend={(text) => resolve(item.id, 'respond', text)}
                          showInput={true}
                          compact={true}
                        />
                      </div>
                    ) : item.type === 'agent-question' ? (
                      <>
                        {item.detail && item.detail !== item.summary && (
                          <pre className="text-xs text-gray-500 mt-2 bg-gray-950 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono">
                            {item.detail}
                          </pre>
                        )}
                        <div className="flex gap-2 mt-3">
                          <input
                            type="text"
                            placeholder="Type response..."
                            value={responses[item.id] ?? ''}
                            onChange={e => setResponses(prev => ({ ...prev, [item.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && responses[item.id]) resolve(item.id, 'respond')
                            }}
                            className="flex-1 text-sm bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-gray-100"
                          />
                          <button
                            onClick={() => resolve(item.id, 'respond')}
                            className="text-xs bg-blue-500 hover:bg-blue-500/80 text-white px-3 py-1.5 rounded transition-colors"
                          >
                            Respond
                          </button>
                        </div>
                      </>
                    ) : null}

                    {item.type === 'plan-review' && (
                      <>
                        <button
                          onClick={() => setFullscreenPlanId(item.id)}
                          className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 mt-2 mb-1 transition-colors"
                        >
                          <ExpandIcon className="text-purple-400" />
                          Read full plan
                        </button>
                        <PlanViewer
                          content={item.detail || item.summary}
                          onApprove={(notes) => resolve(item.id, 'approve', notes)}
                          onReject={(feedback) => resolve(item.id, 'reject', feedback)}
                        />
                      </>
                    )}

                    {item.type === 'output-verification' && (() => {
                      const verificationAgent = item.agentId ? agents.find(a => a.id === item.agentId) : null
                      const report: VerificationReport | null = verificationAgent?.verificationReport ?? null
                      if (report) {
                        return (
                          <VerificationViewer
                            report={report}
                            onApprove={(notes) => resolve(item.id, 'approve', notes)}
                            onReject={(feedback) => resolve(item.id, 'reject', feedback)}
                          />
                        )
                      }
                      return (
                        <div className="mt-3">
                          <button
                            onClick={() => setFullscreenPlanId(item.id)}
                            className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 mb-2 transition-colors"
                          >
                            <ExpandIcon className="text-blue-300" />
                            Read full plan
                          </button>
                          <div className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 max-h-96 overflow-y-auto">
                            <MarkdownRenderer content={item.detail || item.summary} />
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => resolve(item.id, 'approve')}
                              className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => resolve(item.id, 'reject')}
                              className="text-xs bg-red-900/60 hover:bg-red-800/60 text-red-300 px-3 py-1.5 rounded transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )
                    })()}

                    {item.type !== 'agent-question' && item.type !== 'plan-review' && item.type !== 'output-verification' && (
                      <>
                        {item.detail && item.detail !== item.summary && (
                          <pre className="text-xs text-gray-500 mt-2 bg-gray-950 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono">
                            {item.detail}
                          </pre>
                        )}

                        <div className="flex gap-2 mt-3">
                          {item.type === 'stalled-agent' && (
                            <>
                              <button
                                onClick={() => resolve(item.id, 'nudge')}
                                className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded transition-colors"
                              >
                                Nudge Agent
                              </button>
                              <button
                                onClick={() => resolve(item.id, 'kill')}
                                className="text-xs bg-red-900/60 hover:bg-red-800/60 text-red-300 px-3 py-1.5 rounded transition-colors"
                              >
                                Kill Agent
                              </button>
                            </>
                          )}

                          {['permission-approval', 'output-verification', 'stage-approval', 'manual-work'].includes(item.type) && (
                            <button
                              onClick={() => resolve(item.id, 'done')}
                              className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded transition-colors"
                            >
                              Mark Done
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    <div className={`flex gap-2 ${item.type === 'agent-question' ? 'mt-2' : ''}`}>
                      {item.dismissed ? (
                        <button
                          onClick={() => resolve(item.id, 'restore')}
                          className="text-xs border border-blue-500/40 text-blue-300 hover:bg-blue-900/20 px-3 py-1.5 rounded transition-colors"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => resolve(item.id, 'dismiss')}
                          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded transition-colors"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Fullscreen plan review overlay */}
      {fullscreenPlanId && (() => {
        const item = items.find(i => i.id === fullscreenPlanId)
        if (!item) return null
        const proj = projects.find(p => p.id === item.projectId)
        return (
          <FullscreenPlanReview
            content={item.detail || item.summary}
            taskName={item.taskName}
            projectName={proj?.name}
            onApprove={(notes) => {
              resolve(item.id, 'approve', notes)
              setFullscreenPlanId(null)
            }}
            onReject={(feedback) => {
              resolve(item.id, 'reject', feedback)
              setFullscreenPlanId(null)
            }}
            onClose={() => setFullscreenPlanId(null)}
          />
        )
      })()}
    </div>
  )
}
