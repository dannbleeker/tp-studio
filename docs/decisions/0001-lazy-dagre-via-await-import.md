# 0001. Lazy-load dagre via `await import` instead of `manualChunks` split

- **Status**: Accepted
- **Date**: 2026-05-14
- **Session**: 81 (see CHANGELOG)
- **Tags**: `bundle-size layout react-flow code-split`

## Context

Dagre is ~25 KB gzipped — a meaningful chunk of the eager-loaded JS we ship to users. It's used by exactly two call sites: `useGraphPositions` (every render of an auto-layout canvas) and `SideBySideDialog.Panel` (only when the H4 compare dialog is open).

Session 67 first tried splitting dagre out via Rollup's `manualChunks` config. The split didn't take — Rollup kept dagre in the `flow` chunk because `@xyflow/react` and dagre share too much surface area for Rollup to safely separate them. The fix was parked behind "would be nice but not blocking."

By Session 81 the eager critical path had grown enough that the 25 KB became worth reclaiming.

## Decision

Move dagre behind a dynamic `await import('@/domain/layout')` inside `useGraphPositions` and `SideBySideDialog.Panel`. Remove dagre from the `manualChunks.flow` hint so Rollup will place it in its own auto-split chunk.

Pattern:

```ts
let layoutModulePromise: Promise<typeof import('@/domain/layout')> | null = null;
const loadLayoutModule = () => {
  if (!layoutModulePromise) layoutModulePromise = import('@/domain/layout');
  return layoutModulePromise;
};
```

`useGraphPositions` keeps three branches:

- **manual layout** (Evaporating Cloud) → fully sync via `useMemo`; positions come from `entity.position`, no dagre needed.
- **radial layout** → also sync; the radial algorithm has no dagre dep.
- **dagre layout** → async via `useEffect` + `useState`; cold-load briefly shows empty positions until dagre arrives, then settles.

## Alternatives considered

- **Stick with `manualChunks.flow` split** — wouldn't work; previous attempt proved Rollup ignores it.
- **Lazy-load the entire `Canvas` component via `React.lazy`** — would also pull dagre off the eager path, but the first-paint cost of the whole canvas is much worse than dagre's. Canvas is the primary view; lazy-loading it adds a noticeable spinner to every cold load.
- **Replace dagre with a smaller layout library (elkjs subset, hand-rolled)** — too much risk; dagre's behaviour is dialed in across hundreds of tested-against fixtures.
- **Server-render layouts** — incompatible with the offline-first / no-server architecture.

## Consequences

**Good:**
- ~30 KB gzipped off the eager path (`flow` chunk 134 → 103 KB gz; new `layout-*.js` 31 KB gz lazy).
- EC-only users never pay the dagre cost.
- The pattern (module-level promise cache + `useEffect`-driven setState) is reusable for any other heavy module we want to defer.

**Bad / requires care:**
- First paint on a cold auto-layout diagram shows nodes at `(0, 0)` for ~1 paint frame before dagre arrives. Acceptable per Session 81 UX call, but a regression vs. the synchronous path.
- `useGraphPositions` now has THREE state paths (manual / radial / dagre) — slightly more complex code; mitigated by per-branch `useMemo` vs `useEffect` separation.
- Test setup for `useGraphPositions` needs to account for the async path. Existing tests opted to test `splitIntoComponents` + helpers directly rather than mount the hook.

## References

- `src/components/canvas/useGraphPositions.ts` — the three-branch implementation.
- `src/components/history/SideBySideDialog.tsx` — the second call site.
- `vite.config.ts` — `manualChunks.flow` no longer lists `dagre`.
- CHANGELOG.md, Session 81 entry — bundle-delta numbers.
- CHANGELOG.md, Session 67 entry — the parking rationale that this decision unparks.
