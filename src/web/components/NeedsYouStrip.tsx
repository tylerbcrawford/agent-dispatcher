// src/web/components/NeedsYouStrip.tsx
import type { QueueItem, AgentSession, ProjectConfig, ClientMessage } from '@shared/types'
import QueueItemCard from './QueueItemCard'
import StatusIndicator from './StatusIndicator'

interface Props {
  items: QueueItem[]
  agents: AgentSession[]
  projects: ProjectConfig[]
  send: (m: ClientMessage) => void
}

export default function NeedsYouStrip({ items, agents, projects, send }: Props) {
  const active = items.filter(i => !i.dismissed).sort((a, b) => a.priority - b.priority)

  if (active.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 px-1 py-2 text-blue-400 border-b border-blue-500/40 mb-3">
        <StatusIndicator color="text-blue-400" size="sm" />
        <span className="text-sm font-semibold">Needs You ({active.length})</span>
      </div>
      <div className="grid gap-3">
        {active.map(item => (
          <QueueItemCard
            key={item.id}
            item={item}
            agent={item.agentId ? agents.find(a => a.id === item.agentId) ?? null : null}
            projects={projects}
            send={send}
            compact
          />
        ))}
      </div>
    </div>
  )
}
