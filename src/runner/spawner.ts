// src/runner/spawner.ts
import * as pty from 'node-pty'
import { randomUUID } from 'crypto'
import type { AgentSession, Task, RunMode, ExecutionMode, ProviderId } from '../shared/types.js'
import { taskToSlug } from './prompt-library.js'
import { config } from './config.js'
import { buildSpawnCommand } from './providers.js'

// Legacy export kept for test compatibility — delegates to providers.ts
export interface SpawnArgs {
  prompt: string
  model: string
  providerId?: ProviderId
  allowedTools?: string
  permissionProfile?: string
  resumeId?: string
  forkSession?: boolean
}

export function buildSpawnArgs(args: SpawnArgs): string[] {
  const cmd = buildSpawnCommand({
    prompt: args.prompt,
    model: args.model,
    providerId: args.providerId ?? 'claude',
    allowedTools: args.allowedTools,
    permissionProfile: args.permissionProfile,
    resumeId: args.resumeId,
    forkSession: args.forkSession,
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
  cwd?: string
  gitBranch: boolean
  resumeId?: string
  forkSession?: boolean
  resumeCount?: number
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
    permissionProfile: opts.profile,
    resumeId: opts.resumeId,
    forkSession: opts.forkSession,
  })

  const cwd = opts.cwd ?? config.vaultPath
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
    conversationHistory: [],
    originalTaskContext: null,
    verificationReport: null,
  }

  return { session, pty: ptyProcess }
}
