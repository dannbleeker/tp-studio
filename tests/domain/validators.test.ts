import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(() => {
  resetIds();
});

const hasRule = (warnings: ReturnType<typeof validate>, ruleId: string): boolean =>
  warnings.some((w) => w.ruleId === ruleId);

describe('CLR: clarity', () => {
  it('warns when title is over 25 words', () => {
    const longTitle = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');
    const e = makeEntity({ title: longTitle });
    const warnings = validate(makeDoc([e], []));
    expect(hasRule(warnings, 'clarity')).toBe(true);
  });

  it('warns when title ends in a question mark', () => {
    const e = makeEntity({ title: 'Is the system broken?' });
    const warnings = validate(makeDoc([e], []));
    expect(hasRule(warnings, 'clarity')).toBe(true);
  });

  it('does not warn on a normal declarative title', () => {
    const e = makeEntity({ title: 'Sales declined this quarter.' });
    const warnings = validate(makeDoc([e], []));
    expect(hasRule(warnings, 'clarity')).toBe(false);
  });
});

describe('CLR: entity existence', () => {
  it('warns when title is empty', () => {
    const e = makeEntity({ title: '   ' });
    const warnings = validate(makeDoc([e], []));
    expect(hasRule(warnings, 'entity-existence')).toBe(true);
  });

  it('warns on disconnected entity once graph is non-trivial', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const d = makeEntity({ title: 'D' });
    const ab = makeEdge(a.id, b.id);
    const bc = makeEdge(b.id, c.id);
    // d is disconnected; graph size > 3
    const warnings = validate(makeDoc([a, b, c, d], [ab, bc]));
    const disconnected = warnings.filter(
      (w) => w.ruleId === 'entity-existence' && w.target.kind === 'entity' && w.target.id === d.id
    );
    expect(disconnected.length).toBe(1);
  });

  it('does not warn on disconnected entity in trivial graph (≤3 nodes)', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const warnings = validate(makeDoc([a, b], []));
    expect(hasRule(warnings, 'entity-existence')).toBe(false);
  });
});

describe('CLR: causality existence', () => {
  it('emits one warning per edge by default', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const e = makeEdge(a.id, b.id);
    const warnings = validate(makeDoc([a, b], [e]));
    const causality = warnings.filter((w) => w.ruleId === 'causality-existence');
    expect(causality.length).toBe(1);
    expect(causality[0]!.resolved).toBe(false);
  });

  it('marks the warning resolved when user has dismissed it', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const e = makeEdge(a.id, b.id);
    const warningId = `causality-existence:edge:${e.id}`;
    const doc = makeDoc([a, b], [e], 'crt', { [warningId]: true });
    const warnings = validate(doc);
    const causality = warnings.find((w) => w.ruleId === 'causality-existence');
    expect(causality?.resolved).toBe(true);
  });
});

describe('CLR: cause sufficiency', () => {
  it('warns when a target has a single non-AND incoming edge', () => {
    const a = makeEntity({ title: 'Cause' });
    const b = makeEntity({ title: 'Effect' });
    const e = makeEdge(a.id, b.id);
    const warnings = validate(makeDoc([a, b], [e]));
    expect(hasRule(warnings, 'cause-sufficiency')).toBe(true);
  });

  it('does not warn when edges are grouped via andGroupId', () => {
    const a = makeEntity({ title: 'Cause A' });
    const b = makeEntity({ title: 'Cause B' });
    const c = makeEntity({ title: 'Effect' });
    const ac = makeEdge(a.id, c.id, { andGroupId: 'g1' });
    const bc = makeEdge(b.id, c.id, { andGroupId: 'g1' });
    const warnings = validate(makeDoc([a, b, c], [ac, bc]));
    expect(hasRule(warnings, 'cause-sufficiency')).toBe(false);
  });
});

