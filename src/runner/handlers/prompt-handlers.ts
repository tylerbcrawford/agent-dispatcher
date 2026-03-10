// src/runner/handlers/prompt-handlers.ts
import type { ClientMessage, RunMode } from '../../shared/types.js'
import { saveCustomPrompt, deleteCustomPrompt } from '../prompt-library.js'
import { config } from '../config.js'
import type { HandlerContext } from '../handler-context.js'

export function handleRequestPromptTemplates(ctx: HandlerContext) {
  ctx.unicast({ type: 'prompt_templates', templates: ctx.buildPromptTemplates() })
}

export function handleSavePromptTemplate(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'save_prompt_template' }>) {
  saveCustomPrompt(config.promptsDir, msg.mode, msg.content)
  ctx.reloadPromptLibrary()
  console.log(`Saved custom prompt for mode: ${msg.mode}`)
}

export function handleResetPromptTemplate(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'reset_prompt_template' }>) {
  deleteCustomPrompt(config.promptsDir, msg.mode)
  ctx.reloadPromptLibrary()
  console.log(`Reset prompt to default for mode: ${msg.mode}`)
}
