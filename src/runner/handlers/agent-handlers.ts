// src/runner/handlers/agent-handlers.ts
import type { AgentSession, ClientMessage, QueueItem } from '../../shared/types.js'
import { spawnAgent, type SpawnedAgent } from '../spawner.js'
import { detectSignal, detectQuestion, parseStreamJsonSessionId, extractStreamJsonText, parseVerificationReport, updateDenialCount } from '../detector.js'
import { resolvePlanLink } from '../plan-resolver.js'
import { buildPlanDetail } from '../plan-detail.js'
import { composePrompt, getPromptsForMode, taskToSlug, type PromptVars } from '../prompt-library.js'
import { config } from '../config.js'
import { notifyNeedsInput, notifyError, notifyStalled, notifyTimeout, notifyCompleted, notifyPlanReady } from '../notifier.js'
import { shouldContinueLoop, buildContinuationPrompt } from '../ralph.js'
import { setTaskStatus } from './task-handlers.js'
import type { HandlerContext } from '../handler-context.js'

// Token-burn watchdog: abort after this many consecutive profile-denials.
const DENIAL_ABORT_THRESHOLD = 3

/** Strip ANSI escape codes from terminal output */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '')
}

export function addQueueItem(ctx: HandlerContext, type: QueueItem['type'], session: AgentSession, summary: string) {
  const cleanDetail = stripAnsi(extractStreamJsonText(session.lastOutput) || session.lastOutput)
  const item: QueueItem = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    taskId: session.taskId,
    taskName: session.taskName,
    projectId: session.projectId,
    agentId: session.id,
    summary: stripAnsi(summary),
    detail: cleanDetail,
    createdAt: Date.now(),
    priority: type === 'stalled-agent' ? 0 : 1,
  }
  ctx.queue.push(item)
  ctx.broadcast({ type: 'queue', items: ctx.queue })
}

