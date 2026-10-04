---
name: session-end
description: Run the full TP Studio end-of-session workflow — first test round, maintainability refactor pass via the session-reviewer subagent, second test round, commit without asking, push to origin/main, watch CI via gh, fire a PushNotification on green. Encodes the rules in feedback_commit_workflow + feedback_notifications memory.
---

You're closing out a TP Studio coding session. Run the standing workflow without freelancing — it's deliberately ordered. Skip a step only when Dann explicitly says so.

## Step 1 — First test round

Run the whole gate in one shot. It must exit 0 before moving on.

```
node scripts/preflight.mjs
```

That is tsc, biome, knip, vitest, vite build and bundle-size, in order and fail-fast (the same steps as `/gate`). Run it un-piped: a `| tail` reports the pipe's exit code, not the gate's. Report each step's result inline (one line per step). If any fail, **stop here** and fix — don't proceed to the refactor pass with red tests. The diff you're about to refactor wouldn't be trustworthy.

## Step 2 — Maintainability refactor pass

Invoke the `session-reviewer` subagent with the current uncommitted diff as input. It returns a flat punch list of concrete concerns (biome-ignore additions, fresh `as any`, stray `console.*`, duplicated logic, missing doc-comments, dead code, new TODOs).

Walk the list. For each item:

- Fix in place if it's a one-liner.
- Skip with a one-line justification (printed in the session summary) if the concern doesn't apply (e.g. legitimate `dangerouslySetInnerHTML` on a trusted SVG payload).
- For larger concerns, add to NEXT_STEPS.md instead of fixing inline — keep the refactor pass time-boxed.

Skip the whole step if Dann said "no refactor this session."

## Step 3 — Second test round

Same gate as step 1. Catches regressions the refactor introduced. Any failure → fix → re-run, do **not** proceed to commit with red tests.

## Step 4: Commit without asking

Per the `feedback_commit_workflow` memory ("Land every green work block"): once step 3 is green, commit and say what landed. It is not a permission gate. Stop and ask instead only when the change is risky or hard to reverse (schema migration, data deletion, dependency bump, security or licence), the work is WIP, or you find stray unrelated changes. If Dann said "hold" or "don't push" this session, honour it. Build the commit with:

- One commit per logical change (multi-line body, references the CHANGELOG entry).
- `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:` prefix per the change shape.
- The Co-Authored-By trailer exactly as the harness's attribution instruction gives it this session, never copied from memory or an old commit.
- HEREDOC for the message so formatting survives.

## Step 5 — Push to origin/main

`git push origin main`. Let the post-push hook fire (it just prints a reminder).

## Step 6 — Watch CI via gh

Several runs fire per push (`CI`, with its own jobs, and `Deploy to GitHub Pages`), so watching one is not enough. `gh run watch <id>` is fine for keeping busy, but don't trust `--exit-status`: it follows one job and can report green while another is red. Once the runs finish, cross-check every run for the HEAD sha (the full 40-character sha; a short one matches nothing):

```bash
SHA=$(git rev-parse HEAD)
gh run list --branch main --limit 12 --json headSha,conclusion,name \
  --jq ".[] | select(.headSha==\"$SHA\") | \"\(.name): \(.conclusion)\""
```

Every line must say `success`. This is the same check as CLAUDE.md step 6.

## Step 7 — Goal-seek on CI failure

If either job fails:

```
gh run view <id> --log-failed | head -100
gh run download <id> -n playwright-report -D /tmp/pwreport
```

Diagnose from the real error trace + page snapshot. Don't guess. Fix → push → re-watch. Iterate until green.

If genuinely stuck (e.g. design ambiguity that needs Dann's input), fire a `PushNotification` with the specific blocker and pause for his decision.

## Step 8 — PushNotification on green

Once every run for the HEAD sha returns `success`, send a one-line notification:

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
