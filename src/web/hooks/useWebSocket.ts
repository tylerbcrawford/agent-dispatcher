// src/web/hooks/useWebSocket.ts
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Task, AgentSession, QueueItem, ProjectConfig, ProjectGroup, ServerMessage, ClientMessage, DiffData, PromptLibraryMeta, PromptTemplateContent, ProjectDraft } from '@shared/types'

export function useWebSocket() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [agents, setAgents] = useState<AgentSession[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [projects, setProjects] = useState<ProjectConfig[]>([])
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [currentProject, setCurrentProject] = useState<string>(() => localStorage.getItem('ac_currentProject') ?? '')
  const [promptLibrary, setPromptLibrary] = useState<PromptLibraryMeta | null>(null)
  const [showAllProjects, setShowAllProjects] = useState(false)
  const [connected, setConnected] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState<Record<string, string>>({})
  const [diffs, setDiffs] = useState<Record<string, DiffData>>({})
  const [planContents, setPlanContents] = useState<Record<number, string | null>>({})
  const [taskWriteError, setTaskWriteError] = useState<string | null>(null)
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplateContent[]>([])
  const [scoring, setScoring] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelay = useRef(1000)
  const prevProjectIdsRef = useRef<Set<string>>(new Set())
  const currentProjectRef = useRef(currentProject)
  const showAllProjectsRef = useRef(showAllProjects)

  useEffect(() => {
    currentProjectRef.current = currentProject
  }, [currentProject])

  useEffect(() => {
    showAllProjectsRef.current = showAllProjects
  }, [showAllProjects])

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      reconnectDelay.current = 1000
    }

    ws.onmessage = (event) => {
      let msg: ServerMessage
      try {
        msg = JSON.parse(event.data)
      } catch (err) {
        if (import.meta.env.DEV) console.error('Failed to parse server message:', err)
        return
      }
      switch (msg.type) {
        case 'tasks':
          if (msg.projectId === '__all__') {
            setTasks(msg.tasks)
            break
          }
          setTasks(prev => {
            if (showAllProjectsRef.current) {
              return [...prev.filter(task => task.projectId !== msg.projectId), ...msg.tasks]
            }
            if (!currentProjectRef.current || currentProjectRef.current === msg.projectId || prev.length === 0) {
              return msg.tasks
            }
            return prev
          })
          break
        case 'agents':
          setAgents(msg.agents)
          break
        case 'queue':
          setQueue(msg.items)
          break
        case 'projects': {
          const prevIds = prevProjectIdsRef.current
          setProjects(msg.projects)
          prevProjectIdsRef.current = new Set(msg.projects.map(p => p.id))
          if (msg.projects.length > 0) {
            const newProject = msg.projects.find(p => !prevIds.has(p.id))
            if (newProject && prevIds.size > 0) {
              // Auto-switch to newly created project
              setCurrentProject(newProject.id)
              setShowAllProjects(false)
              currentProjectRef.current = newProject.id
              showAllProjectsRef.current = false
              localStorage.setItem('ac_currentProject', newProject.id)
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'switch_project', projectId: newProject.id }))
              }
            } else {
              // Resolve current project — validate it still exists in the list
              const stored = localStorage.getItem('ac_currentProject')
              const validStored = stored && msg.projects.some(p => p.id === stored)
              const resolved = validStored ? stored : msg.projects[0].id
              setCurrentProject(resolved)
              currentProjectRef.current = resolved
              localStorage.setItem('ac_currentProject', resolved)
              // Always request tasks to sync sidebar selection with task panel
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'switch_project', projectId: resolved }))
              }
            }
          }
          break
        }
        case 'prompt_library':
          setPromptLibrary(msg.library)
          break
        case 'agent_state':
          setAgents(prev => prev.map(a =>
            a.id === msg.agentId
              ? { ...a, state: msg.state, pendingQuestion: msg.question ?? a.pendingQuestion }
              : a
          ))
          break
        case 'terminal_output':
          setTerminalOutput(prev => ({
            ...prev,
            [msg.agentId]: (prev[msg.agentId] ?? '') + msg.data,
          }))
          break
        case 'conversation_history':
          setAgents(prev => prev.map(a =>
            a.id === msg.agentId ? { ...a, conversationHistory: msg.history } : a
          ))
          break
        case 'diff_data':
          setDiffs(prev => ({ ...prev, [msg.diff.agentId]: msg.diff }))
          break
        case 'plan_content':
          setPlanContents(prev => ({ ...prev, [msg.taskId]: msg.content }))
          break
        case 'verification_report':
          setAgents(prev => prev.map(a =>
            a.id === msg.agentId ? { ...a, verificationReport: msg.report } : a
          ))
          break
        case 'task_write_error':
          setTaskWriteError(msg.message)
          setTimeout(() => setTaskWriteError(null), 5000)
          break
        case 'prompt_templates':
          setPromptTemplates(msg.templates)
          break
        case 'project_groups':
          setGroups(msg.groups)
          break
        case 'scoring_status':
          setScoring(msg.status === 'scoring')
          break
      }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000)
        connect()
      }, reconnectDelay.current)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const requestDiff = useCallback((agentId: string) => {
    send({ type: 'request_diff', agentId })
  }, [send])

  const requestPlanContent = useCallback((taskId: number, projectId: string) => {
    send({ type: 'request_plan_content', taskId, projectId })
  }, [send])

  const switchProject = useCallback((projectId: string) => {
    setCurrentProject(projectId)
    setShowAllProjects(false)
    currentProjectRef.current = projectId
    showAllProjectsRef.current = false
    localStorage.setItem('ac_currentProject', projectId)
    send({ type: 'switch_project', projectId })
  }, [send])

  const toggleShowAll = useCallback(() => {
    setShowAllProjects(prev => {
      const next = !prev
      showAllProjectsRef.current = next
      if (next) {
        send({ type: 'request_tasks', projectId: '__all__' })
      } else {
        send({ type: 'request_tasks', projectId: currentProject })
      }
      return next
    })
  }, [send, currentProject])

  const createProject = useCallback((project: ProjectDraft) => {
    send({ type: 'create_project', project })
  }, [send])

  const requestPromptTemplates = useCallback(() => {
    send({ type: 'request_prompt_templates' })
  }, [send])

  const updateGroups = useCallback((newGroups: ProjectGroup[]) => {
    send({ type: 'update_groups', groups: newGroups })
  }, [send])

  const rescoreAll = useCallback(() => {
    send({ type: 'rescore_all' })
  }, [send])

  return { tasks, agents, queue, projects, groups, currentProject, promptLibrary, showAllProjects, switchProject, toggleShowAll, createProject, updateGroups, send, connected, terminalOutput, diffs, requestDiff, planContents, requestPlanContent, taskWriteError, promptTemplates, requestPromptTemplates, scoring, rescoreAll }
}
