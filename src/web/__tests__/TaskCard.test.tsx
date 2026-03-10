// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TaskCard from '../components/TaskCard'
import type { Task, AgentSession, ClientMessage } from '@shared/types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1, projectId: 'test', name: 'Test Task', emoji: '', category: 'Infra',
    priority: 'HIGH', timeEstimate: '45 min', timeMinutes: 45,
    status: 'ready', description: 'A sample description', planLink: null,
    affects: ['docker', 'nginx'], depends: [], bucket: 'ready',
    ...overrides,
  }
}

const defaultPreferences = {
  plan:      { model: 'haiku',  providerId: 'claude' as const, profile: 'read-only' },
  implement: { model: 'haiku',  providerId: 'claude' as const, profile: 'standard' },
  audit:     { model: 'haiku',  providerId: 'claude' as const, profile: 'read-only' },
  fix:       { model: 'haiku',  providerId: 'claude' as const, profile: 'standard' },
}

const defaultProps = {
  activeAgent: null,
  onSpawn: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onMarkDone: vi.fn(),
  send: vi.fn(),
  expanded: false,
  onToggle: vi.fn(),
  preferences: defaultPreferences,
}

describe('TaskCard', () => {
  it('renders task name in collapsed state', () => {
    render(<TaskCard task={makeTask()} {...defaultProps} />)
    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })

  it('shows priority, time, and category when expanded', () => {
    render(<TaskCard task={makeTask()} {...defaultProps} expanded={true} />)
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('45 min')).toBeInTheDocument()
    expect(screen.getByText('Infra')).toBeInTheDocument()
  })

  it('renders affects tags when expanded', () => {
    render(<TaskCard task={makeTask()} {...defaultProps} expanded={true} />)
    expect(screen.getByText('docker')).toBeInTheDocument()
    expect(screen.getByText('nginx')).toBeInTheDocument()
  })

  it('shows Launch button for ready tasks when expanded', () => {
    render(<TaskCard task={makeTask({ status: 'ready' })} {...defaultProps} expanded={true} />)
    expect(screen.getByText('Launch')).toBeInTheDocument()
  })

  it('shows Plan button for needs-planning tasks when expanded', () => {
    render(<TaskCard task={makeTask({ status: 'needs-planning', bucket: 'needs-planning' })} {...defaultProps} expanded={true} />)
    expect(screen.getByText('Plan')).toBeInTheDocument()
  })

  it('shows checkbox in selection mode', () => {
    render(
      <TaskCard
        task={makeTask()}
        {...defaultProps}
        selectionMode={true}
        selected={false}
        onToggleSelect={vi.fn()}
      />
    )
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('checkbox reflects selected state', () => {
    render(
      <TaskCard
        task={makeTask()}
        {...defaultProps}
        selectionMode={true}
        selected={true}
        onToggleSelect={vi.fn()}
      />
    )
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('calls onToggle when header is clicked', () => {
    const onToggle = vi.fn()
    render(<TaskCard task={makeTask()} {...defaultProps} onToggle={onToggle} />)
    fireEvent.click(screen.getByText('Test Task'))
    expect(onToggle).toHaveBeenCalled()
  })

  it('renders description when expanded', () => {
    render(<TaskCard task={makeTask()} {...defaultProps} expanded={true} />)
    expect(screen.getByText('A sample description')).toBeInTheDocument()
  })

  it('does not call onToggle when a button inside the card is clicked', () => {
    const onToggle = vi.fn()
    const send = vi.fn()
    render(
      <TaskCard
        task={makeTask({ status: 'ready' })}
        {...defaultProps}
        send={send}
        onToggle={onToggle}
        expanded={true}
      />
    )
    fireEvent.click(screen.getByText('Launch'))
    expect(send).toHaveBeenCalled()
    expect(onToggle).not.toHaveBeenCalled()
  })

  describe('Quick Launch', () => {
    it('sends spawn_agent with implement defaults when Launch is clicked', () => {
      const send = vi.fn()
      render(
        <TaskCard
          task={makeTask({ status: 'ready', projectId: 'mediaserver' })}
          {...defaultProps}
          send={send}
          expanded={true}
        />
      )
      fireEvent.click(screen.getByText('Launch'))
      expect(send).toHaveBeenCalledWith(expect.objectContaining({
        type: 'spawn_agent',
        taskId: 1,
        projectId: 'mediaserver',
        runMode: 'implement',
        model: 'haiku',
        providerId: 'claude',
        profile: 'standard',
        timeLimit: 60,
        executionMode: 'single',
        gitBranch: true,
      }))
    })

    it('sends spawn_agent with plan defaults when Plan is clicked', () => {
      const send = vi.fn()
      render(
        <TaskCard
          task={makeTask({ status: 'needs-planning', bucket: 'needs-planning', projectId: 'mediaserver' })}
          {...defaultProps}
          send={send}
          expanded={true}
        />
      )
      fireEvent.click(screen.getByText('Plan'))
      expect(send).toHaveBeenCalledWith(expect.objectContaining({
        type: 'spawn_agent',
        taskId: 1,
        projectId: 'mediaserver',
        runMode: 'plan',
        model: 'haiku',
        providerId: 'claude',
        profile: 'read-only',
        timeLimit: 30,
        executionMode: 'single',
        gitBranch: false,
      }))
    })

    it('shows gear icon that opens SpawnDialog via onSpawn', () => {
      const onSpawn = vi.fn()
      render(
        <TaskCard
          task={makeTask({ status: 'ready' })}
          {...defaultProps}
          onSpawn={onSpawn}
          expanded={true}
        />
      )
      const gearButton = screen.getByTitle('Customize launch')
      fireEvent.click(gearButton)
      expect(onSpawn).toHaveBeenCalledWith('implement')
    })
  })
})

function makeAgent(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 'agent-1',
    providerId: 'claude',
    providerSessionId: null,
    displayName: '1-test-task-implement-01',
    taskId: 1,
    taskName: 'Test Task',
    projectId: 'test',
    state: 'running',
    executionMode: 'single',
    runMode: 'implement',
    model: 'sonnet',
    permissionProfile: 'standard',
    timeLimit: 60,
    startedAt: Date.now(),
    suspendedAt: null,
    lastOutputAt: Date.now(),
    timeSpent: 5,
    resumeCount: 0,
    lastOutput: '',
    pendingQuestion: null,
    gitBranch: null,
    conversationHistory: [],
    originalTaskContext: null,
    verificationReport: null,
    ...overrides,
  }
}

describe('Inline Agent Controls', () => {
  it('shows Stop button when agent is running', () => {
    render(
      <TaskCard
        task={makeTask()}
        {...defaultProps}
        activeAgent={makeAgent({ state: 'running' })}
        expanded={true}
      />
    )
    expect(screen.getByText('Stop')).toBeInTheDocument()
  })

  it('sends stop_agent when Stop is clicked', () => {
    const send = vi.fn()
    render(
      <TaskCard
        task={makeTask()}
        {...defaultProps}
        send={send}
        activeAgent={makeAgent({ state: 'running', id: 'agent-42' })}
        expanded={true}
      />
    )
    fireEvent.click(screen.getByText('Stop'))
    expect(send).toHaveBeenCalledWith({ type: 'stop_agent', agentId: 'agent-42' })
  })

  it('shows reply input when agent is waiting with conversation', () => {
    render(
      <TaskCard
        task={makeTask()}
        {...defaultProps}
        activeAgent={makeAgent({
          state: 'waiting',
          conversationHistory: [
            { role: 'agent', content: 'What port should I use?', timestamp: Date.now(), metadata: { signal: 'question_heuristic' } },
          ],
        })}
        expanded={true}
      />
    )
    expect(screen.getByPlaceholderText(/Type response/)).toBeInTheDocument()
  })

  it('shows Nudge button when agent is stalled', () => {
    render(
      <TaskCard
        task={makeTask()}
        {...defaultProps}
        activeAgent={makeAgent({ state: 'stalled' })}
        expanded={true}
      />
    )
    expect(screen.getByText('Nudge')).toBeInTheDocument()
  })

  it('shows Mark Done when agent is completed', () => {
    render(
      <TaskCard
        task={makeTask()}
        {...defaultProps}
        activeAgent={makeAgent({ state: 'completed' })}
        expanded={true}
      />
    )
    expect(screen.getByText('Mark Done')).toBeInTheDocument()
  })

  it('shows Terminal link for active agents when onViewTerminal is provided', () => {
    const onViewTerminal = vi.fn()
    render(
      <TaskCard
        task={makeTask()}
        {...defaultProps}
        activeAgent={makeAgent({ state: 'running', id: 'agent-99' })}
        onViewTerminal={onViewTerminal}
        expanded={true}
      />
    )
    fireEvent.click(screen.getByText('Terminal'))
    expect(onViewTerminal).toHaveBeenCalledWith('agent-99')
  })

  it('shows Details link that navigates to agents view', () => {
    const onNavigateAgents = vi.fn()
    render(
      <TaskCard
        task={makeTask()}
        {...defaultProps}
        activeAgent={makeAgent({ state: 'running' })}
        onNavigateAgents={onNavigateAgents}
        expanded={true}
      />
    )
    fireEvent.click(screen.getByText('Details'))
    expect(onNavigateAgents).toHaveBeenCalled()
  })
})
