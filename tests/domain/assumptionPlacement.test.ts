import { describe, expect, it } from 'vitest';
import {
  ASSUMPTION_EDGE_OFFSET,
  anchoredAssumptionEdges,
  anchoredAssumptionIds,
  placeAssumptionsNearEdges,
} from '@/domain/assumptionPlacement';
import type { TPDocument } from '@/domain/types';

// Minimal doc builder — the placement helpers read only `entities[id].type`
// and each edge's `sourceId` / `targetId` / `assumptionIds`.
const mkDoc = (
  entities: Record<string, { type: string }>,
  edges: Record<string, { sourceId: string; targetId: string; assumptionIds?: string[] }>
): TPDocument =>
  ({
    entities: Object.fromEntries(
      Object.entries(entities).map(([id, e]) => [id, { id, title: id, ...e }])
    ),
    edges: Object.fromEntries(
      Object.entries(edges).map(([id, e]) => [id, { id, kind: 'sufficiency', ...e }])
    ),
  }) as unknown as TPDocument;

const SIZE = () => ({ width: 260, height: 120 });

describe('anchoredAssumptionEdges / anchoredAssumptionIds', () => {
  it('maps an assumption to the edge that lists it', () => {
    const doc = mkDoc(
      { s: { type: 'rootCause' }, t: { type: 'effect' }, a: { type: 'assumption' } },
      { e1: { sourceId: 's', targetId: 't', assumptionIds: ['a'] } }
    );
    expect(anchoredAssumptionEdges(doc).get('a')).toEqual({
      sourceId: 's',
      targetId: 't',
      index: 0,
    });
    expect(anchoredAssumptionIds(doc)).toEqual(new Set(['a']));
  });

  it('ignores an assumptionId that is not an assumption-typed entity', () => {
    const doc = mkDoc(
      { s: { type: 'rootCause' }, t: { type: 'effect' }, x: { type: 'effect' } },
      { e1: { sourceId: 's', targetId: 't', assumptionIds: ['x'] } }
    );
    expect(anchoredAssumptionEdges(doc).size).toBe(0);
    expect(anchoredAssumptionIds(doc).size).toBe(0);
  });

  it('staggers multiple assumptions on the same edge with a 0-based index', () => {
    const doc = mkDoc(
      {
        s: { type: 'rootCause' },
        t: { type: 'effect' },
        a: { type: 'assumption' },
        b: { type: 'assumption' },
      },
      { e1: { sourceId: 's', targetId: 't', assumptionIds: ['a', 'b'] } }
    );
    const m = anchoredAssumptionEdges(doc);
    expect(m.get('a')?.index).toBe(0);
    expect(m.get('b')?.index).toBe(1);
  });
});

describe('placeAssumptionsNearEdges', () => {
  it('returns {} when there are no anchored assumptions', () => {
    const doc = mkDoc({ s: { type: 'rootCause' } }, {});
    expect(placeAssumptionsNearEdges(doc, { s: { x: 0, y: 0 } }, SIZE)).toEqual({});
  });

  it('places the card one perpendicular offset off the edge midpoint', () => {
    const doc = mkDoc(
      { s: { type: 'rootCause' }, t: { type: 'effect' }, a: { type: 'assumption' } },
      { e1: { sourceId: 's', targetId: 't', assumptionIds: ['a'] } }
    );
    // Vertical edge: s top-left (0,0), t (0,400) → centres (130,60),(130,460), mid (130,260).
    const placed = placeAssumptionsNearEdges(doc, { s: { x: 0, y: 0 }, t: { x: 0, y: 400 } }, SIZE);
    const card = placed.a!;
    const centre = { x: card.x + 130, y: card.y + 60 };
    // Perpendicular to a vertical edge is horizontal: same y, |Δx| === the offset.
    expect(Math.round(centre.y)).toBe(260);
    expect(Math.abs(Math.abs(centre.x - 130) - ASSUMPTION_EDGE_OFFSET)).toBeLessThan(0.5);
  });

  it('pushes the card to the side away from the structural centroid', () => {
    const doc = mkDoc(
      {
        s: { type: 'rootCause' },
        t: { type: 'effect' },
        far: { type: 'effect' },
        a: { type: 'assumption' },
      },
      { e1: { sourceId: 's', targetId: 't', assumptionIds: ['a'] } }
    );
    // A heavy node far to +x pulls the centroid right, so the card goes left.
    const structural = { s: { x: 0, y: 0 }, t: { x: 0, y: 400 }, far: { x: 2000, y: 200 } };
    const placed = placeAssumptionsNearEdges(doc, structural, SIZE);
    const centreX = placed.a!.x + 130;
    expect(centreX).toBeLessThan(130);
  });

  it('skips an assumption whose anchor endpoint is missing from the layout', () => {
    const doc = mkDoc(
      { s: { type: 'rootCause' }, t: { type: 'effect' }, a: { type: 'assumption' } },
      { e1: { sourceId: 's', targetId: 't', assumptionIds: ['a'] } }
    );
    // Only `t` is laid out (e.g. `s` is inside a collapsed group).
    expect(placeAssumptionsNearEdges(doc, { t: { x: 0, y: 400 } }, SIZE)).toEqual({});
  });
});
