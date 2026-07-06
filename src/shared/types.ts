// src/shared/types.ts

// --- Project ---

export type GroupColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'

export interface ProjectGroup {
  id: string            // e.g. "work", "personal"
  name: string          // e.g. "Work", "Personal"
  color: GroupColor      // key into static Tailwind color map
  projectIds: string[]   // ordered list of project IDs in this group
}

export interface ProjectConfig {
  id: string             // e.g. "my-project", "docs-site"
  name: string           // e.g. "Website Redesign"
  todoFile: string       // Absolute path to todo-[project].md
  icon: string           // Emoji icon
  active: boolean
  weight: number         // Global priority weight (0-100), used in scoring formula
  weightReason: string   // Why this weight was assigned (from weekly synthesis)
}

export interface ProjectRegistry {
  projects: ProjectConfig[]
  defaultProject: string
  groups?: ProjectGroup[]
}

// Fields for creating a project (ID derived server-side from name)
export interface ProjectDraft {
  name: string         // Display name, e.g. "Website Redesign"
  icon: string         // Emoji icon, e.g. "🎬"
  description?: string // Optional one-liner for todo frontmatter
  defaultCwd?: string  // Optional CWD override
  claudeMd?: string    // Optional CLAUDE.md path override
}

// Partial update — only changed fields
export interface ProjectPatch {
  name?: string
  icon?: string
  active?: boolean
}

// --- Todo Frontmatter ---

export interface TodoFrontmatter {
  project: string
  description: string
  'default-cwd': string
  'claude-md': string
}

// --- Task ---

export interface Task {
  id: number              // Sequential: 1, 2, 3 (parsed from ### heading)
  projectId: string       // Which project this belongs to
  name: string            // e.g. "API Key & Token Rotation"
  emoji: string           // e.g. "📦"
  category: string        // From parent ## heading: "Infrastructure", "Maintenance"
  priority: Priority
  timeEstimate: string    // e.g. "30 min", "1-2 hrs"
  timeMinutes: number     // Parsed numeric estimate (lower bound) for bucket derivation
  status: TaskStatus
  description: string     // Paragraph(s) below the fields
  planLink: string | null // e.g. "rate-limiter-plan" (wiki-link target)
  hasPlan: boolean        // true if a plan file exists for this task (computed in loadTasks)
  affects: string[]       // e.g. ["api", "web"]
  depends: number[]       // e.g. [1, 3] — task IDs this depends on
  bucket: Bucket          // Derived from status
  score: number | null    // Global priority score (0-100), null if unscored
}

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'
export type Bucket = 'running' | 'review' | 'ready' | 'needs-planning' | 'blocked' | 'manual' | 'done'

// Fields for creating a task (ID assigned server-side)
export interface TaskDraft {
  name: string
  emoji: string
  category: string
  priority: Priority
  timeEstimate: string
  status: TaskStatus
  description: string
  planLink?: string | null
  affects?: string[]
  depends?: number[]
}

// Partial update — only changed fields
export interface TaskPatch {
  name?: string
  emoji?: string
  category?: string
  priority?: Priority
  timeEstimate?: string
  status?: TaskStatus
  description?: string
  planLink?: string | null
  affects?: string[]
  depends?: number[]
  score?: number | null
}

export type TaskStatus =
  | 'needs-planning'     // 📝
  | 'plan-review'        // 👁️
  | 'ready'              // ✅ (ready, may or may not have plan)
  | 'in-progress'        // 🤖
  | 'in-review'          // 🔍
  | 'done'               // 🏁
  | 'blocked'            // ⏸️
  | 'manual'             // 🖐️ (requires physical/manual action or time-based wait)

// --- Verification ---

export interface VerificationCheck {
  name: string              // e.g. "Unit tests"
  status: 'pass' | 'fail' | 'skip' | 'warn'
  detail: string            // e.g. "132 tests pass"
}

export interface VerificationReport {
  checks: VerificationCheck[]
  summary: string
  timestamp: number
}

// --- Conversation ---

export interface ConversationEntry {
  role: 'agent' | 'human'
  content: string
  timestamp: number
  metadata?: {
    signal?: 'needs_help' | 'question_heuristic'
    queueItemId?: string
  }
}

// --- Providers ---

export type ProviderId = 'claude' | 'gemini' | 'codex'

export interface ProviderModel {
  id: string        // e.g. 'sonnet', 'gemini-2.5-flash'
  label: string     // e.g. 'Sonnet', 'Flash'
  provider: ProviderId
}

export interface ProviderConfig {
  id: ProviderId
  label: string     // e.g. 'Claude', 'Gemini'
  binary: string    // e.g. 'claude', '/usr/local/bin/gemini'
  models: ProviderModel[]
  supportedRunModes: RunMode[]
}

