// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TaskBoard from '../components/TaskBoard'
import type { Task, ProjectConfig } from '@shared/types'

// Mock dialogs to avoid rendering complexity
vi.mock('../components/SpawnDialog', () => ({ default: () => null }))
vi.mock('../components/TaskEditDialog', () => ({ default: () => null }))

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1, projectId: 'test', name: 'Test Task', emoji: '', category: 'Infra',
    priority: 'MEDIUM', timeEstimate: '30 min', timeMinutes: 30,
    status: 'ready', description: 'desc', planLink: null,
    affects: [], depends: [], bucket: 'ready', score: null,
    ...overrides,
  }
}

const defaultProps = {
  agents: [],
  send: vi.fn(),
  currentProject: 'test',
  promptLibrary: null,
  projects: [{ id: 'test', name: 'Test', todoFile: '', icon: '', active: true }] as ProjectConfig[],
  showAllProjects: false,
  showCreate: false,
  onCloseCreate: vi.fn(),
  queue: [],
  selectionMode: false,
  onExitSelectionMode: vi.fn(),
  onViewTerminal: vi.fn(),
  diffs: {},
  requestDiff: vi.fn(),
}

describe('TaskBoard', () => {
  it('renders bucket headers in correct order', () => {
    const tasks: Task[] = [
      makeTask({ id: 1, name: 'Running Task', bucket: 'running', status: 'in-progress' }),
      makeTask({ id: 2, name: 'Review Task', bucket: 'review', status: 'plan-review' }),
      makeTask({ id: 3, name: 'Ready Task', bucket: 'ready', status: 'ready' }),
      makeTask({ id: 4, name: 'Plan Task', bucket: 'needs-planning', status: 'needs-planning' }),
      makeTask({ id: 5, name: 'Blocked Task', bucket: 'blocked', status: 'blocked' }),
      makeTask({ id: 6, name: 'Done Task', bucket: 'done', status: 'done' }),
    ]
    const { container } = render(<TaskBoard tasks={tasks} {...defaultProps} />)
    const text = container.textContent!
    const runIdx = text.indexOf('Running')
    const revIdx = text.indexOf('Needs Review')
    const readyIdx = text.indexOf('Ready')
    const planIdx = text.indexOf('Needs Planning')
    const blockIdx = text.indexOf('Blocked')
    const doneIdx = text.indexOf('Done', blockIdx + 1)
    expect(runIdx).toBeLessThan(revIdx)
    expect(revIdx).toBeLessThan(readyIdx)
    expect(readyIdx).toBeLessThan(planIdx)
    expect(planIdx).toBeLessThan(blockIdx)
    expect(blockIdx).toBeLessThan(doneIdx)
  })

  it('sorts tasks by priority within a bucket (HIGH first)', () => {
    const tasks: Task[] = [
      makeTask({ id: 1, name: 'Low Task', priority: 'LOW', bucket: 'ready' }),
      makeTask({ id: 2, name: 'High Task', priority: 'HIGH', bucket: 'ready' }),
      makeTask({ id: 3, name: 'Medium Task', priority: 'MEDIUM', bucket: 'ready' }),
    ]
    const { container } = render(<TaskBoard tasks={tasks} {...defaultProps} />)
    const text = container.textContent!
    const highIdx = text.indexOf('High Task')
    const medIdx = text.indexOf('Medium Task')
    const lowIdx = text.indexOf('Low Task')
    expect(highIdx).toBeLessThan(medIdx)
    expect(medIdx).toBeLessThan(lowIdx)
  })

  it('collapses Done bucket by default (only shows count)', () => {
    const tasks: Task[] = [
      makeTask({ id: 1, name: 'Done A', bucket: 'done', status: 'done' }),
      makeTask({ id: 2, name: 'Done B', bucket: 'done', status: 'done' }),
    ]
    render(<TaskBoard tasks={tasks} {...defaultProps} />)
    // Done header with count should be visible
    expect(screen.getByText(/Done/)).toBeInTheDocument()
    expect(screen.getByText('(2)')).toBeInTheDocument()
    // Individual task cards should NOT be rendered (collapsed)
    expect(screen.queryByText('Done A')).not.toBeInTheDocument()
    expect(screen.queryByText('Done B')).not.toBeInTheDocument()
  })

  it('applies search filter without filtersExpanded (Tier 2 regression)', () => {
    const tasks: Task[] = [
      makeTask({ id: 1, name: 'Alpha Task' }),
      makeTask({ id: 2, name: 'Beta Task' }),
      makeTask({ id: 3, name: 'Unique xylophone', description: 'special word xylophone' }),
    ]
    render(
      <TaskBoard
        tasks={tasks}
        {...defaultProps}
        searchText="xylophone"
        filtersExpanded={false}
      />
    )
    expect(screen.getByText('Unique xylophone')).toBeInTheDocument()
    expect(screen.queryByText('Alpha Task')).not.toBeInTheDocument()
    expect(screen.queryByText('Beta Task')).not.toBeInTheDocument()
  })

  it('shows empty state when no tasks exist', () => {
    render(<TaskBoard tasks={[]} {...defaultProps} />)
    expect(screen.getByText('No tasks loaded. Check project configuration.')).toBeInTheDocument()
  })

  it('shows "no match" message when filters exclude everything', () => {
    const tasks: Task[] = [
      makeTask({ id: 1, name: 'Only Task' }),
    ]
    render(
      <TaskBoard
        tasks={tasks}
        {...defaultProps}
        searchText="nonexistent"
        filtersExpanded={false}
      />
    )
    expect(screen.getByText('No tasks match the current filters.')).toBeInTheDocument()
  })

  it('uses the task project when marking done from all-projects view', () => {
    const send = vi.fn()
    render(
      <TaskBoard
        tasks={[makeTask({ id: 7, projectId: 'beta', name: 'Cross Project Task' })]}
        {...defaultProps}
        send={send}
        currentProject="alpha"
        showAllProjects={true}
        projects={[
          { id: 'alpha', name: 'Alpha', todoFile: '', icon: '', active: true },
          { id: 'beta', name: 'Beta', todoFile: '', icon: '', active: true },
        ] as ProjectConfig[]}
      />
    )

    fireEvent.click(screen.getByText('Cross Project Task'))
    fireEvent.click(screen.getByText('···'))
    fireEvent.click(screen.getByTitle('Mark done'))

    expect(send).toHaveBeenCalledWith({
      type: 'update_task',
      projectId: 'beta',
      taskId: 7,
      patch: { status: 'done' },
    })
  })
})
