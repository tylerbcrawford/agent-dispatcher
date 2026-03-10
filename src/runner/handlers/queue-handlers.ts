// src/runner/handlers/queue-handlers.ts
import { taskToSlug } from '../prompt-library.js'
import { handleInput, handleResume } from './agent-handlers.js'
import { handleUpdateTask } from './task-handlers.js'
import type { HandlerContext } from '../handler-context.js'

export function handleResolveQueueItem(ctx: HandlerContext, itemId: string, action: string, response?: string) {
  const idx = ctx.queue.findIndex(q => q.id === itemId)
  if (idx === -1) return

  const item = ctx.queue[idx]
  if (action === 'dismiss') {
    item.dismissed = true
    ctx.broadcast({ type: 'queue', items: ctx.queue })
    return
  }
  if (action === 'restore') {
    item.dismissed = false
    ctx.broadcast({ type: 'queue', items: ctx.queue })
    return
  }
  ctx.queue.splice(idx, 1)

  // If responding to an agent question, pipe the response or auto-resume
  if (item.type === 'agent-question' && item.agentId && response) {
    const agent = ctx.agents.get(item.agentId)
    if (agent) {
      agent.session.conversationHistory.push({
        role: 'human',
        content: response,
        timestamp: Date.now(),
        metadata: { queueItemId: item.id },
      })
      ctx.saveSession(agent.session)
    }
    if (agent?.pty) {
      handleInput(ctx, item.agentId, response)
    } else if (agent?.session.providerSessionId) {
      handleResume(ctx, {
        type: 'resume_agent',
        agentId: item.agentId,
        additionalContext: response,
      })
    }
  }

  // Verification review: approve confirms done, reject resumes with feedback
  if (item.type === 'output-verification' && item.agentId) {
    const agent = ctx.agents.get(item.agentId)
    if (action === 'reject' && response) {
      if (agent?.session.providerSessionId) {
        handleResume(ctx, {
          type: 'resume_agent',
          agentId: item.agentId,
          additionalContext: `## Verification Rejected\nYour work was reviewed and needs revision:\n\n${response}\n\nFix the issues, re-run verification, and output [VERIFIED] when ready.`,
        })
      }
    } else if (action === 'approve') {
      const task = ctx.tasks.find(t => t.id === item.taskId && t.projectId === item.projectId)
      if (task) {
        handleUpdateTask(ctx, {
          type: 'update_task',
          projectId: item.projectId,
          taskId: item.taskId,
          patch: { status: 'done' },
        })
        console.log(`Verification approved: task #${item.taskId} \u2192 Done`)
      }
      if (response && agent) {
        agent.session.conversationHistory.push({
          role: 'human',
          content: `[Verification approved] ${response}`,
          timestamp: Date.now(),
          metadata: { queueItemId: item.id },
        })
        ctx.saveSession(agent.session)
      }
    }
  }

  // Plan review: reject with feedback resumes agent with revision instructions
  if (item.type === 'plan-review' && item.agentId) {
    const agent = ctx.agents.get(item.agentId)
    if (action === 'reject' && response) {
      if (agent?.session.providerSessionId) {
        handleResume(ctx, {
          type: 'resume_agent',
          agentId: item.agentId,
          additionalContext: `## Plan Review Feedback\nPlan rejected. Revise:\n\n${response}\n\nOutput [PLAN_READY] when the updated plan is saved.`,
        })
      }
    } else if (action === 'approve') {
      const task = ctx.tasks.find(t => t.id === item.taskId && t.projectId === item.projectId)
      const project = ctx.registry.projects.find(p => p.id === item.projectId)
      if (task && project) {
        const slug = taskToSlug(task.name)
        const planLink = `plans/${slug}-plan`
        handleUpdateTask(ctx, {
          type: 'update_task',
          projectId: item.projectId,
          taskId: item.taskId,
          patch: { status: 'ready', planLink },
        })
        console.log(`Plan approved: task #${item.taskId} \u2192 Ready (${planLink})`)
      }
      if (response && agent) {
        agent.session.conversationHistory.push({
          role: 'human',
          content: `[Plan approved] ${response}`,
          timestamp: Date.now(),
          metadata: { queueItemId: item.id },
        })
        ctx.saveSession(agent.session)
      }
    }
  }

  ctx.broadcast({ type: 'queue', items: ctx.queue })
}
