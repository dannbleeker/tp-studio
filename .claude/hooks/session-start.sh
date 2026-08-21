#!/bin/bash
# SessionStart hook — Claude Code on the web / remote containers only.
#
# Why this exists (Session 211): the remote container clones the repo fresh with
# no `node_modules`, so NOTHING runs until dependencies are installed — not tsc,
# not vitest, not biome, and not `.claude/hooks/pre-bash-gate.cjs`, the PreToolUse
# hook that is supposed to block a commit when tsc/biome fail. That last one is
# the reason this is worth automating rather than remembering: a missing install
# doesn't just cost time, it silently disarms the commit gate.
#
# Deliberately SYNCHRONOUS (no `{"async": true}` line). The gate hook can fire on
# the very first Bash call of a session, so a race between "session is ready" and
# "node_modules exists" is precisely what this removes. Startup pays ~1 min once;
# the container image is cached afterwards, so warm starts hit the fast path below.
set -euo pipefail

# The workstation already has its dependencies — only the remote container starts
# empty, and re-running pnpm there would be pure latency.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# Idempotent: safe to run repeatedly. Checks for a real binary rather than just
# the directory, so a half-populated node_modules doesn't read as "done".
if [ -x node_modules/.bin/vitest ] && [ -x node_modules/.bin/biome ]; then
  echo "session-start: dependencies already present — nothing to do"
  exit 0
fi

corepack enable >/dev/null 2>&1 || true

# --frozen-lockfile matches what CI installs, so a web session and CI never
# disagree about a dependency version.
if ! pnpm install --frozen-lockfile; then
  # Non-fatal on purpose: a failed install should leave the session usable so it
  # can be diagnosed, not brick it before the first prompt.
  echo "session-start: pnpm install FAILED — run 'pnpm install' by hand before using the gate" >&2
  exit 0
fi

echo "session-start: dependencies installed"
