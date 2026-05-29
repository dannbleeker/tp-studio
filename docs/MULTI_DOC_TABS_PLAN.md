# Multi-document tabs — implementation plan

Session 137 deep-planning artifact. Single source of truth for the 6-phase
arc that adds tabs to TP Studio. Re-opens FL-EX8 from won't-build per Dann's
Session 136 usage feedback. Local-first, no backend, all persistence in
localStorage.

The plan was produced by a Plan agent that audited the codebase against
`C:\dev\tp-studio` and grounded every claim in real file paths. The seven
locked decisions below were settled in the same session by Dann directly.

---

## Locked decisions (Dann, Session 137)

1. **Tab strip placement** — *above the canvas, full-width.* Chrome / VS
   Code style. Most familiar mental model. Costs ~32 px of vertical chrome
   between TopBar and the canvas.
2. **Undo scope** — *per-doc.* Cmd+Z on tab A only undoes work on tab A.
   Switching tabs swaps which history stack Cmd+Z operates on. Per-doc
   `history.past` / `history.future` lives on each `TPDocument`'s entry,
   not on a global slice field.
3. **Reload behavior** — *restore all open tabs, with lazy-parse of
   non-active bodies.* Active tab parses eagerly at boot; the other tabs'
   bodies stay as JSON strings in storage until first activation. Boot
   stays fast even with 6+ tabs.
4. **Duplicate-tab semantics** — *new doc id with a fresh copy of the
   content.* Each tab gets its own future — independent edits, revision
   history, share link. Title gets `(copy)` appended. TP Studio has no
   realtime sync; two tabs editing the same id would race on writes.
5. **Speculation overlay on tab switch** — *drop on switch in v1.* Tab
   switch clears the overlay; the new tab starts in normal mode. Simpler;
   per-doc overlay storage can be added later if a user actually asks.
6. **New-doc routing** — *open in a new tab by default, with a Settings
   toggle to restore the current "replace active tab" behavior.* Share-
   link receiver, Import dialog, Pattern library, Load example, Diagram
   Type Picker all route to a new tab. Power users who want the clean-
   slate-every-load flow can opt out.
7. **Compare-mode scope in v1** — *per-tab only.* Cross-tab compare
   (diff tab A vs. tab B) is a separate feature later if asked. Lowest
   scope creep.

---

## 1. Coupling map — every place that assumes "the one current doc"

The codebase has **212 reads of `state.doc` / `s.doc` / `get().doc`
across 74 files**. They fall into clear categories:

### 1a. The store itself (the canonical seat)

- `src/store/documentSlice/docMetaSlice.ts` — `DocMetaSlice.doc:
  TPDocument` field declared line 29; initialised line 137. `setDocument`
  (139–161) and `newDocument` (163–211) are the entry points for full-doc
  replacement. Both `persistDebounced(doc)` + `flushPersist()` synchronously,
  capture an outgoing-doc revision via `autoSnapshotOutgoing`, and call
  `get().reloadRevisionsForActiveDoc()` after the swap. Both clear
  `selection` and `editingEntityId`. *These two actions become "open a doc
  in the active tab" rather than "replace the doc."*
- `src/store/documentSlice/docMutate.ts:33–52` — `makeApplyDocChange`
  closes over `get().doc` (line 35), writes a new doc back via
  `set({ doc: next, … })` (line 39–50). Every mutator in
  entities/edges/groups/docMeta flows through this. *The active-tab-aware
  version reads / writes `state.docs[state.activeDocId]`.*
- `src/store/historySlice.ts:50–61, 63–74` — `undo` and `redo` read
  `get().doc` and stack the prior doc on `past` / `future`. The stacks
  are **global**, not per-doc. *Per-doc history is required per locked
  decision #2; phase 3 splits this.*
- `src/store/revisionsSlice.ts` — every action keys off `get().doc.id`
  (lines 155, 173, 212, 222, 245, 251). Storage is **already per-doc-id-
  keyed** under `STORAGE_KEYS.revisions` (`Record<docId, Revision[]>`),
  so revisions are the *least* coupled to the singleton.
- `src/store/uiSlice/selectionSlice.ts:170–175` — `hoistGroup` does a
  cross-slice `get().doc.groups[id]` read. Selection is implicitly
  scoped to whichever doc happens to be `state.doc`.
- `src/store/uiSlice/speculationSlice.ts:93` — `commitSpeculation` calls
  `get().setEntityStates(entries)` implicitly on the current doc.
  *Per locked decision #5, the overlay clears on tab switch in v1.*
- `src/store/index.ts:44` — boot-time `reloadRevisionsForActiveDoc()`
  populates the revisions panel from the boot doc.

### 1b. Persistence — single-doc-keyed storage

- `src/services/storage/storage.ts:14–37` — `STORAGE_KEYS` declares three
  single-doc slots (`doc`, `docLive`, `docBackup`) and one map-keyed slot
  (`revisions`). The three doc slots are global single-payload strings.
- `src/services/storage/persistDebounced.ts:91–98` — `PersistScheduler.schedule(doc)`
  writes the live-draft synchronously on every mutation and schedules a
  debounced canonical write. Singleton `scheduler` at line 186. *One
  scheduler instance does not generalise to N docs cleanly; phase 2's
  rewrite makes the scheduler doc-id-aware OR keeps it active-doc-only and
  relies on the tabs-manifest persistence for the rest.*
- `src/domain/persistence.ts:127–146` — `saveToLocalStorage` does the
  backup-slot-first dance: copy prior committed payload to `docBackup`,
  write new payload into `doc`. `lastCommittedRaw` (line 127) is a
  module-scope cache of the prior write. *Per-key backup → per-doc-id
  backup in phase 2.*
- `src/domain/persistence.ts:186–229` — `loadFromLocalStorageWithStatus`
  reads the three single-doc slots and tie-breaks by `updatedAt`. *Boot-
  time logic learns about the tabs manifest in phase 2.*

### 1c. Slice actions — implicit "current doc" arg

Every mutating action in `documentSlice/` takes implicit `state.doc`. The
pattern dominates. Representative sites:

- `src/store/documentSlice/entities/entityCrud.ts:46` — `addEntity` reads
  `get().doc.nextAnnotationNumber`.
- `entityCrud.ts:121` — `toggleEntityCollapsed` reads `get().doc.entities[id]`.
- `entityCrud.ts:75–104` — `addImportedEntity` is the ONE existing cross-
  doc operation; even it only writes to `get().doc` (the active doc) —
  the source doc is parsed in-memory and discarded.
- `documentSlice/edgesSlice.ts`, `documentSlice/groupsSlice.ts`, etc. —
  same implicit-active pattern.

