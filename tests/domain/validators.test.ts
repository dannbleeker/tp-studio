import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '../../src/domain/validators';
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
    expect(causality[0].resolved).toBe(false);
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

  it('does not warn when a UDE has at least one cause', () => {
    const cause = makeEntity({ title: 'Slow shipping' });
    const ude = makeEntity({ type: 'ude', title: 'Customer churn' });
    const e = makeEdge(cause.id, ude.id);
    const warnings = validate(makeDoc([cause, ude], [e], 'crt'));
    expect(hasRule(warnings, 'additional-cause')).toBe(false);
  });

  it('targets desiredEffect on FRT, not UDE', () => {
    const de = makeEntity({ type: 'desiredEffect', title: 'Customers stay' });
    const warnings = validate(makeDoc([de], [], 'frt'));
    expect(hasRule(warnings, 'additional-cause')).toBe(true);
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
