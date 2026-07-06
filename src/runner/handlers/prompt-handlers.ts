// src/runner/handlers/prompt-handlers.ts
import type { ClientMessage, RunMode } from '../../shared/types.js'
import { saveCustomPrompt, deleteCustomPrompt } from '../prompt-library.js'
import { config } from '../config.js'
import type { HandlerContext } from '../handler-context.js'

// `mode` is only compile-time-typed as RunMode; the value arrives over the wire as
// an arbitrary string. It becomes a `${mode}.md` filename, so an unvalidated value
// (e.g. "../../etc/x") is a path-traversal write/delete. Whitelist before use.
const VALID_RUN_MODES: ReadonlySet<string> = new Set<RunMode>(['plan', 'implement', 'audit', 'fix', 'custom'])
function isValidRunMode(mode: string): mode is RunMode {
  return VALID_RUN_MODES.has(mode)
}

export function handleRequestPromptTemplates(ctx: HandlerContext) {
  ctx.unicast({ type: 'prompt_templates', templates: ctx.buildPromptTemplates() })
}

export function handleSavePromptTemplate(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'save_prompt_template' }>) {
  if (!isValidRunMode(msg.mode)) {
    console.error(`Rejected save_prompt_template with invalid mode: ${JSON.stringify(msg.mode)}`)
    return
  }
  saveCustomPrompt(config.promptsDir, msg.mode, msg.content, { model: msg.model, time: msg.time, profile: msg.profile })
  ctx.reloadPromptLibrary()
  console.log(`Saved custom prompt for mode: ${msg.mode}`)
}

export function handleResetPromptTemplate(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'reset_prompt_template' }>) {
  if (!isValidRunMode(msg.mode)) {
    console.error(`Rejected reset_prompt_template with invalid mode: ${JSON.stringify(msg.mode)}`)
    return
  }
  deleteCustomPrompt(config.promptsDir, msg.mode)
  ctx.reloadPromptLibrary()
  console.log(`Reset prompt to default for mode: ${msg.mode}`)
}
