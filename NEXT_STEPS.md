# Next Steps

A parking lot. Nothing here is required for v1; everything is honest about what's deferred.

> **Sessions 105–108 — under-the-hood performance pass + perf-trace baseline.** Tier 1 (Session 105): WeakMap caching on `edgesArray` / `entitiesArray` (used by `incomingEdges` / `outgoingEdges` / `hasEdge` / `findCycles` / `removeEntityFromEdges` / `layoutFingerprint` / `validationFingerprint`), two-level WeakMap memo on `descendantIds`, lazy-loaded `PrintAppendix`, single-pass group bbox replacing 4× `Math.min(...map(...))`, `useShallow`-bundled `useDocumentStore` access in `TPEdge` + custom memo comparators on `TPNode` + `TPEdge`. Tier 2 (Session 107): `will-change: transform` on `.react-flow__viewport`, `requestIdleCallback` two-phase persistence with 1.5s fallback. Tier 3 (Session 108): fast-clone of `Doc` in `revisionsSlice` (replaces `JSON.parse(JSON.stringify)`), edit-heavy perf-trace scenario, percentile reporting (p50/p75/p95/p99/max) in the trace summary. New e2e infrastructure: `e2e/perf-trace.spec.ts` drives a 100-entity scenario through Playwright + CDP Tracing API; manual workflow_dispatch via `.github/workflows/perf-trace.yml` produces a `chrome://tracing`-loadable artifact. Bundle budget re-pinned: flow 110000, index 124000, icons 10500. **Three-sample baseline confirms no regressions across the full Tier 1/2/3 stack.** Tests still green; no production behavior change. Speculative items (workerized dagre, React Flow virtualization, indexed entity-type lookups, FL-LA4 incremental relayout) remain deferred until profile signal demands them — current baseline doesn't.

