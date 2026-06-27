// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TaskCard from '../components/TaskCard'
import type { Task } from '@shared/types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1, projectId: 'test', name: 'Test Task', emoji: '', category: 'Infra',
    priority: 'HIGH', timeEstimate: '45 min', timeMinutes: 45,
    status: 'ready', description: 'A sample description', planLink: null,
    affects: ['docker', 'nginx'], depends: [], bucket: 'ready', score: null,
    ...overrides,
  }
}

const defaultProps = {
  agent: null,
  onSpawn: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onMarkDone: vi.fn(),
  onRestore: vi.fn(),
  expanded: false,
  onToggle: vi.fn(),
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

  it('shows restore action for done tasks', () => {
    render(<TaskCard task={makeTask({ status: 'done', bucket: 'done' })} {...defaultProps} expanded={true} />)
    fireEvent.click(screen.getByText('···'))
    expect(screen.getByTitle('Restore to ready')).toBeInTheDocument()
  })
})
