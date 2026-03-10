import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Override sessions dir via env before importing
const testDir = mkdtempSync(join(tmpdir(), 'ac-sessions-test-'))
process.env.AC_SESSIONS_DIR = testDir

// Dynamic import to pick up env override
const { pruneOldSessions } = await import('../sessions.js')

function writeSession(id: string, state: string, lastOutputAt: number) {
  writeFileSync(join(testDir, `${id}.json`), JSON.stringify({
    id,
    state,
    startedAt: lastOutputAt - 60_000,
    lastOutputAt,
    providerId: 'claude',
    providerSessionId: null,
    conversationHistory: [],
    originalTaskContext: null,
    verificationReport: null,
  }))
}

const OLD = Date.now() - 45 * 24 * 60 * 60 * 1000 // 45 days ago
const RECENT = Date.now() - 5 * 24 * 60 * 60 * 1000 // 5 days ago

describe('pruneOldSessions', () => {
  beforeEach(() => {
    // Clean test dir
    for (const f of readdirSync(testDir)) rmSync(join(testDir, f))
  })

  afterEach(() => {
    for (const f of readdirSync(testDir)) rmSync(join(testDir, f))
  })

  it('prunes completed sessions older than maxAgeDays', () => {
    writeSession('old-complete', 'completed', OLD)
    expect(pruneOldSessions(30)).toBe(1)
    expect(readdirSync(testDir)).toHaveLength(0)
  })

  it('prunes errored sessions older than maxAgeDays', () => {
    writeSession('old-error', 'errored', OLD)
    expect(pruneOldSessions(30)).toBe(1)
    expect(readdirSync(testDir)).toHaveLength(0)
  })

  it('preserves completed sessions newer than maxAgeDays', () => {
    writeSession('recent-complete', 'completed', RECENT)
    expect(pruneOldSessions(30)).toBe(0)
    expect(readdirSync(testDir)).toHaveLength(1)
  })

  it('preserves suspended sessions regardless of age', () => {
    writeSession('old-suspended', 'suspended', OLD)
    expect(pruneOldSessions(30)).toBe(0)
    expect(readdirSync(testDir)).toHaveLength(1)
  })

  it('preserves running sessions regardless of age', () => {
    writeSession('old-running', 'running', OLD)
    expect(pruneOldSessions(30)).toBe(0)
    expect(readdirSync(testDir)).toHaveLength(1)
  })

  it('returns count of pruned sessions', () => {
    writeSession('old1', 'completed', OLD)
    writeSession('old2', 'errored', OLD)
    writeSession('keep1', 'completed', RECENT)
    writeSession('keep2', 'suspended', OLD)
    expect(pruneOldSessions(30)).toBe(2)
    expect(readdirSync(testDir)).toHaveLength(2)
  })

  it('handles empty sessions directory', () => {
    expect(pruneOldSessions(30)).toBe(0)
  })

  it('skips malformed JSON files', () => {
    writeFileSync(join(testDir, 'bad.json'), 'not json{{{')
    writeSession('old-complete', 'completed', OLD)
    expect(pruneOldSessions(30)).toBe(1)
    // bad.json still exists (not deleted)
    expect(readdirSync(testDir)).toHaveLength(1)
  })
})
