// src/web/components/TaskEditDialog.tsx
import { useState } from 'react'
import type { Task, TaskStatus, Priority, ClientMessage } from '@shared/types'
import { chipClass } from './styles'

interface Props {
  task: Task | null
  categories: string[]
  projectId: string
  send: (msg: ClientMessage) => void
  onClose: () => void
}

const ALL_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'needs-planning', label: 'Needs Planning' },
  { value: 'plan-review', label: 'Plan Review' },
  { value: 'ready', label: 'Ready' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'in-review', label: 'In Review' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'manual', label: 'Manual' },
]

const ALL_PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
]

export default function TaskEditDialog({ task, categories, projectId, send, onClose }: Props) {
  const isEdit = task !== null

  const [name, setName] = useState(task?.name ?? '')
  const [category, setCategory] = useState(task?.category ?? (categories[0] ?? ''))
  const [newCategory, setNewCategory] = useState('')
  const [useNewCategory, setUseNewCategory] = useState(false)
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'MEDIUM')
  const [timeEstimate, setTimeEstimate] = useState(task?.timeEstimate ?? '30 min')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'needs-planning')
  const [description, setDescription] = useState(task?.description ?? '')
  const [planLink, setPlanLink] = useState(task?.planLink ?? '')
  const [affects, setAffects] = useState(task?.affects?.join(', ') ?? '')
  const [depends, setDepends] = useState(task?.depends?.join(', ') ?? '')

  // Auto-expand secondary fields if any have non-default values (edit mode)
  const hasSecondaryValues = isEdit && (
    timeEstimate !== '30 min' ||
    status !== 'needs-planning' ||
    planLink !== '' ||
    affects !== '' ||
    depends !== ''
  )
  const [showMore, setShowMore] = useState(hasSecondaryValues)

  function handleSave() {
    const resolvedCategory = useNewCategory ? newCategory.trim() : category
    if (!name.trim() || !resolvedCategory) return

    const parsedDepends = depends
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n))

    const parsedAffects = affects
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)

    if (isEdit) {
      send({
        type: 'update_task',
        projectId,
        taskId: task.id,
        patch: {
          name: name.trim(),
          emoji: '',
          category: resolvedCategory,
          priority,
          timeEstimate: timeEstimate.trim() || '30 min',
          status,
          description: description.trim(),
          planLink: planLink.trim() || null,
          affects: parsedAffects,
          depends: parsedDepends,
        },
      })
    } else {
      send({
        type: 'create_task',
        projectId,
        task: {
          name: name.trim(),
          emoji: '',
          category: resolvedCategory,
          priority,
          timeEstimate: timeEstimate.trim() || '30 min',
          status,
          description: description.trim(),
          planLink: planLink.trim() || null,
          affects: parsedAffects,
          depends: parsedDepends,
        },
      })
    }
    onClose()
  }

  const chip = chipClass

  const inputCls = 'w-full bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500/50 transition-colors'
  const label = 'text-xs text-gray-600 mb-1.5'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg flex flex-col max-h-[90vh] max-md:rounded-none max-md:border-0 max-md:max-w-none max-md:max-h-none max-md:h-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <h3 className="text-sm font-medium text-gray-200">
            {isEdit ? `Edit Task #${task.id}` : 'New Task'}
          </h3>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Name */}
          <div>
            <p className={label}>Name</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Task name"
              className={inputCls}
            />
          </div>

          {/* Prompt — prominent, right after name */}
          <div>
            <p className={label}>Prompt</p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Agent prompt — what should the agent do?"
              rows={4}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-gray-100 resize-y placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* Category + Priority */}
          <div className="border-t border-gray-800 pt-4 space-y-4">
            <div>
              <p className={label}>Category</p>
              {!useNewCategory ? (
                <div className="flex gap-1">
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500/50 transition-colors"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setUseNewCategory(true)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-2 py-1.5 rounded transition-colors whitespace-nowrap"
                  >
                    New...
                  </button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="New category"
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500/50 transition-colors"
                    autoFocus
                  />
                  <button
                    onClick={() => setUseNewCategory(false)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-2 py-1.5 rounded transition-colors"
                  >
                    Back
                  </button>
                </div>
              )}
            </div>
            <div>
              <p className={label}>Priority</p>
              <div className="flex gap-1.5">
                {ALL_PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${chip(priority === p.value)}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* More toggle — secondary fields */}
          <div className="border-t border-gray-800 pt-3">
            <button
              onClick={() => setShowMore(prev => !prev)}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors mx-auto block"
            >
              {showMore ? '− Less' : '+ More'}
            </button>

            {showMore && (
              <div className="mt-3 space-y-4">
                {/* Time + Status */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className={label}>Time</p>
                    <input
                      type="text"
                      value={timeEstimate}
                      onChange={e => setTimeEstimate(e.target.value)}
                      placeholder="30 min"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex-1">
                    <p className={label}>Status</p>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as TaskStatus)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500/50 transition-colors"
                    >
                      {ALL_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Plan link */}
                <div>
                  <p className={label}>Plan link</p>
                  <input
                    type="text"
                    value={planLink}
                    onChange={e => setPlanLink(e.target.value)}
                    placeholder="Wiki-link path (optional)"
                    className={inputCls}
                  />
                </div>

                {/* Affects + Depends */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className={label}>Affects</p>
                    <input
                      type="text"
                      value={affects}
                      onChange={e => setAffects(e.target.value)}
                      placeholder="Comma-separated"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex-1">
                    <p className={label}>Depends</p>
                    <input
                      type="text"
                      value={depends}
                      onChange={e => setDepends(e.target.value)}
                      placeholder="IDs, comma-separated"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-2 px-5 py-4 border-t border-gray-800 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={!name.trim() || (!category && !newCategory.trim())}
            className="px-6 py-1.5 text-xs rounded-full border border-blue-500/40 text-blue-300 hover:bg-blue-900/20 hover:border-blue-500/70 disabled:border-gray-700 disabled:text-gray-600 transition-colors"
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
          <button
            onClick={onClose}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
