# Agent Dispatcher

Web dashboard that orchestrates headless AI coding agents against project tasks.

## Quick Reference
- **Frontend:** React 19 + Vite + Tailwind CSS + xterm.js
- **Backend:** Express (Docker) + node-pty runner (host systemd)
- **IPC:** Unix socket at /run/agent-dispatcher/dispatcher.sock
- **Tests:** Vitest — run with `npm test`
- **Dev:** `npm run dev:web` (frontend) + `npm run dev:runner` (host runner)

## Architecture
- `src/web/` — React frontend (served from Docker)
- `src/server/` — Express WebSocket proxy (Docker)
- `src/runner/` — Agent runner with node-pty (host systemd service)
- `src/shared/` — Shared TypeScript types
- `prompts/` — Prompt Library (base templates, variants, snippets, task-specific)

## Key Rules
- NEVER run `docker compose down` without a service name
- Agents spawn from the configured `AC_VAULT_PATH` directory
- Todo files use the standardized format (YAML frontmatter + sequential IDs)
- Base prompt templates embed verification workflows — don't simplify them
- Adding a new prompt = creating a new .md file in prompts/ (no code changes needed)

## Test Conventions
- All tests use Vitest
- Frontend tests use `@testing-library/react` with `happy-dom`
- Run `npm test` before committing
- Test files live adjacent to source: `src/**/__tests__/*.test.ts(x)`

## Prompt Template Conventions
- Templates use `${variable}` interpolation (name, description, planContent, projectName, etc.)
- Frontmatter fields: id, mode, label, description, default_profile, default_time, default_model, tags
- Variants extend bases via `extends: <base-id>` and `${basePrompt}` placeholder
- Snippets are toggleable additions appended after the main prompt

## Deployment

`./deploy.sh` auto-detects what changed (runner/frontend/all) from `git diff` and runs the appropriate build and restart steps. You can also target explicitly: `npm run deploy:runner`, `npm run deploy:frontend`, or `npm run deploy:all`.

After any runner change, restart **both** the runner service and the web container. The web container proxies WebSocket to the runner over a Unix socket and holds the socket connection open — restarting the runner creates a new socket inode, which leaves the web container pointing at a dead file descriptor until it is also restarted.
