import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analysisCommands } from '@/components/command-palette/commands/analysis';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedChain, seedConnectedPair, seedEntity } from '../../../helpers/seedDoc';
import { findCommand, runCommand } from './helpers';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('analysisCommands — find-core-drivers', () => {
  it('selects the core driver entity and toasts when one exists', async () => {
    // Set up a CRT with a rootCause feeding a UDE — that's the minimal
    // shape that produces a core-driver candidate.
    useDocumentStore.getState().newDocument('crt');
    const rc = seedEntity('Root', 'rootCause');
    const ude = seedEntity('UDE', 'ude');
    useDocumentStore.getState().connect(rc.id, ude.id);
    await runCommand(findCommand(analysisCommands, 'find-core-drivers'));
    const sel = s().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind !== 'entities') return;
    expect(sel.ids).toContain(rc.id);
    expect(s().toasts.some((t) => /core driver/i.test(t.message))).toBe(true);
  });

  it('toasts info when there are no candidates', async () => {
    useDocumentStore.getState().newDocument('crt');
    await runCommand(findCommand(analysisCommands, 'find-core-drivers'));
    expect(s().toasts.some((t) => /no core driver/i.test(t.message))).toBe(true);
  });

  it('lists the candidates when more than one core driver exists', async () => {
    useDocumentStore.getState().newDocument('crt');
    const rc1 = seedEntity('Root one', 'rootCause');
    const ude1 = seedEntity('UDE one', 'ude');
    s().connect(rc1.id, ude1.id);
    const rc2 = seedEntity('Root two', 'rootCause');
    const ude2 = seedEntity('UDE two', 'ude');
    s().connect(rc2.id, ude2.id);
    await runCommand(findCommand(analysisCommands, 'find-core-drivers'));
    expect(s().toasts.some((t) => /core driver candidates:/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — spawn-ec-from-selection', () => {
  it('replaces the doc with a fresh EC when exactly one entity is selected', async () => {
    const e = seedEntity('A conflict');
    useDocumentStore.getState().selectEntities([e.id]);
    await runCommand(findCommand(analysisCommands, 'spawn-ec-from-selection'));
    expect(s().doc.diagramType).toBe('ec');
  });

  it('toasts info when not exactly one entity is selected', async () => {
    await runCommand(findCommand(analysisCommands, 'spawn-ec-from-selection'));
    expect(s().toasts.some((t) => /exactly one entity/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — spawn-frt-from-crt (backlog C)', () => {
  it('opens a fresh FRT seeded from the CRT UDEs and keeps the CRT standalone', async () => {
    useDocumentStore.getState().newDocument('crt');
    seedEntity('Orders ship late', 'ude');
    seedEntity('Quality slips', 'ude');
    await runCommand(findCommand(analysisCommands, 'spawn-frt-from-crt'));
    // The RIGHT builder ran: the active doc is now an FRT with one
    // desired-effect seed per source UDE (not, say, an EC).
    expect(s().doc.diagramType).toBe('frt');
    expect(Object.values(s().doc.entities).filter((e) => e.type === 'desiredEffect')).toHaveLength(
      2
    );
    expect(s().toasts.some((t) => /future reality tree/i.test(t.message))).toBe(true);
  });

  it('toasts info and does nothing when the current doc is not a CRT', async () => {
    useDocumentStore.getState().newDocument('ec');
    await runCommand(findCommand(analysisCommands, 'spawn-frt-from-crt'));
    expect(s().doc.diagramType).toBe('ec');
    expect(s().toasts.some((t) => /current reality tree/i.test(t.message))).toBe(true);
  });

  it('toasts info when the CRT has no UDEs to invert', async () => {
    useDocumentStore.getState().newDocument('crt');
    seedEntity('Some cause', 'rootCause');
    await runCommand(findCommand(analysisCommands, 'spawn-frt-from-crt'));
    expect(s().doc.diagramType).toBe('crt');
    expect(s().toasts.some((t) => /no undesirable effects/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — spawn-crt-from-goaltree (backlog C)', () => {
  it('opens a fresh CRT with one candidate UDE per CSF/NC and keeps the Goal Tree standalone', async () => {
    useDocumentStore.getState().newDocument('goalTree');
    seedEntity('Reliable delivery', 'criticalSuccessFactor');
    seedEntity('Buffers managed', 'necessaryCondition');
    await runCommand(findCommand(analysisCommands, 'spawn-crt-from-goaltree'));
    expect(s().doc.diagramType).toBe('crt');
    expect(Object.values(s().doc.entities).filter((e) => e.type === 'ude')).toHaveLength(2);
    expect(s().toasts.some((t) => /current reality tree/i.test(t.message))).toBe(true);
  });

  it('toasts info and does nothing when the current doc is not a Goal Tree', async () => {
    // The default reset doc is a CRT (diagramType !== 'goalTree').
    await runCommand(findCommand(analysisCommands, 'spawn-crt-from-goaltree'));
    expect(s().doc.diagramType).toBe('crt');
    expect(s().toasts.some((t) => /goal tree/i.test(t.message))).toBe(true);
  });

  it('toasts info when the Goal Tree has no CSF or NC to benchmark', async () => {
    useDocumentStore.getState().newDocument('goalTree');
    seedEntity('Win the market', 'goal');
    await runCommand(findCommand(analysisCommands, 'spawn-crt-from-goaltree'));
    expect(s().doc.diagramType).toBe('goalTree');
    expect(s().toasts.some((t) => /critical success factors/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — start-read-through', () => {
  it('opens the read-through overlay when edges exist', async () => {
    seedChain(['A', 'B', 'C']);
    await runCommand(findCommand(analysisCommands, 'start-read-through'));
    expect(s().walkthrough.kind).toBe('read-through');
  });

  it('toasts info when there are no edges to walk', async () => {
    await runCommand(findCommand(analysisCommands, 'start-read-through'));
    expect(s().walkthrough.kind).toBe('closed');
    expect(s().toasts.some((t) => /no edges to walk/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — read-all-at-once', () => {
  it('opens the all-at-once dialog when edges exist', async () => {
    seedChain(['A', 'B']);
    await runCommand(findCommand(analysisCommands, 'read-all-at-once'));
    expect(s().readAllAtOnceOpen).toBe(true);
  });

  it('toasts info when there are no edges', async () => {
    await runCommand(findCommand(analysisCommands, 'read-all-at-once'));
    expect(s().readAllAtOnceOpen).toBe(false);
    expect(s().toasts.some((t) => /no edges to read/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — start-clr-walkthrough', () => {
  it('toasts success when there are no open concerns', async () => {
    await runCommand(findCommand(analysisCommands, 'start-clr-walkthrough'));
    // Fresh empty doc -> no warnings -> success toast.
    expect(s().toasts.some((t) => /no open CLR/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — scrutinize-edge (Phase 3 #7)', () => {
  it('opens the CLR-scrutiny dialog for a single selected edge', async () => {
    const { edge } = seedConnectedPair();
    s().selectEdge(edge.id);
    await runCommand(findCommand(analysisCommands, 'scrutinize-edge'));
    expect(s().edgeScrutinyId).toBe(edge.id);
  });

  it('toasts info and opens nothing when no single edge is selected', async () => {
    await runCommand(findCommand(analysisCommands, 'scrutinize-edge'));
    expect(s().edgeScrutinyId).toBeNull();
    expect(s().toasts.some((t) => /single edge/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — view-injection-flower (Phase 3 #3)', () => {
  it('opens the flower for a single selected injection', async () => {
    const inj = useDocumentStore
      .getState()
      .addEntity({ type: 'injection', title: 'Run a bootcamp' });
    s().selectEntity(inj.id);
    await runCommand(findCommand(analysisCommands, 'view-injection-flower'));
    expect(s().injectionFlowerEntityId).toBe(inj.id);
  });

  it('toasts info when the selection is not a single injection', async () => {
    const e = seedEntity('A', 'effect');
    s().selectEntity(e.id);
    await runCommand(findCommand(analysisCommands, 'view-injection-flower'));
    expect(s().injectionFlowerEntityId).toBeNull();
    expect(s().toasts.some((t) => /single injection/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — speculation (Phase 1C)', () => {
  it('begin-speculation enters speculation mode', async () => {
    await runCommand(findCommand(analysisCommands, 'begin-speculation'));
    expect(s().speculationOverlay).toEqual({});
    expect(s().toasts.some((t) => /speculation on/i.test(t.message))).toBe(true);
  });

  it('begin-speculation is a no-op toast when already speculating', async () => {
    s().beginSpeculation();
    await runCommand(findCommand(analysisCommands, 'begin-speculation'));
    expect(s().toasts.some((t) => /already speculating/i.test(t.message))).toBe(true);
  });

  it('commit-speculation writes overrides into the doc and exits', async () => {
    const e = seedEntity('A');
    s().setSpeculativeState(e.id, 'false');
    await runCommand(findCommand(analysisCommands, 'commit-speculation'));
    expect(s().speculationOverlay).toBeNull();
    expect(s().doc.entities[e.id]?.state).toBe('false');
    expect(s().toasts.some((t) => /committed 1 state change/i.test(t.message))).toBe(true);
  });

  it('commit-speculation toasts info when not speculating', async () => {
    await runCommand(findCommand(analysisCommands, 'commit-speculation'));
    expect(s().toasts.some((t) => /not speculating/i.test(t.message))).toBe(true);
  });

  it('revert-speculation discards the overlay', async () => {
    const e = seedEntity('A');
    s().setSpeculativeState(e.id, 'true');
    await runCommand(findCommand(analysisCommands, 'revert-speculation'));
    expect(s().speculationOverlay).toBeNull();
    expect(s().doc.entities[e.id]?.state).toBeUndefined();
    expect(s().toasts.some((t) => /discarded/i.test(t.message))).toBe(true);
  });

  it('revert-speculation toasts info when not speculating', async () => {
    await runCommand(findCommand(analysisCommands, 'revert-speculation'));
    expect(s().toasts.some((t) => /not speculating/i.test(t.message))).toBe(true);
  });

  it('commit-speculation just ends the session when no states were set', async () => {
    s().beginSpeculation(); // overlay = {} — nothing speculated yet
    await runCommand(findCommand(analysisCommands, 'commit-speculation'));
    expect(s().speculationOverlay).toBeNull();
    expect(s().toasts.some((t) => /speculation ended/i.test(t.message))).toBe(true);
  });
});
