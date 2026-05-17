# TP Studio

A focused, modern alternative to Flying Logic for **Theory of Constraints Thinking Process** diagrams. Build sufficiency-logic graphs (Current Reality Trees, Future Reality Trees, Prerequisite Trees, Transition Trees, Evaporating Clouds), let the tool auto-layout (or hand-position for EC), and surface Categories of Legitimate Reservation (CLR) as soft warnings.

**Live demo:** <https://tp-studio.struktureretsundfornuft.dk/> — installs as a desktop / mobile PWA, works fully offline after first visit. Chrome and Edge will offer an Install prompt after a couple of visits; or open the command palette (`Ctrl/Cmd+K`) and pick **Install TP Studio…** to install on demand.

For end users — see [USER_GUIDE.md](USER_GUIDE.md). For what's planned next — see [NEXT_STEPS.md](NEXT_STEPS.md). For the change history — see [CHANGELOG.md](CHANGELOG.md). For security — see [SECURITY.md](SECURITY.md). For third-party trademark / attribution notices — see [NOTICE.md](NOTICE.md).

## Quick start

Requires **Node 22.22.1+** and **pnpm 10+** (enforced via `engines` in `package.json`).

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

**Empty preview after a structural change?** Vite's dep-pre-bundle cache (`node_modules/.vite/deps`) sometimes goes stale after a refactor that moves slices / adds directories / restructures the module graph — symptom is a blank dev preview while `pnpm build` is clean. Fix: stop the dev server, `rm -rf node_modules/.vite/deps`, restart `pnpm dev`.

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

The **store** is composed of three slice groups that share one root state object:

- [`documentSlice/`](src/store/documentSlice) — split into `docMetaSlice` (the `doc` field + setDocument/newDocument/setTitle), `entitiesSlice` (add/update/delete + assumption helpers), `edgesSlice` (connect/update/delete/reverse + AND-grouping), and `groupsSlice` (create/delete/rename/recolor + membership). Mutations route through a shared `applyDocChange` helper (built by `makeApplyDocChange` in `docMutate.ts`) that debounces persistence, pushes the previous doc onto the history stack, and clears the future stack.
- [`uiSlice/`](src/store/uiSlice) — split into `selectionSlice`, `preferencesSlice`, `dialogsSlice`, and `searchSlice`. Covers selection, editing state, palette open/query, help / settings / docSettings / quickCapture dialogs, theme + persisted prefs, context menu, toasts, and search.
- [`historySlice`](src/store/historySlice.ts) — `past` / `future` stacks, undo, redo. Exports a pure `pushHistoryEntry` helper used by the document slice; coalescing keys collapse rapid same-field edits into one undo step.

The combined root and the `resetStoreForTest` helper live in [`src/store/index.ts`](src/store/index.ts).

### Performance hooks

- **`useGraphView`** is composed of three stage hooks ([`useGraphProjection`](src/components/canvas/useGraphProjection.ts), [`useGraphPositions`](src/components/canvas/useGraphPositions.ts), [`useGraphEmission`](src/components/canvas/useGraphEmission.ts) — the last itself splits into node and edge emission so positional changes on manual-layout diagrams skip the edge bucket-aggregation pass). Layout is memoized against a structural fingerprint ([src/domain/fingerprint.ts](src/domain/fingerprint.ts)); title edits do not re-run dagre.
- **`Inspector`** memoizes `validate()` against a validation fingerprint and indexes warnings by target id once per render-cycle, replacing two O(N) `.filter()` passes per render.
- **`persistDebounced`** ([src/services/persistDebounced.ts](src/services/persistDebounced.ts)) coalesces a burst of mutations into one localStorage write 200 ms after typing stops. `Cmd+S`, `setDocument`, and `beforeunload` / `visibilitychange` all force a synchronous flush.
- **`html-to-image`** is dynamically imported inside `exportPNG` — the library ships only on the first PNG export, not on initial page load.
- **Manual Vite chunks** split `react` / `flow` (xyflow + dagre) / `icons` (lucide) into their own bundles for better cache reuse across deploys.

### Type-safety hooks

