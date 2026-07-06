// src/runner/index.ts
// Host-side agent orchestrator — listens on Unix socket for WebSocket connections
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { readFileSync, existsSync, unlinkSync, rmSync } from 'fs'
import type { Task, AgentSession, ClientMessage, ServerMessage, QueueItem, TodoFrontmatter, PromptLibraryMeta, PromptTemplateContent } from '../shared/types.js'
import { config, loadProjectRegistry } from './config.js'
import { parseTodoFile } from './parser.js'
import { loadPromptLibrary } from './prompt-library.js'
import { saveSession, loadAllSessions, deleteSession, pruneOldSessions } from './sessions.js'
import { checkStall } from './stall-detector.js'
import { initNotifier, notifyStalled, notifyTimeout } from './notifier.js'
import { loadProfiles, toAllowedTools, toDisallowedTools } from './permissions.js'
import type { RalphContext } from './ralph.js'
import type { IPty } from 'node-pty'
import type { HandlerContext } from './handler-context.js'

// Handler imports
import { handleSpawn, handleInput, handleNudge, handleStop, handleResume, handleClearCompletedAgents, addQueueItem } from './handlers/agent-handlers.js'
import { handleCreateTask, handleUpdateTask, handleDeleteTask, handleDeleteTasks } from './handlers/task-handlers.js'
import { handleCreateProject, handleUpdateProject, handleDeleteProject, handleUpdateGroups } from './handlers/project-handlers.js'
import { handleSwitchProject, handleRequestTasks, handleRequestConversation, handleRequestDiff, handleRequestPlanContent } from './handlers/data-handlers.js'
import { handleRequestPromptTemplates, handleSavePromptTemplate, handleResetPromptTemplate } from './handlers/prompt-handlers.js'
import { handleResolveQueueItem } from './handlers/queue-handlers.js'
import { handleRescoreAll, handleRescoreProject, handleUpdateProjectWeight, handleUpdateProjectWeightsBatch } from './handlers/score-handlers.js'
import { startWatcher, stopWatcher } from './watcher.js'
import { planExists } from './plan-resolver.js'

// --- State ---
const agents = new Map<string, { session: AgentSession; pty: IPty | null }>()
const queue: QueueItem[] = []
let tasks: Task[] = []
const projectFrontmatters = new Map<string, TodoFrontmatter>()
const ralphContexts = new Map<string, RalphContext>()
const lastSignals = new Map<string, string | null>()
const clients = new Set<WebSocket>()

// --- Initialization ---
let registry = loadProjectRegistry()
let promptLibrary = loadPromptLibrary(config.promptsDir)
const permissionProfiles = loadProfiles(config.permissionsDir)

function resolveAllowedTools(profileName: string): string | undefined {
  const profile = permissionProfiles.get(profileName)
  if (!profile || profile.tools.length === 0) return undefined
  return toAllowedTools(profile).join(',')
}

function resolveDisallowedTools(profileName: string): string | undefined {
  const profile = permissionProfiles.get(profileName)
  if (!profile) return undefined
  const disallowed = toDisallowedTools(profile)
  return disallowed.length > 0 ? disallowed.join(',') : undefined
}

function loadTasks() {
  tasks = []
  for (const project of registry.projects.filter(p => p.active)) {
    if (existsSync(project.todoFile)) {
      const content = readFileSync(project.todoFile, 'utf-8')
      const parsed = parseTodoFile(content)
      const planFolder = project.todoFile.replace(/\/[^/]+$/, '')
      for (const t of parsed.tasks) {
        t.hasPlan = planExists(t.planLink, config.vaultPath, planFolder)
      }
      tasks.push(...parsed.tasks)
      projectFrontmatters.set(project.id, parsed.frontmatter)
    }
  }
}

loadTasks()
console.log(`Loaded ${tasks.length} tasks from ${registry.projects.filter(p => p.active).length} projects`)

