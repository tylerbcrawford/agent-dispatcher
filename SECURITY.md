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

## Trust Model

The dashboard has **no built-in authentication** and spawns agents with real shell/filesystem access. It is meant to run bound to `127.0.0.1` (the web container does this by default) behind a reverse proxy or VPN that authenticates. Anyone who can reach the UI — or the runner's Unix socket — can spawn a shell-capable agent. See the "Security model" section of the README for deployment guidance.

## Permission Profiles

Agent runs are scoped by permission profile (`permissions/`):

- **`read-only` and `plan` are hard boundaries.** They deny `Bash` (and other write/network tools) via Claude Code's `--disallowedTools`, which overrides inherited allow rules. Use these for untrusted tasks. A restricted run that nonetheless writes files or runs shell commands **is a security bug** — report it.
- **`standard`/`full-access` are write-capable by design.** Their per-command "blocked" lists become best-effort `--disallowedTools "Bash(<cmd>:*)"` rules. Claude Code's argument-level Bash matching is deliberately fragile (bypassable via spacing, shell variables, or quoting), so these stop the naive invocation but are **not** a sandbox — do not run untrusted input under these profiles. This limitation is expected behavior, not a vulnerability.

Treat a bypass of the `read-only`/`plan` boundary, or a profile *misconfiguration*, as a security issue — report it through the channel above.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
