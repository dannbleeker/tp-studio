import type { Entity, TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

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
        'Objective (A) is empty — state the common goal both sides agree on.'
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
        'Needs B and C are the same entity — split them so each side has its own.'
      )
    );
  }
  for (const slot of ['b', 'c'] as const) {
    const ent = slots[slot];
    if (!ent || !slots.a) continue;
    const incoming = Object.values(doc.edges).filter((e) => e.targetId === ent.id);
    const outgoing = Object.values(doc.edges).filter(
      (e) => e.sourceId === ent.id && e.targetId !== slots.a?.id && !e.isMutualExclusion
    );
    if (outgoing.length > 0) {
      out.push(
        makeWarning(
          doc,
          'ec-completeness',
          { kind: 'entity', id: ent.id },
          `Need ${slot.toUpperCase()} connects to something other than A — each Need must only support the Objective.`
        )
      );
    }
    // Need has no incoming want? That's covered by rule 3 (the want
    // side); skip here to avoid double-counting.
    void incoming;
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
            `Want ${want.ecSlot === 'd' ? 'D' : 'D′'} supports an unexpected target — each Want should feed only its own Need.`
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
  const requiredArrows: { source?: Entity; target?: Entity; label: string; mutex?: boolean }[] = [
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
    const count = edge.assumptionIds?.length ?? 0;
    if (count === 0) {
      out.push(
        makeWarning(
          doc,
          'ec-completeness',
          { kind: 'edge', id: edge.id },
          `No assumption recorded on ${arrow.label} — surface at least one before the cloud is "complete".`
        )
      );
    }
  }

  // Rule 5 — soft completeness: ≥1 injection exists. The warning
  // targets the objective (A) since that's the most visible entity
  // and the brief frames "the cloud is resolved" against the doc as
  // a whole, not a specific edge.
  const hasInjection = Object.values(doc.entities).some((e) => e.type === 'injection');
  if (!hasInjection && slots.a) {
    out.push(
      makeWarning(
        doc,
        'ec-completeness',
        { kind: 'entity', id: slots.a.id },
        'No injection yet — add an injection that challenges an assumption to mark the cloud "resolved".'
      )
    );
  }

  return out;
};
