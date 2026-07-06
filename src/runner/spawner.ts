// src/runner/spawner.ts
import * as pty from 'node-pty'
import { randomUUID } from 'crypto'
import { statSync, accessSync, constants } from 'fs'
import { join, delimiter } from 'path'
import type { AgentSession, Task, RunMode, ExecutionMode, ProviderId } from '../shared/types.js'
import { taskToSlug } from './prompt-library.js'
import { config } from './config.js'
import { buildSpawnCommand } from './providers.js'
import { captureBaseCommit } from './git.js'

function isExecutableFile(p: string): boolean {
  try {
    if (!statSync(p).isFile()) return false
    accessSync(p, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve an executable to its absolute path by scanning PATH, like `which`.
 * Returns null if not found or not executable. A binary containing a path
 * separator is checked directly instead of searched on PATH.
 */
export function resolveBinaryPath(binary: string, pathEnv: string = process.env.PATH ?? ''): string | null {
  if (!binary) return null
  if (binary.includes('/')) {
    return isExecutableFile(binary) ? binary : null
  }
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, binary)
    if (isExecutableFile(candidate)) return candidate
  }
  return null
}

// Legacy export kept for test compatibility — delegates to providers.ts
export interface SpawnArgs {
  prompt: string
  model: string
  providerId?: ProviderId
  allowedTools?: string
  disallowedTools?: string
  permissionProfile?: string
  resumeId?: string
  forkSession?: boolean
  maxBudgetUsd?: number
}

export function buildSpawnArgs(args: SpawnArgs): string[] {
  const cmd = buildSpawnCommand({
    prompt: args.prompt,
    model: args.model,
    providerId: args.providerId ?? 'claude',
    allowedTools: args.allowedTools,
    disallowedTools: args.disallowedTools,
    permissionProfile: args.permissionProfile,
    resumeId: args.resumeId,
    forkSession: args.forkSession,
    maxBudgetUsd: args.maxBudgetUsd,
  })
  return cmd.args
}

export function buildDisplayName(task: Task, runMode: RunMode | string, resumeCount: number): string {
  const slug = taskToSlug(task.name)
  const num = String(resumeCount + 1).padStart(2, '0')
  return `${task.id}-${slug}-${runMode}-${num}`
}

export interface SpawnOptions {
  task: Task
  prompt: string
  runMode: RunMode
  executionMode: ExecutionMode
  model: string
  providerId: ProviderId
  profile: string
  timeLimit: number
  allowedTools?: string
  disallowedTools?: string
  cwd?: string
  gitBranch: boolean
  gitBaseCommit?: string | null   // reused across resume/Ralph so the diff spans the whole run
  resumeId?: string
  forkSession?: boolean
  resumeCount?: number
  maxBudgetUsd?: number
}

export interface SpawnedAgent {
  session: AgentSession
  pty: pty.IPty
}

export function spawnAgent(opts: SpawnOptions): SpawnedAgent {
  const id = randomUUID()
  const resumeCount = opts.resumeCount ?? 0
  const displayName = buildDisplayName(opts.task, opts.runMode, resumeCount)
  const gitBranch = opts.gitBranch ? `agent/${opts.task.id}-${taskToSlug(opts.task.name)}` : null

  const cmd = buildSpawnCommand({
    prompt: opts.prompt,
    model: opts.model,
    providerId: opts.providerId,
    allowedTools: opts.allowedTools,
    disallowedTools: opts.disallowedTools,
    permissionProfile: opts.profile,
    resumeId: opts.resumeId,
    forkSession: opts.forkSession,
    maxBudgetUsd: opts.maxBudgetUsd,
  })

  // Preflight: fail fast with a clear, actionable error if the provider CLI
  // is missing — otherwise node-pty produces an opaque "errored" session.
  if (!resolveBinaryPath(cmd.binary)) {
    throw new Error(
      `Cannot spawn agent: '${cmd.binary}' not found on PATH. Is the ${opts.providerId} CLI installed and on the runner's PATH?`,
    )
  }

  const cwd = opts.cwd ?? config.vaultPath

  // Anchor the run's diff to the commit that is HEAD right now (only when the run
  // opts into git tracking and cwd is a repo). Resume/Ralph pass the original base
  // through so the diff spans the whole run rather than resetting each iteration.
  const gitBaseCommit = gitBranch
    ? (opts.gitBaseCommit ?? captureBaseCommit(cwd))
    : null

  const ptyProcess = pty.spawn(cmd.binary, cmd.args, {
    name: 'xterm-256color',
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' },
  })

  const session: AgentSession = {
    id,
    providerId: opts.providerId,
    providerSessionId: null,
    displayName,
    taskId: opts.task.id,
    taskName: opts.task.name,
    projectId: opts.task.projectId,
    state: 'running',
    executionMode: opts.executionMode,
    runMode: opts.runMode,
    model: opts.model,
    permissionProfile: opts.profile,
    timeLimit: opts.timeLimit,
    startedAt: Date.now(),
    suspendedAt: null,
    lastOutputAt: Date.now(),
    timeSpent: 0,
    resumeCount,
    lastOutput: '',
    pendingQuestion: null,
    gitBranch,
    gitBaseCommit,
    conversationHistory: [],
    originalTaskContext: null,
    verificationReport: null,
  }

  return { session, pty: ptyProcess }
}
