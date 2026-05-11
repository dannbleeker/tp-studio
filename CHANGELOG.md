# Changelog

Reverse chronological. Entries are grouped by build session, not by release — the project has no version tags yet.

## Session 6 — Iteration 2, Phase 0: Foundations

Tooling and infrastructure that catches regressions throughout the rest of the iteration. No user-visible changes; the canvas is unchanged.

- **F0.1 GitHub Actions CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) — runs lint + type-check + Vitest + build on every push and pull request. Concurrency group cancels stale runs.
- **F0.2 Pre-commit hook** via `simple-git-hooks` + `lint-staged`. Biome runs on staged files; failing files block the commit. Installs on `pnpm install` via the `postinstall` script.
- **F0.3 Conventional-commits commit-msg hook** ([scripts/check-commit-msg.cjs](scripts/check-commit-msg.cjs)) — rejects messages that don't follow `type(scope)?: subject` with one of 11 allowed types. Merge / revert / fixup messages are skipped.
- **F0.4 `.editorconfig`** — UTF-8, LF, 2-space indent, trim trailing whitespace, insert final newline. Markdown opts out of trim (preserves trailing-space line breaks).
- **F0.6 Schema migration framework** ([src/domain/migrations.ts](src/domain/migrations.ts)) — forward-only migration loop with a `MIGRATIONS` registry and a `CURRENT_SCHEMA_VERSION` constant. `importFromJSON` walks documents forward to current before validating. Registry is empty today; Phases 1, 3, 6 will register migrations as they add schema fields. 5 new vitest cases.

F0.5 Storybook is deferred to a separate turn (Windows AppLocker risk on `npx storybook init`).

**Tests: 87 → 94.** TypeScript + Biome clean.

## Session 5 — Documentation pass

- Expanded [README.md](README.md) with quick start, performance hooks, type-safety hooks, storage seam, and a CLR rules table.
- New end-user manual: [USER_GUIDE.md](USER_GUIDE.md).
- New roadmap / parking lot: [NEXT_STEPS.md](NEXT_STEPS.md).
- This changelog.

## Session 4 — Maintainability round 3 + honorable mentions  (`3d5d0ae`)

**Top 10 under-the-hood improvements:**

1. **Node version pin.** `.nvmrc`, `.npmrc` (`engine-strict=true`), `package.json` engines field, and a preinstall guard script.
2. **Shared guards module** ([src/domain/guards.ts](src/domain/guards.ts)) — `isObject`, `isDiagramType`, `isEntityType`, `isEdgeKind`, `isStringArray`, `isTrueMap`.
3. **Stricter JSON import validation.** Every entity/edge field shape is checked; malformed input throws a descriptive `path.to.field` error.
4. **Manual Vite chunks.** Build splits into `react` / `flow` (xyflow + dagre) / `icons` (lucide) plus app chunks.
5. **Lazy `html-to-image`.** Dynamic import inside `exportPNG`; library ships only on first PNG export.
6. **`QuotaExceededError` handling** in storage.ts with a listener wired to a destructive toast.
7. **Debounced persistence.** New `src/services/persistDebounced.ts` — 200 ms idle write, synchronous flush on `Cmd+S` / `setDocument` / undo / redo / `beforeunload` / `visibilitychange`.
8. **Memoized layout + validation** via structural fingerprints in `src/domain/fingerprint.ts`. Title edits skip dagre.
9. **Warnings indexed by target id** in the Inspector. Replaced two O(N) `.filter()` passes with O(1) `Map` lookups.
10. **Tests for `slug` (8 cases) and `confirmAndDeleteEntity` (6 cases).**

**Honorable mentions:**

- **Brand types** `EntityId` / `EdgeId` / `DocumentId` — phantom-branded strings used across the domain layer, factory casts at the boundary.
- **`useShallow`** for multi-field store selectors in `useGlobalKeyboard` (11) and `Canvas` (6).
- **Preinstall script** (covered by item 1).
- **Tests for `useGlobalKeyboard`** — 11 RTL cases covering every shortcut.
- **`inert` attribute** on the collapsed Inspector for sequential-focus and screen-reader correctness.

**Tests: 62 → 87.**

## Session 3 — Maintainability round 2  (`5cea9ef`)

1. Storage abstraction module (`src/services/storage.ts`) replaced three independent feature-detection blocks.
2. RootStore type extracted to `src/store/types.ts` — broke the circular import between `index.ts` and the slice files.
3. Typed `canvasRef` singleton with `ReactFlowInstance<TPNode, TPEdge>`.
4. Toast IDs switched to `nanoid` (string) from `Date.now() + Math.random()` to avoid millisecond collisions.
5. New `useSelectedEntity` / `useSelectedEdge` / `useEntity` / `useEdge` hooks in `src/hooks/useSelected.ts`.
6. `ErrorBoundary` wraps `<App />` in `main.tsx`.
7. Direct tests for `src/domain/graph.ts` helpers — 10 cases.
8. `resetStoreForTest` helper. Each slice exports a `*Defaults()` factory; test setup uses the composed defaults instead of hardcoding every field.
9. Path aliases (`@/*` → `src/*`) configured in tsconfig + vite; sweep updated 28 source + 6 test files.
10. `noUncheckedIndexedAccess` flag enabled in tsconfig with fixes throughout.