> **Session 104 — Visual regression baselines + Node 24 + book PDF.** Visual baselines for canvas + 10 dialogs landed via three `chore: refresh visual snapshot baselines` commits (PRs #2 / #3 / #4) using a dedicated `Update visual snapshots` workflow that uploads new PNGs as a workflow artifact. `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` opt-in clears the Node 16/20 deprecation warning on JS actions. `scripts/build-book-pdf.mjs` produces `docs/guide/Causal-Thinking-with-TP-Studio.pdf` (marked → Playwright `page.pdf({ outline: true })` for a clickable TOC + cover page).

> **Session 103 — *Causal Thinking with TP Studio* book.** (Originally titled *Thinking with TP Studio*; retitled Session 110.) 17-chapter practitioner guide + 6 appendices under `docs/guide/`. Companion to USER_GUIDE — method-first, tool-second. Screenshots produced by `e2e/guide-screenshots.spec.ts` (Playwright, driven via the `__TP_TEST__` hook); same workflow that refreshes visual-regression baselines also refreshes book screenshots. `docs/guide/AUTHORING.md` documents the refresh procedure for future UI changes. Initial screenshot set generated via one workflow run after this commit; the spec also acts as gesture-regression for the chapters' described paths.

> **Session 85 — under-the-hood pass complete (10 batches, 8 shipped + 2 audit-only).** Twenty maintainability / perf / test-coverage items planned across Phases 1 (A-D) and 2 (E-J); 8 batches shipped real changes, Batch G evaluated audit-clean (3 items not worth the trade), Batches E/F/H/I each carried at least one item that was already done or net-negative. Highlights: per-doc WeakMap memoization for `structuralEntities` + `validate` (saves cost transparently to every caller), property-based migration + CLR-totality coverage via fast-check, dedicated cold-path test for `useGraphPositions`'s lazy dagre import, `vite-plugin-checker` dev overlay, brand-ID consolidation for group selection, CI split into 3 parallel jobs. **1003 tests passing**; full breakdown in CHANGELOG Session 85.

> **Iteration 2 complete.** Bundles 1, 2, 3, 5, 6, 11, 13 all shipped (see Bundle sections below for the per-bundle close-out notes). The original `docs/iteration-2-prd.md` requirement document has been deleted as completed-and-archived; CHANGELOG entries for Sessions 60 / 61 / 76 + the Bundle tables in this file are the durable record.

> **Top-10 refactor pass complete (Sessions 32–36).** All ten items from the
> internal "top-10 cleanup" list have landed: subscription consolidation,
> entity/edge patch helpers, Canvas component extraction, commands.ts split,
> declarative shortcut registry, documentSlice + uiSlice splits, flyingLogic.ts
> split, useGraphView split into three composed hooks, and the
> canvas/inspector/settings component-test safety net. Each is documented in
> CHANGELOG Sessions 32–36. The codebase is structurally cleaner for Iteration 2.

> **Next-batch under-the-hood complete (Sessions 38–40).** All ten items
> from the second top-10 audit landed: useGlobalKeyboard split into
> context-keyed sub-hooks, CI workflow tightening, validators per-rule,
> exporters per-format, examples per-diagram, `useSelectionShape` hook,
> shared `tests/helpers/seedDoc.ts`, `paletteScore` extracted to its own
> module with direct tests, `useGraphEmission` split into node + edge
> emission (positional changes on EC drag now skip the edge pass), README
> architecture audit. Plus a bonus drop of the stale `tokens.js` +
> `tokens.d.ts` duplicates flagged by Biome.

> **Session 19 — Tier 1 from the feature-research menu is in.** A4 / A5 / A6 / A7 / F2 / F3 / F4 / F6 / F7 all landed; see the CHANGELOG entry. The original `docs/feature-research.md` catalogue has since been deleted as completed-and-archived; the Tier 2 / Tier 3 / Tier 4 sections below carry the per-tier close-out notes.

> **Bundle 4 + B + E + N plan complete (Sessions 46–51).** Block 0 (refactor pre-work), Block A (Layout Controls — LA1/LA2/LA3), Block C (CLR rules E2/E3/E5/E6), Block B (B3 icons + B5 zoom-up + B8 batch-edit), and Block D (N1 OPML + N2 DOT + N3 Mermaid exports) all landed. 408/408 tests green. Deferred items listed below; the new batch of TOC-reading ideas from "Thinking with Flying Logic" follows after that.

> **TOC-reading set complete (Sessions 52–59).** All 24 items derived from the "Thinking with Flying Logic" reading are now shipped — across Reasoning helpers, Workflow & process, Analysis features, Diagram operations, Mental model, and Reasoning text output. 546/546 tests green.

> **Iteration-2 Bundles 2 + 6 complete (verified + sealed Session 60).** Bundle 2 (Multi-select & Bulk Editing) was already shipped across earlier sessions — the audit caught that the backlog had drifted. Bundle 6 (Rich Annotations) closed out with the new `Edge.description` markdown field; the "styled text in titles" leg of FL-AN4 was deliberately rejected (titles stay plain).

> **Iteration-2 Bundles 11 + 13 complete (audited + sealed Session 61).** Bundle 11 (Groups advanced) had all five FL-GR items shipped logically; Session 61 added the missing UI surface for nesting (Group inspector "Nest into parent group" picker). Bundle 13 (Polish & Preferences) closed out with the FL-TO3 default-direction preference and FL-TO1's four named dark theme variants (Rust / Coal / Navy / Ayu). **All approved Iteration-2 bundles (1, 2, 3, 5, 6, 11, 13) are now complete.**

> **Tier-4 versioning complete (Sessions 41 + 62).** H1 revision history (Session 41), plus H2 visual diff overlay, H4 side-by-side dialog, and H3 named branches (all Session 62) deliver the full revisioning surface. H5 (confidence-weighted what-if) → moved to won't-build in Session 84 (Bucket C was dropped; H5 has no signal to scale).

> **LA5 complete (Session 63).** Per-entity pinned positions now work on every diagram type via the existing `Entity.position` field — no schema change. Drag-to-pin gesture, pin indicator on auto-layout diagrams, per-entity Unpin in the context menu, and a Reset-layout palette command to clear everything.

> **Markup-format thread closed (Session 64).** N3 Mermaid IMPORT (round-trips with the Block-D export) and N5 VGL-like declarative export both ship. Every Block-D interop format (OPML / DOT / Mermaid / reasoning narrative + outline / VGL) is now in the export menu; Mermaid is the only one that's bi-directional via the new file picker.

> **Goal Tree + EC creation wizards (Session 78).** Dismissible "Get started" panel anchored top-left of the canvas. 5 steps per diagram (Goal → CSF 1/2/3 → first NC; A → B/C → D/D′). Each Next-click commits an entity / fills a slot live, so partial dismissals always leave the canvas in a useful state. Skip-step + Minimise + Dismiss-X + "Don't show this again" checkbox. Two new persisted prefs (`showGoalTreeWizard` / `showECWizard`, default on); Settings → Behavior toggles. Palette command `Reopen creation wizard`. 14 new tests covering preference-driven open, slice action shape, cross-kind switch, preference round-trip. **891 tests passing** (was 877). Implements the "wizard OR straight to canvas" UX choice — first-time users get guided, returning users skip silenceable, power users turn off in Settings.

> **Parked-extras sweep — lazy dagre, S&T inline edit, EC wizard polish, Storybook (Session 81).** Closes four backlog items that had been parked. **Lazy-load dagre**: useGraphPositions now `await import('@/domain/layout')` inside a useEffect, splitting dagre into its own ~31 KB gzip chunk — `flow` ceiling drops 134 KB → 103 KB gzip (net ~30 KB off the eager path). Manual-layout (EC) and radial branches stay synchronous; only dagre defers. **S&T 5-facet inline editing**: double-click any of the four canvas facet rows (NA/Strategy/PA/SA) to swap into a textarea; Enter / blur commits via `setEntityAttribute`, Esc cancels, empty clears via `removeEntityAttribute`, Browse Lock gated. **EC + Goal Tree wizard refinements**: step-change effect now actually fires (was mount-only); Esc-with-non-empty-draft surfaces an "Press Esc again to discard…" inline band before closing; skipping a step flashes a grey notice; EC pre-seed missing-slot warns via `log.warn`. **Storybook**: minimal install (just `storybook` + `@storybook/react-vite` + `@storybook/react`, no addon bloat); 6 `*.stories.tsx` files for Button / Modal / MarkdownPreview / ErrorBoundary / Field / MarkdownField. **954 tests still passing** (no regressions; story files aren't test files). Bundle-budget bumped to reflect new chunk shapes (flow tighter, index loosened to match v3-brief feature accretion).

> **True vector PDF export — last v3-brief critical-path bundle (Session 80).** Closes 8.1 + 8.6 + 8.8 + 8.13 in one pass. Picked `jspdf` + `svg2pdf.js` over the brief-named `react-to-pdf` because that library is a `html2canvas` wrapper (raster, not vector). New `src/services/pdfExport.ts` snapshots the live canvas SVG, slices vertically into N pages when the diagram exceeds page-height, renders each page through svg2pdf so paths/text stay vector. Optional annotation appendix paginated via `pdf.splitTextToSize`. Header/footer bands with `{pageNumber}` / `{pageCount}` placeholders resolved per-page. Selection-only filter mirrors the existing print-CSS path. **Font trade-off**: jspdf's Helvetica fall-back is Latin-1 only; CJK / Cyrillic / accented content should use the browser-print path (system fonts). Bundle: jspdf (115 KB gzip) + svg2pdf (25 KB) + html2canvas peer (47 KB) all lazy. **954 tests passing** (was 941; +13 in `tests/services/pdfExport.test.ts`). Also dropped the stale "Confidence field UI" line from Recommended priorities (`Entity.confidence` was removed from the schema in Session 71 — the backlog entry pre-dated that decision).

> **Brief v3 — templates / multi-goal soft warning / a11y / print-selection (Session 79).** Six items from the v3 backlog in one pass. **3.3 reframed** as a soft dismissible CLR warning (`goalTree-multiple-goals`, tier `clarity`) that lets users continue with multiple goals; previous hard refusal in `addEntity` is removed. **One-click action infrastructure** — Warnings now carry an optional `action?: { actionId, label }` and a new `WARNING_ACTIONS` registry dispatches handlers; first handler `convert-extra-goals-to-csfs` converts every `goal` except the oldest (by `annotationNumber`) into a `criticalSuccessFactor`. **3.4 dropped from backlog** — CSF-count soft warning was too noisy. **10.1 + 10.2 — templates library**: 10 curated specs (2 Goal Trees + 5 ECs + 3 CRTs), `buildTemplate(spec)` inflator, framework-free SVG `templateThumbnailSvg`, semantic `<dialog>` picker with focus trap, "New from template…" palette command. **11.3 — a11y audit**: shared `useFocusTrap` hook, PrintPreviewDialog + AssumptionWell + InjectionWorkbench + VerbalisationStrip + CreationWizardPanel all hardened (aria-labels, aria-live, semantic elements, focus rings). **8.12 — Print selection only**: checkbox in print preview, gated on a non-empty selection, hides non-selected nodes + edges via `visibility: hidden` so canvas geometry stays intact. **941 tests passing** (was 891; +9 in goalTreeMultipleGoals + 41 in templates). Remaining critical-path items: react-to-pdf install + true vector PDF (8.1, 8.6, 8.8) + embed fonts (8.13, depends on 8.1).

> **Brief v3 alignment — themes 1.8/1.9/2/4/6/8/9 (Session 77).** The big v3-brief alignment pass. **Schema v6 → v7**: first-class `Assumption` records (status / injectionIds / resolved), `Edge.kind: 'sufficiency' | 'necessity'`, explicit `Entity.ecSlot`, new `'goalTree'` diagram type, migration walks pre-v7 docs and reshapes EC + assumption data. **Verbalisation generator** (`domain/verbalisation.ts`) — pure token-list builder for the EC verbal form with click-through anchors. **EC inspector**: AssumptionWell (status chips), InjectionWorkbench (link/unlink + implemented toggle), VerbalisationStrip (above the canvas + as an inspector tab), three-tab structure on EC docs. **EC completeness rules** (5 brief-prescribed checks merged into `ec-completeness`). **Lightning-bolt EC mutex visual** (⊥ → ⚡). **Keyboard**: Cmd+\\ closes inspector, A on selected edge adds an assumption. **Self-contained HTML viewer** (`domain/htmlExport.ts` + palette command) — single file, no network, base64-embedded JSON payload. **Print preview modal** with mode picker (Standard / Workshop / Ink-saving), annotation-appendix toggle, header/footer merge fields. The brief's entity-type rename was deliberately NOT applied. **877 tests passing** (was 863; +14 across `verbalisation` and `htmlExport` test files). Remaining v1 critical-path items: EC guided wizard (4.1), templates library (10), Goal Tree creation wizard (3.2-3.4), accessibility audit (11.3), `react-to-pdf` install + true vector PDF (8.1, 8.6, 8.8).

> **Parked-item sweep (Session 76).** Six polish items + Bundles 1/3/5 reconciliation. **Radial layout polish**: subtree-weighted angular allocation keeps children near their parent (was uniform-per-ring). **Full-Lucide icon picker**: catalogue 17 → 57 icons + filter input + search hint in `CustomEntityClassesSection`. **FL round-trip for OR / XOR / weight**: extended the FL writer/reader to preserve all three Bundle 8 features (was AND-only). **S&T-specific CLR rule** `st-tactic-assumptions`: fires when a tactic has fewer than three necessaryCondition feeders. **First-class S&T 5-facet rendering**: `ST_FACET_KEYS` reserved attributes flip an injection into a tall 5-row card (NA / Strategy / PA / Tactic / SA); inspector grows a 4-textarea S&T-facets section gated on `'st'` + `injection`. **Bundles 1/3/5 reconciled** — all items already shipped, tables now ✅-marked. **863 tests passing** (was 848; +15). Icons bundle budget bumped 8.5 KB → 12.5 KB deliberately.

> **Bundle 10 closed (Session 75).** Two new diagram types: **FL-DT4 Strategy & Tactics Tree** (`'st'` — palette tuned for the goal / injection / necessaryCondition facets, 6-step S&T method checklist, example builder showing a 2-level decomposition) and **FL-DT5 Freeform Diagram** (`'freeform'` — no built-in TOC types, empty method checklist, type-pattern-matching CLR rules skip the diagram entirely; custom classes layer on top). Both ride the existing entity/edge model — no schema change. Also fixed a Session-72 bug: `isEntityType` was missing `'note'`, which would have rejected any JSON import carrying a note. **848 tests passing** (was 825; +18 for the dedicated Bundle 10 test file plus existing tests now covering the new diagram types).

> **FL-EX9 + FL-CO1 + tooling reconciliation (Session 74).** Two user-facing features from Bundle 12 plus a tooling-group audit. **FL-EX9 backup-slot recovery**: a third autosave slot (`docBackup`) holds the prior committed doc so a corrupted main slot falls back gracefully; the boot path surfaces a recovery toast when this happens. **FL-CO1 read-only share-links**: gzip + base64-url encoding into a `#!share=` URL fragment; new "Copy read-only share link" palette command; the receiver opens the URL and the doc loads with Browse Lock auto-engaged. **Tooling reconciliation**: `simple-git-hooks` + `lint-staged` + `scripts/check-commit-msg.cjs` + `.editorconfig` were all already in place — the backlog was stale. Storybook deferred with a "wait for primitive count to double" trigger. **825 tests passing** (was 813; +12 for `persistenceRecovery` + `shareLink`).

> **Bundle 8 closed (Session 73).** Structural edge operators: **FL-ED1 edge polarity** (`Edge.weight: 'positive' | 'negative' | 'zero'` — metadata field, surfaced as a 4-button Polarity picker in the Edge Inspector + small `−` / `∅` badges on negative / zero edges); **FL-ED3 XOR junctor** (`Edge.xorGroupId` — rose junctor circle); **FL-ED4 explicit OR junctor** (`Edge.orGroupId` — indigo junctor circle). All three share infrastructure with the existing AND junctor: `ANDOverlay` generalized into `JunctorOverlay`; one shared `groupAs(kind, …)` helper backs the six new actions (`groupAsOr` / `ungroupOr` / `groupAsXor` / `ungroupXor` plus the existing AND pair). Cross-kind exclusivity enforced at the store + persistence layers — an edge belongs to at most one junctor kind. ContextMenu + MultiInspector + command palette all carry the three Group-as variants and matching Ungroup actions. **813 tests passing** (was 802; +11 for `junctorGroups.test.ts`).

> **Bundle 4 + Bundle 7 closed (Session 72).** Backlog audit + FL-ET7 build. **Bundle 4 — Layout Controls** was reconciliation only: FL-LA1/LA2/LA3/IN1 (direction / bias / compactness / Layout Inspector panel) all shipped in Session 47 and live in Settings → Layout; the backlog was stale. **Bundle 7 — Custom Entity Classes**: FL-ET6 (CSF) is a built-in (`criticalSuccessFactor`); FL-ET8/ET9/IN3 shipped Sessions 70+71; FL-IN5 (tabs per element type) rejected on UX grounds (sectioned inspector already groups cleanly); only **FL-ET7 Note entity** was real work. Notes are free-form annotations outside the causal graph — yellow-stripe sticky-note card, no connection handles, skipped by CLR rules and causality exports, available in every diagram's palette. FL "Note" round-trips through Flying Logic. **802 tests passing** (was 792; +10 for `noteEntity.test.ts`).

> **Confidence removed + CI hardening + B7/B10 finish-the-job (Session 71).** Three threads merged: (1) **Confidence dropped from the schema** — the parked `Entity.confidence?: number` field is gone (deliberate product decision, not deferral); old JSON imports silently drop the field. (2) **CI hardening** — `scripts/pin-coverage-thresholds.mjs` ties Vitest thresholds to measured coverage, Playwright e2e expanded with delete-flow + undo-redo + canvas visual-regression specs. (3) **B7/B10 closed out** — `Edge.attributes` mirrors `Entity.attributes` (B1), custom entity classes can pick from a curated 17-Lucide-icon palette (B2), and three CLR validators (`causeEffectReversal`, `predictedEffectExistence`, `ecMissingConflict`) now treat custom classes as their `supersetOf` built-in (B3). New reverse-reach badge mirrors UDE-reach: every entity gets a sky `←N root causes` pill (toggle in Settings) — Core Driver inverse signal (E2). **792 tests passing** (was 787). Remaining backlog: lazy-load dagre (parked since Session 67), full-Lucide-library icon picker (deferred behind UX question).

> **B7 + B10 — structural extensibility (Session 70).** The big one from the backlog. Two paired features shipped together: **B7 user-defined attributes** (`Entity.attributes?: Record<string, AttrValue>` — string/int/real/bool tagged-union values, key/value editor in the EntityInspector below the warnings list) and **B10 custom entity classes** (`TPDocument.customEntityClasses?: Record<string, CustomEntityClass>` — per-doc user-defined types with custom label/color/`supersetOf`, manager UI in the DocumentInspector, palette extension across EntityInspector / MultiInspector / ContextMenu, doc-aware `resolveEntityTypeMeta` lookup, foreign-format export fallback for Mermaid + DOT). Schema bumped v5 → v6 with an additive migration. 787 tests passing (was 764). The structural-extensibility tier is now closed; remaining backlog: **Confidence field UI**, lazy-load dagre, Playwright e2e expansion.

> **Test-coverage sweep (Session 69).** Filled 20 test gaps identified by a post-session-68 audit (+120 tests, **644 → 764 passing**). New test files cover: toast dedup, `PersistScheduler` class, `useFingerprintMemo` hook, shared `pickFile` pipeline, `logger` test-mode silence, `ConfirmDialog` component, image-exporter early-return paths, `canvasRef` + `entityRefs` helpers, soft `persistence` validators, `redact` content-scrub, `layoutFingerprint` vs `validationFingerprint` boundaries, `guards`, save→reload round-trip, Browse-Lock + ConfirmDialog interaction, shortcut-registry uniqueness, `TPNode` + `TPEdge` smoke renders, 8 overlay components smoke, and `formPrimitives`. Writing the tests caught **two real bugs**: a duplicate Z-index scale (mine in `constants.ts` shadowed the canonical `domain/zLayers.ts`) and a missing Browse-Lock check in `confirmAndDeleteEntity` / `confirmAndDeleteSelection` (the confirm prompt would open even while the doc was locked).

> **Second code-quality sweep (Session 68).** 18 of 20 items shipped from a fresh audit; 2 evaluated audit-clean (`#7` keyboard hooks already documented, `#17` no `'auto'` theme to wire). Highlights: `Brand<T, B>` type helper collapses the four hand-rolled brand definitions, `Z_LEVELS` names the stacking-order scale, `src/domain/ids.ts` centralizes branded-id construction, `DataComponent` enum makes test selectors compile-checked, `services/logger.ts` routes production `console.*` calls through a test-aware wrapper, `React.memo` on `TPNode` + `TPEdge` cuts cascading re-renders on multi-entity graphs, `PersistScheduler` class replaces module-level mutable state, `TitleBadge` extracted from `App.tsx`, `formPrimitives.tsx` extracted from `SettingsDialog` (456 → 338 lines), `RevisionRow` extracted from `RevisionPanel` (402 → 234 lines), `persistenceValidators.ts` extracted from `persistence.ts` (366 → 130 lines), `Selection` narrowed to branded `EntityId[]` / `EdgeId[]`, toast dedup, and a migration round-trip test suite. 644 tests passing.

> **Code-quality sweep (Session 67).** 19 of 20 items from a code-quality audit shipped: `errorMessage` helper, dead-export trim, slice ARCHITECTURE.md, pnpm engine pin, bundle-size budget in CI, non-null-assertion cleanup in csvImport, nested ErrorBoundaries, narrowed WalkthroughOverlay selector, vitest coverage in CI, KebabMenu keyboard nav (ArrowUp/Down + Home/End + Tab), aria-keyshortcuts on TopBar, toast-not-alert for importers + edge commands, `useFingerprintMemo` hook (removes 3 biome-ignores), `FilePicker` shared pipeline, branded EntityId at `reachableForward`/`reachableBackward`, native `<dialog>` for SideBySideDialog, async `ConfirmDialog` replacing `window.confirm` across 5 sites, Playwright e2e scaffolding with CI integration. 639 tests passing, tsc/Biome clean, build green.
>
> The one item that didn't ship: **lazy-load dagre**. Attempted via Rollup `manualChunks.dagre` split; Rollup kept dagre in the `flow` chunk anyway (likely because @xyflow/react and dagre share too much surface for Rollup to split safely). The genuine fix is a `dynamic import('@/domain/layout')` inside `useGraphPositions` with Suspense fallback — cascades `await` through every caller. ~~**Parked.**~~ ✅ **Done (Session 81).** Lazy-loaded via `await import('@/domain/layout')` inside the effect; dagre now lives in its own ~92 KB / 32 KB-gzip `layout-*.js` chunk. Session 99 added `tests/build/dagreLazyLoadBoundary.test.ts` as a regression guard: it grep-walks `src/` and fails if anything statically imports `dagre` or `@/domain/layout`.

> **Type-error sweep + top-10 refactor pass (Session 66).** Cleared the five lingering TypeScript errors (SideBySideDialog adapter for the current `computeLayout` signature, missing `DefaultLayoutDirection` / `LayoutMode` re-exports from `@/store`, branded-id casts in `coreDriver`, `Omit<…, 'id'>`-aware keyof iteration in `docMutate`). Plus ten structural refactors: `structuralEntities` reuse, `NODE_HALF_*` + `ZOOM_UP_THRESHOLD` centralized in `constants.ts`, `withWriteGuard()` higher-order wrapper across all palette commands, `docToLayoutModel()` adapter in `domain/layout.ts`, `useToolbarActions` shared hook for TopBar + KebabMenu, `getEntity()` + `pinnedEntities()` helpers in `domain/graph.ts`, and tests on the `seedDoc.ts` helper path. tsc / Biome / 620 tests / build all green.

> **Mobile / narrow-viewport pass complete (Session 65).** A new `KebabMenu` component lives at the right edge of the TopBar with `sm:hidden`, surfacing the four buttons (Layout Mode, History, Help, Theme) that the existing responsive classes hide below `sm` (640 px). Items auto-close the menu after activation; Escape and outside-click also dismiss. TitleBadge's narrow-viewport `max-w-` bumped from `100%-7rem` to `100%-9rem` to leave room for the extra icon. The Inspector and RevisionPanel already overlaid with tap-to-dismiss backdrops below `md:`, so no changes needed there. 8 new tests in `tests/components/KebabMenu.test.tsx` (628 total, all green). **The remaining backlog is the structural-extensibility tier**: **B7 + B10** (user-defined attributes + custom entity classes) and the parked **confidence-field UI**.

## Maintainability backlog (post-Sessions 112–114)

Items surfaced by the Tier 1/2/3 maintainability arc that didn't ship and are worth picking up in a focused future session. Tagged by suggested next-step shape.

- **React 19 upgrade.** TP Studio is on `react@^18.3.1`. React 19 is GA and pairs naturally with the React Compiler (Session 114 audit concluded the codebase is likely Compiler-friendly). Migration cost: refs become forwarded props, lifecycle method changes, `react-dom` flag shifts, possible `@xyflow/react` peer-deps recheck. Dedicated session; not bundled with maintainability work because the API surface change is real. Pair with React Compiler enablement (one full pass of `babel-plugin-react-compiler` + `eslint-plugin-react-compiler`).
- **Tier-2 #6 — `exactOptionalPropertyTypes` flag flip.** Session 112 evaluated and reverted: 272 errors surface immediately. Cleanup is mechanical (mostly domain types updating `field?: T` → `field?: T \| undefined` to accept callers passing `field: someValue` where `someValue` may be undefined). A half-session of grind work; the surface area is the bottleneck, not the per-fix difficulty.
- **Tier-3 #14 — Lazy-load `MarkdownPreview` + DOMPurify + micromark.** Session 114 audit (`pnpm visualize` → `dist/bundle-stats.html` treemap) shows the eager index chunk's biggest contributors after our own component code are DOMPurify (~18 KB gz) and the micromark parser stack (~25 KB gz). Both load only because `MarkdownPreview` is currently eagerly imported by `Inspector`. Lazy-loading would shave ~30 KB gz off the eager critical path but adds a Suspense boundary inside the Inspector — flash on first markdown render. Worth doing once profile data confirms the bytes matter; not a default win.
- **Tier-2 #4 — Split `CreationWizardPanel.tsx` (596 LOC).** Evaluated and deferred — no clean extraction boundary. The two diagram-type sub-wizards (goalTree + ec) are tightly coupled to the panel's shared state. Worth a fresh look only if the file grows past ~700 LOC.
- **Tier-2 #5 — `SettingsDialog` per-tab extraction.** Each tab's content lives in the parent file; pulling each into `tabs/AppearanceTab.tsx` etc. is mechanical but the parent is already <600 LOC and the tabs are coupled to shared form state. Skip-or-do is a judgment call.
- **Tier-2 #12 — Property-based test expansion.** Three PB files exist. Adding more first wants the `docArb` generator in `validatorsProperty.test.ts` extracted into `tests/helpers/docArb.ts` so future PB tests don't duplicate it. ~30 min refactor + 1-2 new property tests (share-link round-trip, persistence round-trip).
- **Tier-2 #13 — Mutation testing one-time pass.** Install `@stryker-mutator/core` + run once. Outputs which tests fail to catch mutations (weak coverage indicators). 10+ minute analysis; useful when the test suite has plateaued and you want to know where the gaps are.
- **Tier-2 #23 — Migration fixture coverage gap.** `migrationsRoundTrip.test.ts` carries v1–v4 fixtures; v5/v6/v7 → current rely on property-based tests. Adding explicit fixtures for v5/v6/v7 → v8 would pin the per-version exact behavior. ~1 hour of constructing realistic per-version doc fixtures.
- **Tier-3 #28 — Full hands-on keyboard navigation pass.** Session 114 added the automated keyboard subset to `e2e/a11y.spec.ts` (Tab cycle, Esc cascade for help + palette). A hands-on walkthrough by the author catches different things — workflow continuity, focus-order coherence, the discoverability question. Manual session; ~1-2 hours.

Speculative / profile-gated (don't pick up unless evidence demands):

- **Tier-3 #16 — Workerize SVG → PDF.** Only matters if real users complain about UI freezes during large-diagram exports. Worker setup + comlink + structured-clone-friendly SVG marshalling. No current signal.
- **Tier-3 #19 — localStorage quota handling.** Defensive code. Only worth it if anyone hits the quota; current docs are kilobytes, quota is megabytes.
- **Tier-3 #20 — IndexedDB migration.** Same gating as #19; #19 is the precursor (detect quota problems first; migrate only if they're real).

## ~~Comprehensive security review~~ ✅ Done (Session 98)

Full 12-area audit shipped in Session 98 (CHANGELOG entry + commit `5494531`). Deliverables in place: [`SECURITY.md`](SECURITY.md) documents threat model, mitigations, known limitations, and audit history. **P0** — `jspdf` bumped 2.5.2 → ^4.2.1, clears 19 CVEs (incl. two critical). **P1** — strict CSP added as `<meta http-equiv>` in `index.html`; gzip-bomb defense added to `parseShareHash` (5 MB ceiling). **P2** — inert footer `<a onclick="return false;">` replaced with `<span>` in `htmlExport.ts`. Audit findings that needed no fix (markdown DOMPurify, SVG/HTML export escaping, import path validation, localStorage trust model, test-hook scope, service-worker same-origin, repo hygiene, DNS) all documented in `SECURITY.md` § audit history. `pnpm audit --prod` clean. Re-trigger: open a new audit if (a) a new untrusted-data boundary is added, (b) the share-link payload format changes, or (c) a new third-party runtime dependency lands. The Session 98 SECURITY.md doc is the durable record.

## Selection-anchored contextual toolbar (Session 94 UI research)

> **Status (Session 95): ✅ Shipped.** Phase 1 (selection-verb registry + canvas helpers) landed in `adc95b9`; Phase 2 (SelectionToolbar component + unit + Playwright e2e) landed across `3fb91a6` … `df071f9`. Default ON; opt-out in Settings → Behavior. See CHANGELOG Session 95. Verb-scope follow-ups (Mark as UDE / Promote to Goal / EC slot-specific / etc.) deferred to a future iteration — captured in the Session 95 changelog's "What's still incomplete" audit.

The Top-30 refactor sweep (Session 94) included a parallel UI-pattern research pass — Office ribbon, MindManager, Figma UI3, Miro, Excalidraw, tldraw, Lucidchart, draw.io. Modern canvas-dominated tools have converged on a **floating contextual toolbar anchored above the current selection** as the bridge between "I know which node I mean" and "I know which verb I want." Today that's two clicks in TP Studio (select → reach for palette or inspector); the contextual toolbar would collapse it to one.

Crucially: **this is additive, not a chrome overhaul.** The Cmd+K palette + slide-in Inspector + 8-icon TopBar trio stays — they cover discoverability, properties, and orientation respectively. The toolbar adds the missing per-selection verb surface.

**Concrete spec:**
- New `<SelectionToolbar>` overlay anchored via React Flow's `useStore` to the selection-bounding-rect's viewport coords. Hides while dragging, while a text field is being edited, or while the palette is open.
- Per-entity-type verb registry — re-uses existing palette command IDs so a click teaches the keyboard shortcut and the palette use reinforces the toolbar layout.
- Initial verb scopes:
  - **CRT / FRT entity:** `Add cause` · `Add effect` · `Mark as UDE` · `Mark as root cause` · `Delete`
  - **EC slot entity:** `Add prerequisite` · `Add assumption` · `Challenge` · `Delete`
  - **Goal Tree CSF:** `Add NC` · `Promote to Goal` · `Delete`
  - **Edge selected:** `Reverse` · `Add assumption` · `Set polarity` · `Splice` · `Delete`
  - **Multi-selection:** `Group as AND` · `Group as OR` · `Swap entities` · `Delete N`
- Visual: same indigo accent + chip size as the existing `StatusStrip` chips. Use the `CARD_FOCUS` constant from Session 93.

**Validation path before full build:** prototype the toolbar for **just the CRT entity case** (5 verbs, anchored to the selection in viewport space) and use it for an hour of real diagramming. If it replaces one Cmd+K cycle per minute, ship across every selection kind. If not, the prototype is throwaway and the existing UI is untouched.

**Effort:** M–L (~1 week of focused work).

**Explicit anti-recommendations from the same research:**
- **Don't add a top ribbon.** Microsoft has been retreating since 2018; Figma moved its toolbar to bottom-center in UI3; the ribbon's strengths (discoverability across hundreds of commands) are already covered by Cmd+K, and its costs (33% of vertical space, narrow-viewport breakage, a11y debt) are real.
- **Don't add a bottom-left command toolbar** — redundant with Cmd+K, adds permanent chrome for no leverage.
- **Don't add a per-diagram-type quick-add panel** — the palette already filters by diagramType-relevant commands.

Source synthesis lives in CHANGELOG Session 94 commit `56c553d`; full research briefs in this session's transcript.

## Deferred from the Bundle 4 + B + E + N plan (Session 46)

Captured here so a future session can pick them up without re-deriving scope:

- ~~**LA5 — generalize manual positioning to all diagrams.**~~ ✅ **Done (Session 63).** Reused the existing `Entity.position` field as the pin signal — no schema change. `useGraphPositions` overlays pinned positions on top of dagre's output; `useGraphMutations` drops the strategy gate so drag-to-pin works everywhere. Visual indicator (pin glyph) on auto-layout diagrams; right-click → Unpin per entity; Palette → Reset layout unpins all.
- ~~**B7 — User-Defined Attributes per entity / edge.**~~ ✅ **Done (Session 70).** `Entity.attributes?: Record<string, AttrValue>` (string/int/real/bool tagged-union); key/value editor in the EntityInspector below the warnings list. Session 71 added the symmetric `Edge.attributes`. See Bundle 7 + the Session 70/71 CHANGELOG entries.
- ~~**B10 — Custom entity classes (define your own).**~~ ✅ **Done (Session 70).** `TPDocument.customEntityClasses?: Record<string, CustomEntityClass>` — per-doc user-defined types with custom label/color/`supersetOf`; manager UI in DocumentInspector; palette extension across EntityInspector / MultiInspector / ContextMenu; doc-aware `resolveEntityTypeMeta` lookup. Session 71 added per-class icon picker. See Bundle 7 + the Session 70/71 CHANGELOG entries.
- ~~**N3 — Mermaid syntax IMPORT.**~~ ✅ **Done (Session 64).** Parser handles frontmatter title + `graph BT/TB/LR/RL`, bracketed nodes with `<br/>` + `&quot;` decoding, plain `-->` + thick `==>` (AND-grouped) edges, inline labels, `class id type_foo` type assignments. Subgraph blocks tolerated (contents parsed; grouping dropped). Round-trips cleanly with the Block-D export. Palette → "Import from Mermaid diagram…".
- ~~**N5 — VGL declarative format export.**~~ ✅ **Done (Session 64).** VGL-flavored declarative format with `entity { … }` and `edge a -> b` blocks, plus `edge_and target:T { sources… }` for AND groups. Written as a `.vgl` file. No companion importer yet (one-way until usage warrants it). Palette → "Export as VGL (declarative)".

## Ideas from "Thinking with Flying Logic" (TOC reading)

### Reasoning helpers

- ~~**Per-diagram-type edge reading templates.**~~ ✅ **Done (Session 57).** `CausalityLabel` extended with `'auto'` (picks per-diagram default) and `'in-order-to'` (necessity reading). Shared `resolveCausalityWord` + `renderEdgeSentence` helpers in `src/domain/edgeReading.ts`.
- ~~**Read-through / walkthrough mode.**~~ ✅ **Done (Session 57).** Palette → "Start read-through" opens a fullscreen overlay that walks every structural edge in topological order with arrow / space navigation.
- ~~**CLR walkthrough wizard.**~~ ✅ **Done (Session 57).** Palette → "Start CLR walkthrough" iterates open warnings one at a time with Resolve / Open-in-inspector actions. Scoped to open warnings (lighter than the original "every entity for every tier" framing) — the simpler shape proved sufficient.
- ~~**EC brainstorm prompts on edges.**~~ ✅ **Done (Session 57).** Inspector surfaces the book's role-specific question when an EC edge is selected; one-click "Add as a new assumption" pushes it onto the edge as a `…because <question>` assumption.
- ~~**"...because" prefix for new EC assumptions.**~~ ✅ **Done (Session 55).** New EC assumptions seed with `…because ` and the caret lands at the end of the prefix; CRT/FRT/PRT/TT stay empty.

### Workflow & process

- ~~**Per-diagram-type method checklist.**~~ ✅ **Done (Session 56).** Collapsible "Method checklist" section inside the Document Inspector with the canonical recipe per diagram type (CRT 9 / FRT 6 / PRT 6 / TT 6 / EC 7). Checked steps persist as `doc.methodChecklist`. Hints reference existing TP Studio features so the checklist doubles as a feature-discoverability surface.
- ~~**System Scope dialog ("Step 0" for every analysis).**~~ ✅ **Done (Session 56).** Collapsible "System Scope" section inside the Document Inspector with the seven CRT-Step-1 questions. Round-trips through JSON. The "soft toast nudge on every CRT load without an answered scope" was deferred as intrusive — the discoverable entry point in Document Inspector is the lower-friction nudge.
- ~~**Negative Branch capture (NBR sub-tree).**~~ ✅ **Done (Session 59).** Right-click an FRT entity → "Start Negative Branch from this entity" (also palette command). Creates a "Negative Branch" group preset rooted at the entity.
- ~~**Positive Reinforcing Loop tagging (FRT step 5).**~~ ✅ **Done (Session 59).** Group preset "Positive Reinforcing Loop" (emerald) available from the Group inspector preset chooser. Pairs with back-edge tagging from Session 55.
- ~~**Archive group preset (don't delete trimmed branches).**~~ ✅ **Done (Session 59).** Palette → "Move selection to Archive group" finds the existing Archive group or creates one with the preset (slate, collapsed). Reuse-or-create logic prevents accumulating duplicates.
- ~~**Group preset names + colors.**~~ ✅ **Done (Session 59).** New "Preset" field in the Group inspector with five book-derived entries: Negative Branch, Positive Reinforcing Loop, Archive, Step, NSP Block. Catalog lives in `src/domain/groupPresets.ts`.

### Analysis features

- ~~**Core Driver finder.**~~ ✅ **Done (Session 52).** Palette command "Find core driver(s)" ranks `rootCause` entities (or leaves) by transitive UDE-reach and selects the top candidates with a score toast.
- ~~**Spawn Evaporating Cloud from a Core Driver / root cause.**~~ ✅ **Done (Session 52).** Context-menu action on any CRT entity + palette command "Spawn Evaporating Cloud from selected entity". Auto-snapshots the outgoing CRT to the revisions panel via the existing `setDocument` path.
- ~~**Reach badge overlay.**~~ ✅ **Done (Session 52).** Settings → Display → "Show UDE-reach badge" toggles an amber `→N UDEs` pill at the bottom-left of each entity. Auto-hides on diagrams without UDEs (PRT / TT / EC). Only the forward direction is shown — the reverse "←N root causes" was deferred as low-leverage clutter (almost always ≈1 on real CRTs).

### Diagram operations

- ~~**Insert entity by dropping onto an edge ("splice").**~~ ✅ **Done (Session 55).** Right-click any edge → "Splice entity into this edge" creates a fresh entity at the diagram's default type and replaces the edge with two new ones through the new entity. Label / assumptions / back-edge flag inherit onto the downstream half; AND grouping is dropped with a toast. ~~Drag-and-drop variant is parked.~~ ✅ **Drag variant shipped (Session 83 Alt-drag + Session 101 visual feedback).** Hold Alt while dragging an existing entity onto an edge — the target edge highlights indigo during the drag (Session 101); release to splice (Session 83's existing `spliceEntityIntoEdge` action).
- ~~**Drag-onto-edge to create an AND junctor.**~~ ✅ **Done (Session 57).** Connection drag from a node handle that releases over an edge body now AND-joins via `addCoCauseToEdge` — joins the existing andGroupId if any, mints a fresh one otherwise. Edge-hover tracked via React Flow's `onEdgeMouseEnter` / `onEdgeMouseLeave` consumed in `onConnectEnd`.
- ~~**Back-edge tagging (distinct from cycle warnings).**~~ ✅ **Done (Session 55).** New `Edge.isBackEdge` flag toggleable from the EdgeInspector or the right-click menu. When tagged: cycle CLR rule suppresses warnings for that cycle, TPEdge renders with thicker dashed stroke + a ↻ amber glyph. JSON round-trip preserves the flag.
- ~~**TT "complete step" structural validator.**~~ ✅ **Done (Session 53).** New `complete-step` rule (tier `sufficiency`) in `RULES_BY_DIAGRAM.tt`. Fires on any Action whose outgoing edge to its Outcome lacks a non-action sibling (the precondition role). AND-joined siblings count, plain siblings count, assumptions don't. Quietly handles unspecified placeholders.
- ~~**Unspecified-Precondition stub entity.**~~ ✅ **Done (Session 53).** Generic `Entity.unspecified` flag (not type-specific) toggleable from the EntityInspector. When on: the empty-title check skips, TPNode renders a `?` glyph + italic "Unspecified — fill in later", and the Complete-Step rule treats the placeholder as filling the precondition slot. Works in any diagram, not just TT.
- ~~**Mutual-exclusion edge flag (EC).**~~ ✅ **Done (Session 57).** New `Edge.isMutualExclusion` boolean toggleable from the Edge Inspector (only when both endpoints are Wants). Renders red with a ⊥ glyph. New EC-specific CLR rule `ec-missing-conflict` fires until at least one want↔want edge is flagged.

### Mental model

- ~~**Span-of-control / sphere-of-influence flag on entities.**~~ ✅ **Done (Session 59).** New `Entity.spanOfControl` field (control / influence / external) toggleable from EntityInspector. TPNode renders a single-letter colour-coded pill (emerald `C`, amber `I`, neutral `E`). New `external-root-cause` CLR rule (clarity tier, CRT-only) fires on root causes flagged external.

### Reasoning text output ✅ Done (Session 58)

Shipped. `exportReasoningNarrative` + `exportReasoningOutline` in `src/domain/reasoningExport.ts`, browser-side wrappers + palette commands in the Export group. Both modes carry preamble (title, System Scope, EC conflict statement) and per-diagram-type shaping (CRT Core Driver appendix, TT triples, EC structured-description outline). Output is Markdown; pairs with the in-app Read-through overlay (Session 57) which walks the same sentences live.

Original design notes left below for context:

**Mode A — narrative form** (sentence-per-edge in topological order). Example for a CRT:

> # Customer-support CRT
>
> "Customers churn" because "Resolution time exceeds 8 hours".
> "Resolution time exceeds 8 hours" because "Agents lack a triage rubric".
> "Agents lack a triage rubric" because "Support lead has had no protected time to draft one".

**Mode B — outline form** (effects with their causes nested underneath, the OPML-export structure we already use). For each terminal effect (no outgoing edges), list it as a heading, then nest each incoming cause's sentence, recursing down. Reads like a structured argument.

Both modes consume the same primitive: for each (source, target) pair, render `renderEdgeSentence(source, target, resolveEdgeConnector(edge, doc.causalityLabel, doc.diagramType))`. The only difference is the wrapping document structure.

**Where it lives.** New file `src/services/exporters/reasoning.ts` exporting `exportReasoningNarrative(doc): string` and `exportReasoningOutline(doc): string`. Wire two new palette commands ("Export reasoning as narrative…" / "Export reasoning as outline…") and a corresponding pair in `commands/export.ts`. Both write `.md` files using the existing `triggerDownload` + `slug` helpers; markdown rather than plain text so the headings + lists render in any consumer.

**Per-diagram-type extras worth folding in:**
- **EC**: prefix the document with the conflict statement ("The conflict: I want X, but I also want Y'.") drawn from the two Wants + the mutex flag. Then verbalize each edge as a necessary-condition sentence.
- **CRT**: append a "Likely Core Driver" section reusing `findCoreDrivers(doc)` so the export carries the headline finding alongside the chains.
- **TT**: render each AND-junctor step as a triple ("In order to obtain *Outcome*, do *Action* given *Precondition*.") so the structure reads correctly even in narrative mode.
- **System Scope + Method Checklist** (Session 56): if filled in, render them at the top of the narrative as a preamble. The export becomes the canonical write-up of the analysis.

**Cost:** the rendering primitives already exist (Session 57); the work is a thin wrapper module + two palette commands + the diagram-type-specific shaping. Estimated **S–M** for both modes plus the per-diagram extras.

**Why it's worth shipping:** the read-through overlay forces verbalization *during* the analysis. The text export carries that verbalization *out* of the app — into a meeting deck, a brief, a postmortem, a doc the team can edit. Pairs naturally with the existing OPML / DOT / Mermaid exporters but speaks to a different audience (people who think in prose rather than graph syntax).

## Tier 2 — New diagram types

The user picked buckets **A / F / H** out of the 16-bucket catalogue. After Tier 1 (small-effort wins) the next concrete chunk is "table-stakes diagrams that aren't CRT or FRT":

- ~~**A2 Prerequisite Tree.**~~ ✅ **Done (Session 20).**
- ~~**A3 Transition Tree.**~~ ✅ **Done (Session 21).**
- ~~**A1 Evaporating Cloud.**~~ ✅ **Done (Session 26).** Two new entity types (`need`, `want`), `diagramType: 'ec'`, hand-positioned layout via `LAYOUT_STRATEGY.ec === 'manual'`, drag-to-reposition persisted through `setEntityPosition` (the dormant position-persist branch from Session 25's prep lit up), `INITIAL_DOC_BY_DIAGRAM.ec` pre-seeds the 5 boxes plus 4 edges at canonical coordinates, example doc, Flying Logic round-trip (positions dropped — FL doesn't carry them). **Tier 2 of the feature-research menu is complete.**

## Tier 3 — Layout & navigation ergonomics

- ~~**F5 Sunburst / radial alternate view.**~~ ✅ **Done (Session 27).** Top-bar toggle flips between dagre flow and a radial sunburst; preference persists app-wide; hidden for hand-positioned (manual) diagrams.
- **F1 Incremental relayout** — **parked**. The premise was "on a 500-node Goal Tree dagre is noticeable," but title/text edits already short-circuit before the layout path thanks to `layoutFingerprint` only hashing structural changes. Dagre only re-runs on add/remove operations, which aren't high-frequency. A componentwise cache would add real infrastructure (per-component shape hashes, packing logic for disconnected graphs) and change the visual layout for disconnected diagrams. Revisit with profile data showing dagre is actually the bottleneck.

**Radial layout polish** ✅ shipped Session 76. Subtree-weighted angular allocation: each center claims an arc of `2π` proportional to its subtree size; each child gets a sub-arc proportional to its own subtree size. Children stay angularly close to their parent; sibling branches don't fight for the same arc.

~~**Radial edge routing — avoid crossing node bounding boxes**~~ ✅ **Done (Session 99).** Path (a) from the original menu: new pure module `src/components/canvas/radialEdgeRouting.ts` runs Liang-Barsky line-box intersection against every visible node's bbox, averages deflection vectors across hits, and emits a perpendicular-deflected cubic Bézier whose control points clear the obstacles. TPEdge subscribes to React Flow's nodes only when `layoutMode === 'radial'` (flow/manual mode users pay zero re-render cost). 16 unit tests pin the math. Path (b) (A* / orthogonal routing) deliberately not pursued — the ~80% case is handled, pathological multi-obstacle clusters remain a known limitation in the module header. See CHANGELOG Session 99.

## Tier 4 — Versioning, branching, what-if

- ~~**H1 Revision history.**~~ ✅ **Done (Session 41).** Per-document snapshots in localStorage (capped 50 per doc), one-click restore with safety-snapshot, label/rename, auto-snapshot on document swap, slide-in panel with diff-vs-live summary, palette commands + TopBar toggle + Esc-cascade integration. 26 new tests across domain / store / component.
- ~~**H4 Side-by-side compare.**~~ ✅ **Done (Session 62).** Fullscreen modal with two diff-colored panels (snapshot + live). Entities render as absolute-positioned cards; edges as SVG lines between them. Each panel filters by side (snapshot skips added, live skips removed).
- ~~**H2 Visual diff.**~~ ✅ **Done (Session 62).** Compare-mode banner + per-entity ring tint (emerald=added, amber=changed) overlaid on the live canvas. `useCompareDiff` threads the diff through `useGraphView → useGraphEmission → useGraphNodeEmission`. Esc exits.
- ~~**H3 Named branches.**~~ ✅ **Done (Session 62, MVP).** Revisions now carry an optional `branchName`; `parentRevisionId` wired on restore + branch. RevisionPanel groups by branch with sticky headers. "Branch from here" action prompts for a name. Subsequent snapshots after a restore still land in Main unless explicitly branched — the full multi-doc workspace upgrade is parked.

H5 ("confidence-weighted what-if") is **won't-build** as of Session 84 — see the "Brief items intentionally out of scope" section. Originally parked behind Bucket C (C1 per-entity confidence + C2 per-edge weight); Bucket C was excluded by user direction and the confidence field was removed from the schema in Session 71. With no signal to scale, H5 has nothing to compute on.

The [Flying Logic feature catalog](#flying-logic-feature-catalog-fl-) below organizes
candidate features into 13 named bundles with stable `FL-*` IDs so we can say
"let's do Bundle 1 + FL-EX1 next iteration" without ambiguity. Reasoning / confidence,
project management, and scripting are out of scope and not catalogued.

## ~~Recommended priorities for the next session~~ ✅ All four items shipped

Archived: each of the four items below has landed and is annotated with the session that closed it. Left in place so the rationale-chain is auditable; new priorities should land elsewhere in this file.

### 1. AND-junction visual polish — ✅ Done (Session 28)

The original dot/arc approach was replaced wholesale by a Flying-Logic-style **junctor circle**: a white circle labelled "AND" sits just above the target, multiple causes converge into it, one arrow continues to the target. Cleaner than the dot+arc+badge stack it replaced, recognizable to FL transplants, opens a clear extension point if we ever add other junctor types (OR / NOT).

### 2. Mobile / narrow-viewport pass — ✅ Done (Session 65, verified Session 87)

All three originally-listed improvements shipped:

- ~~**Collapsible inspector on narrow viewports.**~~ ✅ Inspector + RevisionPanel overlay with tap-to-dismiss backdrops below `md:` (640 px).
- ~~**Hide command/help/theme button labels under a kebab menu at < 768 px.**~~ ✅ Session 65 — new `KebabMenu` component, `sm:hidden` surfaces the four hidden buttons (Layout Mode / History / Help / Theme). Session 92 added Undo/Redo entries too.
- ~~**Respond gracefully to portrait orientation.**~~ ✅ Session 87 (V10) — TopBar verified clean down to 480 px (`xs:` breakpoint).

Beyond what's shipped, "mobile-first design" stays explicitly out of scope per the brief — the surface works at 480 px and up, which is the practical floor for a graph editor.

### 3. Component-level interaction tests — ✅ mostly done

Inspector / ContextMenu / CommandPalette landed earlier; **Session 34** added TopBar, SettingsDialog, HelpDialog, EntityInspector, EdgeInspector (33 more tests). **Session 35** added shortcut-registry + linkage tests (10 more). TPNode + TPEdge tests landed alongside the canvas hook split. **Session 83** added the Toaster test (6 tests — auto-dismiss timing via fake timers, manual dismiss, dedup, rendering per kind).

Remaining gap:

- **Canvas itself** (React Flow shell + double-click + selection wiring) — pulling `<ReactFlow>` into jsdom still hits the same fiddliness; the dblclick contract is covered by the `e2e/smoke.spec.ts:47 canvas double-click creates a new entity` Playwright test which runs on CI. Parked.

(Two pre-existing failures previously flagged here — CommandPalette subsequence scorer false positive + radialLayout apex-at-center premise — were fixed in **Session 37**. The suite is fully green.)

### 4. Backward-incompatible migrations stub — ✅ Done (long since)

Backlog entry was stale — the framework is in `src/domain/migrations.ts` with `CURRENT_SCHEMA_VERSION = 8` and seven registered migrations (v1 → v8). `importFromJSON` calls `migrateToCurrent` before its strict shape check, so downstream guards assume the target version. Covered by `tests/domain/migrations.test.ts` (per-step + edge cases) + `tests/domain/migrationsRoundTrip.test.ts` (fixture-driven, currently v1–v4 → v5; v5/v6/v7 fixtures not yet added — the property-based test in `migrationsProperty.test.ts` exercises the full chain with arbitrary docs to compensate) + `tests/domain/migrationsProperty.test.ts` (fast-check idempotency + strict-validator round-trip). The schema has bumped through seven backward-compatible upgrades over the project's life — every backward-incompatible change has used this framework.

## Brief items intentionally out of scope

These come straight from the brief's "Out of scope — do not build" list:

- Real-time multi-user collab
- Cloud sync, accounts, auth
- Prerequisite Trees, Transition Trees, Evaporating Clouds (data model accommodates them but no UI)
- Project management, calendars, resources, MS Project export
- Bayesian / evidence-based propagation
- Course-of-action (COA) analysis features
- Mobile-first design (responsive down to 1024 px is enough)
- Print stylesheets
- i18n (English only)
- **H5 confidence-weighted what-if** (Session 84). Depended on Bucket C (`Entity.confidence` + `Edge.weight`); Bucket C was excluded by user direction in Iteration 2 and schema-confidence was dropped in Session 71. With no signal to scale, H5 has nothing to compute on. Dann explicitly moved it out of "parked" and into "won't build" in Session 84 — close the door, not just leave it on the table.

When and if any of these enters scope, the domain layer should be able to absorb most of the additional concepts without breaking. The data model is wide enough.

## Placeholders (need fleshing out before they can be picked up)

- ~~**Look at UI.**~~ ✅ **Walkthroughs done (Session 87).** Static review of all 8 primary surfaces produced 40 triaged findings — see [docs/ui-review-session-87.md](docs/ui-review-session-87.md). Visual walkthrough via Claude Preview against the live app produced one bug fix + 10 additional visual-only nits — see [docs/ui-review-session-87-visual.md](docs/ui-review-session-87-visual.md). Top-priority follow-ups are backlog items below.
- ~~**Make the tool installable.**~~ ✅ **Done (Session 89).** TP Studio is now a PWA served at <https://tp-studio.struktureretsundfornuft.dk/> with offline support, an explicit-refresh update toast, and a palette-driven Install command. Auto-deploys to GitHub Pages on every push to `main`. Scoping doc: [docs/distribution-pwa-scoping.md](docs/distribution-pwa-scoping.md); changelog entry: Session 89.

## ~~EC canvas chrome cleanup (Session 89 visual review)~~ ✅ Done (Session 89)

Shipped. The V2 wrapper's "EC CHROME" label row is gone; `ecChromeCollapsed` default flipped to `true` (hidden by default) so the EC canvas starts clean; users opt into the reading guide via the palette command **Toggle EC reading guide**. Injection chip moved below the TopBar at all viewport sizes. TitleBadge gained `text-ellipsis` for long titles. USER_GUIDE documents the stale-localStorage example-title behaviour.

## ~~🔴 HOTFIX — example EC loader missing v7 schema fields~~ ✅ Done (commit `35466ad`)

Was the Session 87 hotfix. Shipped — example EC now has correct `ecSlot` bindings, necessity edges, and D↔D′ mutex edge. Stale stale-comment cleanup per memory rule.

## ~~UI tidy batch (Session 87 review — 14 quick wins)~~ ✅ Complete (Session 87 — 12; Session 92 — final 2)

Session 87 commit `8898128` shipped 12 of the original 14 items: S2, S3, S4, S5, S6, S7, S8, V1, V3, V4, V6, V10. Session 92 closed the final two:

- ~~**(S1) Browse-Lock icon**~~ ✅ **Done (Session 92).** `TopBar` now renders the `Lock` icon at all times; state is carried by the color variant (`softViolet` ↔ `softNeutral`). The previous Lock↔Unlock icon swap competed with the color-variant swap; one signal per state reads cleaner. `Unlock` import dropped.
- ~~**(S9) Toaster vs. React Flow Controls collision**~~ ✅ **Done (Session 92).** Bumped the centered Toaster from `bottom-6` (24 px) to `bottom-20` (80 px) so wide-text toasts on narrow viewports clear the React Flow Controls + MiniMap stack at bottom-left.

Originals (kept for reference):

1. ~~(S1) Browse-Lock icon~~ — see above; **open**.
2. ~~(S2) Print dialog `{pageNumber}` / `{pageCount}`~~ ✅ Shipped Session 87 — both placeholders dropped from the resolver since browsers (not app JS) control running headers.
3. ~~(S3) EmptyHint~~ ✅ Shipped Session 87 — palette + templates entry paths added alongside the double-click hint.
4. ~~(S4) CommandPalette section headers~~ ✅ Shipped Session 87 — `aria-hidden` swapped for `role="presentation"`.
5. ~~(S5) Creation wizard toggles~~ ✅ Shipped Session 87 — Settings → Behavior groups the two flags under one "Creation wizards" sub-heading.
6. ~~(S6) Animation speed "Default" label~~ ✅ Shipped Session 87 — renamed to "Normal" with "1× baseline" hint.
7. ~~(S7) PrintPreviewDialog footer-template help row~~ ✅ Shipped Session 87 — merge-fields row mirrors the Header field.
8. ~~(S8) Browse Lock toast wording~~ ✅ Shipped Session 87 — now points the user at Settings → Behavior / top-bar lock icon.
9. ~~(S9) Toaster vs. React Flow Controls collision~~ — see above; **open**.
10. ~~(V1) Drop "(example)" suffix from example doc titles~~ ✅ Shipped Session 87 — all 8 example titles trimmed.
11. ~~(V3) Fit View on example load~~ ✅ Shipped Session 87 — four load paths auto-fit after `setDocument`.
12. ~~(V4) Entity-type label legibility~~ ✅ Shipped Session 87 — bumped font-size + letter-spacing.
13. ~~(V6) Annotation appendix in a11y tree~~ ✅ Shipped Session 87 — `aria-hidden="true"` outside print-include-appendix mode.
14. ~~(V10) Verify TopBar at 480 px (`xs:` breakpoint)~~ ✅ Verified Session 87 — clean at `xs:`.

## UI polish queue (Session 87 review — 13 individual fixes)

S–M effort, low ambiguity. Pick what aligns with current work. **Session 88 shipped 10 of the items below (#11 / #14 / #15 / #16 / #17 / #18 / #20 / #22 / V2); #10 and #12 evaluated as audit-clean.** Highlights:

- ~~**Settings dialog TOC / section anchors**~~ ✅ **Audit-clean (Session 88).** The tab split from Session 87 (S25) already cuts the longest section to ~7 controls — anchor nav inside a single tab would be friction the user isn't asking for. Re-evaluate if a single tab grows past ~10 controls.
- ~~**Theme picker as a swatch grid**~~ ✅ **Done (Session 88).** SettingsDialog → Appearance now renders the 7 themes as a 2-row × 4 grid of preview swatches (surface colour + accent stripe). The `Theme` union and `setTheme` action are unchanged; this is purely presentational.
- ~~**Long-form layout-direction labels**~~ ✅ **Audit-clean (Session 88).** The labels were already long-form ("Bottom → Top"); the two-letter codes (BT/TB/LR/RL) only live in the `id` field. No change needed.
- ~~**Command palette icons** (item #16)~~ ✅ **Done (Session 88).** New `src/components/command-palette/commandIcons.ts` maps high-traffic command ids to Lucide icons; CommandPalette renders them at the left of each row. Map-driven (not per-command annotation) so the visual identity is auditable in one place.
- ~~**Command palette recent section** (item #17)~~ ✅ **Done (Session 88).** New `src/services/recentCommands.ts` persists the last 5 invoked commands to localStorage. Palette shows them under a sticky "Recent" header at the top of the unfiltered view; hidden when the user starts typing.
- ~~**Context menu keyboard navigation** (item #15)~~ ✅ **Done (Session 88).** ArrowDown / ArrowUp walks menuitems (wraps); Home / End jumps to the bookends; Enter activates the focused row (native button); Esc was already handled by `useOutsideAndEscape`. First item auto-focuses on open.
- ~~**Print mode visual previews** (item #20)~~ ✅ **Done (Session 88).** Each of the three print-mode buttons grew a 60×40 inline-SVG thumbnail telegraphing its visual treatment (colour stripes / bold high-contrast / no fills).
- ~~**Creation wizard drag-to-reposition** (item #18)~~ ✅ **Done (Session 88).** The wizard header acts as a drag handle (pointerdown / pointermove / pointerup with `setPointerCapture`). New `x` / `y` fields on the `creationWizard` slice persist the position; clamp-to-viewport on read keeps the panel grabbable. `setCreationWizardPosition` slice action wires it.
- ~~**Templates picker JSX thumbnails** (item #22)~~ ✅ **Done (Session 88).** `templateThumbnailSvg` got a JSX sibling `<TemplateThumbnail>` that returns a React element tree; the picker mounts it directly (no `dangerouslySetInnerHTML`). The string emitter stays around for the legacy `tests/templates/templates.test.ts` assertion.
- ~~**Templates picker — Undo toast** (item #14)~~ ✅ **Done (Session 88).** Loading a template now captures the prior doc and surfaces an "Undo" action button on the success toast. Extended `Toast` with optional `action: { label, run }`; `showToast` grew a 3rd-arg `options` parameter.
- ~~**Combine reading-instructions + verbalisation strips** (V2)~~ ✅ **Done (Session 88).** Canvas EC chrome (reading-instructions + verbalisation) now wraps in a single collapsible container with one chevron. New `ecChromeCollapsed` persisted flag (default expanded). The per-strip dismiss / collapse controls still work — the new layer is the outer surface.
- ~~**First-Entity Tip — add rename + delete hints**~~ ✅ **Done (Session 92).** Added a third affordance line to `FirstEntityTip`: "Double-click an entity to rename · Delete / Backspace removes the selection." Pairs with the Session 87 marquee + alt-splice line. Tip still auto-hides past 2 entities — first-time-only.

## ~~UI bigger asks (Session 87 review — 7 items needing design conversation)~~ ✅ Complete (Session 87 + Session 92)

Session 87 shipped #24 (StatusStrip) + #25 (Settings tabs); Session 92 closed the remaining five. All seven items now done.

- ~~**Esc handling consistency** (item #23)~~ ✅ **Done (Session 92).** Consolidated the global Esc cascade in `useGlobalShortcuts`. Pulled `templatePickerOpen` / `diagramPickerOpen` / `exportPickerOpen` / `printOpen` / `compareRevisionId` / `sideBySideRevisionId` / `confirmDialog` into one priority-ordered chain. Inline comment documents the canonical order. New tests pin cascade priority (picker → settings → help → selection peels back in order) and the confirm-dialog Promise resolution path.
- ~~**Global status indicator** (item #24)~~ ✅ **Done (Session 87).** New `StatusStrip` component (data-component `status-strip`) shows a chip per active secondary mode (lock / hoist / history / wizard / search / compare). Hidden when no secondary state is active.
- ~~**Settings dialog → tabs** (item #25)~~ ✅ **Done (Session 87).** SettingsDialog split into tabs; the longest section now caps at ~7 controls. Session 88 audit-clean note confirmed anchor-nav inside a single tab isn't warranted yet.
- ~~**Visible Undo affordance** (item #26)~~ ✅ **Done (Session 87 + Session 92).** TopBar grew Undo/Redo icon buttons in Session 87 (`sm+`); Session 92 added matching KebabMenu entries so the affordance is reachable at every viewport. KebabMenu auto-focus + arrow-key walk now skip disabled items.
- ~~**Alt-drag-to-splice discoverability** (item #27)~~ ✅ **Done (Session 92).** Added a "Mouse & touch gestures" section to `HelpDialog` listing six pointer affordances. The FirstEntityTip surfaces them on first use (Session 87); the Help dialog is the durable always-reachable surface.
- ~~**Marquee selection discoverability** (item #28)~~ ✅ **Done (Session 92).** Same gesture list in HelpDialog; FirstEntityTip already mentions "Drag on empty canvas to marquee-select" for first-time users.
- ~~**Browse Lock toast dedup** (item #29)~~ ✅ **Done (Session 87, verified Session 92).** `tests/services/browseLock.test.ts` already pins the dedup behavior — 5 rapid `guardWriteOrToast` calls collapse to 1 visible toast. The test was named `dedupes cascading lock-toast attempts to a single visible toast (S29)` in Session 87; Session 92 backlog reconciliation confirmed the test exists and the dedup works.

~~EC-specific findings (items #30-34) are parked until the EC PPT comparison agent ships and the surfaces stabilize~~ ✅ **All triaged in Session 93.** Inspector tab bar stayed at 3 (#30 moot); verbalisation strip collapse shipped Session 88 (#31); ECSlotIndicator built this session (#32); mutex visual won't-build per Dann (#33); assumption + injection canvas affordances shipped Session 87 (#34).

~~cross-cutting tech-debt items (#35-40) belong in a future focused-1-hour pass~~ ✅ **Triaged in Session 93.** Three closed via lightweight documentation/convention: focus-ring constants (`focusClasses.ts`, #36); breakpoint convention comment on TopBar (#37); Modal width-class JSDoc (#38). Three parked-with-rationale: #35 magic-number spacing (no active bug; M effort touching too many files); #39 focus-trap audit (only non-modal CreationWizardPanel lacks it, intentionally); #40 dialog visual-regression (separate infra project).

## EC PPT comparison

Gaps surfaced by comparing TP Studio's EC against the canonical BESTSELLER PowerPoint workshop template (`TEMPLATE evaporating cloud.pptx`). Each item is a small, focused upgrade; ranked by leverage. **All 7 items shipped (Session 87 + Session 88; #5 closed by commit `93c6366`).**

- ~~**Numbered reading-instruction chips on the EC canvas.**~~ ✅ **Done (Session 87).** New `src/components/canvas/ECReadingInstructions.tsx` — dismissible top-of-canvas strip surfacing the "1) In order to / 2) we must / 3) because" meta-reading. EC-only; session-scoped dismissal flag `ecReadingInstructionsDismissed`. Stacked above the existing VerbalisationStrip.
- ~~**Per-slot guiding questions visible after the wizard closes.**~~ ✅ **Done (Session 87).** New `src/domain/ecGuiding.ts` exposes `EC_SLOT_GUIDING_QUESTIONS` keyed by ECSlot. EntityInspector re-surfaces the slot-specific question whenever an EC slot entity is selected.
- ~~**Reverse-direction (D-first) elicitation framing.**~~ ✅ **Done (Session 87).** CreationWizardPanel grew a per-wizard toggle between A-first (default) and D-first ("from the conflict") walks. The slot order flips via `EC_SLOTS_BY_ORDER`; existing wizard tests still pass, new tests cover both walks.
- ~~**"Me vs. the other side" two-party verbal framing.**~~ ✅ **Done (Session 87).** Schema v7 → v8: new optional `TPDocument.ecVerbalStyle: 'neutral' | 'twoSided'`. `verbaliseEC` swaps "we must" → "they want to" / "I want to" on the D and D′ sides in twoSided mode. Toggle lives in DocumentInspector under the EC section. `setECVerbalStyle` store action with `doc-ec-verbal` coalescing.
- ~~**One-page workshop-handout EC export.**~~ ✅ **Done (commit `93c6366`).** Shipped as a new "EC Workshop Sheet" PDF export — path (a) from the original two implementation paths. Lays out the EC doc into PPT-style coordinates with the guiding-question reference baked in. One sheet, vector PDF, print-optimized.
- ~~**Assumption bubbles drawn on the canvas, not buried in the inspector.**~~ ✅ **Done (Session 87)** *(badge only; mid-edge previews remain future work)*. TPEdge's existing "A" pill is now sourced from BOTH legacy `Edge.assumptionIds` and the v7 `doc.assumptions` map. The pill is now a real clickable button — selects the edge AND jumps the EC inspector to its Inspector tab so the AssumptionWell is visible without a second click.
- ~~**Injection-summary visible on the EC canvas, not buried in the inspector.**~~ ✅ **Done (Session 87).** New `src/components/canvas/ECInjectionChip.tsx` — small "Injections (N)" chip anchored top-right of the EC canvas (zero-state included). Clicks set `ecInspectorTab = 'injections'` via the new `requestECInjectionsView` store action; the EC inspector's tab state is now in the store so canvas chrome can request a tab from outside the Inspector.

> **Recurring 1-hour code-optimization pass** — folded into Session 88's optimization sweep. The Session 86 menu (biome-ignore, console.*, hot-path memo, bundle, unused exports, casts, testHook dead-code) was re-evaluated in Session 88; one real win shipped (CommandPalette lazy-loaded → index chunk 116.6 → 98.0 KB gz), the rest evaluated audit-clean and noted in the Session 88 CHANGELOG entry. New backlog items can be added inline if discovered.

## Polish ideas (small but visible)

- ~~**Animated inspector slide-in.**~~ ✅ **Done (Session 42).** `transition-transform duration-200 ease-out` on both the Inspector and the H1 RevisionPanel — opening, closing, and swapping between the two reads as motion now rather than a snap.
- ~~**Empty-state second tier.**~~ ✅ Already shipped via [`FirstEntityTip`](src/components/canvas/FirstEntityTip.tsx) (Iteration 2 Phase 1). Shows the Tab / drag / `Cmd+K` hints from one entity created up to two; auto-dismisses after that or on explicit dismiss (persisted).
- ~~**Right-click on multi-selected edges.**~~ ✅ Already shipped — the ContextMenu's multi-edge branch puts "Group as AND" at the top of the list (ContextMenu.tsx lines 75–107, covered by a passing test in `ContextMenu.test.tsx`).
- ~~**Edge labels for the causality reading.**~~ ✅ **Done (Session 44).** Global "Causality reading" preference in Settings (none / because / therefore) renders a muted italic fallback label mid-edge when no explicit per-edge label is set. `because` reads bottom-up; `therefore` reads top-down.
- ~~**Print stylesheet.**~~ ✅ Shipped originally as Iteration 2 Phase 7's [print.css](src/styles/print.css); gaps closed in **Session 43** (RevisionPanel, SearchPanel, canvas overlays, native `<dialog>` selector).

## Tooling / process

Backlog audit (Session 74) found the first four items had already shipped — the backlog was stale.

- ~~**CI.**~~ ✅ Shipped earlier (`.github/workflows/ci.yml` runs lint + test + build + bundle-size on every push).
- ~~**Husky / lefthook.**~~ ✅ Shipped via `simple-git-hooks` + `lint-staged`. `pre-commit` runs biome on staged files; the `postinstall` hook installs the actual git hooks.
- ~~**Conventional Commits.**~~ ✅ Enforced via `scripts/check-commit-msg.cjs` wired to the `commit-msg` git hook. Non-conformant subject lines are rejected at commit time with examples.
- ~~**`.editorconfig`**~~ ✅ Present at repo root with `indent_style = space`, `indent_size = 2`, `end_of_line = lf`, plus Markdown / YAML overrides.
- ~~**Storybook for the UI primitives.**~~ ✅ **Done (Session 81).** Minimal install — `storybook` + `@storybook/react-vite` + `@storybook/react`, no addon bloat. Six stories (Button, Modal, MarkdownPreview, ErrorBoundary, Field, MarkdownField). `pnpm storybook` (dev :6006) / `pnpm build-storybook` (static export). `storybook-static/` gitignored + biome-ignored.

## Known environment quirks

These are specific to the Windows + corporate-AppLocker environment this was built on, but they apply to anyone hitting the same constraints.

- **`pnpm dlx` is blocked** in the corporate environment used to scaffold this. `pnpm install` from a `package.json` works; one-off `pnpm dlx <pkg>` from the npm cache temp dir is denied by Group Policy / AppLocker.
- **PowerShell Constrained Language Mode** breaks `npm.ps1` — npm/pnpm commands must be invoked from Bash or via `.cmd` shims, not via PowerShell scripts.
- **`vite preview` blocked by AppLocker** on the local dev box — production-build smoke / perf-trace specs can't run locally; CI handles them via the manual `Perf trace` and `Update visual snapshots` workflows. See `.github/workflows/perf-trace.yml` and CLAUDE.md "Environment quirks".
- **OneDrive sync + `node_modules`** is slow and occasionally lock-prone. The project lives at `C:\dev\tp-studio` for that reason.
- **`pnpm-workspace.yaml`** is autogenerated with anomalous content by pnpm 11 in some environments. If `pnpm add` silently fails to update `package.json`, check for and delete that file.
- **Lazy-loaded dependency chunks** that only pay their cost on demand: `html-to-image` (PNG / JPEG / SVG export), `dagre` + `@/domain/layout` (Session 81 — dagre is its own ~32 KB-gzip chunk; `tests/build/dagreLazyLoadBoundary.test.ts` guards against accidental static imports), `jspdf` + `svg2pdf.js` + `html2canvas` peer (Session 80 — vector PDF export), `PrintAppendix` (Session 105 — only mounts in print mode), `CommandPalette` (Session 88).

## When picking this up next

1. **Pull the project state.** `cd C:\dev\tp-studio && git status` — should be clean. `pnpm install` (the preinstall script verifies Node `>=22.22.1` and pnpm `^10`). `pnpm dev` to start. `pnpm test` should report **1156+ tests passing** as of Session 108; new tests land with feature work.
2. **Open** [README.md](README.md) for architecture, [USER_GUIDE.md](USER_GUIDE.md) for the feature surface, [CHANGELOG.md](CHANGELOG.md) for what got built when, [SECURITY.md](SECURITY.md) for the threat model + Session 98 audit findings.
3. **Pick a candidate.** The backlog parking lot is currently empty of fully-scoped open work; everything not marked ✅ Done is either profile-gated (FL-LA4 incremental relayout, workerized dagre, virtualization, indexed entity-type lookups), won't-build (H5, FL-EX8, FL-CO2, FL-IN5, FL-AN4-titles, brief out-of-scope), or parked-with-rationale (#35 magic-number spacing, #39 focus-trap audit). New backlog items can be added inline as they surface; new feature requests go in via fresh sections.
4. **Build in vertical slices**, the way the brief originally framed it — one demo-able feature per commit.

Domain-first remains the right discipline: anything new that the data model needs should land in `src/domain/` first, with tests, before any UI work.

## Flying Logic feature catalog (FL-*)

Candidate features lifted from the [Flying Logic 4 user guide](https://docs.flyinglogic.com/print.html), each with a stable `FL-*` ID so we can pick items by reference in a future session.

**Out of scope, will not build:**
- Reasoning / confidence layer (entity spinners, propagation, numeric operators) — was Bundle G
- Project management (Task / Resource entities, MS Project import/export)
- Scripting (embedded interpreter)

Effort classes are rough (small / medium / large); actuals depend on what's already in place.

## Bundles

Bundles are independently-shippable units, roughly sized for one iteration each. Mix IDs across bundles freely.

### Bundle 1 — Navigation & Search ✅ Complete (reconciled Session 76)
Every item shipped across earlier sessions; backlog table hadn't been ✅-marked.

| ID | Feature |
| --- | --- |
| ~~`FL-NA1`~~ | ✅ **Find / search** (`Cmd/Ctrl+F` opens SearchPanel) |
| ~~`FL-NA2`~~ | ✅ **Minimap** with current-viewport indicator (toggle in Settings → Display) |
| ~~`FL-DI1`~~ | ✅ Explicit **zoom controls** (React Flow Controls bar + `+` / `-` / `0` shortcuts + ZoomPercent indicator) |
| ~~`FL-SE4`~~ | ✅ **Select Path Between** two selected entities (`commands/navigate.ts` `select-path-between`) |
| ~~`FL-SE5`~~ | ✅ Select all **Successors / Predecessors** (`Cmd/Ctrl+Shift+→` / `Cmd/Ctrl+Shift+←` + palette command) |

### Bundle 2 — Multi-select & Bulk Editing ✅ Complete (Sessions ~33 + verified Session 60)
Every item shipped. Audit in Session 60 surfaced that the backlog had drifted out of sync with the code.

| ID | Feature |
| --- | --- |
| ~~`FL-SE1`~~ | ✅ Shift+click multi-select (`Canvas.tsx` `multiSelectionKeyCode`) |
| ~~`FL-SE2`~~ | ✅ Marquee selection (`Canvas.tsx` `selectionOnDrag`) |
| ~~`FL-SE3`~~ | ✅ Cut / copy / paste (`services/clipboard.ts` + Cmd/Ctrl+C/X/V shortcuts) |
| ~~`FL-SE6`~~ | ✅ Element swapping ("Swap entities" button in MultiInspector + palette command) |
| ~~`FL-SE7`~~ | ✅ Alt+click connect (`Canvas.tsx` `onNodeClick` altKey branch) |

### Bundle 3 — Quick Capture ✅ Complete (reconciled Session 76)
Both items live; backlog table hadn't been ✅-marked.

| ID | Feature |
| --- | --- |
| ~~`FL-QC1`~~ | ✅ **Quick Capture** — press `E`, paste an indented list, get one entity per line (`QuickCaptureDialog`) |
| ~~`FL-QC2`~~ | ✅ **Bulk import** entities from CSV (`Import entities from CSV…` palette command) — markdown list import covered by Quick Capture's pasted-list parser |

### Bundle 4 — Layout Controls ✅ Complete (reconciled Session 72)
LA1 / LA2 / LA3 / IN1 shipped Session 47 (Block A); LA5 shipped Session 63. Only LA4 (incremental relayout) remains parked.

| ID | Feature |
| --- | --- |
| ~~`FL-LA1`~~ | ✅ Multiple **layout directions**: BT / TB / LR / RL / radial (Session 47 + Session 27 for radial) |
| ~~`FL-LA2`~~ | ✅ **Bias** control (Session 47 — Settings → Layout → Bias) |
| ~~`FL-LA3`~~ | ✅ **Compactness** slider (Session 47 — Settings → Layout → Compactness) |
| `FL-LA4` | **Incremental layout** — parked. Premise of "dagre is slow on big graphs" unverified by profile data; see Tier 3 notes. |
| ~~`FL-LA5`~~ | ✅ **Manual node positioning** (Session 63 — drag-to-pin on every diagram type) |
| ~~`FL-IN1`~~ | ✅ **Layout Inspector** panel (Session 47 — Settings → Layout section) |

### Bundle 5 — Export Pack ✅ Complete (reconciled Session 76)
All seven formats live; backlog table hadn't been ✅-marked.

| ID | Feature |
| --- | --- |
| ~~`FL-EX1`~~ | ✅ **PDF** — via `Cmd/Ctrl+P` → browser's "Save as PDF" with the print stylesheet |
| ~~`FL-EX2`~~ | ✅ **JPEG** export (2× density, theme-aware) |
| ~~`FL-EX3`~~ | ✅ **SVG** export (sharp at any zoom, design-tool importable) |
| ~~`FL-EX4`~~ | ✅ **OPML** outline export (`exportOPML` — opens in OmniOutliner / Bike / Logseq) |
| ~~`FL-EX5`~~ | ✅ **CSV** export (entities + edges + groups in one RFC-4180 file) |
| ~~`FL-EX6`~~ | ✅ **Annotations-only** export — Markdown and plain-text variants (`exportAnnotationsMd` / `exportAnnotationsTxt`) |
| ~~`FL-EX7`~~ | ✅ **Print** stylesheet with header / footer / theme reset (`src/styles/print.css`) |

### Bundle 6 — Rich Annotations & Text ✅ Complete (verified + sealed Session 60)
Most items were already live; Session 60 audit + ship pass closed the remaining gap.

| ID | Feature |
| --- | --- |
| ~~`FL-AN1`~~ | ✅ Multi-line titles via Alt+Enter (`TPNode.tsx` textarea handler) |
| ~~`FL-AN2`~~ | ✅ Rich entity annotations (Entity carries description / attestation / confidence / spanOfControl / unspecified) |
| ~~`FL-AN3` / `FL-ED7`~~ | ✅ Edge annotations — Session 60's new `Edge.description` markdown field + canvas `📝` indicator |
| `FL-AN4` (titles) | ❌ Won't build — titles stay plain text by design (see Session 60 CHANGELOG for rationale) |
| ~~`FL-AN4` (descriptions)~~ | ✅ Markdown rendering in descriptions (entity + edge + document) via `MarkdownField` |
| ~~`FL-AN5`~~ | ✅ Hyperlinks — external URLs + internal `#N` cross-references (`services/markdown.ts`) |
| `FL-CA1` | Same as B7 below — user-defined attributes, deferred |

### Bundle 7 — Custom Entity Classes ✅ Complete (closed Session 72)
ET6 was already a built-in (`criticalSuccessFactor`); ET7 shipped Session 72; ET8/ET9/IN3 shipped Sessions 70 + 71; IN5 won't ship (UX-rejected).

| ID | Feature |
| --- | --- |
| ~~`FL-ET6`~~ | ✅ **Critical Success Factor** entity type — built-in since the Goal Tree work (`criticalSuccessFactor` in `entityTypeMeta.ts`) |
| ~~`FL-ET7`~~ | ✅ **Note** entity (Session 72) — free-form annotation outside the causal graph; yellow-stripe sticky-note card; no connection handles; skipped by CLR rules + causality exports |
| ~~`FL-ET8`~~ | ✅ **Custom user-defined entity classes** (Session 70 — `TPDocument.customEntityClasses`) |
| ~~`FL-ET9`~~ | ✅ Per-class **symbol / icon** (Session 71 — curated 17-Lucide-icon palette in `CUSTOM_CLASS_ICONS`) |
| ~~`FL-IN3`~~ | ✅ **Domain Inspector** (Session 70 — `CustomEntityClassesSection` in the Document Inspector) |
| `FL-IN5` | ❌ Won't build — tabs per element type. Current sectioned inspector groups properties cleanly (Title / Type / Description / Attestation / Span of Control / Attributes / Warnings); tabs would add a click without exposing more information. |

### Bundle 8 — Structural Edge Operators ✅ Complete (closed Session 73)
ED1 / ED3 / ED4 shipped Session 73 on top of the generalized junctor infrastructure (`JunctorOverlay`). ED6 + ED8 shipped earlier.

| ID | Feature |
| --- | --- |
| ~~`FL-ED1`~~ | ✅ **Edge weights** (Session 73 — `Edge.weight: 'positive' | 'negative' | 'zero'`; Polarity picker in Edge Inspector; rose `−` / neutral `∅` badges on negative / zero edges) |
| ~~`FL-ED3`~~ | ✅ **XOR junctor** (Session 73 — `Edge.xorGroupId`; rose junctor circle; `groupAsXor` / `ungroupXor` store actions + ContextMenu + MultiInspector + palette entries) |
| ~~`FL-ED4`~~ | ✅ **Explicit OR junctor** (Session 73 — `Edge.orGroupId`; indigo junctor circle; full action / UI parity with AND and XOR) |
| ~~`FL-ED6`~~ | ✅ **Back edges** (shipped Session 55 — `Edge.isBackEdge`) |
| ~~`FL-ED8`~~ | ✅ **Edge reversal** (shipped Session 19 — `reverseEdge` action) |

### Bundle 9 — Evaporating Cloud (second TOC tree) ✅ Complete (Session 26 + Session 77 v7 schema upgrade)
The full EC tree shipped Session 26 as Tier-2 item A1; Session 77's v7 schema added first-class `Assumption` records, explicit `Edge.kind: 'necessity'` discrimination, and `Entity.ecSlot` bindings. Backlog table hadn't been ✅-marked.

| ID | Feature |
| --- | --- |
| ~~`FL-DT1`~~ | ✅ **Evaporating Cloud** diagram type (Session 26 — `diagramType: 'ec'`, hand-positioned 5-box layout) |
| ~~`FL-ET1`~~ | ✅ **Goal** entity type (Session 26 — `'goal'` anchors the common objective; reused in Goal Tree) |
| ~~`FL-ET2`~~ | ✅ **Necessary Condition** entity type (Session 26 — used as `'need'` in EC; Goal Tree adopted as `'necessaryCondition'`) |
| ~~`FL-ED2`~~ | ✅ **Necessity edges** (Session 77 — `Edge.kind: 'sufficiency' \| 'necessity'` discrimination in v7 schema) |

### Bundle 10 — Other TOC Tree Types ✅ Complete (closed Session 75)
DT2 + DT3 shipped earlier (Sessions 20 + 21); DT4 + DT5 shipped Session 75 as thin shells over the existing entity/edge model.

| ID | Feature |
| --- | --- |
| ~~`FL-DT2`~~ | ✅ **Prerequisite Tree** (Session 20) |
| ~~`FL-DT3`~~ | ✅ **Transition Tree** (Session 21) |
| ~~`FL-DT4`~~ | ✅ **Strategy & Tactics Tree** (Session 75 — `'st'` diagram type with S&T-tuned palette + 6-step method checklist) |
| ~~`FL-DT5`~~ | ✅ Generic / **free-form** diagram (Session 75 — `'freeform'` diagram type; no built-in TOC types; type-specific CLR rules skip the diagram) |

### Bundle 11 — Groups ✅ Complete (audited + sealed Session 61)

| ID | Feature |
| --- | --- |
| ~~`FL-GR1`~~ | ✅ Groups — shaded enclosures with title + color |
| ~~`FL-GR2`~~ | ✅ Nested hierarchy — UI surface added Session 61 ("Nest into parent group" picker in GroupInspector) |
| ~~`FL-GR3`~~ | ✅ Collapse / expand groups (`toggleGroupCollapsed` + inspector button + collapsed-root card) |
| ~~`FL-GR4`~~ | ✅ Hoist into a group (action + breadcrumb + inspector button) |
| ~~`FL-GR5`~~ | ✅ Promote children when a group is deleted (`deleteGroup` flatmap path) |

### Bundle 12 — Multi-document & Sharing ✅ Resolved (EX9 + CO1 shipped Session 74; EX8 + CO2 cancelled Session 91)
EX9 + CO1 shipped Session 74; EX8 + CO2 explored on a preview branch in Session 91 and **cancelled by Dann** before merge. The branch is gone and not coming back — TP Studio stays single-document.

| ID | Feature |
| --- | --- |
| `FL-EX8` | ❌ **Won't build (Session 91).** Multi-document tabs explored on `feature/multi-doc-workspace` (v0 with in-memory tabs, working tab bar, `New tab…` palette command, per-tab undo stacks). After previewing the v0 design Dann decided not to pursue. Branch deleted, PR closed. Re-opening would be a fresh design exercise. |
| ~~`FL-EX9`~~ | ✅ **Auto-recovery on crash** (Session 74 — backup slot + 3-level fallback chain + recovery toast on boot) |
| ~~`FL-CO1`~~ | ✅ **Reader Mode share-link** (Session 74 — gzip-base64 in `#!share=` URL fragment; auto-engages Browse Lock on the receiver side) |
| `FL-CO2` | ❌ **Won't build (Session 91).** Cross-document hyperlinks depended on FL-EX8; with FL-EX8 cancelled this has no home. |

### Bundle 13 — Polish & Preferences ✅ Complete (audited + sealed Session 61)

| ID | Feature |
| --- | --- |
| ~~`FL-DI2`~~ | ✅ Browse Lock toggle |
| ~~`FL-DI3`~~ | ✅ Zoom-up annotation (Session 50) |
| ~~`FL-DI4`~~ | ✅ Annotation numbers toggle |
| ~~`FL-DI5`~~ | ✅ Visible Entity IDs toggle |
| ~~`FL-IN2`~~ | ✅ Document Inspector (Session 56 added System Scope + Method Checklist) |
| ~~`FL-TO1`~~ | ✅ Four named dark theme variants — Rust / Coal / Navy / Ayu (Session 61) |
| ~~`FL-TO2`~~ | ✅ Animation speed preference |
| ~~`FL-TO3`~~ | ✅ Default direction preference for new documents (Session 61) |
| ~~`FL-TO4`~~ | ✅ Edge color palette preference (default / colorblindSafe / mono) |

## Reasonable iteration sizes

- **Smallest meaningful iteration:** Bundle 1, or Bundle 3, or Bundle 13. Roughly a day each.
- **A solid week:** Bundle 1 + 2 + 3 together, or Bundle 4 + 5.
- **A new chapter:** Bundle 9 (Evaporating Cloud) on its own — adds enough new domain to feel like a v1.1.

Domain-first remains the right discipline for any of these: changes to the data model land in `src/domain/` first, with tests, before any UI work.
