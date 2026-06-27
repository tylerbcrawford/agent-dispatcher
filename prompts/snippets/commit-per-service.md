---
id: snippet-commit-per-service
label: Commit Per Service
description: Make a separate commit after each service change
tags: [docker, selfhosted]
---

## Commit Discipline

Make a separate git commit after each individual service change:
- One service per commit (e.g., "fix api volume mapping", "update web config")
- Verify the service is healthy before committing
- Never batch multiple service changes into a single commit
