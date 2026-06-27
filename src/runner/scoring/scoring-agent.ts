// src/runner/scoring/scoring-agent.ts
// Orchestrates a full scoring pass across all active projects.
// Computes base scores deterministically; urgencyBoost defaults to 50 (neutral).
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { Task, ProjectConfig, ServerMessage } from '../../shared/types.js'
import { parseTodoFile } from '../parser.js'
import { updateTaskInContent } from '../task-editor.js'
import { calculateScore } from './score-calculator.js'

export interface ScoringResult {
  scoredCount: number
  projectsProcessed: number
}

/**
 * Run a full scoring pass: read all active project todo files,
 * compute scores, write them back, and return counts.
 */
export function runScoringPass(
  projects: ProjectConfig[],
  broadcast: (msg: ServerMessage) => void,
): ScoringResult {
  const activeProjects = projects.filter(p => p.active)
  let scoredCount = 0

  broadcast({ type: 'scoring_status', status: 'scoring' })

  for (const project of activeProjects) {
    if (!existsSync(project.todoFile)) continue

    const content = readFileSync(project.todoFile, 'utf-8')
    const parsed = parseTodoFile(content)
    let updated = content

    for (const task of parsed.tasks) {
      // Skip done tasks — no need to score them
      if (task.status === 'done') continue

      const newScore = calculateScore(
        project.weight,
        task.priority,
        task.timeMinutes,
        50, // default urgencyBoost — AI-judged urgency is a future enhancement
      )

      if (task.score !== newScore) {
        // Surgical: rewrite only this task's score token, preserving all rich body content.
        updated = updateTaskInContent(updated, task.id, { score: newScore })
      }
      scoredCount++
    }

    if (updated !== content) {
      writeFileSync(project.todoFile, updated, 'utf-8')
    }
  }

  broadcast({ type: 'scoring_status', status: 'complete', scoredCount })

  return { scoredCount, projectsProcessed: activeProjects.length }
}

/**
 * Rescore a single project's tasks.
 */
export function rescoreProject(
  project: ProjectConfig,
  broadcast: (msg: ServerMessage) => void,
): number {
  if (!existsSync(project.todoFile)) return 0

  broadcast({ type: 'scoring_status', status: 'scoring' })

  const content = readFileSync(project.todoFile, 'utf-8')
  const parsed = parseTodoFile(content)
  let scoredCount = 0
  let updated = content

  for (const task of parsed.tasks) {
    if (task.status === 'done') continue

    const newScore = calculateScore(
      project.weight,
      task.priority,
      task.timeMinutes,
      50,
    )

    if (task.score !== newScore) {
      updated = updateTaskInContent(updated, task.id, { score: newScore })
    }
    scoredCount++
  }

  if (updated !== content) {
    writeFileSync(project.todoFile, updated, 'utf-8')
  }

  broadcast({ type: 'scoring_status', status: 'complete', scoredCount })

  return scoredCount
}
