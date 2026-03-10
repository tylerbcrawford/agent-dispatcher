---
id: snippet-commit-per-service
label: Commit Per Service
description: Make a separate commit after each service change
tags: [docker, mediaserver]
---

## Commit Discipline

Make a separate git commit after each individual service change:
- One service per commit (e.g., "fix sonarr volume mapping", "update radarr config")
- Verify the service is healthy before committing
- Never batch multiple service changes into a single commit
