# Next Steps

A focused parking lot of open work — fresh items only. Historical context lives in CHANGELOG.md.

---

## Open product questions (Session 171 — Dann, "remember the questions")

- **Direction arrows on causal connectors — DECISION PENDING.** Should every
  causal / necessity connector carry a clear cause→effect arrowhead? **My
  recommendation: yes** — in the TP, the arrowhead *is* the logic (sufficiency /
  necessity direction); it's the Goldratt / Flying-Logic convention and the only
  thing that disambiguates reading direction once edges cross, a back-edge loops,
  nodes sit side-by-side, or a diagram is exported and read cold. **Current state
  (verified at 200%):** the junctor output draws a clean arrowhead but plain causal
  connectors draw none — `useGraphEdgeEmission` *does* set `markerEnd: ArrowClosed`
  on every non-junctor edge, so it's being occluded at the handle or rendering too
  faint; likely a small fix to surface, not a new feature. Keep the three deliberate
  exceptions: junctor groups share one output arrow (no per-cause arrows), mutex
  (EC D↔D′) stays symmetric/arrow-less, note edges stay dotted/arrow-less.
  **Sub-question for Dann:** default-on for everyone, or a Settings → Appearance
  toggle (default on)? I lean default-on, no toggle.

---

## Up next (Dann, Session 146 — canvas interaction)

Queued right after the layout-aesthetics batch (margin 60→150 + adaptive rank
spacing, shipped Session 146):

1. ~~**Stronger hover + selection affordance on entities.**~~ ✅ *Session 147* —
   a plain node now lifts on hover (neutral `ring-1` + `shadow-md`) and the
   selected ring is beefed (full-opacity indigo + soft glow), at parity with the
   edge cues. Done in `TPNode.tsx` reusing the existing local `isHovered` — no
   store flag needed (simpler than this sketch); hover gated below selection /
   diff / connection-drop rings.
2. ~~**Re-target an existing connector.**~~ ✅ *Session 148* — drag an edge
   endpoint onto another entity to re-parent it, via React Flow reconnection →
   the guarded, undoable `reconnectEdge` action (self-loop / duplicate guards;
   junctor membership dropped on a target move; assumptions kept). Aggregated /
   collapsed-remapped edges emit `reconnectable: false`. Gated on Browse Lock;
   drop-on-empty snaps back.

---

## Refactoring targets

- ~~**Split `src/domain/edgeRouting.ts` (~1150 lines — the largest file).**~~ ✅
  *Session 164* — split into `edgeGeometry.ts` (193; types + constants +
  box/segment primitives, a dependency-free leaf), `edgeBezier.ts` (287; emitters
  + samplers), and `edgeVisibilityGraph.ts` (480; visibility-graph + A\*).
  `edgeRouting.ts` is now 271 lines (orchestrator + re-export hub), so
  `@/domain/edgeRouting` stays the single public entry and no consumer import
  changed. The leaf also **dissolved the old `edgeSides` ↔ `edgeRouting` value
  cycle**. Byte-identical routes (the `edgeRoutingAStarParity` golden tests pass
  unchanged). The backlog's only standing refactor target is now done.

---

## Canvas structural tier — complete (from the Session 168 sweep)

The Session 168 4-agent sweep mapped the rendering/flow/clickability layer.
**Landed (CI-green, Sessions 168–170):** `nodeSizeFor`, `waypointMidpoint`,
edge-palette a11y fix, `openRightPanel`, `markEntityAs`, TPGroupNode `memo`,
`resolveEdgeVisuals`, `computeMutexPath`, the **full EntityInspector
decomposition** (all five sections out — `StFacetsSection` / `EntityStateSection`
/ `ActionFields` / `EntityLinksSection` / `EntityProvenanceSection`, 718 → 363
lines), `useRadialRoute`, `resolveConnectEndTarget`, and the **subscription-hygiene
micro-opts** (`CommentCountBadge` `useCallback`, `SelectionToolbar` junctor-topology
hash, `CanvasInner` assessed-no-change). **The tier is complete — every sweep
finding is shipped or consciously closed** (item 3 records the one we declined).

**The verification loop (important — this is how to continue safely):** extract
the pure core *first* and unit-test it (vitest), then run/extend the relevant
**Playwright e2e** spec in `e2e/` — real Chromium drives React Flow selection /
drag-to-connect, which jsdom (and the headless preview MCP) cannot. Local run:
start the preview yourself (`pnpm` is AppLocker-blocked, but `reuseExistingServer`
picks up your own server):
`node ./node_modules/vite/bin/vite.js preview --port 4173 --strictPort` &, then
`node ./node_modules/@playwright/test/cli.js test e2e/<spec> --reporter=list`.
The `visual-*` specs and `smoke › Cmd+K` are env-sensitive locally (Linux-only
snapshots / Windows Meta-key) — **CI's e2e job is the authoritative run.** Finish
with the full local gate (tsc/biome/knip/vitest/build) → commit → CI green.

1. ~~**EntityInspector — section decomposition.**~~ ✅ *Session 169* — all five
   sections extracted (`StFacetsSection` / `EntityStateSection` / `ActionFields` /
   `EntityLinksSection` / `EntityProvenanceSection`) via verbatim-lift + typed-props
   + wrap-store-writes-in-parent; 718 → 363 lines. Guarded by `e2e/inspector.spec.ts`
   (real-Chromium State-picker + ActionFields assertions).