// --- Agent ---

export type AgentState =
  | 'running'
  | 'waiting'          // Needs human input
  | 'suspended'        // Timed out or manually paused
  | 'stalled'          // No output for AC_STALL_THRESHOLD_MIN
  | 'completed'
  | 'errored'

export type ExecutionMode = 'single' | 'ralph'
export type RunMode = 'plan' | 'implement' | 'audit' | 'fix' | 'custom'

export interface AgentSession {
  id: string                     // Internal UUID
  providerId: ProviderId         // Which provider spawned this agent
  providerSessionId: string | null // Provider CLI session ID (from stream-json)
  displayName: string            // e.g. "1-api-key-rotation-implement-01"
  taskId: number
  taskName: string
  projectId: string
  state: AgentState
  executionMode: ExecutionMode
  runMode: RunMode
  model: string                  // "opus" | "sonnet"
  permissionProfile: string
  timeLimit: number              // minutes
  startedAt: number              // Unix timestamp ms
  suspendedAt: number | null
  lastOutputAt: number
  timeSpent: number              // minutes elapsed
  resumeCount: number
  lastOutput: string             // Last ~500 chars
  pendingQuestion: string | null
  gitBranch: string | null       // display label for the run, e.g. "agent/1-api-key-rotation"
  gitBaseCommit?: string | null  // HEAD sha captured at spawn; the diff is base -> working tree
  conversationHistory: ConversationEntry[]
  originalTaskContext: {
    taskName: string
    taskDescription: string
    runMode: RunMode
    planContent: string | null
    projectName: string
    providerId?: ProviderId
    useModelHints?: boolean
  } | null
  verificationReport: VerificationReport | null
}

// --- Human Work Queue ---

export type QueueItemType =
  | 'agent-question'
  | 'permission-approval'
  | 'plan-review'
  | 'output-verification'
  | 'stage-approval'
  | 'manual-work'
  | 'stalled-agent'

export interface QueueItem {
  id: string
  type: QueueItemType
  taskId: number
  taskName: string
  projectId: string
  agentId: string | null
  summary: string               // Short description of what needs attention
  detail: string                // Full context (question text, plan content, etc.)
  createdAt: number
  priority: number              // Lower = higher priority
  dismissed?: boolean
}

// --- Resources ---

export interface ResourceStatus {
  cpuPercent: number
  ramPercent: number
  diskPercent: number
  activeAgents: number
  maxAgents: number
  canSpawn: boolean
}

// --- Permissions ---

export interface PermissionProfile {
  name: string
  allowedCommands: string[]
  blockedCommands: string[]
  tools: string[]
}

export interface LearnedCommand {
  command: string
  approvalCount: number
  lastApproved: number
  taskContext: string
}

// --- Prompt Library ---

export interface PromptTemplate {
  id: string                     // e.g. 'implement', 'implement-docker-service'
  mode: RunMode                  // which run mode this belongs to
  label: string                  // display name in dropdown
  description: string            // short description of what this prompt does
  prompt: string                 // template with ${vars}
  defaultProfile: string
  defaultTime: number            // minutes
  defaultModel: string           // "opus" | "sonnet"
  tags: string[]                 // for auto-suggest matching against task "affects"
  extends?: string               // base template ID this builds on (variants only)
  filePath: string               // source file path (for editing)
  layer: 'base' | 'variant' | 'snippet' | 'task-specific'
  hasCustomOverride?: boolean    // true if a custom override exists for this base template
}

export interface PromptSnippet {
  id: string                     // e.g. 'snippet-backup-first'
  label: string                  // checkbox label in spawn dialog
  description: string            // tooltip description
  content: string                // text appended to prompt
  tags: string[]                 // for auto-suggest
  filePath: string               // source file path
}

export interface ModelHint {
  id: string
  provider: ProviderId
  label: string
  description: string
  content: string
  filePath: string
}

export interface PromptLibrary {
  bases: PromptTemplate[]        // Layer 1: base templates (plan, implement, audit, fix)
  variants: PromptTemplate[]     // Layer 2: mode-specific alternatives
  snippets: PromptSnippet[]      // Layer 3: toggleable additions
  taskSpecific: PromptTemplate[] // Layer 4: saved one-off prompts
  modelHints: Map<ProviderId, ModelHint>  // Layer 3.5: per-provider behavioral guidance
}

// --- Prompt Library Metadata (for frontend) ---

export interface PromptTemplateMeta {
  id: string
  mode: RunMode
  label: string
  description: string
  tags: string[]
  defaultProfile: string
  defaultTime: number
  defaultModel: string
  layer: 'base' | 'variant' | 'task-specific'
}

