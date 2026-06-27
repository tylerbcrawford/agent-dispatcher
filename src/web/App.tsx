// src/web/App.tsx
import { useState, useEffect, useRef } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import TaskBoard from './components/TaskBoard'
import Terminal from './components/Terminal'
import AddProjectDialog from './components/AddProjectDialog'
import ManageGroupsDialog from './components/ManageGroupsDialog'
import SettingsModal from './components/SettingsModal'
import StatusIndicator from './components/StatusIndicator'
import { HamburgerIcon, CloseIcon, ChevronDownIcon, PlusIcon, SearchIcon, FilterIcon, GearIcon } from './components/icons'
import ProjectPicker from './components/ProjectPicker'
import type { ClientMessage } from '@shared/types'
import type { ViewMode } from './components/TaskBoard'

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null)
  const [showAddProject, setShowAddProject] = useState(false)
  const [showManageGroups, setShowManageGroups] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('bucketed')
  const [projectSort, setProjectSort] = useState<'weight' | 'alpha'>(
    () => (localStorage.getItem('ac_projectSort') as 'weight' | 'alpha') ?? 'weight'
  )
  const menuRef = useRef<HTMLDivElement>(null)
  const { tasks, agents, queue, projects, groups, currentProject, promptLibrary, showAllProjects, switchProject, toggleShowAll, createProject, updateGroups, send, connected, terminalOutput, diffs, requestDiff, planContents, requestPlanContent, taskWriteError, promptTemplates, requestPromptTemplates, scoring, rescoreAll } = useWebSocket()

  const currentProjectConfig = projects.find(p => p.id === currentProject)
  const reviewCount = showAllProjects
    ? queue.filter(i => !i.dismissed).length
    : queue.filter(i => !i.dismissed && i.projectId === currentProject).length

  // Click-outside to close menu
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  // Ctrl+K / Cmd+K to toggle project picker
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setProjectDropdownOpen(prev => !prev)
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-dvh">
      {/* Top bar */}
      <header className="h-12 bg-gray-900 border-b border-gray-700 flex items-center gap-2 px-4 flex-shrink-0 relative z-50">
        {/* Left: hamburger */}
        <div className="flex items-center flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => { setMenuOpen(prev => !prev); setProjectDropdownOpen(false) }}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>

          {/* Hamburger dropdown */}
          {menuOpen && (
            <div className="absolute top-12 left-0 w-full bg-gray-900 border-b border-gray-700 z-50">
              {/* All Projects views */}
              <div className="px-4 py-2 space-y-1">
                <button
                  onClick={() => { if (!showAllProjects) toggleShowAll(); setViewMode('bucketed'); setMenuOpen(false) }}
                  className={`w-full px-3 py-2.5 text-left text-sm rounded transition-colors ${
                    showAllProjects && viewMode === 'bucketed'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
                >
                  All Projects (Bucketed)
                </button>
                <button
                  onClick={() => { if (!showAllProjects) toggleShowAll(); setViewMode('ranked'); setMenuOpen(false) }}
                  className={`w-full px-3 py-2.5 text-left text-sm rounded transition-colors ${
                    showAllProjects && viewMode === 'ranked'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
                >
                  All Projects (Ranked)
                </button>
              </div>

              {/* Project admin */}
              <div className="border-t border-gray-700 px-4 py-2 space-y-1">
                <button
                  onClick={() => { setShowAddProject(true); setMenuOpen(false) }}
                  className="w-full px-3 py-2.5 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 rounded transition-colors"
                >
                  + New Project
                </button>
                <button
                  onClick={() => { setShowManageGroups(true); setMenuOpen(false) }}
                  className="w-full px-3 py-2.5 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 rounded transition-colors flex items-center gap-1"
                >
                  <GearIcon className="w-3 h-3" />
                  Manage Groups
                </button>
              </div>

              {/* Task actions */}
              <div className="border-t border-gray-700 px-4 py-2 space-y-1">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setSearchText('') }}
                    placeholder="Search tasks..."
                    className={`w-full bg-gray-800 border rounded pl-8 pr-8 py-2 text-sm placeholder-gray-500 focus:outline-none transition-colors ${
                      searchText ? 'border-blue-500 text-blue-100' : 'border-gray-600 text-gray-200 focus:border-gray-500'
                    }`}
                  />
                  {searchText && (
                    <button
                      onClick={() => setSearchText('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => { setSelectionMode(true); setMenuOpen(false) }}
                  className="w-full px-3 py-2.5 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 rounded transition-colors"
                >
                  Select Tasks
                </button>
              </div>

              {/* Close terminal link */}
              {activeTerminal && (
                <div className="border-t border-gray-700 px-4 py-2">
                  <button
                    onClick={() => { setActiveTerminal(null); setMenuOpen(false) }}
                    className="w-full px-3 py-2.5 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 rounded transition-colors"
                  >
                    Close Terminal
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center: tappable project switcher trigger — flex-centered between the two clusters so it truncates instead of overlapping them */}
        <div className="flex-1 min-w-0 flex justify-center">
          <button
            data-picker-trigger
            onClick={() => { setProjectDropdownOpen(prev => !prev); if (!projectDropdownOpen) setMenuOpen(false) }}
            className="flex items-center gap-1 font-heading font-bold text-sm hover:text-gray-300 transition-colors truncate min-w-0 max-w-full"
          >
            <span className="truncate">
              {showAllProjects
                ? (viewMode === 'ranked' ? 'Ranked Queue' : 'All Projects')
                : (currentProjectConfig?.name ?? 'Agent Dispatcher')}
            </span>
            <ChevronDownIcon className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ${projectDropdownOpen ? 'rotate-180' : ''}`} />
            {reviewCount > 0 && (
              <span className="text-blue-400 font-normal text-xs ml-0.5 flex-shrink-0">
                · {reviewCount}
              </span>
            )}
          </button>
        </div>

        {/* Full-width project picker panel */}
        <ProjectPicker
          open={projectDropdownOpen}
          projects={projects}
          groups={groups}
          queue={queue}
          currentProject={currentProject}
          showAllProjects={showAllProjects}
          projectSort={projectSort}
          onSelectProject={(id) => { switchProject(id); setProjectDropdownOpen(false) }}
          onSortChange={setProjectSort}
          onClose={() => setProjectDropdownOpen(false)}
        />

        {/* Right: connection status + settings only — task-scoped actions live in the board toolbar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status only surfaces when something's wrong — a healthy connection shows nothing (calm by default) */}
          {!connected && (
            <>
              <StatusIndicator color="text-red-400" pulse />
              <span className="text-xs hidden sm:inline text-red-400">Disconnected</span>
            </>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Settings"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className={`flex-1 overflow-auto p-4 md:p-8 ${activeTerminal ? 'h-1/2' : ''}`}>
          <div className="max-w-3xl mx-auto">
            {/* Board toolbar — task-scoped actions relocated out of the header */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setFiltersExpanded(prev => !prev)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border transition-colors ${
                  filtersExpanded
                    ? 'border-blue-500/50 text-blue-300 bg-blue-950/40'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                }`}
              >
                <FilterIcon />
                Filters
              </button>
              <div className="flex-1" />
              <button
                onClick={rescoreAll}
                disabled={scoring}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-gray-700 transition-colors ${
                  scoring ? 'text-blue-400 cursor-wait' : 'text-gray-400 hover:border-gray-500 hover:text-gray-300'
                }`}
                title={scoring ? 'Scoring...' : 'Rescore all tasks'}
              >
                <svg className={`w-3.5 h-3.5 ${scoring ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rescore
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-blue-500 hover:bg-blue-500/80 text-white transition-colors"
              >
                <PlusIcon />
                New
              </button>
            </div>
            <TaskBoard
              tasks={tasks}
              agents={agents}
              queue={queue}
              send={send}
              currentProject={currentProject}
              promptLibrary={promptLibrary}
              projects={projects}
              showAllProjects={showAllProjects}
              showCreate={showCreate}
              onCloseCreate={() => setShowCreate(false)}
              selectionMode={selectionMode}
              onExitSelectionMode={() => setSelectionMode(false)}
              searchText={searchText}
              filtersExpanded={filtersExpanded}
              onToggleFilters={() => setFiltersExpanded(prev => !prev)}
              planContents={planContents}
              requestPlanContent={requestPlanContent}
              viewMode={showAllProjects ? viewMode : 'bucketed'}
              onViewTerminal={(id) => setActiveTerminal(id)}
              diffs={diffs}
              requestDiff={requestDiff}
            />
          </div>
        </main>

        {/* Error toast */}
        {taskWriteError && (
          <div className="fixed bottom-4 right-4 z-50 bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg max-w-md text-sm">
            {taskWriteError}
          </div>
        )}

        <AddProjectDialog
          open={showAddProject}
          onClose={() => setShowAddProject(false)}
          onCreate={createProject}
        />

        <ManageGroupsDialog
          open={showManageGroups}
          onClose={() => setShowManageGroups(false)}
          groups={groups}
          projects={projects}
          onSave={updateGroups}
        />

        <SettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          templates={promptTemplates}
          requestTemplates={requestPromptTemplates}
          projects={projects}
          scoring={scoring}
          send={send}
        />

        {/* Terminal drawer */}
        {activeTerminal && (
          <div className="h-1/2 max-md:h-2/3 border-t border-gray-700 bg-gray-950">
            <Terminal
              agentId={activeTerminal}
              output={terminalOutput[activeTerminal] ?? ''}
              onInput={(input) => send({ type: 'agent_input', agentId: activeTerminal, input })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