**Pragmatic call**: keep all existing actions as "active-doc actions."
For new cross-doc operations (Phase 4+), introduce sibling actions that
take an explicit `docId`. The `makeApplyDocChange` helper is the one
piece that needs an explicit-doc variant to support cross-doc mutators
through history + persist + revisions.

### 1d. Module-scope services — reach into the store

- `src/services/confirmations.ts:17, 18, 32, 52, 64, 74` — five `get().doc`
  reads. `confirmAndDeleteEntity` reads `state.doc.entities[id]`,
  `connectionCount(state.doc, id)`, dispatches `state.deleteEntity(id)`.
- `src/services/browseLock.ts:7` — `isBrowseLocked` reads `state.browseLocked`
  (one global flag for all tabs — confirmed keep-global per the agent's
  recommendation; UI not doc concern).
- `src/services/quickCapture.ts:21–22` — reads `state.doc.diagramType`,
  dispatches store actions. Implicit current-doc.
- `src/services/clipboard.ts:11, 24–30` — module-scope `buffer` carries an
  entity payload; cross-tab paste decided as **allowed** (records get
  fresh ids on paste anyway; tagging buffer with `sourceDocId` is a
  nice-to-have for future UX).
- `src/services/entityRefs.ts:13, 30` — `resolveEntityRef` and
  `navigateToEntity` read `state.doc.entities`. Implicit current-doc.
- `src/services/systemScopeNudge.ts:39, 63–70` — installs
  `useDocumentStore.subscribe` comparing `state.doc.id` against `lastId`
  to fire the nudge on doc swaps. *This already does the right thing if
  the active-doc-id changes on tab switch.*
- `src/services/testHook.ts:184–188, 218, 230, 232, 237` — Playwright
  hook reads `state.doc.entities`. `newDocument(diagramType)` (line 236)
  becomes "new tab" — e2e specs may need touch-up.
- `src/services/canvasRef.ts:97, 106` — `collectSelectionEntityIds` reads
  `state.doc.edges` to expand edge-selection into endpoint ids.

### 1e. Components — bind to `s.doc` via `useDocumentStore`

Cluster patterns from the 212-occurrence count:

- **Canvas + overlays.** `Canvas.tsx:97` reads `s.doc`. `TPEdge.tsx` has
  7 reads; `ContextMenu.tsx` has 5. `JunctorOverlay`,
  `AssumptionAnchorOverlay`, `ECInjectionChip`, `ECReadingInstructions`,
  `Breadcrumb`, `CanvasNav`, `EmptyHint`, `FirstEntityTip`, `StatusStrip`,
  `CreationWizardPanel`. All consume the active doc.
- **Inspector.** `Inspector.tsx:24`, `EntityInspector.tsx:45–46`,
  `EdgeInspector.tsx`, `GroupInspector.tsx` (5), `MultiInspector.tsx` (5),
  `AssumptionWell.tsx` (3), `AttachedEdgesList.tsx` (4),
  `InjectionWorkbench.tsx` (2), `WarningsList.tsx` (1).
- **TopBar / TitleBadge / DocumentMeta.** `TitleBadge.tsx:23–31` reads
  `doc.title` and `doc.diagramType`; `DocumentMeta.tsx:35` reads
  `doc.title` to drive `<title>`. *Tab strip lives between or replaces
  TitleBadge.*
- **Dialogs.** `ExportPickerDialog.tsx` has 24 reads of `s.doc` (one per
  exporter); `PrintPreviewDialog.tsx`, `DiagramTypePickerDialog.tsx`,
  `PatternLibraryDialog.tsx`, `TemplatePickerDialog.tsx`,
  `RevisionPanel.tsx`, `SideBySideDialog.tsx`, `SearchPanel.tsx`.
- **Palette command files.** `commands/document.ts` (3), `commands/edges.ts`
  (4), `commands/groups.ts` (5), `commands/navigate.ts` (6),
  `commands/analysis.ts` (5), `commands/tools.ts` (17), `commands/view.ts`
  (1).

### 1f. Tests

- `tests/helpers/seedDoc.ts:1–82` — `seedEntity`, `seedConnectedPair`,
  `seedChain`, `seedAndGroupable` all dispatch through
  `useDocumentStore.getState()`. Single-doc by construction. Continue to
  work in multi-doc world (they target the active doc).
- ~1,940 tests `beforeEach(resetStoreForTest)` and operate against the
  active doc. If `state.doc` is kept as a derived alias (canonical state
  model below), every existing test continues to read `state.doc.entities`
  without modification. **Load-bearing claim: the test suite stays green
  through every phase.**

---

## 2. Cross-doc state model

### Recommendation — `state.docs` + derived `state.doc` alias

Canonical shape:

- `state.docs: Record<DocumentId, TPDocument>` — every open doc.
- `state.activeDocId: DocumentId` — the active tab; always present in
  `state.docs`.
- `state.tabOrder: DocumentId[]` — left-to-right tab order, persisted.
- `state.doc: TPDocument` — kept as a *derived alias* that always equals
  `state.docs[state.activeDocId]`. Maintained by every action that
  mutates the active doc; same reference as the docs entry, not a copy.

**Why the derived alias matters**: it makes 212 existing read sites work
unchanged. Every selector that does `useDocumentStore((s) => s.doc.title)`
keeps working — it just resolves to the active tab's title. The cost is
one extra line in actions that mutate `docs[activeDocId]`: also update
`state.doc`. That's a mechanical edit inside `applyDocChange`, `setDocument`,
`newDocument`, `undo`, `redo`. Outside the store, callers never know
`state.doc` is derived.

The alternative — drop `state.doc` entirely, force every read site to
migrate to a `currentDoc(state)` selector — sounds cleaner but is a
200-site mechanical churn that has to land in one phase to keep the suite
green. Carrying `state.doc` as a synced alias lets us phase the refactor.

### Active-doc switch semantics

When `activeDocId` changes (user switches tabs):

- **Selection clears.** Always — selection ids are doc-scoped.
- **`editingEntityId` clears.**
- **`hoistedGroupId` clears.**
- **`spliceTargetEdgeId`, `joinModeEdgeId`, `pendingEdgeSourceId` clear.**
  Transient gesture state, all doc-scoped.
