---
name: session-end
description: Run the full TP Studio end-of-session workflow — first test round, maintainability refactor pass via the session-reviewer subagent, second test round, ask to commit, push to origin/main, watch CI via gh, fire a PushNotification on green. Encodes the rules in feedback_ci_refactor_workflow + feedback_notifications memory.
---

You're closing out a TP Studio coding session. Run the standing workflow without freelancing — it's deliberately ordered. Skip a step only when Dann explicitly says so.

## Step 1 — First test round

Run all five gates. Each must exit 0 before moving on.

```
node_modules/.bin/tsc --noEmit
node_modules/.bin/biome check
node_modules/.bin/vitest run
node_modules/.bin/vite build
node scripts/check-bundle-size.mjs
```

Report each result inline (one line per gate). If any fail, **stop here** and fix — don't proceed to the refactor pass with red tests. The diff you're about to refactor wouldn't be trustworthy.

## Step 2 — Maintainability refactor pass

Invoke the `session-reviewer` subagent with the current uncommitted diff as input. It returns a flat punch list of concrete concerns (biome-ignore additions, fresh `as any`, stray `console.*`, duplicated logic, missing doc-comments, dead code, new TODOs).

Walk the list. For each item:

- Fix in place if it's a one-liner.
- Skip with a one-line justification (printed in the session summary) if the concern doesn't apply (e.g. legitimate `dangerouslySetInnerHTML` on a trusted SVG payload).
- For larger concerns, add to NEXT_STEPS.md instead of fixing inline — keep the refactor pass time-boxed.

Skip the whole step if Dann said "no refactor this session."

## Step 3 — Second test round

Same five gates as step 1. Catches regressions the refactor introduced. Any failure → fix → re-run, do **not** proceed to commit with red tests.

## Step 4 — Ask Dann to commit

Per `feedback_commit_workflow` memory: ask first, don't commit silently. Quote the proposed Conventional Commits subject line. On "yes", build the commit with:

- One commit per session (multi-line body, references the CHANGELOG entry).
- `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:` prefix per the change shape.
- Co-Authored-By footer for Claude.
- HEREDOC for the message so formatting survives.

## Step 5 — Push to origin/main

`git push origin main`. Let the post-push hook fire (it just prints a reminder).

## Step 6 — Watch CI via gh

```
gh run list --branch main --workflow=CI --limit 1
```

Capture the run id, then watch via the `Monitor` tool with a polling script. Both `Lint + types + tests + build` and `Playwright e2e smoke tests` must return `success`.

## Step 7 — Goal-seek on CI failure

If either job fails:

```
gh run view <id> --log-failed | head -100
gh run download <id> -n playwright-report -D /tmp/pwreport
```

Diagnose from the real error trace + page snapshot. Don't guess. Fix → push → re-watch. Iterate until green.

If genuinely stuck (e.g. design ambiguity that needs Dann's input), fire a `PushNotification` with the specific blocker and pause for his decision.

## Step 8 — PushNotification on green

Once both CI jobs return `success`, send a one-line notification:

```
Session N closed — M tests passing, CI green
```

Under 100 chars. No status dump.

## Step 9 — Final summary in chat

Print a Markdown summary covering:

- What shipped (one line per item)
- Test count delta
- Bundle delta if any
- Commit SHA
- Updated backlog snippet (top 3 next items per priority)

Then the session is closed. Don't loiter — the user knows where to find more detail.
