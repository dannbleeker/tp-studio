#!/usr/bin/env node
/**
 * Session 84 — Claude Code `PostToolUse` hook for the Bash tool.
 *
 * Fires after every Bash tool call. When the command was a
 * `git push origin main` that succeeded, write a reminder to stderr
 * so Claude sees it: monitor CI before declaring the session done.
 *
 * Why this is just a reminder (not an auto-watch): kicking off
 * `gh run watch` here would block the hook for minutes and make
 * Claude's subsequent tool calls feel laggy. The memory rule
 * (`feedback_ci_refactor_workflow.md`) already requires Claude to
 * monitor CI explicitly via the `Monitor` tool; this hook just
 * surfaces a nudge in case Claude forgot.
 *
 * Exit 0 always — this is observability, not a gate.
 */

'use strict';

const fs = require('node:fs');

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
    process.exit(0);
  }
  if (payload.tool_name !== 'Bash') process.exit(0);
  const cmd = String(payload.tool_input?.command ?? '');
  const result = payload.tool_response ?? {};
  // Only react to a successful push to origin/main. `tool_response.success`
  // may or may not be set depending on the Claude Code version; fall back
  // to checking that the stdout looks like a successful push.
  if (!/(^|[^a-zA-Z0-9_-])git\s+push\b.*origin\b.*main/.test(cmd)) {
    process.exit(0);
  }
  const out = String(result.stdout ?? '') + String(result.stderr ?? '');
  const looksLikeSuccess = /\bmain\s*->\s*main\b/.test(out) || /\bnew branch\b/.test(out);
  if (!looksLikeSuccess) process.exit(0);
  process.stderr.write(
    '[post-push hook] Push to origin/main detected. Next step per ' +
      'feedback_ci_refactor_workflow memory: monitor the CI run via ' +
      '`gh run list --branch main --limit 1` + Monitor tool, and only ' +
      'mark the session complete when both jobs return success. Fire ' +
      'PushNotification on green per feedback_notifications memory.\n'
  );
  process.exit(0);
};

main();
