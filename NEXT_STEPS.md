# Next Steps

A parking lot. Nothing here is required for v1; everything is honest about what's deferred.

> **Session 85 — under-the-hood pass complete (10 batches, 8 shipped + 2 audit-only).** Twenty maintainability / perf / test-coverage items planned across Phases 1 (A-D) and 2 (E-J); 8 batches shipped real changes, Batch G evaluated audit-clean (3 items not worth the trade), Batches E/F/H/I each carried at least one item that was already done or net-negative. Highlights: per-doc WeakMap memoization for `structuralEntities` + `validate` (saves cost transparently to every caller), property-based migration + CLR-totality coverage via fast-check, dedicated cold-path test for `useGraphPositions`'s lazy dagre import, `vite-plugin-checker` dev overlay, brand-ID consolidation for group selection, CI split into 3 parallel jobs. **1003 tests passing**; full breakdown in CHANGELOG Session 85.

> **Iteration 2 is approved and spec'd.** See [docs/iteration-2-prd.md](docs/iteration-2-prd.md) for the
> full requirement document. Bundles in scope: **1, 2, 3, 5, 6, 11, 13**, plus every item from this
> file's "Recommended priorities" and "Polish ideas" sections (minus anything reasoning-related).

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

> **Session 19 — Tier 1 from the feature-research menu is in.** A4 / A5 / A6 / A7 / F2 / F3 / F4 / F6 / F7 all landed; see the CHANGELOG entry. The remaining tiers from that catalogue ([docs/feature-research.md](docs/feature-research.md)) are the new parking-lot top, listed below.

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
> The one item that didn't ship: **lazy-load dagre**. Attempted via Rollup `manualChunks.dagre` split; Rollup kept dagre in the `flow` chunk anyway (likely because @xyflow/react and dagre share too much surface for Rollup to split safely). The genuine fix is a `dynamic import('@/domain/layout')` inside `useGraphPositions` with Suspense fallback — cascades `await` through every caller. **Parked.** Bundle savings would be ~25 KB gzip from the main path.

> **Type-error sweep + top-10 refactor pass (Session 66).** Cleared the five lingering TypeScript errors (SideBySideDialog adapter for the current `computeLayout` signature, missing `DefaultLayoutDirection` / `LayoutMode` re-exports from `@/store`, branded-id casts in `coreDriver`, `Omit<…, 'id'>`-aware keyof iteration in `docMutate`). Plus ten structural refactors: `structuralEntities` reuse, `NODE_HALF_*` + `ZOOM_UP_THRESHOLD` centralized in `constants.ts`, `withWriteGuard()` higher-order wrapper across all palette commands, `docToLayoutModel()` adapter in `domain/layout.ts`, `useToolbarActions` shared hook for TopBar + KebabMenu, `getEntity()` + `pinnedEntities()` helpers in `domain/graph.ts`, and tests on the `seedDoc.ts` helper path. tsc / Biome / 620 tests / build all green.

> **Mobile / narrow-viewport pass complete (Session 65).** A new `KebabMenu` component lives at the right edge of the TopBar with `sm:hidden`, surfacing the four buttons (Layout Mode, History, Help, Theme) that the existing responsive classes hide below `sm` (640 px). Items auto-close the menu after activation; Escape and outside-click also dismiss. TitleBadge's narrow-viewport `max-w-` bumped from `100%-7rem` to `100%-9rem` to leave room for the extra icon. The Inspector and RevisionPanel already overlaid with tap-to-dismiss backdrops below `md:`, so no changes needed there. 8 new tests in `tests/components/KebabMenu.test.tsx` (628 total, all green). **The remaining backlog is the structural-extensibility tier**: **B7 + B10** (user-defined attributes + custom entity classes) and the parked **confidence-field UI**.

## Deferred from the Bundle 4 + B + E + N plan (Session 46)

Captured here so a future session can pick them up without re-deriving scope:

