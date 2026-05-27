import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Centralize vs federate (Evaporating Cloud).
 *
 * An organizational-design EC for the perennial conflict between
 * a central team that owns a shared capability and the operating
 * teams that want autonomy over it. The classic example is a
 * shared platform team (data, security, design system, etc.) —
 * leadership oscillates between "consolidate to a central group"
 * and "embed specialists into product teams" every couple of
 * years.
 *
 * The Wants are written as specific structural decisions, not
 * abstract principles — Scheinkopf's recurring point is that the
 * EC stops being useful when the Wants drift to "be more
 * agile" / "have better governance." Each Want here is a thing
 * a person could veto or approve in a meeting.
 */
const EC_POSITIONS = {
  a: { x: 100, y: 250 },
  b: { x: 450, y: 100 },
  c: { x: 450, y: 400 },
  d: { x: 800, y: 100 },
  dPrime: { x: 800, y: 400 },
} as const;

export const buildPatternECCentralizeVsFederate = (): TPDocument => {
  const t = Date.now();

  const a = buildEntity(
    'goal',
    'Run the company with a healthy, well-supported design system',
    t,
    1,
    {
      position: EC_POSITIONS.a,
      ecSlot: 'a',
    }
  );
  const b = buildEntity('need', 'Keep design coherence across the product surface', t, 2, {
    position: EC_POSITIONS.b,
    ecSlot: 'b',
  });
  const c = buildEntity('need', 'Let product teams move at their own pace on UI changes', t, 3, {
    position: EC_POSITIONS.c,
    ecSlot: 'c',
  });
  const d = buildEntity('want', 'Form a central design-system team that owns the library', t, 4, {
    position: EC_POSITIONS.d,
    ecSlot: 'd',
  });
  const dPrime = buildEntity(
    'want',
    'Embed a design-system maintainer inside each product team',
    t,
    5,
    {
      position: EC_POSITIONS.dPrime,
      ecSlot: 'dPrime',
    }
  );

  const entities = [a, b, c, d, dPrime];
  const edges: Edge[] = [
    buildEdge(d.id, b.id, { kind: 'necessity' }),
    buildEdge(dPrime.id, c.id, { kind: 'necessity' }),
    buildEdge(b.id, a.id, { kind: 'necessity' }),
    buildEdge(c.id, a.id, { kind: 'necessity' }),
    buildEdge(d.id, dPrime.id, { kind: 'necessity', isMutualExclusion: true }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'ec',
    title: 'Centralize vs federate the design system EC',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 6,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
