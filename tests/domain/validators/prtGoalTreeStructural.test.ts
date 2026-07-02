import { beforeEach, describe, expect, it } from 'vitest';
import { goalTreeCsfCountRule, goalTreeCsfNoNcsRule } from '@/domain/validators/goalTreeStructural';
import { prtIoNoObstacleRule, prtObstacleNoIoRule } from '@/domain/validators/prtStructural';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

beforeEach(resetIds);

describe('PRT structural rules', () => {
  it('flags an obstacle with no Intermediate Objective overcoming it', () => {
    const obstacle = makeEntity({ type: 'obstacle', title: 'No budget' });
    const doc = makeDoc([obstacle], [], 'prt');
    const hits = prtObstacleNoIoRule(doc);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: obstacle.id });
  });

  it('does not flag an obstacle that has an IO overcoming it (IO → obstacle)', () => {
    const io = makeEntity({ type: 'intermediateObjective', title: 'Secure funding' });
    const obstacle = makeEntity({ type: 'obstacle', title: 'No budget' });
    const doc = makeDoc([io, obstacle], [makeEdge(io.id, obstacle.id)], 'prt');
    expect(prtObstacleNoIoRule(doc)).toHaveLength(0);
  });

  it('flags an Intermediate Objective that overcomes no obstacle', () => {
    const io = makeEntity({ type: 'intermediateObjective', title: 'Secure funding' });
    const doc = makeDoc([io], [], 'prt');
    const hits = prtIoNoObstacleRule(doc);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: io.id });
  });

  it('does not flag an IO that overcomes an obstacle', () => {
    const io = makeEntity({ type: 'intermediateObjective', title: 'Secure funding' });
    const obstacle = makeEntity({ type: 'obstacle', title: 'No budget' });
    const doc = makeDoc([io, obstacle], [makeEdge(io.id, obstacle.id)], 'prt');
    expect(prtIoNoObstacleRule(doc)).toHaveLength(0);
  });

  it('is inert on non-PRT diagrams', () => {
    const obstacle = makeEntity({ type: 'obstacle', title: 'X' });
    const io = makeEntity({ type: 'intermediateObjective', title: 'Y' });
    const doc = makeDoc([obstacle, io], [], 'crt');
    expect(prtObstacleNoIoRule(doc)).toHaveLength(0);
    expect(prtIoNoObstacleRule(doc)).toHaveLength(0);
  });
});

describe('Goal-Tree structural rules', () => {
  it('flags a Critical Success Factor with no Necessary Conditions beneath it', () => {
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'Skilled team' });
    const doc = makeDoc([csf], [], 'goalTree');
    const hits = goalTreeCsfNoNcsRule(doc);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: csf.id });
  });

  it('does not flag a CSF that has an NC beneath it (NC → CSF)', () => {
    const nc = makeEntity({ type: 'necessaryCondition', title: 'Hire two engineers' });
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'Skilled team' });
    const doc = makeDoc([nc, csf], [makeEdge(nc.id, csf.id)], 'goalTree');
    expect(goalTreeCsfNoNcsRule(doc)).toHaveLength(0);
  });

  it('nudges when a Goal Tree has fewer than three CSFs', () => {
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'Only one' });
    const hits = goalTreeCsfCountRule(makeDoc([csf], [], 'goalTree'));
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'document' });
    expect(hits[0]!.message).toMatch(/1 Critical Success Factor —/);
  });

  it('stays silent at 3–5 CSFs (Dettmer pattern)', () => {
    const csfs = Array.from({ length: 4 }, (_, i) =>
      makeEntity({ type: 'criticalSuccessFactor', title: `CSF ${i}` })
    );
    expect(goalTreeCsfCountRule(makeDoc(csfs, [], 'goalTree'))).toHaveLength(0);
  });

  it('nudges when a Goal Tree has more than five CSFs', () => {
    const csfs = Array.from({ length: 6 }, (_, i) =>
      makeEntity({ type: 'criticalSuccessFactor', title: `CSF ${i}` })
    );
    const hits = goalTreeCsfCountRule(makeDoc(csfs, [], 'goalTree'));
    expect(hits).toHaveLength(1);
    expect(hits[0]!.message).toMatch(/6 Critical Success Factors/);
  });

  it('is silent on an empty Goal Tree and on non-Goal-Tree diagrams', () => {
    expect(goalTreeCsfCountRule(makeDoc([], [], 'goalTree'))).toHaveLength(0);
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'X' });
    expect(goalTreeCsfCountRule(makeDoc([csf], [], 'crt'))).toHaveLength(0);
    expect(goalTreeCsfNoNcsRule(makeDoc([csf], [], 'crt'))).toHaveLength(0);
  });
});
