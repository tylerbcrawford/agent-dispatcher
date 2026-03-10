---
id: implement-docker-service
mode: implement
label: Docker Service Implementation
description: Docker-specific implementation with health checks and compose best practices
default_profile: standard
default_time: 60
default_model: haiku
tags: [docker, mediaserver, compose]
extends: implement
---

${basePrompt}

## Docker-Specific Guidelines

- **Always specify the target service** in docker compose commands (never run bare `docker compose down`)
- After modifying docker-compose.yml, run `docker compose config --quiet` to validate syntax
- Verify service health after `docker compose up -d <service>`:
  - Check `docker compose ps <service>` shows "healthy" or "running"
  - Check `docker compose logs --tail=20 <service>` for startup errors
- For volume changes: stop service first, make changes, then restart
- For network changes: check dependent services aren't broken
- Use `docker compose pull <service>` before `up -d` if updating images
