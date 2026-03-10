// src/runner/stall-detector.ts
import type { AgentSession } from '../shared/types.js'
import { config } from './config.js'

export interface StallEvent {
  agentId: string
  type: 'possibly_stalled' | 'stalled'
  silenceMinutes: number
}

const POSSIBLY_STALLED_MIN = 2

export function checkStall(session: AgentSession): StallEvent | null {
  if (session.state !== 'running') return null

  const silenceMs = Date.now() - session.lastOutputAt
  const silenceMin = silenceMs / 60_000

  if (silenceMin >= config.stallThresholdMin) {
    return { agentId: session.id, type: 'stalled', silenceMinutes: Math.round(silenceMin) }
  }
  if (silenceMin >= POSSIBLY_STALLED_MIN) {
    return { agentId: session.id, type: 'possibly_stalled', silenceMinutes: Math.round(silenceMin) }
  }

  return null
}