- ~~**LA5 — generalize manual positioning to all diagrams.**~~ ✅ **Done (Session 63).** Reused the existing `Entity.position` field as the pin signal — no schema change. `useGraphPositions` overlays pinned positions on top of dagre's output; `useGraphMutations` drops the strategy gate so drag-to-pin works everywhere. Visual indicator (pin glyph) on auto-layout diagrams; right-click → Unpin per entity; Palette → Reset layout unpins all.
- **B7 — User-Defined Attributes per entity / edge.** Custom name/value pairs (String/Int/Real/Boolean) attached to any entity. Explicitly excluded from Iteration 2 (PRD section 1). Domain layer can absorb a `Record<string, AttrValue>` slot on Entity; Inspector grows a key/value editor. Pair naturally with B10 custom domains.
- **B10 — Custom entity classes (define your own).** Tied to B7. Lets a user say "this domain has Cause / Effect / Evidence / Belief" with their own colours and icons. Bigger structural change to the type system.
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

- ~~**Insert entity by dropping onto an edge ("splice").**~~ ✅ **Done (Session 55).** Right-click any edge → "Splice entity into this edge" creates a fresh entity at the diagram's default type and replaces the edge with two new ones through the new entity. Label / assumptions / back-edge flag inherit onto the downstream half; AND grouping is dropped with a toast. Drag-and-drop variant of the same gesture is parked — context menu + palette command cover the keyboard-driven workflow.
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

## Tier 2 — New diagram types (from the feature-research catalogue)

The user picked buckets **A / F / H** out of the 16-bucket catalogue. After Tier 1 (small-effort wins) the next concrete chunk is "table-stakes diagrams that aren't CRT or FRT":

- ~~**A2 Prerequisite Tree.**~~ ✅ **Done (Session 20).**
- ~~**A3 Transition Tree.**~~ ✅ **Done (Session 21).**
- ~~**A1 Evaporating Cloud.**~~ ✅ **Done (Session 26).** Two new entity types (`need`, `want`), `diagramType: 'ec'`, hand-positioned layout via `LAYOUT_STRATEGY.ec === 'manual'`, drag-to-reposition persisted through `setEntityPosition` (the dormant position-persist branch from Session 25's prep lit up), `INITIAL_DOC_BY_DIAGRAM.ec` pre-seeds the 5 boxes plus 4 edges at canonical coordinates, example doc, Flying Logic round-trip (positions dropped — FL doesn't carry them). **Tier 2 of the feature-research menu is complete.**

## Tier 3 — Layout & navigation ergonomics

- ~~**F5 Sunburst / radial alternate view.**~~ ✅ **Done (Session 27).** Top-bar toggle flips between dagre flow and a radial sunburst; preference persists app-wide; hidden for hand-positioned (manual) diagrams.
- **F1 Incremental relayout** — **parked**. The premise was "on a 500-node Goal Tree dagre is noticeable," but title/text edits already short-circuit before the layout path thanks to `layoutFingerprint` only hashing structural changes. Dagre only re-runs on add/remove operations, which aren't high-frequency. A componentwise cache would add real infrastructure (per-component shape hashes, packing logic for disconnected graphs) and change the visual layout for disconnected diagrams. Revisit with profile data showing dagre is actually the bottleneck.

**Radial layout polish** ✅ shipped Session 76. Subtree-weighted angular allocation: each center claims an arc of `2π` proportional to its subtree size; each child gets a sub-arc proportional to its own subtree size. Children stay angularly close to their parent; sibling branches don't fight for the same arc.

**Radial edge routing — avoid crossing node bounding boxes** (Session 87 deferred). The current `radialLayout` algorithm produces positions only; edge rendering falls back to React Flow's default bezier between source/target handles. With nodes arranged on concentric rings, sibling/cousin edges often pass directly through other entity boxes — readable on small graphs, increasingly cluttered as the tree grows. Two implementation paths considered: **(a)** custom React-Flow edge type that runs Bezier-around-obstacle (cheaper, ~80% of real cases handled, ~2-4 hours); **(b)** full A* / orthogonal routing (overkill for the use case, much higher complexity). Recommendation: **(a)**. Pairs naturally with any future layout-quality work on the radial mode. Effort: L. Dann deferred this item from Session 87's UX-feedback Phase 4 — picked up when the cost/benefit lines up.

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

## Recommended priorities for the next session

In rough order of "would I notice the difference":

### 1. AND-junction visual polish — ✅ Done (Session 28)

