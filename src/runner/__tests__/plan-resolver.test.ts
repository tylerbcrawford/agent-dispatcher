import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { resolvePlanLink } from '../plan-resolver.js'

const TMP = join(import.meta.dirname, '../../.test-vault')
const PROJECT = join(TMP, '01_Projects/media-server')

beforeEach(() => {
  mkdirSync(join(PROJECT, 'system-backup'), { recursive: true })
  mkdirSync(join(PROJECT, 'agent-dispatcher'), { recursive: true })
  mkdirSync(join(TMP, '04_Archive/media-server'), { recursive: true })

  writeFileSync(join(PROJECT, 'system-backup/implementation-plan.md'), '# System Backup Plan')
  writeFileSync(join(PROJECT, 'agent-dispatcher/v3-plan.md'), '# V3 Plan')
  writeFileSync(join(PROJECT, 'discord-bot-fix-plan.md'), '# Discord Fix')
  writeFileSync(join(TMP, '04_Archive/media-server/old-plan.md'), '# Archived Plan')
})

afterEach(() => { rmSync(TMP, { recursive: true, force: true }) })

describe('resolvePlanLink', () => {
  it('resolves direct path from vault root', () => {
    expect(resolvePlanLink('04_Archive/media-server/old-plan', TMP, PROJECT)).toContain('Archived Plan')
  })
  it('resolves project-scoped path', () => {
    expect(resolvePlanLink('system-backup/implementation-plan', TMP, PROJECT)).toContain('System Backup Plan')
  })
  it('resolves flat file in project folder', () => {
    expect(resolvePlanLink('discord-bot-fix-plan', TMP, PROJECT)).toContain('Discord Fix')
  })
  it('falls back to recursive search', () => {
    expect(resolvePlanLink('v3-plan', TMP, PROJECT)).toContain('V3 Plan')
  })
  it('returns null for non-existent files', () => {
    expect(resolvePlanLink('nonexistent', TMP, PROJECT)).toBeNull()
  })
  it('handles empty project folder', () => {
    expect(resolvePlanLink('04_Archive/media-server/old-plan', TMP, '')).toContain('Archived Plan')
  })
})
