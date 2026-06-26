import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

/**
 * crt-dead-branch — flags a non-UDE structural entity that doesn't
 * transitively reach any UDE (Dettmer's CRT "trim scaffolding" rule).
 *
 * Triggers (all required):
 *   - doc.diagramType === 'crt'
 *   - at least one entity of type 'ude' exists
 *   - the entity is structural (not a 'note'), is NOT itself a 'ude',
 *     and none of its forward-reachable entities is a 'ude'.
 */

const RULE = 'crt-dead-branch';

beforeEach(() => {
  resetIds();
});

const deadBranchWarnings = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE);

describe('crt-dead-branch', () => {
  it('does not fire when the diagram has no UDE entities', () => {
    // A dangling rootCause that leads nowhere — but with no UDE in the
    // tree every entity would read as "dead", so the rule stays silent.
    const rc = makeEntity({ type: 'rootCause', title: 'Lonely cause' });
    const eff = makeEntity({ type: 'effect', title: 'Effect' });
    const warnings = validate(makeDoc([rc, eff], [], 'crt'));
    expect(deadBranchWarnings(warnings)).toHaveLength(0);
  });

  it('fires for a structural entity that does not reach any UDE', () => {
    const ude = makeEntity({ type: 'ude', title: 'Customers churn' });
    // dead is a rootCause that points to a non-UDE leaf — it never reaches a UDE.
    const dead = makeEntity({ type: 'rootCause', title: 'Stale pricing model' });
    const leaf = makeEntity({ type: 'effect', title: 'Some side effect' });
    const edge = makeEdge(dead.id, leaf.id);
    const warnings = validate(makeDoc([ude, dead, leaf], [edge], 'crt'));

    const deadBranch = deadBranchWarnings(warnings);
    // Both `dead` and `leaf` are non-UDE entities that reach no UDE.
    const targetIds = deadBranch.map((w) => (w.target.kind === 'entity' ? w.target.id : null));
    expect(deadBranch).toHaveLength(2);
    expect(targetIds).toContain(dead.id);
    expect(targetIds).toContain(leaf.id);
  });

  it('attaches the correct target, kind, and message to the warning', () => {
    const ude = makeEntity({ type: 'ude', title: 'Customers churn' });
    const dead = makeEntity({ type: 'rootCause', title: 'Stale pricing model' });
    const warnings = validate(makeDoc([ude, dead], [], 'crt'));

    const branch = deadBranchWarnings(warnings);
    expect(branch).toHaveLength(1);
    const w = branch[0]!;
    expect(w.target.kind).toBe('entity');
    expect(w.target.kind === 'entity' && w.target.id).toBe(dead.id);
    expect(w.message).toBe(
      '"Stale pricing model" doesn\'t lead to any UDE — prune or archive it, or connect it into the causal chain.'
    );
  });

  it('does not fire for an entity that reaches a UDE directly', () => {
    const ude = makeEntity({ type: 'ude', title: 'Customers churn' });
    const cause = makeEntity({ type: 'rootCause', title: 'Stale pricing model' });
    const edge = makeEdge(cause.id, ude.id);
    const warnings = validate(makeDoc([ude, cause], [edge], 'crt'));

    const branch = deadBranchWarnings(warnings);
    // cause reaches the UDE; ude is itself skipped — no warnings at all.
    expect(branch).toHaveLength(0);
  });

  it('does not fire for an entity that reaches a UDE transitively (multi-hop)', () => {
    const ude = makeEntity({ type: 'ude', title: 'Customers churn' });
    const mid = makeEntity({ type: 'effect', title: 'Support backlog grows' });
    const cause = makeEntity({ type: 'rootCause', title: 'Understaffed team' });
    // cause -> mid -> ude : every link in the chain reaches the UDE.
    const e1 = makeEdge(cause.id, mid.id);
    const e2 = makeEdge(mid.id, ude.id);
    const warnings = validate(makeDoc([ude, mid, cause], [e1, e2], 'crt'));

    expect(deadBranchWarnings(warnings)).toHaveLength(0);
  });

  it('never flags the UDE entity itself, even when it reaches no other UDE', () => {
    // A lone UDE that points nowhere does not reach another UDE (reach excludes
    // the seed), but the rule explicitly skips type === 'ude'.
    const ude = makeEntity({ type: 'ude', title: 'Customers churn' });
    const warnings = validate(makeDoc([ude], [], 'crt'));
    expect(deadBranchWarnings(warnings)).toHaveLength(0);
  });

  it('flags an upstream entity whose only downstream is a non-UDE branch', () => {
    const ude = makeEntity({ type: 'ude', title: 'Revenue falls' });
    const goodCause = makeEntity({ type: 'rootCause', title: 'Reaches the UDE' });
    const goodEdge = makeEdge(goodCause.id, ude.id);

    // A separate chain that dead-ends away from any UDE.
    const a = makeEntity({ type: 'rootCause', title: 'Branch root' });
    const b = makeEntity({ type: 'effect', title: 'Branch tip' });
    const deadEdge = makeEdge(a.id, b.id);

    const warnings = validate(makeDoc([ude, goodCause, a, b], [goodEdge, deadEdge], 'crt'));
    const branch = deadBranchWarnings(warnings);
    const targetIds = branch.map((w) => (w.target.kind === 'entity' ? w.target.id : null));

    expect(branch).toHaveLength(2);
    expect(targetIds).toContain(a.id);
    expect(targetIds).toContain(b.id);
    expect(targetIds).not.toContain(goodCause.id);
  });

  it('excludes note entities even when they reach no UDE', () => {
    const ude = makeEntity({ type: 'ude', title: 'Customers churn' });
    // A note is non-causal — structuralEntities filters it out, so it is
    // never a dead-branch candidate.
    const note = makeEntity({ type: 'note', title: 'Just a sticky note' });
    const warnings = validate(makeDoc([ude, note], [], 'crt'));
    expect(deadBranchWarnings(warnings)).toHaveLength(0);
  });

  it('uses (untitled) in the message for a structural entity with a blank title', () => {
    const ude = makeEntity({ type: 'ude', title: 'Customers churn' });
    const dead = makeEntity({ type: 'rootCause', title: '   ' });
    const warnings = validate(makeDoc([ude, dead], [], 'crt'));
    const branch = deadBranchWarnings(warnings);
    expect(branch).toHaveLength(1);
    expect(branch[0]!.message).toBe(
      '"(untitled)" doesn\'t lead to any UDE — prune or archive it, or connect it into the causal chain.'
    );
  });

  it('does not fire on a non-crt diagram even with a dead branch and a UDE present', () => {
    const ude = makeEntity({ type: 'ude', title: 'Customers churn' });
    const dead = makeEntity({ type: 'rootCause', title: 'Stale pricing model' });
    // Same shape as the positive case, but in an FRT — the rule is CRT-only.
    const warnings = validate(makeDoc([ude, dead], [], 'frt'));
    expect(deadBranchWarnings(warnings)).toHaveLength(0);
  });
});