function buildPromptLibraryMeta(): PromptLibraryMeta {
  const allTemplates = [...promptLibrary.bases, ...promptLibrary.variants, ...promptLibrary.taskSpecific]
  return {
    templates: allTemplates.map(t => ({
      id: t.id,
      mode: t.mode,
      label: t.label,
      description: t.description,
      tags: t.tags,
      defaultProfile: t.defaultProfile,
      defaultTime: t.defaultTime,
      defaultModel: t.defaultModel,
      layer: t.layer as 'base' | 'variant' | 'task-specific',
    })),
    snippets: promptLibrary.snippets.map(s => ({
      id: s.id,
      label: s.label,
      description: s.description,
      tags: s.tags,
    })),
    modelHints: Array.from(promptLibrary.modelHints.values()).map(h => ({
      provider: h.provider,
      label: h.label,
      description: h.description,
    })),
  }
}
console.log(`Prompt library: ${promptLibrary.bases.length} bases, ${promptLibrary.variants.length} variants, ${promptLibrary.snippets.length} snippets, ${promptLibrary.modelHints.size} hints`)

function buildPromptTemplates(): PromptTemplateContent[] {
  return promptLibrary.bases.map(t => ({
    mode: t.mode,
    label: t.label,
    description: t.description,
    content: t.prompt,
    hasCustomOverride: t.hasCustomOverride ?? false,
    defaultModel: t.defaultModel,
    defaultTime: t.defaultTime,
    defaultProfile: t.defaultProfile,
  }))
}

function reloadPromptLibrary() {
  promptLibrary = loadPromptLibrary(config.promptsDir)
  broadcast({ type: 'prompt_library', library: buildPromptLibraryMeta() })
  broadcast({ type: 'prompt_templates', templates: buildPromptTemplates() })
}

// Prune old completed/errored sessions before recovery
const pruned = pruneOldSessions(config.logRetentionDays)
if (pruned > 0) console.log(`Pruned ${pruned} old sessions (>${config.logRetentionDays} days)`)

// Recover sessions from disk — PTY is gone after restart, so active states must be suspended
for (const session of loadAllSessions()) {
  if (session.state === 'running' || session.state === 'waiting' || session.state === 'stalled') {
    session.state = 'suspended'
    session.suspendedAt = Date.now()
    session.pendingQuestion = null
    saveSession(session)
  }
  agents.set(session.id, { session, pty: null })
}
if (agents.size > 0) console.log(`Recovered ${agents.size} sessions from disk`)

// Initialize Discord notifier (async, non-blocking)
initNotifier().catch(err => console.error('Failed to init Discord notifier:', err))

// --- Broadcast ---
function broadcast(msg: ServerMessage) {
  const data = JSON.stringify(msg)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data)
  }
}

// --- Handler Context ---
// Mutable context object shared by all handler modules via reference.
// Properties like `tasks` and `registry` are reassigned by their reload functions
// and handlers always read the latest value through ctx.
const ctx: HandlerContext = {
  agents, queue, tasks, registry, promptLibrary,
  projectFrontmatters, ralphContexts, lastSignals, clients,
  permissionProfiles,
  broadcast, loadTasks, reloadPromptLibrary, resolveAllowedTools, resolveDisallowedTools,
  saveSession, deleteSession, buildPromptLibraryMeta, buildPromptTemplates,
  unicast: null!,  // set per-message in handleClientMessage
}

// Keep ctx in sync when top-level variables are reassigned
const origLoadTasks = loadTasks
const syncedLoadTasks = () => { origLoadTasks(); ctx.tasks = tasks }
ctx.loadTasks = syncedLoadTasks

const origReloadPromptLibrary = reloadPromptLibrary
const syncedReloadPromptLibrary = () => { origReloadPromptLibrary(); ctx.promptLibrary = promptLibrary }
ctx.reloadPromptLibrary = syncedReloadPromptLibrary

// --- File watcher for todo auto-detection + reload ---
let reloadTimer: ReturnType<typeof setTimeout> | null = null

