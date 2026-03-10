# Agent Dispatcher

A web dashboard for orchestrating headless AI coding agents. Spawn, monitor, and manage Claude Code, Gemini CLI, and Codex CLI agents from a unified task board with live terminal output, human-in-the-loop Q&A, and a composable prompt library.

Built as a personal tool for managing concurrent AI agents across multiple projects — designed for developers who run headless CLI agents and need visibility into what they're doing.

![Task Board](docs/screenshots/task-board.png)
![Spawn Dialog](docs/screenshots/spawn-dialog.png)
![Agent Panel](docs/screenshots/agent-panel.png)

## Why I Built This

Running headless Claude Code agents is powerful, but managing multiple agents across projects is painful:
- No visibility into what agents are doing without tailing logs
- No way to queue up tasks and dispatch them without copy-pasting prompts
- Agent questions go unanswered because there's no notification system
- Switching between terminal sessions to monitor progress doesn't scale

Agent Dispatcher solves this by providing a task board (parsed from markdown todo files), a spawn dialog with a composable prompt library, and a real-time agent panel with terminal output — all in one dashboard.

## Features

**Task Management**
- Markdown-based task board parsed from todo files with YAML frontmatter
- Tasks grouped by effort bucket (Running, Needs Review, Ready, Needs Planning, Blocked)
- Priority sorting, category filtering, search, and bulk operations
- Create, edit, and delete tasks from the UI — writes back to markdown

**Agent Orchestration**
- Spawn agents with configurable provider, model, run mode, and permission profile
- Three providers: Claude Code, Gemini CLI, Codex CLI
- Run modes: Plan, Implement, Audit, Fix, Custom
- Time limits with stall detection (no output for N minutes)
- Git branch isolation per agent run

**Live Monitoring**
- Real-time terminal output via xterm.js
- Agent state tracking: running, waiting, stalled, completed, errored
- Signal detection: `[VERIFIED]`, `[PLAN_READY]`, `[NEEDS_HELP]`, `[PARTIAL]`
- Inline conversation history on task cards

**Human-in-the-Loop**
- Work queue for async agent Q&A — agents ask questions, humans respond when ready
- Heuristic question detection with startup grace period
- Plan review overlay with rendered markdown (react-markdown + remark-gfm)

**Prompt Library**
- 4-layer composable system: base templates, variants, snippets, task-specific
- Templates use `${variable}` interpolation for task context
- Snippets are toggleable additions (e.g., "backup first", "docker safety")
- Per-provider model hints for behavioral guidance
- Custom overrides without modifying base templates

**Session Persistence**
- Agent sessions survive runner restarts (JSON-backed)
- Resume and fork completed sessions with additional context
- Conversation history preserved across restarts

## Architecture

```
Browser (React + xterm.js)
    |
    | WebSocket
    v
Express Proxy (Docker :3100) ---- Unix Socket ---- Agent Runner (systemd)
  Serves React SPA                                      |
  Relays WebSocket                                      | node-pty
                                                        v
                                                  CLI Agents
                                              (Claude / Gemini / Codex)
```

The system is split into three layers:

- **Runner** (`src/runner/`) — Host-side Node.js process, spawns CLI agents via node-pty, manages sessions, detects signals/stalls, enforces time limits, reads/writes todo files
- **Server** (`src/server/`) — Docker container running Express + WebSocket relay, connects to runner over Unix socket
- **Frontend** (`src/web/`) — React 19 SPA with Tailwind CSS, xterm.js terminal, task board, spawn dialog, queue panel

## Tech Stack

TypeScript (ESM) | React 19 | Vite 7 | Tailwind CSS 4 | Express 5 | ws | node-pty | xterm.js | react-markdown | Vitest

~9,850 LOC | 170 tests | 21 React components | 3 providers

## Quick Start

### Prerequisites
- Node.js 20+
- npm
- Docker (for the web server container)
- At least one CLI agent installed: [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Gemini CLI](https://github.com/google-gemini/gemini-cli), or [Codex CLI](https://github.com/openai/codex)

### Setup

```bash
# Clone and install
git clone https://github.com/tylerbcrawford/agent-dispatcher.git
cd agent-dispatcher
npm install

# Configure
cp .env.example .env
# Edit .env — set AC_VAULT_PATH to your todo file directory

# Development
npm run dev:runner    # Start the agent runner (host)
npm run dev:web       # Start the Vite dev server (frontend)

# Tests
npm test
```

### Production

```bash
# Build frontend
npm run build

# Install systemd service (see agent-dispatcher.service.example)
# Start Docker web container
docker compose up -d agent-dispatcher-web
```

### Todo File Format

Agent Dispatcher reads markdown todo files with this structure:

```markdown
---
project: my-project
description: Project description
default-cwd: /path/to/project
claude-md: /path/to/CLAUDE.md
---

# Todo - My Project

## Category Name

### 1. Task Name
**Priority:** HIGH | **Time:** 30 min | **Status:** Ready

Task description goes here.
```

## Project Structure

```
src/
  runner/          # Agent runner (host systemd service)
    spawner.ts     # Agent lifecycle management
    parser.ts      # Todo file parser
    serializer.ts  # Todo file writer
    providers.ts   # CLI command builders (Claude/Gemini/Codex)
    prompt-library.ts
  server/          # Express WebSocket proxy (Docker)
  shared/          # TypeScript types
  web/             # React frontend
    components/    # 21 React components
    hooks/         # Custom hooks (WebSocket, preferences)
    lib/           # Shared utilities
prompts/           # Prompt library (markdown templates)
permissions/       # Permission profiles
```

## Roadmap

- Inline task execution (run agents without leaving the task board)
- LLM Council mode (multi-agent consensus for critical decisions)
- Discord notifications for agent state changes
- Swipe/tab navigation for mobile
- Permission learning from approved commands

## License

[MIT](LICENSE)
