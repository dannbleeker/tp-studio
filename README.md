# TP Studio

A practitioner-focused canvas for **Theory of Constraints Thinking Process** diagrams. Open source, local-first, runs in your browser. Build the full set of TP diagrams — Current Reality, Future Reality, Prerequisite, Transition and Negative Branch trees, Evaporating Clouds, Goal Trees, Strategy & Tactics trees, plus free-form canvases — let the tool auto-layout (or hand-position for EC), and surface Categories of Legitimate Reservation (CLR) as soft warnings.

**Live demo:** <https://tp-studio.struktureretsundfornuft.dk/> — installs as a desktop / mobile PWA, works fully offline after first visit. Chrome and Edge will offer an Install prompt after a couple of visits; or open the command palette (`Ctrl/Cmd+K`) and pick **Install TP Studio…** to install on demand.

**📊 Live dashboard:** <https://tp-studio.struktureretsundfornuft.dk/dashboard.html> — repo pulse (commits, PRs, rhythm) live from the GitHub API, plus the CI-generated project metrics (lines, coverage, tests, doc coverage, trends).

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
| `pnpm mutation`     | Run Stryker mutation testing (see below)  |
| `pnpm lint`         | Biome lint                                |
| `pnpm format`       | Biome format (write)                      |

### Mutation testing

