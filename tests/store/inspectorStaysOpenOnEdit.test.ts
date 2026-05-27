import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 136 regression coverage for the "Inspector closes on any doc
 * edit" bug Dann reported. The actual fix landed in batch 8 (commit
 * `f0b38e6`): the spurious `clearSelection()` in `Canvas.tsx`'s
 * `onSelectionChange` empty-arrays branch fired during every React-Flow
 * re-key on a doc edit and clobbered the store selection mid-edit.
 *
 * Those tests pin the contract: **store-level edits to the currently-
 * selected entity / edge MUST NOT clear the selection.** The browser
 * `onSelectionChange` round-trip lives in `Canvas.tsx` and the tests
 * for it use the real React Flow runtime in `e2e/`; this file targets
 * the orthogonal store-level invariant — that no action on the store
 * itself mutates `selection` as a side effect, except for the two
 * explicit cases that should (deleteEntity / deleteEdge — the selected
 * id is then stale by construction).
 *
 * If a future change reintroduces a selection-clearing side effect on
 * a doc-mutating action, one of these will fail.
 */

beforeEach(resetStoreForTest);

const selectionOf = () => useDocumentStore.getState().selection;
const selectEntityViaStore = (id: string) => useDocumentStore.getState().selectEntity(id);

describe('selection persists across doc-mutating edits to the selected entity', () => {
  it('updateEntity (title) does NOT clear the selection', () => {
    const e = seedEntity('Original');
    selectEntityViaStore(e.id);
    expect(selectionOf()).toEqual({ kind: 'entities', ids: [e.id] });

    useDocumentStore.getState().updateEntity(e.id, { title: 'Edited' });

    expect(selectionOf()).toEqual({ kind: 'entities', ids: [e.id] });
  });

  it('updateEntity (type) does NOT clear the selection', () => {
    const e = seedEntity('A');
    selectEntityViaStore(e.id);

    useDocumentStore.getState().updateEntity(e.id, { type: 'rootCause' });

    expect(selectionOf()).toEqual({ kind: 'entities', ids: [e.id] });
  });

  it('updateEntity (description) does NOT clear the selection', () => {
    const e = seedEntity('A');
    selectEntityViaStore(e.id);

    useDocumentStore.getState().updateEntity(e.id, { description: 'Some markdown content' });

    expect(selectionOf()).toEqual({ kind: 'entities', ids: [e.id] });
  });

  it('updateEntity (state) does NOT clear the selection', () => {
    // Phase 1B state-picker writes through `updateEntity` per the
    // existing inspector pattern. Same invariant must hold.
    const e = seedEntity('A');
    selectEntityViaStore(e.id);

    useDocumentStore.getState().updateEntity(e.id, { state: 'true' });

    expect(selectionOf()).toEqual({ kind: 'entities', ids: [e.id] });
  });

  it('updateEntity (attestation) does NOT clear the selection', () => {
    const e = seedEntity('A');
    selectEntityViaStore(e.id);

    useDocumentStore.getState().updateEntity(e.id, { attestation: 'Source: Goldratt 1990' });

    expect(selectionOf()).toEqual({ kind: 'entities', ids: [e.id] });
  });

  it('updateEntity (ownership) does NOT clear the selection', () => {
    const e = seedEntity('A');
    selectEntityViaStore(e.id);

    useDocumentStore.getState().updateEntity(e.id, { owner: 'alice' });

    expect(selectionOf()).toEqual({ kind: 'entities', ids: [e.id] });
  });

  it('setEntityPosition does NOT clear the selection', () => {
    const e = seedEntity('A');
    selectEntityViaStore(e.id);

    useDocumentStore.getState().setEntityPosition(e.id, { x: 100, y: 200 });

    expect(selectionOf()).toEqual({ kind: 'entities', ids: [e.id] });
  });

  it('addEvidence to the selected entity does NOT clear the selection', () => {
    const e = seedEntity('A');
    selectEntityViaStore(e.id);

    useDocumentStore
      .getState()
      .addEvidence(e.id, { source: 'observed', description: 'Test source' });

    expect(selectionOf()).toEqual({ kind: 'entities', ids: [e.id] });
  });

  it('multiple back-to-back edits do not clear the selection', () => {
    // A user typing in the title fires onChange per keystroke. Each
    // call is an independent `updateEntity` with the coalesce key. The
    // store-level selection should never flicker through these.
    const e = seedEntity('');
    selectEntityViaStore(e.id);

    for (const t of ['C', 'Cu', 'Cus', 'Cust', 'Custo', 'Custom', 'Customer']) {
      useDocumentStore.getState().updateEntity(e.id, { title: t });
      expect(selectionOf()).toEqual({ kind: 'entities', ids: [e.id] });
    }
  });
});

describe('selection on a DIFFERENT entity persists across edits to the selected one', () => {
  // Edge case: user selects entity A, then a non-UI process (a
  // validator, an auto-resolve action, an undo) edits entity B. The
  // selection must remain on A.
  it('editing entity B keeps the selection on entity A', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    selectEntityViaStore(a.id);

    useDocumentStore.getState().updateEntity(b.id, { title: 'B edited' });

    expect(selectionOf()).toEqual({ kind: 'entities', ids: [a.id] });
  });
});

describe('two explicit selection-clearing cases are preserved', () => {
  // Negative coverage: the existing intentional clearSelection paths
  // (after deleteEntity / deleteEdge) must keep firing — the selected
  // id is stale by construction once the entity / edge is gone, so
  // leaving the selection set would point at a non-existent target
  // and break the Inspector's invariants. These tests pin that the
  // hardening above didn't accidentally tighten too far.

  it('deleteEntity on the selected entity DOES clear the selection (intentional)', () => {
    const e = seedEntity('A');
    selectEntityViaStore(e.id);
    expect(selectionOf()).toEqual({ kind: 'entities', ids: [e.id] });

    useDocumentStore.getState().deleteEntity(e.id);

    expect(selectionOf()).toEqual({ kind: 'none' });
  });

  it('deleteEdge on the selected edge DOES clear the selection (intentional)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('edge not created');
    useDocumentStore.getState().selectEdge(edge.id);
    expect(selectionOf()).toEqual({ kind: 'edges', ids: [edge.id] });

    useDocumentStore.getState().deleteEdge(edge.id);

    expect(selectionOf()).toEqual({ kind: 'none' });
  });
});