describe('CLR: additional cause', () => {
  it('warns when a CRT UDE has no incoming causes', () => {
    const ude = makeEntity({ type: 'ude', title: 'Customer churn' });
    const warnings = validate(makeDoc([ude], [], 'crt'));
    expect(hasRule(warnings, 'additional-cause')).toBe(true);
  });

  it('warns (additional-cause reservation) when a UDE has exactly one ungrouped cause', () => {
    const cause = makeEntity({ title: 'Slow shipping' });
    const ude = makeEntity({ type: 'ude', title: 'Customer churn' });
    const e = makeEdge(cause.id, ude.id);
    const hits = validate(makeDoc([cause, ude], [e], 'crt')).filter(
      (w) => w.ruleId === 'additional-cause'
    );
    // The real reservation: a single stated cause should prompt "could a
    // different independent cause also produce this?" (previously silent).
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: ude.id });
  });

  it('self-silences once a second cause is added (alternatives now present)', () => {
    const c1 = makeEntity({ title: 'Slow shipping' });
    const c2 = makeEntity({ title: 'Poor support' });
    const ude = makeEntity({ type: 'ude', title: 'Customer churn' });
    const edges = [makeEdge(c1.id, ude.id), makeEdge(c2.id, ude.id)];
    const warnings = validate(makeDoc([c1, c2, ude], edges, 'crt'));
    expect(hasRule(warnings, 'additional-cause')).toBe(false);
  });

  it('self-silences when the single cause is OR-grouped (alternative already modeled)', () => {
    const cause = makeEntity({ title: 'Slow shipping' });
    const ude = makeEntity({ type: 'ude', title: 'Customer churn' });
    const e = makeEdge(cause.id, ude.id, { orGroupId: 'or-1' });
    const warnings = validate(makeDoc([cause, ude], [e], 'crt'));
    expect(hasRule(warnings, 'additional-cause')).toBe(false);
  });

  it('targets desiredEffect on FRT, not UDE', () => {
    const de = makeEntity({ type: 'desiredEffect', title: 'Customers stay' });
    const warnings = validate(makeDoc([de], [], 'frt'));
    expect(hasRule(warnings, 'additional-cause')).toBe(true);
  });

  it('covers custom entity classes via supersetOf (entitiesOfBuiltin matching)', () => {
    const risk = makeEntity({ type: 'site-risk' as never, title: 'Custom causeless UDE' });
    const doc = {
      ...makeDoc([risk], [], 'crt'),
      customEntityClasses: {
        'site-risk': { id: 'site-risk', label: 'Site Risk', supersetOf: 'ude' as const },
      },
    };
    const hits = validate(doc).filter((w) => w.ruleId === 'additional-cause');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: risk.id });
  });

  it('targets BOTH ude and desiredEffect on NBR (Session 181 — the S134 comment finally built)', () => {
    const ude = makeEntity({ type: 'ude', title: 'Competitor ships first' });
    const de = makeEntity({ type: 'desiredEffect', title: 'Fewer bugs slip through' });
    const warnings = validate(makeDoc([ude, de], [], 'nbr'));
    const hits = warnings.filter((w) => w.ruleId === 'additional-cause');
    expect(hits.map((w) => (w.target.kind === 'entity' ? w.target.id : '')).sort()).toEqual(
      [ude.id, de.id].sort()
    );
  });
});

describe('CLR: cause-effect reversal', () => {
  it('warns when a CRT rootCause has incoming edges', () => {
    const a = makeEntity({ title: 'Something' });
    const rc = makeEntity({ type: 'rootCause', title: 'Root cause' });
    const e = makeEdge(a.id, rc.id);
    const warnings = validate(makeDoc([a, rc], [e], 'crt'));
    expect(hasRule(warnings, 'cause-effect-reversal')).toBe(true);
  });

  it('warns when a CRT UDE has outgoing edges', () => {
    const ude = makeEntity({ type: 'ude', title: 'UDE' });
    const other = makeEntity({ title: 'Something else' });
    const e = makeEdge(ude.id, other.id);
    const warnings = validate(makeDoc([ude, other], [e], 'crt'));
    expect(hasRule(warnings, 'cause-effect-reversal')).toBe(true);
  });

  it('does not warn on FRT (rule is CRT-only)', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const e = makeEdge(a.id, b.id);
    const warnings = validate(makeDoc([a, b], [e], 'frt'));
    expect(hasRule(warnings, 'cause-effect-reversal')).toBe(false);
  });
});

