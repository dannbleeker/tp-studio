import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Engineer onboarding (Transition Tree).
 *
 * A people-process TT walking a new hire from "first day in the
 * building" to "shipping production code unsupervised." Each step
 * is the canonical Outcome ← (Precondition + Action) triple, joined
 * via AND so the diagram surfaces the structural completeness rule:
 * a step missing its precondition is structurally incomplete.
 *
 * Useful as a teaching template because the preconditions are real
 * states (laptop provisioned, environment buildable, code reviewer
 * assigned) rather than vague "X is ready." Each outcome becomes
 * the next step's precondition without restating it — the chain
 * advances by changing one variable at a time.
 */
export const buildPatternTTEngineerOnboarding = (): TPDocument => {
  const t = Date.now();

  const p1 = buildEntity('effect', 'New hire arrives with HR paperwork complete', t, 1);

  const a1 = buildEntity('action', 'IT issues laptop preloaded with role-default tooling', t, 2, {
    ordering: 1,
  });
  const a2 = buildEntity(
    'action',
    'Buddy walks them through cloning the service repository and running the test suite locally',
    t,
    3,
    { ordering: 2 }
  );
  const a3 = buildEntity(
    'action',
    'Tech lead assigns a starter ticket sized for half a day',
    t,
    4,
    {
      ordering: 3,
    }
  );
  const a4 = buildEntity(
    'action',
    'New hire opens a pull request against the starter ticket',
    t,
    5,
    {
      ordering: 4,
    }
  );
  const a5 = buildEntity(
    'action',
    'Code reviewer approves the change with at most one round of revision',
    t,
    6,
    { ordering: 5 }
  );

  const o1 = buildEntity(
    'effect',
    'New hire has a working laptop with their environment configured',
    t,
    7
  );
  const o2 = buildEntity(
    'effect',
    'New hire can run the service test suite locally and green',
    t,
    8
  );
  const o3 = buildEntity('effect', 'New hire has a small but real problem to solve', t, 9);
  const o4 = buildEntity(
    'effect',
    'A pull request from the new hire is open and CI is green',
    t,
    10
  );

  const de = buildEntity(
    'desiredEffect',
    'New hire merges their first production change in under two weeks',
    t,
    11
  );

  const g = (suffix: string): string => `and_pattern_tt_onboarding_${suffix}`;

  const entities = [p1, a1, a2, a3, a4, a5, o1, o2, o3, o4, de];
  const edges: Edge[] = [
    buildEdge(p1.id, o1.id, { andGroupId: g('s1') }),
    buildEdge(a1.id, o1.id, { andGroupId: g('s1') }),
    buildEdge(o1.id, o2.id, { andGroupId: g('s2') }),
    buildEdge(a2.id, o2.id, { andGroupId: g('s2') }),
    buildEdge(o2.id, o3.id, { andGroupId: g('s3') }),
    buildEdge(a3.id, o3.id, { andGroupId: g('s3') }),
    buildEdge(o3.id, o4.id, { andGroupId: g('s4') }),
    buildEdge(a4.id, o4.id, { andGroupId: g('s4') }),
    buildEdge(o4.id, de.id, { andGroupId: g('s5') }),
    buildEdge(a5.id, de.id, { andGroupId: g('s5') }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'tt',
    title: 'Engineer onboarding TT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 12,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
