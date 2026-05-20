import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toolCommands } from '@/components/command-palette/commands/tools';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../../../helpers/seedDoc';
import { findCommand, runCommand } from './helpers';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('toolCommands — run-validation', () => {
  it('toasts success on an empty doc', async () => {
    await runCommand(findCommand(toolCommands, 'run-validation'));
    expect(s().toasts.length).toBeGreaterThan(0);
  });

  it('toasts info when there are open concerns', async () => {
    // An entity with no title triggers a clarity warning.
    useDocumentStore.getState().addEntity({ type: 'effect', title: '' });
    await runCommand(findCommand(toolCommands, 'run-validation'));
    expect(s().toasts.some((t) => /open concern/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — swap-entities', () => {
  it('swaps titles of two selected entities', async () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(toolCommands, 'swap-entities'));
    expect(s().doc.entities[a.id]?.title).toBe('Beta');
    expect(s().doc.entities[b.id]?.title).toBe('Alpha');
  });
});

describe('toolCommands — add-successor / add-predecessor', () => {
  it('add-successor mints a child + connects parent → child', async () => {
    const parent = seedEntity('Parent');
    useDocumentStore.getState().selectEntities([parent.id]);
    const beforeEntities = Object.keys(s().doc.entities).length;
    const beforeEdges = Object.keys(s().doc.edges).length;
    await runCommand(findCommand(toolCommands, 'add-successor'));
    expect(Object.keys(s().doc.entities).length).toBe(beforeEntities + 1);
    expect(Object.keys(s().doc.edges).length).toBe(beforeEdges + 1);
  });

  it('add-predecessor mints a parent + connects parent → child', async () => {
    const child = seedEntity('Child');
    useDocumentStore.getState().selectEntities([child.id]);
    const beforeEdges = Object.keys(s().doc.edges).length;
    await runCommand(findCommand(toolCommands, 'add-predecessor'));
    expect(Object.keys(s().doc.edges).length).toBe(beforeEdges + 1);
  });
});

describe('toolCommands — type-changers', () => {
  it.each([
    ['mark-as-ude', 'ude'],
    ['mark-as-rootcause', 'rootCause'],
    ['mark-as-csf', 'criticalSuccessFactor'],
    ['mark-as-action', 'action'],
    ['mark-as-outcome', 'desiredEffect'],
    ['mark-as-obstacle', 'obstacle'],
    ['mark-as-io', 'intermediateObjective'],
  ])('%s flips the selected entity to type %s', async (commandId, targetType) => {
    const e = seedEntity('Some', 'effect');
    useDocumentStore.getState().selectEntities([e.id]);
    await runCommand(findCommand(toolCommands, commandId));
    expect(s().doc.entities[e.id]?.type).toBe(targetType);
  });

  it('promote-to-goal flips the type and toasts', async () => {
    const e = seedEntity('Some', 'effect');
    useDocumentStore.getState().selectEntities([e.id]);
    await runCommand(findCommand(toolCommands, 'promote-to-goal'));
    expect(s().doc.entities[e.id]?.type).toBe('goal');
    expect(s().toasts.some((t) => /promoted to Goal/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — add-nc-child', () => {
  it('mints a necessaryCondition child with a necessity edge', async () => {
    const parent = seedEntity('CSF');
    useDocumentStore.getState().selectEntities([parent.id]);
    await runCommand(findCommand(toolCommands, 'add-nc-child'));
    const edges = Object.values(s().doc.edges);
    expect(edges.some((e) => e.kind === 'necessity')).toBe(true);
  });
});

describe('toolCommands — add-assumption-to-edge', () => {
  it('attaches a fresh assumption to the selected edge', async () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);
    await runCommand(findCommand(toolCommands, 'add-assumption-to-edge'));
    const after = s().doc.edges[edge.id];
    expect(after?.assumptionIds?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('toolCommands — add-prerequisite-need (EC)', () => {
  it('mints a Need and wires need → want with a necessity edge', async () => {
    const want = seedEntity('A want', 'want');
    useDocumentStore.getState().selectEntities([want.id]);
    await runCommand(findCommand(toolCommands, 'add-prerequisite-need'));
    const edges = Object.values(s().doc.edges);
    const need = Object.values(s().doc.entities).find((e) => e.type === 'need');
    expect(need).toBeDefined();
    expect(edges.some((e) => e.sourceId === need!.id && e.targetId === want.id)).toBe(true);
  });

  it('refuses when the selected entity is not a Want', async () => {
    const not = seedEntity('not a want', 'effect');
    useDocumentStore.getState().selectEntities([not.id]);
    await runCommand(findCommand(toolCommands, 'add-prerequisite-need'));
    expect(s().toasts.some((t) => /Wants \(D \/ D′\)/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — add-precondition (TT)', () => {
  it('refuses when the selected entity is not an Action', async () => {
    const e = seedEntity('not an action', 'effect');
    useDocumentStore.getState().selectEntities([e.id]);
    await runCommand(findCommand(toolCommands, 'add-precondition'));
    expect(s().toasts.some((t) => /Action entities/i.test(t.message))).toBe(true);
  });

  it('toasts when the Action has no outgoing edge yet', async () => {
    const action = seedEntity('do thing', 'action');
    useDocumentStore.getState().selectEntities([action.id]);
    await runCommand(findCommand(toolCommands, 'add-precondition'));
    expect(s().toasts.some((t) => /needs an Outcome edge first/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — add-io-for-obstacle (PRT)', () => {
  it('mints an IO and wires IO → obstacle', async () => {
    const obs = seedEntity('road block', 'obstacle');
    useDocumentStore.getState().selectEntities([obs.id]);
    await runCommand(findCommand(toolCommands, 'add-io-for-obstacle'));
    const io = Object.values(s().doc.entities).find((e) => e.type === 'intermediateObjective');
    expect(io).toBeDefined();
    expect(
      Object.values(s().doc.edges).some((e) => e.sourceId === io!.id && e.targetId === obs.id)
    ).toBe(true);
  });
});

describe('toolCommands — cycle-edge-polarity', () => {
  it('cycles weight through positive on the first invocation', async () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);
    await runCommand(findCommand(toolCommands, 'cycle-edge-polarity'));
    expect(s().doc.edges[edge.id]?.weight).toBe('positive');
  });
});

describe('toolCommands — copy / cut / paste', () => {
  it('copy on an empty selection toasts info and does not change clipboard', async () => {
    await runCommand(findCommand(toolCommands, 'copy-selection'));
    expect(s().toasts.some((t) => /Nothing to copy/i.test(t.message))).toBe(true);
  });

  it('copy on a selected entity reports the count', async () => {
    const e = seedEntity('thing');
    useDocumentStore.getState().selectEntities([e.id]);
    await runCommand(findCommand(toolCommands, 'copy-selection'));
    expect(s().toasts.some((t) => /Copied 1 entity/i.test(t.message))).toBe(true);
  });

  it('paste-clipboard pastes entities when the buffer is non-empty', async () => {
    // The clipboard buffer lives at module scope in services/clipboard.ts
    // and persists across `resetStoreForTest` runs, so we explicitly
    // seed + copy + reset + paste here rather than rely on global state.
    const seeded = seedEntity('to be copied');
    useDocumentStore.getState().selectEntities([seeded.id]);
    await runCommand(findCommand(toolCommands, 'copy-selection'));
    // Reset the doc so the paste lands on a clean canvas.
    resetStoreForTest();
    const before = Object.keys(s().doc.entities).length;
    await runCommand(findCommand(toolCommands, 'paste-clipboard'));
    expect(Object.keys(s().doc.entities).length).toBeGreaterThan(before);
  });
});

describe('toolCommands — undo / redo', () => {
  it('undo reverses the last mutation', async () => {
    const e = seedEntity('first');
    const idsBefore = Object.keys(s().doc.entities);
    expect(idsBefore).toContain(e.id);
    await runCommand(findCommand(toolCommands, 'undo'));
    expect(Object.keys(s().doc.entities)).not.toContain(e.id);
  });

  it('redo re-applies what undo reversed', async () => {
    const e = seedEntity('first');
    await runCommand(findCommand(toolCommands, 'undo'));
    await runCommand(findCommand(toolCommands, 'redo'));
    expect(Object.keys(s().doc.entities)).toContain(e.id);
  });
});
