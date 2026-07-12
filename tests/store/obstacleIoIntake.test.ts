import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);

/**
 * Session 199 (backlog E) — the PRT Obstacle/Objective intake batched-create
 * action. Each row mints an obstacle + IO + the IO→obstacle necessity edge, all
 * in ONE undo step.
 */
const s = () => useDocumentStore.getState();
const byType = (t: string) => Object.values(s().doc.entities).filter((e) => e.type === t);

describe('addObstacleIoRows', () => {
  it('mints an obstacle + IO + necessity edge (IO → obstacle) per non-blank row', () => {
    s().newDocument('prt');
    const created = s().addObstacleIoRows([
      { obstacle: 'No runbook owner', io: 'A named owner exists' },
      { obstacle: '', io: '' }, // blank → skipped
      { obstacle: 'Three approvals', io: 'One approval' },
    ]);
    expect(created).toHaveLength(4); // 2 pairs × (obstacle + IO)
    expect(byType('obstacle')).toHaveLength(2);
    expect(byType('intermediateObjective')).toHaveLength(2);
    // Every edge is IO → obstacle, kind necessity.
    const edges = Object.values(s().doc.edges);
    expect(edges).toHaveLength(2);
    for (const e of edges) {
      expect(e.kind).toBe('necessity');
      expect(s().doc.entities[e.sourceId]?.type).toBe('intermediateObjective');
      expect(s().doc.entities[e.targetId]?.type).toBe('obstacle');
    }
  });

  it('lands as ONE undo step (undo removes the whole table)', () => {
    s().newDocument('prt');
    s().addObstacleIoRows([
      { obstacle: 'A', io: 'a' },
      { obstacle: 'B', io: 'b' },
    ]);
    expect(Object.keys(s().doc.entities)).toHaveLength(4);
    s().undo();
    expect(Object.keys(s().doc.entities)).toHaveLength(0);
  });

  it('homes show-stopper as a boolean attribute and blocking-factor as the description', () => {
    s().newDocument('prt');
    s().addObstacleIoRows([
      { obstacle: 'Hard blocker', io: 'Cleared', showStopper: true, blockingFactor: 'legal hold' },
    ]);
    const obstacle = byType('obstacle')[0]!;
    expect(obstacle.attributes?.showStopper).toEqual({ kind: 'bool', value: true });
    expect(obstacle.description).toBe('legal hold');
    // A plain row carries neither.
    s().addObstacleIoRows([{ obstacle: 'Plain', io: 'Done' }]);
    const plain = byType('obstacle').find((o) => o.title === 'Plain')!;
    expect(plain.attributes).toBeUndefined();
    expect(plain.description).toBeUndefined();
  });

  it('advances nextAnnotationNumber by two per pair and returns [] for an all-blank table', () => {
    s().newDocument('prt');
    const before = s().doc.nextAnnotationNumber;
    s().addObstacleIoRows([
      { obstacle: 'X', io: 'x' },
      { obstacle: 'Y', io: 'y' },
    ]);
    expect(s().doc.nextAnnotationNumber).toBe(before + 4);
    expect(s().addObstacleIoRows([{ obstacle: '  ', io: '' }])).toEqual([]);
  });

  it('roots each obstacle to the apex goal only when there is exactly one', () => {
    s().newDocument('prt');
    const goal = s().addEntity({ type: 'goal', title: 'The goal' });
    s().addObstacleIoRows([{ obstacle: 'Blocker', io: 'Cleared' }]);
    const obstacle = byType('obstacle')[0]!;
    const rooted = Object.values(s().doc.edges).some(
      (e) => e.sourceId === obstacle.id && e.targetId === goal.id && e.kind === 'necessity'
    );
    expect(rooted).toBe(true);

    // A second goal makes the parent ambiguous → no rooting edge for new rows.
    s().addEntity({ type: 'goal', title: 'Second goal' });
    const edgeCountBefore = Object.keys(s().doc.edges).length;
    s().addObstacleIoRows([{ obstacle: 'Blocker 2', io: 'Cleared 2' }]);
    // Only the IO→obstacle edge is added (no obstacle→goal).
    expect(Object.keys(s().doc.edges).length).toBe(edgeCountBefore + 1);
  });
});
