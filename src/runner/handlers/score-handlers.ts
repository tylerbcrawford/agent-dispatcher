// src/runner/handlers/score-handlers.ts
// WebSocket handlers for scoring operations and project weight updates.
import type { ClientMessage } from '../../shared/types.js'
import { saveProjectRegistry } from '../config.js'
import { runScoringPass, rescoreProject } from '../scoring/scoring-agent.js'
import type { HandlerContext } from '../handler-context.js'

export function handleRescoreAll(ctx: HandlerContext) {
  const result = runScoringPass(ctx.registry.projects, ctx.broadcast)
  console.log(`Rescore complete: ${result.scoredCount} tasks across ${result.projectsProcessed} projects`)

  // Reload tasks and broadcast updated state
  ctx.loadTasks()
  for (const project of ctx.registry.projects.filter(p => p.active)) {
    ctx.broadcast({
      type: 'tasks',
      projectId: project.id,
      tasks: ctx.tasks.filter(t => t.projectId === project.id),
    })
  }
}

export function handleRescoreProject(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'rescore_project' }>) {
  const project = ctx.registry.projects.find(p => p.id === msg.projectId)
  if (!project) return

  const scoredCount = rescoreProject(project, ctx.broadcast)
  console.log(`Rescored project ${project.name}: ${scoredCount} tasks`)

  // Reload and broadcast
  ctx.loadTasks()
  ctx.broadcast({
    type: 'tasks',
    projectId: project.id,
    tasks: ctx.tasks.filter(t => t.projectId === project.id),
  })
}

export function handleUpdateProjectWeight(
  ctx: HandlerContext,
  msg: Extract<ClientMessage, { type: 'update_project_weight' }>,
) {
  const project = ctx.registry.projects.find(p => p.id === msg.projectId)
  if (!project) return

  project.weight = Math.max(0, Math.min(100, msg.weight))
  project.weightReason = msg.reason ?? ''
  saveProjectRegistry(ctx.registry)

  console.log(`Updated weight for ${project.name}: ${project.weight} (${project.weightReason || 'no reason'})`)

  ctx.broadcast({ type: 'projects', projects: ctx.registry.projects })
}

export function handleUpdateProjectWeightsBatch(
  ctx: HandlerContext,
  msg: Extract<ClientMessage, { type: 'update_project_weights_batch' }>,
) {
  for (const entry of msg.weights) {
    const project = ctx.registry.projects.find(p => p.id === entry.projectId)
    if (!project) continue
    project.weight = Math.max(0, Math.min(100, entry.weight))
    project.weightReason = entry.reason ?? project.weightReason
  }
  saveProjectRegistry(ctx.registry)
  console.log(`Batch-updated weights for ${msg.weights.length} projects`)
  ctx.broadcast({ type: 'projects', projects: ctx.registry.projects })
}
