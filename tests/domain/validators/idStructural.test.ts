import { beforeEach, describe, expect, it } from 'vitest';
import {
  idInterferenceNoIoRule,
  idMultipleCentralObjectivesRule,
} from '@/domain/validators/idStructural';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

beforeEach(resetIds);

describe('ID interference↔IO rule', () => {
  it('flags an interference with no paired intermediate objective', () => {
    const interference = makeEntity({ type: 'obstacle', title: 'Parts are not available' });
    const doc = makeDoc([interference], [], 'id');
    const hits = idInterferenceNoIoRule(doc);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: interference.id });
  });

  it('does not flag an interference that has an IO (IO → interference)', () => {
    const io = makeEntity({ type: 'intermediateObjective', title: 'Kit the parts' });
    const interference = makeEntity({ type: 'obstacle', title: 'Parts are not available' });
    const doc = makeDoc([io, interference], [makeEdge(io.id, interference.id)], 'id');
    expect(idInterferenceNoIoRule(doc)).toHaveLength(0);
  });

  it('is inert on non-ID diagrams (a PRT obstacle is the PRT rule’s job)', () => {
    const interference = makeEntity({ type: 'obstacle', title: 'X' });
    const doc = makeDoc([interference], [], 'prt');
    expect(idInterferenceNoIoRule(doc)).toHaveLength(0);
  });
});

describe('ID central-objective rule', () => {
  it('flags an ID with more than one central objective, anchored on the document', () => {
    const g1 = makeEntity({ type: 'goal', title: 'More throughput' });
    const g2 = makeEntity({ type: 'goal', title: 'Fewer defects' });
    const doc = makeDoc([g1, g2], [], 'id');
    const hits = idMultipleCentralObjectivesRule(doc);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'document' });
  });

  it('is silent with exactly one objective', () => {
    const g1 = makeEntity({ type: 'goal', title: 'More throughput' });
    const doc = makeDoc([g1], [], 'id');
    expect(idMultipleCentralObjectivesRule(doc)).toHaveLength(0);
  });

  it('is silent with no objective (a fresh / empty ID should not nag)', () => {
    const doc = makeDoc([], [], 'id');
    expect(idMultipleCentralObjectivesRule(doc)).toHaveLength(0);
  });

  it('is inert on non-ID diagrams', () => {
    const g1 = makeEntity({ type: 'goal', title: 'A' });
    const g2 = makeEntity({ type: 'goal', title: 'B' });
    const doc = makeDoc([g1, g2], [], 'goalTree');
    expect(idMultipleCentralObjectivesRule(doc)).toHaveLength(0);
  });
});