2. ~~**Deeper TPEdge — extract `useRadialRoute`.**~~ ✅ *Session 170* — the
   radial obstacle-router (two subscriptions + the position-keyed memo + the
   `radialNodesEqual` comparator) now lives in `useRadialRoute.ts`, with a pure
   `radialRouteForEdge` core (`useRadialRoute.test.ts`, 4 cases). TPEdge dropped
   ~65 lines. **The other half — stamping `mutexPath` / `isRadialMode` into edge
   `data` at emission to kill the subscriptions — was deliberately declined:**
   `useGraphEdgeEmission` is intentionally position-independent (its header
   documents that drags don't re-run it), so moving position-dependent routing
   there would break drag-tracking or force per-drag re-emission of every edge;
   the subscriptions removed are primitives that effectively never fire. Net perf
   ≈ nil vs. real regression risk — not worth it.
3. **Hover / clickability consolidation.**
   - ~~*Extract a pure `resolveConnectEndTarget` from the ~90-line `onConnectEnd`.*~~
     ✅ *Session 170* — discriminated union (`noop` / `connect` / `junctor` /
     `junctor-missing` / `edge-andcause`); the handler is now snapshot-then-`switch`.
     Unit-tested (precedence matrix, 10 cases) + the 9 existing `useGraphMutations`
     integration tests pin the rewired side effects. A new drop-target is "a variant
     + a case."
   - *Decided against (Session 170) — the 3-hover-channel unification.* The sweep
     floated unifying `hoveredEdgeRef` + `hoveredEdgeId` + the `hoveredJunctor`
     singleton (`services/canvasRef.ts`) into the store. On inspection the premise is
     weak: two of the three are deliberately **non-reactive** (a `useRef` + a module
     singleton) so cursor movement over edges / junctors *during a drag* doesn't fan
     re-renders — they're read imperatively in `onConnectEnd`, not subscribed. Forcing
     them into the reactive store risks regressing drag perf for a change with **zero
     user-facing effect**, and the only safe variant (drop the ref → read
     `hoveredEdgeId` via `getState()`; move the junctor to a non-subscribed store
     field) is timing-sensitive enough to need a brand-new real-browser
     drag-to-connect spec. Lowest value × highest regression surface × most new test
     infra of anything the sweep surfaced → **not worth doing.** Removed by decision,
     not deferral; re-open only if the hover channels cause a concrete bug.
4. ~~**Subscription hygiene (the sweep's last micro-opts).**~~ ✅ *Session 170* —
   `CommentCountBadge` `onOpen` → `useCallback` (the `memo`'d badge was getting a
   fresh inline arrow per `TPNode` render); `SelectionToolbar` whole-`doc.edges` →
   a sorted junctor-topology hash (verb list depends on edges only via the
   `multi-edges` `any{And,Or,Xor}Grouped` group-field checks — audited). `CanvasInner`
   whole-`doc` sub **assessed + left as-is** — it's the projection host (`doc` feeds
   `useGraphView`/`useSearchDimming`/drag handlers), so the whole-doc dependency is
   intrinsic and downstream `useMemo`s already gate the expensive work; no sound
   narrowing exists.

---

## TP completeness — phased roadmap vs. Cohen's *TP Basics* (Session 154+)

Full mapping in [docs/TP_BASICS_GAP_ANALYSIS.md](docs/TP_BASICS_GAP_ANALYSIS.md)
(against Oded Cohen's TOCICO-2014 *TP Basics*). The primitives are all present; the
gaps are the **connective tissue** of Cohen's journey — Cloud progression and the
U-Shape. **Approved phased plan, additive throughout**: the basic CRT/EC/FRT/Goal
Tree tools stay exactly as simple as today, every new field is optional (→ no
schema migration), and each affordance is invisible until invoked.

- ~~**Phase 1 — Cloud progression (#1)**~~ ✅ *Session 154* — optional `cloudType`
  tag on EC docs (Dilemma / Conflict / UDE / Consolidated / Core / Firefighting),
  set in the Document panel, shown as a title chip; + 3 library clouds (UDE / Core
  / Firefighting). Mirrors `ecVerbalStyle`; `src/domain/cloudType.ts`.
- **Phase 2 — U-Shape linkage (#2)** *(guided — Dann's pick)* — the strategic
  centrepiece, in two opt-in steps:
  - ~~**2a — navigable cross-doc link primitive**~~ ✅ *Session 155* — optional
    `Entity.links?` ({docId, entityId}, validated like `importedFrom`); a
    reciprocal "Link to entity in another tab…" command + `LinkEntityPickerDialog`;
    a clickable "Linked to" inspector chip → `switchTab` + `selectEntity` (+ ×
    unlink). `linkSelectedEntityTo` / `unlinkEntity` in `docMetaSlice`. The
    keystone is in — it unlocks the U-Shape and feeds #3/#4.
  - ~~**2b — core-problem marker + guided "build-next-step" helpers**~~ ✅
    *Session 156* — optional `Entity.coreProblem?` flag + "Mark / unmark as core
    problem" (palette + inspector toggle); **"Create the Core Cloud from this
    entity…"** (spawns a linked EC, `cloudType:'core'`) and **"Carry this into a
    new FRT…"** (spawns a linked FRT). Pure builders in `src/domain/uShape.ts`;
    `spawnLinkedFromSelection` bakes the reciprocal link + opens the new tab.
    **Phase 2 (the U-Shape) is complete.**
- **Phase 3 — smaller gaps, each opt-in:**
  - ~~#4 NBR "Trim this branch"~~ ✅ *Session 157* — palette verb mints a trimming
    `injection` + a **negative-weight** edge to the selected undesirable effect
    (atomic `trimBranch` in `edgesSlice`; `trim-branch` command). Reuses the
    `injection` type + `EdgeWeight` model, no schema change.
  - ~~#8 per-step Need + Working-Assumption on TT~~ ✅ *Session 158* — optional
    `Entity.need?` + `Entity.workingAssumption?` (action-only inspector fields,
    validated like the other entity strings; no schema change).
  - ~~#7 guided per-edge CLR scrutiny~~ ✅ *Session 160* — a **"Scrutinize this
    edge"** stepper walks all eight canonical CLR questions for one selected edge
    (palette command + a "Scrutinize against the CLR" button in the edge
    inspector), surfacing any auto-flagged warnings under the matching question.
    Distinct from *Start CLR walkthrough* (which only steps warnings that already
    fired). Ephemeral review surface over the existing validators —
    `src/domain/clrScrutiny.ts` + `EdgeScrutinyDialog`, `edgeScrutinyId` on
    `dialogsSlice`, no schema change.
  - ~~#3 Injection Flower~~ ✅ *Session 161* — a read-only **"Injection flower"**
    view groups one injection's Phase-2a cross-doc links into Cohen's petals
    (Desired effects / Negative branch / Plan, by the linked doc's diagram type)
    with a "N of 3 sides developed" completeness summary and prompts for the
    missing petals. Palette command + an inspector button; `injectionFlower.ts`
    pure helper + `InjectionFlowerDialog`, no schema change.
  - ~~#6 PRT → IO sequencing → plan export~~ ✅ *Session 162* — a
    **"Prerequisite plan (CSV)"** export topologically orders a PRT's
    Intermediate Objectives (prerequisite-first) and emits one row per IO
    (step / objective / overcomes / depends_on / owner / due / status / notes),
    extending the TT task-bridge. Pure `services/exporters/prtPlan.ts`; gated to
    docs with IOs; no schema change.
  - ~~#5 performance-measurement anchors~~ ✅ *Session 163* — optional
    `performanceLow?` / `performanceHigh?` strings on `TPDocument` (current vs
    target measurement notes), edited in a collapsible **"Performance frame"**
    section of the Document panel; soft-validated, coalesce-and-drop-blank
    setters mirroring `setCloudType`. Diagram-agnostic facilitation note, no
    schema migration.
  - **Phase 3 is COMPLETE** — #4 NBR trim, #8 TT step fields, #7 CLR scrutiny,
    #3 Injection Flower, #6 PRT plan export, #5 performance anchors all shipped.
    With Phases 1 (Cloud progression) + 2 (the U-Shape) already done, the whole
    additive TP-completeness arc vs Cohen's *TP Basics* is delivered.
- **Out of scope:** the PIVOT internals (Five Focusing Steps, constraint types,
  Buffer Management) — execution / DBR, not TP diagramming.

---

## Review comments (Sessions 139–140)

The local-first comment layer shipped Session 139 (panel + palette/TopBar entry
points), and the three "surfacing" fast-follows shipped Session 140. What's left
is one standalone item plus two parked notes:

- ~~**Comment-count badges on nodes / edges**~~ ✅ *Session 140* — clickable indigo
  speech-bubble pill (open-comment count) stamped via the emission pipeline
  (`openCommentCountsByAnchor`), click selects the anchor + opens the panel.
- ~~**Selection-toolbar "Add comment" verb**~~ ✅ *Session 140* — on single-entity /
  single-edge selections; not write-guarded, so visible under Browse Lock.
- ~~**Jump-to-edge centers the viewport**~~ ✅ *Session 140* — the thread chip now
  centers the canvas on the edge midpoint.
- ~~**Free-floating canvas-pin comments**~~ ✅ *Session 141* — new `point`
  `CommentAnchor` variant, pane "Add comment here" placement, and a
  `CommentPinsOverlay`. Drag-to-reposition a pin is the only deferred sub-item
  (place + click-to-open shipped).
- **Browse-Lock interaction** — comments are intentionally *not* write-guarded
  (annotating a read-only shared doc is useful). Revisit only if a reviewer wants a
  truly read-only comment view.
- **Real-time / multi-user comments** — out of scope (won't-build #2). The shipped
  layer is single-user / local-first; a future Yjs layer would sync it.

---

## Performance optimization candidates (Session 140 audit) — deferred

The Session-140 audit surfaced ~30 candidates; the safe, locally-verifiable,
high-value ones shipped Session 142 (see CHANGELOG). The rest are deferred —
most are real wins but carry correctness/CI risk not worth taking in a wind-down:

- ~~**Narrow the emission memo deps**~~ ✅ *Session 143* — `useGraphProjection`,
  the reach-count memos, and the node + edge emission memos are now keyed on the
  specific `doc.*` fields each reads (audited per memo + transitive callees), so
  a non-structural doc edit (CLR-resolve, document title/description) skips the
  whole NODE pipeline. **Edge side completed Session 144:** `useEdgeRoutes` is
  now keyed on `doc.edges`/`entities`/`groups`/`diagramType` (the four fields
  `computeEdgeRoutes` reads — audited exhaustively), so the A\* routing — and
  the edge emission downstream of it — skips on a non-structural edit too; both
  sides of the canvas pipeline now skip. **Still open here:** narrow
  `CanvasInner`'s own whole-`doc` subscription — it still re-renders the
  wrapper, though the now-stable pipeline means no actual canvas work results.
  Note: editing an *entity* title legitimately re-emits (it's a structural
  change) — this targets non-structural churn, not every keystroke.
- **Per-node `TPNode` selector reads whole `currentDoc`** for `diagramType` /
  `customEntityClasses` (session-invariant) — hoist to a stable selector. Same
  re-render-correctness risk class.
- **Narrow `SelectionToolbar`'s whole-`edges` subscription** — risks stale verbs
  (`verbsForBranch` reads live state via `getState()`); explicitly deferred
  before (Session 138 L2).
- ~~**A\* open-list `Set` linear-scan → binary min-heap**~~ ✅ *Session 145* —
  shipped **route-identical**. `AStarOpenHeap` keys on `(fScore, insertion-seq)`;
  each vertex's seq is assigned ONCE on first entry (so lazy decrease-key
  re-pushes never re-sequence it), reproducing the old `Set`'s insertion-order
  tie-break exactly. 8 golden routes through symmetric tie-prone fields prove
  byte-identical output (`tests/domain/edgeRoutingAStarParity`, run without
  `--update`). O(V²)→O(V log V) on the routing hot path.
- **Per-edge `obstaclesForEdge` allocation → skip-indices** — needs new
  skip-index params on the routing helpers; routing-correctness-sensitive.
- ~~**`persistActiveDoc` double `JSON.stringify`**~~ ✅ *Session 144* — serializes
  the doc ONCE and feeds the string to both the per-doc committed slot and the
  legacy dual-write (was two `JSON.stringify` of the same body per committed
  save). **Still deferred:** a doc-unchanged *dirty-check* on the debounced save
  — a content check keyed on the legacy `lastCommittedRaw` can't safely gate the
  per-doc committed slot, which `docMetaSlice` (rename / create / swap) writes
  independently; would need a per-doc last-committed map.
- **CI: build-once `dist` artifact + conditional docs-bundle prebuild** — can't
  be verified locally and restructure CI; defer to a CI-iteration session.
- **Vitest `environment: 'node'` default + `pool: 'threads'`** — the biggest
  suite-runtime win, but needs every component/hook test marked jsdom + verified
  isolation; high risk of breaking the suite. Do it deliberately behind a green
  full-suite gate.
- **Bundle: split micromark/dompurify off the eager chunk; idle-prefetch lazy
  panels** — verifiable via build; medium effort.
- **`bundle-budget.json` react ceiling** — deliberately left unbudgeted (a
  documented vendor-cost decision), so not a regression to catch.
- **Perf-bench files out of the default `pnpm test` glob** — the Vitest
  `exclude`-replaces-default footgun; do via a renamed `*.bench.ts` pattern.

---

## Code-inspection follow-ups (Session 138) — deferred

The High / Low / Medium inspection batches all shipped (see CHANGELOG
"Code-inspection hardening"). What's left is a short list of items assessed and
deliberately deferred — each is its own deliberate change, not a quick pass:

- **Isolate `CanvasInner`'s doc subscription** — it subscribes to the whole
  `doc` and re-renders on every keystroke. Downstream hooks are memoized and
  the `onInit` / `onSelectionChange` handlers are now stabilised, but the full
  fix (split the doc-dependent subtree into a memoized child) is architectural.
- ~~**Split `edgeRouting.ts` (1050 lines)**~~ ✅ *Session 164* — done via the
  geometry-leaf + bezier + visibility-graph decomposition (see Refactoring
  targets above). The circular-import worry was resolved by the dependency-free
  `edgeGeometry.ts` leaf, which `edgeSides` now imports directly.
- **Narrow the SelectionToolbar `edges` subscription** — risks stale verbs
  (`verbsForBranch` reads full live state via `getState()`); a hand-maintained
  edge signature would be a latent staleness trap for marginal gain on a
  selection-only component.
- **Parameterise the 3 transient-highlight test files** — only worth it if a
  4th flag is added; tests currently favor explicit-over-DRY.
- **`useOutsideAndEscape` / global-cascade Esc double-listener for Modals** —
  the concrete walkthrough instance is fixed via the cascade; the general Modal
  double-close is idempotent (cascade early-returns). Revisit only if a Modal
  that ISN'T registered in the cascade surfaces an "Esc clears selection" bug.

Three findings were investigated and confirmed NOT real issues (logged so they
don't get re-flagged): the live-draft "silent swallow" (`writeString` already
reports failures via `reportError` → the store's quota handler); the
`useGraphPositions` async "stale commit" (the `cancelled` flag bails the stale
IIFE post-`await`); and `reduceXor`'s unknown-handling (correct — XOR with an
undetermined input is genuinely undetermined).

---

## Open major gaps from the spec analysis

Source: `toc_tp_software_requirements.docx` (Session 134 review). After Sessions 134–135, **zero of ten** original major gaps remain open — every one is closed or explicitly out of scope. **Out of scope** per Dann's call (Session 135): #2 multi-user collab, #8 enterprise integration, plus AI integration (spec §5) — see won't-build section. **Closed:** #1 NBR, #3 cross-diagram traceability, **#4 confidence / propagation (Phases 1A + 1B + 1C)**, #5 risk register, #6 entity ownership + evidence, #7 task bridge (universal CSV — per-tracker formats follow if requested), #9 formal mode-switching, #10 PowerPoint export.

### ~~🔴 #3 — Cross-diagram traceability~~ — *done Session 135*

Spec §6.2. **Closed Session 135 across Phases 1A + 1B.** The schema (`ImportedFromRef` type + `entity.importedFrom?` field with strict persistence validation) ships alongside the UI flow:

- **Palette command** `Import entity from another doc…` (Cmd+K) — opens a file picker, parses the source TP Studio JSON, hands the entity picker the parsed doc.
- **Entity-picker dialog** — filterable list of causally-meaningful entities in the source doc, per-entity cards with type chip / annotation number / title / description. Click → mint copy.
- **`addImportedEntity` store action** — mints a fresh entity in the current doc with `type`/`title`/`description` copied + `importedFrom` set + ISO timestamp captured at mint time.
- **Inspector badge** — "Imported from <sourceTitle> · doc <id> · imported <date>" indigo-tinted card on entities with `importedFrom` set.

9 new tests across persistence round-trip (`tests/domain/persistenceRoundTrip.test.ts`) + store action (`tests/store/importEntity.test.ts`).

**Phase 1C left as future-iteration parking lot:** cross-doc store + reverse-lookup + jump-to-source. Gated on multi-doc tabs (currently out of scope per the won't-build list). Re-open when a concrete portfolio-view use case lands.

### ~~🔴 #9 — Formal mode-switching~~ — *done Session 135*

Spec §7.1. **Closed Session 135 across Phases 1A / 1B / 1C.** All four modes have visible, distinct behaviour:

- **Expert** (default) — every affordance, no overrides.
- **Guided** — creation wizards force-shown on `newDocument` regardless of the dismissed-by-default suppress flags (`showGoalTreeWizard` / `showECWizard`).
- **Workshop** — `.app-mode-workshop` body class bumps `--text-node` 15px → 18px + line-height 1.4 for projected-canvas readability.
- **Presentation** — `App.tsx` + `Canvas.tsx` hide `TitleBadge` / `TopBar` / `SelectionToolbar` / `Inspector` / `CanvasNav`; `setAppMode('presentation')` auto-engages Browse Lock; new `PresentationStepThrough` overlay (bottom-centre chip with Prev/Next + position label; arrow-key bindings) walks entities by ordering then annotation, `fitView`-focuses on each step.

State + palette commands persist across reloads via `StoredPrefs.appMode`. 12 tests cover state, persistence, command registry, Browse Lock auto-engage, wizard force-show.

**Deferred extras** (re-open if a concrete use-case lands):
- Workshop session timer — UX choices too open-ended without a facilitator use-case
- Workshop auto-engage high-contrast edge palette — stateful restore on leave adds complexity
- Guided method-checklist auto-open — heavy modal on every new doc is intrusive

### ~~🔴 #4 — Confidence / propagation simulation~~ — *done Session 135 (Phases 1A + 1B + 1C)*

Spec §3.4 — the FRT module's signature behaviour. **Fully closed.**

- **Phase 1A — schema.** `EntityState = 'true' | 'false' | 'unknown' | 'disputed'` + `entity.state?` + strict persistence.
- **Phase 1B — engine + inspector.** Pure `propagateStates(doc)` with edge-weight (`'negative'` flips, `'zero'` skips), junctors (AND / OR / XOR), cycle handling; `effectiveState` merge helper; inspector 4-button picker + conflict caption.
- **Phase 1C — what-if speculation.** `propagateStates(doc, overrides?)` overlay-aware engine + UI-only `speculationSlice` (begin / set / clear / revert / commit; commit is one undo step via bulk `setEntityStates`). Canvas state badges (the deferred 1B node chip — green T / red F / amber ?, dashed ring when speculative), `SpeculationBanner` (Commit / Revert / Esc), inspector picker speculation mode, 3 palette commands. +28 tests.

---

## Open medium gaps

- ~~**Action quality checks** (control / influence / authority for TT actions).~~ ✅ Done Session 135 — `tt-action-locus-unset` validator wired into the TT diagram registry. Fires on action entities without `spanOfControl` set; tier `clarity`. 9 tests cover positive + every non-firing case.
- ~~**Roll-up validation for S&T**~~ ✅ Done Session 135 — `st-tactic-rollup` validator wired into the S&T diagram registry. Fires on non-apex `injection` tactics that lack child tactics; tier `sufficiency`. 8 tests cover the apex / intermediate / leaf shapes.
- ~~**S&T assumption sub-typing**~~ ✅ Done Session 135 — `AssumptionKind = 'necessary' | 'parallel' | 'sufficient'` + optional `Assumption.kind` field + strict persistence + `setAssumptionKind` action + a cycling kind chip in AssumptionWell (—/N/P/S). 9 tests.
- ~~**"Preserve rejected logic in collapsed groups"**~~ ✅ Done Session 135 — `Group.archived?` flag + `showArchivedGroups` pref + projection hides archived groups & members unless revealed. GroupInspector Archive/Unarchive button (auto-reveals on archive) + 2 palette commands + dimmed canvas treatment. 8 tests.
- **Reactive vs proactive NBR mitigation distinction** — current NBR (Session 134) infers mitigation status from injection-reachability. Spec wants a formal `mitigation.kind` field. Re-open only if practitioners ask.
- ~~**Action eligibility based on satisfied preconditions**~~ ✅ Done Session 135 — `actionEligibility(doc, derived, actionId, overrides?)` folds a TT Action's preconditions' effective states into eligible / blocked / pending / na; surfaced as an inspector "Eligibility" readout (emerald / rose / amber, via `<InsetCard>`). Overlay-aware (speculation re-derives it). 10 tests.

---

## Infrastructure debt / refactor

From the Session 135 "30 code-improvement suggestions" audit. Items #1 / #2 / #4 / #5 / #6 / #7 already shipped (button class constants, Select primitive, chip palette, EdgeAssumptions deprecation, TextArea ref, TPNode split). **Plus the infra-debt batch (Session 135):** custom-equality narrowing for `MultiInspector` + `GroupInspector`, `DocumentInspector` inline-input migration, `RadioGroup` button-class migration, `reactFlowFixtures.ts` typed builders + biggest-test-cast-cleanup file migration. Remaining:

- ~~**File splits (Tier 2)**~~ ✅ Done Session 135 — all seven split: `entitiesSlice` (621→40 + 4 factories), `entityTypeMeta` (→ meta / icons / palettes), `selectionVerbs` (→ single-entity builder), `dialogsSlice` (→ toasts + confirm sibling slices), `ContextMenu` (→ list renderer + verb helpers), `PrintPreviewDialog` (→ mode thumbnails), `CreationWizardPanel` (→ `useDraggablePanel` hook), `TPEdge` (→ `TPEdgeBadges`). Each landed as its own commit; tsc + biome + per-file tests green throughout. TPEdge's path-geometry/store-read body stays inline (the documented "tightly-coupled" core); only the self-contained badge JSX extracted.
- ~~**`as unknown as X` test-cast cleanup**~~ ✅ Done Session 135 — `useGraphMutations.test.tsx` (15 casts) plus 5 more across `equality` / `TPNode` / `useGraphPositions` / `pwaInstall` / `dragSplice` migrated to `reactFlowFixtures.ts` builders or single-casts. The remaining casts are legitimate (corrupt-input equality tests, browser-native event mocks) and documented as keep.
- ~~**Inline `<input>` migrations**~~ ✅ Done Session 135 — added `size: 'sm' | 'md'` to `TextInput`; migrated PrintPreviewDialog header/footer + CustomEntityClassesSection text inputs. The `type="color"` input stays inline (TextInput doesn't support that type — legitimate exception).
- ~~**Icon-picker button-class migration**~~ ✅ Done Session 135 — moved the bespoke icon-button palette into `SELECTED_BUTTON_CLASS_ICON` / `UNSELECTED_BUTTON_CLASS_ICON` sister constants in `buttonClasses.ts` (lighter `text-indigo-700` reads better at Lucide glyph size).
- ~~**TPNode coverage beyond 48% statements**~~ ✅ Done Session 135 — added 7 tests for S&T 5-facet rows (full + partial fill + non-injection guard), hidden-descendant chip (count + zero-omit), and custom-class slug resolution (in-map + fallback). Zoom-up NodeToolbar branch documented as not jsdom-testable (NodeToolbar with `isVisible={false}` renders no children).

---

## Open polish + quality items

- ~~**UI review by expert agent**~~ ✅ *Fully actioned Session 135.* The code-level design pass [docs/DESIGN_AUDIT_SESSION_135.md](DESIGN_AUDIT_SESSION_135.md) produced 25 findings — **all 25 done**: batch 1 (1–3) Field label/fieldset semantics + `EYEBROW` token + inspector `<h2>` header; batch 2 (4, 5, 17, 11) `TOGGLE_BUTTON_BASE` + `<ButtonGroup>` + `<TabBar>` + colour-pair fixes; batch 3 (10, 16) `<InsetCard tone>` + frosted-glass opacity; incremental sweep (6, 8, 13, 14, 15, 18, 20–25); and #19 — `LargeDialog` now opens as a true modal via `showModal()` (native focus trap + page-behind inert-ness, feature-detected `el.open` fallback for jsdom; `useFocusTrap` dropped). Net new primitives: `ButtonGroup`, `TabBar`, `InsetCard`; tokens: `EYEBROW`, `TOGGLE_BUTTON_BASE`; plus `Button size:'xs'`, `Select size`, `Field as="group"`.
- **Manual a11y keyboard walkthrough** — *checklist ready; needs Dann's hands.* Automated portion done Session 121 (axe scans on Help / About / Settings dialogs + Esc-close pins). The fully-manual portion can't be scripted — a printable ~1-hour checklist lives at [docs/MANUAL_A11Y_WALKTHROUGH.md](MANUAL_A11Y_WALKTHROUGH.md): canvas Tab reachability, per-dialog focus order, Esc cascade priority, keyboard-only CRT authoring, palette discoverability, optional screen-reader spot-check. Two known candidates baked in from the design audit: unlabeled inspector fields (`<Field>` gap) and whether edge-connect has any non-mouse path. Run it, log results in the doc.
- **PDF/UA tagged-PDF accessibility** — *investigated Session 135; recommendation: defer.* See [docs/PDF_UA_INVESTIGATION_SESSION_135.md](PDF_UA_INVESTIGATION_SESSION_135.md). The Chromium `page.pdf()` + pdf-lib pipeline **cannot** emit `/StructTreeRoot` (Skia has no tagging backend; pdf-lib has no tagging API) — tagging requires swapping the HTML→PDF renderer, a 1–2 session migration that throws away the current pixel-accurate screenshot placement + book CSS. EPUB already covers accessible reading. If pursued: **Typst** (single binary, tagging maturing fastest), added as a separate `book:pdf-tagged` target — *not* the Pandoc-LaTeX route originally guessed (LaTeX tagging is still experimental + multi-GB install). We already emit `/Lang` + navigable outlines + full metadata.
- **Verify book on a real Kindle device** — *steps ready; needs Dann's hardware.* EPUB build pipeline shipped Session 135; the round-trip "email → Kindle imports → reads natively" can't be done by Claude. Send-to-Kindle steps + a device-verification checklist live at [docs/KINDLE_VERIFICATION.md](KINDLE_VERIFICATION.md). The `.epub` artifact (~707 KB) is committed at `docs/guide/Causal-Thinking-with-TP-Studio.epub`.

---

## Pattern library — new example: Dann's IT-function Goal Tree

**Status: ✅ SHIPPED (Session 138)** as `src/domain/patterns/goalTree-it-function.ts` (structure below kept for reference). Built a 6th Goal Tree pattern from Dann's own 2020 article *"Generic goals for an IT function"* and register it in the library. Because the article is **Dann's own published work**, the entity titles may be used **verbatim** — the "no copy-paste from Goldratt / Dettmer / Scheinkopf" originality rule that governs every other library pattern does **not** apply here. The source `.docx` lives only in Dann's Downloads and won't survive to a future session, so the full structure is captured below; the build needs nothing external.

**Source:** Dann Bleeker Pedersen, *"Generic goals for an IT function"* (2020). A Dettmer-style Goal Tree / Intermediate Objectives Map for a generic IT function (grounds itself in Dettmer's *Logical Thinking Process* / *Strategic Navigation* + Goldratt). The article's thesis: every IT function's goal decomposes into a "build new value" arm and an "operate efficiently" arm, bounded by a financial constraint — and that shape is where the classic Dev-vs-Ops conflict lives.

**Structure — 1 Goal · 2 CSFs · 6 NCs · 8 necessity edges:**

- **Goal:** "Ensure that technology is utilized to support the organization in reaching the overall goals, both now and in the future."
  - **Boundary constraint (from the article):** "Financial restrictions must be adhered to." The Goal Tree node kinds are only `goal` / `criticalSuccessFactor` / `necessaryCondition` — there is no boundary kind. Represent it as a **note entity attached to the Goal** (annotation; note-edges render dotted automatically), *not* as a CSF. Its consequences already surface as the two cost-minimizing NCs (A2 + B1), so leaving it as a note is faithful. Confirm `'note'` is a valid `buildEntity` kind in the pattern-builder context before relying on it; if not, drop the note and keep the constraint in the pattern `hint` only.
- **CSF A:** "Develop and implement IT assets that bring the organization towards its goal, both now and in the future."
  - **NC A1:** "Create as much value with IT assets as possible, both now and in the future."
  - **NC A2:** "Minimize the cost (and time) of developing and implementing IT assets, both now and in the future."
  - **NC A3:** "Minimize the value of IT-inventory (assets not in production)."
- **CSF B:** "Ensure an efficient operation of IT assets, both now and in the future."
  - **NC B1:** "Minimize the cost needed to operate the IT assets, both now and in the future."
  - **NC B2:** "Minimize the perceived downtime for users, both now and in the future." *(the article stresses* perceived *— a slow UI or a support queue costs productivity just like a true outage)*
  - **NC B3:** "Have the right level of IT security, both now and in the future." *(a Goldilocks condition — balance, not maximize)*

Edges (all `kind: 'necessity'`, child → parent): A→Goal, B→Goal, A1→A, A2→A, A3→A, B1→B, B2→B, B3→B.

**Build recipe** (mirror `src/domain/patterns/goalTree-sustainable-product-org.ts`):
- New file `src/domain/patterns/goalTree-it-function.ts` exporting `buildPatternGoalTreeITFunction(): TPDocument`.
- Use `buildEntity('goal' | 'criticalSuccessFactor' | 'necessaryCondition', title, t, n)` + `buildEdge(childId, parentId, { kind: 'necessity' })` from `../examples/shared`; `newDocumentId()` from `../ids`; `diagramType: 'goalTree'`, `schemaVersion: 8`, `nextAnnotationNumber` = entity count + 1.
- Register in `src/domain/patterns/index.ts` under the Goal Tree block: `id: 'goalTree-it-function'`, `label: 'Generic IT-function goals'`, `hint: "IT-function Goal Tree (Dann's 2020 article) — build-and-implement value vs efficient operation, under a financial-restriction boundary."`, `diagramType: 'goalTree'`, `build: buildPatternGoalTreeITFunction`.
- Document `title: 'Generic IT-function goals (Goal Tree)'`.

**Test impact:** `tests/domain/patterns.test.ts` asserts **≥5** patterns per type (`toBeGreaterThanOrEqual(5)`), so a 6th Goal Tree pattern is safe — nothing to relax. Generic per-pattern checks also require `schemaVersion === 8`, non-empty title, unique id, entities present, matching `diagramType`. Optionally add a targeted test pinning the 9-entity / 8-edge shape. Update CHANGELOG + USER_GUIDE pattern-library list per the docs-in-sync rule.

---

## Suggested priority order

If picking the next thing up:

**All ten original spec major gaps are closed or out of scope; the design audit + infra-debt file splits + the actionable medium gaps + every fixable Session-136 usage-feedback item are done.** What's left:

1. ~~**Render-engine layout pass**~~ ✅ *Done Sessions 136–137* — the spacing pass + `Re-layout diagram` command, then the obstacle-aware edge router (visibility-graph + A\*, Settings → Display → Edge routing) and AND/OR/XOR junctor rendering + drag-create. The "edges render behind nodes" finding is closed by the smart router (details in the Session-136 feedback section below).
2. ~~**Pattern library — IT-function Goal Tree example**~~ ✅ *Shipped Session 138* — added the 6th Goal Tree pattern `goalTree-it-function` ("Generic IT-function goals") from Dann's 2020 "Generic goals for an IT function" article. 1 Goal · 2 CSFs · 6 NCs · 8 necessity edges; titles verbatim (Dann's own work). `src/domain/patterns/goalTree-it-function.ts`; shape pinned in `tests/domain/patterns.test.ts`.
3. ~~**Edit-menu → left toolbar redesign**~~ ✅ *Addressed Session 138 (different shape)* — the design discussion concluded a left rail would duplicate the floating Selection toolbar (already the "most-used verbs" surface), so instead the Edit *surfaces* were tamed: palette `Edit` group sub-sections + a right-click **Convert to ▸** submenu.
4. **Multi-document tabs** — *Batches 2.1–2.3 + 4.1–4.2 + 5.1 + 5.2 + 5.4 + 5.2b + 5.3 shipped Session 138; tabs are visible, usable, persistent, and loading a document opens it in a new tab.* Full plan at [docs/MULTI_DOC_TABS_PLAN.md](docs/MULTI_DOC_TABS_PLAN.md) — 6 phases, all 7 design questions answered. Done: Phase 1 (invisible refactor), **2.1–2.3** (state · per-doc persistence + manifest · per-doc history), **4.1–4.2** (cross-doc services + full `currentDoc` seam), **5.1** (tab engine), **5.2** (visible `TabStrip`, merged), **5.4** (boot restores all tabs on reload), **5.2b** (tab palette commands New/Close/Next/Previous/Duplicate + drag-to-reorder), **5.3** (import / pattern / template / example / share-link / spawn-EC open in a new tab by default, via `openDocInTab`, + a Settings → Behavior toggle), **PWA keyboard shortcuts** (Cmd+T/W/1–9, `display-mode: standalone`-gated), and **Phase 6 polish** (quota mitigation tier-2 + tab-aware "close some tabs" toast, **Forget closed documents** palette command, walkthrough-drops-on-tab-transition). The multi-tab arc is **complete** — Session 138's tail closed Phase 3's leftover per-doc reset: the search match index **and** the speculation overlay now reset on every doc change, via the shared `activeDocEphemeralReset` helper (`docMetaSlice.ts`). The only un-built options are deliberately opt-in / on-request: speculation **carry**-across-switch (the default is drop — decision #5) and a "Save all / Export all tabs" command — neither has a concrete use case yet, so both sit in the won't-build-unless-asked bucket.
5. **Reactive-vs-proactive NBR mitigation** — the one remaining medium gap; policy-parked, re-open only if practitioners ask.
6. **Hardware/hands-dependent handoffs** — manual a11y keyboard walkthrough ([checklist](docs/MANUAL_A11Y_WALKTHROUGH.md)) + Kindle device verification ([steps](docs/KINDLE_VERIFICATION.md)). Both need Dann.

## Session 136 usage feedback — bigger items parked for their own session

From Dann's "how it feels in real use" pass (Session 136). Trivial copy/defaults landed inline; the items below need their own design + research time:

- ~~**Render-engine layout pass (top priority)**~~ ✅ *Done Sessions 136 + 137* — first pass landed spacing tightening + the `Re-layout diagram` palette command + the render-engine notes doc. Sessions 137's four-phase arc shipped obstacle-aware routing (Phases A→D): visibility-graph + A\* router (`src/domain/edgeRouting.ts`), per-layout cache, junctor-segment integration, **Settings → Display → Edge routing** radio (default `'smart'`). USER_GUIDE + CHANGELOG updated. The "edges hidden behind nodes" finding from Session 136 is closed by this.*
- ~~**AND connector rendering + drag-drop creation**~~ ✅ *Done Sessions 136 + 137* — junctor circle ships from Session 136; drag-an-edge-onto-junctor for AND landed Session 136 (`75a2dc3`) and the OR / XOR equivalents landed Session 137. `addCoCauseToEdge(edge, source, kind?)` generalises to all three junctor kinds with cross-kind exclusivity enforced. Edge-body drop (no junctor circle) stays AND-only — canonical "add a sufficient co-cause" gesture. See [docs/RENDER_ENGINE_NOTES.md](docs/RENDER_ENGINE_NOTES.md) §2.
- ~~**Pattern library expansion**~~ ✅ *Done Session 137* — the curated library now carries 5 patterns per supported diagram type (40 total across CRT / FRT / PRT / TT / EC / Goal Tree / S&T / NBR). All descriptions and entity titles are original (no copy-paste from Goldratt / Dettmer / Scheinkopf / Cox / Boyd). Files under `src/domain/patterns/<pattern-id>.ts`; registry in `src/domain/patterns/index.ts`. The ≥5-per-type invariant is pinned by `tests/domain/patterns.test.ts`.
- ~~**Edit-menu → left toolbar redesign**~~ ✅ *Addressed Session 138* — research found there's no single "Edit menu" (verbs live across the palette `Edit` group, the floating Selection toolbar, and the right-click menu). A left rail would duplicate the Selection toolbar, so the **Edit surfaces were tamed** instead: palette `Edit` sub-section headers (Clipboard & history / Build / Type / Edges & junctors / Groups / Delete & swap) + the right-click **Convert to ▸** submenu. The Selection toolbar stays the fixed most-used-verbs surface.
- ~~**PWA offline integrity**~~ ✅ *Done Session 136* — book PDF/EPUB added to the workbox precache (`additionalManifestEntries` in `vite.config.ts`); the dynamic `pptxgen.es-*.js` chunk gets a `runtimeCaching` rule (`StaleWhileRevalidate`) so the first online load seeds the cache and subsequent offline loads survive. Verified by inspecting the generated `sw.js` precache manifest in CI build.
- **Multi-document tabs** — *Batches 2.1–2.3 + 4.1–4.2 + 5.1 + 5.2 + 5.4 + 5.2b + 5.3 shipped Session 138; tabs visible, persistent, and loads open in new tabs.* See [docs/MULTI_DOC_TABS_PLAN.md](docs/MULTI_DOC_TABS_PLAN.md) for the 6-phase arc. The full data/persistence/history foundation, the `currentDoc` seam, the tab engine, the visible `TabStrip` (chips/switch/close/new), boot-restore (reload brings back all tabs), 5.2b (tab palette commands + drag-to-reorder), 5.3 (import / pattern / template / example / share-link / spawn-EC route through `openDocInTab` → a new tab by default + a Settings → Behavior opt-out), **PWA keyboard shortcuts** (Cmd+T/W/1–9, standalone-gated), AND **Phase 6 polish** (quota toast, Forget-closed-documents command, walkthrough-on-switch) are all in. Session 138's tail then closed Phase 3's per-doc reset (the search match index + speculation overlay reset on every doc change). The multi-tab arc is **complete**.
- ~~**HTML export with embedded preview image**~~ ✅ *Done Session 136 (batch 6)* — `exportToSelfContainedHTML` accepts an optional `previewPng` and embeds it as `<figure><img>` near the top of the exported file; the service-layer `exportHTMLViewer` captures the React Flow canvas via `capturePngDataUrl` and threads it through. Tests at `tests/domain/htmlExport.test.ts` cover both the present + absent branches.
- ~~**EC PDF workshop export bug**~~ ✅ *Done Session 136 (batch 11)* — was silently swallowing failures inside the export pipeline; now traps + logs via `services/logger` and shows a user-facing toast. The lazy-chunk loading is also covered by the PWA fix above so an offline export attempt now degrades gracefully instead of hanging.
- ~~**Flying Logic notes-as-connections regression**~~ ✅ *Done Session 135-136 (batches 4-5)* — root cause was `TPNode` omitting React Flow `<Handle>`s on note entities; React Flow needed a handle to anchor to so every imported edge whose endpoint was a Note silently failed to render. Fix: render the handles, lift the connect-to-note block, and paint note-touching edges dotted + thinner (`'2 3'` dasharray, baseWidth 1.25) so they read as annotation links rather than causal edges. Dann's "retail goal map.xlogic" reproduces cleanly after the fix.

### Session 136 bugs awaiting reproduction

These were reported in the Session 136 usage pass but aren't reproducible from code alone:

- ~~**Inspector closes when making a selection inside it**~~ ✅ *Done Session 136 (batch 8)* — root cause was `onSelectionChange` in `Canvas.tsx` calling `clearSelection()` on every empty-arrays event from React Flow. React Flow re-keys nodes during doc-edit re-renders and fires `onSelectionChange` with empty selNodes/selEdges before settling, which clobbered the store selection mid-edit. Fix: dropped the empty-mirror branch — pane clicks (`onPaneClick`) still clear selection deliberately. Follow-up batch raised TopBar `z-30` to stay above the now-always-visible Inspector (Playwright timeout fix).
- ~~**"Add evidence" button does nothing**~~ ✅ *Done Session 136 (batch 9)* — Dann confirmed Browse Lock wasn't on; the failure was `addEvidence()` silently returning `null` when `readEntity()` couldn't find the id (stale closure / mid-edit window). Fix: handler now surfaces the error to the user via a toast ("Couldn't add evidence — entity unavailable. Reselect the entity and try again.") so the no-op state is visible rather than mysterious. Pairs with batch 8 to keep the entity selected through doc edits, which eliminates the stale-id window in practice.
- ~~**Edges render behind entity nodes**~~ ✅ *Fixed Phases A+B+C of the obstacle-aware routing project* — the smart router computes a visibility-graph + A\* path around non-endpoint node bodies and emits a multi-cubic bezier through the resulting waypoints. Toggle in Settings → Display ("Smart" / "Direct"), default `'smart'`. Phase D (junctor segment + per-layout route cache) and Session-138 **4-side anchoring** (`src/domain/edgeSides.ts` — connectors pick the shortest side to exit/enter) both shipped on top.

## Canvas rendering & "clickability" improvements (Session 138 thread)

Dann's five-goal pass on how the canvas draws + how grabbable it is. **Shipped:**

5. ✅ **Connectors choose the shortest path in/out (4-side anchoring)** — *Session 138* — smart-mode edges now exit/enter on the best of all four node sides ("prefer flow direction", curves kept), folded into `'smart'` (no new toggle); junctor source-legs + side-by-side mutex included; radial excluded. New `src/domain/edgeSides.ts` + side-aware emitters in `edgeRouting.ts`. Also corrected the latent dagre-`BT` away-side anchoring. Details in CHANGELOG.

**Goals #1–4 (all addressed this session — #1 stays watch-listed for any further AND glitches):**

1. **Fix AND rendering bugs** — visual glitches on AND/junctor rendering. ✅ *One fixed Session 138* — the junctor circle floated off on its own after a re-layout / drag because `JunctorOverlay` only re-rendered on pan/zoom + group changes, never on node-position changes; it now tracks its target via a live `useStore` selector (`computeJunctors`). Re-open with specifics if other AND glitches surface.
2. ~~**Easier drag-and-drop**~~ ✅ *Session 138* — connection/junction creation by dragging is now forgiving: bigger hit zones (`connectionRadius` 20→120, ~20px handle catch, 22px junctor catch, 56px edge halo) + live drop-target feedback while dragging (target-node ring — rose if invalid; edge glow for "drop to AND"; junctor highlight for "drop to join"). Repositioning stays off (#4). Details in CHANGELOG.
3. ~~**Easier edge/connector selection**~~ ✅ *Session 138* — edges now answer on hover (+1px stroke, neutral-grey glow, pointer cursor) so the 56px hit zone is discoverable; the inline label is click-to-select (was: only the tiny assumption badge); and the selected edge gains a crisp solid-indigo **casing band** underlay + a stronger glow, distinct in *shape* from the (also-indigo) drop-target blur from #2. New `hoveredEdgeId` store flag (guarded no-op setter, same recipe as splice-target / connection-drag); state precedence is explicit (hover excludes selected/drop/mutex/mid-drag; band gated `selected && !isDropTarget`). Details in CHANGELOG.
4. ~~**"Balance" the map**~~ ✅ *Session 138* — auto-layout is now authoritative (stored positions ignored for auto diagrams; imports re-flow), and a post-dagre **centering pass** (`balanceFreeAxis`, `src/domain/layout.ts`) re-centers each effect over the mean of its causes, so connectors come out short + near-vertical. Edge anchoring unchanged (#5). Details in CHANGELOG.

Open goals remaining: **none** — all five canvas goals (#1–#5) shipped this session. (Re-open #1 if other AND glitches surface beyond the junctor-float fix.) The backlog is otherwise drained — beyond this, new work would come from fresh spec/product direction.

*(Was on the list: "Phase 1C node-chrome / canvas eligibility surfacing." Already done — `EligibilityBadge` ships on Action nodes via the `Show action-eligibility badge` Display setting, with full inspector readout retained. Code in `src/components/canvas/nodes/TPNodeBadges.tsx` + `useGraphNodeEmission.ts`; tests in `tests/components/canvas/eligibilityBadgeEmission.test.tsx`.)*

---

## Out of scope — won't build

Items explicitly dropped, in addition to the brief's own out-of-scope list:

- **#2 Multi-user collaboration (spec §4)** — out of scope for this version (Dann, Session 135). Real-time editing, role-based participation, workshop voting + timeboxing, stakeholder sign-off, decision log. Would flip TP Studio from local-first to cloud-backed. **Carve-out (Session 139):** *local-first* review comments shipped — single-user annotations anchored to entities/edges/the document, stored in the doc and travelling with every export (see CHANGELOG). Only the *real-time / multi-user* dimension of comments remains out of scope here. Not a permanent "never" — parked until a hosted product direction is on the table; revisit then.
- **#8 Enterprise integration (spec §8)** — dropped Session 135 (tied to #2). SSO/SAML/OIDC, M365 / Google Workspace / Slack / Teams / Confluence / SharePoint / Jira / Azure DevOps. TP Studio is a browser-local PWA.
- **Audit trail / GDPR / data retention** — dropped Session 135 (depended on #2/#8 server-side identity model). No backend, no audit trail; persistence is local-storage + user-managed export files.
- **Stakeholder sign-off workflow** — dropped Session 135 (depended on #2 multi-user model).
- **Pattern library sub-item C — portfolio-view across multiple docs** — dropped Session 135 (depended on FL-EX8 multi-document tabs, which is already won't-build).
- Cloud sync, accounts, auth (covered by #2 above) — **note:** the auth-free
  *local-file* alternative shipped **Session 153**: **Save to file / Save to
  file as… / Open from file** (File System Access API → a locally synced
  `OneDrive\…` folder), plus **one-click re-save** — a save/open links the file
  (`FileSystemFileHandle` persisted in IndexedDB, `services/storage/fileHandles.ts`)
  so "Save to file" re-writes it without re-picking, with a link-chip on the
  title. Purely additive (localStorage auto-save, tabs, `Cmd/Ctrl+S`, and
  Export/Import are unchanged) and Chromium-only; Firefox/Safari keep the
  download/upload path.
- Project management, calendars, resources, MS Project export
- Bayesian / evidence-based propagation
- Course-of-action (COA) analysis features
- Mobile-first design (responsive down to 480 px is the practical floor)
- Print stylesheets (delivered minimally via `src/styles/print.css`; full one-page print designs not in scope)
- i18n (English only)
- **H5 confidence-weighted what-if** — depended on `Entity.confidence` + `Edge.weight` (Bucket C), dropped Session 71. Moved to won't-build Session 84.
- **AI integration (spec §5)** — problem-to-tool router, UDE extraction, statement rewrites, CLR objection generation, assumption extraction, injection brainstorming, NBR detection, obstacle/milestone suggestions, TT action decomposition, executive summary, workshop facilitation prompts. Explicitly dropped Session 134. TP Studio stays deterministic and offline-first. Re-open only if a product direction genuinely needs it.
- **Entity grammar rewrite suggestions**, **Coaching/router mode**, **Pattern library sub-item B** (embeddings-based pattern recognition) — all depended on AI integration above.
- **FL-EX8 multi-document tabs** — explored Session 91, cancelled. Single-document by design.
- **FL-CO2 cross-document hyperlinks** — depended on FL-EX8.
- **FL-IN5 tabs per element type** — sectioned inspector groups properties cleanly; tabs add a click without exposing more information.
- **FL-AN4 styled text in titles** — titles stay plain by design.

---

## Known environment quirks

Specific to the Windows + corporate-AppLocker environment this was built on. Applies to anyone hitting the same constraints.

- **`pnpm dlx` is blocked** by Group Policy / AppLocker in the corporate environment. `pnpm install` from `package.json` works; one-off `pnpm dlx <pkg>` from the npm cache temp dir is denied.
- **PowerShell Constrained Language Mode** breaks `npm.ps1`. Invoke npm/pnpm from Bash, via `.cmd` shims, or directly through `node corepack/dist/pnpm.js …`.
- **`vite preview` blocked by AppLocker** on the local dev box — production-build smoke / perf-trace specs can't run locally; CI handles them via the manual `Perf trace` and `Update visual snapshots` workflows.
- **OneDrive sync + `node_modules`** is slow and occasionally lock-prone. Project lives at `C:\dev\tp-studio` for that reason.
- **`pnpm-workspace.yaml`** is autogenerated with anomalous content by pnpm 11 in some environments. If `pnpm add` silently fails to update `package.json`, check for and delete that file.
- **Lazy-loaded dependency chunks** (only pay their cost on demand): `html-to-image` (PNG / JPEG / SVG export), `dagre` + `@/domain/layout` (Session 81; `tests/build/dagreLazyLoadBoundary.test.ts` guards against accidental static imports), `jspdf` + `svg2pdf.js` + `html2canvas` peer (Session 80), `pptxgenjs` (Session 134), `PrintAppendix` (Session 105), `CommandPalette` (Session 88), `MarkdownPreview` + DOMPurify (Session 115).

---

## When picking this up next

1. **Pull the project state.** `cd C:\dev\tp-studio && git status` — should be clean. `pnpm install` (preinstall verifies Node `>=22.22.1` + pnpm `^10`). `pnpm dev` to start. `pnpm test` should report 1500+ tests passing.
2. **Open the durable docs** — [README.md](README.md) for architecture, [USER_GUIDE.md](USER_GUIDE.md) for the feature surface, [CHANGELOG.md](CHANGELOG.md) for the history, [SECURITY.md](SECURITY.md) for the threat model + Session 98 audit.
3. **Pick a candidate from above** — major gaps first if you want strategic moves, medium gaps for single-session wins, infrastructure debt for "cleanup between features", polish + quality for the things that pay back across every future iteration.
4. **Build in vertical slices** — one demo-able feature per commit.

Domain-first remains the right discipline: anything new that the data model needs lands in `src/domain/` first, with tests, before any UI work.
