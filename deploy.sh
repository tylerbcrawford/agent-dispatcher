#!/usr/bin/env bash
set -euo pipefail

# Agent Dispatcher Deploy Script
# Handles the runner restart + Docker socket inode refresh automatically.
#
# Usage:
#   ./deploy.sh              # Auto-detect what changed and deploy
#   ./deploy.sh runner       # Runner-only restart (config, backend TS)
#   ./deploy.sh frontend     # Frontend rebuild + Docker rebuild
#   ./deploy.sh all          # Full rebuild + restart everything

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CD="${AC_COMPOSE_DIR:?Set AC_COMPOSE_DIR to your docker-compose.yml directory}"
AC="$SCRIPT_DIR"
WEB_SERVICE="agent-dispatcher-web"
RUNNER_SERVICE="agent-dispatcher"

red()    { printf '\033[0;31m%s\033[0m\n' "$*"; }
green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
dim()    { printf '\033[0;90m%s\033[0m\n' "$*"; }

restart_runner() {
    yellow "Restarting runner (systemd)..."
    sudo systemctl restart "$RUNNER_SERVICE"
    sleep 2
    if systemctl is-active --quiet "$RUNNER_SERVICE"; then
        green "Runner is active"
    else
        red "Runner failed to start!"
        sudo journalctl -u "$RUNNER_SERVICE" --no-pager -n 10
        exit 1
    fi
}

restart_web() {
    yellow "Restarting web container (socket inode refresh)..."
    docker compose -f "$CD/docker-compose.yml" restart "$WEB_SERVICE"
    sleep 1
    green "Web container restarted"
}

rebuild_frontend() {
    yellow "Building frontend + server..."
    cd "$AC"
    npm run build
    yellow "Rebuilding Docker image..."
    docker compose -f "$CD/docker-compose.yml" build "$WEB_SERVICE"
    yellow "Starting new container..."
    docker compose -f "$CD/docker-compose.yml" up -d "$WEB_SERVICE"
    green "Frontend deployed"
}

# Determine mode
MODE="${1:-auto}"

if [[ "$MODE" == "auto" ]]; then
    cd "$AC"
    # Check what's changed since last commit
    CHANGED=$(git diff --name-only HEAD 2>/dev/null || echo "")
    STAGED=$(git diff --cached --name-only 2>/dev/null || echo "")
    ALL_CHANGES="$CHANGED"$'\n'"$STAGED"

    HAS_RUNNER=false
    HAS_FRONTEND=false

    if echo "$ALL_CHANGES" | grep -qE '^src/runner/|^src/shared/|^projects\.json|^prompts/|^permissions/|\.env'; then
        HAS_RUNNER=true
    fi
    if echo "$ALL_CHANGES" | grep -qE '^src/web/|^src/server/|^src/shared/|^index\.html|^vite\.config|^tailwind'; then
        HAS_FRONTEND=true
    fi

    if $HAS_FRONTEND && $HAS_RUNNER; then
        MODE="all"
    elif $HAS_FRONTEND; then
        MODE="frontend"
    elif $HAS_RUNNER; then
        MODE="runner"
    else
        yellow "No changes detected — defaulting to runner restart"
        MODE="runner"
    fi
    dim "Auto-detected: $MODE"
fi

case "$MODE" in
    runner)
        restart_runner
        restart_web  # ALWAYS refresh socket inode after runner restart
        ;;
    frontend)
        rebuild_frontend
        ;;
    all)
        rebuild_frontend
        restart_runner
        restart_web
        ;;
    *)
        red "Usage: ./deploy.sh [runner|frontend|all]"
        red "  (no args = auto-detect from git diff)"
        exit 1
        ;;
esac

green "Deploy complete!"