startWatcher({
  vaultPath: config.vaultPath,
  registry,
  onTasksChanged: (filePath) => {
    // Debounce: collapse rapid saves into one reload
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => {
      console.log(`Reloading tasks (file changed: ${filePath})`)
      syncedLoadTasks()
      for (const project of registry.projects.filter(p => p.active)) {
        broadcast({
          type: 'tasks',
          projectId: project.id,
          tasks: tasks.filter(t => t.projectId === project.id),
        })
      }
    }, 1000)
  },
  onProjectAdded: (updatedRegistry) => {
    registry = updatedRegistry
    ctx.registry = registry
    syncedLoadTasks()
    broadcast({ type: 'projects', projects: registry.projects })
    for (const project of registry.projects.filter(p => p.active)) {
      broadcast({
        type: 'tasks',
        projectId: project.id,
        tasks: tasks.filter(t => t.projectId === project.id),
      })
    }
  },
})

// --- WebSocket Server on Unix socket ---
const socketPath = config.unixSocket
if (existsSync(socketPath)) {
  try {
    unlinkSync(socketPath)
  } catch {
    // Socket path might be a directory (Docker phantom mount) — force-remove it
    rmSync(socketPath, { recursive: true, force: true })
  }
}

const server = createServer()
const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  clients.add(ws)
  console.log(`Client connected (${clients.size} total)`)

  const defaultProject = registry.defaultProject
  ws.send(JSON.stringify({ type: 'projects', projects: registry.projects } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'project_groups', groups: registry.groups ?? [] } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'prompt_library', library: buildPromptLibraryMeta() } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'tasks', projectId: defaultProject, tasks: tasks.filter(t => t.projectId === defaultProject) } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'agents', agents: Array.from(agents.values()).map(a => a.session) } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'queue', items: queue } satisfies ServerMessage))

  ws.on('message', (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString())
      handleClientMessage(msg, ws)
    } catch (err) {
      console.error('Failed to parse message:', err)
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
    console.log(`Client disconnected (${clients.size} remaining)`)
  })

  // The web container is recreated on every frontend deploy, which resets the
  // proxied connection mid-flight. Without this handler the resulting 'error'
  // event is unhandled and the ws EventEmitter throws, crashing the whole runner
  // (and suspending every live agent). Log and drop the one client instead.
  ws.on('error', (err) => {
    console.error('Client socket error:', err)
    clients.delete(ws)
  })
})

server.listen(socketPath, () => {
  console.log(`Agent runner listening on ${socketPath}`)
})

