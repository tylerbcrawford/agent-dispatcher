// src/runner/ralph.ts
// Ralph Loop — autonomous agent cycling for executionMode === 'ralph'
// Re-spawns agents after exit until [COMPLETED] signal or human input needed
import type { AgentSession, ModelHint } from '../shared/types.js'

export interface RalphContext {
  iterationCount: number
  maxIterations: number
}

export function shouldContinueLoop(session: AgentSession, signal: string | null): boolean {
  // Stop if agent explicitly signals done
  if (signal === 'completed' || signal === 'plan_ready') return false
  // Stop if agent needs human input
  if (session.state === 'waiting') return false
  // Stop if errored
  if (session.state === 'errored') return false
  // Continue for partial completion or normal exit
  return true
}

export function buildContinuationPrompt(session: AgentSession, previousOutput: string, modelHint?: ModelHint | null): string {
  const parts: string[] = []

  // Include original task context if available
  const ctx = session.originalTaskContext
  if (ctx) {
    parts.push(`## Task Context`)
    parts.push(`**Task:** ${ctx.taskName}\n**Mode:** ${ctx.runMode}`)
    parts.push(ctx.taskDescription)
  }

  // Include conversation history if any Q&A occurred
  if (session.conversationHistory.length > 0) {
    parts.push(`## Conversation History\n`)
    const capped = session.conversationHistory.slice(-20)
    for (const entry of capped) {
      const label = entry.role === 'agent' ? 'Agent asked' : 'Human answered'
      parts.push(`**${label}:**\n> ${entry.content}\n`)
    }
  }

  // Include model hint if enabled
  if (modelHint) {
    parts.push(modelHint.content)
  }

  parts.push(`Continue working on the previous task. Your last session made progress but did not complete.`)
  parts.push(`Previous session summary (last output):\n${previousOutput.slice(-1000)}`)
  parts.push(`Pick up where you left off. If you need help, output [NEEDS_HELP: question]. If you're done, output [COMPLETED].`)

  return parts.join('\n\n')
}
