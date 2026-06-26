import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

beforeEach(() => {
  resetIds();
});

type Warnings = ReturnType<typeof validate>;
const ofRule = (warnings: Warnings, ruleId: string): Warnings =>
  warnings.filter((w) => w.ruleId === ruleId);

// Both rules in nbrBranchIntegrity.ts only register for the 'nbr' diagram type.
describe('CLR: nbr-no-negative-branch', () => {
  it('fires once on the document when an injection is traced but no UDE exists', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const eff = makeEntity({ type: 'effect', title: 'Queue grows unbounded' });
    const warnings = validate(makeDoc([inj, eff], [makeEdge(inj.id, eff.id)], 'nbr'));

    const fired = ofRule(warnings, 'nbr-no-negative-branch');
    expect(fired.length).toBe(1);
    const w = fired[0]!;
    expect(w.target.kind).toBe('document');
    // A document-target warning carries no entity id.
    expect(w.target).toEqual({ kind: 'document' });
    expect(w.message).toContain('No undesirable effect captured yet');
    expect(w.message).toContain('this still reads as an FRT');
  });

  it('stays silent once at least one UDE is present (kills the ude>0 guard)', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const eff = makeEntity({ type: 'effect', title: 'Queue grows' });
    const ude = makeEntity({ type: 'ude', title: 'Customers see stale data' });
    // Injection still has an outgoing edge — only the presence of a UDE suppresses it.
    const warnings = validate(makeDoc([inj, eff, ude], [makeEdge(inj.id, eff.id)], 'nbr'));
    expect(ofRule(warnings, 'nbr-no-negative-branch').length).toBe(0);
  });

  it('stays silent when the injection has no outgoing edge (no trace started)', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const other = makeEntity({ type: 'effect', title: 'Unrelated note' });
    // Edge does NOT originate at the injection, so no injection is "tracing".
    const warnings = validate(makeDoc([inj, other], [makeEdge(other.id, inj.id)], 'nbr'));
    expect(ofRule(warnings, 'nbr-no-negative-branch').length).toBe(0);
  });

  it('stays silent with a lone injection and no edges at all', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const warnings = validate(makeDoc([inj], [], 'nbr'));
    expect(ofRule(warnings, 'nbr-no-negative-branch').length).toBe(0);
  });

  it('does not fire on a non-nbr diagram even with the triggering shape', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const eff = makeEntity({ type: 'effect', title: 'Queue grows' });
    const warnings = validate(makeDoc([inj, eff], [makeEdge(inj.id, eff.id)], 'frt'));
    expect(ofRule(warnings, 'nbr-no-negative-branch').length).toBe(0);
  });
});

