/**
 * Session 95 — selectionVerbs registry tests.
 *
 * The registry is the single source of truth for "given this
 * selection shape, which verbs apply." Tests pin:
 *   1. branchFor() correctly derives the discriminated branch from
 *      store state + optional context-target.
 *   2. verbsForBranch() returns the expected verb id list per branch.
 *   3. Conditional verbs (Swap on 2 entities, Ungroup on grouped
 *      edges) appear only when their conditions hold.
 *   4. Every verb's paletteCommandId (when set) is a real palette
 *      command id — guards against typos that would route clicks to
 *      nowhere.
 */

import { COMMANDS } from '@/components/command-palette/commands';
import { branchFor, verbsForBranch } from '@/domain/selectionVerbs';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedAndGroupable, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

describe('branchFor', () => {
  it('returns none for empty selection + no context target', () => {
    const state = useDocumentStore.getState();
    expect(branchFor(state.selection)).toEqual({ kind: 'none' });
  });

  it('returns pane when context target is pane', () => {
    const state = useDocumentStore.getState();
    expect(branchFor(state.selection, { kind: 'pane' })).toEqual({ kind: 'pane' });
  });

  it('context target overrides selection (right-click intent)', () => {
    const a = seedEntity('A');
    useDocumentStore.getState().selectEntity(a.id);
    // Right-click on a DIFFERENT entity — branch follows the click.
    const b = seedEntity('B');
    const state = useDocumentStore.getState();
    expect(branchFor(state.selection, { kind: 'entity', id: b.id })).toEqual({
      kind: 'single-entity',
      id: b.id,
    });
  });

  it('emits single-entity for a one-entity selection', () => {
    const a = seedEntity('A');
    useDocumentStore.getState().selectEntity(a.id);
    const state = useDocumentStore.getState();
    expect(branchFor(state.selection)).toEqual({ kind: 'single-entity', id: a.id });
  });

  it('emits multi-entities for a 2+ entity selection', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    const state = useDocumentStore.getState();
    expect(branchFor(state.selection)).toEqual({
      kind: 'multi-entities',
      ids: [a.id, b.id],
    });
  });

  it('emits single-edge and multi-edges correctly', () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);
    let state = useDocumentStore.getState();
    expect(branchFor(state.selection)).toEqual({ kind: 'single-edge', id: edge.id });

    const { e1, e2 } = seedAndGroupable();
    useDocumentStore.getState().selectEdges([e1.id, e2.id]);
    state = useDocumentStore.getState();
    expect(branchFor(state.selection)).toEqual({
      kind: 'multi-edges',
      ids: [e1.id, e2.id],
    });
  });
});

