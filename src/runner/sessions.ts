// src/runner/sessions.ts
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { AgentSession } from '../shared/types.js'
import { config } from './config.js'

const dir = config.sessionsDir

/** Backfill new fields for sessions saved before current schema */
function migrateSession(raw: any): AgentSession {
  return {
    ...raw,
    // Multi-turn support (added before providers)
    conversationHistory: raw.conversationHistory ?? [],
    originalTaskContext: raw.originalTaskContext ?? null,
    verificationReport: raw.verificationReport ?? null,
    // Provider support: backfill claude, rename claudeSessionId
    providerId: raw.providerId ?? 'claude',
    providerSessionId: raw.providerSessionId ?? raw.claudeSessionId ?? null,
  }
}

export function ensureSessionsDir() {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function saveSession(session: AgentSession): void {
  ensureSessionsDir()
  const path = join(dir, `${session.id}.json`)
  writeFileSync(path, JSON.stringify(session, null, 2))
}

export function loadSession(id: string): AgentSession | null {
  const path = join(dir, `${id}.json`)
  if (!existsSync(path)) return null
  return migrateSession(JSON.parse(readFileSync(path, 'utf-8')))
}

export function loadAllSessions(): AgentSession[] {
  ensureSessionsDir()
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => migrateSession(JSON.parse(readFileSync(join(dir, f), 'utf-8'))))
}

export function deleteSession(id: string): void {
  const path = join(dir, `${id}.json`)
  if (existsSync(path)) {
    unlinkSync(path)
  }
}

/** Prune completed/errored sessions older than maxAgeDays. Returns count of pruned files. */
export function pruneOldSessions(maxAgeDays: number = 30): number {
  ensureSessionsDir()
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  let pruned = 0
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    try {
      const raw = JSON.parse(readFileSync(join(dir, file), 'utf-8'))
      const session = migrateSession(raw)
      if (['completed', 'errored'].includes(session.state) &&
          (session.lastOutputAt || session.startedAt) < cutoff) {
        unlinkSync(join(dir, file))
        pruned++
      }
    } catch { /* skip malformed files */ }
  }
  return pruned
}