export interface PromptSnippetMeta {
  id: string
  label: string
  description: string
  tags: string[]
}

export interface PromptLibraryMeta {
  templates: PromptTemplateMeta[]
  snippets: PromptSnippetMeta[]
  modelHints: { provider: ProviderId; label: string; description: string }[]
}

export interface PromptTemplateContent {
  mode: RunMode
  label: string
  description: string
  content: string              // Full prompt body (what user edits)
  hasCustomOverride: boolean
  defaultModel: string
  defaultTime: number
  defaultProfile: string
}

// --- Schedules ---

export interface Schedule {
  id: string
  name: string
  cron: string
  prompt: string
  profile: string
  mode: RunMode
  executionMode: ExecutionMode
  model: string
  timeLimit: number
  enabled: boolean
  nextRun: string | null
}

// --- Diff ---

export interface DiffFile { path: string; additions: number; deletions: number; hunks: DiffHunk[] }
export interface DiffHunk { header: string; lines: DiffLine[] }
export interface DiffLine { type: 'add' | 'delete' | 'context'; content: string }
export interface DiffData { agentId: string; branch: string; baseBranch: string; files: DiffFile[]; totalAdditions: number; totalDeletions: number; error?: string }

// --- WebSocket Messages ---

// Runner → Browser
export type ServerMessage =
  | { type: 'tasks'; projectId: string; tasks: Task[] }
  | { type: 'agents'; agents: AgentSession[] }
  | { type: 'queue'; items: QueueItem[] }
  | { type: 'resources'; resources: ResourceStatus }
  | { type: 'terminal_output'; agentId: string; data: string }
  | { type: 'agent_state'; agentId: string; state: AgentState; question?: string }
  | { type: 'projects'; projects: ProjectConfig[] }
  | { type: 'prompt_library'; library: PromptLibraryMeta }
  | { type: 'conversation_history'; agentId: string; history: ConversationEntry[] }
  | { type: 'diff_data'; diff: DiffData }
  | { type: 'verification_report'; agentId: string; report: VerificationReport }
  | { type: 'task_write_error'; projectId: string; message: string }
  | { type: 'plan_content'; taskId: number; content: string | null }
  | { type: 'prompt_templates'; templates: PromptTemplateContent[] }
  | { type: 'project_groups'; groups: ProjectGroup[] }
  | { type: 'scoring_status'; status: 'scoring' | 'complete'; scoredCount?: number }

// Browser → Runner
export type ClientMessage =
  | { type: 'spawn_agent'; taskId: number; projectId: string; runMode: RunMode; executionMode: ExecutionMode; model: string; providerId: ProviderId; profile: string; timeLimit: number; gitBranch: boolean; promptId?: string; snippetIds?: string[]; customPrompt?: string; useModelHints?: boolean }
  | { type: 'agent_input'; agentId: string; input: string }
  | { type: 'stop_agent'; agentId: string }
  | { type: 'nudge_agent'; agentId: string; message: string }
  | { type: 'resume_agent'; agentId: string; additionalContext?: string; timeLimit?: number; fork?: boolean }
  | { type: 'extend_time'; agentId: string; minutes: number }
  | { type: 'resolve_queue_item'; itemId: string; action: string; response?: string }
  | { type: 'switch_project'; projectId: string }
  | { type: 'request_tasks'; projectId: string }
  | { type: 'request_conversation'; agentId: string }
  | { type: 'request_diff'; agentId: string }
  | { type: 'request_plan_content'; taskId: number; projectId: string }
  | { type: 'create_task'; projectId: string; task: TaskDraft }
  | { type: 'update_task'; projectId: string; taskId: number; patch: TaskPatch }
  | { type: 'delete_task'; projectId: string; taskId: number }
  | { type: 'delete_tasks'; projectId: string; taskIds: number[] }
  | { type: 'create_project'; project: ProjectDraft }
  | { type: 'update_project'; projectId: string; patch: ProjectPatch }
  | { type: 'delete_project'; projectId: string }
  | { type: 'clear_completed_agents' }
  | { type: 'request_prompt_templates' }
  | { type: 'save_prompt_template'; mode: RunMode; content: string; model?: string; time?: number; profile?: string }
  | { type: 'reset_prompt_template'; mode: RunMode }
  | { type: 'update_groups'; groups: ProjectGroup[] }
  | { type: 'update_project_weight'; projectId: string; weight: number; reason?: string }
  | { type: 'update_project_weights_batch'; weights: Array<{ projectId: string; weight: number; reason?: string }> }
  | { type: 'rescore_all' }
  | { type: 'rescore_project'; projectId: string }
