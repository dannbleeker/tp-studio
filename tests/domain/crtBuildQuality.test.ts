import { beforeEach, describe, expect, it } from 'vitest';
import {
  crtLowCoreDriverCoverageRule,
  crtTiedCoreDriversRule,
} from '@/domain/validators/crtCoreDriverChecks';
import { crtDeadBranchRule } from '@/domain/validators/crtDeadBranch';
import { crtUdeCountRule } from '@/domain/validators/crtUdeCount';
import { crtUdeNoUpstreamRule } from '@/domain/validators/crtUdeNoUpstream';
import { crtUdeWordingRule } from '@/domain/validators/crtUdeWording';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 179 (Theme B) — CRT build-quality soft warnings, derived from the
 * external CRT-construction literature (docs/EXTERNAL_TP_SOURCE_REVIEW.md).
 */
beforeEach(resetIds);

describe('crtDeadBranchRule', () => {
  it('does not fire on non-CRT diagrams', () => {
    const a = makeEntity({ type: 'effect', title: 'A' });
    expect(crtDeadBranchRule(makeDoc([a], [], 'frt'))).toEqual([]);
  });

  it('does not fire when the tree has no UDEs yet', () => {
    const a = makeEntity({ type: 'effect', title: 'A' });
    const b = makeEntity({ type: 'rootCause', title: 'B' });
    expect(crtDeadBranchRule(makeDoc([a, b], [], 'crt'))).toEqual([]);
  });

  it('flags an entity that reaches no UDE', () => {
    const rc = makeEntity({ type: 'rootCause', title: 'RC' });
    const ude = makeEntity({ type: 'ude', title: 'UDE' });
    const orphan = makeEntity({ type: 'effect', title: 'Orphan' });
    const w = crtDeadBranchRule(makeDoc([rc, ude, orphan], [makeEdge(rc.id, ude.id)], 'crt'));
    expect(w).toHaveLength(1);
    expect(w[0]?.target).toEqual({ kind: 'entity', id: orphan.id });
  });

  it('does not flag entities on a path to a UDE', () => {
    const rc = makeEntity({ type: 'rootCause', title: 'RC' });
    const mid = makeEntity({ type: 'effect', title: 'Mid' });
    const ude = makeEntity({ type: 'ude', title: 'UDE' });
    const doc = makeDoc([rc, mid, ude], [makeEdge(rc.id, mid.id), makeEdge(mid.id, ude.id)], 'crt');
    expect(crtDeadBranchRule(doc)).toEqual([]);
  });
});

describe('crtUdeNoUpstreamRule', () => {
  it('fires on a UDE with no incoming cause', () => {
    const ude = makeEntity({ type: 'ude', title: 'Lonely UDE' });
    const w = crtUdeNoUpstreamRule(makeDoc([ude], [], 'crt'));
    expect(w).toHaveLength(1);
    expect(w[0]?.target).toEqual({ kind: 'entity', id: ude.id });
  });

  it('does not fire once the UDE has a cause', () => {
    const rc = makeEntity({ type: 'rootCause', title: 'RC' });
    const ude = makeEntity({ type: 'ude', title: 'UDE' });
    expect(crtUdeNoUpstreamRule(makeDoc([rc, ude], [makeEdge(rc.id, ude.id)], 'crt'))).toEqual([]);
  });

  it('does not fire on non-CRT diagrams', () => {
    const ude = makeEntity({ type: 'ude', title: 'UDE' });
    expect(crtUdeNoUpstreamRule(makeDoc([ude], [], 'frt'))).toEqual([]);
  });
});