The original dot/arc approach was replaced wholesale by a Flying-Logic-style **junctor circle**: a white circle labelled "AND" sits just above the target, multiple causes converge into it, one arrow continues to the target. Cleaner than the dot+arc+badge stack it replaced, recognizable to FL transplants, opens a clear extension point if we ever add other junctor types (OR / NOT).

### 2. Mobile / narrow-viewport pass

Brief said "responsive down to 1024 px is enough." Below that, the 320-px inspector covers most of the canvas. Below 768 px the title-badge overlaps the top-bar buttons. Concrete improvements:

- Collapsible inspector on narrow viewports (slide off-screen by default, swipe in from the right).
- Hide command/help/theme button labels under a kebab menu at < 768 px.
- Respond gracefully to portrait orientation.

### 3. Component-level interaction tests — ✅ mostly done

Inspector / ContextMenu / CommandPalette landed earlier; **Session 34** added TopBar, SettingsDialog, HelpDialog, EntityInspector, EdgeInspector (33 more tests). **Session 35** added shortcut-registry + linkage tests (10 more). TPNode + TPEdge tests landed alongside the canvas hook split. **Session 83** added the Toaster test (6 tests — auto-dismiss timing via fake timers, manual dismiss, dedup, rendering per kind).

Remaining gap:

- **Canvas itself** (React Flow shell + double-click + selection wiring) — pulling `<ReactFlow>` into jsdom still hits the same fiddliness; the dblclick contract is covered by the `e2e/smoke.spec.ts:47 canvas double-click creates a new entity` Playwright test which runs on CI. Parked.

(Two pre-existing failures previously flagged here — CommandPalette subsequence scorer false positive + radialLayout apex-at-center premise — were fixed in **Session 37**. The suite is fully green.)

### 4. Backward-incompatible migrations stub — ✅ Done (long since)

Backlog entry was stale — the framework is in `src/domain/migrations.ts` with `CURRENT_SCHEMA_VERSION = 7` and six registered migrations (v1 → v7). `importFromJSON` calls `migrateToCurrent` before its strict shape check, so downstream guards assume the target version. Covered by `tests/domain/migrations.test.ts` + `tests/domain/migrationsRoundTrip.test.ts`. The schema has bumped through six versions over the project's life — every backward-incompatible change has used this framework.

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

## EC canvas chrome cleanup (Session 89 visual review)

Visible issues with the combined EC chrome wrapper introduced in Session 88's V2. Dann screenshotted three vertically-stacked rows of chrome where the spec called for one collapsible surface, plus a top-right injection chip overlapping the TopBar buttons. Fix as one bundled commit; reuses the existing `ecChromeCollapsed` infrastructure — this is a visual cleanup pass, not a re-design.

- **`"EC CHROME"` outer label** — V2's wrapper renders a literal `EC CHROME` uppercase text row above the reading-instructions strip. The label isn't useful (the strip below it is self-labelled "READ EVERY ARROW", and the collapsed verbalisation chip below that says "EC reading · …"). **Recommendation:** drop the outer label row entirely; move the collapse chevron to the right edge of the existing READ EVERY ARROW strip so one chevron controls both inner strips together.
- **Injection-chip vs. TopBar collision** — At sm+ the "Injections (N)" chip sits at `top-2 right-4`, overlapping the lock / history / help / theme icons. Move the injection chip down (`top-12 right-4`) so it sits just below the TopBar, OR fold the injection count into the combined EC chrome row so all EC meta-controls live in one place.
- **Three rows of chrome instead of one** — Original V2 intent was *one* collapsible surface, default-collapsed, summarizing both reading instructions and verbalisation. As shipped, the surface is *expanded* by default AND adds an outer label, so the EC canvas now starts with three rows of chrome eating ~120 px of vertical space. Flip the `ecChromeCollapsed` default to `true` so first-load is one summary line.
- **TitleBadge truncates long titles without ellipsis** — pre-existing; visible because the new EC chrome layout doesn't give the title much horizontal room. Add `text-ellipsis overflow-hidden whitespace-nowrap` to the title input or bump the `max-w` cap.
- **Stale-localStorage example titles still show "(example)" suffix** — Session 87 (V1) dropped the suffix from new example loads, but docs already saved in localStorage retain the old title. Not a bug per se; document the behaviour in USER_GUIDE so users who see stale titles know to expect them on docs created before Session 87.

