---
name: show-backlog
description: Display the TP Studio backlog grouped by status (open, parked, placeholder, won't-build), pulled from NEXT_STEPS.md + recent CHANGELOG entries. Matches the format Dann asks for repeatedly during sessions.
---

Pull the current backlog and render it in the format Dann likes. Steps:

1. Read `NEXT_STEPS.md` end-to-end.
2. Read the last 3 session entries from `CHANGELOG.md` for "recently completed" context.
3. Check open CI failures via `gh run list --branch main --limit 5 --json conclusion,headBranch,name`. Surface any current failure prominently.
4. Group the items by status using the exact headings below.

## Output format

```markdown
# TP Studio — Backlog (post Session N)

## 🎯 Critical-path v3-brief
<one-line status — usually "all closed">

## 🟢 Actively open (work could start tomorrow)

| Item | Effort | Notes |
| ---  | ---    | ---   |
| ...

## 📌 Placeholders (need a fleshing-out conversation first)

| Placeholder | What needs scoping |
| ---         | ---                |

## 🟡 Parked

| Item | Reason parked |
| ---  | ---           |

## 🔴 Deliberately won't build

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
- **Don't expand parked items into "open."** Parked items have a reason — surface the reason, don't quietly drop it.
- **Don't lose the "what's blocking the next step?" thread.** If an item depends on another (FL-CO2 on FL-EX8), note the dependency.
- **Honest effort labels.** Small / Medium / Large only — no fake precision like "2.5h."
- **Top-3 next-priority is your judgment call.** Default to: (1) anything unblocking other parked items, (2) low-cost / high-tidiness items like the 1-hour optimization pass, (3) biggest open feature.

## Why this skill exists

Dann asks for the backlog repeatedly during sessions. Doing it by hand each time means re-deriving the grouping, the format, and which items are stale. The skill standardizes both the lookup (NEXT_STEPS + CHANGELOG + gh) and the rendering. Saves 2–3 minutes per request and reduces format drift.
