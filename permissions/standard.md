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

## Blocked Commands (always denied)
- `docker compose down` (no service)
- `rm -rf /`
- `docker compose stop` (no service)

## Tools
- Bash, Read, Write, Edit, Glob, Grep
