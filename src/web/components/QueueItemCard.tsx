// src/web/components/QueueItemCard.tsx
import { useState } from 'react'
import type { QueueItem, QueueItemType, ClientMessage, AgentSession, ProjectConfig, VerificationReport } from '@shared/types'
import ConversationThread from './ConversationThread'
import PlanViewer from './PlanViewer'
import FullscreenPlanReview from './FullscreenPlanReview'
import MarkdownRenderer from './MarkdownRenderer'
import VerificationViewer from './VerificationViewer'
import StatusIndicator from './StatusIndicator'
import ProjectAvatar from './ProjectAvatar'
import { ExpandIcon } from './icons'

interface Props {
  item: QueueItem
  agent: AgentSession | null        // the agent for this item (caller looks up by item.agentId)
  projects: ProjectConfig[]         // for the ProjectAvatar badge
  send: (msg: ClientMessage) => void
  compact?: boolean                 // strip density — default false
}

// Desaturated palette — only genuinely urgent types use blue; rest stay gray
const TYPE_INFO: Record<QueueItemType, { color: string; shape?: 'circle' | 'diamond' | 'triangle'; label: string }> = {
  'agent-question':      { color: 'text-blue-400',  label: 'Agent Question' },
  'permission-approval': { color: 'text-gray-400',  shape: 'diamond', label: 'Permission Request' },
  'plan-review':         { color: 'text-gray-400',  label: 'Plan Review' },
  'output-verification': { color: 'text-gray-400',  label: 'Output Verification' },
  'stage-approval':      { color: 'text-gray-400',  label: 'Stage Approval' },
  'manual-work':         { color: 'text-gray-400',  shape: 'diamond', label: 'Manual Work' },
  'stalled-agent':       { color: 'text-blue-400',  shape: 'triangle', label: 'Stalled Agent' },
}

const timeAgo = (ts: number) => {
  const mins = Math.round((Date.now() - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function QueueItemCard({ item, agent, projects, send, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [response, setResponse] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  // Single exit point for all actions — preserves resolve_queue_item message shape exactly
  const resolve = (action: string, value?: string) =>
    send({ type: 'resolve_queue_item', itemId: item.id, action, response: value })

  const typeInfo = TYPE_INFO[item.type]
  const headerPy = compact ? 'py-2' : 'py-3'
  const headerText = compact ? 'text-sm' : ''

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors">
      {/* Collapsed header — always visible */}
      <div
        className={`flex items-center gap-3 px-4 ${headerPy} cursor-pointer`}
        onClick={() => setExpanded(prev => !prev)}
      >
        <StatusIndicator color={typeInfo.color} shape={typeInfo.shape} size="md" />
        <span className={`font-medium truncate min-w-0 flex-1 ${headerText}`}>
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

            {/* agent-question: with conversation history */}
            {item.type === 'agent-question' && agent && agent.conversationHistory.length > 0 ? (
              <div className="mt-3">
                <ConversationThread
                  history={agent.conversationHistory}
                  onSend={(text) => resolve('respond', text)}
                  showInput={true}
                  compact={true}
                />
              </div>
            ) : item.type === 'agent-question' ? (
              /* agent-question: no conversation history */
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
                    value={response}
                    onChange={e => setResponse(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && response) resolve('respond', response)
                    }}
                    className="flex-1 text-sm bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-gray-100"
                  />
                  <button
                    onClick={() => resolve('respond', response)}
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors"
                  >
                    Respond
                  </button>
                </div>
              </>
            ) : null}

            {/* plan-review */}
            {item.type === 'plan-review' && (
              <>
                <button
                  onClick={() => setFullscreen(true)}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-2 mb-1 transition-colors"
                >
                  <ExpandIcon className="text-blue-400" />
                  Read full plan
                </button>
                <PlanViewer
                  content={item.detail || item.summary}
                  onApprove={(notes) => resolve('approve', notes)}
                  onReject={(feedback) => resolve('reject', feedback)}
                />
              </>
            )}

            {/* output-verification */}
            {item.type === 'output-verification' && (() => {
              const report: VerificationReport | null = agent?.verificationReport ?? null
              if (report) {
                return (
                  <VerificationViewer
                    report={report}
                    onApprove={(notes) => resolve('approve', notes)}
                    onReject={(feedback) => resolve('reject', feedback)}
                  />
                )
              }
              return (
                <div className="mt-3">
                  <button
                    onClick={() => setFullscreen(true)}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mb-2 transition-colors"
                  >
                    <ExpandIcon className="text-blue-400" />
                    Read full plan
                  </button>
                  <div className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 max-h-96 overflow-y-auto">
                    <MarkdownRenderer content={item.detail || item.summary} />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => resolve('approve')}
                      className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => resolve('reject')}
                      className="text-xs bg-red-900/60 hover:bg-red-800/60 text-red-300 px-3 py-1.5 rounded transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* stalled-agent / permission-approval / stage-approval / manual-work */}
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
                        onClick={() => resolve('nudge')}
                        className="text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded border border-gray-600 hover:border-gray-500 transition-colors"
                      >
                        Nudge Agent
                      </button>
                      <button
                        onClick={() => resolve('kill')}
                        className="text-xs bg-red-900/60 hover:bg-red-800/60 text-red-300 px-3 py-1.5 rounded transition-colors"
                      >
                        Kill Agent
                      </button>
                    </>
                  )}

                  {(item.type === 'permission-approval' || item.type === 'stage-approval' || item.type === 'manual-work') && (
                    <button
                      onClick={() => resolve('done')}
                      className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors"
                    >
                      Mark Done
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Dismiss / Restore — ALL items */}
            <div className={`flex gap-2 ${item.type === 'agent-question' ? 'mt-2' : ''}`}>
              {item.dismissed ? (
                <button
                  onClick={() => resolve('restore')}
                  className="text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 transition-colors"
                >
                  Restore
                </button>
              ) : (
                <button
                  onClick={() => resolve('dismiss')}
                  className="text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Item-level FullscreenPlanReview — NOT readOnly, wired to active approve/reject */}
      {fullscreen && (() => {
        const proj = projects.find(p => p.id === item.projectId)
        return (
          <FullscreenPlanReview
            content={item.detail || item.summary}
            taskName={item.taskName}
            projectName={proj?.name}
            onApprove={(notes) => { resolve('approve', notes); setFullscreen(false) }}
            onReject={(feedback) => { resolve('reject', feedback); setFullscreen(false) }}
            onClose={() => setFullscreen(false)}
          />
        )
      })()}
    </div>
  )
}