describe('CLR: predicted-effect existence', () => {
  it('warns when an FRT injection has no outgoing effects', () => {
    const inj = makeEntity({ type: 'injection', title: 'Refund policy' });
    const warnings = validate(makeDoc([inj], [], 'frt'));
    expect(hasRule(warnings, 'predicted-effect-existence')).toBe(true);
  });

  it('does not warn when an injection has at least one outgoing effect', () => {
    const inj = makeEntity({ type: 'injection', title: 'Refund policy' });
    const eff = makeEntity({ type: 'effect', title: 'Customers feel safer' });
    const e = makeEdge(inj.id, eff.id);
    const warnings = validate(makeDoc([inj, eff], [e], 'frt'));
    expect(hasRule(warnings, 'predicted-effect-existence')).toBe(false);
  });
});

describe('CLR: per-diagram dispatch', () => {
  it('applies structural rules (clarity, entity-existence) to PRT', () => {
    const e = makeEntity({ type: 'obstacle', title: 'Is the team blocked?' });
    const warnings = validate(makeDoc([e], [], 'prt'));
    expect(hasRule(warnings, 'clarity')).toBe(true);
  });

  it('applies structural rules (clarity, entity-existence) to TT', () => {
    const e = makeEntity({ type: 'action', title: '   ' });
    const warnings = validate(makeDoc([e], [], 'tt'));
    expect(hasRule(warnings, 'entity-existence')).toBe(true);
  });

  it('does not apply CRT/FRT-only rules to PRT (no cause-effect-reversal)', () => {
    const a = makeEntity({ type: 'intermediateObjective', title: 'IO' });
    const b = makeEntity({ type: 'rootCause', title: 'RC' });
    const e = makeEdge(a.id, b.id);
    const warnings = validate(makeDoc([a, b], [e], 'prt'));
    expect(hasRule(warnings, 'cause-effect-reversal')).toBe(false);
  });

  it('does not apply CRT/FRT-only rules to TT (no additional-cause)', () => {
    const de = makeEntity({ type: 'desiredEffect', title: 'Outcome reached' });
    const warnings = validate(makeDoc([de], [], 'tt'));
    expect(hasRule(warnings, 'additional-cause')).toBe(false);
  });
});

describe('CLR: tautology', () => {
  it('warns when an entity title is nearly identical to its only child', () => {
    const a = makeEntity({ title: 'Sales are declining' });
    const b = makeEntity({ title: 'Sales are declining.' });
    const e = makeEdge(a.id, b.id);
    const warnings = validate(makeDoc([a, b], [e]));
    expect(hasRule(warnings, 'tautology')).toBe(true);
  });

  it('does not warn when titles are semantically different', () => {
    const a = makeEntity({ title: 'Shipping is slow' });
    const b = makeEntity({ title: 'Customers churn at higher rates' });
    const e = makeEdge(a.id, b.id);
    const warnings = validate(makeDoc([a, b], [e]));
    expect(hasRule(warnings, 'tautology')).toBe(false);
  });
});

