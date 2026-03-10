// src/web/components/AgentPanel.tsx
import { useState } from 'react'
import type { AgentSession, AgentState, ClientMessage, DiffData, ProjectConfig, ProviderId } from '@shared/types'
import ConversationThread from './ConversationThread'
import DiffViewer from './DiffViewer'
import ElapsedTime from './ElapsedTime'
import StatusIndicator from './StatusIndicator'
import ProjectAvatar from './ProjectAvatar'

interface Props {
  agents: AgentSession[]
  projects: ProjectConfig[]
  send: (msg: ClientMessage) => void
  onViewTerminal: (agentId: string) => void
  diffs: Record<string, DiffData>
  requestDiff: (agentId: string) => void
}

const STATE_ORDER: AgentState[] = ['running', 'waiting', 'stalled', 'suspended', 'completed', 'errored']
const STATE_INDICATORS: Record<AgentState, { color: string; label: string; shape?: 'circle' | 'diamond' | 'triangle'; pulse?: boolean }> = {
  running:   { color: 'text-blue-400',   label: 'Running',   pulse: true },
  waiting:   { color: 'text-yellow-400', label: 'Waiting' },
  stalled:   { color: 'text-yellow-400', label: 'Stalled',   shape: 'triangle' },
  suspended: { color: 'text-gray-400',   label: 'Suspended' },
  completed: { color: 'text-green-400',  label: 'Completed' },
  errored:   { color: 'text-red-400',    label: 'Errored',   shape: 'triangle' },
}

const MODEL_LABELS: Record<string, string> = {
  haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus',
  'gemini-2.5-flash': 'Flash', 'gemini-2.5-pro': 'Pro',
}
const PROVIDER_LABELS: Record<ProviderId, string> = { claude: 'Claude', gemini: 'Gemini', codex: 'Codex' }

function formatModelLabel(providerId: ProviderId | undefined, modelId: string): string {
  const provider = PROVIDER_LABELS[providerId ?? 'claude'] ?? providerId
  const model = MODEL_LABELS[modelId] ?? modelId
  return `${provider} ${model}`
}

const DEFAULT_HIDDEN: AgentState[] = []