// --- Message Handling — thin dispatcher ---
function handleClientMessage(msg: ClientMessage, ws: import('ws').WebSocket) {
  ctx.unicast = (data: ServerMessage) => ws.send(JSON.stringify(data))
  switch (msg.type) {
    case 'spawn_agent':
      handleSpawn(ctx, msg)
      break
    case 'agent_input': {
      const inputAgent = agents.get(msg.agentId)
      if (inputAgent && inputAgent.session.state === 'waiting') {
        inputAgent.session.conversationHistory.push({
          role: 'human',
          content: msg.input,
          timestamp: Date.now(),
        })
      }
      handleInput(ctx, msg.agentId, msg.input)
      break
    }
    case 'stop_agent':
      handleStop(ctx, msg.agentId)
      break
    case 'nudge_agent':
      handleNudge(ctx, msg.agentId, msg.message)
      break
    case 'resume_agent':
      handleResume(ctx, msg)
      break
    case 'extend_time': {
      const extAgent = agents.get(msg.agentId)
      if (extAgent) {
        extAgent.session.timeLimit += msg.minutes
        saveSession(extAgent.session)
        broadcast({ type: 'agents', agents: Array.from(agents.values()).map(a => a.session) })
        console.log(`Extended ${extAgent.session.displayName} time limit by ${msg.minutes}m \u2192 ${extAgent.session.timeLimit}m`)
      }
      break
    }
    case 'switch_project':
      handleSwitchProject(ctx, msg)
      break
    case 'request_tasks':
      handleRequestTasks(ctx, msg)
      break
    case 'resolve_queue_item':
      handleResolveQueueItem(ctx, msg.itemId, msg.action, msg.response)
      break
    case 'request_conversation':
      handleRequestConversation(ctx, msg)
      break
    case 'request_diff':
      handleRequestDiff(ctx, msg)
      break
    case 'request_plan_content':
      handleRequestPlanContent(ctx, msg)
      break
    case 'create_task':
      handleCreateTask(ctx, msg)
      break
    case 'update_task':
      handleUpdateTask(ctx, msg)
      break
    case 'delete_task':
      handleDeleteTask(ctx, msg)
      break
    case 'delete_tasks':
      handleDeleteTasks(ctx, msg)
      break
    case 'create_project':
      handleCreateProject(ctx, msg)
      break
    case 'update_project':
      handleUpdateProject(ctx, msg)
      break
    case 'delete_project':
      handleDeleteProject(ctx, msg)
      break
    case 'update_groups':
      handleUpdateGroups(ctx, msg)
      break
    case 'clear_completed_agents':
      handleClearCompletedAgents(ctx)
      break
    case 'request_prompt_templates':
      handleRequestPromptTemplates(ctx)
      break
    case 'save_prompt_template':
      handleSavePromptTemplate(ctx, msg)
      break
    case 'reset_prompt_template':
      handleResetPromptTemplate(ctx, msg)
      break
    case 'update_project_weight':
      handleUpdateProjectWeight(ctx, msg)
      break
    case 'update_project_weights_batch':
      handleUpdateProjectWeightsBatch(ctx, msg)
      break
    case 'rescore_all':
      handleRescoreAll(ctx)
      break
    case 'rescore_project':
      handleRescoreProject(ctx, msg)
      break
  }
}

// --- Stall detection interval (every 30s) ---
setInterval(() => {
  for (const [, agent] of agents) {
    const stallEvent = checkStall(agent.session)
    if (stallEvent?.type === 'stalled' && agent.session.state === 'running') {
      agent.session.state = 'stalled'
      saveSession(agent.session)
      addQueueItem(ctx, 'stalled-agent', agent.session, `Agent silent for ${stallEvent.silenceMinutes} minutes`)
      broadcast({ type: 'agent_state', agentId: agent.session.id, state: 'stalled' })
      notifyStalled(agent.session.displayName, stallEvent.silenceMinutes)
      console.log(`Agent ${agent.session.displayName} stalled after ${stallEvent.silenceMinutes}min silence`)
    }
  }
}, 30_000)

// --- Time limit enforcement (every 10s) ---
setInterval(() => {
  for (const [, agent] of agents) {
    if (agent.session.state !== 'running') continue
    const elapsed = (Date.now() - agent.session.startedAt) / 60_000
    agent.session.timeSpent = Math.round(elapsed)
    if (elapsed >= agent.session.timeLimit) {
      agent.pty?.kill('SIGTERM')
      setTimeout(() => agent.pty?.kill('SIGKILL'), 10_000)
      agent.session.state = 'suspended'
      agent.session.suspendedAt = Date.now()
      saveSession(agent.session)
      broadcast({ type: 'agent_state', agentId: agent.session.id, state: 'suspended' })
      notifyTimeout(agent.session.displayName, agent.session.timeLimit)
      console.log(`Agent ${agent.session.displayName} hit time limit (${agent.session.timeLimit}min)`)
    }
  }
}, 10_000)

// --- Graceful shutdown ---
process.on('SIGINT', () => {
  console.log('Shutting down...')
  for (const [, agent] of agents) {
    if (agent.pty && agent.session.state === 'running') {
      agent.pty.kill()
      agent.session.state = 'suspended'
      agent.session.suspendedAt = Date.now()
      saveSession(agent.session)
    }
  }
  stopWatcher()
  server.close()
  try { if (existsSync(socketPath)) unlinkSync(socketPath) } catch { /* ignore */ }
  process.exit(0)
})
