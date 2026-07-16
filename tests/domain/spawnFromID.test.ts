import { beforeEach, describe, expect, it } from 'vitest';
import { spawnGoalTreeFromID } from '@/domain/spawnGoalTree';
import { spawnPRTFromID } from '@/domain/spawnPRT';
import type { TPDocument } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(resetIds);

// A small ID: one objective, two interferences, one of them paired with an IO.
const sampleID = (): TPDocument => {
  const objective = makeEntity({ type: 'goal', title: 'More throughput' });
  const io = makeEntity({ type: 'intermediateObjective', title: 'Kit the parts' });
  const paired = makeEntity({ type: 'obstacle', title: 'Parts unavailable' });
  const unpaired = makeEntity({ type: 'obstacle', title: 'Machine breaks down' });
  return makeDoc(
    [objective, io, paired, unpaired],
    [
      makeEdge(paired.id, objective.id),
      makeEdge(unpaired.id, objective.id),
      makeEdge(io.id, paired.id),
    ],
    'id'
  );
};

describe('spawnPRTFromID', () => {
  it('produces a PRT with the ID objective as the apex goal', () => {
    const prt = spawnPRTFromID(sampleID());
    expect(prt.diagramType).toBe('prt');
    const goals = Object.values(prt.entities).filter((e) => e.type === 'goal');
    expect(goals).toHaveLength(1);
    expect(goals[0]!.title).toBe('More throughput');
  });

  it('carries each interference as an obstacle pointing at the goal', () => {
    const prt = spawnPRTFromID(sampleID());
    const obstacles = Object.values(prt.entities).filter((e) => e.type === 'obstacle');
    expect(obstacles.map((o) => o.title).sort()).toEqual([
      'Machine breaks down',
      'Parts unavailable',
    ]);
    const goalId = Object.values(prt.entities).find((e) => e.type === 'goal')!.id;
    // Every obstacle → goal edge exists.
    for (const o of obstacles) {
      expect(
        Object.values(prt.edges).some((e) => e.sourceId === o.id && e.targetId === goalId)
      ).toBe(true);
    }
  });

  it('carries a paired IO verbatim and synthesizes one for an unpaired interference', () => {
    const prt = spawnPRTFromID(sampleID());
    const ios = Object.values(prt.entities).filter((e) => e.type === 'intermediateObjective');
    expect(ios).toHaveLength(2);
    const titles = ios.map((i) => i.title);
    expect(titles).toContain('Kit the parts'); // the paired IO, verbatim
    expect(titles.some((t) => t.startsWith('Overcome:'))).toBe(true); // synthesized for the unpaired
  });

  it('does not mutate the source document', () => {
    const src = sampleID();
    const before = JSON.stringify(src);
    spawnPRTFromID(src);
    expect(JSON.stringify(src)).toBe(before);
  });
});

describe('spawnGoalTreeFromID', () => {
  it('produces a Goal Tree with the objective as the Goal and each IO as a CSF', () => {
    const gt = spawnGoalTreeFromID(sampleID());
    expect(gt.diagramType).toBe('goalTree');
    const goals = Object.values(gt.entities).filter((e) => e.type === 'goal');
    expect(goals).toHaveLength(1);
    expect(goals[0]!.title).toBe('More throughput');
    const csfs = Object.values(gt.entities).filter((e) => e.type === 'criticalSuccessFactor');
    expect(csfs.map((c) => c.title)).toEqual(['Kit the parts']);
  });

  it('wires each CSF to the goal with a necessity edge', () => {
    const gt = spawnGoalTreeFromID(sampleID());
    const goalId = Object.values(gt.entities).find((e) => e.type === 'goal')!.id;
    const csf = Object.values(gt.entities).find((e) => e.type === 'criticalSuccessFactor')!;
    const edge = Object.values(gt.edges).find(
      (e) => e.sourceId === csf.id && e.targetId === goalId
    );
    expect(edge?.kind).toBe('necessity');
  });

  it('does not mutate the source document', () => {
    const src = sampleID();
    const before = JSON.stringify(src);
    spawnGoalTreeFromID(src);
    expect(JSON.stringify(src)).toBe(before);
  });
});
