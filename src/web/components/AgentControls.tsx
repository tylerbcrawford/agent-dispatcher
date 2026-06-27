// src/web/components/AgentControls.tsx
import { useState } from 'react'
import type { AgentSession, ClientMessage, DiffData, ProjectConfig, ProviderId } from '@shared/types'
import ConversationThread from './ConversationThread'
import DiffViewer from './DiffViewer'
import ElapsedTime from './ElapsedTime'
import StatusIndicator from './StatusIndicator'
import ProjectAvatar from './ProjectAvatar'

interface Props {
  agent: AgentSession
  projects: ProjectConfig[]
  send: (msg: ClientMessage) => void
  onViewTerminal: (agentId: string) => void
  diffs: Record<string, DiffData>
  requestDiff: (agentId: string) => void
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

const ACTIVE_STATES = ['running', 'waiting', 'stalled']

export default function AgentControls({ agent, projects, send, onViewTerminal, diffs, requestDiff }: Props) {
  const [resumeText, setResumeText] = useState('')

  const hasHistory = agent.conversationHistory.length > 0
  const showDiff = ['completed', 'suspended', 'errored'].includes(agent.state) && agent.gitBranch
  const isFinished = !ACTIVE_STATES.includes(agent.state)

  return (
    <div className="mt-3 border-t border-gray-700 pt-3">
      {/* Secondary: machine/display name when different from task name */}
      {agent.taskName && agent.taskName !== agent.displayName && (
        <p className="text-[10px] text-gray-600 font-mono truncate">{agent.displayName}</p>
      )}

      {/* Meta row */}
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
        <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
          {formatModelLabel(agent.providerId, agent.model)}
        </span>
        <span>{agent.runMode}</span>
        {agent.state === 'running' && (
          <StatusIndicator color="text-blue-400" pulse />
        )}
        {agent.state === 'stalled' && (
          <StatusIndicator color="text-gray-400" />
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

      {/* Waiting: conversation with input */}
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

      {/* Non-waiting with history: read-only conversation */}
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

      {/* Completed with verification report */}
      {agent.state === 'completed' && agent.verificationReport && (
        <div className="mt-3 bg-gray-950 border border-gray-700 rounded p-2">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <span>Verification</span>
            <span className="text-gray-300">{agent.verificationReport.checks.filter(c => c.status === 'pass').length} pass</span>
            {agent.verificationReport.checks.some(c => c.status === 'fail') && (
              <span className="text-red-400">{agent.verificationReport.checks.filter(c => c.status === 'fail').length} fail</span>
            )}
          </div>
          {agent.verificationReport.summary && (
            <p className="text-xs text-gray-500 truncate">{agent.verificationReport.summary}</p>
          )}
        </div>
      )}

      {/* Pending question (no conversation history yet) */}
      {agent.pendingQuestion && !hasHistory && (
        <div className="mt-3 bg-gray-950 border border-gray-700 rounded p-2 text-sm text-gray-300 max-h-32 overflow-auto whitespace-pre-wrap">
          {agent.pendingQuestion}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {/* Terminal — active states only */}
        {ACTIVE_STATES.includes(agent.state) && (
          <button
            onClick={() => onViewTerminal(agent.id)}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors"
          >
            Terminal
          </button>
        )}

        {/* Stop — active states only */}
        {ACTIVE_STATES.includes(agent.state) && (
          <button
            onClick={() => send({ type: 'stop_agent', agentId: agent.id })}
            className="text-xs bg-red-900/60 hover:bg-red-800/60 text-red-300 px-3 py-1.5 rounded transition-colors"
          >
            Stop
          </button>
        )}

        {/* Nudge + Kill — stalled only */}
        {agent.state === 'stalled' && (
          <>
            <button
              onClick={() => send({ type: 'nudge_agent', agentId: agent.id, message: 'Continue working on the task.' })}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors"
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

        {/* Resume + Fork — finished states (completed/errored/suspended) */}
        {isFinished && (
          <div className="flex flex-col sm:flex-row gap-1 flex-1">
            <input
              type="text"
              placeholder="Additional context (optional)..."
              value={resumeText}
              onChange={e => setResumeText(e.target.value)}
              className="flex-1 text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-gray-100 min-w-0"
            />
            <div className="flex gap-1">
              <button
                onClick={() => {
                  send({ type: 'resume_agent', agentId: agent.id, additionalContext: resumeText || undefined })
                  setResumeText('')
                }}
                className="text-xs rounded-full border border-blue-500/40 text-blue-300 hover:bg-blue-900/20 hover:border-blue-500/70 px-3 py-1.5 transition-colors"
              >
                Resume
              </button>
              <button
                onClick={() => {
                  send({ type: 'resume_agent', agentId: agent.id, fork: true, additionalContext: resumeText || undefined })
                  setResumeText('')
                }}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors"
              >
                Fork
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Diff viewer — completed/suspended/errored with a git branch */}
      {showDiff && (
        <DiffViewer
          diff={diffs[agent.id] ?? null}
          onRequest={() => requestDiff(agent.id)}
        />
      )}
    </div>
  )
}