describe('verbsForBranch', () => {
  it('returns no verbs for pane / none (toolbar hidden)', () => {
    const state = useDocumentStore.getState();
    expect(verbsForBranch({ kind: 'none' }, state)).toEqual([]);
    expect(verbsForBranch({ kind: 'pane' }, state)).toEqual([]);
  });

  it('single-entity branch surfaces add-successor + add-predecessor + delete', () => {
    const a = seedEntity('A');
    const state = useDocumentStore.getState();
    const verbs = verbsForBranch({ kind: 'single-entity', id: a.id }, state);
    const ids = verbs.map((v) => v.id);
    expect(ids).toContain('add-successor');
    expect(ids).toContain('add-predecessor');
    expect(ids).toContain('confirm-delete-selection');
  });

  // Session 96 — per-diagramType verb expansion.
  it('CRT context adds mark-as-ude + mark-as-rootcause when applicable', () => {
    // Default seed is a CRT doc. Add an effect entity (not yet a
    // UDE or root cause). Both type-marker verbs should surface.
    const a = seedEntity('A', 'effect');
    const state = useDocumentStore.getState();
    const ids = verbsForBranch({ kind: 'single-entity', id: a.id }, state).map((v) => v.id);
    expect(ids).toContain('mark-as-ude');
    expect(ids).toContain('mark-as-rootcause');
  });

  it('CRT context drops mark-as-ude when entity is already a UDE', () => {
    const a = seedEntity('A', 'ude');
    const state = useDocumentStore.getState();
    const ids = verbsForBranch({ kind: 'single-entity', id: a.id }, state).map((v) => v.id);
    expect(ids).not.toContain('mark-as-ude');
    // The root-cause one stays because the entity isn't a root cause.
    expect(ids).toContain('mark-as-rootcause');
  });

  it('Goal Tree context adds add-nc-child + promote-to-goal', () => {
    useDocumentStore.getState().newDocument('goalTree');
    const a = seedEntity('A', 'criticalSuccessFactor');
    const state = useDocumentStore.getState();
    const ids = verbsForBranch({ kind: 'single-entity', id: a.id }, state).map((v) => v.id);
    expect(ids).toContain('add-nc-child');
    expect(ids).toContain('promote-to-goal');
    // Goal Tree shouldn't surface CRT-specific verbs.
    expect(ids).not.toContain('mark-as-ude');
    expect(ids).not.toContain('mark-as-rootcause');
  });

  it('Goal Tree context drops promote-to-goal when entity is already a Goal', () => {
    useDocumentStore.getState().newDocument('goalTree');
    const a = seedEntity('A', 'goal');
    const state = useDocumentStore.getState();
    const ids = verbsForBranch({ kind: 'single-entity', id: a.id }, state).map((v) => v.id);
    expect(ids).not.toContain('promote-to-goal');
    expect(ids).toContain('add-nc-child');
  });

  it('single-edge branch now surfaces add-assumption-to-edge', () => {
    const { edge } = seedConnectedPair();
    const state = useDocumentStore.getState();
    const ids = verbsForBranch({ kind: 'single-edge', id: edge.id }, state).map((v) => v.id);
    expect(ids).toContain('add-assumption-to-edge');
  });

  it('single-edge branch surfaces reverse + splice + delete', () => {
    const { edge } = seedConnectedPair();
    const state = useDocumentStore.getState();
    const verbs = verbsForBranch({ kind: 'single-edge', id: edge.id }, state);
    const ids = verbs.map((v) => v.id);
    expect(ids).toContain('reverse-edge');
    expect(ids).toContain('splice-into-edge');
    expect(ids).toContain('confirm-delete-selection');
  });

  it('multi-entities branch shows Swap only when exactly 2 selected', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const state = useDocumentStore.getState();
    const two = verbsForBranch({ kind: 'multi-entities', ids: [a.id, b.id] }, state);
    expect(two.map((v) => v.id)).toContain('swap-entities');

    const three = verbsForBranch({ kind: 'multi-entities', ids: [a.id, b.id, c.id] }, state);
    expect(three.map((v) => v.id)).not.toContain('swap-entities');
  });

  it('multi-edges shows ungroup-X only when at least one edge has X group', () => {
    const { e1, e2 } = seedAndGroupable();
    useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    const grouped = useDocumentStore.getState();
    const verbs = verbsForBranch({ kind: 'multi-edges', ids: [e1.id, e2.id] }, grouped);
    const ids = verbs.map((v) => v.id);
    expect(ids).toContain('ungroup-and');
    expect(ids).not.toContain('ungroup-or');
    expect(ids).not.toContain('ungroup-xor');
  });
});

describe('paletteCommandId integrity', () => {
  it('every verb.paletteCommandId references a real palette command', () => {
    const commandIds = new Set(COMMANDS.map((c) => c.id));
    // Sample every branch exhaustively. Test states are minimal — we
    // care about command-id references, not condition coverage.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const { edge } = seedConnectedPair('C', 'D');
    const { e1, e2 } = seedAndGroupable();
    useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    useDocumentStore.getState().groupAsOr([e1.id, e2.id]);
    useDocumentStore.getState().groupAsXor([e1.id, e2.id]);
    const state = useDocumentStore.getState();

    const allBranches: Parameters<typeof verbsForBranch>[0][] = [
      { kind: 'single-entity', id: a.id },
      { kind: 'single-edge', id: edge.id },
      { kind: 'multi-entities', ids: [a.id, b.id] },
      { kind: 'multi-edges', ids: [e1.id, e2.id] },
    ];

    for (const branch of allBranches) {
      for (const verb of verbsForBranch(branch, state)) {
        if (verb.paletteCommandId) {
          expect(
            commandIds.has(verb.paletteCommandId),
            `verb "${verb.id}" references palette command "${verb.paletteCommandId}" which does not exist`
          ).toBe(true);
        }
      }
    }
  });
});