Effort: S–M. One commit; existing V2 / `ecChromeCollapsed` infrastructure stays.

## ~~🔴 HOTFIX — example EC loader missing v7 schema fields~~ ✅ Done (commit `35466ad`)

Was the Session 87 hotfix. Shipped — example EC now has correct `ecSlot` bindings, necessity edges, and D↔D′ mutex edge. Stale stale-comment cleanup per memory rule.

## UI tidy batch (Session 87 review — 14 quick wins)

Bundled from both UI reviews (static + visual). Each is S-effort, no design ambiguity; ship together as one "UI tidy" commit. Numbered to match the source docs (S## = static review item, V# = visual review item).

1. **(S1) Browse-Lock icon** — pick one icon and toggle via the color variant, not via icon swap (today's `Lock` ↔ `Unlock` swap fights the state-color swap). Also confirmed visually in V7.
2. **(S2) Print dialog `{pageNumber}` / `{pageCount}`** — currently listed in help but resolve to empty; either drop them or annotate "(filled by browser)".
3. **(S3) EmptyHint** — add palette + templates entry paths alongside the existing double-click hint.
4. **(S4) CommandPalette section headers** — drop `aria-hidden` so screen readers announce category transitions.
5. **(S5) Creation wizard toggles** — collapse two Settings toggles into one "Show creation wizards" with optional per-diagram override.
6. **(S6) Animation speed "Default" label** — rename to "Normal" or add a "(200 ms)" hint.
7. **(S7) PrintPreviewDialog footer-template help row** — list merge fields above the input, same as the Header field.
8. **(S8) Browse Lock toast wording** — explain where to disable it ("Settings → Behavior or the top-bar lock icon").
9. **(S9) Toaster vs. React Flow Controls collision** — bump Toaster to `bottom-20` or move Controls.
10. **(V1) Drop "(example)" suffix from example doc titles** — verbose; the diagram-type badge already says the type. Applies to every `src/domain/examples/*.ts` title.
11. **(V3) Fit View on example load** — examples use canonical seed coordinates that overflow narrower viewports; auto-fitting after `setDocument(buildExampleX())` keeps everything in view.
12. **(V4) Entity-type label legibility** — at default Fit View zoom on busy diagrams, the uppercase type label (`EFFECT`, `GOAL`, etc.) is ~6 px tall. Bump font-size or letter-spacing.
13. **(V6) Annotation appendix in a11y tree** — `<aside>` is `display: visible` when not printing; screen readers can hit it unexpectedly. Add `aria-hidden="true"` outside of `body.print-include-appendix` mode.
14. **(V10) Verify TopBar at 480 px (`xs:` breakpoint)** — static review covered ≥640 px; the new `xs` breakpoint added Session 83 deserves a check.

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
- **First-Entity Tip — add rename + delete hints** (item #19, S) — not picked up; future session.

## UI bigger asks (Session 87 review — 7 items needing design conversation)

M+ effort, may need a Dann decision before picking up:

- **Esc handling consistency** across modal/panel layers (item #23). Most cross-cutting; doing it well unblocks others.
- **Global status indicator** (item #24) — single bar showing lock / hoist / history / wizard / search state.
- **Settings dialog → tabs** (item #25) — inevitable as the dialog grows.
- **Visible Undo affordance** (item #26).
- **Alt-drag-to-splice discoverability** (item #27).
- **Marquee selection discoverability** (item #28).
- **Browse Lock toast dedup** (item #29) — verify the dedupe key handles cascades.

EC-specific findings (items #30-34) are parked until the EC PPT comparison agent ships and the surfaces stabilize; cross-cutting tech-debt items (#35-40) belong in a future focused-1-hour pass.

## EC PPT comparison

Gaps surfaced by comparing TP Studio's EC against the canonical BESTSELLER PowerPoint workshop template (`TEMPLATE evaporating cloud.pptx`). Each item is a small, focused upgrade; ranked by leverage. **Session 87 shipped 6 of 7; #5 deferred for separate scoping.**

- ~~**Numbered reading-instruction chips on the EC canvas.**~~ ✅ **Done (Session 87).** New `src/components/canvas/ECReadingInstructions.tsx` — dismissible top-of-canvas strip surfacing the "1) In order to / 2) we must / 3) because" meta-reading. EC-only; session-scoped dismissal flag `ecReadingInstructionsDismissed`. Stacked above the existing VerbalisationStrip.
- ~~**Per-slot guiding questions visible after the wizard closes.**~~ ✅ **Done (Session 87).** New `src/domain/ecGuiding.ts` exposes `EC_SLOT_GUIDING_QUESTIONS` keyed by ECSlot. EntityInspector re-surfaces the slot-specific question whenever an EC slot entity is selected.
- ~~**Reverse-direction (D-first) elicitation framing.**~~ ✅ **Done (Session 87).** CreationWizardPanel grew a per-wizard toggle between A-first (default) and D-first ("from the conflict") walks. The slot order flips via `EC_SLOTS_BY_ORDER`; existing wizard tests still pass, new tests cover both walks.
- ~~**"Me vs. the other side" two-party verbal framing.**~~ ✅ **Done (Session 87).** Schema v7 → v8: new optional `TPDocument.ecVerbalStyle: 'neutral' | 'twoSided'`. `verbaliseEC` swaps "we must" → "they want to" / "I want to" on the D and D′ sides in twoSided mode. Toggle lives in DocumentInspector under the EC section. `setECVerbalStyle` store action with `doc-ec-verbal` coalescing.
- **One-page workshop-handout EC export.** The PPT is a 16:9 fixed-layout page suited for printing — boxes, arrows, assumption fan-outs, guiding-question reference, all on one sheet. TP Studio's existing PDF / print exports faithfully render the interactive canvas but not a print-optimized one-page workshop sheet. Two implementation paths: (a) a new "EC Workshop Sheet" PDF layout that lays out the doc into PPT-style coordinates with the reference table baked in, or (b) generate a `.pptx` directly via a library like `pptxgenjs` so the user can hand-edit further in PowerPoint. Path (b) adds bundle weight but produces a more familiar deliverable. **Effort: M.** Biggest single-feature ask of the comparison — worth a separate scoping conversation before picking up. *(Deliberately deferred in Session 87.)*
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
- **OneDrive sync + `node_modules`** is slow and occasionally lock-prone. The project lives at `C:\dev\tp-studio` for that reason.
- **`pnpm-workspace.yaml`** is autogenerated with anomalous content by pnpm 11 in some environments. If `pnpm add` silently fails to update `package.json`, check for and delete that file.
- **`html-to-image`** is dynamic-imported now (round 3 / item 5). The dynamic chunk only loads when PNG export runs.

## When picking this up next

1. **Pull the project state.** `cd C:\dev\tp-studio && git status` — should be clean. `pnpm install` (the preinstall script will verify Node 20+). `pnpm dev` to start. `pnpm test` to confirm 87/87 green.
2. **Open** [README.md](README.md) for architecture, [USER_GUIDE.md](USER_GUIDE.md) for the feature surface, [CHANGELOG.md](CHANGELOG.md) for what got built when.
3. **Pick a candidate** from the recommended priorities above, or propose something else.
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

### Bundle 9 — Evaporating Cloud (second TOC tree)
Highest-leverage brief-deferred TOC feature. **Large.**

| ID | Feature |
| --- | --- |
| `FL-DT1` | **Evaporating Cloud** diagram type |
| `FL-ET1` | **Goal** entity type |
| `FL-ET2` | **Necessary Condition** entity type |
| `FL-ED2` | **Necessity edges** (in addition to sufficiency) |

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

### Bundle 12 — Multi-document & Sharing (partial)
EX9 + CO1 shipped Session 74; EX8 + CO2 remain.

| ID | Feature |
| --- | --- |
| `FL-EX8` | **Multi-document tabs** in one window — open. Large refactor: single-doc store → `docs: Record<DocId, TPDocument>` + `activeDocId`. |
| ~~`FL-EX9`~~ | ✅ **Auto-recovery on crash** (Session 74 — backup slot + 3-level fallback chain + recovery toast on boot) |
| ~~`FL-CO1`~~ | ✅ **Reader Mode share-link** (Session 74 — gzip-base64 in `#!share=` URL fragment; auto-engages Browse Lock on the receiver side) |
| `FL-CO2` | **Cross-document hyperlinks** — open. Depends on FL-EX8. |

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