describe('CLR: indirect-effect (Block C / E2)', () => {
  it('warns when an entity has 3+ direct incoming causes', () => {
    const target = makeEntity({ title: 'Effect' });
    const a = makeEntity({ title: 'Cause A' });
    const b = makeEntity({ title: 'Cause B' });
    const c = makeEntity({ title: 'Cause C' });
    const edges = [makeEdge(a.id, target.id), makeEdge(b.id, target.id), makeEdge(c.id, target.id)];
    const warnings = validate(makeDoc([target, a, b, c], edges));
    const indirect = warnings.filter((w) => w.ruleId === 'indirect-effect');
    expect(indirect).toHaveLength(1);
    expect(indirect[0]?.target).toEqual({ kind: 'entity', id: target.id });
  });

  it('does not warn at 2 incoming edges (common, intentional shape)', () => {
    const target = makeEntity({ title: 'Effect' });
    const a = makeEntity({ title: 'Cause A' });
    const b = makeEntity({ title: 'Cause B' });
    const edges = [makeEdge(a.id, target.id), makeEdge(b.id, target.id)];
    const warnings = validate(makeDoc([target, a, b], edges));
    expect(hasRule(warnings, 'indirect-effect')).toBe(false);
  });

  it('exempts AND-grouped edges from the count', () => {
    const target = makeEntity({ title: 'Effect' });
    const a = makeEntity({ title: 'Cause A' });
    const b = makeEntity({ title: 'Cause B' });
    const c = makeEntity({ title: 'Cause C' });
    const groupId = 'and-1';
    const edges = [
      makeEdge(a.id, target.id, { andGroupId: groupId }),
      makeEdge(b.id, target.id, { andGroupId: groupId }),
      makeEdge(c.id, target.id, { andGroupId: groupId }),
    ];
    // All three are AND-grouped, so ungrouped count is 0; rule should stay silent.
    const warnings = validate(makeDoc([target, a, b, c], edges));
    expect(hasRule(warnings, 'indirect-effect')).toBe(false);
  });

  it('also exempts OR- and XOR-grouped edges (an explicit junctor is a commitment)', () => {
    const target = makeEntity({ title: 'Effect' });
    const a = makeEntity({ title: 'Cause A' });
    const b = makeEntity({ title: 'Cause B' });
    const c = makeEntity({ title: 'Cause C' });
    // A legitimate 3-way OR fan-in (three independent sufficient causes) must
    // NOT trip the rule — the OR is a deliberate model, same as AND.
    const orEdges = [
      makeEdge(a.id, target.id, { orGroupId: 'or-1' }),
      makeEdge(b.id, target.id, { orGroupId: 'or-1' }),
      makeEdge(c.id, target.id, { orGroupId: 'or-1' }),
    ];
    expect(hasRule(validate(makeDoc([target, a, b, c], orEdges)), 'indirect-effect')).toBe(false);

    const xorEdges = [
      makeEdge(a.id, target.id, { xorGroupId: 'xor-1' }),
      makeEdge(b.id, target.id, { xorGroupId: 'xor-1' }),
      makeEdge(c.id, target.id, { xorGroupId: 'xor-1' }),
    ];
    expect(hasRule(validate(makeDoc([target, a, b, c], xorEdges)), 'indirect-effect')).toBe(false);
  });
});

describe('CLR: logic-type-mismatch on EC (necessity logic)', () => {
  it('flags a sufficiency-typed EC support edge but not the D↔D′ mutex link', () => {
    const a = makeEntity({ title: 'D' });
    const b = makeEntity({ title: 'Need' });
    const doc = {
      ...makeDoc([a, b], []),
      diagramType: 'ec' as const,
      edges: {
        support: {
          id: 'support' as never,
          sourceId: b.id,
          targetId: a.id,
          kind: 'sufficiency' as const,
        },
        mutex: {
          id: 'mutex' as never,
          sourceId: a.id,
          targetId: b.id,
          kind: 'sufficiency' as const,
          isMutualExclusion: true,
        },
      },
    };
    const mism = validate(doc).filter((w) => w.ruleId === 'logic-type-mismatch');
    // Only the support edge is held to necessity logic; the mutex edge is exempt.
    expect(mism).toHaveLength(1);
    expect(mism[0]?.target).toEqual({ kind: 'edge', id: 'support' });
  });

  it('stays silent when EC support edges are correctly necessity-typed', () => {
    const a = makeEntity({ title: 'D' });
    const b = makeEntity({ title: 'Need' });
    const doc = {
      ...makeDoc([a, b], []),
      diagramType: 'ec' as const,
      edges: {
        support: {
          id: 'support' as never,
          sourceId: b.id,
          targetId: a.id,
          kind: 'necessity' as const,
        },
      },
    };
    expect(hasRule(validate(doc), 'logic-type-mismatch')).toBe(false);
  });
});

describe('warning tier stamping (Block C / E5)', () => {
  it('every warning carries a tier', () => {
    const a = makeEntity({ title: 'Sales declined this quarter.' });
    const b = makeEntity({ title: '   ' }); // entity-existence fires
    const edges = [makeEdge(a.id, b.id)]; // causality-existence fires
    const warnings = validate(makeDoc([a, b], edges));
    expect(warnings.length).toBeGreaterThan(0);
    for (const w of warnings) {
      expect(['clarity', 'existence', 'sufficiency']).toContain(w.tier);
    }
  });
});
