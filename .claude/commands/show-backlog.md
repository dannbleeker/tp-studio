---
name: show-backlog
description: Display the TP Studio backlog grouped by status (open, deferred, parked, declined), pulled from NEXT_STEPS.md + recent CHANGELOG entries. Matches the format Dann asks for repeatedly during sessions.
---

Pull the current backlog and render it in the format Dann likes. Steps:

1. Read `NEXT_STEPS.md` end-to-end.
2. Read the last 3 session entries from `CHANGELOG.md` for "recently completed" context.
3. Check open CI failures via `gh run list --branch main --limit 5 --json conclusion,headBranch,name` (there is no `jq` on this box — use `gh`'s own `--jq`). Surface any current failure prominently.
4. Group the items by status using the exact headings below.

NEXT_STEPS.md carries ONLY unshipped work; its own top-level sections are the source of the grouping:
*Open* · *Deferred by decision* · *Parked pending an explicit ask* · *Known bugs* · *Declined* ·
*Out of scope* · *Reference*. Map them straight through — don't invent a status the file doesn't use.

## Output format

```markdown
# TP Studio — Backlog (post Session N)

## 🟢 Open (work could start tomorrow)

| Item | Effort | Notes |
| ---  | ---    | ---   |
| ...

## 🟠 Deferred by decision (reviewed, consciously not built)

| Item | Why deferred |
| ---  | ---          |

## 🟡 Parked pending an explicit ask

| Item | What needs deciding first |
| ---  | ---                       |

## 🐛 Known bugs

<if any open; note that a closed-without-fix record is NOT an open bug — surface it only if asked>

## 🔴 Declined / out of scope

<comma-separated terse list>

## ✅ Recently completed (last 3 sessions)

<one-line summary per session>

## ⚠️ Open CI failures

<if any; otherwise omit this section>

---

**TL;DR — what to do next, in priority order:** ...
```

## Discipline

- **Don't fabricate items.** Everything below the headings must trace back to either NEXT_STEPS.md or CHANGELOG.md. If a section would be empty, omit it.
- **Don't expand parked or deferred items into "open."** Both have a reason — surface the reason, don't quietly drop it. *Deferred* = reviewed and consciously not built; *Parked* = needs a Dann decision first. They are not the same status.
- **Don't lose the "what's blocking the next step?" thread.** If an item depends on another, note the dependency.
- **The buildable list is deliberately near-empty.** As of Session 206 exactly one item is Open. That's the honest answer, not a lookup failure — don't pad it by promoting deferred/declined work.
- **Honest effort labels.** Small / Medium / Large only — no fake precision like "2.5h."
- **Top-3 next-priority is your judgment call.** Default to: (1) anything unblocking other parked items, (2) low-cost / high-tidiness items like the 1-hour optimization pass, (3) biggest open feature.

## Why this skill exists

Dann asks for the backlog repeatedly during sessions. Doing it by hand each time means re-deriving the grouping, the format, and which items are stale. The skill standardizes both the lookup (NEXT_STEPS + CHANGELOG + gh) and the rendering. Saves 2–3 minutes per request and reduces format drift.
