import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

const RULE = 'goalTree-multiple-goals';

beforeEach(() => {
  resetIds();
});

const goalWarnings = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE);

describe('goalTree-multiple-goals', () => {
  describe('positive — fires on >1 goal in a goalTree', () => {
    it('fires exactly once for two goals, anchored on the oldest goal', () => {
      // First-created goal has the lowest annotationNumber → it is the apex.
      const apex = makeEntity({ type: 'goal', title: 'Apex goal' });
      const extra = makeEntity({ type: 'goal', title: 'Second goal' });
      const warnings = goalWarnings(validate(makeDoc([apex, extra], [], 'goalTree')));

      expect(warnings).toHaveLength(1);
      const w = warnings[0]!;
      expect(w.target).toEqual({ kind: 'entity', id: apex.id });
      expect(w.tier).toBe('clarity');
    });

    it('reports the exact goal count in the message', () => {
      const g1 = makeEntity({ type: 'goal', title: 'G1' });
      const g2 = makeEntity({ type: 'goal', title: 'G2' });
      const g3 = makeEntity({ type: 'goal', title: 'G3' });
      const warnings = goalWarnings(validate(makeDoc([g1, g2, g3], [], 'goalTree')));

      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toBe(
        "Goal Tree has 3 goals — Dettmer's pattern is a single apex Goal with 3-5 CSFs below."
      );
    });

    it('attaches the convert-extras-to-csfs one-click action', () => {
      const g1 = makeEntity({ type: 'goal' });
      const g2 = makeEntity({ type: 'goal' });
      const warnings = goalWarnings(validate(makeDoc([g1, g2], [], 'goalTree')));

      expect(warnings[0]!.action).toEqual({
        actionId: 'convert-extra-goals-to-csfs',
        label: 'Convert extras to CSFs',
      });
    });

    it('anchors on the lowest annotationNumber regardless of insertion order', () => {
      // Apex is the goal with the SMALLEST annotationNumber, not the first
      // in the entities array. Give the later-listed goal the lower number.
      const later = makeEntity({ type: 'goal', title: 'Listed first', annotationNumber: 7 });
      const apex = makeEntity({ type: 'goal', title: 'Listed second', annotationNumber: 2 });
      const warnings = goalWarnings(validate(makeDoc([later, apex], [], 'goalTree')));

      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.target).toEqual({ kind: 'entity', id: apex.id });
    });

    it('counts only goal entities, ignoring CSFs and other types', () => {
      const g1 = makeEntity({ type: 'goal', title: 'G1' });
      const g2 = makeEntity({ type: 'goal', title: 'G2' });
      const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'A CSF' });
      const nc = makeEntity({ type: 'necessaryCondition', title: 'An NC' });
      const warnings = goalWarnings(validate(makeDoc([g1, g2, csf, nc], [], 'goalTree')));

      expect(warnings).toHaveLength(1);
      // Message count reflects 2 goals, not 4 entities.
      expect(warnings[0]!.message).toContain('has 2 goals');
    });
  });

  describe('negative — does not fire', () => {
    it('does not fire for a single goal (off-by-one, just below threshold)', () => {
      const apex = makeEntity({ type: 'goal', title: 'Sole apex goal' });
      const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'CSF below' });
      const e = makeEdge(apex.id, csf.id);
      const warnings = goalWarnings(validate(makeDoc([apex, csf], [e], 'goalTree')));

      expect(warnings).toHaveLength(0);
    });

    it('does not fire for zero goals', () => {
      const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'Just a CSF' });
      const warnings = goalWarnings(validate(makeDoc([csf], [], 'goalTree')));

      expect(warnings).toHaveLength(0);
    });

    it('does not fire on an empty document', () => {
      const warnings = goalWarnings(validate(makeDoc([], [], 'goalTree')));

      expect(warnings).toHaveLength(0);
    });

    it('does not fire when diagramType is not goalTree even with two goals', () => {
      const g1 = makeEntity({ type: 'goal', title: 'G1' });
      const g2 = makeEntity({ type: 'goal', title: 'G2' });
      // 'ec' and 'prt' also use the goal type, but the rule is goalTree-only.
      expect(goalWarnings(validate(makeDoc([g1, g2], [], 'ec')))).toHaveLength(0);
      expect(goalWarnings(validate(makeDoc([g1, g2], [], 'prt')))).toHaveLength(0);
      expect(goalWarnings(validate(makeDoc([g1, g2], [], 'crt')))).toHaveLength(0);
    });
  });

  describe('boundary — exactly at the threshold', () => {
    it('fires at exactly two goals (the smallest count that triggers)', () => {
      const g1 = makeEntity({ type: 'goal', title: 'G1' });
      const g2 = makeEntity({ type: 'goal', title: 'G2' });
      const warnings = goalWarnings(validate(makeDoc([g1, g2], [], 'goalTree')));

      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toContain('has 2 goals');
    });

    it('still fires a single warning (not one-per-extra) for many goals', () => {
      const goals = Array.from({ length: 5 }, (_, i) =>
        makeEntity({ type: 'goal', title: `G${i}` })
      );
      const warnings = goalWarnings(validate(makeDoc(goals, [], 'goalTree')));

      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toContain('has 5 goals');
    });
  });

  describe('resolution', () => {
    it('marks the warning resolved when its id is in resolvedWarnings', () => {
      const apex = makeEntity({ type: 'goal', title: 'Apex' });
      const extra = makeEntity({ type: 'goal', title: 'Extra' });
      const resolvedId = `${RULE}:entity:${apex.id}`;
      const warnings = goalWarnings(
        validate(makeDoc([apex, extra], [], 'goalTree', { [resolvedId]: true }))
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.resolved).toBe(true);
    });

    it('leaves the warning unresolved by default', () => {
      const apex = makeEntity({ type: 'goal' });
      const extra = makeEntity({ type: 'goal' });
      const warnings = goalWarnings(validate(makeDoc([apex, extra], [], 'goalTree')));

      expect(warnings[0]!.resolved).toBe(false);
    });
  });
});
