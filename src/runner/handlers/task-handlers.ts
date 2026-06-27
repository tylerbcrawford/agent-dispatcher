// src/runner/handlers/task-handlers.ts
import { readFileSync, writeFileSync } from 'fs'
import type { Task, AgentSession, ClientMessage } from '../../shared/types.js'
import { parseTodoFile, deriveTaskBucket, parseTimeMinutes } from '../parser.js'
import { updateTaskInContent, insertTaskIntoContent, removeTaskFromContent, type TaskPatch } from '../task-editor.js'
import type { HandlerContext } from '../handler-context.js'

// NOTE: all writes go through the surgical task-editor (updateTaskInContent / insertTaskIntoContent
// / removeTaskFromContent), NOT serializeTodoFile. The serializer reconstructs the whole file from
// the lossy parsed model and would strip **Source:**/**Result:**/**Update:** lines, tables, and
// multi-paragraph descriptions. The surgical editor touches only the changed task's field lines.
// `description` and `category` are intentionally NOT forwarded to the editor — they are vault-authoring
// concerns (agent-prompt bodies / section grouping) edited in the vault, not surgically persisted here.

export function handleCreateTask(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'create_task' }>) {
  const project = ctx.registry.projects.find(p => p.id === msg.projectId)
  if (!project) {
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Project ${msg.projectId} not found` })
    return
  }

  try {
    const content = readFileSync(project.todoFile, 'utf-8')
    const parsed = parseTodoFile(content)

    const maxId = parsed.tasks.length > 0 ? Math.max(...parsed.tasks.map(t => t.id)) : 0
    const newId = maxId + 1

    const timeMinutes = parseTimeMinutes(msg.task.timeEstimate)
    const newTask: Task = {
      id: newId,
      projectId: msg.projectId,
      name: msg.task.name,
      emoji: msg.task.emoji,
      category: msg.task.category,
      priority: msg.task.priority,
      timeEstimate: msg.task.timeEstimate,
      timeMinutes,
      status: msg.task.status,
      description: msg.task.description,
      planLink: msg.task.planLink ?? null,
      hasPlan: false,
      affects: msg.task.affects ?? [],
      depends: msg.task.depends ?? [],
      bucket: deriveTaskBucket(msg.task.status, timeMinutes),
      score: null,
    }

    const serialized = insertTaskIntoContent(content, newTask)
    writeFileSync(project.todoFile, serialized, 'utf-8')

    ctx.loadTasks()
    ctx.broadcast({ type: 'tasks', projectId: msg.projectId, tasks: ctx.tasks.filter(t => t.projectId === msg.projectId) })
    console.log(`Created task #${newId}: ${msg.task.name} in ${msg.projectId}`)
  } catch (err) {
    console.error('Failed to create task:', err)
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Failed to create task: ${err}` })
  }
}

export function handleUpdateTask(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'update_task' }>) {
  const project = ctx.registry.projects.find(p => p.id === msg.projectId)
  if (!project) {
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Project ${msg.projectId} not found` })
    return
  }

  try {
    const content = readFileSync(project.todoFile, 'utf-8')
    const parsed = parseTodoFile(content)

    if (!parsed.tasks.some(t => t.id === msg.taskId)) {
      ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Task #${msg.taskId} not found` })
      return
    }

    const patch: TaskPatch = {}
    if (msg.patch.name !== undefined) patch.name = msg.patch.name
    if (msg.patch.emoji !== undefined) patch.emoji = msg.patch.emoji
    if (msg.patch.priority !== undefined) patch.priority = msg.patch.priority
    if (msg.patch.timeEstimate !== undefined) patch.timeEstimate = msg.patch.timeEstimate
    if (msg.patch.status !== undefined) patch.status = msg.patch.status
    if (msg.patch.planLink !== undefined) patch.planLink = msg.patch.planLink
    if (msg.patch.affects !== undefined) patch.affects = msg.patch.affects
    if (msg.patch.depends !== undefined) patch.depends = msg.patch.depends

    const serialized = updateTaskInContent(content, msg.taskId, patch)
    writeFileSync(project.todoFile, serialized, 'utf-8')

    ctx.loadTasks()
    ctx.broadcast({ type: 'tasks', projectId: msg.projectId, tasks: ctx.tasks.filter(t => t.projectId === msg.projectId) })
    console.log(`Updated task #${msg.taskId} in ${msg.projectId}`)
  } catch (err) {
    console.error('Failed to update task:', err)
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Failed to update task: ${err}` })
  }
}

export function handleDeleteTask(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'delete_task' }>) {
  const project = ctx.registry.projects.find(p => p.id === msg.projectId)
  if (!project) {
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Project ${msg.projectId} not found` })
    return
  }

  try {
    const content = readFileSync(project.todoFile, 'utf-8')
    const parsed = parseTodoFile(content)

    if (!parsed.tasks.some(t => t.id === msg.taskId)) {
      ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Task #${msg.taskId} not found` })
      return
    }

    const serialized = removeTaskFromContent(content, msg.taskId)
    writeFileSync(project.todoFile, serialized, 'utf-8')

    ctx.loadTasks()
    ctx.broadcast({ type: 'tasks', projectId: msg.projectId, tasks: ctx.tasks.filter(t => t.projectId === msg.projectId) })
    console.log(`Deleted task #${msg.taskId} from ${msg.projectId}`)
  } catch (err) {
    console.error('Failed to delete task:', err)
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Failed to delete task: ${err}` })
  }
}

export function handleDeleteTasks(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'delete_tasks' }>) {
  const project = ctx.registry.projects.find(p => p.id === msg.projectId)
  if (!project) {
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Project ${msg.projectId} not found` })
    return
  }

  try {
    const content = readFileSync(project.todoFile, 'utf-8')
    const parsed = parseTodoFile(content)
    const idsToDelete = new Set(msg.taskIds)

    let serialized = content
    let deletedCount = 0
    for (const task of parsed.tasks) {
      if (idsToDelete.has(task.id)) {
        serialized = removeTaskFromContent(serialized, task.id)
        deletedCount++
      }
    }
    if (deletedCount === 0) {
      ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `No matching tasks found` })
      return
    }

    writeFileSync(project.todoFile, serialized, 'utf-8')

    ctx.loadTasks()
    ctx.broadcast({ type: 'tasks', projectId: msg.projectId, tasks: ctx.tasks.filter(t => t.projectId === msg.projectId) })
    console.log(`Deleted ${deletedCount} tasks from ${msg.projectId}: ${msg.taskIds.join(', ')}`)
  } catch (err) {
    console.error('Failed to delete tasks:', err)
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Failed to delete tasks: ${err}` })
  }
}

/** Update a task's status from an agent session context (used by agent signal handlers) */
export function setTaskStatus(ctx: HandlerContext, session: AgentSession, status: Task['status']) {
  const project = ctx.registry.projects.find(p => p.id === session.projectId)
  if (!project) return
  try {
    const content = readFileSync(project.todoFile, 'utf-8')
    const parsed = parseTodoFile(content)
    if (!parsed.tasks.some(t => t.id === session.taskId)) return
    const serialized = updateTaskInContent(content, session.taskId, { status })
    writeFileSync(project.todoFile, serialized, 'utf-8')
    ctx.loadTasks()
    ctx.broadcast({ type: 'tasks', projectId: session.projectId, tasks: ctx.tasks.filter(t => t.projectId === session.projectId) })
  } catch (err) {
    console.error(`Failed to set task ${session.taskId} status to ${status}:`, err)
  }
}
