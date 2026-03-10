---
project: my-webapp
description: Example project — delete or replace this file with your own
default-cwd: /home/you/projects/my-webapp
claude-md: /home/you/projects/my-webapp/CLAUDE.md
---

# Todo — My Web App

## Backend

### 1. ⚡ Add rate limiting to API endpoints
**Priority:** 🔴 HIGH | **Time:** 30-45 min | **Status:** ✅ Ready
**Affects:** express, redis

Add express-rate-limit middleware to all /api routes. Use Redis store for distributed counting. Return 429 with Retry-After header when exceeded.

---

### 2. 📊 Migrate user table to UUIDs
**Priority:** 🟡 MEDIUM | **Time:** 2-3 hrs | **Status:** 📝 Needs Planning

Replace auto-increment integer IDs with UUIDv7 for the users table. Requires migration script, foreign key updates, and API response changes.

---

### 3. 🟢 Add health check endpoint
**Priority:** 🟢 LOW | **Time:** 10 min | **Status:** 🏁 Done

Simple GET /health returning 200 with uptime and version. Used by Docker healthcheck and uptime monitoring.

---

## Frontend

### 4. ⚡ Fix dark mode flash on page load
**Priority:** 🔴 HIGH | **Time:** 15-20 min | **Status:** ✅ Ready
**Plan:** [[plans/dark-mode-flash-fix]]

Users see a white flash before dark mode applies. Move theme detection to a blocking script in <head> before React hydrates.

---

### 5. 📊 Responsive sidebar navigation
**Priority:** 🟡 MEDIUM | **Time:** 1-2 hrs | **Status:** 🤖 In Progress

Collapse sidebar to bottom tab bar on mobile viewports. Add swipe gesture to toggle on tablet. Keep current layout for desktop.

---

### 6. 📊 Accessibility audit
**Priority:** 🟡 MEDIUM | **Time:** 1 hr | **Status:** ⏸️ Blocked
**Depends:** 5

Run axe-core audit on all pages. Fix any A/AA WCAG violations. Blocked until responsive nav is complete since it changes landmark structure.

---

## DevOps

### 7. ⚡ Set up CI pipeline
**Priority:** 🔴 HIGH | **Time:** 30 min | **Status:** 👁️ Plan Review
**Plan:** [[plans/ci-pipeline-plan]]

GitHub Actions workflow: lint, type-check, test, build. Run on PR and push to main. Block merge on failure.

---
