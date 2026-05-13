# Store architecture

The Zustand root store (`useDocumentStore`) is a flat composition of four
sub-slices. This file documents which slice owns what state and what the
"correct home" rule is when adding a new field or action.

```
RootStore = DocumentSlice & UISlice & HistorySlice & RevisionsSlice
```

## Slice responsibilities

### `documentSlice/` — the document
**Owns:** the current `TPDocument` and every mutation that produces a new
document reference (entities, edges, groups, layout config, metadata,
schema migrations).

**Composed from:**
- `entitySlice` — entity CRUD + bulk operations
- `edgesSlice` — edge CRUD + AND-grouping + assumption attachment
- `groupsSlice` — group CRUD + hoist
- `docMetaSlice` — title, description, schemaVersion, system scope, method checklist
- `docMutate.ts` — shared infrastructure: `applyDocChange`, `entityPatch`, `edgePatch`, `scrubFromGroups`, `touch`

**Add to documentSlice when:** the mutation should be undoable, persisted to
localStorage, and reflected in the layout/validation fingerprint.

### `uiSlice/` — ephemeral view state
**Owns:** selection, hover, palette open/closed, dialogs (settings, help,
quick-capture, document inspector), toast queue, walkthrough cursor, theme,
animation speed, edge palette, browse lock, and every other
not-persisted-with-the-doc preference.

**Composed from:**
- `selectionSlice` — selection, hoist, editing state, context menu
- `dialogsSlice` — every modal's open/closed flag and target
- `preferencesSlice` — persisted prefs (theme, animationSpeed, causalityLabel, defaultLayoutDirection, etc.). Persisted separately from the doc, in `STORAGE_KEYS.prefs`.
- `searchSlice` — find-panel query state
- `walkthroughSlice` — read-through and CLR walkthrough cursors

**Add to uiSlice when:** the state is per-tab (not per-document) and doesn't
need to survive an undo.

### `historySlice/` — undo / redo
**Owns:** `past` and `future` stacks of `TPDocument` snapshots, with
coalesce-window grouping and a hard cap (`HISTORY_LIMIT`).

**Add to historySlice when:** you're changing how undo/redo coalesces or
how far back history reaches. Day-to-day mutations don't touch this slice
directly — `applyDocChange` in `documentSlice/docMutate.ts` does the
history push automatically.

### `revisionsSlice/` — named snapshots
**Owns:** the per-document list of user-named revisions, side-by-side
compare cursor, branch-from-revision action.

**Source of truth is `localStorage`** keyed by document id. The
in-memory `revisions` array is a cache that's reloaded on document swap
and after every mutation that touches the revision list.

**Add to revisionsSlice when:** you're adding a snapshot-style feature
(history panel, diff overlay, side-by-side compare).

## Composition rules

1. **No slice imports from another slice's internals.** Each slice file
   only imports from its own subdirectory and from `../types`. Cross-slice
   reads happen via the composed `RootStore` type, threaded through `get()`.

2. **`get()` reads, `set()` writes.** Inside a slice action, never reach
   into the in-memory store reference directly — use the Zustand
   `(get, set)` parameters the creator provides.

3. **All doc-mutating actions go through `applyDocChange`** (defined in
   `documentSlice/docMutate.ts`). This is what gives mutations their
   automatic persistence, history-push, and future-clear semantics.

4. **Defaults factories return data-only.** Each slice exports a
   `*Defaults()` function that returns its initial state. `resetStoreForTest`
   composes all four. Actions are bound by the slice creator at module
   init and are not replaceable at test time — tests that need to spy on
   an action should mock the call site, not the slice.

5. **Type exports flow up.** Slice-owned types (`Selection`,
   `Theme`, `DefaultLayoutDirection`, etc.) are exported from the slice's
   `types.ts` and re-exported by `src/store/index.ts` so consumers can
   import them via `@/store` without knowing which sub-slice they live in.

## Adding a new sub-slice

1. Create `src/store/<name>Slice/` with an `index.ts` exporting:
   - `createXSlice: StateCreator<RootStore, [], [], XSlice>`
   - `xDefaults(): Pick<XSlice, …>`
   - `type XSlice`
2. Compose in `src/store/index.ts` inside the `create<RootStore>(…)` call.
3. Add `xDefaults()` to `resetStoreForTest`.
4. Add a header section in this file describing what state and actions
   the slice owns.

## Test conventions

- Every test calls `resetStoreForTest()` in `beforeEach` to get a clean
  in-memory state. localStorage is cleared too.
- Action invocations go through `useDocumentStore.getState().actionName(…)`.
- The shared helpers in `tests/helpers/seedDoc.ts` (`seedEntity`,
  `seedConnectedPair`, `seedChain`, `seedAndGroupable`) wrap the common
  setup boilerplate. Prefer them over inline `addEntity` + `connect`
  sequences.
