import { describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity } from '../helpers';

const RULE = 'logic-type-mismatch';

// NOTE: we deliberately do NOT call resetIds() between tests. `validate()` is
// memoized on a structural fingerprint (see src/domain/fingerprint.ts) that
// does NOT include `edge.kind`. Two docs that differ only in an edge's kind but
// share entity/edge ids therefore collide on the same fingerprint and return
// the prior run's stale warnings. Keeping ids globally unique across this file
// gives every doc a distinct fingerprint so each assertion exercises a real
// rule run. (The omission of `edge.kind` from the fingerprint is reported as a
// suspected bug — these tests are written so as not to depend on it.)

const logicWarnings = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE);

describe('CLR: logic-type-mismatch', () => {
  it('fires on a CRT edge typed necessity (wrong logic for a sufficiency tree)', () => {
    const a = makeEntity({ title: 'Cause' });
    const b = makeEntity({ title: 'Effect' });
    const edge = makeEdge(a.id, b.id, { kind: 'necessity' });
    const warnings = logicWarnings(validate(makeDoc([a, b], [edge], 'crt')));

    expect(warnings).toHaveLength(1);
    const w = warnings[0]!;
    expect(w.target).toEqual({ kind: 'edge', id: edge.id });
    expect(w.tier).toBe('clarity');
    // Message names the expected logic, its reading, and the offending kind.
    expect(w.message).toBe(
      'This diagram reads in sufficiency logic "X exists, therefore Y", but this link is typed necessity — check that it reads correctly.'
    );
  });

  it('does NOT fire on a CRT edge typed sufficiency (the expected logic)', () => {
    const a = makeEntity({ title: 'Cause' });
    const b = makeEntity({ title: 'Effect' });
    const edge = makeEdge(a.id, b.id, { kind: 'sufficiency' });
    const warnings = logicWarnings(validate(makeDoc([a, b], [edge], 'crt')));

    expect(warnings).toHaveLength(0);
  });

  it('flags every wrong-kind edge independently, one warning each', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const ok = makeEdge(a.id, b.id, { kind: 'sufficiency' });
    const bad1 = makeEdge(b.id, c.id, { kind: 'necessity' });
    const bad2 = makeEdge(a.id, c.id, { kind: 'necessity' });
    const warnings = logicWarnings(validate(makeDoc([a, b, c], [ok, bad1, bad2], 'crt')));

    expect(warnings).toHaveLength(2);
    const flaggedIds = warnings.map((w) => (w.target.kind === 'edge' ? w.target.id : null)).sort();
    expect(flaggedIds).toEqual([bad1.id, bad2.id].sort());
    // The well-typed edge is never targeted.
    expect(flaggedIds).not.toContain(ok.id);
  });

  it('does NOT fire when all CRT edges are correctly typed sufficiency', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const e1 = makeEdge(a.id, b.id, { kind: 'sufficiency' });
    const e2 = makeEdge(b.id, c.id, { kind: 'sufficiency' });
    const warnings = logicWarnings(validate(makeDoc([a, b, c], [e1, e2], 'crt')));

    expect(warnings).toHaveLength(0);
  });

  it('does NOT fire on an edgeless CRT', () => {
    const a = makeEntity({ title: 'A' });
    const warnings = logicWarnings(validate(makeDoc([a], [], 'crt')));
    expect(warnings).toHaveLength(0);
  });

  it('uses the document target id, not the source/target entity ids', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const edge = makeEdge(a.id, b.id, { kind: 'necessity' });
    const warnings = logicWarnings(validate(makeDoc([a, b], [edge], 'crt')));

    expect(warnings).toHaveLength(1);
    const w = warnings[0]!;
    expect(w.target.kind).toBe('edge');
    if (w.target.kind === 'edge') {
      expect(w.target.id).toBe(edge.id);
      expect(w.target.id).not.toBe(a.id);
      expect(w.target.id).not.toBe(b.id);
    }
  });
});
