import { goalTreeMultipleGoalsRule } from '@/domain/validators/goalTreeMultipleGoals';
import { runWarningAction } from '@/services/warningActions';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);

/**
 * Session 79 — Goal Tree multi-goal soft warning + optional auto-
 * convert action. Verifies:
 *   1. Rule fires only on Goal Tree docs with ≥2 goals.
 *   2. Rule does not fire on other diagram types regardless of goal count.
 *   3. Warning carries the convert-extra-goals-to-csfs action.
 *   4. Running the action converts every goal except the oldest into CSFs.
 *   5. The warning is dismissible via resolvedWarnings (existing flow).
 */

describe('goalTreeMultipleGoalsRule', () => {
  it('does not fire on a non-Goal-Tree diagram regardless of goal count', () => {
    const s = useDocumentStore.getState();
    s.newDocument('crt');
    // Force two goals onto a CRT (artificial but proves the diagram-type guard).
    s.addEntity({ type: 'goal', title: 'one' });
    s.addEntity({ type: 'goal', title: 'two' });
    const warnings = goalTreeMultipleGoalsRule(useDocumentStore.getState().doc);
    expect(warnings).toEqual([]);
  });

  it('does not fire on a Goal Tree with exactly one goal', () => {
    const s = useDocumentStore.getState();
    s.newDocument('goalTree');
    s.addEntity({ type: 'goal', title: 'apex' });
    expect(goalTreeMultipleGoalsRule(useDocumentStore.getState().doc)).toEqual([]);
  });

  it('fires on a Goal Tree with ≥2 goals', () => {
    const s = useDocumentStore.getState();
    s.newDocument('goalTree');
    s.addEntity({ type: 'goal', title: 'apex' });
    s.addEntity({ type: 'goal', title: 'second' });
    const warnings = goalTreeMultipleGoalsRule(useDocumentStore.getState().doc);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/2 goals/);
    expect(warnings[0]?.action?.actionId).toBe('convert-extra-goals-to-csfs');
  });

  it('reports the actual goal count in the message', () => {
    const s = useDocumentStore.getState();
    s.newDocument('goalTree');
    s.addEntity({ type: 'goal', title: 'first' });
    s.addEntity({ type: 'goal', title: 'second' });
    s.addEntity({ type: 'goal', title: 'third' });
    const [w] = goalTreeMultipleGoalsRule(useDocumentStore.getState().doc);
    expect(w?.message).toMatch(/3 goals/);
  });

  it('anchors the warning on the oldest goal (deterministic across re-validations)', () => {
    const s = useDocumentStore.getState();
    s.newDocument('goalTree');
    const first = s.addEntity({ type: 'goal', title: 'first' });
    s.addEntity({ type: 'goal', title: 'second' });
    const [w] = goalTreeMultipleGoalsRule(useDocumentStore.getState().doc);
    expect(w?.target.kind).toBe('entity');
    if (w?.target.kind === 'entity') expect(w.target.id).toBe(first.id);
  });
});

describe('convert-extra-goals-to-csfs action', () => {
  it('keeps the oldest goal as goal, converts the rest to CSFs', () => {
    const s = useDocumentStore.getState();
    s.newDocument('goalTree');
    const apex = s.addEntity({ type: 'goal', title: 'apex' });
    const extra1 = s.addEntity({ type: 'goal', title: 'extra-1' });
    const extra2 = s.addEntity({ type: 'goal', title: 'extra-2' });
    const [w] = goalTreeMultipleGoalsRule(useDocumentStore.getState().doc);
    expect(w).toBeDefined();
    const ran = runWarningAction(useDocumentStore.getState(), useDocumentStore.getState().doc, {
      ...w!,
      tier: 'clarity',
    });
    expect(ran).toBe(true);
    const doc = useDocumentStore.getState().doc;
    expect(doc.entities[apex.id]?.type).toBe('goal');
    expect(doc.entities[extra1.id]?.type).toBe('criticalSuccessFactor');
    expect(doc.entities[extra2.id]?.type).toBe('criticalSuccessFactor');
  });

  it('is a no-op on non-Goal-Tree diagrams', () => {
    const s = useDocumentStore.getState();
    s.newDocument('crt');
    const g = s.addEntity({ type: 'goal', title: 'one' });
    runWarningAction(useDocumentStore.getState(), useDocumentStore.getState().doc, {
      id: 'fake',
      ruleId: 'goalTree-multiple-goals',
      message: 'fake',
      target: { kind: 'entity', id: g.id },
      resolved: false,
      tier: 'clarity',
      action: { actionId: 'convert-extra-goals-to-csfs', label: 'x' },
    });
    expect(useDocumentStore.getState().doc.entities[g.id]?.type).toBe('goal');
  });

  it('clears the warning once the conversion has run', () => {
    const s = useDocumentStore.getState();
    s.newDocument('goalTree');
    s.addEntity({ type: 'goal', title: 'apex' });
    s.addEntity({ type: 'goal', title: 'extra' });
    const [w] = goalTreeMultipleGoalsRule(useDocumentStore.getState().doc);
    runWarningAction(useDocumentStore.getState(), useDocumentStore.getState().doc, {
      ...w!,
      tier: 'clarity',
    });
    // After conversion, the rule no longer fires — there's only one goal left.
    expect(goalTreeMultipleGoalsRule(useDocumentStore.getState().doc)).toEqual([]);
  });
});

describe('resolved-warnings escape hatch', () => {
  it('the warning resolves via the existing resolvedWarnings map', () => {
    const s = useDocumentStore.getState();
    s.newDocument('goalTree');
    s.addEntity({ type: 'goal', title: 'one' });
    s.addEntity({ type: 'goal', title: 'two' });
    const [w] = goalTreeMultipleGoalsRule(useDocumentStore.getState().doc);
    expect(w?.resolved).toBe(false);
    s.resolveWarning(w!.id);
    const [w2] = goalTreeMultipleGoalsRule(useDocumentStore.getState().doc);
    expect(w2?.resolved).toBe(true);
  });
});
