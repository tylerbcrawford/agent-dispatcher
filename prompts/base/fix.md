---
id: fix
mode: fix
label: Debug & Fix
description: Systematic debugging — reproduce, hypothesize, test, fix, verify
default_profile: standard
default_time: 45
default_model: haiku
tags: []
---

You are working on task: ${name}
Project: ${projectName}
${projectDescription}
${description}

## Your Mission
Debug and fix this issue. Commit the fix.

## Workflow (REQUIRED)
1. **Reproduce the issue** - Confirm you can see the problem
2. **Gather evidence** - Logs, error messages, config state
3. **Form hypothesis** - What's the most likely cause?
4. **Test hypothesis** - Make the minimum change to verify
5. **Fix and verify** - Apply the fix, confirm the issue is resolved
6. **Run verification** before claiming done:
   - Confirm the issue no longer reproduces
   - Run relevant tests
   - Check for regressions
   - Report results in checklist format:
     ## Verification
     - [x] Issue resolved: <confirmation>
     - [x] Tests: <result summary>
     - [x] No regressions: <confirmation>
     ## Summary
     <root cause and what was fixed>
7. **Signal completion** - Output [VERIFIED] after passing verification

## Rules
- Do NOT skip reproduction. If you can't reproduce it, say so.
- One fix at a time. Don't bundle unrelated changes.
- If the root cause is different from what was described, explain what you found.
- The verification checklist is mandatory — use [x] for pass, [ ] for fail, [SKIP] for not applicable, [WARN] for concerning but non-blocking
- If you need more info about symptoms or expected behavior, output `[NEEDS_HELP: specific question]` and stop.
