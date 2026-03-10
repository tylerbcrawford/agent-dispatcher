// src/runner/handlers/data-handlers.ts
import type { ClientMessage, DiffData } from '../../shared/types.js'
import { execSync } from 'child_process'
import { parseUnifiedDiff } from '../diff-parser.js'
import { resolvePlanLink } from '../plan-resolver.js'
import { taskToSlug } from '../prompt-library.js'
import { config } from '../config.js'
import type { HandlerContext } from '../handler-context.js'

export function handleSwitchProject(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'switch_project' }>) {
  ctx.loadTasks()
  ctx.unicast({ type: 'tasks', projectId: msg.projectId, tasks: msg.projectId === '__all__' ? ctx.tasks : ctx.tasks.filter(t => t.projectId === msg.projectId) })
}

export function handleRequestTasks(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'request_tasks' }>) {
  ctx.unicast({ type: 'tasks', projectId: msg.projectId, tasks: msg.projectId === '__all__' ? ctx.tasks : ctx.tasks.filter(t => t.projectId === msg.projectId) })
}

export function handleRequestConversation(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'request_conversation' }>) {
  const agent = ctx.agents.get(msg.agentId)
  if (agent) {
    ctx.unicast({ type: 'conversation_history', agentId: msg.agentId, history: agent.session.conversationHistory })
  }
}

export function handleRequestDiff(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'request_diff' }>) {
  const agent = ctx.agents.get(msg.agentId)
  if (!agent?.session.gitBranch) return
  const branch = agent.session.gitBranch
  const baseBranch = 'main'
  const frontmatter = ctx.projectFrontmatters.get(agent.session.projectId)
  const cwd = frontmatter?.['default-cwd'] ?? config.vaultPath
  try {
    const raw = execSync(`git diff ${baseBranch}...${branch}`, {
      cwd,
      timeout: 10_000,
      encoding: 'utf-8',
      maxBuffer: 5 * 1024 * 1024,
    })
    const files = parseUnifiedDiff(raw)
    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)
    const diff: DiffData = { agentId: msg.agentId, branch, baseBranch, files, totalAdditions, totalDeletions }
    ctx.unicast({ type: 'diff_data', diff })
  } catch (err) {
    const diff: DiffData = { agentId: msg.agentId, branch, baseBranch, files: [], totalAdditions: 0, totalDeletions: 0, error: String(err) }
    ctx.unicast({ type: 'diff_data', diff })
  }
}

export function handleRequestPlanContent(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'request_plan_content' }>) {
  const task = ctx.tasks.find(t => t.id === msg.taskId && t.projectId === msg.projectId)
  const project = ctx.registry.projects.find(p => p.id === msg.projectId)
  const planFolder = project?.todoFile.replace(/\/[^/]+$/, '') ?? ''
  let planContent: string | null = null
  if (task?.planLink) {
    planContent = resolvePlanLink(task.planLink, config.vaultPath, planFolder)
  }
  if (!planContent && task) {
    const slug = taskToSlug(task.name)
    planContent = resolvePlanLink(`plans/${slug}-plan`, config.vaultPath, planFolder)
  }
  ctx.unicast({ type: 'plan_content', taskId: msg.taskId, content: planContent })
}