export default function AgentPanel({ agents, projects, send, onViewTerminal, diffs, requestDiff }: Props) {
  const [resumeText, setResumeText] = useState<Record<string, string>>({})
  const [hiddenStates, setHiddenStates] = useState<AgentState[]>(DEFAULT_HIDDEN)
  const [searchText, setSearchText] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null)
  const [finishedExpanded, setFinishedExpanded] = useState(false)

  const stateCounts: Record<AgentState, number> = { running: 0, waiting: 0, stalled: 0, suspended: 0, completed: 0, errored: 0 }
  for (const agent of agents) {
    stateCounts[agent.state]++
  }

  const filtered = agents.filter(agent => {
    if (hiddenStates.includes(agent.state)) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      if (!agent.displayName.toLowerCase().includes(q) && !agent.taskName.toLowerCase().includes(q)) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) =>
    STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state)
  )

  // Split into active and finished groups
  const ACTIVE_STATES: AgentState[] = ['running', 'waiting', 'stalled']
  const activeAgents = sorted.filter(a => ACTIVE_STATES.includes(a.state))
  const finishedAgents = sorted.filter(a => !ACTIVE_STATES.includes(a.state))

  function toggleState(state: AgentState) {
    setHiddenStates(prev =>
      prev.includes(state)
        ? prev.filter(s => s !== state)
        : [...prev, state]
    )
  }

  const finishedCount = stateCounts.completed + stateCounts.errored + stateCounts.suspended

  const chip = (active: boolean) =>
    active
      ? 'border-blue-500/50 text-blue-300 bg-blue-950/40'
      : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'

  function renderAgentCard(agent: AgentSession) {
    const indicator = STATE_INDICATORS[agent.state]
    const expanded = expandedAgentId === agent.id
    const hasHistory = agent.conversationHistory && agent.conversationHistory.length > 0
    const showDiff = ['completed', 'suspended', 'errored'].includes(agent.state) && agent.gitBranch
    const isFinished = !ACTIVE_STATES.includes(agent.state)
    return (
      <div key={agent.id} className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors">
        {/* Collapsed header — task name as primary, provider badge */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
          onClick={() => setExpandedAgentId(prev => prev === agent.id ? null : agent.id)}
        >
          <StatusIndicator color={indicator.color} shape={indicator.shape} pulse={indicator.pulse} size="md" />
          <span className="font-medium truncate min-w-0 flex-1">{agent.taskName || agent.displayName}</span>
          <span className="text-[10px] bg-gray-800 text-gray-500 px-1 py-0.5 rounded flex-shrink-0">
            {formatModelLabel(agent.providerId, agent.model)}
          </span>
          {!expanded && agent.state === 'waiting' && (
            <span className="text-xs text-yellow-400">needs input</span>
          )}
        </div>

        {/* Expanded body — animated via grid-rows */}
        <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="px-5 pb-5">
              {/* Secondary: machine name */}
              {agent.taskName && agent.taskName !== agent.displayName && (
                <p className="text-[10px] text-gray-600 font-mono truncate">{agent.displayName}</p>
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                {(() => {
                  const proj = projects.find(p => p.id === agent.projectId)
                  return proj ? (
                    <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded flex items-center gap-1.5">
                      <ProjectAvatar name={proj.name} size="sm" />
                      {proj.name}
                    </span>
                  ) : agent.originalTaskContext?.projectName ? (
                    <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">{agent.originalTaskContext.projectName}</span>
                  ) : null
                })()}
                <span>{agent.runMode}</span>
                {agent.state === 'running' && (
                  <StatusIndicator color="text-blue-400" pulse />
                )}
                <ElapsedTime
                  startedAt={agent.startedAt}
                  timeSpent={agent.timeSpent}
                  timeLimit={agent.timeLimit}
                  isRunning={agent.state === 'running'}
                />
                {agent.state === 'running' && (
                  <button
                    onClick={() => send({ type: 'extend_time', agentId: agent.id, minutes: 15 })}
                    className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded transition-colors"
                  >
                    +15m
                  </button>
                )}
                {agent.resumeCount > 0 && <span>resume #{agent.resumeCount}</span>}
              </div>

              {agent.state === 'waiting' && (
                <div className="mt-3">
                  <ConversationThread
                    history={agent.conversationHistory}
                    onSend={(text) => send({ type: 'agent_input', agentId: agent.id, input: text })}
                    showInput={true}
                    compact={true}
                  />
                </div>
              )}

              {agent.state !== 'waiting' && hasHistory && (
                <div className="mt-3">
                  <ConversationThread
                    history={agent.conversationHistory}
                    onSend={() => {}}
                    showInput={false}
                    compact={true}
                  />
                </div>
              )}

              {agent.state === 'completed' && agent.verificationReport && (
                <div className="mt-3 bg-gray-950 border border-gray-700 rounded p-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <span>Verification</span>
                    <span className="text-green-400">{agent.verificationReport.checks.filter(c => c.status === 'pass').length} pass</span>
                    {agent.verificationReport.checks.some(c => c.status === 'fail') && (
                      <span className="text-red-400">{agent.verificationReport.checks.filter(c => c.status === 'fail').length} fail</span>
                    )}
                  </div>
                  {agent.verificationReport.summary && (
                    <p className="text-xs text-gray-500 truncate">{agent.verificationReport.summary}</p>
                  )}
                </div>
              )}

              {agent.pendingQuestion && !hasHistory && (
                <div className="mt-3 bg-yellow-900/20 border border-yellow-700/30 rounded p-2 text-sm text-yellow-300 max-h-32 overflow-auto whitespace-pre-wrap">
                  {agent.pendingQuestion}
                </div>
              )}

              <div className="flex gap-2 mt-3 flex-wrap">
                {['running', 'waiting', 'stalled'].includes(agent.state) && (
                  <button
                    onClick={() => onViewTerminal(agent.id)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors"
                  >
                    Terminal
                  </button>
                )}

                {['running', 'waiting', 'stalled'].includes(agent.state) && (
                  <button
                    onClick={() => send({ type: 'stop_agent', agentId: agent.id })}
                    className="text-xs bg-red-900/60 hover:bg-red-800/60 text-red-300 px-3 py-1.5 rounded transition-colors"
                  >
                    Stop
                  </button>
                )}

                {agent.state === 'stalled' && (
                  <>
                    <button
                      onClick={() => send({ type: 'nudge_agent', agentId: agent.id, message: 'Continue working on the task.' })}
                      className="text-xs bg-orange-900/60 hover:bg-orange-800/60 text-orange-300 px-3 py-1.5 rounded transition-colors"
                    >
                      Nudge
                    </button>
                    <button
                      onClick={() => send({ type: 'stop_agent', agentId: agent.id })}
                      className="text-xs bg-red-900/60 hover:bg-red-800/60 text-red-300 px-3 py-1.5 rounded transition-colors"
                    >
                      Kill
                    </button>
                  </>
                )}

                {/* Resume input — only visible when expanded */}
                {isFinished && (
                  <div className="flex flex-col sm:flex-row gap-1 flex-1">
                    <input
                      type="text"
                      placeholder="Additional context (optional)..."
                      value={resumeText[agent.id] ?? ''}
                      onChange={e => setResumeText(prev => ({ ...prev, [agent.id]: e.target.value }))}
                      className="flex-1 text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-gray-100 min-w-0"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          send({ type: 'resume_agent', agentId: agent.id, additionalContext: resumeText[agent.id] || undefined })
                          setResumeText(prev => ({ ...prev, [agent.id]: '' }))
                        }}
                        className="text-xs rounded-full border border-blue-500/40 text-blue-300 hover:bg-blue-900/20 hover:border-blue-500/70 px-3 py-1.5 transition-colors"
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => {
                          send({ type: 'resume_agent', agentId: agent.id, fork: true, additionalContext: resumeText[agent.id] || undefined })
                          setResumeText(prev => ({ ...prev, [agent.id]: '' }))
                        }}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded transition-colors"
                      >
                        Fork
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {showDiff && (
                <DiffViewer
                  diff={diffs[agent.id] ?? null}
                  onRequest={() => requestDiff(agent.id)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Filter chips — hide zero-count unless user toggled them off */}
      <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
        {STATE_ORDER.map(state => {
          const ind = STATE_INDICATORS[state]
          const isVisible = !hiddenStates.includes(state)
          const count = stateCounts[state]
          // Hide chips with zero count unless user has explicitly hidden them
          if (count === 0 && isVisible) return null
          return (
            <button
              key={state}
              onClick={() => toggleState(state)}
              className={`text-xs border rounded px-2.5 py-1 transition-colors flex items-center gap-1.5 ${chip(isVisible)}`}
            >
              <StatusIndicator color={isVisible ? ind.color : 'text-gray-600'} shape={ind.shape} />
              {ind.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Search — hidden when no agents */}
      {agents.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search agents..."
            className="w-full text-xs bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-gray-300 placeholder-gray-600 focus:border-blue-500/50 focus:outline-none transition-colors"
          />
        </div>
      )}

      {sorted.length === 0 && agents.length === 0 && (
        <p className="text-gray-500 text-center py-12">No active agents. Launch one from the Tasks view.</p>
      )}

      {sorted.length === 0 && agents.length > 0 && (
        <p className="text-gray-500 text-center py-12">All agents are filtered out. Toggle state chips above to show them.</p>
      )}

      {/* Active agents */}
      {activeAgents.length > 0 && (
        <div className="grid gap-3 mb-6">
          {activeAgents.map(renderAgentCard)}
        </div>
      )}

      {/* Finished agents — collapsed by default */}
      {finishedAgents.length > 0 && (
        <div>
          <button
            onClick={() => setFinishedExpanded(prev => !prev)}
            className="text-sm font-sans font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center justify-center gap-2 w-full hover:text-gray-300 transition-colors"
          >
            <span className="text-xs">{finishedExpanded ? '▼' : '▶'}</span>
            Finished
            <span className="text-gray-500">({finishedAgents.length})</span>
            {finishedCount > 0 && !confirmClear && (
              <span
                onClick={(e) => { e.stopPropagation(); setConfirmClear(true) }}
                className="text-xs border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 rounded px-2 py-0.5 transition-colors font-normal normal-case tracking-normal"
              >
                Clear
              </span>
            )}
            {confirmClear && (
              <span className="flex items-center gap-1 font-normal normal-case tracking-normal" onClick={e => e.stopPropagation()}>
                <span className="text-xs text-gray-500">Clear {finishedCount}?</span>
                <button
                  onClick={() => { send({ type: 'clear_completed_agents' }); setConfirmClear(false) }}
                  className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 font-medium"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-xs text-gray-500 hover:text-gray-300 px-1.5 py-0.5"
                >
                  No
                </button>
              </span>
            )}
          </button>
          {finishedExpanded && (
            <div className="grid gap-3">
              {finishedAgents.map(renderAgentCard)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
