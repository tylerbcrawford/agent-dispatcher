// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ServerMessage, Task } from '@shared/types'
import { useWebSocket } from '../hooks/useWebSocket'

class MockWebSocket {
  static OPEN = 1
  static instances: MockWebSocket[] = []

  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3
  }

  open() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  receive(msg: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(msg) } as MessageEvent)
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    localStorage.clear()
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('merges single-project task updates while viewing all projects', () => {
    const { result, unmount } = renderHook(() => useWebSocket())
    const ws = MockWebSocket.instances[0]

    const alphaTask: Task = {
      id: 1, projectId: 'alpha', name: 'Alpha Task', emoji: '', category: 'Infra',
      priority: 'MEDIUM', timeEstimate: '30 min', timeMinutes: 30,
      status: 'ready', description: 'alpha', planLink: null,
      affects: [], depends: [], bucket: 'ready', score: null,
    }
    const betaTask: Task = {
      id: 2, projectId: 'beta', name: 'Beta Task', emoji: '', category: 'Infra',
      priority: 'HIGH', timeEstimate: '45 min', timeMinutes: 45,
      status: 'ready', description: 'beta', planLink: null,
      affects: [], depends: [], bucket: 'ready', score: null,
    }

    act(() => {
      ws.open()
      ws.receive({
        type: 'projects',
        projects: [
          { id: 'alpha', name: 'Alpha', todoFile: '', icon: '', active: true, weight: 50, weightReason: '' },
          { id: 'beta', name: 'Beta', todoFile: '', icon: '', active: true, weight: 50, weightReason: '' },
        ],
      })
      ws.receive({ type: 'tasks', projectId: 'alpha', tasks: [alphaTask] })
    })

    act(() => {
      result.current.toggleShowAll()
    })

    act(() => {
      ws.receive({ type: 'tasks', projectId: '__all__', tasks: [alphaTask, betaTask] })
    })

    expect(result.current.tasks).toHaveLength(2)

    act(() => {
      ws.receive({
        type: 'tasks',
        projectId: 'beta',
        tasks: [{ ...betaTask, status: 'done', bucket: 'done' }],
      })
    })

    expect(result.current.tasks).toHaveLength(2)
    expect(result.current.tasks.find(task => task.projectId === 'alpha')?.name).toBe('Alpha Task')
    expect(result.current.tasks.find(task => task.projectId === 'beta')?.status).toBe('done')

    unmount()
  })

  it('ignores malformed (non-JSON) frames without crashing the handler', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result, unmount } = renderHook(() => useWebSocket())
    const ws = MockWebSocket.instances[0]

    const alphaTask: Task = {
      id: 1, projectId: 'alpha', name: 'Alpha Task', emoji: '', category: 'Infra',
      priority: 'MEDIUM', timeEstimate: '30 min', timeMinutes: 30,
      status: 'ready', description: 'alpha', planLink: null,
      affects: [], depends: [], bucket: 'ready', score: null,
    }

    act(() => {
      ws.open()
      ws.receive({
        type: 'projects',
        projects: [{ id: 'alpha', name: 'Alpha', todoFile: '', icon: '', active: true, weight: 50, weightReason: '' }],
      })
    })

    // A malformed frame must not throw out of the message handler
    act(() => {
      ws.onmessage?.({ data: 'not valid json {' } as MessageEvent)
    })
    expect(errSpy).toHaveBeenCalled()

    // A valid message after the bad one still processes normally
    act(() => {
      ws.receive({ type: 'tasks', projectId: 'alpha', tasks: [alphaTask] })
    })
    expect(result.current.tasks).toHaveLength(1)
    expect(result.current.tasks[0].name).toBe('Alpha Task')

    errSpy.mockRestore()
    unmount()
  })
})
