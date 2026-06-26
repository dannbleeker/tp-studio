import { describe, expect, it } from 'vitest';
import { importFromFlyingLogic } from '@/domain/flyingLogic/reader';

/**
 * Targeted coverage for `importFromFlyingLogic` fallback / skip / synthesis
 * branches that the round-trip + happy-path suites in `flyingLogic.test.ts`
 * and `flyingLogicBundle8RoundTrip.test.ts` don't exercise directly: the
 * diagram-type fallback, invalid weight rejection, OR/XOR junctor synthesis on
 * a raw import, group colour/collapsed parsing, the malformed-vertex/edge skip
 * paths, and metadata-shape precedence. Uses the compact flat schema.
 */

/** Wrap inner `<decisionGraph>` content in a `<flyingLogic>` root, optionally
 *  with root-level `<attribute>` children (the flat-schema metadata shape). */
const fl = (graph: string, rootAttrs = '') =>
  `<?xml version="1.0" encoding="UTF-8"?>
<flyingLogic majorversion="5" uuid="x" instance="x">
  ${rootAttrs}
  <decisionGraph>${graph}</decisionGraph>
</flyingLogic>`;

const entity = (eid: string, title: string, attrs = '') =>
  `<vertex eid="${eid}" type="entity" entityClass="Effect"><attribute key="title">${title}</attribute>${attrs}</vertex>`;

describe('importFromFlyingLogic — diagram type', () => {
  it('preserves a known tp-studio-diagram-type', () => {
    const doc = importFromFlyingLogic(
      fl(
        `<vertices>${entity('1', 'A')}</vertices><edges></edges>`,
        '<attribute key="tp-studio-diagram-type">frt</attribute>'
      )
    );
    expect(doc.diagramType).toBe('frt');
  });

  it('falls back to crt for an unknown diagram type', () => {
    const doc = importFromFlyingLogic(
      fl(
        `<vertices>${entity('1', 'A')}</vertices><edges></edges>`,
        '<attribute key="tp-studio-diagram-type">galaxy-brain</attribute>'
      )
    );
    expect(doc.diagramType).toBe('crt');
  });
});

describe('importFromFlyingLogic — edge weight parsing', () => {
  it('reads a valid tp-studio-weight on a direct edge', () => {
    const doc = importFromFlyingLogic(
      fl(
        `<vertices>${entity('1', 'A')}${entity('2', 'B')}</vertices>` +
          `<edges><edge eid="e1" source="1" target="2"><attribute key="tp-studio-weight">negative</attribute></edge></edges>`
      )
    );
    expect(Object.values(doc.edges)[0]?.weight).toBe('negative');
  });

  it('drops an unrecognised weight value (no tag) rather than persisting junk', () => {
    const doc = importFromFlyingLogic(
      fl(
        `<vertices>${entity('1', 'A')}${entity('2', 'B')}</vertices>` +
          `<edges><edge eid="e1" source="1" target="2"><attribute key="tp-studio-weight">sideways</attribute></edge></edges>`
      )
    );
    expect(Object.values(doc.edges)[0]?.weight).toBeUndefined();
  });
});

describe('importFromFlyingLogic — junctor group synthesis', () => {
  const junctorDoc = (junctorAttrs: string) =>
    fl(
      `<vertices>${entity('1', 'A')}${entity('2', 'B')}${entity('3', 'T')}` +
        `<vertex eid="J" type="junctor">${junctorAttrs}</vertex></vertices>` +
        `<edges>` +
        `<edge eid="e1" source="1" target="J"></edge>` +
        `<edge eid="e2" source="2" target="J"></edge>` +
        `<edge eid="e3" source="J" target="3"></edge>` +
        `</edges>`
    );

  it('synthesises an OR group from tp-studio-or-group-id', () => {
    const doc = importFromFlyingLogic(
      junctorDoc('<attribute key="tp-studio-or-group-id">or-7</attribute>')
    );
    const grouped = Object.values(doc.edges);
    expect(grouped).toHaveLength(2);
    expect(grouped.every((e) => e.orGroupId === 'or-7')).toBe(true);
    expect(grouped.every((e) => !e.andGroupId && !e.xorGroupId)).toBe(true);
  });

  it('synthesises an XOR group from tp-studio-xor-group-id', () => {
    const doc = importFromFlyingLogic(
      junctorDoc('<attribute key="tp-studio-xor-group-id">xor-9</attribute>')
    );
    const grouped = Object.values(doc.edges);
    expect(grouped).toHaveLength(2);
    expect(grouped.every((e) => e.xorGroupId === 'xor-9')).toBe(true);
    expect(grouped.every((e) => !e.andGroupId && !e.orGroupId)).toBe(true);
  });

  it('defaults a junctor with no group-id attribute to a minted AND group', () => {
    const doc = importFromFlyingLogic(junctorDoc(''));
    const grouped = Object.values(doc.edges);
    expect(grouped).toHaveLength(2);
    expect(grouped.every((e) => Boolean(e.andGroupId))).toBe(true);
    expect(grouped[0]?.andGroupId).toBe(grouped[1]?.andGroupId);
  });

  it('drops a junctor that has no incoming edges (nothing to group)', () => {
    // Junctor J only has an OUT edge to target 3 — no sources feed it.
    const doc = importFromFlyingLogic(
      fl(
        `<vertices>${entity('3', 'T')}<vertex eid="J" type="junctor"></vertex></vertices>` +
          `<edges><edge eid="e3" source="J" target="3"></edge></edges>`
      )
    );
    expect(Object.keys(doc.edges)).toHaveLength(0);
  });
});