describe('crtLowCoreDriverCoverageRule', () => {
  it('fires when the leading root cause explains < half the UDEs', () => {
    const rc1 = makeEntity({ type: 'rootCause', title: 'RC1' });
    const rc2 = makeEntity({ type: 'rootCause', title: 'RC2' });
    const rc3 = makeEntity({ type: 'rootCause', title: 'RC3' });
    const u1 = makeEntity({ type: 'ude', title: 'U1' });
    const u2 = makeEntity({ type: 'ude', title: 'U2' });
    const u3 = makeEntity({ type: 'ude', title: 'U3' });
    const doc = makeDoc(
      [rc1, rc2, rc3, u1, u2, u3],
      [makeEdge(rc1.id, u1.id), makeEdge(rc2.id, u2.id), makeEdge(rc3.id, u3.id)],
      'crt'
    );
    const w = crtLowCoreDriverCoverageRule(doc);
    expect(w).toHaveLength(1);
    expect(w[0]?.message).toMatch(/of 3 UDEs/);
  });

  it('does not fire when one root cause dominates', () => {
    const rc = makeEntity({ type: 'rootCause' });
    const u1 = makeEntity({ type: 'ude' });
    const u2 = makeEntity({ type: 'ude' });
    const u3 = makeEntity({ type: 'ude' });
    const doc = makeDoc(
      [rc, u1, u2, u3],
      [makeEdge(rc.id, u1.id), makeEdge(rc.id, u2.id), makeEdge(rc.id, u3.id)],
      'crt'
    );
    expect(crtLowCoreDriverCoverageRule(doc)).toEqual([]);
  });

  it('does not fire with fewer than 3 UDEs', () => {
    const rc1 = makeEntity({ type: 'rootCause' });
    const rc2 = makeEntity({ type: 'rootCause' });
    const u1 = makeEntity({ type: 'ude' });
    const u2 = makeEntity({ type: 'ude' });
    const doc = makeDoc(
      [rc1, rc2, u1, u2],
      [makeEdge(rc1.id, u1.id), makeEdge(rc2.id, u2.id)],
      'crt'
    );
    expect(crtLowCoreDriverCoverageRule(doc)).toEqual([]);
  });

  it('does not fire on non-CRT diagrams', () => {
    const rc = makeEntity({ type: 'rootCause' });
    const u1 = makeEntity({ type: 'ude' });
    const u2 = makeEntity({ type: 'ude' });
    const u3 = makeEntity({ type: 'ude' });
    // Would fire on a CRT (1 of 3 UDEs); the diagram-type guard suppresses it on FRT.
    const doc = makeDoc([rc, u1, u2, u3], [makeEdge(rc.id, u1.id)], 'frt');
    expect(crtLowCoreDriverCoverageRule(doc)).toEqual([]);
  });
});

describe('crtTiedCoreDriversRule', () => {
  it('fires when two root causes tie for the most UDEs', () => {
    const rc1 = makeEntity({ type: 'rootCause', title: 'RC1' });
    const rc2 = makeEntity({ type: 'rootCause', title: 'RC2' });
    const u1 = makeEntity({ type: 'ude' });
    const u2 = makeEntity({ type: 'ude' });
    const doc = makeDoc(
      [rc1, rc2, u1, u2],
      [
        makeEdge(rc1.id, u1.id),
        makeEdge(rc1.id, u2.id),
        makeEdge(rc2.id, u1.id),
        makeEdge(rc2.id, u2.id),
      ],
      'crt'
    );
    const w = crtTiedCoreDriversRule(doc);
    expect(w).toHaveLength(1);
    expect(w[0]?.message).toMatch(/Two root causes/);
  });

  it('does not fire when one root cause leads', () => {
    const rc1 = makeEntity({ type: 'rootCause' });
    const rc2 = makeEntity({ type: 'rootCause' });
    const u1 = makeEntity({ type: 'ude' });
    const u2 = makeEntity({ type: 'ude' });
    const doc = makeDoc(
      [rc1, rc2, u1, u2],
      [makeEdge(rc1.id, u1.id), makeEdge(rc1.id, u2.id), makeEdge(rc2.id, u1.id)],
      'crt'
    );
    expect(crtTiedCoreDriversRule(doc)).toEqual([]);
  });

  it('does not fire on a trivial 1-UDE-each tie', () => {
    const rc1 = makeEntity({ type: 'rootCause' });
    const rc2 = makeEntity({ type: 'rootCause' });
    const u1 = makeEntity({ type: 'ude' });
    const u2 = makeEntity({ type: 'ude' });
    const doc = makeDoc(
      [rc1, rc2, u1, u2],
      [makeEdge(rc1.id, u1.id), makeEdge(rc2.id, u2.id)],
      'crt'
    );
    expect(crtTiedCoreDriversRule(doc)).toEqual([]);
  });

  it('does not fire on non-CRT diagrams', () => {
    const rc1 = makeEntity({ type: 'rootCause' });
    const rc2 = makeEntity({ type: 'rootCause' });
    const u1 = makeEntity({ type: 'ude' });
    const u2 = makeEntity({ type: 'ude' });
    const doc = makeDoc(
      [rc1, rc2, u1, u2],
      [
        makeEdge(rc1.id, u1.id),
        makeEdge(rc1.id, u2.id),
        makeEdge(rc2.id, u1.id),
        makeEdge(rc2.id, u2.id),
      ],
      'frt'
    );
    expect(crtTiedCoreDriversRule(doc)).toEqual([]);
  });
});