## Session 2 — Maintainability round 1  (`78cae7a`)

1. `src/domain/constants.ts` collects magic numbers (history limits, CLR thresholds, layout sizes, sibling-nav tolerance, PNG export params, toast TTL).
2. `src/domain/tokens.ts` is the single source for colors (entity stripes, edge strokes, surface, grid). Tailwind config imports it.
3. `src/domain/graph.ts` hosts shared graph queries used by validators, store, and confirmations.
4. `tsconfig.json` enables `noImplicitReturns`.
5. `Button` primitive ([src/components/ui/Button.tsx](src/components/ui/Button.tsx)) with primary / ghost / softNeutral / softViolet / destructive variants.
6. `Modal` primitive + `useOutsideAndEscape` hook ([src/components/ui/Modal.tsx](src/components/ui/Modal.tsx), [src/hooks/useOutsideAndEscape.ts](src/hooks/useOutsideAndEscape.ts)). CommandPalette, HelpDialog, ContextMenu all migrated.
7. `Inspector.tsx` split into six files — `Inspector`, `EntityInspector`, `EdgeInspector`, `EdgeAssumptions`, `AttachedEdgesList`, `Field`.
8. Strongly typed RF node/edge data via `src/components/canvas/flow-types.ts` (`TPNode` / `TPEdge`).
9. Zustand store split into `documentSlice` / `uiSlice` / `historySlice` combined in `store/index.ts`.
10. Architecture section added to README.

## Session 2 (continued) — Assumptions feature  (`1ab367e`)

End-to-end UI for the last brief schema feature.

- Store actions: `addAssumptionToEdge`, `attachAssumption`, `detachAssumption`; cascade-delete scrubs assumption ids from edges.
- Edge inspector gains an "Assumptions" section with inline create / edit / detach / open.
- Entity inspector for an assumption entity shows an "Attached to" list of referring edges.
- 5 new tests in `tests/store/document.test.ts`.

## Session 2 — Brief-completing additions  (`1dad461`)

- Delete confirmation when an entity has connections.
- `Cmd+E` opens the palette pre-filtered to Export.
- "Run validation" palette command surfaces a toast with open / resolved counts.
- "Load example CRT" / "Load example FRT" palette commands populate a small pre-wired diagram.
- AND-junction dot rendered as a violet circle on each AND-grouped edge near the target — sibling dots stack into one visual junction.

## Session 2 — Deferred items, second pass  (`cf9ea33`)

- Tests for store mutations: groupAsAnd, ungroupAnd, undo with coalescing, history cap, persistence side-effect. **+12 tests.**
- Convert-type section in the entity context menu.
- Toast notifier (`Toaster.tsx`); `Cmd+S` triggers a success toast.
- Help dialog (`HelpDialog.tsx`) listing all keyboard shortcuts, reachable via palette and a HelpCircle button.
- Left/Right arrow keys move selection between same-rank siblings using live React Flow positions.

## Session 2 — Address flagged issues  (`1b95592`)

The first review surfaced gaps; this commit closed them.

- AND-grouping: store actions + multi-edge selection + palette commands + edge styling.
- Arrow-key navigation: ArrowUp follows an outgoing edge, ArrowDown follows incoming.
- Right-click context menu: entity (Add child / Add parent / Rename / Delete), edge (Delete), pane (New entity here).
- Layout animation via CSS transition on `.react-flow__node`.
- Bug fixes caught by the preview: React Flow had no measurable parent (switched to `h-screen`); Tailwind utilities weren't processing in dev (PostCSS config inlined into vite.config.ts); React Flow's default `zoomOnDoubleClick` was eating the pane double-click (disabled).

## Session 1 — Slice D: Export pipeline  (`1069e38`)

JSON download, JSON import (with file picker), PNG export at 2× resolution via `html-to-image`. A module-scoped React Flow instance ref lets palette actions reach into the live canvas from outside the React tree.

## Session 1 — Slice C: Inspector + palette + keyboard + theme  (`05ce890`)

Right inspector with title/description editing, type switcher, CLR warnings with Resolved/Reopen toggles. `Cmd+K` command palette with arrow/Enter nav. Global keyboard map. Undo/redo with 1 s coalescing window and 100-entry history. Dark mode toggle persisting to localStorage.

## Session 1 — Slice B: Canvas  (`6df5d16`)

React Flow + custom `TPNode` (colored stripe, inline title editing) + `TPEdge` (sufficiency arrow). Zustand store for document state. `useGraphView` bridges store doc → React Flow nodes/edges via dagre layout (bottom-to-top). Double-click to create, drag-handle to connect, click to select.

## Session 1 — Initial scaffold  (`98b4692`)

- Vite 5 + React 18 + TypeScript strict + Vitest + Biome.
- Domain layer first per the brief: types, 8 CLR validators (with 20 tests covering positive + negative for each rule), dagre layout wrapper, JSON + localStorage persistence with round-trip tests.
- **Tests: 35 green.**
