import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { edgeCommands } from '@/components/command-palette/commands/edges';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedAndGroupable, seedConnectedPair, seedEntity } from '../../../helpers/seedDoc';
import { findCommand, runCommand } from './helpers';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('edgeCommands — reverse-edge', () => {
  it('reverses the source/target on a single selected edge', async () => {
    const { a, b, edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);
    await runCommand(findCommand(edgeCommands, 'reverse-edge'));
    const after = s().doc.edges[edge.id];
    expect(after?.sourceId).toBe(b.id);
    expect(after?.targetId).toBe(a.id);
  });

  it('toasts info when no edge is selected', async () => {
    await runCommand(findCommand(edgeCommands, 'reverse-edge'));
    expect(s().toasts.some((t) => /select a single edge/i.test(t.message))).toBe(true);
  });
});

describe('edgeCommands — splice-into-edge', () => {
  it('inserts a new entity into the selected edge', async () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);
    const beforeCount = Object.keys(s().doc.entities).length;
    await runCommand(findCommand(edgeCommands, 'splice-into-edge'));
    expect(Object.keys(s().doc.entities).length).toBe(beforeCount + 1);
  });

  it('toasts info when no edge is selected', async () => {
    await runCommand(findCommand(edgeCommands, 'splice-into-edge'));
    expect(s().toasts.some((t) => /select a single edge/i.test(t.message))).toBe(true);
  });
});

describe('edgeCommands — start-edge-join-and', () => {
  it('enters join-mode when a single edge is selected', async () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);
    await runCommand(findCommand(edgeCommands, 'start-edge-join-and'));
    expect(s().joinModeEdgeId).toBe(edge.id);
  });

  it('toasts info when no edge is selected', async () => {
    await runCommand(findCommand(edgeCommands, 'start-edge-join-and'));
    expect(s().joinModeEdgeId).toBeNull();
    expect(s().toasts.some((t) => /select a single edge/i.test(t.message))).toBe(true);
  });
});

describe('edgeCommands — AND/OR/XOR groupings', () => {
  // These commands call `getSelectedEdges()` which reads from the live
  // React Flow store — in jsdom (no canvas mounted) it returns []. The
  // result.ok path therefore short-circuits to a toast.

  it('group-and surfaces a toast when no edges are selected', async () => {
    seedConnectedPair();
    await runCommand(findCommand(edgeCommands, 'group-and'));
    // groupAsAnd([]) returns { ok: false, reason: ... } in the empty case
    // — surfaced as an info toast.
    expect(s().toasts.length).toBeGreaterThan(0);
  });

  it('ungroup-and toasts info when no edges are selected', async () => {
    await runCommand(findCommand(edgeCommands, 'ungroup-and'));
    expect(s().toasts.some((t) => /select one or more AND/i.test(t.message))).toBe(true);
  });

  it('group-or surfaces a toast when no edges are selected', async () => {
    seedConnectedPair();
    await runCommand(findCommand(edgeCommands, 'group-or'));
    expect(s().toasts.length).toBeGreaterThan(0);
  });

  it('ungroup-or toasts info when no edges are selected', async () => {
    await runCommand(findCommand(edgeCommands, 'ungroup-or'));
    expect(s().toasts.some((t) => /select one or more OR/i.test(t.message))).toBe(true);
  });

  it('group-xor surfaces a toast when no edges are selected', async () => {
    seedConnectedPair();
    await runCommand(findCommand(edgeCommands, 'group-xor'));
    expect(s().toasts.length).toBeGreaterThan(0);
  });

  it('ungroup-xor toasts info when no edges are selected', async () => {
    await runCommand(findCommand(edgeCommands, 'ungroup-xor'));
    expect(s().toasts.some((t) => /select one or more XOR/i.test(t.message))).toBe(true);
  });
});

describe('edgeCommands — registry shape', () => {
  it('registers all expected ids exactly once', () => {
    const expected = [
      'reverse-edge',
      'group-and',
      'start-edge-join-and',
      'ungroup-and',
      'group-or',
      'ungroup-or',
      'group-xor',
      'ungroup-xor',
      'splice-into-edge',
    ];
    for (const id of expected) {
      expect(
        edgeCommands.filter((c) => c.id === id),
        `missing or duplicate: ${id}`
      ).toHaveLength(1);
    }
  });

  // Touch the registry helpers so the `seedEntity` / `seedAndGroupable`
  // imports don't go unused — both are useful in this file's future
  // expansion when we test the full AND-grouping path with a mounted
  // canvas (Playwright follow-up).
  it('seed helpers are usable for future expansion', () => {
    const e = seedEntity('test');
    expect(e.title).toBe('test');
    const { e1, e2 } = seedAndGroupable();
    expect(e1.sourceId).toBeDefined();
    expect(e2.targetId).toBeDefined();
  });
});
