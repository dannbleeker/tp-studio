# TP Studio

A focused, modern alternative to Flying Logic for **Theory of Constraints Thinking Process** diagrams. Build sufficiency-logic graphs (Current Reality Trees, Future Reality Trees), let the tool auto-layout, and surface Categories of Legitimate Reservation (CLR) as soft warnings.

## Setup

```bash
pnpm install
pnpm dev
```

## Scripts

| Command           | What it does                  |
| ----------------- | ----------------------------- |
| `pnpm dev`        | Start Vite dev server         |
| `pnpm build`      | Type-check + production build |
| `pnpm preview`    | Preview the production build  |
| `pnpm test`       | Run Vitest test suite once    |
| `pnpm test:watch` | Vitest in watch mode          |
| `pnpm lint`       | Biome lint                    |
| `pnpm format`     | Biome format (write)          |

## Architecture

Four layers, with imports allowed only top-down:

```
components/    React components — canvas, inspector, palette, modals
   ↓
hooks/         Cross-cutting React hooks (keyboard, theme, dismissal)
   ↓
services/      DOM + browser-API glue (exporters, confirm dialog, RF instance ref)
   ↓
store/         Zustand store, split into documentSlice / uiSlice / historySlice
   ↓
domain/        Pure TypeScript: types, validators, layout, persistence, graph helpers,
               constants, tokens, factory, example documents
```

The **domain layer** is framework-free: no React, no DOM, no Zustand imports. It's the test surface and the part most likely to be reused. Every CLR rule lives in [src/domain/validators.ts](src/domain/validators.ts) as a pure function `(doc) ⇒ Warning[]`. Graph queries shared across layers live in [src/domain/graph.ts](src/domain/graph.ts).

The **store** is composed of three slices that share one root state object:

- [`documentSlice`](src/store/documentSlice.ts) — `doc` plus all mutations. Routes every mutation through an internal `applyDocChange` helper that persists to localStorage and pushes the previous doc onto the history stack.
- [`uiSlice`](src/store/uiSlice.ts) — selection, editing state, palette open/query, help dialog, theme, context menu, toasts.
- [`historySlice`](src/store/historySlice.ts) — `past` / `future` stacks, undo, redo. Exports a pure `pushHistoryEntry` helper that the document slice uses; coalescing keys collapse rapid same-field edits into one undo step.

`src/components/ui/` holds the design primitives ([`Button`](src/components/ui/Button.tsx), [`Modal`](src/components/ui/Modal.tsx)). Domain tokens live in [`src/domain/tokens.ts`](src/domain/tokens.ts) and are consumed by both Tailwind's config and individual components — change a brand color in one place.

Magic numbers (history limit, coalesce window, CLR thresholds, layout sizes, PNG export resolution) live in [`src/domain/constants.ts`](src/domain/constants.ts).

## Data model

The model is a typed directed graph. One canonical schema; diagram types (CRT, FRT) are projections of it. See [`src/domain/types.ts`](src/domain/types.ts).

Key shape decisions:

- **AND-junctions are not separate nodes.** They are an attribute on a group of edges sharing a target (`andGroupId`). The renderer draws the visual junction.
- **Assumptions are first-class entities** (type `'assumption'`) attachable to edges via `assumptionIds`.
- **Warnings are derived, never stored.** `validate(doc)` runs the 8 CLR rules on demand; resolution state for each warning is persisted in `doc.resolvedWarnings` keyed by a stable `ruleId:targetKind:targetId` identifier.

## Keyboard

| Keys                | Action                                  |
| ------------------- | --------------------------------------- |
| `Cmd/Ctrl+K`        | Command palette                         |
| `Cmd/Ctrl+E`        | Command palette pre-filtered to Export  |
| `Cmd/Ctrl+S`        | "Saved" toast (data autosaves anyway)   |
| `Cmd/Ctrl+Z`        | Undo                                    |
| `Cmd/Ctrl+Shift+Z`  | Redo                                    |
| `Esc`               | Close palette / deselect                |
| `Enter`             | Rename selected entity                  |
| `Tab` / `Shift+Tab` | Add child / parent of selected entity   |
| `↑` / `↓`           | Move selection along causal chain       |
| `←` / `→`           | Move selection to a same-rank sibling   |
| `Del` / `Backspace` | Delete selected (confirm if connected)  |
| Double-click pane   | Create entity at cursor                 |
| Right-click         | Context menu                            |
| Shift+click edges   | Multi-select (for AND grouping)         |

## Status

v1. All 12 acceptance criteria covered; assumptions and AND-grouping wired end to end; 52 vitest cases across domain and store.
