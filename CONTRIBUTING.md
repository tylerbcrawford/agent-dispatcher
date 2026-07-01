# Contributing to Agent Dispatcher

Thanks for your interest in contributing. This guide covers what you need to get started.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/agent-dispatcher.git
   cd agent-dispatcher
   ```
3. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Install dependencies**:
   ```bash
   npm install
   cp .env.example .env
   # Set AC_VAULT_PATH to a todo file directory and fill in any provider keys you plan to use
   ```

## Development Workflow

### Running Locally

```bash
npm run dev:runner    # Agent runner (host process, needs PTY/filesystem access)
npm run dev:web       # Vite dev server (frontend)
```

The runner and frontend communicate over a Unix socket via the Express proxy in `src/server/`. Both need to be running for a full local session.

### Project Structure

- **`src/runner/`** — Agent runner: spawns CLI agents via node-pty, parses/writes todo files, detects completion signals
- **`src/server/`** — Express + WebSocket proxy (the Docker-hosted piece)
- **`src/web/`** — React frontend: task board, spawn dialog, terminal, work queue
- **`src/shared/`** — Shared TypeScript types
- **`prompts/`** — Composable prompt library (base templates, variants, snippets)
- **`permissions/`** — Permission profiles for agent runs

### Adding a New Prompt

Prompt templates are markdown files with frontmatter, not code. Drop a new `.md` file in `prompts/` following the `${variable}` interpolation conventions documented in `CLAUDE.md` — no changes to `src/` required.

### Code Style

- TypeScript, strict mode. Prefer a real type over `any` when one is available.
- Frontend components are React 19 function components; shared hooks live in `src/web/hooks/`.
- Keep runner-side file writes surgical — `task-editor.ts` updates fields in place without touching unrelated prose or task history.

### Tests

- Tests use Vitest and live adjacent to source (`src/**/__tests__/*.test.ts(x)`).
- Frontend tests use `@testing-library/react` with `happy-dom`.
- Run `npm test` before opening a PR.

## Pull Requests

1. **Keep PRs focused** — one feature or fix per PR
2. **Write a clear description** — explain what changed and why
3. **Include tests** for new behavior and confirm `npm test` passes
4. **Update docs** (README, CLAUDE.md) if your change affects setup, configuration, or commands

### PR Title Format

```
feat: add new feature
fix: resolve specific bug
docs: update documentation
refactor: code restructuring (no behavior change)
```

## Reporting Issues

- **Bug reports**: include steps to reproduce, expected vs. actual behavior, and your Node version/OS
- **Feature requests**: describe the use case you're trying to solve
- **Questions**: open an issue with the `question` label

## Architecture Notes

Runner, server, and frontend are split by responsibility: the runner needs host filesystem and PTY access, so it stays separate from the Docker-hosted proxy that serves the browser. See the Architecture section in `README.md` for the full picture.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
