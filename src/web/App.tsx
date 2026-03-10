// src/web/App.tsx
import { useState, useEffect, useRef } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import TaskBoard from './components/TaskBoard'
import AgentPanel from './components/AgentPanel'
import HumanWorkQueue from './components/HumanWorkQueue'
import PromptsPage from './components/PromptsPage'
import Terminal from './components/Terminal'
import AddProjectDialog from './components/AddProjectDialog'
import StatusIndicator from './components/StatusIndicator'
import SettingsDialog from './components/SettingsDialog'
import { HamburgerIcon, CloseIcon, ChevronDownIcon, PlusIcon, SearchIcon, FilterIcon } from './components/icons'
import { usePreferences } from './hooks/usePreferences'
import type { ClientMessage } from '@shared/types'

type View = 'tasks' | 'agents' | 'queue' | 'prompts'

export default function App() {
  const [view, setView] = useState<View>('tasks')
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null)
  const [showAddProject, setShowAddProject] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const projectDropdownRef = useRef<HTMLDivElement>(null)
  const { tasks, agents, queue, projects, currentProject, promptLibrary, showAllProjects, switchProject, toggleShowAll, createProject, send, connected, terminalOutput, diffs, requestDiff, planContents, requestPlanContent, taskWriteError, promptTemplates, requestPromptTemplates } = useWebSocket()
  const { defaults: preferences, updateDefaults: updatePreferences } = usePreferences()

  const navItems: { id: View; label: string; badge?: number }[] = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'agents', label: 'Agents', badge: agents.filter(a => a.state === 'running').length || undefined },
    { id: 'queue', label: 'Queue', badge: queue.filter(i => !i.dismissed).length || undefined },
    { id: 'prompts', label: 'Prompts' },
  ]

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

  // Click-outside to close project dropdown
  useEffect(() => {
    if (!projectDropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [projectDropdownOpen])

  return (
    <div className="flex flex-col h-dvh">
      {/* Top bar */}
      <header className="h-12 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-4 flex-shrink-0 relative z-50">
        {/* Left: hamburger */}
        <div className="flex items-center" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(prev => !prev)}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>

          {/* Hamburger dropdown */}
          {menuOpen && (
            <div className="absolute top-12 left-0 w-full bg-gray-900 border-b border-gray-700 shadow-lg z-50">
              {/* Nav items — text only */}
              <div className="px-4 py-2">
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setView(item.id); setMenuOpen(false) }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded transition-colors text-sm ${
                      view === item.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="bg-blue-600 text-xs px-1.5 py-0.5 rounded text-white">{item.badge}</span>
                    ) : null}
                  </button>
                ))}
              </div>

              {/* Task actions */}
              {view === 'tasks' && (
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
              )}

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

              {/* Settings */}
              <div className="border-t border-gray-700 px-4 py-2">
                <button
                  onClick={() => { setShowSettings(true); setMenuOpen(false) }}
                  className="w-full px-3 py-2.5 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 rounded transition-colors"
                >
                  Settings
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center: tappable project switcher dropdown */}
        <div ref={projectDropdownRef} className="absolute left-1/2 -translate-x-1/2 max-w-[60%]">
          <button
            onClick={() => setProjectDropdownOpen(prev => !prev)}
            className="flex items-center gap-1 font-heading font-bold text-sm hover:text-gray-300 transition-colors truncate"
          >
            <span className="truncate">
              {showAllProjects ? 'All Projects' : (currentProjectConfig?.name ?? 'Agent Dispatcher')}
            </span>
            <ChevronDownIcon className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ${projectDropdownOpen ? 'rotate-180' : ''}`} />
            {reviewCount > 0 && (
              <span className="text-blue-400 font-normal text-xs ml-0.5 flex-shrink-0">
                · {reviewCount}
              </span>
            )}
          </button>

          {projectDropdownOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 min-w-[200px] py-1">
              {/* Project list */}
              {projects.map(p => {
                const projectQueueCount = queue.filter(i => !i.dismissed && i.projectId === p.id).length
                return (
                  <button
                    key={p.id}
                    onClick={() => { switchProject(p.id); setProjectDropdownOpen(false) }}
                    className={`w-full px-3 py-2 text-sm transition-colors flex items-center justify-center gap-1.5 ${
                      !showAllProjects && currentProject === p.id
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <span>{p.name}</span>
                    {projectQueueCount > 0 && (
                      <span className="text-blue-400 text-xs font-normal">· {projectQueueCount}</span>
                    )}
                  </button>
                )
              })}

              <div className="border-t border-gray-700 my-1" />

              {/* All Projects toggle */}
              <button
                onClick={() => { toggleShowAll(); setProjectDropdownOpen(false) }}
                className={`w-full px-3 py-2 text-center text-xs transition-colors ${
                  showAllProjects
                    ? 'text-blue-300 bg-blue-900/30'
                    : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                All Projects
              </button>

              {/* Add project */}
              <button
                onClick={() => { setShowAddProject(true); setProjectDropdownOpen(false) }}
                className="w-full px-3 py-2 text-center text-xs text-gray-500 hover:bg-gray-700 hover:text-gray-300 transition-colors"
              >
                + New Project
              </button>
            </div>
          )}
        </div>

        {/* Right: connection status + filter + new task button */}
        <div className="flex items-center gap-3">
          <StatusIndicator color={connected ? 'text-green-400' : 'text-red-400'} pulse={connected} />
          <span className={`text-xs hidden sm:inline ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          {view === 'tasks' && (
            <>
              <button
                onClick={() => setFiltersExpanded(prev => !prev)}
                className={`transition-colors p-1 ${filtersExpanded ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
                title="Filters"
              >
                <FilterIcon />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="New Task"
              >
                <PlusIcon />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className={`flex-1 overflow-auto p-4 md:p-8 ${activeTerminal ? 'h-1/2' : ''}`}>
          <div className="max-w-3xl mx-auto">
            {view === 'tasks' && (
              <TaskBoard
                tasks={tasks}
                agents={agents}
                send={send}
                currentProject={currentProject}
                promptLibrary={promptLibrary}
                projects={projects}
                showAllProjects={showAllProjects}
                showCreate={showCreate}
                onCloseCreate={() => setShowCreate(false)}
                selectionMode={selectionMode}
                onExitSelectionMode={() => setSelectionMode(false)}
                onNavigateQueue={() => setView('queue')}
                onNavigateAgents={() => setView('agents')}
                onViewTerminal={(id) => setActiveTerminal(id)}
                searchText={searchText}
                filtersExpanded={filtersExpanded}
                onToggleFilters={() => setFiltersExpanded(prev => !prev)}
                planContents={planContents}
                requestPlanContent={requestPlanContent}
                preferences={preferences}
              />
            )}
            {view === 'agents' && (
              <AgentPanel
                agents={agents}
                projects={projects}
                send={send}
                onViewTerminal={(id) => setActiveTerminal(id)}
                diffs={diffs}
                requestDiff={requestDiff}
              />
            )}
            {view === 'queue' && <HumanWorkQueue items={queue} agents={agents} projects={projects} send={send} />}
            {view === 'prompts' && <PromptsPage templates={promptTemplates} requestTemplates={requestPromptTemplates} send={send} />}
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

        <SettingsDialog
          open={showSettings}
          onClose={() => setShowSettings(false)}
          defaults={preferences}
          updateDefaults={updatePreferences}
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
