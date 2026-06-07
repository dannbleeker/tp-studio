import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toolCommands } from '@/components/command-palette/commands/tools';
import { GROUP_COLORS_ORDER } from '@/domain/groupColors';
import { __clearClipboardForTest } from '@/services/clipboard';
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

// ---------------------------------------------------------------------------
// Additional branch-coverage tests — cover every guard / toast / no-op path
// ---------------------------------------------------------------------------

describe('toolCommands — run-validation (all toast branches)', () => {
  it('toasts singular "1 concern" form when exactly one open concern', async () => {
    // One entity with empty title → exactly one clarity warning
    useDocumentStore.getState().addEntity({ type: 'effect', title: '' });
    await runCommand(findCommand(toolCommands, 'run-validation'));
    expect(s().toasts.some((t) => /1 open concern\b/i.test(t.message))).toBe(true);
  });

  it('toasts all-resolved message when all warnings are resolved', async () => {
    // Create an entity that triggers a warning (empty title → entity-existence rule fires).
    // Pre-resolve via the store action, then run validation so the
    // "all resolved" branch fires (open===0, resolved>0).
    const e = useDocumentStore.getState().addEntity({ type: 'effect', title: '' });
    // The entity-existence rule warning id pattern: "entity-existence:entity:<entityId>"
    const warningId = `entity-existence:entity:${e.id}`;
    useDocumentStore.getState().resolveWarning(warningId);
    await runCommand(findCommand(toolCommands, 'run-validation'));
    // Now warnings.length > 0, open === 0, resolved > 0 → "all N concern(s) resolved" toast
    expect(
      s().toasts.some((t) => /resolved.*Categories of Legitimate Reservation/i.test(t.message))
    ).toBe(true);
  });

  it('includes resolved count in the suffix when some are resolved and some are open', async () => {
    // Two entities with empty titles → two warnings. Resolve one so we get
    // open=1, resolved=1 → the suffix ", 1 resolved" branch fires.
    const e1 = useDocumentStore.getState().addEntity({ type: 'effect', title: '' });
    useDocumentStore.getState().addEntity({ type: 'effect', title: '' });
    const warningId1 = `entity-existence:entity:${e1.id}`;
    useDocumentStore.getState().resolveWarning(warningId1);
    await runCommand(findCommand(toolCommands, 'run-validation'));
    // open=1, resolved=1 → the suffix branch → ", 1 resolved"
    expect(s().toasts.some((t) => /open concern.*Categories/i.test(t.message))).toBe(true);
    expect(s().toasts.some((t) => /1 resolved/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — markEntityAs no-op and guard paths', () => {
  it('mark-as-ude toasts when nothing is selected', async () => {
    // No selection at all → kind is 'none', ids empty → shows toast
    await runCommand(findCommand(toolCommands, 'mark-as-ude'));
    expect(s().toasts.some((t) => /Select a single entity/i.test(t.message))).toBe(true);
  });

  it('mark-as-ude toasts when multiple entities are selected', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(toolCommands, 'mark-as-ude'));
    expect(s().toasts.some((t) => /Select a single entity/i.test(t.message))).toBe(true);
  });

  it('mark-as-ude is a silent no-op when the entity is already a ude', async () => {
    const e = seedEntity('already ude', 'ude');
    useDocumentStore.getState().selectEntities([e.id]);
    const toastsBefore = s().toasts.length;
    await runCommand(findCommand(toolCommands, 'mark-as-ude'));
    // No new toast — silent no-op
    expect(s().toasts.length).toBe(toastsBefore);
    // Type unchanged
    expect(s().doc.entities[e.id]?.type).toBe('ude');
  });

  it('mark-as-rootcause is a silent no-op when entity is already rootCause', async () => {
    const e = seedEntity('already rc', 'rootCause');
    useDocumentStore.getState().selectEntities([e.id]);
    const toastsBefore = s().toasts.length;
    await runCommand(findCommand(toolCommands, 'mark-as-rootcause'));
    expect(s().toasts.length).toBe(toastsBefore);
    expect(s().doc.entities[e.id]?.type).toBe('rootCause');
  });

  it('mark-as-csf is a silent no-op when entity is already criticalSuccessFactor', async () => {
    const e = seedEntity('already csf', 'criticalSuccessFactor');
    useDocumentStore.getState().selectEntities([e.id]);
    const toastsBefore = s().toasts.length;
    await runCommand(findCommand(toolCommands, 'mark-as-csf'));
    expect(s().toasts.length).toBe(toastsBefore);
    expect(s().doc.entities[e.id]?.type).toBe('criticalSuccessFactor');
  });

  it('mark-as-action is a silent no-op when entity is already action', async () => {
    const e = seedEntity('already action', 'action');
    useDocumentStore.getState().selectEntities([e.id]);
    const toastsBefore = s().toasts.length;
    await runCommand(findCommand(toolCommands, 'mark-as-action'));
    expect(s().toasts.length).toBe(toastsBefore);
    expect(s().doc.entities[e.id]?.type).toBe('action');
  });

  it('mark-as-outcome is a silent no-op when entity is already desiredEffect', async () => {
    const e = seedEntity('already outcome', 'desiredEffect');
    useDocumentStore.getState().selectEntities([e.id]);
    const toastsBefore = s().toasts.length;
    await runCommand(findCommand(toolCommands, 'mark-as-outcome'));
    expect(s().toasts.length).toBe(toastsBefore);
    expect(s().doc.entities[e.id]?.type).toBe('desiredEffect');
  });
});

describe('toolCommands — swap-entities guard', () => {
  it('toasts when fewer than two entities are selected', async () => {
    const a = seedEntity('A');
    useDocumentStore.getState().selectEntities([a.id]);
    await runCommand(findCommand(toolCommands, 'swap-entities'));
    expect(s().toasts.some((t) => /exactly two entities/i.test(t.message))).toBe(true);
  });

  it('toasts when nothing is selected', async () => {
    await runCommand(findCommand(toolCommands, 'swap-entities'));
    expect(s().toasts.some((t) => /exactly two entities/i.test(t.message))).toBe(true);
  });

  it('toasts success after a valid swap', async () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(toolCommands, 'swap-entities'));
    expect(s().toasts.some((t) => /Swapped/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — add-successor / add-predecessor guards', () => {
  it('add-successor toasts when nothing is selected', async () => {
    await runCommand(findCommand(toolCommands, 'add-successor'));
    expect(s().toasts.some((t) => /Select a single entity/i.test(t.message))).toBe(true);
  });

  it('add-successor toasts when multiple entities are selected', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(toolCommands, 'add-successor'));
    expect(s().toasts.some((t) => /Select a single entity/i.test(t.message))).toBe(true);
  });

  it('add-predecessor toasts when nothing is selected', async () => {
    await runCommand(findCommand(toolCommands, 'add-predecessor'));
    expect(s().toasts.some((t) => /Select a single entity/i.test(t.message))).toBe(true);
  });

  it('add-predecessor toasts when multiple entities are selected', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(toolCommands, 'add-predecessor'));
    expect(s().toasts.some((t) => /Select a single entity/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — trim-branch', () => {
  it('toasts when nothing is selected', async () => {
    await runCommand(findCommand(toolCommands, 'trim-branch'));
    expect(s().toasts.some((t) => /Select the undesirable effect/i.test(t.message))).toBe(true);
  });

  it('toasts success and adds injection entity on a valid single selection', async () => {
    const e = seedEntity('UDE', 'ude');
    useDocumentStore.getState().selectEntities([e.id]);
    await runCommand(findCommand(toolCommands, 'trim-branch'));
    expect(s().toasts.some((t) => /trimming injection/i.test(t.message))).toBe(true);
    // An injection entity should now exist in the doc
    const injection = Object.values(s().doc.entities).find((en) => en.type === 'injection');
    expect(injection).toBeDefined();
  });

  it('is silent (no toast) when trimBranch returns null (entity not found)', async () => {
    // Select a valid entity, then delete it so trimBranch finds no entity —
    // we simulate by selecting entities via ids that reference something the
    // store doesn't know about. The store's selectEntities doesn't validate,
    // so we can pass an invalid id directly.
    useDocumentStore.getState().selectEntities(['nonexistent-id']);
    const toastsBefore = s().toasts.length;
    await runCommand(findCommand(toolCommands, 'trim-branch'));
    // The guard fires first (kind === 'entities', ids.length === 1), then
    // trimBranch is called which returns null for a missing entity — no toast.
    expect(s().toasts.length).toBe(toastsBefore);
  });
});

describe('toolCommands — promote-to-goal guards', () => {
  it('toasts when nothing is selected', async () => {
    await runCommand(findCommand(toolCommands, 'promote-to-goal'));
    expect(s().toasts.some((t) => /Select a single entity/i.test(t.message))).toBe(true);
  });

  it('is a silent no-op when entity is already a goal', async () => {
    const e = seedEntity('already goal', 'goal');
    useDocumentStore.getState().selectEntities([e.id]);
    const toastsBefore = s().toasts.length;
    await runCommand(findCommand(toolCommands, 'promote-to-goal'));
    expect(s().toasts.length).toBe(toastsBefore);
    expect(s().doc.entities[e.id]?.type).toBe('goal');
  });

  it('uses the entity title in the success toast', async () => {
    const e = seedEntity('My CSF', 'criticalSuccessFactor');
    useDocumentStore.getState().selectEntities([e.id]);
    await runCommand(findCommand(toolCommands, 'promote-to-goal'));
    expect(s().toasts.some((t) => /My CSF.*promoted to Goal/i.test(t.message))).toBe(true);
  });

  it('uses "Entity" fallback in the toast when entity has no title', async () => {
    const e = useDocumentStore.getState().addEntity({ type: 'effect', title: '' });
    useDocumentStore.getState().selectEntities([e.id]);
    await runCommand(findCommand(toolCommands, 'promote-to-goal'));
    expect(s().toasts.some((t) => /"Entity" promoted to Goal/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — add-nc-child guard', () => {
  it('toasts when nothing is selected', async () => {
    await runCommand(findCommand(toolCommands, 'add-nc-child'));
    expect(s().toasts.some((t) => /Select a single entity/i.test(t.message))).toBe(true);
  });

  it('toasts when multiple entities are selected', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(toolCommands, 'add-nc-child'));
    expect(s().toasts.some((t) => /Select a single entity/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — add-assumption-to-edge guard', () => {
  it('toasts when no edge is selected', async () => {
    await runCommand(findCommand(toolCommands, 'add-assumption-to-edge'));
    expect(s().toasts.some((t) => /Select a single edge first/i.test(t.message))).toBe(true);
  });

  it('toasts when multiple edges are selected', async () => {
    const { b } = seedConnectedPair();
    const c = seedEntity('C');
    const edge2 = useDocumentStore.getState().connect(b.id, c.id);
    if (!edge2) throw new Error('edge2 not created');
    const { edge: edge1 } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge1.id, edge2.id]);
    await runCommand(findCommand(toolCommands, 'add-assumption-to-edge'));
    expect(s().toasts.some((t) => /Select a single edge first/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — add-prerequisite-need guard', () => {
  it('toasts when nothing is selected', async () => {
    await runCommand(findCommand(toolCommands, 'add-prerequisite-need'));
    expect(s().toasts.some((t) => /Select a single Want first/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — add-precondition guard (no selection)', () => {
  it('toasts when nothing is selected', async () => {
    await runCommand(findCommand(toolCommands, 'add-precondition'));
    expect(s().toasts.some((t) => /Select a single Action first/i.test(t.message))).toBe(true);
  });

  it('toasts when multiple entities are selected', async () => {
    const a = seedEntity('A', 'action');
    const b = seedEntity('B', 'action');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(toolCommands, 'add-precondition'));
    expect(s().toasts.some((t) => /Select a single Action first/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — add-precondition (TT) — success path', () => {
  it('mints a precondition effect entity and wires it to the same outcome', async () => {
    const action = seedEntity('do thing', 'action');
    const outcome = seedEntity('outcome', 'desiredEffect');
    useDocumentStore.getState().connect(action.id, outcome.id);
    useDocumentStore.getState().selectEntities([action.id]);
    const before = Object.keys(s().doc.entities).length;
    await runCommand(findCommand(toolCommands, 'add-precondition'));
    expect(Object.keys(s().doc.entities).length).toBe(before + 1);
    const precond = Object.values(s().doc.entities).find(
      (e) => e.type === 'effect' && e.id !== action.id && e.id !== outcome.id
    );
    expect(precond).toBeDefined();
    // The precondition should be connected to the same outcome
    expect(
      Object.values(s().doc.edges).some(
        (e) => e.sourceId === precond!.id && e.targetId === outcome.id
      )
    ).toBe(true);
  });
});

describe('toolCommands — mark-as-obstacle guard paths', () => {
  it('toasts when nothing is selected', async () => {
    await runCommand(findCommand(toolCommands, 'mark-as-obstacle'));
    expect(s().toasts.some((t) => /Select a single entity/i.test(t.message))).toBe(true);
  });

  it('is a silent no-op when entity is already obstacle', async () => {
    const e = seedEntity('already obstacle', 'obstacle');
    useDocumentStore.getState().selectEntities([e.id]);
    const toastsBefore = s().toasts.length;
    await runCommand(findCommand(toolCommands, 'mark-as-obstacle'));
    expect(s().toasts.length).toBe(toastsBefore);
    expect(s().doc.entities[e.id]?.type).toBe('obstacle');
  });
});

describe('toolCommands — mark-as-io guard paths', () => {
  it('toasts when nothing is selected', async () => {
    await runCommand(findCommand(toolCommands, 'mark-as-io'));
    expect(s().toasts.some((t) => /Select a single entity/i.test(t.message))).toBe(true);
  });

  it('is a silent no-op when entity is already intermediateObjective', async () => {
    const e = seedEntity('already io', 'intermediateObjective');
    useDocumentStore.getState().selectEntities([e.id]);
    const toastsBefore = s().toasts.length;
    await runCommand(findCommand(toolCommands, 'mark-as-io'));
    expect(s().toasts.length).toBe(toastsBefore);
    expect(s().doc.entities[e.id]?.type).toBe('intermediateObjective');
  });
});

describe('toolCommands — add-io-for-obstacle guard paths', () => {
  it('toasts when nothing is selected', async () => {
    await runCommand(findCommand(toolCommands, 'add-io-for-obstacle'));
    expect(s().toasts.some((t) => /Select a single Obstacle first/i.test(t.message))).toBe(true);
  });

  it('toasts when selected entity is not an obstacle', async () => {
    const e = seedEntity('not an obstacle', 'effect');
    useDocumentStore.getState().selectEntities([e.id]);
    await runCommand(findCommand(toolCommands, 'add-io-for-obstacle'));
    expect(s().toasts.some((t) => /Add IO is for Obstacle entities/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — cycle-edge-polarity full cycle', () => {
  it('cycles positive → negative → zero → undefined', async () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);

    await runCommand(findCommand(toolCommands, 'cycle-edge-polarity'));
    expect(s().doc.edges[edge.id]?.weight).toBe('positive');

    await runCommand(findCommand(toolCommands, 'cycle-edge-polarity'));
    expect(s().doc.edges[edge.id]?.weight).toBe('negative');

    await runCommand(findCommand(toolCommands, 'cycle-edge-polarity'));
    expect(s().doc.edges[edge.id]?.weight).toBe('zero');

    await runCommand(findCommand(toolCommands, 'cycle-edge-polarity'));
    expect(s().doc.edges[edge.id]?.weight).toBeUndefined();
  });

  it('toasts the polarity label at each step', async () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);

    await runCommand(findCommand(toolCommands, 'cycle-edge-polarity'));
    expect(s().toasts.some((t) => /positive/i.test(t.message))).toBe(true);
  });

  it('toasts when no edge is selected', async () => {
    await runCommand(findCommand(toolCommands, 'cycle-edge-polarity'));
    expect(s().toasts.some((t) => /Select a single edge first/i.test(t.message))).toBe(true);
  });

  it('toasts "default" after cycling back to undefined', async () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);
    // Cycle through all 4 states to get back to undefined → "default"
    for (let i = 0; i < 4; i++) {
      await runCommand(findCommand(toolCommands, 'cycle-edge-polarity'));
    }
    expect(s().toasts.some((t) => /default/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — cycle-group-color', () => {
  it('toasts when no group is selected', async () => {
    await runCommand(findCommand(toolCommands, 'cycle-group-color'));
    expect(s().toasts.some((t) => /Select a single group first/i.test(t.message))).toBe(true);
  });

  it('cycles to the next color in the palette', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const group = useDocumentStore.getState().createGroupFromSelection([a.id, b.id]);
    if (!group) throw new Error('createGroupFromSelection failed');
    useDocumentStore.getState().selectGroup(group.id);

    const initialColor = s().doc.groups[group.id]?.color;
    const initialIdx = GROUP_COLORS_ORDER.indexOf(initialColor!);
    const expectedNext = GROUP_COLORS_ORDER[(initialIdx + 1) % GROUP_COLORS_ORDER.length];

    await runCommand(findCommand(toolCommands, 'cycle-group-color'));
    expect(s().doc.groups[group.id]?.color).toBe(expectedNext);
  });

  it('wraps around from the last color to the first', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const group = useDocumentStore.getState().createGroupFromSelection([a.id, b.id]);
    if (!group) throw new Error('createGroupFromSelection failed');

    // Recolor the group to the last color in the order so wrapping is testable
    const lastColor = GROUP_COLORS_ORDER[GROUP_COLORS_ORDER.length - 1]!;
    useDocumentStore.getState().recolorGroup(group.id, lastColor);
    useDocumentStore.getState().selectGroup(group.id);

    await runCommand(findCommand(toolCommands, 'cycle-group-color'));
    expect(s().doc.groups[group.id]?.color).toBe(GROUP_COLORS_ORDER[0]);
  });
});

describe('toolCommands — copy-selection plural', () => {
  it('reports plural "entities" when more than one entity is copied', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(toolCommands, 'copy-selection'));
    expect(s().toasts.some((t) => /Copied 2 entities/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — cut-selection', () => {
  it('toasts the count of cut entities', async () => {
    const e = seedEntity('to cut');
    useDocumentStore.getState().selectEntities([e.id]);
    await runCommand(findCommand(toolCommands, 'cut-selection'));
    expect(s().toasts.some((t) => /Cut 1 entity/i.test(t.message))).toBe(true);
  });

  it('toasts plural form when cutting multiple entities', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(toolCommands, 'cut-selection'));
    expect(s().toasts.some((t) => /Cut 2 entities/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — paste-clipboard empty', () => {
  it('toasts "Clipboard is empty" when nothing has been copied', async () => {
    // The clipboard buffer lives at module scope and persists across resets.
    // Use the test-escape-hatch to guarantee an empty buffer before this test.
    __clearClipboardForTest();
    await runCommand(findCommand(toolCommands, 'paste-clipboard'));
    expect(s().toasts.some((t) => /Clipboard is empty/i.test(t.message))).toBe(true);
  });
});

describe('toolCommands — confirm-delete-selection', () => {
  it('runs without throwing (async confirmation dialog is fire-and-forget)', async () => {
    seedEntity('to delete');
    await expect(
      runCommand(findCommand(toolCommands, 'confirm-delete-selection'))
    ).resolves.not.toThrow();
  });
});

describe('toolCommands — registry completeness', () => {
  it('registers all expected command ids exactly once', () => {
    const expected = [
      'run-validation',
      'swap-entities',
      'add-successor',
      'add-predecessor',
      'trim-branch',
      'confirm-delete-selection',
      'mark-as-ude',
      'mark-as-rootcause',
      'promote-to-goal',
      'mark-as-csf',
      'add-nc-child',
      'add-assumption-to-edge',
      'add-prerequisite-need',
      'mark-as-action',
      'mark-as-outcome',
      'add-precondition',
      'mark-as-obstacle',
      'mark-as-io',
      'add-io-for-obstacle',
      'cycle-edge-polarity',
      'cycle-group-color',
      'copy-selection',
      'cut-selection',
      'paste-clipboard',
      'undo',
      'redo',
    ];
    for (const id of expected) {
      expect(
        toolCommands.filter((c) => c.id === id),
        `missing or duplicate: ${id}`
      ).toHaveLength(1);
    }
  });
});
