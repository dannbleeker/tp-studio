# TP Studio

A focused, modern alternative to Flying Logic for **Theory of Constraints Thinking Process** diagrams. Build sufficiency-logic graphs (Current Reality Trees, Future Reality Trees), let the tool auto-layout, and surface Categories of Legitimate Reservation (CLR) as soft warnings.

For end users — see [USER_GUIDE.md](USER_GUIDE.md). For what's planned next — see [NEXT_STEPS.md](NEXT_STEPS.md). For the change history — see [CHANGELOG.md](CHANGELOG.md).

## Quick start

Requires **Node 20+** and **pnpm 9+**.

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173. The first time you start, the app shows an empty CRT. Press `Cmd/Ctrl+K` and pick **Load example Current Reality Tree** to see a populated diagram in seconds.

## Scripts

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `pnpm dev`          | Start Vite dev server                     |
| `pnpm build`        | Type-check + production build             |
| `pnpm preview`      | Preview the production build locally      |
| `pnpm test`         | Run Vitest test suite once                |
| `pnpm test:watch`   | Vitest in watch mode                      |
| `pnpm lint`         | Biome lint                                |
| `pnpm format`       | Biome format (write)                      |

Two git hooks land via `simple-git-hooks` on `pnpm install`:

- **`pre-commit`** runs Biome (lint + format) on staged files via `lint-staged`. Failing files block the commit.
- **`commit-msg`** validates the message follows [Conventional Commits](https://www.conventionalcommits.org/) — allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, `style`, `revert`.

A GitHub Actions workflow at [.github/workflows/ci.yml](.github/workflows/ci.yml) runs lint + type-check + tests + build on every push and pull request.

## Architecture

Four layers, with imports allowed only top-down:

```
components/    React components — canvas, inspector, palette, modals, primitives
   ↓
hooks/         Cross-cutting React hooks (keyboard, theme, dismissal, selection)
   ↓
services/      DOM + browser-API glue (storage, exporters, confirm dialog,
               debounced persistence, canvas-instance ref)
   ↓
store/         Zustand store, split into documentSlice / uiSlice / historySlice
   ↓
domain/        Pure TypeScript: types, validators, layout, persistence, graph
               helpers, constants, tokens, factory, examples, fingerprints, guards
```

The **domain layer** is framework-free: no React, no DOM, no Zustand imports. It's the test surface and the part most likely to be reused.

The **store** is composed of three slices that share one root state object:

- [`documentSlice`](src/store/documentSlice.ts) — `doc` plus all mutations. Routes every mutation through an internal `applyDocChange` helper that debounces persistence, pushes the previous doc onto the history stack, and clears the future stack.
- [`uiSlice`](src/store/uiSlice.ts) — selection, editing state, palette open/query, help dialog, theme, context menu, toasts.
- [`historySlice`](src/store/historySlice.ts) — `past` / `future` stacks, undo, redo. Exports a pure `pushHistoryEntry` helper used by the document slice; coalescing keys collapse rapid same-field edits into one undo step.

The combined root and the `resetStoreForTest` helper live in [`src/store/index.ts`](src/store/index.ts).

### Performance hooks

- **`useGraphView`** memoizes dagre layout against a structural fingerprint ([src/domain/fingerprint.ts](src/domain/fingerprint.ts)). Title edits do not re-run layout.
- **`Inspector`** memoizes `validate()` against a validation fingerprint and indexes warnings by target id once per render-cycle, replacing two O(N) `.filter()` passes per render.
- **`persistDebounced`** ([src/services/persistDebounced.ts](src/services/persistDebounced.ts)) coalesces a burst of mutations into one localStorage write 200 ms after typing stops. `Cmd+S`, `setDocument`, and `beforeunload` / `visibilitychange` all force a synchronous flush.
- **`html-to-image`** is dynamically imported inside `exportPNG` — the library ships only on the first PNG export, not on initial page load.
- **Manual Vite chunks** split `react` / `flow` (xyflow + dagre) / `icons` (lucide) into their own bundles for better cache reuse across deploys.

### Type-safety hooks

- **`noUncheckedIndexedAccess`** + **`noImplicitReturns`** are on in `tsconfig`.
- **Brand types** ([src/domain/types.ts](src/domain/types.ts)) — `EntityId` / `EdgeId` / `DocumentId` are phantom-branded strings. `Entity.id`, `Edge.sourceId`, `Edge.assumptionIds` etc. are typed; the factory casts at the boundary. Plain `string` is still accepted for external IDs coming from React Flow / file pickers.
- **Strict JSON import validation** ([src/domain/persistence.ts](src/domain/persistence.ts)) checks every field shape before construction. Malformed user-supplied JSON throws a descriptive error rather than crashing the canvas later.
- **Forward-only schema migrations** ([src/domain/migrations.ts](src/domain/migrations.ts)) — `importFromJSON` walks the parsed document through registered migrations to reach `CURRENT_SCHEMA_VERSION` before validation. Today the registry is empty; future schema bumps register one migration each.

### Storage seam

[`src/services/storage.ts`](src/services/storage.ts) is the single point where the app touches `localStorage`. It feature-detects once, catches `QuotaExceededError` (and any other write error), and reports via a registered listener. The store wires that listener to a destructive toast so the user knows the in-memory document is no longer being persisted.

`STORAGE_KEYS` lists every key the app writes — two of them today (`doc`, `theme`).

### Design tokens

All entity colors, edge colors, surface colors, and the grid-dot color live in [src/domain/tokens.ts](src/domain/tokens.ts). The Tailwind config imports the same module so a brand-color change is a one-file edit.

Tunable magic numbers (history limit, coalesce window, CLR thresholds, layout separations, PNG export resolution, toast TTL, sibling-nav tolerance) live in [src/domain/constants.ts](src/domain/constants.ts).

## Data model

The model is a typed directed graph. One canonical schema; diagram types (CRT, FRT) are projections of it. See [src/domain/types.ts](src/domain/types.ts).

```ts
type TPDocument = {
  id: DocumentId;
  diagramType: 'crt' | 'frt';
  title: string;
  entities: Record<string, Entity>;
  edges: Record<string, Edge>;
  resolvedWarnings: Record<string, true>;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
};
```

Key shape decisions:

- **AND-junctions are not separate nodes.** They are an attribute on a group of edges sharing a target (`andGroupId`). The renderer draws the visual junction (a violet dot near the target plus an `AND` label at the midpoint).
- **Assumptions are first-class entities** (type `'assumption'`) attachable to edges via `assumptionIds`. The edge inspector exposes inline create / detach / open-entity affordances; the assumption entity's inspector lists the edges that reference it.
- **Warnings are derived, never stored.** `validate(doc)` runs the 8 CLR rules on demand; resolution state is persisted in `doc.resolvedWarnings` keyed by a stable `ruleId:targetKind:targetId` identifier.
- **Schema version is `1`.** Bumping requires a migration path through `importFromJSON` — the validator already gates on `schemaVersion === 1`.

## CLR rules

Eight rules, each a pure function in [src/domain/validators.ts](src/domain/validators.ts):

| Rule                          | Fires when                                                                  |
| ----------------------------- | --------------------------------------------------------------------------- |
| `clarity`                     | Title > 25 words, or ends with `?`                                          |
| `entity-existence`            | Empty title, or disconnected entity in a graph of more than 3 entities      |
| `causality-existence`         | Per edge — "does the cause inevitably produce the effect?" (always fires)   |
| `cause-sufficiency`           | Target has exactly one incoming edge with no AND group                      |
| `additional-cause`            | Terminal node (UDE in CRT, Desired Effect in FRT) has no incoming causes    |
| `cause-effect-reversal`       | CRT only — Root Cause with incoming, or UDE with outgoing                   |
| `predicted-effect-existence`  | FRT only — Injection with no outgoing                                       |
| `tautology`                   | Entity has one child whose title is >= 0.85 similar (Levenshtein)           |

The user can mark any individual warning **Resolved** in the inspector; the resolution persists in the document and survives export/import round-trips.

## Keyboard

| Keys                | Action                                  |
| ------------------- | --------------------------------------- |
| `Cmd/Ctrl+K`        | Command palette                         |
| `Cmd/Ctrl+E`        | Command palette pre-filtered to Export  |
| `Cmd/Ctrl+S`        | Flush debounced save + "Saved" toast    |
| `Cmd/Ctrl+Z`        | Undo                                    |
| `Cmd/Ctrl+Shift+Z`  | Redo                                    |
| `Esc`               | Close help / close palette / deselect   |
| `Enter`             | Rename selected entity                  |
| `Tab` / `Shift+Tab` | Add child / parent of selected entity   |
| `↑` / `↓`           | Move selection along causal chain       |
| `←` / `→`           | Move selection to a same-rank sibling   |
| `Del` / `Backspace` | Delete selected (confirm if connected)  |
| Double-click pane   | Create entity at cursor                 |
| Right-click         | Context menu                            |
| Shift+click edges   | Multi-select (for AND grouping)         |

## Testing

87 cases across the test suite ([tests/](tests/)). Coverage focuses on the layer most likely to catch regressions:

- **Domain** — validators (all 8 CLR rules, positive + negative), persistence (round-trip + every malformed-input branch), graph helpers, layout
- **Store** — document mutations, AND grouping, assumption attach/detach, undo / redo / coalescing, history cap, cascade delete
- **Services** — `slug` edge cases, `confirmAndDeleteEntity` prompt logic
- **Hooks** — `useGlobalKeyboard` shortcut handling (with manual RTL cleanup since `vitest` globals are off)

Run `pnpm test`. Run `pnpm test:watch` while developing.

## Status

v1 complete + three maintainability rounds. All 12 brief acceptance criteria covered; AND-grouping and assumptions wired end to end; CLR validation with persisted resolution; JSON + PNG export with stricter import validation; dark mode; undo/redo with coalescing; debounced persistence with quota-error fallback. 87/87 tests green, TypeScript + Biome clean.