export function handleSpawn(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'spawn_agent' }>) {
  const task = ctx.tasks.find(t => t.id === msg.taskId && t.projectId === msg.projectId)
  if (!task) {
    console.error(`Task ${msg.taskId} not found in project ${msg.projectId}`)
    return
  }

  const prompts = getPromptsForMode(ctx.promptLibrary, msg.runMode)
  const template = msg.promptId
    ? prompts.find(p => p.id === msg.promptId) ?? prompts[0]
    : prompts[0]

  if (!template) {
    console.error(`No prompt template found for mode ${msg.runMode}`)
    return
  }

  const selectedSnippets = (msg.snippetIds ?? [])
    .map(id => ctx.promptLibrary.snippets.find(s => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s != null)

  const project = ctx.registry.projects.find(p => p.id === msg.projectId)
  const projectFolder = project?.todoFile.replace(/\/[^/]+$/, '') ?? ''

  const planContent = task.planLink
    ? resolvePlanLink(task.planLink, config.vaultPath, projectFolder)
    : null

  const frontmatter = ctx.projectFrontmatters.get(msg.projectId)
  const vars: PromptVars = {
    id: task.id,
    name: task.name,
    description: task.description,
    planContent,
    projectName: project?.name ?? task.projectId,
    projectDescription: frontmatter?.description ?? '',
    projectFolder,
    taskSlug: taskToSlug(task.name),
  }

  const modelHint = msg.useModelHints !== false
    ? ctx.promptLibrary.modelHints.get(msg.providerId ?? 'claude') ?? null
    : null
  let prompt = composePrompt(template, selectedSnippets, vars, ctx.promptLibrary, modelHint)
  if (msg.customPrompt?.trim()) {
    prompt += '\n\n## Additional Instructions\n\n' + msg.customPrompt.trim()
  }

  let spawned: SpawnedAgent
  try {
    spawned = spawnAgent({
      task,
      prompt,
      runMode: msg.runMode,
      executionMode: msg.executionMode,
      model: msg.model,
      providerId: msg.providerId ?? 'claude',
      profile: msg.profile,
      timeLimit: msg.timeLimit,
      gitBranch: msg.gitBranch,
      allowedTools: ctx.resolveAllowedTools(msg.profile),
      disallowedTools: ctx.resolveDisallowedTools(msg.profile),
      cwd: frontmatter?.['default-cwd'],
      maxBudgetUsd: config.maxBudgetUsd,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : `Failed to spawn agent: ${String(err)}`
    console.error(message)
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message })
    return
  }

  spawned.session.originalTaskContext = {
    taskName: task.name,
    taskDescription: task.description,
    runMode: msg.runMode,
    planContent,
    projectName: project?.name ?? task.projectId,
    providerId: msg.providerId,
    useModelHints: msg.useModelHints,
  }

  ctx.agents.set(spawned.session.id, spawned)
  if (msg.executionMode === 'ralph') {
    ctx.ralphContexts.set(spawned.session.id, { iterationCount: 0, maxIterations: 10 })
  }
  ctx.saveSession(spawned.session)
  wireAgentOutput(ctx, spawned)

  console.log(`Spawned agent ${spawned.session.displayName} for task ${task.id}: ${task.name}`)
  ctx.broadcast({ type: 'agents', agents: Array.from(ctx.agents.values()).map(a => a.session) })
}

export function wireAgentOutput(ctx: HandlerContext, spawned: SpawnedAgent) {
  // Per-agent consecutive profile-denial counter (token-burn watchdog).
  // Local to this closure so each (re)spawn starts fresh and nothing persists to the session.
  let consecutiveDenials = 0

  spawned.pty.onData((data: string) => {
    spawned.session.lastOutputAt = Date.now()
    spawned.session.lastOutput = (spawned.session.lastOutput + data).slice(-15_000)

    // Watchdog: a contradictory profile/mode (e.g. read-only + plan) makes the
    // agent flail on denied tools toward the time limit. Abort fast instead.
    consecutiveDenials = updateDenialCount(consecutiveDenials, data)
    if (consecutiveDenials >= DENIAL_ABORT_THRESHOLD && spawned.session.state === 'running') {
      const message = `Agent aborted: blocked by the '${spawned.session.permissionProfile}' profile after ${consecutiveDenials} consecutive tool denials. Pick a profile/mode that grants the tools the task needs.`
      console.error(`[watchdog] ${spawned.session.displayName}: ${message}`)
      spawned.session.state = 'errored'
      ctx.lastSignals.set(spawned.session.id, 'partial') // mark handled so onExit doesn't re-notify completed
      ctx.saveSession(spawned.session)
      ctx.broadcast({ type: 'terminal_output', agentId: spawned.session.id, data })
      ctx.broadcast({ type: 'agent_state', agentId: spawned.session.id, state: 'errored' })
      ctx.broadcast({ type: 'task_write_error', projectId: spawned.session.projectId, message })
      ctx.broadcast({ type: 'agents', agents: Array.from(ctx.agents.values()).map(a => a.session) })
      spawned.pty.kill()
      return
    }

    const sessionId = parseStreamJsonSessionId(data)
    if (sessionId) spawned.session.providerSessionId = sessionId

    const signal = detectSignal(data)
    if (signal && spawned.session.state === 'running') {
      ctx.lastSignals.set(spawned.session.id, signal.type)
      switch (signal.type) {
        case 'completed':
          spawned.session.state = 'completed'
          ctx.saveSession(spawned.session)
          if (['implement', 'fix', 'audit'].includes(spawned.session.runMode)) {
            setTaskStatus(ctx, spawned.session, 'in-review')
          }
          ctx.broadcast({ type: 'agent_state', agentId: spawned.session.id, state: 'completed' })
          notifyCompleted(spawned.session.displayName, spawned.session.timeSpent)
          break
        case 'plan_ready': {
          spawned.session.state = 'completed'
          ctx.saveSession(spawned.session)
          setTaskStatus(ctx, spawned.session, 'plan-review')
          const project = ctx.registry.projects.find(p => p.id === spawned.session.projectId)
          const projectFolder = project?.todoFile.replace(/\/[^/]+$/, '') ?? ''
          const planDetail = buildPlanDetail(spawned.session, projectFolder)
          addQueueItem(ctx, 'plan-review', spawned.session, `Plan ready: ${spawned.session.taskName}`)
          ctx.queue[ctx.queue.length - 1].detail = planDetail
          ctx.broadcast({ type: 'agent_state', agentId: spawned.session.id, state: 'completed' })
          ctx.broadcast({ type: 'queue', items: ctx.queue })
          notifyPlanReady(spawned.session.displayName)
          break
        }
        case 'verified': {
          const combinedOutput = spawned.session.lastOutput + data
          const report = parseVerificationReport(combinedOutput)
          spawned.session.verificationReport = report
          spawned.session.state = 'completed'
          ctx.saveSession(spawned.session)
          setTaskStatus(ctx, spawned.session, 'in-review')
          addQueueItem(ctx, 'output-verification', spawned.session, `Verification: ${spawned.session.taskName}`)
          if (report) {
            const reportDetail = report.checks
              .map(c => {
                const icon = c.status === 'pass' ? '\u2705' : c.status === 'fail' ? '\u274c' : c.status === 'skip' ? '\u23ed\ufe0f' : '\u26a0\ufe0f'
                return `${icon} ${c.name}: ${c.detail}`
              }).join('\n') + (report.summary ? `\n\n${report.summary}` : '')
            ctx.queue[ctx.queue.length - 1].detail = reportDetail
          }
          ctx.broadcast({ type: 'agent_state', agentId: spawned.session.id, state: 'completed' })
          ctx.broadcast({ type: 'verification_report', agentId: spawned.session.id, report: report ?? { checks: [], summary: 'No structured report found', timestamp: Date.now() } })
          ctx.broadcast({ type: 'queue', items: ctx.queue })
          notifyCompleted(spawned.session.displayName, spawned.session.timeSpent)
          break
        }
        case 'needs_help':
          spawned.session.state = 'waiting'
          spawned.session.pendingQuestion = stripAnsi(signal.reason ?? 'Agent needs help')
          spawned.session.conversationHistory.push({
            role: 'agent',
            content: spawned.session.pendingQuestion,
            timestamp: Date.now(),
            metadata: { signal: 'needs_help' },
          })
          ctx.saveSession(spawned.session)
          addQueueItem(ctx, 'agent-question', spawned.session, signal.reason ?? 'Agent needs help')
          ctx.broadcast({ type: 'agent_state', agentId: spawned.session.id, state: 'waiting', question: spawned.session.pendingQuestion ?? undefined })
          notifyNeedsInput(spawned.session.displayName, signal.reason ?? 'Agent needs help')
          break
        case 'partial':
          spawned.session.state = 'completed'
          ctx.saveSession(spawned.session)
          ctx.broadcast({ type: 'agent_state', agentId: spawned.session.id, state: 'completed' })
          notifyCompleted(spawned.session.displayName, spawned.session.timeSpent)
          break
      }
    }

    // Question heuristic — skip during startup grace period
    const STARTUP_GRACE_MS = 60_000
    const timeSinceStart = Date.now() - spawned.session.startedAt
    if (!signal && timeSinceStart > STARTUP_GRACE_MS && detectQuestion(data) && spawned.session.state === 'running') {
      const extracted = extractStreamJsonText(data)
      let questionText: string
      const lastQ = extracted.lastIndexOf('?')
      if (lastQ >= 0) {
        const start = Math.max(0, lastQ - 250)
        questionText = stripAnsi(extracted.slice(start, lastQ + 1))
      } else {
        questionText = stripAnsi(extracted.slice(-200) || data.slice(-200))
      }
      spawned.session.state = 'waiting'
      spawned.session.pendingQuestion = questionText
      spawned.session.conversationHistory.push({
        role: 'agent',
        content: questionText,
        timestamp: Date.now(),
        metadata: { signal: 'question_heuristic' },
      })
      ctx.saveSession(spawned.session)
      addQueueItem(ctx, 'agent-question', spawned.session, questionText)
      ctx.broadcast({ type: 'agent_state', agentId: spawned.session.id, state: 'waiting', question: spawned.session.pendingQuestion })
      notifyNeedsInput(spawned.session.displayName, questionText)
    }

    ctx.broadcast({ type: 'terminal_output', agentId: spawned.session.id, data })
    ctx.saveSession(spawned.session)
  })

  spawned.pty.onExit(({ exitCode }) => {
    const agentEntry = ctx.agents.get(spawned.session.id)
    if (agentEntry) agentEntry.pty = null

    if (['running', 'stalled'].includes(spawned.session.state)) {
      const missedSignal = spawned.session.state === 'running'
        ? detectSignal(spawned.session.lastOutput)
        : null

      if (missedSignal?.type === 'plan_ready') {
        spawned.session.state = 'completed'
        ctx.lastSignals.set(spawned.session.id, 'plan_ready')
        const project = ctx.registry.projects.find(p => p.id === spawned.session.projectId)
        const projectFolder = project?.todoFile.replace(/\/[^/]+$/, '') ?? ''
        const planDetail = buildPlanDetail(spawned.session, projectFolder)
        addQueueItem(ctx, 'plan-review', spawned.session, `Plan ready: ${spawned.session.taskName}`)
        ctx.queue[ctx.queue.length - 1].detail = planDetail
        ctx.broadcast({ type: 'queue', items: ctx.queue })
        notifyPlanReady(spawned.session.displayName)
        console.log(`[onExit fallback] Detected plan_ready for ${spawned.session.displayName}`)
      } else if (missedSignal?.type === 'verified') {
        const report = parseVerificationReport(spawned.session.lastOutput)
        spawned.session.verificationReport = report
        spawned.session.state = 'completed'
        ctx.lastSignals.set(spawned.session.id, 'verified')
        addQueueItem(ctx, 'output-verification', spawned.session, `Verification: ${spawned.session.taskName}`)
        if (report) {
          const reportDetail = report.checks
            .map(c => {
              const icon = c.status === 'pass' ? '\u2705' : c.status === 'fail' ? '\u274c' : c.status === 'skip' ? '\u23ed\ufe0f' : '\u26a0\ufe0f'
              return `${icon} ${c.name}: ${c.detail}`
            }).join('\n') + (report.summary ? `\n\n${report.summary}` : '')
          ctx.queue[ctx.queue.length - 1].detail = reportDetail
        }
        ctx.broadcast({ type: 'verification_report', agentId: spawned.session.id, report: report ?? { checks: [], summary: 'No structured report found', timestamp: Date.now() } })
        ctx.broadcast({ type: 'queue', items: ctx.queue })
        notifyCompleted(spawned.session.displayName, spawned.session.timeSpent)
        console.log(`[onExit fallback] Detected verified for ${spawned.session.displayName}`)
      } else {
        spawned.session.state = exitCode === 0 ? 'completed' : 'errored'
      }
    }
    ctx.saveSession(spawned.session)
    ctx.broadcast({ type: 'agent_state', agentId: spawned.session.id, state: spawned.session.state })
    ctx.broadcast({ type: 'agents', agents: Array.from(ctx.agents.values()).map(a => a.session) })
    const signalHandled = ctx.lastSignals.has(spawned.session.id)
    if (spawned.session.state === 'errored') {
      notifyError(spawned.session.displayName, exitCode)
    } else if (spawned.session.state === 'completed' && !signalHandled) {
      notifyCompleted(spawned.session.displayName, spawned.session.timeSpent)
    }
    console.log(`Agent ${spawned.session.displayName} exited (code ${exitCode}, state: ${spawned.session.state})`)

    // Ralph Loop: auto-resume if applicable
    if (spawned.session.executionMode === 'ralph' && spawned.session.providerSessionId) {
      const lastSignal = ctx.lastSignals.get(spawned.session.id) ?? null
      const rctx = ctx.ralphContexts.get(spawned.session.id) ?? { iterationCount: 0, maxIterations: 10 }

      if (shouldContinueLoop(spawned.session, lastSignal) && rctx.iterationCount < rctx.maxIterations) {
        rctx.iterationCount++
        ctx.ralphContexts.set(spawned.session.id, rctx)

        const task = ctx.tasks.find(t => t.id === spawned.session.taskId && t.projectId === spawned.session.projectId)
        if (task) {
          const ralphTaskCtx = spawned.session.originalTaskContext
          const ralphHint = ralphTaskCtx?.useModelHints !== false
            ? ctx.promptLibrary.modelHints.get(ralphTaskCtx?.providerId ?? spawned.session.providerId) ?? null
            : null
          const continuationPrompt = buildContinuationPrompt(spawned.session, spawned.session.lastOutput, ralphHint)
          const ralphFrontmatter = ctx.projectFrontmatters.get(spawned.session.projectId)
          let nextSpawned: SpawnedAgent
          try {
            nextSpawned = spawnAgent({
              task,
              prompt: continuationPrompt,
              runMode: spawned.session.runMode,
              executionMode: spawned.session.executionMode,
              model: spawned.session.model,
              providerId: spawned.session.providerId,
              profile: spawned.session.permissionProfile,
              timeLimit: spawned.session.timeLimit,
              gitBranch: !!spawned.session.gitBranch,
              gitBaseCommit: spawned.session.gitBaseCommit,
              resumeId: spawned.session.providerSessionId,
              resumeCount: spawned.session.resumeCount + 1,
              allowedTools: ctx.resolveAllowedTools(spawned.session.permissionProfile),
              disallowedTools: ctx.resolveDisallowedTools(spawned.session.permissionProfile),
              cwd: ralphFrontmatter?.['default-cwd'],
              maxBudgetUsd: config.maxBudgetUsd,
            })
          } catch (err) {
            const message = `Ralph re-spawn failed: ${err instanceof Error ? err.message : String(err)}`
            console.error(message)
            ctx.broadcast({ type: 'task_write_error', projectId: spawned.session.projectId, message })
            return
          }

          nextSpawned.session.conversationHistory = [...spawned.session.conversationHistory]
          nextSpawned.session.originalTaskContext = spawned.session.originalTaskContext

          ctx.agents.delete(spawned.session.id)
          ctx.agents.set(nextSpawned.session.id, nextSpawned)
          ctx.ralphContexts.set(nextSpawned.session.id, rctx)
          ctx.saveSession(nextSpawned.session)
          wireAgentOutput(ctx, nextSpawned)

          console.log(`Ralph Loop: re-spawned ${nextSpawned.session.displayName} (iteration ${rctx.iterationCount})`)
          ctx.broadcast({ type: 'agents', agents: Array.from(ctx.agents.values()).map(a => a.session) })
        }
      }
    }
  })
}

export function handleInput(ctx: HandlerContext, agentId: string, input: string) {
  const agent = ctx.agents.get(agentId)
  if (!agent?.pty) return
  agent.pty.write(input + '\n')
  agent.session.state = 'running'
  agent.session.pendingQuestion = null
  ctx.saveSession(agent.session)
  ctx.broadcast({ type: 'agent_state', agentId, state: 'running' })
}

export function handleNudge(ctx: HandlerContext, agentId: string, message: string) {
  const agent = ctx.agents.get(agentId)
  if (!agent?.pty) return
  agent.pty.write(message + '\n')
  agent.session.lastOutputAt = Date.now()
  ctx.saveSession(agent.session)
}

export function handleStop(ctx: HandlerContext, agentId: string) {
  const agent = ctx.agents.get(agentId)
  if (!agent) return
  if (agent.pty) agent.pty.kill()
  agent.session.state = 'suspended'
  agent.session.suspendedAt = Date.now()
  ctx.saveSession(agent.session)
  ctx.broadcast({ type: 'agent_state', agentId, state: 'suspended' })
  ctx.broadcast({ type: 'agents', agents: Array.from(ctx.agents.values()).map(a => a.session) })
}

/** Build a context-rich resume prompt with task context and full conversation history */
function buildRichResumePrompt(session: AgentSession, latestResponse?: string): string {
  const taskCtx = session.originalTaskContext
  const history = session.conversationHistory
  const parts: string[] = []

  if (taskCtx) {
    parts.push(`## Task Context`)
    parts.push(`**Task:** ${taskCtx.taskName}\n**Mode:** ${taskCtx.runMode}`)
    parts.push(taskCtx.taskDescription)
  }

  if (history.length > 0) {
    const capped = history.length > 20 ? history.slice(-20) : history
    parts.push(`## Conversation History\n`)
    for (let i = 0; i < capped.length; i++) {
      const entry = capped[i]
      const label = entry.role === 'agent' ? 'Agent asked' : 'Human answered'
      const content = (i < capped.length - 3 && entry.content.length > 200)
        ? entry.content.slice(0, 200) + '...'
        : entry.content
      parts.push(`**${label}:**\n> ${content}\n`)
    }
  }

  if (latestResponse) {
    parts.push(`## Latest Answer\n> ${latestResponse}\n`)
  }

  parts.push(`## Instructions`)
  parts.push(`Continue working on the task. Do not re-ask answered questions. If you need more info, output [NEEDS_HELP: question]. When done, output [COMPLETED].`)

  const prompt = parts.join('\n\n')
  return prompt.length > 4000 ? prompt.slice(0, 4000) + '\n\n[...truncated]' : prompt
}

export function handleResume(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'resume_agent' }>) {
  const agent = ctx.agents.get(msg.agentId)
  if (!agent?.session.providerSessionId) return

  const task = ctx.tasks.find(t => t.id === agent.session.taskId && t.projectId === agent.session.projectId)
  if (!task) return

  const resumePrompt = buildRichResumePrompt(agent.session, msg.additionalContext)

  const resumeFrontmatter = ctx.projectFrontmatters.get(agent.session.projectId)
  let spawned: SpawnedAgent
  try {
    spawned = spawnAgent({
      task,
      prompt: resumePrompt,
      runMode: agent.session.runMode,
      executionMode: agent.session.executionMode,
      model: agent.session.model,
      providerId: agent.session.providerId,
      profile: agent.session.permissionProfile,
      timeLimit: msg.timeLimit ?? agent.session.timeLimit,
      gitBranch: !!agent.session.gitBranch,
      gitBaseCommit: agent.session.gitBaseCommit,
      resumeId: agent.session.providerSessionId,
      forkSession: msg.fork,
      resumeCount: agent.session.resumeCount + 1,
      allowedTools: ctx.resolveAllowedTools(agent.session.permissionProfile),
      disallowedTools: ctx.resolveDisallowedTools(agent.session.permissionProfile),
      cwd: resumeFrontmatter?.['default-cwd'],
      maxBudgetUsd: config.maxBudgetUsd,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : `Failed to resume agent: ${String(err)}`
    console.error(message)
    ctx.broadcast({ type: 'task_write_error', projectId: agent.session.projectId, message })
    return
  }

  spawned.session.conversationHistory = [...agent.session.conversationHistory]
  spawned.session.originalTaskContext = agent.session.originalTaskContext

  ctx.agents.delete(msg.agentId)
  ctx.agents.set(spawned.session.id, spawned)
  ctx.saveSession(spawned.session)
  wireAgentOutput(ctx, spawned)

  console.log(`Resumed agent ${spawned.session.displayName} (${msg.fork ? 'forked' : 'continued'})`)
  ctx.broadcast({ type: 'agents', agents: Array.from(ctx.agents.values()).map(a => a.session) })
}

export function handleClearCompletedAgents(ctx: HandlerContext) {
  const toRemove: string[] = []
  for (const [id, agent] of ctx.agents) {
    if (['completed', 'errored', 'suspended'].includes(agent.session.state)) {
      toRemove.push(id)
    }
  }
  for (const id of toRemove) {
    ctx.agents.delete(id)
    ctx.deleteSession(id)
  }
  if (toRemove.length > 0) {
    console.log(`Cleared ${toRemove.length} finished/suspended agents (removed from disk)`)
    ctx.broadcast({ type: 'agents', agents: Array.from(ctx.agents.values()).map(a => a.session) })
  }
}
