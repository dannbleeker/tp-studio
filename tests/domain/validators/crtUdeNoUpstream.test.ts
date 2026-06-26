import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

const RULE_ID = 'crt-ude-no-upstream';

const ofRule = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE_ID);

beforeEach(() => {
  resetIds();
});

describe('CLR: crt-ude-no-upstream', () => {
  it('fires for a UDE with no incoming edge — exact target, kind, and message', () => {
    const ude = makeEntity({ type: 'ude', title: 'Sales declined' });
    const warnings = validate(makeDoc([ude], [], 'crt'));
    const hits = ofRule(warnings);

    expect(hits).toHaveLength(1);
    const w = hits[0]!;
    expect(w.target).toEqual({ kind: 'entity', id: ude.id });
    expect(w.message).toBe(
      'UDE "Sales declined" has no cause feeding it — the tree is incomplete until it connects to the causal chain.'
    );
  });

  it('does NOT fire when the UDE has an incoming causal edge', () => {
    const cause = makeEntity({ type: 'effect', title: 'Process is slow' });
    const ude = makeEntity({ type: 'ude', title: 'Sales declined' });
    const edge = makeEdge(cause.id, ude.id);
    const warnings = validate(makeDoc([cause, ude], [edge], 'crt'));

    expect(ofRule(warnings)).toHaveLength(0);
  });

  it('fires for a UDE drawn as a cause (outgoing but no incoming edge)', () => {
    // The key case from the docstring: a UDE with only an OUTGOING edge
    // slips past the generic disconnected-entity check but is caught here.
    const ude = makeEntity({ type: 'ude', title: 'Sales declined' });
    const downstream = makeEntity({ type: 'effect', title: 'Layoffs follow' });
    const edge = makeEdge(ude.id, downstream.id);
    const warnings = validate(makeDoc([ude, downstream], [edge], 'crt'));
    const hits = ofRule(warnings);

    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: ude.id });
  });

  it('counts any edge kind as upstream (non-sufficiency edge suppresses the warning)', () => {
    const cause = makeEntity({ type: 'effect', title: 'Process is slow' });
    const ude = makeEntity({ type: 'ude', title: 'Sales declined' });
    // The rule keys purely on incoming-edge presence, not edge.kind.
    const edge = makeEdge(cause.id, ude.id, { kind: 'necessity' });
    const warnings = validate(makeDoc([cause, ude], [edge], 'crt'));

    expect(ofRule(warnings)).toHaveLength(0);
  });

  it('emits one warning per unfed UDE and skips the fed one', () => {
    const fedUde = makeEntity({ type: 'ude', title: 'Fed UDE' });
    const cause = makeEntity({ type: 'effect', title: 'A cause' });
    const unfedA = makeEntity({ type: 'ude', title: 'Unfed A' });
    const unfedB = makeEntity({ type: 'ude', title: 'Unfed B' });
    const edge = makeEdge(cause.id, fedUde.id);
    const warnings = validate(makeDoc([fedUde, cause, unfedA, unfedB], [edge], 'crt'));
    const hits = ofRule(warnings);

    expect(hits).toHaveLength(2);
    const targetIds = hits.map((w) => w.target.kind === 'entity' && w.target.id).sort();
    expect(targetIds).toEqual([unfedA.id, unfedB.id].sort());
  });

  it('only flags UDE-typed entities, not other unfed types', () => {
    // An unfed effect / root cause is not this rule's concern.
    const effect = makeEntity({ type: 'effect', title: 'Unfed effect' });
    const root = makeEntity({ type: 'rootCause', title: 'A root cause' });
    const warnings = validate(makeDoc([effect, root], [], 'crt'));

    expect(ofRule(warnings)).toHaveLength(0);
  });

  it('does NOT fire on a non-CRT diagram even with an unfed UDE', () => {
    const ude = makeEntity({ type: 'ude', title: 'Sales declined' });
    // Same shape that fires on a CRT, but diagramType is frt.
    const warnings = validate(makeDoc([ude], [], 'frt'));

    expect(ofRule(warnings)).toHaveLength(0);
  });

  it('uses the (untitled) fallback in the message for a blank-title UDE', () => {
    const ude = makeEntity({ type: 'ude', title: '   ' });
    const warnings = validate(makeDoc([ude], [], 'crt'));
    const hits = ofRule(warnings);

    expect(hits).toHaveLength(1);
    expect(hits[0]!.message).toBe(
      'UDE "(untitled)" has no cause feeding it — the tree is incomplete until it connects to the causal chain.'
    );
  });

  it('does not produce the warning when the doc has no UDEs at all', () => {
    const a = makeEntity({ type: 'effect', title: 'A' });
    const b = makeEntity({ type: 'effect', title: 'B' });
    const edge = makeEdge(a.id, b.id);
    const warnings = validate(makeDoc([a, b], [edge], 'crt'));

    expect(ofRule(warnings)).toHaveLength(0);
  });
});
