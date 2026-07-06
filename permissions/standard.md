---
name: standard
description: Standard profile for implementation and fix tasks
---

# standard profile

## Bash Commands (auto-approved)
- `docker compose restart *` (any single service)
- `docker compose logs *`
- `docker compose up -d *`
- `git add . && git commit`
- `git push origin main`

## Blocked Commands (best-effort deny)
<!--
These become `--disallowedTools "Bash(<cmd>:*)"` deny rules. Claude Code's
argument-level Bash matching is deliberately fragile (bypassable via extra
spaces, shell variables, or quoting), so treat this as defense-in-depth against
the naive invocation — NOT a sandbox. Real containment = the read-only/plan
profiles (which deny Bash wholesale) plus running behind auth on localhost.
-->
- `docker compose down` (no service)
- `rm -rf /`
- `docker compose stop` (no service)

## Tools
- Bash, Read, Write, Edit, Glob, Grep