describe('importFromFlyingLogic — groups', () => {
  const groupDoc = (groupVertex: string) =>
    fl(`<vertices>${entity('1', 'A')}${entity('2', 'B')}${groupVertex}</vertices><edges></edges>`);

  it('preserves a valid tp-studio-color', () => {
    const doc = importFromFlyingLogic(
      groupDoc(
        `<vertex eid="G" grouped="1 2"><attribute key="title">Grp</attribute><attribute key="tp-studio-color">rose</attribute></vertex>`
      )
    );
    expect(Object.values(doc.groups)[0]?.color).toBe('rose');
  });

  it('falls back to indigo for an unknown colour', () => {
    const doc = importFromFlyingLogic(
      groupDoc(
        `<vertex eid="G" grouped="1 2"><attribute key="title">Grp</attribute><attribute key="tp-studio-color">chartreuse</attribute></vertex>`
      )
    );
    expect(Object.values(doc.groups)[0]?.color).toBe('indigo');
  });

  it('reads collapsed="true" onto the group', () => {
    const doc = importFromFlyingLogic(
      groupDoc(
        `<vertex eid="G" grouped="1 2" collapsed="true"><attribute key="title">Grp</attribute></vertex>`
      )
    );
    expect(Object.values(doc.groups)[0]?.collapsed).toBe(true);
    expect(Object.values(doc.groups)[0]?.memberIds).toHaveLength(2);
  });
});

describe('importFromFlyingLogic — malformed input skips', () => {
  it('skips a vertex with no eid', () => {
    const doc = importFromFlyingLogic(
      fl(
        `<vertices><vertex type="entity"><attribute key="title">orphan</attribute></vertex>${entity('1', 'A')}</vertices><edges></edges>`
      )
    );
    expect(Object.keys(doc.entities)).toHaveLength(1);
  });

  it('skips an edge missing source or target', () => {
    const doc = importFromFlyingLogic(
      fl(
        `<vertices>${entity('1', 'A')}${entity('2', 'B')}</vertices>` +
          `<edges><edge eid="e1" source="1"></edge><edge eid="e2" target="2"></edge></edges>`
      )
    );
    expect(Object.keys(doc.edges)).toHaveLength(0);
  });

  it('skips a direct edge whose endpoint entity is missing', () => {
    const doc = importFromFlyingLogic(
      fl(
        `<vertices>${entity('1', 'A')}</vertices><edges><edge eid="e1" source="1" target="999"></edge></edges>`
      )
    );
    expect(Object.keys(doc.edges)).toHaveLength(0);
  });
});

describe('importFromFlyingLogic — metadata + annotation', () => {
  it('prefers a flat <attribute key="title"> over a <documentInfo> title', () => {
    const doc = importFromFlyingLogic(
      fl(
        `<vertices>${entity('1', 'A')}</vertices><edges></edges>`,
        `<attribute key="title">Flat Title</attribute><documentInfo title="Nested Title"/>`
      )
    );
    expect(doc.title).toBe('Flat Title');
  });

  it('preserves a per-entity tp-studio-annotation and the doc next-annotation counter', () => {
    const doc = importFromFlyingLogic(
      fl(
        `<vertices>${entity('1', 'A', '<attribute key="tp-studio-annotation">42</attribute>')}</vertices><edges></edges>`,
        '<attribute key="tp-studio-next-annotation">50</attribute>'
      )
    );
    expect(Object.values(doc.entities)[0]?.annotationNumber).toBe(42);
    expect(doc.nextAnnotationNumber).toBe(50);
  });

  it('preserves an entity description attribute', () => {
    const doc = importFromFlyingLogic(
      fl(
        `<vertices>${entity('1', 'A', '<attribute key="description">why A holds</attribute>')}</vertices><edges></edges>`
      )
    );
    expect(Object.values(doc.entities)[0]?.description).toBe('why A holds');
  });

  it('preserves a tp-studio-id as the entity id', () => {
    const doc = importFromFlyingLogic(
      fl(
        `<vertices>${entity('1', 'A', '<attribute key="tp-studio-id">ent-keep-me</attribute>')}</vertices><edges></edges>`
      )
    );
    expect(doc.entities['ent-keep-me']).toBeDefined();
  });
});
