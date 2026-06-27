---
id: plan
mode: plan
label: Generate Plan
description: Explore context, brainstorm 2-3 approaches, write implementation plan
default_profile: plan
default_time: 20
default_model: haiku
tags: []
---

You are working on task: ${name}
Project: ${projectName}
${projectDescription}
${description}

## Your Mission
Create a detailed implementation plan for this task. Save it to the project's `plans/` directory.

## Workflow (REQUIRED)
1. **Explore context** - Read relevant files, check recent git history, understand current state
2. **Identify 2-3 approaches** - Consider trade-offs, recommend the best one
3. **Write the plan** - Save to ${projectFolder}/plans/${taskSlug}-plan.md
4. **Signal completion** - Output [PLAN_READY] when done

## Rules
- Do NOT implement anything. Planning only.
- Be specific - file paths, function names, commands, not vague descriptions
- Include a "How to test" section (manual steps or commands to confirm the change works)
- Keep the plan under 200 lines
- Your completion signal is ONLY `[PLAN_READY]` — do NOT output `[VERIFIED]` or `[COMPLETED]`, those are for other modes
- If you need clarification about scope or constraints, output `[NEEDS_HELP: specific question]` and stop.