- **History (`past` / `future`) — per-doc** (locked decision #2). Each
  `TPDocument`'s entry carries its own `history`. Switching restores it.
- **Revisions panel reloads.** `reloadRevisionsForActiveDoc` already
  exists; the tab switcher calls it.
- **Speculation overlay — drops** (locked decision #5).
- **Search state** — keeps the query, resets `matchIndex` (matches are
  doc-specific). Panel stays open if it was open.
- **Compare-mode (`compareRevisionId`) clears** — locked decision #7.
- **`appMode`, theme, browseLocked, palette state, preferences** —
  global, unchanged by tab switch.
- **Walkthrough cursor — clears.** Bound to a specific doc's sequence.

---

## 3. Persistence shape

### Today

`STORAGE_KEYS` in `src/services/storage/storage.ts:14–37`:

- `tp-studio:active-document:v1` — committed, debounced.
- `tp-studio:active-document-live:v1` — live draft, sync write per
  keystroke.
- `tp-studio:active-document-backup:v1` — written *before* every
  committed write (crash-safety).
- `tp-studio:theme` — global.
- `tp-studio:prefs:v1` — global.
- `tp-studio:revisions:v1` — `Record<docId, Revision[]>`, capped at 50/doc.

Sizes: typical doc 10–80 KB; revisions ~5 KB each, 50 revisions × ~5 KB =
~250 KB per doc. localStorage cap is 5–10 MB.

### Proposed

Five categories:

1. **Tab manifest** — `tp-studio:tabs:v1` = `{ activeDocId, tabOrder }`.
   Written synchronously on tab open / close / reorder / switch (rare
   events, no debounce). Tiny payload.
2. **Per-doc body slots** — one each of committed / live / backup per
   open doc, keyed by id: `tp-studio:doc:${id}:committed:v2`,
   `tp-studio:doc:${id}:live:v2`, `tp-studio:doc:${id}:backup:v2`.
   *Why per-doc slots, not one big blob*: under quota pressure, the
   current `saveToLocalStorage` only has to write the active doc
   (10–80 KB). A single-blob shape would force serialising every open
   doc on every mutation — 6 tabs × 50 KB = 300 KB JSON.stringify per
   debounced flush. Per-doc slots keep the per-mutation write
   proportional to the active doc only.
3. **Revisions** — stays at `tp-studio:revisions:v1` as
   `Record<docId, Revision[]>`. Already supports many doc ids.
4. **Theme + prefs** — unchanged.
5. **Schema-version pointer** — `tp-studio:schema:v1` = `{ version: 9 }`
   so a future tab-shape change has a migration hook.

### Quota story

Worst case: 6 tabs × 80 KB body × 3 slots (committed + live + backup) =
~1.4 MB for bodies. Plus 6 × 250 KB revisions = ~1.5 MB. Total ~3 MB.
Fits in 5 MB cap but tight.

Mitigations:
- Live-draft + backup slots get deleted on demand (`persistDebounced.ts:122`
  already removes `docLive` after successful canonical write; extend to
  delete backup slots for closed tabs).
- Closing a tab drops its three per-doc body slots. Revisions stay (the
  closed doc is still archived). Per-doc revision cleanup is a separate
  "Forget this doc" command in Settings (phase 6).
- Quota handler in `src/store/index.ts:66–88` already trims revisions on
  quota errors. Extend to also drop inactive-tab backup slots as a
  second-tier mitigation before the toast fires.

### Migration path

Existing single-doc users on `tp-studio:active-document:v1`:

1. On boot, if `tp-studio:tabs:v1` exists, use it.
2. Otherwise read `tp-studio:active-document:v1`. If it parses, mint a
   tab manifest with one entry pointing at that doc, copy the doc into
   the new per-doc slot keys, write the manifest. Leave the legacy slot
   in place for one release as a fallback (don't delete until multi-doc
   is stable).
3. `tp-studio:revisions:v1` — already keyed by docId; no change.

If a user downgrades to a build that doesn't know about `tabs:v1`, the
legacy slot is still there. They lose multi-doc, not data.

---

## 4. Under-the-hood improvements worth doing regardless

These pay back even if tabs never ship. They form **Batch 1** (section 6).

### 4a. `DocumentId` brand — already exists

Confirmed: `src/domain/types/ids.ts:21` declares
`DocumentId = Brand<string, 'DocumentId'>`. `src/domain/ids.ts:22`
exports `newDocumentId`. `TPDocument.id` already uses the branded type.

Work needed: tighten *boundaries* where doc ids leak as plain `string`.
`addImportedEntity({ sourceDocId: string })` → `DocumentId`.
`ImportedFromRef.docId` — verify it's `DocumentId`.

### 4b. `currentDoc(state)` selector — the centrepiece

Introduce `src/store/selectors.ts` exporting `currentDoc(state: RootStore)`.
Today returns `state.doc`. Post-flip returns `state.docs[state.activeDocId]`.

New code uses the selector; existing code converts opportunistically.
Phase 1 (Batch 1) converts store-internal sites — the slice actions,
`applyDocChange`, history/revisions. Phase 4 converts components.
Phase 2's data-model flip only needs to swap the selector body.

### 4c. Slice actions — keep implicit; add explicit variants only for new operations

Existing actions stay implicit-active-doc. For new cross-doc operations
(phase 4+), introduce sibling actions that take `docId` explicitly. The
`makeApplyDocChange` helper is the one place that needs an
explicit-doc variant for cross-doc mutators through history+persist+revisions.

### 4d. Per-doc storage key generators

Introduce `src/services/storage/keys.ts` exporting:

- `docCommittedKey(id: DocumentId)`.
- `docLiveKey(id: DocumentId)`.
- `docBackupKey(id: DocumentId)`.
- `tabsManifestKey: string` constant.

**Critical for Batch 1: not wired up.** `persistDebounced.ts` and
`persistence.ts` still write to `STORAGE_KEYS.doc` / `docLive` /
`docBackup` exactly as before. The generators are dormant infrastructure
that phase 2 picks up.

### 4e. Storage error handling — no Batch-1 change

The Session-129 quota mitigation in `src/store/index.ts:66–88` already
trims revisions on quota failures. Extends naturally to per-doc bodies
in phase 4. No pre-work needed.

### 4f. Test fixture surface

`tests/helpers/seedDoc.ts` mints single docs against `state.doc`. The
existing helpers continue to work in multi-doc (active doc). New:

- `seedTab(opts?)` — opens a new tab and returns its `DocumentId`. Today
  wraps `newDocument`; post-flip becomes a tab open.

---

## 5. Phased rollout

Six phases. Each independently shippable; CI green at the end of every
phase.

### Phase 1 — Invisible refactor (Batch 1)

**Goal**: introduce the `currentDoc()` selector + per-doc storage key
generators + `DocumentId` brand tightening + `seedTab` test helper. Zero
behaviour change.

**Deliverables**:
- `src/store/selectors.ts` exporting `currentDoc(state)`.
- `src/services/storage/keys.ts` exporting key generators.
- `addImportedEntity` signature: `sourceDocId: DocumentId`.
- `ImportedFromRef.docId: DocumentId`.
- `tests/helpers/seedDoc.ts` — `seedTab` stub.
- Store-internal call sites in `docMutate.ts`, slice files,
  `historySlice.ts`, `revisionsSlice.ts`, `selectionSlice.ts` migrate
  to `currentDoc(get())`.

**User-visible state**: identical to today.
**Risk**: very low. Mechanical.
**Time**: 1 session (4–6 hours).

### Phase 2 — Data model flip (still single-tab visually)

**Goal**: introduce `state.docs`, `state.activeDocId`, `state.tabOrder`.
`state.doc` becomes a derived alias. Still single-tab in the UI — exactly
one entry in `tabOrder`.

**Deliverables**:
- New `documentsSlice` (plural) with `openTab`, `closeTab`, `switchTab`,
  `reorderTabs` actions. Not user-callable yet.
- `docMetaSlice.setDocument` and `newDocument` rewritten to operate on
  the active tab in the new shape.
- Per-doc body slots via key helpers. Migration: on boot, copy from
  legacy single-doc keys into the new per-id keys; write the tabs
  manifest with one entry. Keep reading legacy keys as a fallback.
- Per-doc history (`past` / `future`) moves from global slice fields
  into `state.historyByDoc: Record<DocId, { past, future }>`.
- `revisions` panel binding switches to active-doc-derived.

**User-visible state**: identical to today.
**Risk**: high. Data-model flip; 1,940-test suite must stay green.
**Time**: 2–3 sessions (12–18 hours).

### Phase 3 — Per-doc dynamic state

**Goal**: anything global-singleton-but-logically-per-doc moves into
per-doc state. History, speculation, walkthrough cursor, search match
index.

**Deliverables**:
- `historyByDoc` (carried over from phase 2 deliverable if not done
  there).
- `searchMatchIndex` resets per-tab; query stays global.
- Speculation overlay drop-on-switch (locked decision #5) — straight-
  forward.

**User-visible state**: identical.
**Risk**: medium. Per-doc history is invasive but well-scoped.
**Time**: 1–2 sessions (8–10 hours).

### Phase 4 — Cross-doc-aware services + components

**Batch 4.1 ✅ SHIPPED (Session 138):** the three doc-scoped services —
`clipboard.ts`, `systemScopeNudge.ts`, `canvasRef.ts` — now read via the
`currentDoc()` seam, and the nudge watcher keys on `activeDocId` (so it
re-fires on a Phase 5 tab switch). Behaviour-preserving in single-tab;
existing service tests pass untouched. The clipboard `sourceDocId` tag was
deferred to Phase 5, where cross-tab paste actually consumes it (YAGNI).
**Batch 4.2 ✅ SHIPPED (Session 138):** migrated all remaining store-derived
`state.doc` / `s.doc` reads — **179 across 61 files** — to `currentDoc(s)`.
Fanned out across 5 parallel sub-agents by directory, verified centrally
(tsc + full suite 1990 + completeness grep). No-op refactor today
(`currentDoc(s) === s.doc`), so zero test edits. `state.doc` is now read in
exactly one place outside the store (inside `currentDoc`), so Phase 5 can
make `doc` multi-tab-derived from one line. **Phase 4 complete.**

**Goal**: every place that reads `state.doc.id` or holds doc-scoped
state in a module variable gains "which doc?" awareness. Still single-tab
visually.

**Deliverables**:
- `services/clipboard.ts` — tag buffer with `sourceDocId` (allowed
  cross-tab paste; no UI block).
- `services/systemScopeNudge.ts` — confirm subscription fires on
  `activeDocId` changes.
- `services/canvasRef.ts` — re-set on tab switch (canvas re-mount path).
- Components migrate `s.doc` reads to `currentDoc(s)` opportunistically.
- `ExportPickerDialog.tsx` and the rest of the dialog tree's 24 reads
  switch to `currentDoc(s)` if not already.

**User-visible state**: identical.
**Risk**: low–medium. Migration of consumer code.
**Time**: 1–2 sessions (6–10 hours).

### Phase 5 — Tab strip UI + tab actions

**Goal**: ship the user-visible tabs. Locked decision #1 places the
strip above the canvas, full-width.

**Deliverables**:
- `src/components/toolbar/TabStrip.tsx`. Lives between `TitleBadge` and
  `TopBar` in `App.tsx`. One chip per open tab, active highlighted,
  per-tab close X, `+` add button at the end. Drag-to-reorder.
- Replace single-doc affordances at every `setDocument` call site:
  Diagram Type Picker, Import dialog, Pattern Library, Load Example,
  Template picker, Share-link receiver — all open in new tab. Settings
  toggle (locked decision #6) restores "replace active tab" for users
  who prefer it.
- Keyboard: Cmd+T new tab; Cmd+W close tab; Cmd+1..9 jump to tab N.
- Palette commands: "New tab…", "Close tab", "Next tab", "Previous tab",
  "Duplicate tab" (locked decision #4: new doc id with `(copy)` title).
- Persist `tabsManifestKey` on every change. Boot reads + restores
  (locked decision #3: lazy-parse non-active bodies).

**User-visible state**: multi-tab live.
**Risk**: medium. UI is large but the data model is settled.
**Time**: 2–3 sessions (12–18 hours).

### Phase 6 — Polish, edge cases, docs

**Goal**: close the gaps that only surface with multi-tab live.

**Deliverables**:
- Quota toast: "close some tabs to free space."
- "Forget closed doc" command in Settings → Documents.
- Walkthrough cursor behaviour on tab switch (drop or pause-restore —
  decide based on user feedback after a few sessions of real use).
- Speculation overlay carry-across-switch — opt-in if asked.
- Cmd+S semantics — explicit "Save all tabs" / "Export all tabs"
  commands if needed.
- CHANGELOG, README, USER_GUIDE updates.
- New Playwright e2e: tab create / switch / close / persist across
  reload.

**Risk**: low. Bug-hunting + copy.
**Time**: 1 session (4–6 hours).

---

## 6. Batch 1 — what lands now

**Scope**: Phase 1 from section 5, explicitly scoped to "no behaviour
change."

**Bar**: every piece pays back even if tabs never ship; the single-doc
contract stays bit-for-bit identical.

### 6a. `currentDoc()` selector + store-internal migration

- New `src/store/selectors.ts` exporting `currentDoc(state)`.
- Migrate store-internal call sites:
  - `docMutate.ts:35` — `makeApplyDocChange` reads `currentDoc(get())`.
  - `docMetaSlice.ts` — every `get().doc` read.
  - `entityCrud.ts`, `assumptions.ts`, `evidence.ts`, `attributes.ts`,
    `edgesSlice.ts`, `groupsSlice.ts` — same.
  - `selectionSlice.ts:170–175` — `hoistGroup`.
  - `historySlice.ts:50–73` — `undo` / `redo`.
  - `revisionsSlice.ts` lines 155, 173, 212, 222, 245, 251.

- Components, services, palette commands, dialogs — **untouched**.
  Migration is explicitly store-internal so the consumer tree's read
  pattern stays familiar. Those move opportunistically in phase 4.

### 6b. Per-doc storage-key generators

- New `src/services/storage/keys.ts` exporting `docCommittedKey`,
  `docLiveKey`, `docBackupKey`, `tabsManifestKey`.
- Not wired up. `STORAGE_KEYS` stays bit-for-bit unchanged.

### 6c. `DocumentId` brand tightening at boundaries

- `addImportedEntity({ sourceDocId: DocumentId, sourceEntity })` —
  was `sourceDocId: string`.
- `ImportedFromRef.docId: DocumentId` — verify and tighten.
- Call sites in `ImportEntityPickerDialog.tsx` adjust mechanically.

### 6d. `seedTab` test helper

- `tests/helpers/seedDoc.ts` adds `seedTab(opts?)` that wraps
  `newDocument`. New tests can target the eventual multi-doc API today.

### Safety story

- Mechanical refactor; selector returns the existing field; no
  behaviour change.
- The 1,940-test suite stays green by construction.
- Storage layout is identical bit-for-bit.

---

## 7. Open questions — answered

All seven were answered in Session 137. See Locked decisions at the top
of this document.

---

## 8. Time budget

| Phase | Goal | Sessions | Hours |
|-------|------|----------|-------|
| 1 (Batch 1) | Selector + key helpers + brand + test stub | 1 | 4–6 |
| 2 | Data-model flip + persistence rewrite | 2–3 | 12–18 |
| 3 | Per-doc dynamic state | 1–2 | 8–10 |
| 4 | Cross-doc services + components migrate | 1–2 | 6–10 |
| 5 | Tab strip UI + tab actions + share-link routing | 2–3 | 12–18 |
| 6 | Polish, edge cases, e2e | 1 | 4–6 |
| **Total** | | **8–12 sessions** | **46–68 hours** |

The wider end of each range assumes the test suite catches a regression
that requires rolling back and re-doing a slice change. Plan for the
wide end.

---

## Critical files for implementation

- `src/store/documentSlice/docMutate.ts`
- `src/store/documentSlice/docMetaSlice.ts`
- `src/services/storage/persistDebounced.ts`
- `src/domain/persistence.ts`
- `src/store/historySlice.ts`
- `src/store/revisionsSlice.ts`
- `src/services/storage/storage.ts`

---

## Phase 2 — detailed execution plan (Session 138 prep)

Written after a full grounding pass over the real code (`store/index.ts`,
`docMetaSlice.ts`, `docMutate.ts`, `historySlice.ts`,
`persistDebounced.ts`, `persistence.ts`, `storage.ts`,
`revisionsSlice.ts`, `documentSlice/index.ts`). Supersedes the section-5
Phase 2 summary with a concrete, batch-by-batch breakdown.

### The keystone fact: exactly 6 `state.doc` write sites

Every mutation of the active document funnels through one of these:

1. `docMutate.ts` — `makeApplyDocChange` → `set({ doc: next, past, future })`.
   Covers ALL entity / edge / group / meta content edits.
2. `docMetaSlice.ts` — `setDocument` → `set({ doc, selection, editingEntityId, past, future })`.
3. `docMetaSlice.ts` — `newDocument` → same shape as setDocument.
4. `docMetaSlice.ts` — `markSystemScopeNudgeShown` → `set({ doc: next })`.
5. `historySlice.ts` — `undo` → `set({ doc: last.doc, past, future, editingEntityId })`.
6. `historySlice.ts` — `redo` → `set({ doc: next.doc, future, past, editingEntityId })`.

Because the write surface is this small, the data-model flip is a uniform
rewrite of 6 call sites behind one helper — not a sprawling change.

### Canonicality framing (refines section 2)

`state.doc` stays the working copy of the active tab and remains the
canonical write target. `state.docs[state.activeDocId]` is kept in
lockstep on every write. The invariant that holds after every mutation:

    state.docs[state.activeDocId] === state.doc      (same reference)
    state.tabOrder.includes(state.activeDocId)

In Phase 2 the app is still single-tab, so additionally
`tabOrder.length === 1`, `tabOrder[0] === doc.id`, and
`docs === { [doc.id]: doc }`. Multi-tab (Phase 5) relaxes only the
`length === 1` part; the core invariant is permanent.

Consequence: `currentDoc(state)` KEEPS returning `state.doc` through
Phase 2. Reads stay byte-for-byte unchanged, so the 212 read sites and
the whole test suite are untouched by the flip. (`currentDoc` would flip
to `state.docs[state.activeDocId]` only if `doc` is ever dropped, which
tabs do not require.)

### The uniform helper

Add `activeDocState(nextDoc)` returning:

    { doc: nextDoc,
      docs: { [nextDoc.id]: nextDoc },     // single-tab: replace map
      activeDocId: nextDoc.id,
      tabOrder: [nextDoc.id] }

Every `set({ doc: X, ...rest })` becomes `set({ ...activeDocState(X), ...rest })`.
Correct for all 6 sites including the subtle ones:

- Content edits (sites 1, 4): `nextDoc.id` equals current `activeDocId`;
  map/order rebuild to the same shape, only the doc reference changes.
- Document swaps (sites 2, 3): `nextDoc.id` is NEW; map/order rebuild to
  the new single entry, dropping the old. Preserves today's
  REPLACE-current-doc behavior exactly. (Phase 5 changes
  setDocument/newDocument to APPEND a tab per locked decision #6; Phase 2
  keeps replace.)
- Undo/redo across a doc-swap boundary (sites 5, 6): `last.doc` /
  `next.doc` may carry a DIFFERENT id (undoing a setDocument restores the
  prior doc with its old id). The uniform helper handles it: `activeDocId`
  follows the restored doc's id. No special-casing.

### Batch decomposition

Three independently-shippable, green-CI sub-batches. Each stays invisible
(single-tab) until Phase 5 flips the UI on.

#### Batch 2.1 — Multi-doc state shape (LOW risk, ~2-3 hours) — ✅ SHIPPED (Session 138)

Pure-additive state + the uniform-helper rewrite of the 6 sites. No
persistence change, no history change, no UI. Landed: `src/store/activeDoc.ts`
(the `activeDocState` helper), `docs`/`activeDocId`/`tabOrder` on
`DocMetaSlice`, the 6 write sites rerouted, invariant tests in
`tests/store/multiDocState.test.ts`. Full suite stayed green with zero
edits to existing tests. **Merged to main (PR #16, rebase) Session 138.**

Files:
- `docMetaSlice.ts` — extend `DocMetaSlice` type with
  `docs: Record<DocumentId, TPDocument>`, `activeDocId: DocumentId`,
  `tabOrder: DocumentId[]`. Initialize from `initialDoc`. Route the
  setDocument / newDocument / markSystemScopeNudgeShown `set` calls
  through `activeDocState`. Update `docMetaDefaults()` to build the
  map/order around the single fresh `createDocument('crt')`.
- `docMutate.ts` — `makeApplyDocChange` `set` through `activeDocState`;
  export the helper.
- `historySlice.ts` — undo/redo `set` calls through `activeDocState`.
- `documentSlice/index.ts` — `documentDefaults()` returns the new fields
  (delegates to `docMetaDefaults()`).
- `store/index.ts` — `resetStoreForTest` needs no change (already spreads
  `documentDefaults()`).

Tests (`tests/store/multiDocState.test.ts`, new): invariant after
addEntity / updateEntity / deleteEntity / connect / group / setDocument /
newDocument / undo / redo, including undo across a setDocument boundary.

`currentDoc` stays `state.doc`. Expect the full suite green with ZERO
edits to existing tests. **This is the safe batch to execute under
auto-mode.**

#### Batch 2.2 — Per-doc persistence + boot + migration (HIGH risk) — ✅ SHIPPED (Session 138)

**As built:** landed on `feat/multi-doc-tabs-2-2-persistence` off the merged
2.1 baseline. Diverged from the plan below in three deliberate, safer ways:
(1) **dual-write** — every committed save *also* writes the legacy single-doc
slots for the whole of Phase 2 (not just "keep one release as fallback"), so a
rollback / older cached PWA shell still boots from the same browser; Phase 5
drops the legacy write. (2) The per-doc backup reads its prior body straight
from storage rather than via an in-memory `lastCommittedRaw` Map — the
debounced path makes the extra `getItem` negligible and it removes a
stale-cache bug class. (3) The committed/live/backup precedence is a single
shared `pickBestDoc` resolver used by both the legacy and per-doc loaders. The
`store/index.ts` quota-handler extension + true lazy-parse of non-active bodies
are deferred to Phase 5 (no-ops under single-tab). New `persistence.ts` exports:
`persistActiveDoc`, `saveDocToLocalStorage`, `loadAllTabsWithStatus`,
`persistTabsManifest`, `readTabsManifest`; tests in
`tests/domain/multiDocPersistence.test.ts`. Full suite green (1982).

The genuine risk concentration. Wire up `keys.ts`, rewrite the scheduler
+ save/load for per-doc slots, add the tabs manifest, migrate from
single-doc storage. Still single-tab.

Files:
- `persistDebounced.ts` — `PersistScheduler` becomes active-doc-aware:
  `schedule(doc)` writes `docLiveKey(doc.id)`; `writeNow()` calls a new
  `saveDocToLocalStorage(doc)` + removes `docLiveKey(doc.id)`.
- `persistence.ts` — new `saveDocToLocalStorage(doc)` writing
  `docCommittedKey(doc.id)` + `docBackupKey(doc.id)` rotation, with a
  per-doc `lastCommittedRaw` Map (not a single module var). New
  `loadAllTabsWithStatus()` reading manifest → per-doc slots →
  `{ docs, activeDocId, tabOrder, recovery }`, lazy-parsing non-active
  bodies (locked decision #3).
- New `persistTabsManifest({ activeDocId, tabOrder })`.
- Boot migration (in `docMetaSlice.ts` module init): manifest present →
  `loadAllTabsWithStatus()`; else read legacy `STORAGE_KEYS.doc` →
  migrate into per-doc slots + write manifest + keep legacy slot one
  release as fallback.
- `store/index.ts` quota handler — extend Session-129 trim to also drop
  inactive-tab backup slots (no-op guard in single-tab; live in Phase 5).

Tests: round-trip, migration from legacy slot, per-doc backup rotation,
per-doc live-draft recovery, manifest-missing fallback. Land on its own
PR with the persistence tests front-and-centre + a manual reload smoke
test before merge.

#### Batch 2.3 — Per-doc history (LOW risk as built) — ✅ SHIPPED (Session 138)

**As built:** chose the additive Design X (mirrors 2.1's `docs` mirror +
2.2's dual-write) over the plan's literal "move `past`/`future` into
`historyByDoc[activeDocId]`" (Design Y, which would have touched every
undo/redo read + test). The ACTIVE tab's stacks stay canonical in the
top-level `past`/`future`; only INACTIVE tabs park in
`historyByDoc: Record<DocumentId, DocHistory>` (default `{}`). Shipped the
pure `applyTabSwitchHistory(historyByDoc, leavingId, liveStacks, enteringId)`
helper in `historySlice.ts` — the exact operation Phase 5's `switchTab`
calls (park leaving → promote entering → drop the now-live parked copy). No
caller yet, so single-tab undo/redo is byte-for-byte unchanged and the map
stays empty. Tests: `tests/store/perDocHistory.test.ts`. Stacked on the
2.2 branch.

Only matters when switching tabs (Phase 5). Until the tab strip ships
there is one tab, so global `past`/`future` ARE the active doc's history
and behave identically. Recommendation: defer 2.3 to ride with Phase 3
or Phase 5. When done: `state.historyByDoc: Record<DocId, {past, future}>`;
`switchTab` stashes the leaving tab's stacks and restores the entering
tab's.

### Sequencing + gates

1. Batch 2.1 — first, own PR. Low risk; green with no existing-test edits.
2. Batch 2.2 — ✅ shipped Session 138 (own PR off the merged 2.1 baseline;
   dual-write design; persistence tests + boot-reload smoke test).
3. Batch 2.3 — ✅ shipped Session 138 (additive `historyByDoc` +
   `applyTabSwitchHistory`; stacked on the 2.2 branch).

After 2.1 + 2.2 merge, the store + storage are fully multi-doc-capable
while the app stays single-tab. Phase 3 + Phase 4 then proceed; Phase 5
flips the tab strip on.

---

## Phase 5 — detailed execution plan (Session 138 prep)

**Where we are:** Phases 1–4 are merged to `main`. In place already:
`docs` / `activeDocId` / `tabOrder` state + the `activeDocState` single-tab
shaper (2.1); per-doc localStorage slots + tab manifest + dual-write
boot/migration (`saveDocToLocalStorage` / `persistTabsManifest` /
`loadAllTabsWithStatus`, 2.2); per-doc history infra (`historyByDoc` +
the pure `applyTabSwitchHistory`, 2.3); and the `currentDoc()` read seam
across all 61 consumer files (4.1 + 4.2). **`state.doc` is read in exactly
one place outside the store — inside `currentDoc`.** So Phase 5 is: flip
the data model from single-tab to N-tab, add the tab actions, build the
strip UI, route doc-loads to new tabs, and restore N tabs on boot.

### The central change: `activeDocState` (collapse) → in-place active update

Today every doc-write site calls `activeDocState(next)`, which COLLAPSES
the store to a single tab (`docs = { [next.id]: next }`, `tabOrder =
[next.id]`). That is exactly what must stop: a content edit on tab A must
leave tabs B/C intact. Split the one shaper into two:

- **`replaceActiveDoc(state, nextDoc)`** — keep `docs` (other tabs),
  `activeDocId`, `tabOrder`; set `doc = nextDoc` and
  `docs[activeDocId] = nextDoc`. Used by the 4 *edit-the-active-doc* sites:
  `makeApplyDocChange`, `markSystemScopeNudgeShown`, `undo`, `redo`.
  Invariant it relies on: `nextDoc.id === activeDocId` (holds — content
  edits keep the id; undo/redo are per-tab so never cross tabs; paste
  spreads `...currentDoc` so keeps the id).
- The multi-tab **tab actions** below own `tabOrder` / `activeDocId`
  changes. `activeDocState` (single-entry) is retired except possibly as
  a helper inside `openTab`.

This is the invariant flip: **`tests/store/multiDocState.test.ts` (the 2.1
single-tab invariant — `tabOrder === [doc.id]` after every mutation) must
be REWRITTEN as a multi-tab invariant** (`docs[activeDocId] === doc`,
`tabOrder` stable across edits, edits to A don't touch B). Expect that
file to change substantially — it is the canary, not a regression.

### Batch 5.1 — Tab engine (HIGH risk, store only, no UI) — ✅ SHIPPED (Session 138)

**As built:** added `setActiveDoc` (the rekey-capable in-place active-tab
setter) and flipped the 6 doc-write sites off `activeDocState`; added
`openTab` / `switchTab` / `closeTab` / `reorderTabs` / `duplicateTab` to
`docMetaSlice` (no new slice needed — they're `DocMetaSlice` methods).
`switchTab` uses `applyTabSwitchHistory` (2.3) + drops speculation
(decision #5); `closeTab` never leaves zero tabs + `removeDocFromStorage`s
the closed doc; manifest rewritten by the actions (not the scheduler). The
single-tab 2.1 invariant tests passed untouched (the flip is a no-op until
a 2nd tab exists), so they stay as the regression guard;
`tests/store/tabEngine.test.ts` (13) is the multi-tab proof (tab
isolation, per-tab history, close-neighbour, duplicate independence,
manifest). Deferred the active-tab legacy dual-write decision to a later
batch (still dual-writing). **Watch-item:** one flaky full-suite run (2
transient failures) that did not reproduce across 4 subsequent full runs +
3 isolated tabEngine runs (13/13 each) — looks pre-existing/timing, not in
the deterministic tab tests.

The riskiest change in the whole arc. Pure store + persistence + history;
no React. Files: a new `documentsSlice` (or extend `docMetaSlice`),
`docMutate.ts`, `historySlice` wiring, `persistDebounced.ts` /
`persistence.ts`, boot in `docMetaSlice`.

Actions:
- **`openTab(doc)`** — flush the current tab's pending write; stash the
  current tab's live `past`/`future` into `historyByDoc`; append `doc.id`
  to `tabOrder`; `docs[doc.id] = doc`; set it active with empty history;
  clear `selection` / `editingEntityId` / speculation overlay (decision
  #5); `saveDocToLocalStorage(doc)` + `persistTabsManifest`;
  `reloadRevisionsForActiveDoc`.
- **`switchTab(toId)`** — flush current; `applyTabSwitchHistory(historyByDoc,
  activeDocId, {past,future}, toId)` → swap the live stacks; set
  `doc = docs[toId]` / `activeDocId = toId`; lazy-parse `toId`'s body if
  still raw (see 5.4); clear selection/editing/speculation; persist
  manifest; reload revisions; let the canvas re-mount (below).
- **`closeTab(id)`** — remove from `tabOrder` + `docs` + `historyByDoc`;
  if it was active, `switchTab` to the right-hand neighbour (else
  left); if it was the LAST tab, `openTab(createDocument('crt'))` so there
  is never zero tabs; drop `id`'s per-doc storage slots + manifest entry.
  (A "recently closed / reopen" stack is out of scope; revisit in Phase 6
  if asked.)
- **`reorderTabs(order)`** — set `tabOrder = order`; persist manifest.
- **`duplicateTab(id)`** — mint a fresh `DocumentId`, deep-copy the
  content, append ` (copy)` to the title (decision #4), `openTab` it.

Persistence shifts (decision: keep it safe):
- The tab manifest write MOVES out of `persistActiveDoc` (which only sees
  the active doc) INTO the tab actions (which know `tabOrder`).
  `persistActiveDoc` keeps writing the active doc's per-doc committed slot.
- **Keep the active-tab legacy dual-write through Phase 5** (one cheap
  setItem) so a downgrade still recovers the active tab; the original plan
  said "Phase 5 drops the legacy write" but a downgrade can't represent N
  tabs anyway, and keeping the active-tab mirror costs nothing. Revisit in
  Phase 6.

Canvas re-mount: key `<Canvas />` (or the inner `<ReactFlow>`) by
`activeDocId` so a `switchTab` remounts it → `canvasRef` re-sets via
`onInit`, React Flow re-fits, no stale per-tab viewport/selection leaks.

Tests (headless, the real proof Phase 5 works): open 2 tabs → tabOrder /
docs / active correct; **edit tab A → tab B's doc is byte-identical**
(the multi-tab invariant); switch A↔B → doc + history + selection swap,
speculation cleared; close active → neighbour active; close last → fresh
blank; duplicate → new id + `(copy)` + independent edits; reorder; N-tab
persistence round-trip (`save 2 tabs → loadAllTabsWithStatus → both back`,
manifest = tabOrder). Rewrite `multiDocState.test.ts` to the multi-tab
invariant.

### Batch 5.2 — TabStrip UI + keyboard + palette — ◧ CORE SHIPPED (Session 138)

**As built (5.2 core):** `src/components/toolbar/TabStrip.tsx` — full-width
chip bar `absolute top-0` over the canvas; chips (click → `switchTab`),
per-chip X (`closeTab`, hidden on the sole tab), trailing `+` (open a fresh
CRT). `TitleBadge` + `TopBar` nudged `top-4` → `top-12` to clear it.
`role="tablist"`/`tab` + `aria-selected`; `useDocumentStoreWith` +
array-by-keys equality for re-render discipline. Tests:
`tests/components/TabStrip.test.tsx` (5). **Deferred to 5.2b:** Cmd+T/W/1–9
keyboard (browser-shadowed outside installed-PWA mode) + the tab palette
commands + drag-to-reorder (e2e-only). **Visual layout is a first pass —
needs a real-browser look** (floating `top-0` bar vs the absolute
`TitleBadge`/`TopBar` overlays; this PR is gated on visual review, not
auto-merged).



- **`src/components/toolbar/TabStrip.tsx`** — rendered in `App.tsx`
  **between `<TopBar />` (line ~259) and the `<Canvas />` wrapper (~273)**,
  gated `!isPresentation` (locked decision #1: above the canvas,
  full-width, ~32 px chrome). One chip per `tabOrder` entry (title via
  `docs[id].title`, active highlighted), per-tab close `X` (→ `closeTab`),
  trailing `+` (→ new blank tab), drag-to-reorder (→ `reorderTabs`).
  Accessible: `role="tablist"` / `role="tab"` + `aria-selected`, arrow-key
  move between chips, the close X is a real focusable button.
- **Keyboard** (`useGlobalShortcuts.ts`, same `cmdOrCtrl && e.key`
  pattern as Cmd+K/S/F): Cmd+T new tab, Cmd+W close active, Cmd+1..9 jump
  to tab N. **⚠️ Caveat:** in a normal browser tab Cmd+T / Cmd+W are
  reserved by the browser and cannot be reliably `preventDefault`'d — they
  only reach the app in installed-PWA (`display: standalone`) mode. So the
  `+` / `X` buttons + palette commands are the always-available path;
  treat the shortcuts as a PWA bonus and don't rely on them in tests.
- **Palette** — a new `tabCommands: Command[]` (own file, registered in
  `commands/index.ts`'s `COMMANDS`): "New tab", "Close tab", "Next tab",
  "Previous tab", "Duplicate tab".

Tests: TabStrip renders N chips with the active one flagged; click chip →
`switchTab`; X → `closeTab`; `+` → open; palette commands present + wired.
Drag-reorder is e2e-only (note it; don't block on a jsdom test).

### Batch 5.3 — Route doc-loads to new tabs + Settings toggle — own PR

- New pref **`openDocsInNewTab: boolean` (default `true`, decision #6)** +
  a Settings → Documents toggle ("Open imported / loaded documents in a
  new tab").
- New store action **`openDocInTab(doc)`** = `pref ? openTab(doc) :
  setDocument(doc)`.
- Re-route the **doc-LOAD** call sites to `openDocInTab`: `App.tsx`
  share-link receiver (226); `ImportPickerDialog` (61/73/86);
  `PatternLibraryDialog` (69); `TemplatePickerDialog` (44);
  `DiagramTypePickerDialog` load-example (113); spawn-EC (`ContextMenu`
  230 + `analysis.ts` 61); and `newDocument` internally.
- **KEEP `setDocument` for**: clipboard **paste** (`clipboard.ts:102` — a
  same-id edit of the active doc, NOT a load → must never spawn a tab) and
  as the toggle-off "replace active tab" path of `openDocInTab`.
- **"Undo" restore toasts** (`DiagramTypePicker:124`, `PatternLibrary:74`,
  `Template:48` — currently `setDocument(previousDoc)`): in new-tab mode
  the natural undo is **close the just-opened tab**, not restore the old
  doc. Rework these toast actions to `closeTab(newTabId)` when in new-tab
  mode (or drop the undo affordance there, since closing the tab is
  obvious). In replace mode they keep `setDocument(previousDoc)`.

Tests: pref on → load opens a new tab (tabOrder grows, original intact);
pref off → replaces active; paste always edits the active tab.

### Batch 5.4 — Boot multi-tab restore (+ optional lazy-parse) — own PR

- `docMetaSlice` boot builds **multi-tab** state from
  `loadAllTabsWithStatus()`'s `docs` / `tabOrder` / `activeDocId` (instead
  of `activeDocState(initialDoc)`). The fallback-to-blank + legacy
  migration paths already exist.
- **Lazy-parse (decision #3) is a PERF optimization, not correctness.**
  `loadAllTabsWithStatus` currently eager-parses every listed tab.
  Recommendation: **ship eager-parse-all in 5.4** (simple + correct; fine
  for the typical 2–6 tabs) and add true lazy-parse (active eager, others
  kept as raw JSON strings parsed on first `switchTab`) ONLY if boot perf
  measurably suffers with many tabs. True lazy-parse needs a "raw vs
  parsed" representation in `docs` — defer that complexity until measured.

Tests: boot a 2-tab manifest → both restored, correct active; a
missing/corrupt non-active body → that tab dropped (already handled);
legacy single-doc migration still boots to one tab.

### Sequencing + gates

1. **5.1 — tab engine** (own PR, HIGH risk). Rewrites the 2.1 invariant
   test. The full suite is the safety net; expect only `multiDocState`
   edits among existing tests.
2. **5.2 — TabStrip UI + keyboard + palette** (own PR). Manual smoke:
   tabs visible, clickable, `+`/X work.
3. **5.3 — load routing + Settings toggle** (own PR).
4. **5.4 — boot multi-tab restore** (own PR). Manual smoke: open 2 tabs,
   reload, both come back with the right active tab.

Then **Phase 6** polish (quota "close some tabs" toast; "forget closed
doc"; walkthrough-cursor-on-switch; optional speculation carry-across;
"save/export all tabs"). Phase 3's deferred bits — per-tab `searchMatchIndex`
reset + speculation drop-on-switch — fold into 5.1/5.2 (the switch path).

### Risk register

- **5.1 is the highest-risk change in the arc** — it flips the core
  single-tab invariant. Mitigation: store-only (no UI) so it's fully
  headless-testable; land it alone; the 1990-test suite + the rewritten
  multi-tab invariant test are the gate.
- **Cmd+T / Cmd+W browser-shadowing** — only reliable in installed-PWA
  mode; buttons + palette are the real path.
- **Canvas re-mount on switch** — key by `activeDocId`; verify no stale
  React Flow viewport/selection/edge-routing-cache leaks across tabs.
- **Speculation overlay** (decision #5) — `switchTab` must clear the
  speculation slice, else an overlay from tab A bleeds onto tab B.
- **Paste vs load** — the one `setDocument` caller that must NOT become a
  tab-open is `clipboard.ts`. Getting this wrong silently spawns a tab on
  every paste.
