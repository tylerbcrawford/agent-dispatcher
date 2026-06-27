// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TaskFilterBar, { applyFilters, DEFAULT_FILTERS, type TaskFilters } from '../components/TaskFilterBar'
import type { Task } from '@shared/types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1, projectId: 'test', name: 'Test Task', emoji: '', category: 'Infra',
    priority: 'MEDIUM', timeEstimate: '30 min', timeMinutes: 30,
    status: 'ready', description: 'A test task', planLink: null,
    affects: ['docker'], depends: [], bucket: 'ready', score: null,
    ...overrides,
  }
}

const SAMPLE_TASKS: Task[] = [
  makeTask({ id: 1, name: 'Alpha', priority: 'HIGH', bucket: 'ready', category: 'Infra', affects: ['docker'] }),
  makeTask({ id: 2, name: 'Beta', priority: 'LOW', bucket: 'blocked', category: 'Layout', affects: ['nginx'] }),
  makeTask({ id: 3, name: 'Gamma', priority: 'MEDIUM', bucket: 'done', category: 'Infra' }),
  makeTask({ id: 4, name: 'Delta xylophone', priority: 'HIGH', bucket: 'needs-planning', description: 'unique keyword xylophone' }),
]

describe('applyFilters (pure function)', () => {
  it('returns all tasks with default filters', () => {
    expect(applyFilters(SAMPLE_TASKS, DEFAULT_FILTERS)).toHaveLength(4)
  })

  it('filters by searchText on name', () => {
    const filters: TaskFilters = { ...DEFAULT_FILTERS, searchText: 'alpha' }
    const result = applyFilters(SAMPLE_TASKS, filters)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alpha')
  })

  it('filters by searchText on description', () => {
    const filters: TaskFilters = { ...DEFAULT_FILTERS, searchText: 'xylophone' }
    const result = applyFilters(SAMPLE_TASKS, filters)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Delta xylophone')
  })

  it('filters by bucket', () => {
    const filters: TaskFilters = { ...DEFAULT_FILTERS, buckets: ['ready'] }
    const result = applyFilters(SAMPLE_TASKS, filters)
    expect(result).toHaveLength(1)
    expect(result[0].bucket).toBe('ready')
  })

  it('filters by priority', () => {
    const filters: TaskFilters = { ...DEFAULT_FILTERS, priorities: ['HIGH'] }
    const result = applyFilters(SAMPLE_TASKS, filters)
    expect(result).toHaveLength(2)
    expect(result.every(t => t.priority === 'HIGH')).toBe(true)
  })
})

describe('TaskFilterBar component', () => {
  const defaultProps = {
    tasks: SAMPLE_TASKS,
    filters: DEFAULT_FILTERS,
    onChange: vi.fn(),
    onReset: vi.fn(),
    resultCount: 4,
    filtersExpanded: true,
    onToggleFilters: vi.fn(),
  }

  it('renders all filter chips when expanded', () => {
    render(<TaskFilterBar {...defaultProps} />)
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
    expect(screen.getByText('Stage')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('Affects')).toBeInTheDocument()
  })

  it('does not render filter chips when collapsed', () => {
    render(<TaskFilterBar {...defaultProps} filtersExpanded={false} />)
    expect(screen.queryByText('Status')).not.toBeInTheDocument()
    expect(screen.queryByText('Stage')).not.toBeInTheDocument()
  })

  it('opens Stage dropdown and shows all 6 buckets', () => {
    render(<TaskFilterBar {...defaultProps} />)
    fireEvent.click(screen.getByText('Stage'))
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Needs Review')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Needs Planning')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('calls onChange when a Stage bucket is selected', () => {
    const onChange = vi.fn()
    render(<TaskFilterBar {...defaultProps} onChange={onChange} />)
    fireEvent.click(screen.getByText('Stage'))
    fireEvent.click(screen.getByText('Ready'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      buckets: ['ready'],
    }))
  })

  it('shows active count and Reset when filters are active', () => {
    const activeFilters: TaskFilters = { ...DEFAULT_FILTERS, priorities: ['HIGH'] }
    render(<TaskFilterBar {...defaultProps} filters={activeFilters} resultCount={2} />)
    expect(screen.getByText('1 active')).toBeInTheDocument()
    expect(screen.getByText('Reset')).toBeInTheDocument()
    expect(screen.getByText('2/4')).toBeInTheDocument()
  })
})
