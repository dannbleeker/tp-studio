import { assumptionsForEdge } from '../graph';
import type { Entity, TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 77 / brief §6 — EC structural completeness rules.
 *
 * The brief specifies five distinct validation rules on EC docs:
 *
 *   1. A (Objective) must be non-empty and stated as a positive goal.
 *   2. B and C are distinct entities, each connected only to A.
 *   3. D supports only B; D′ supports only C.
 *   4. At least one assumption is recorded on each of the five arrows
 *      before the cloud is marked "complete."
 *   5. At least one injection exists before the cloud is marked
 *      "resolved."
 *
 * Rules #4 and #5 are *soft completeness* signals (informational —
 * they describe the diagnostic's readiness state) and live in the
 * existing CLR-rule pipeline at the `existence` tier alongside the
 * older `ec-missing-conflict` rule. Rules #1 / #2 / #3 are structural;
 * we surface them as warnings on the offending slot entity.
 */

const slotEntities = (
  doc: TPDocument
): Record<'a' | 'b' | 'c' | 'd' | 'dPrime', Entity | undefined> => {
  const map: Record<'a' | 'b' | 'c' | 'd' | 'dPrime', Entity | undefined> = {
    a: undefined,
    b: undefined,
    c: undefined,
    d: undefined,
    dPrime: undefined,
  };
  for (const e of Object.values(doc.entities)) {
    if (e.ecSlot && !map[e.ecSlot]) map[e.ecSlot] = e;
  }
  return map;
};

/**
 * `ec-completeness` aggregates the five brief-prescribed checks. Each
 * sub-issue surfaces as its own warning so the user can resolve them
 * independently via the existing `resolvedWarnings` map.
 */
export const ecCompletenessRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'ec') return [];
  const slots = slotEntities(doc);
  const out: UntieredWarning[] = [];

  // Rule 1 — A non-empty + positive framing. We can only detect the
  // empty case automatically; the "stated as a positive goal" half is
  // a CLR-level judgement the user makes. So the warning fires only
  // on empty A.
  if (slots.a && slots.a.title.trim() === '' && slots.a.unspecified !== true) {
    out.push(
      makeWarning(
        doc,
        'ec-completeness',
        { kind: 'entity', id: slots.a.id },
        'ec-completeness.empty-objective',
        undefined,
        'empty-objective'
      )
    );
  }

  // Rule 2 — B and C distinct + each connected only to A.
  if (slots.b && slots.c && slots.b.id === slots.c.id) {
    out.push(
      makeWarning(
        doc,
        'ec-completeness',
        { kind: 'entity', id: slots.b.id },
        'ec-completeness.needs-identical',
        undefined,
        'needs-identical'
      )
    );
  }
  for (const slot of ['b', 'c'] as const) {
    const ent = slots[slot];
    if (!ent || !slots.a) continue;
    // A Need may only support the Objective. Mutual-exclusion edges (the B↔C
    // conflict link) are not support edges, so they're excluded here — the
    // missing incoming-want case is left to Rule 3 (the want side).
    const outgoing = Object.values(doc.edges).filter(
      (e) => e.sourceId === ent.id && e.targetId !== slots.a?.id && !e.isMutualExclusion
    );
    if (outgoing.length > 0) {
      out.push(
        makeWarning(
          doc,
          'ec-completeness',
          { kind: 'entity', id: ent.id },
          'ec-completeness.need-extra-support',
          { slot },
          'need-extra-support'
        )
      );
    }
  }

  // Rule 3 — D supports only B; D′ supports only C.
  const checkWantSupports = (want: Entity | undefined, expectedNeed: Entity | undefined): void => {
    if (!want) return;
    const outgoing = Object.values(doc.edges).filter(
      (e) => e.sourceId === want.id && !e.isMutualExclusion
    );
    for (const e of outgoing) {
      if (e.targetId !== expectedNeed?.id) {
        out.push(
          makeWarning(
            doc,
            'ec-completeness',
            { kind: 'edge', id: e.id },
            'ec-completeness.want-wrong-target',
            { slot: want.ecSlot === 'd' ? 'd' : 'dPrime' },
            'want-wrong-target'
          )
        );
      }
    }
  };
  checkWantSupports(slots.d, slots.b);
  checkWantSupports(slots.dPrime, slots.c);

  // Rule 4 — soft completeness: every connecting arrow has ≥1
  // assumption. We check the five canonical arrows. The user can
  // resolve each warning individually if they want to declare the
  // arrow "considered" without an assumption.
  // Session 117 — explicit `| undefined` so the inline-array elements
  // below can carry the optional `slots.X` lookups (which can be
  // undefined when the slot is unfilled) without conditional spreads.
  const requiredArrows: {
    source?: Entity | undefined;
    target?: Entity | undefined;
    label: string;
    mutex?: boolean;
  }[] = [
    { source: slots.b, target: slots.a, label: 'B → A' },
    { source: slots.c, target: slots.a, label: 'C → A' },
    { source: slots.d, target: slots.b, label: 'D → B' },
    { source: slots.dPrime, target: slots.c, label: 'D′ → C' },
    { source: slots.d, target: slots.dPrime, label: 'D ↔ D′', mutex: true },
  ];
  for (const arrow of requiredArrows) {
    if (!arrow.source || !arrow.target) continue;
    const edge = Object.values(doc.edges).find((e) => {
      const matches = e.sourceId === arrow.source?.id && e.targetId === arrow.target?.id;
      const reverseMatches =
        arrow.mutex && e.sourceId === arrow.target?.id && e.targetId === arrow.source?.id;
      return (matches || reverseMatches) && (!arrow.mutex || e.isMutualExclusion);
    });
    if (!edge) continue;
    const count = assumptionsForEdge(doc, edge.id).length;
    if (count === 0) {
      out.push(
        makeWarning(
          doc,
          'ec-completeness',
          { kind: 'edge', id: edge.id },
          'ec-completeness.missing-assumption',
          { arrow: arrow.label },
          'missing-assumption'
        )
      );
    }
  }

  // Rule 5 — soft completeness: ≥1 injection exists. The warning
  // targets the objective (A) since that's the most visible entity
  // and the brief frames "the cloud is resolved" against the doc as
  // a whole, not a specific edge.
  //
  // Session 206 — this shares its target (A) with Rule 1's empty-objective
  // check, and a fresh cloud trips BOTH: blank boxes and no injection yet. They
  // used to share one id, so dismissing "no injection" silently dismissed
  // "Objective (A) is empty" too. The `variant` keeps them apart.
  const hasInjection = Object.values(doc.entities).some((e) => e.type === 'injection');
  if (!hasInjection && slots.a) {
    out.push(
      makeWarning(
        doc,
        'ec-completeness',
        { kind: 'entity', id: slots.a.id },
        'ec-completeness.no-injection',
        undefined,
        'no-injection'
      )
    );
  }

  return out;
};
