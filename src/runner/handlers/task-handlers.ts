// src/runner/handlers/task-handlers.ts
import { readFileSync, writeFileSync } from 'fs'
import type { Task, AgentSession, ClientMessage } from '../../shared/types.js'
import { parseTodoFile, deriveTaskBucket, parseTimeMinutes } from '../parser.js'
import { serializeTodoFile } from '../serializer.js'
import type { HandlerContext } from '../handler-context.js'

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
      affects: msg.task.affects ?? [],
      depends: msg.task.depends ?? [],
      bucket: deriveTaskBucket(msg.task.status, timeMinutes),
    }

    const allTasks = [...parsed.tasks, newTask]
    const serialized = serializeTodoFile(content, allTasks, parsed.frontmatter)
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

    const taskIdx = parsed.tasks.findIndex(t => t.id === msg.taskId)
    if (taskIdx === -1) {
      ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Task #${msg.taskId} not found` })
      return
    }

    const task = parsed.tasks[taskIdx]
    if (msg.patch.name !== undefined) task.name = msg.patch.name
    if (msg.patch.emoji !== undefined) task.emoji = msg.patch.emoji
    if (msg.patch.category !== undefined) task.category = msg.patch.category
    if (msg.patch.priority !== undefined) task.priority = msg.patch.priority
    if (msg.patch.timeEstimate !== undefined) {
      task.timeEstimate = msg.patch.timeEstimate
      task.timeMinutes = parseTimeMinutes(msg.patch.timeEstimate)
    }
    if (msg.patch.status !== undefined) task.status = msg.patch.status
    if (msg.patch.description !== undefined) task.description = msg.patch.description
    if (msg.patch.planLink !== undefined) task.planLink = msg.patch.planLink
    if (msg.patch.affects !== undefined) task.affects = msg.patch.affects
    if (msg.patch.depends !== undefined) task.depends = msg.patch.depends

    task.bucket = deriveTaskBucket(task.status, task.timeMinutes)

    const serialized = serializeTodoFile(content, parsed.tasks, parsed.frontmatter)
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

    const remaining = parsed.tasks.filter(t => t.id !== msg.taskId)
    if (remaining.length === parsed.tasks.length) {
      ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Task #${msg.taskId} not found` })
      return
    }

    const serialized = serializeTodoFile(content, remaining, parsed.frontmatter)
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

    const remaining = parsed.tasks.filter(t => !idsToDelete.has(t.id))
    const deletedCount = parsed.tasks.length - remaining.length
    if (deletedCount === 0) {
      ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `No matching tasks found` })
      return
    }

    const serialized = serializeTodoFile(content, remaining, parsed.frontmatter)
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
    const task = parsed.tasks.find(t => t.id === session.taskId)
    if (!task) return
    task.status = status
    task.bucket = deriveTaskBucket(status, task.timeMinutes)
    writeFileSync(project.todoFile, serializeTodoFile(content, parsed.tasks, parsed.frontmatter), 'utf-8')
    ctx.loadTasks()
    ctx.broadcast({ type: 'tasks', projectId: session.projectId, tasks: ctx.tasks.filter(t => t.projectId === session.projectId) })
  } catch (err) {
    console.error(`Failed to set task ${session.taskId} status to ${status}:`, err)
  }
}
