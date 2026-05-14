# Design decisions

Lightweight Architecture Decision Records (ADRs) for TP Studio. One file per non-obvious cross-cutting decision.

## Why this directory exists

Across the project's life there are recurring questions that look like "didn't we already settle this?" — for example:

- Why is dagre lazy-loaded?
- Why does `Modal` not put `aria-hidden` on the backdrop?
- Why does the test hook use `?test=1` instead of just always installing on `window`?
- Why per-doc `systemScopeNudgeShown` instead of a global preference?

Each is a real trade-off with a winning side and a losing side. The losing side keeps coming back because it's also defensible. The ADR captures *why we picked the side we did* so the next person (or the next Claude) can find the answer in 10 seconds instead of re-deriving it.

## Format

One markdown file per decision: `NNNN-short-slug.md`. Number monotonically (`0001-…`, `0002-…`). Use the template below.

```markdown
# NNNN. <Decision title>

- **Status**: Accepted | Superseded by 00NN | Deprecated
- **Date**: YYYY-MM-DD
- **Session**: NN (link to CHANGELOG entry)
- **Tags**: <space-separated; e.g. `layout dagre bundle-size`>

## Context

What we were trying to do. What constraint or observation forced a choice.

## Decision

What we picked, in 2–4 sentences.

## Alternatives considered

- **Option A** — why it would have worked, why we didn't pick it.
- **Option B** — same.

## Consequences

What this commits us to (good and bad). Anything a future change should look at first.

## References

- File paths the decision lives in.
- Linked sessions, CHANGELOG entries, related ADRs.
```

## When to write one

Write an ADR when:

- The decision affected ≥2 files or has cross-cutting implications.
- A reasonable engineer could have picked the other option.
- You expect to re-derive it more than once.

Don't write an ADR for:

- Local code-style picks (Biome handles those).
- Decisions that are obvious from the diff + the code-comments.
- One-off bug fixes.

## Naming

Slug should be short and searchable. `0003-lazy-dagre-via-await-import.md` over `0003-lazy-loading-discussion.md`.

## Index

The list below is alphabetical-by-slug for now. Once it grows past ~20 entries, add tag-based grouping.

- [0001 — Lazy-load dagre via `await import` instead of `manualChunks` split](0001-lazy-dagre-via-await-import.md)
