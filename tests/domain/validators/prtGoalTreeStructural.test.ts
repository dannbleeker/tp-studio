import { beforeEach, describe, expect, it } from 'vitest';
import {
  goalTreeCsfCountRule,
  goalTreeCsfNoNcsRule,
  goalTreeJunctorRule,
  goalTreeNcDepthRule,
  goalTreeNcsPerCsfRule,
} from '@/domain/validators/goalTreeStructural';
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

describe('Goal-Tree build-discipline rules (Session 195, Dettmer Fig 3.14)', () => {
  it('flags a CSF with more than five direct NCs', () => {
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'Overloaded' });
    const ncs = Array.from({ length: 6 }, (_, i) =>
      makeEntity({ type: 'necessaryCondition', title: `NC ${i}` })
    );
    const doc = makeDoc(
      [csf, ...ncs],
      ncs.map((nc) => makeEdge(nc.id, csf.id, { kind: 'necessity' })),
      'goalTree'
    );
    const hits = goalTreeNcsPerCsfRule(doc);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: csf.id });
    expect(hits[0]!.message).toMatch(/6 direct Necessary Conditions/);
  });

  it('stays silent at five or fewer NCs per CSF (both shipped two-arm patterns pass)', () => {
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'Fine' });
    const ncs = Array.from({ length: 5 }, (_, i) =>
      makeEntity({ type: 'necessaryCondition', title: `NC ${i}` })
    );
    const doc = makeDoc(
      [csf, ...ncs],
      ncs.map((nc) => makeEdge(nc.id, csf.id, { kind: 'necessity' })),
      'goalTree'
    );
    expect(goalTreeNcsPerCsfRule(doc)).toHaveLength(0);
  });

  it('flags an NC nested three layers below a CSF, not the two-layer ones', () => {
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'CSF' });
    const nc1 = makeEntity({ type: 'necessaryCondition', title: 'Layer 1' });
    const nc2 = makeEntity({ type: 'necessaryCondition', title: 'Layer 2' });
    const nc3 = makeEntity({ type: 'necessaryCondition', title: 'Layer 3 — too deep' });
    const doc = makeDoc(
      [csf, nc1, nc2, nc3],
      [
        makeEdge(nc1.id, csf.id, { kind: 'necessity' }),
        makeEdge(nc2.id, nc1.id, { kind: 'necessity' }),
        makeEdge(nc3.id, nc2.id, { kind: 'necessity' }),
      ],
      'goalTree'
    );
    const hits = goalTreeNcDepthRule(doc);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: nc3.id });
    expect(hits[0]!.message).toMatch(/Prerequisite Tree/);
  });

  it('uses the shallowest path when an NC supports two parents at different depths', () => {
    // nc is layer 3 via the chain but ALSO layer 1 directly under the CSF —
    // the charitable min-depth reading keeps it silent.
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'CSF' });
    const nc1 = makeEntity({ type: 'necessaryCondition', title: 'Layer 1' });
    const nc2 = makeEntity({ type: 'necessaryCondition', title: 'Layer 2' });
    const shared = makeEntity({ type: 'necessaryCondition', title: 'Shared' });
    const doc = makeDoc(
      [csf, nc1, nc2, shared],
      [
        makeEdge(nc1.id, csf.id, { kind: 'necessity' }),
        makeEdge(nc2.id, nc1.id, { kind: 'necessity' }),
        makeEdge(shared.id, nc2.id, { kind: 'necessity' }),
        makeEdge(shared.id, csf.id, { kind: 'necessity' }),
      ],
      'goalTree'
    );
    expect(goalTreeNcDepthRule(doc)).toHaveLength(0);
  });

  it('terminates and stays silent on an NC cycle', () => {
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'CSF' });
    const ncA = makeEntity({ type: 'necessaryCondition', title: 'A' });
    const ncB = makeEntity({ type: 'necessaryCondition', title: 'B' });
    const doc = makeDoc(
      [csf, ncA, ncB],
      [
        makeEdge(ncA.id, csf.id, { kind: 'necessity' }),
        makeEdge(ncB.id, ncA.id, { kind: 'necessity' }),
        makeEdge(ncA.id, ncB.id, { kind: 'necessity' }),
      ],
      'goalTree'
    );
    expect(goalTreeNcDepthRule(doc)).toHaveLength(0);
  });

  it('flags AND / OR / XOR grouped edges in a Goal Tree, one warning per edge', () => {
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'CSF' });
    const nc1 = makeEntity({ type: 'necessaryCondition', title: 'NC 1' });
    const nc2 = makeEntity({ type: 'necessaryCondition', title: 'NC 2' });
    const nc3 = makeEntity({ type: 'necessaryCondition', title: 'NC 3' });
    const doc = makeDoc(
      [csf, nc1, nc2, nc3],
      [
        makeEdge(nc1.id, csf.id, { kind: 'necessity', andGroupId: 'g1' }),
        makeEdge(nc2.id, csf.id, { kind: 'necessity', andGroupId: 'g1' }),
        makeEdge(nc3.id, csf.id, { kind: 'necessity' }),
      ],
      'goalTree'
    );
    const hits = goalTreeJunctorRule(doc);
    expect(hits).toHaveLength(2);
    for (const hit of hits) {
      expect(hit.target.kind).toBe('edge');
      expect(hit.message).toMatch(/single arrows/);
    }
  });

  it('build-discipline rules are inert on non-Goal-Tree diagrams', () => {
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'X' });
    const ncs = Array.from({ length: 6 }, (_, i) =>
      makeEntity({ type: 'necessaryCondition', title: `NC ${i}` })
    );
    const edges = ncs.map((nc) => makeEdge(nc.id, csf.id, { andGroupId: 'g1' }));
    const doc = makeDoc([csf, ...ncs], edges, 'crt');
    expect(goalTreeNcsPerCsfRule(doc)).toHaveLength(0);
    expect(goalTreeNcDepthRule(doc)).toHaveLength(0);
    expect(goalTreeJunctorRule(doc)).toHaveLength(0);
  });
});