- **`noUncheckedIndexedAccess`** + **`noImplicitReturns`** are on in `tsconfig`.
- **Brand types** ([src/domain/types.ts](src/domain/types.ts)) — `EntityId` / `EdgeId` / `DocumentId` are phantom-branded strings. `Entity.id`, `Edge.sourceId`, `Edge.assumptionIds` etc. are typed; the factory casts at the boundary. Plain `string` is still accepted for external IDs coming from React Flow / file pickers.
- **Strict JSON import validation** ([src/domain/persistence.ts](src/domain/persistence.ts)) checks every field shape before construction. Malformed user-supplied JSON throws a descriptive error rather than crashing the canvas later.
- **Forward-only schema migrations** ([src/domain/migrations.ts](src/domain/migrations.ts)) — `importFromJSON` walks the parsed document through registered migrations to reach `CURRENT_SCHEMA_VERSION` before validation. Currently at v4: v1→v2 adds stable per-entity `annotationNumber` + `nextAnnotationNumber` on the document, v2→v3 introduces the `groups` map, v3→v4 reserves `Edge.label`.

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
  diagramType: 'crt' | 'frt' | 'prt' | 'tt' | 'ec';
  title: string;
  entities: Record<string, Entity>;
  edges: Record<string, Edge>;
  groups: Record<string, Group>;
  resolvedWarnings: Record<string, true>;
  nextAnnotationNumber: number;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 4;
  author?: string;
  description?: string;
};
```

Key shape decisions:

- **AND-junctions are not separate nodes.** They are an attribute on a group of edges sharing a target (`andGroupId`). The renderer draws a Flying-Logic-style junctor circle (a labelled "AND" circle just above the target; sibling edges terminate at the perimeter and a short outgoing line carries the arrow into the target).
- **Assumptions are first-class entities** (type `'assumption'`) attachable to edges via `assumptionIds`. The edge inspector exposes inline create / detach / open-entity affordances; the assumption entity's inspector lists the edges that reference it.
- **Groups** are shaded enclosures over entities. Nested, collapsible, draggable; collapsed groups aggregate inbound/outbound edges to a single card. Hoist drills into a group with breadcrumb to exit.
- **Layout strategy is per-diagram-type.** CRT / FRT / PRT / TT run dagre against the visible set; EC is `manual` — `Entity.position` lives in the schema and drives the canvas directly. See [`src/domain/layoutStrategy.ts`](src/domain/layoutStrategy.ts).
- **Warnings are derived, never stored.** `validate(doc)` runs the 8 CLR rules on demand; resolution state is persisted in `doc.resolvedWarnings` keyed by a stable `ruleId:targetKind:targetId` identifier.
- **Schema version is `4`.** Bumping requires a forward migration in [`src/domain/migrations.ts`](src/domain/migrations.ts); existing docs walk through the migration chain at import time.

## CLR rules

Eight rules, each its own file in [src/domain/validators/](src/domain/validators):

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

The full shortcut list — what's bound, how it's displayed in the help dialog, and which command-palette entries pick up the same key hint — is a single registry at [`src/domain/shortcuts.ts`](src/domain/shortcuts.ts). `HelpDialog` and the palette both read from it, and a source-text linkage test ([`tests/hooks/shortcutRegistry.test.ts`](tests/hooks/shortcutRegistry.test.ts)) fails CI if a hook-bound shortcut is added without a matching `// reg: <id>` marker in the keyboard hooks.

Highlights: `Cmd/Ctrl+K` palette · `Cmd/Ctrl+S` save · `Cmd/Ctrl+E` export menu · `Cmd/Ctrl+F` find · `Cmd/Ctrl+,` settings · `E` Quick Capture · `Cmd/Ctrl+C/X/V` clipboard · `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` undo / redo · `Cmd/Ctrl+Shift+S` swap two entities · `Cmd/Ctrl+Shift+→ / ←` select successors / predecessors · `+` `-` `0` zoom · `Esc` cascade (close panel → unhoist → deselect) · `Enter` rename / hoist · `Tab` / `Shift+Tab` add child / parent · `↑ ↓ ← →` arrow nav · `Del` / `Backspace` delete · double-click create · right-click context menu · `Shift`+click edges multi-select.

The implementation lives in two context-keyed hooks: [`useGlobalShortcuts`](src/hooks/useGlobalShortcuts.ts) (selection-agnostic) and [`useSelectionShortcuts`](src/hooks/useSelectionShortcuts.ts) (selection-dependent). `useGlobalKeyboard` is the 24-line composer.

## Testing

**1156+ tests** across the suite ([tests/](tests/)) as of Session 108. Coverage spans every layer:

- **Domain** — validators (one file per rule), persistence (round-trip + every malformed-input branch), graph helpers, layout, radial layout, Flying Logic import/export, search, groups, quick capture, palette score, shortcuts registry, layout strategy
- **Store** — document mutations, groups, AND grouping, assumption attach/detach, undo / redo / coalescing, history cap, cascade delete
- **Services** — `slug` edge cases, `confirmAndDeleteEntity` prompt logic, clipboard, browse lock, CSV import/export, markdown, annotations export
- **Hooks** — `useGlobalKeyboard` shortcut handling, `useSelectionShape` selection derivation, registry-link source-scan test
- **Components** — Inspector / EntityInspector / EdgeInspector / TopBar / ContextMenu / CommandPalette / HelpDialog / SettingsDialog (rendered with `@testing-library/react`)

Test helpers (`tests/helpers/seedDoc.ts`) provide `seedEntity` / `seedConnectedPair` / `seedChain` / `seedAndGroupable` so per-file boilerplate stays minimal.

Run `pnpm test`. Run `pnpm test:watch` while developing.

## Status

Iteration 2 shipped: navigation/search, multi-select, Quick Capture, groups (nesting + collapse + hoist), rich annotations (markdown descriptions, edge labels), the full export pack (JSON / CSV / PNG / JPEG / SVG / Flying Logic XML / annotations / PDF), and the polish/preferences bundle (Browse Lock, themes including high-contrast, edge-color palettes, animation speed, ink-saver print mode).

Tier 1 features (auto-recovery, reverse-edge, redact, F2–F4 / F6–F7 polish), Tier 2 diagrams (A1 Evaporating Cloud, A2 Prerequisite Tree, A3 Transition Tree) and Tier 3 (F5 radial alternate view + Session 99 obstacle-aware radial edge routing) all landed. Connector visuals carry Flying-Logic-style AND / OR / XOR junctors (Session 73). Goal Tree + EC creation wizards (Session 78), full template library + a11y audit (Session 79), vector PDF export (Session 80), structured S&T trees + Strategy/Tactics diagram type (Session 75), per-document custom entity classes with curated 57-icon Lucide picker (Sessions 70/76), revision history + side-by-side compare + named branches (Sessions 41 + 62), PWA install (Session 89), comprehensive security audit + CSP (Session 98), the 17-chapter *Causal Thinking with TP Studio* book + clickable-TOC PDF (Sessions 103/104; retitled Session 110), and the under-the-hood performance pass with three-sample perf-trace baseline (Sessions 105–108) all landed.

**1156+ tests green as of Session 108, TypeScript + Biome clean, `pnpm audit --prod` clean.**
