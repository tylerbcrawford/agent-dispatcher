import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { resolvePlanLink, planExists } from '../plan-resolver.js'

const TMP = join(import.meta.dirname, '../../.test-vault')
const PROJECT = join(TMP, 'projects/example')

beforeEach(() => {
  mkdirSync(join(PROJECT, 'system-backup'), { recursive: true })
  mkdirSync(join(PROJECT, 'agent-dispatcher'), { recursive: true })
  mkdirSync(join(TMP, 'archive/example'), { recursive: true })

  writeFileSync(join(PROJECT, 'system-backup/implementation-plan.md'), '# System Backup Plan')
  writeFileSync(join(PROJECT, 'agent-dispatcher/v3-plan.md'), '# V3 Plan')
  writeFileSync(join(PROJECT, 'discord-bot-fix-plan.md'), '# Discord Fix')
  writeFileSync(join(TMP, 'archive/example/old-plan.md'), '# Archived Plan')
})

afterEach(() => { rmSync(TMP, { recursive: true, force: true }) })

describe('planExists', () => {
  it('returns false when planLink is null', () => {
    expect(planExists(null, TMP, PROJECT)).toBe(false)
  })
  it('returns true when file exists at <vault>/<link>.md', () => {
    writeFileSync(join(TMP, 'some-plan.md'), '# Direct vault plan')
    expect(planExists('some-plan', TMP, PROJECT)).toBe(true)
  })
  it('returns true when file exists at <projectFolder>/<link>.md', () => {
    writeFileSync(join(PROJECT, 'project-scoped-plan.md'), '# Project Scoped Plan')
    expect(planExists('project-scoped-plan', TMP, PROJECT)).toBe(true)
  })
  it('returns true when file exists at <projectFolder>/plans/<link>.md', () => {
    mkdirSync(join(PROJECT, 'plans'), { recursive: true })
    writeFileSync(join(PROJECT, 'plans', 'feature-plan.md'), '# Feature Plan')
    expect(planExists('feature-plan', TMP, PROJECT)).toBe(true)
  })
  it('returns true when file exists at <vault>/plans/<link>.md', () => {
    mkdirSync(join(TMP, 'plans'), { recursive: true })
    writeFileSync(join(TMP, 'plans', 'vault-level-plan.md'), '# Vault Level Plan')
    expect(planExists('vault-level-plan', TMP, PROJECT)).toBe(true)
  })
  it('returns false when no file exists for a non-null link', () => {
    expect(planExists('nonexistent-plan', TMP, PROJECT)).toBe(false)
  })
})

describe('resolvePlanLink', () => {
  it('resolves direct path from vault root', () => {
    expect(resolvePlanLink('archive/example/old-plan', TMP, PROJECT)).toContain('Archived Plan')
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
    expect(resolvePlanLink('archive/example/old-plan', TMP, '')).toContain('Archived Plan')
  })

  it('refuses to escape the vault via ../ in the link (path traversal)', () => {
    // A secret sits OUTSIDE the vault, next to it.
    const secret = join(TMP, '../outside-secret.md')
    writeFileSync(secret, '# TOP SECRET')
    try {
      // Direct-path escape is blocked by the containment check...
      expect(resolvePlanLink('../outside-secret', TMP, PROJECT)).toBeNull()
      // ...and the basename recursive search only walks inside the vault, so it
      // never finds a same-named file that lives outside.
      expect(resolvePlanLink('../../../../../../etc/hostname', TMP, PROJECT)).toBeNull()
    } finally {
      rmSync(secret, { force: true })
    }
  })
})
