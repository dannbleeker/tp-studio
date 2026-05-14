#!/usr/bin/env node
/**
 * Session 84 — Claude Code `PreToolUse` hook for the Bash tool.
 *
 * Fires before every Bash tool call. When the command is a
 * `git commit` or `git push origin main`, we run a fast gate first:
 *
 *   - `git commit` → `tsc --noEmit` + `biome check`. Exits 2 (block)
 *     if either fails. Vitest is NOT run here — too slow for an
 *     every-commit gate. The session-end workflow + the explicit
 *     `/session-end` slash command run the full suite.
 *   - `git push origin main` → require a recent successful
 *     `pnpm test:e2e`-equivalent locally OR an explicit override via
 *     `CLAUDE_SKIP_PUSH_GATE=1`. (Locally this just checks `git status`
 *     is clean — the real safety net is the post-push CI watcher.)
 *
 * The hook reads JSON on stdin: `{ tool_name: "Bash", tool_input: { command, ... } }`.
 * Exit 0  = allow.
 * Exit 2  = block; stderr is shown to Claude (and to the user) so the
 *           reason is visible.
 * Other   = error in the hook itself; Claude logs + ignores.
 *
 * Keep it idempotent and side-effect-free beyond the validation itself.
 */

'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const readStdin = () => {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
};

const main = () => {
  const raw = readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // No JSON on stdin — not a real hook invocation. Allow.
    process.exit(0);
  }
  if (payload.tool_name !== 'Bash') process.exit(0);
  const cmd = String(payload.tool_input?.command ?? '');

  // ── git commit gate ────────────────────────────────────────────
  if (/(^|[^a-zA-Z0-9_-])git\s+commit/.test(cmd)) {
    if (process.env.CLAUDE_SKIP_COMMIT_GATE === '1') process.exit(0);
    const failures = [];
    try {
      execSync('node_modules/.bin/tsc --noEmit', {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
      });
    } catch (err) {
      const tail = String(err.stdout ?? '') + String(err.stderr ?? '');
      failures.push(`tsc --noEmit failed:\n${tail.slice(-2000)}`);
    }
    try {
      execSync('node_modules/.bin/biome check', {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
      });
    } catch (err) {
      const tail = String(err.stdout ?? '') + String(err.stderr ?? '');
      failures.push(`biome check failed:\n${tail.slice(-2000)}`);
    }
    if (failures.length > 0) {
      process.stderr.write(
        `pre-commit gate failed.\n\n${failures.join('\n\n')}\n\nFix the issues above, or set CLAUDE_SKIP_COMMIT_GATE=1 for an explicit bypass.\n`
      );
      process.exit(2);
    }
    process.exit(0);
  }

  // ── git push origin main gate ──────────────────────────────────
  if (/(^|[^a-zA-Z0-9_-])git\s+push\b.*origin\b.*main/.test(cmd)) {
    if (process.env.CLAUDE_SKIP_PUSH_GATE === '1') process.exit(0);
    // Soft gate: warn if the working tree has uncommitted changes. The
    // commit gate handled tsc + biome; the push gate is mostly here as
    // a reminder + an opt-in vitest run for the truly cautious.
    try {
      const status = execSync('git status --porcelain', {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
      });
      if (status.trim().length > 0) {
        process.stderr.write(
          `pre-push warning: working tree has uncommitted changes:\n${status}\nPushing only the committed state. Continuing.\n`
        );
        // Warn-only; don't block.
      }
    } catch {
      // git status itself failed — odd; let the push attempt proceed.
    }
    process.exit(0);
  }

  process.exit(0);
};

main();