describe('CLR: nbr-ude-disconnected', () => {
  it('fires on a UDE with incoming edges that does not trace back to an injection', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const traced = makeEntity({ type: 'effect', title: 'Retries fire' });
    // The injection's branch goes inj -> traced, nowhere near the UDE.
    const cause = makeEntity({ type: 'effect', title: 'Unrelated overload' });
    const ude = makeEntity({ type: 'ude', title: 'Customers see stale data' });
    const warnings = validate(
      makeDoc(
        [inj, traced, cause, ude],
        // cause -> ude gives the UDE an incoming edge but no path from the injection.
        [makeEdge(inj.id, traced.id), makeEdge(cause.id, ude.id)],
        'nbr'
      )
    );

    const fired = ofRule(warnings, 'nbr-ude-disconnected');
    expect(fired.length).toBe(1);
    const w = fired[0]!;
    expect(w.target.kind).toBe('entity');
    expect(w.target.kind === 'entity' && w.target.id).toBe(ude.id);
    expect(w.message).toContain('Customers see stale data');
    expect(w.message).toContain("doesn't trace back to the candidate injection");
    expect(w.message).toContain('injection → … → UDE');
  });

  it('does not fire when the UDE is reachable forward from the injection', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const mid = makeEntity({ type: 'effect', title: 'Queue grows' });
    const ude = makeEntity({ type: 'ude', title: 'Customers see stale data' });
    // inj -> mid -> ude: the UDE traces back to the injection.
    const warnings = validate(
      makeDoc([inj, mid, ude], [makeEdge(inj.id, mid.id), makeEdge(mid.id, ude.id)], 'nbr')
    );
    expect(ofRule(warnings, 'nbr-ude-disconnected').length).toBe(0);
  });

  it('fires when only the closing hop is reversed (direction matters, not mere adjacency)', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const mid = makeEntity({ type: 'effect', title: 'Queue grows' });
    const ude = makeEntity({ type: 'ude', title: 'Customers see stale data' });
    // inj -> mid, and ude -> mid (UDE points INTO mid). The UDE still has an
    // incoming edge of its own? No — give it one so it isn't skipped, but the
    // path from the injection never reaches it.
    const feeder = makeEntity({ type: 'effect', title: 'Spike' });
    const warnings = validate(
      makeDoc(
        [inj, mid, ude, feeder],
        [makeEdge(inj.id, mid.id), makeEdge(feeder.id, ude.id), makeEdge(ude.id, mid.id)],
        'nbr'
      )
    );
    const fired = ofRule(warnings, 'nbr-ude-disconnected');
    expect(fired.length).toBe(1);
    expect(fired[0]!.target.kind === 'entity' && fired[0]!.target.id).toBe(ude.id);
  });

  it('skips a UDE that has no incoming edges at all (additional-cause owns that gap)', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const eff = makeEntity({ type: 'effect', title: 'Queue grows' });
    // ude is wired only as a SOURCE (outgoing), so it has zero incoming edges.
    const ude = makeEntity({ type: 'ude', title: 'Customers see stale data' });
    const sink = makeEntity({ type: 'effect', title: 'Downstream effect' });
    const warnings = validate(
      makeDoc([inj, eff, ude, sink], [makeEdge(inj.id, eff.id), makeEdge(ude.id, sink.id)], 'nbr')
    );
    expect(ofRule(warnings, 'nbr-ude-disconnected').length).toBe(0);
  });

  it('stays silent for a disconnected UDE when the doc has no injection at all', () => {
    const cause = makeEntity({ type: 'effect', title: 'Unrelated overload' });
    const ude = makeEntity({ type: 'ude', title: 'Customers see stale data' });
    // UDE has an incoming edge and no injection exists -> the rule is silent.
    const warnings = validate(makeDoc([cause, ude], [makeEdge(cause.id, ude.id)], 'nbr'));
    expect(ofRule(warnings, 'nbr-ude-disconnected').length).toBe(0);
  });

  it('emits one warning per offending UDE, each targeting its own entity', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const c1 = makeEntity({ type: 'effect', title: 'Cause one' });
    const c2 = makeEntity({ type: 'effect', title: 'Cause two' });
    const ude1 = makeEntity({ type: 'ude', title: 'Stale data' });
    const ude2 = makeEntity({ type: 'ude', title: 'Lost orders' });
    const warnings = validate(
      makeDoc(
        [inj, c1, c2, ude1, ude2],
        [makeEdge(c1.id, ude1.id), makeEdge(c2.id, ude2.id)],
        'nbr'
      )
    );
    const fired = ofRule(warnings, 'nbr-ude-disconnected');
    expect(fired.length).toBe(2);
    const targetIds = fired
      .map((w) => (w.target.kind === 'entity' ? w.target.id : undefined))
      .sort();
    expect(targetIds).toEqual([ude1.id, ude2.id].sort());
  });

  it('falls back to "(untitled)" in the message for an empty-title UDE', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const cause = makeEntity({ type: 'effect', title: 'Overload' });
    const ude = makeEntity({ type: 'ude', title: '   ' });
    const warnings = validate(makeDoc([inj, cause, ude], [makeEdge(cause.id, ude.id)], 'nbr'));
    const fired = ofRule(warnings, 'nbr-ude-disconnected');
    expect(fired.length).toBe(1);
    expect(fired[0]!.message).toContain('"(untitled)"');
  });

  it('does not fire on a non-nbr diagram even with a disconnected UDE', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add automated retries' });
    const cause = makeEntity({ type: 'effect', title: 'Overload' });
    const ude = makeEntity({ type: 'ude', title: 'Stale data' });
    const warnings = validate(makeDoc([inj, cause, ude], [makeEdge(cause.id, ude.id)], 'crt'));
    expect(ofRule(warnings, 'nbr-ude-disconnected').length).toBe(0);
  });
});
