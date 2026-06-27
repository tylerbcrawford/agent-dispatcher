// src/runner/handlers/project-handlers.ts
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import type { ClientMessage, ProjectGroup } from '../../shared/types.js'
import { config, saveProjectRegistry } from '../config.js'
import type { HandlerContext } from '../handler-context.js'

function toKebabCase(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function handleCreateProject(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'create_project' }>) {
  const { name, icon, description, defaultCwd, claudeMd } = msg.project

  if (!name.trim()) {
    ctx.broadcast({ type: 'task_write_error', projectId: '', message: 'Project name cannot be empty' })
    return
  }

  const id = toKebabCase(name)
  if (!id) {
    ctx.broadcast({ type: 'task_write_error', projectId: '', message: 'Could not derive a valid ID from project name' })
    return
  }

  if (ctx.registry.projects.some(p => p.id === id)) {
    ctx.broadcast({ type: 'task_write_error', projectId: id, message: `Project "${id}" already exists` })
    return
  }

  const vaultProjectDir = `${config.vaultPath}/projects/${id}`
  const todoFilePath = `${vaultProjectDir}/todo-${id}.md`
  const projectCwd = defaultCwd || vaultProjectDir
  const projectClaudeMd = claudeMd || `${config.vaultPath}/CLAUDE.md`
  const projectDescription = description || name
  const today = new Date().toISOString().split('T')[0]

  try {
    if (!existsSync(vaultProjectDir)) {
      mkdirSync(vaultProjectDir, { recursive: true })
    }

    if (!existsSync(todoFilePath)) {
      const todoContent = [
        '---',
        `project: ${id}`,
        `description: ${projectDescription}`,
        `default-cwd: ${projectCwd}`,
        `claude-md: ${projectClaudeMd}`,
        '---',
        '',
        `# Todo — ${name}`,
        '',
        `**Last Updated:** ${today}`,
        '**Status:** Active tracking document',
        '',
        '---',
        '',
        '## Tasks',
        '',
        '(No tasks yet — add them from the dashboard or edit this file directly.)',
        '',
      ].join('\n')
      writeFileSync(todoFilePath, todoContent, 'utf-8')
    }

    ctx.registry.projects.push({
      id,
      name: name.trim(),
      todoFile: todoFilePath,
      icon: icon || '\u{1F4C1}',
      active: true,
      weight: 50,
      weightReason: '',
    })
    saveProjectRegistry(ctx.registry)

    ctx.loadTasks()
    ctx.broadcast({ type: 'projects', projects: ctx.registry.projects })
    console.log(`Created project: ${name} (${id})`)
  } catch (err) {
    console.error('Failed to create project:', err)
    ctx.broadcast({ type: 'task_write_error', projectId: id, message: `Failed to create project: ${err}` })
  }
}

export function handleUpdateProject(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'update_project' }>) {
  const project = ctx.registry.projects.find(p => p.id === msg.projectId)
  if (!project) {
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Project ${msg.projectId} not found` })
    return
  }

  try {
    if (msg.patch.name !== undefined) project.name = msg.patch.name
    if (msg.patch.icon !== undefined) project.icon = msg.patch.icon
    if (msg.patch.active !== undefined) project.active = msg.patch.active

    saveProjectRegistry(ctx.registry)
    ctx.loadTasks()
    ctx.broadcast({ type: 'projects', projects: ctx.registry.projects })
    console.log(`Updated project: ${msg.projectId}`)
  } catch (err) {
    console.error('Failed to update project:', err)
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Failed to update project: ${err}` })
  }
}

export function handleDeleteProject(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'delete_project' }>) {
  const project = ctx.registry.projects.find(p => p.id === msg.projectId)
  if (!project) {
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Project ${msg.projectId} not found` })
    return
  }

  try {
    // Soft delete — set inactive, don't remove files
    project.active = false

    // Remove from any group's projectIds
    if (ctx.registry.groups) {
      for (const group of ctx.registry.groups) {
        group.projectIds = group.projectIds.filter(id => id !== msg.projectId)
      }
    }

    saveProjectRegistry(ctx.registry)
    ctx.loadTasks()
    ctx.broadcast({ type: 'projects', projects: ctx.registry.projects })
    ctx.broadcast({ type: 'project_groups', groups: ctx.registry.groups ?? [] })
    console.log(`Deactivated project: ${msg.projectId}`)
  } catch (err) {
    console.error('Failed to delete project:', err)
    ctx.broadcast({ type: 'task_write_error', projectId: msg.projectId, message: `Failed to delete project: ${err}` })
  }
}

export function handleUpdateGroups(ctx: HandlerContext, msg: Extract<ClientMessage, { type: 'update_groups' }>) {
  const validProjectIds = new Set(ctx.registry.projects.map(p => p.id))

  // Validate and deduplicate: each project can only appear in one group
  const seen = new Set<string>()
  const cleanedGroups: ProjectGroup[] = msg.groups.map(group => ({
    ...group,
    projectIds: group.projectIds.filter(id => {
      if (!validProjectIds.has(id) || seen.has(id)) return false
      seen.add(id)
      return true
    }),
  }))

  try {
    ctx.registry.groups = cleanedGroups
    saveProjectRegistry(ctx.registry)
    ctx.broadcast({ type: 'project_groups', groups: cleanedGroups })
    console.log(`Updated project groups: ${cleanedGroups.length} groups`)
  } catch (err) {
    console.error('Failed to update groups:', err)
    ctx.broadcast({ type: 'task_write_error', projectId: '', message: `Failed to update groups: ${err}` })
  }
}