describe('crtUdeWordingRule', () => {
  it('flags absence-of-solution phrasing', () => {
    const u = makeEntity({ type: 'ude', title: 'Lack of clear ownership' });
    expect(crtUdeWordingRule(makeDoc([u], [], 'crt'))).toHaveLength(1);
  });

  it('flags a leading "No ..."', () => {
    const u = makeEntity({ type: 'ude', title: 'No documented process' });
    expect(crtUdeWordingRule(makeDoc([u], [], 'crt'))).toHaveLength(1);
  });

  it('does not flag a concrete observable effect', () => {
    const u = makeEntity({ type: 'ude', title: 'Customers wait three weeks for a reply' });
    expect(crtUdeWordingRule(makeDoc([u], [], 'crt'))).toEqual([]);
  });

  it('does not match "Nobody" (word boundary)', () => {
    const u = makeEntity({ type: 'ude', title: 'Nobody owns the backlog' });
    expect(crtUdeWordingRule(makeDoc([u], [], 'crt'))).toEqual([]);
  });

  it('does not fire on non-CRT diagrams', () => {
    const u = makeEntity({ type: 'ude', title: 'Lack of ownership' });
    expect(crtUdeWordingRule(makeDoc([u], [], 'frt'))).toEqual([]);
  });
});

describe('crtUdeCountRule', () => {
  it('fires when there are fewer than 3 UDEs', () => {
    const u1 = makeEntity({ type: 'ude' });
    const u2 = makeEntity({ type: 'ude' });
    const w = crtUdeCountRule(makeDoc([u1, u2], [], 'crt'));
    expect(w).toHaveLength(1);
    expect(w[0]?.message).toMatch(/fewer than 3/);
  });

  it('does not fire with 3 UDEs', () => {
    const us = [
      makeEntity({ type: 'ude' }),
      makeEntity({ type: 'ude' }),
      makeEntity({ type: 'ude' }),
    ];
    expect(crtUdeCountRule(makeDoc(us, [], 'crt'))).toEqual([]);
  });

  it('fires when there are more than 15 UDEs', () => {
    const us = Array.from({ length: 16 }, () => makeEntity({ type: 'ude' }));
    const w = crtUdeCountRule(makeDoc(us, [], 'crt'));
    expect(w).toHaveLength(1);
    expect(w[0]?.message).toMatch(/more than 15/);
  });

  it('does not fire on an empty CRT', () => {
    expect(crtUdeCountRule(makeDoc([], [], 'crt'))).toEqual([]);
  });

  it('does not fire on non-CRT diagrams', () => {
    // A single UDE would trip "fewer than 3" on a CRT; the guard suppresses it on FRT.
    expect(crtUdeCountRule(makeDoc([makeEntity({ type: 'ude' })], [], 'frt'))).toEqual([]);
  });
});
