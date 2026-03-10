// src/runner/handler-context.ts
// Shared context object passed to all handler modules by reference.
// Mutable properties (tasks, registry, promptLibrary) are reassigned by
// their respective reload functions — handlers always read the latest value via ctx.

import type { WebSocket } from 'ws'
import type { IPty } from 'node-pty'
import type {
  Task, AgentSession, ServerMessage, QueueItem,
  TodoFrontmatter, ProjectRegistry, PromptLibrary,
  PromptLibraryMeta, PromptTemplateContent, PermissionProfile,
} from '../shared/types.js'
import type { RalphContext } from './ralph.js'

export interface HandlerContext {
  // --- Mutable shared state ---
  agents: Map<string, { session: AgentSession; pty: IPty | null }>
  queue: QueueItem[]
  tasks: Task[]
  registry: ProjectRegistry
  promptLibrary: PromptLibrary
  projectFrontmatters: Map<string, TodoFrontmatter>
  ralphContexts: Map<string, RalphContext>
  lastSignals: Map<string, string | null>
  clients: Set<WebSocket>
  permissionProfiles: Map<string, PermissionProfile>

  // --- Utility functions ---
  broadcast: (msg: ServerMessage) => void
  loadTasks: () => void
  reloadPromptLibrary: () => void
  resolveAllowedTools: (profileName: string) => string | undefined
  saveSession: (session: AgentSession) => void
  deleteSession: (id: string) => void
  buildPromptLibraryMeta: () => PromptLibraryMeta
  buildPromptTemplates: () => PromptTemplateContent[]

  // --- Per-message unicast (set before each handler call) ---
  unicast: (data: ServerMessage) => void
}
