#!/usr/bin/env bash
#
# Bedlam macOS LaunchAgent installer
#
# What this does:
#   1. Validates you have Node, pnpm, and the bedlam repo on disk
#   2. Materializes ~/Library/LaunchAgents/ai.bedlam.dev.plist from the
#      template at scripts/macos/ai.bedlam.dev.plist.template
#   3. Bootstraps the agent into your GUI launchd domain (gui/$UID), so
#      it inherits the security context needed for keychain-based auth
#      (e.g. Claude Code subscription login)
#   4. Verifies http://127.0.0.1:3100/api/health responds
#
# Why a LaunchAgent instead of cron + nohup:
#   - Cron-spawned processes do not inherit your GUI session security
#     context. Tools like Claude Code that store OAuth tokens in the
#     macOS keychain may fail to authenticate when run from cron-spawned
#     parents, even though they work fine from a logged-in terminal.
#   - LaunchAgents loaded into gui/$UID get the GUI session context and
#     auto-restart on crash via KeepAlive, no external watchdog needed.
#
# Usage:
#   ./scripts/macos/install.sh                       # install + start
#   ./scripts/macos/install.sh --jwt <hex>           # use existing secret
#   ./scripts/macos/install.sh restart               # kickstart -k
#   ./scripts/macos/install.sh stop                  # bootout
#   ./scripts/macos/install.sh status                # launchctl print
#   ./scripts/macos/install.sh logs                  # tail launchd log
#   ./scripts/macos/install.sh uninstall             # bootout + remove plist

set -euo pipefail

LABEL="ai.bedlam.dev"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_PATH="/tmp/bedlam-launchd.log"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE="${REPO_ROOT}/scripts/macos/ai.bedlam.dev.plist.template"

domain="gui/$(id -u)"
service="${domain}/${LABEL}"

err() { printf "error: %s\n" "$*" >&2; exit 1; }
info() { printf "%s\n" "$*"; }

case "${1:-install}" in
  restart)
    info "Restarting ${LABEL}…"
    launchctl kickstart -k "${service}" || err "kickstart failed (is it loaded? try: $0 install)"
    info "Done. Check: $0 status"
    exit 0
    ;;
  stop)
    info "Stopping ${LABEL}…"
    launchctl bootout "${service}" 2>/dev/null || true
    info "Done."
    exit 0
    ;;
  status)
    launchctl print "${service}" 2>&1 | head -40
    exit 0
    ;;
  logs)
    tail -f "${LOG_PATH}"
    exit 0
    ;;
  uninstall)
    info "Unloading and removing ${LABEL}…"
    launchctl bootout "${service}" 2>/dev/null || true
    rm -f "${PLIST_DEST}"
    info "Done."
    exit 0
    ;;
  install|"")
    : # fall through to install path below
    ;;
  --jwt)
    : # handled in arg parsing below
    ;;
  -h|--help|help)
    sed -n '1,40p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
esac

# ---- install path ----

# Parse --jwt
JWT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --jwt) JWT="${2:-}"; shift 2 ;;
    install) shift ;;
    *) shift ;;
  esac
done

# Resolve pnpm path (Apple Silicon vs Intel Homebrew)
PNPM_PATH=""
for p in /opt/homebrew/bin/pnpm /usr/local/bin/pnpm "$(command -v pnpm 2>/dev/null || true)"; do
  if [[ -n "$p" && -x "$p" ]]; then PNPM_PATH="$p"; break; fi
done
[[ -z "$PNPM_PATH" ]] && err "pnpm not found. Install via 'corepack enable' or 'brew install pnpm'."

# Sanity check repo layout
[[ -f "${REPO_ROOT}/package.json" ]] || err "Cannot find Bedlam package.json at ${REPO_ROOT}"
[[ -f "${TEMPLATE}" ]] || err "Cannot find LaunchAgent template at ${TEMPLATE}"

# Generate JWT if not provided. 32 bytes = 64 hex chars.
if [[ -z "${JWT}" ]]; then
  JWT="$(openssl rand -hex 32)"
  info "Generated fresh BEDLAM_AGENT_JWT_SECRET (64 hex chars)."
  info "If you already have a secret in use elsewhere, re-run with --jwt <existing-secret>."
fi

# Materialize the plist
mkdir -p "$HOME/Library/LaunchAgents"
sed \
  -e "s|{{HOME}}|${HOME}|g" \
  -e "s|{{USER}}|${USER}|g" \
  -e "s|{{REPO}}|${REPO_ROOT}|g" \
  -e "s|{{JWT}}|${JWT}|g" \
  "${TEMPLATE}" > "${PLIST_DEST}"

# Fix the ProgramArguments path if pnpm isn't at /opt/homebrew/bin
if [[ "${PNPM_PATH}" != "/opt/homebrew/bin/pnpm" ]]; then
  /usr/bin/sed -i '' "s|/opt/homebrew/bin/pnpm|${PNPM_PATH}|g" "${PLIST_DEST}"
fi

# Validate the plist
plutil -lint "${PLIST_DEST}" >/dev/null || err "Generated plist is invalid: ${PLIST_DEST}"

# Unload any prior version (idempotent)
launchctl bootout "${service}" 2>/dev/null || true

# Bootstrap into GUI domain
launchctl bootstrap "${domain}" "${PLIST_DEST}" || err "bootstrap failed. Run '$0 status' for diagnostics."

# Wait for health
info "Waiting for Bedlam to come up at http://127.0.0.1:3100/api/health…"
for i in $(seq 1 30); do
  status="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/health 2>/dev/null || true)"
  if [[ "$status" == "200" ]]; then
    info "Healthy after $((i * 2))s."
    break
  fi
  sleep 2
done

if [[ "${status:-000}" != "200" ]]; then
  info "Bedlam did not respond healthy within 60s. Recent log lines:"
  tail -50 "${LOG_PATH}" 2>/dev/null || true
  err "Install completed but service is not healthy. Check ${LOG_PATH}."
fi

cat <<EOF

Bedlam is installed as a LaunchAgent.

  Plist:    ${PLIST_DEST}
  Logs:     ${LOG_PATH}
  Service:  ${service}

Common commands:
  $0 status     # show LaunchAgent state
  $0 restart    # kickstart -k (use after pulling code changes)
  $0 logs       # tail server output
  $0 stop       # unload (will not auto-restart until you boot it back)
  $0 uninstall  # unload and remove the plist

The agent is loaded into gui/\$(id -u). It will auto-start at login,
auto-restart on crash, and inherit your GUI security context (so
Claude Code subscription auth, keychain-stored API keys, etc. work
the same way they do from your shell).
EOF
