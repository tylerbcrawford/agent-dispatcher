# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Agent Dispatcher, please report it responsibly.

**Preferred:** Open a [GitHub Security Advisory](https://github.com/tylerbcrawford/agent-dispatcher/security/advisories/new) or create a private issue.

**Please do not** open a public issue for security vulnerabilities.

## What to Report

- Command injection via task descriptions, todo files, or prompt templates
- A permission profile that lets a restricted run (e.g. read-only) write files, execute disallowed tools, or escape its intended scope
- API key or credential exposure (`GEMINI_API_KEY`, provider auth tokens, the runner's Unix socket)
- Unauthorized access to the agent runner from the web/server layer
- Dependency vulnerabilities with known exploits

## Credential Handling

Agent Dispatcher spawns CLI agents with real filesystem and shell access, so credential hygiene matters more than in a typical web app. Secrets are:

- Stored only in the `.env` file (gitignored) or the CLI provider's own auth store (for example, Codex's system keyring)
- Loaded via environment variables at startup
- Never logged, echoed, or written to session or task files

If you find a case where a credential is inadvertently exposed, please report it immediately.

## Permission Profiles

Agent runs are scoped by permission profile (`permissions/`). Treat a profile bypass or misconfiguration as a security issue, not a regular bug — report it through the channel above.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