`pnpm mutation --mutate <file>` runs [Stryker](https://stryker-mutator.io) against a specific source file. Stryker introduces small synthetic bugs (mutants) into the source and checks whether the test suite catches each one — surviving mutants flag weak coverage even when line coverage is high. The HTML report lands at `reports/mutation/index.html` (gitignored).

Per-file run time on this codebase is **~9 min** (8m55s dry run + a few seconds per mutant; static mutants are skipped via `ignoreStatic: true`). Use this as a **spot-check tool** when tightening a specific module's tests, not as a regular CI gate. See [docs/decisions/0002-mutation-testing-as-spot-check-not-baseline.md](docs/decisions/0002-mutation-testing-as-spot-check-not-baseline.md) for the cost rationale.

```bash
pnpm mutation --mutate src/domain/paletteScore.ts
# open reports/mutation/index.html and look for surviving mutants
```

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
- **Forward-only schema migrations** ([src/domain/migrations/](src/domain/migrations)) — `importFromJSON` walks the parsed document through registered migrations to reach `CURRENT_SCHEMA_VERSION` before validation. Currently at **v10**: each step is its own file (`v1ToV2.ts` … `v9ToV10.ts`). Early steps add the per-entity `annotationNumber`, the `groups` map, and `Edge.label`; the most recent, `v9→v10`, collapses the old entity-modeled assumptions into first-class `doc.assumptions` records.

### Storage seam

[`src/services/storage.ts`](src/services/storage.ts) is the single point where the app touches `localStorage`. It feature-detects once, catches `QuotaExceededError` (and any other write error), and reports via a registered listener. The store wires that listener to a destructive toast so the user knows the in-memory document is no longer being persisted.

`STORAGE_KEYS` lists every key the app writes — two of them today (`doc`, `theme`).

### Design tokens

All entity colors, edge colors, surface colors, and the grid-dot color live in [src/domain/tokens.ts](src/domain/tokens.ts). The Tailwind config imports the same module so a brand-color change is a one-file edit.

Tunable magic numbers (history limit, coalesce window, CLR thresholds, layout separations, PNG export resolution, toast TTL, sibling-nav tolerance) live in [src/domain/constants.ts](src/domain/constants.ts).

## Data model

The model is a typed directed graph. One canonical schema; the nine diagram types are projections of it. See [src/domain/types/](src/domain/types) (split into `document.ts`, `entity.ts`, `edge.ts`, `clr.ts`, …).

```ts
type TPDocument = {
  id: DocumentId;
  diagramType:
    | 'crt' | 'frt' | 'prt' | 'tt' | 'ec'
    | 'goalTree' | 'st' | 'nbr' | 'freeform';
  title: string;
  entities: Record<string, Entity>;
  edges: Record<string, Edge>;
  groups: Record<string, Group>;
  resolvedWarnings: Record<string, true>;
  nextAnnotationNumber: number;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 10;
  author?: string;
  description?: string;
  // + optional, additive fields omitted here — layoutConfig, systemScope,
  //   methodChecklist, customEntityClasses, assumptions, comments, … (see document.ts)
};
```

Key shape decisions:

- **AND-junctions are not separate nodes.** They are an attribute on a group of edges sharing a target (`andGroupId`). The renderer draws a Flying-Logic-style junctor circle (a labelled "AND" circle just above the target; sibling edges terminate at the perimeter and a short outgoing line carries the arrow into the target).
- **Assumptions are edge annotations, not entities** — record-canonical (v10): each is a first-class `doc.assumptions` record carrying its host `edgeId`, text, and a lifecycle status/kind, no longer a `doc.entities` node and no longer in the `EntityType` union. Attachment is solely `record.edgeId` (per-edge lookups via the WeakMap-cached `assumptionsForEdge`). The edge inspector's Assumption Well exposes inline create / edit / status-and-kind chips / detach; the canvas renders each via a dedicated `TPAssumptionNode` (non-selectable) near its edge.
- **Groups** are shaded enclosures over entities. Nested, collapsible, draggable; collapsed groups aggregate inbound/outbound edges to a single card. Hoist drills into a group with breadcrumb to exit.
- **Layout strategy is per-diagram-type.** CRT / FRT / PRT / TT run dagre against the visible set; EC is `manual` — `Entity.position` lives in the schema and drives the canvas directly. See [`src/domain/layoutStrategy.ts`](src/domain/layoutStrategy.ts).
- **Warnings are derived, never stored.** `validate(doc)` runs the CLR rule set on demand; resolution state is persisted in `doc.resolvedWarnings` keyed by a stable `ruleId:targetKind:targetId` identifier.
- **Schema version is `10`.** Bumping requires a forward migration in [`src/domain/migrations/`](src/domain/migrations); existing docs walk through the migration chain at import time.

## CLR rules

The Categories of Legitimate Reservation surface as **soft, derived warnings**: `validate(doc)` runs the rule set on demand and nothing is stored except resolution state. The original eight rules have since grown to **30+** as diagram-specific and source-derived checks were added — the canonical list of ids is the `ClrRuleId` union in [src/domain/types/clr.ts](src/domain/types/clr.ts), each implemented in one or more files under [src/domain/validators/](src/domain/validators) and composed in [validators/index.ts](src/domain/validators/index.ts). Every warning is stamped with one of three tiers — **Clarity / Existence / Sufficiency** — which is how the CLR panel and inspector group them.

The eight foundational rules:

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

On top of those: diagram-specific rules (EC completeness, Goal-Tree single-apex, the TT action-locus check, S&T tactic-rollup, the `crt-*` build-quality nudges, the `nbr-*` shape checks) and system-dynamics / source-derived rules (`indirect-effect`, `cycle`, `long-arrow`, `loop-polarity`, `reinforcing-no-delay`, `logic-type-mismatch`). The full user-facing reference is [book appendix C](docs/guide/appendix-c-clr-rules.md). Some rules carry a one-click remedy (`WarningAction`).

The user can mark any individual warning **Resolved** in the inspector; the resolution persists in the document and survives export/import round-trips.

## Keyboard

The full shortcut list — what's bound, how it's displayed in the help dialog, and which command-palette entries pick up the same key hint — is a single registry at [`src/domain/shortcuts.ts`](src/domain/shortcuts.ts). `HelpDialog` and the palette both read from it, and a source-text linkage test ([`tests/hooks/shortcutRegistry.test.ts`](tests/hooks/shortcutRegistry.test.ts)) fails CI if a hook-bound shortcut is added without a matching `// reg: <id>` marker in the keyboard hooks.

Highlights: `Cmd/Ctrl+K` palette · `Cmd/Ctrl+S` save · `Cmd/Ctrl+E` export menu · `Cmd/Ctrl+F` find · `Cmd/Ctrl+,` settings · `E` Quick Capture · `Cmd/Ctrl+C/X/V` clipboard · `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` undo / redo · `Cmd/Ctrl+Shift+S` swap two entities · `Cmd/Ctrl+Shift+→ / ←` select successors / predecessors · `+` `-` `0` zoom · `Esc` cascade (close panel → unhoist → deselect) · `Enter` rename / hoist · `Tab` / `Shift+Tab` add child / parent · `↑ ↓ ← →` arrow nav · `Del` / `Backspace` delete · double-click create · right-click context menu · `Shift`+click edges multi-select.

The implementation lives in two context-keyed hooks: [`useGlobalShortcuts`](src/hooks/useGlobalShortcuts.ts) (selection-agnostic) and [`useSelectionShortcuts`](src/hooks/useSelectionShortcuts.ts) (selection-dependent). `useGlobalKeyboard` is the 24-line composer.

## Testing

**4,200+ tests** (≈4,150 unit + 92 Playwright e2e) across the suite ([tests/](tests/)) as of Session 186, at ~96% line / ~84% branch coverage. Coverage spans every layer:

- **Domain** — validators (one file per rule), persistence (round-trip + every malformed-input branch), graph helpers, layout, radial layout, Flying Logic import/export, search, groups, quick capture, palette score, shortcuts registry, layout strategy
- **Store** — document mutations, groups, AND grouping, assumption attach/detach, undo / redo / coalescing, history cap, cascade delete
- **Services** — `slug` edge cases, `confirmAndDeleteEntity` prompt logic, clipboard, browse lock, CSV import/export, markdown, annotations export
- **Hooks** — `useGlobalKeyboard` shortcut handling, `useSelectionShape` selection derivation, registry-link source-scan test
- **Components** — Inspector / EntityInspector / EdgeInspector / TopBar / ContextMenu / CommandPalette / HelpDialog / SettingsDialog (rendered with `@testing-library/react`)

Test helpers (`tests/helpers/seedDoc.ts`) provide `seedEntity` / `seedConnectedPair` / `seedChain` / `seedAndGroupable` so per-file boilerplate stays minimal.

Run `pnpm test`. Run `pnpm test:watch` while developing.

## Status

TP Studio is **feature-complete and heavily polished across 180+ build sessions** — all nine diagram types, the full CLR rule set, the complete export pack (JSON / CSV / PNG / JPEG / SVG / Flying Logic XML / annotations / multi-page vector PDF / PPTX), share links, self-contained HTML export, PWA install + offline, revision history with side-by-side compare and named branches, multi-document tabs with a persistent tree library, a Start workspace home, the Building-Blocks rail + Logic-check panel + method-path stepper, review comments, the unified Templates library, and a 25-chapter practitioner book.

The **change history is the source of truth** — see [CHANGELOG.md](CHANGELOG.md); what's planned next is in [NEXT_STEPS.md](NEXT_STEPS.md).

**~4,250 tests green as of Session 186 (≈96% line coverage), TypeScript + Biome clean, `pnpm audit --prod` clean.**

## License

TP Studio is dual-licensed. The two artefacts in this repository are governed by different licenses:

- **The software** — all source code under `src/`, `tests/`, `scripts/`, the build configuration, etc. — is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for the full text. Permissive use including commercial use, with attribution and a patent grant.
- **The book** — the practitioner guide in [`docs/guide/`](docs/guide/) (the source Markdown, the assembled EPUB, the PDF) — is licensed under **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**. See [LICENSE-BOOK](LICENSE-BOOK) for the full text + scope. Free for non-commercial use with attribution; commercial republishing or paid courses / consulting use requires prior written permission.

Third-party trademarks and third-party authors' work referenced in the book remain the property of their respective owners. See [NOTICE.md](NOTICE.md) for the trademark notices and the boundary between TP Studio's own license and what it doesn't grant rights to.
