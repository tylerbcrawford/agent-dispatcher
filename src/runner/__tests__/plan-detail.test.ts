import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { findRecentPlanFile, buildPlanDetail } from '../plan-detail.js'
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('findRecentPlanFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'plan-detail-test-'))
  })

  it('returns content of most recently modified plan file', () => {
    const planPath = join(tmpDir, 'my-plan.md')
    writeFileSync(planPath, '# My Plan\n\nDo the thing.')
    const result = findRecentPlanFile(tmpDir)
    expect(result).toBe('# My Plan\n\nDo the thing.')
  })

  it('returns null for empty directory', () => {
    expect(findRecentPlanFile(tmpDir)).toBeNull()
  })

  it('returns null for nonexistent directory', () => {
    expect(findRecentPlanFile('/tmp/does-not-exist-plan-test')).toBeNull()
  })

  it('ignores old files (>15 minutes)', () => {
    const planPath = join(tmpDir, 'old-plan.md')
    writeFileSync(planPath, '# Old Plan')
    // Set mtime to 20 minutes ago (exceeds 15min threshold)
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000)
    utimesSync(planPath, twentyMinAgo, twentyMinAgo)
    expect(findRecentPlanFile(tmpDir)).toBeNull()
  })

  it('ignores non-plan .md files', () => {
    writeFileSync(join(tmpDir, 'readme.md'), '# README')
    expect(findRecentPlanFile(tmpDir)).toBeNull()
  })

  it('truncates plan content over 64K chars', () => {
    const longContent = 'x'.repeat(70000)
    writeFileSync(join(tmpDir, 'big-plan.md'), longContent)
    const result = findRecentPlanFile(tmpDir)
    expect(result).toContain('[...truncated]')
    expect(result!.length).toBeLessThan(70000)
  })
})

describe('buildPlanDetail', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'plan-detail-build-'))
  })

  it('returns plan file content when available', () => {
    writeFileSync(join(tmpDir, 'implementation-plan.md'), '# Implementation Plan\n\nStep 1...')
    const session = { lastOutput: 'some terminal output' }
    const result = buildPlanDetail(session, tmpDir)
    expect(result).toBe('# Implementation Plan\n\nStep 1...')
  })

  it('returns terminal text when no plan file found', () => {
    const session = { lastOutput: 'Agent finished working on the task' }
    const result = buildPlanDetail(session, tmpDir)
    expect(result).toBe('Agent finished working on the task')
  })

  it('truncates long terminal output to 16K chars', () => {
    const session = { lastOutput: 'y'.repeat(20000) }
    const result = buildPlanDetail(session, tmpDir)
    expect(result.length).toBe(16000)
  })
})
