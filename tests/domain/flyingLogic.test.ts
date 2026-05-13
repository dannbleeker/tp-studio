import { EXAMPLE_BY_DIAGRAM } from '@/domain/examples';
/**
 * @vitest-environment jsdom
 */
import { exportToFlyingLogic, importFromFlyingLogic } from '@/domain/flyingLogic';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(() => {
  resetStoreForTest();
  resetIds();
});

describe('exportToFlyingLogic — shape', () => {
  it('emits a <flyingLogic> root with version + uuid', () => {
    const xml = exportToFlyingLogic(makeDoc([], []));
    expect(xml).toMatch(/<flyingLogic\s+majorversion="5"\s+uuid="/);
  });

  it('declares an <entityClass> for every used entity type', () => {
    const a = makeEntity({ type: 'ude', title: 'UDE' });
    const b = makeEntity({ type: 'rootCause', title: 'RC' });
    const xml = exportToFlyingLogic(makeDoc([a, b], []));
    expect(xml).toContain('<entityClass name="Undesirable Effect"/>');
    expect(xml).toContain('<entityClass name="Root Cause"/>');
    // No effect / injection — only used types.
    expect(xml).not.toContain('<entityClass name="Effect"/>');
  });

  it('emits each entity as a <vertex type="entity"> with a title attribute', () => {
    const a = makeEntity({ title: 'Order entry is manual' });
    const xml = exportToFlyingLogic(makeDoc([a], []));
    expect(xml).toMatch(/<vertex eid="\d+" type="entity" entityClass="Effect">/);
    expect(xml).toContain(
      '<attribute key="title" class="java.lang.String">Order entry is manual</attribute>'
    );
  });

  it('emits AND-grouped edges via a junctor vertex (one in per source, one out)', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const target = makeEntity({ title: 'Target' });
    const e1 = makeEdge(a.id, target.id, { andGroupId: 'g1' });
    const e2 = makeEdge(b.id, target.id, { andGroupId: 'g1' });
    const xml = exportToFlyingLogic(makeDoc([a, b, target], [e1, e2]));
    expect(xml).toMatch(/<vertex eid="\d+" type="junctor">/);
    // Two edges into the junctor + one out = 3 edges total when there's exactly one AND.
    const edgeCount = (xml.match(/<edge /g) ?? []).length;
    expect(edgeCount).toBe(3);
  });

  it('escapes XML special characters in titles', () => {
    const a = makeEntity({ title: 'A & B < "test"' });
    const xml = exportToFlyingLogic(makeDoc([a], []));
    expect(xml).toContain('A &amp; B &lt; &quot;test&quot;');
  });
});

describe('importFromFlyingLogic — shape', () => {
  it('rejects non-flyingLogic XML with a descriptive error', () => {
    expect(() => importFromFlyingLogic('<?xml version="1.0"?><foo/>')).toThrow(
      /root element is not <flyingLogic>/
    );
  });

  it('rejects malformed XML', () => {
    expect(() => importFromFlyingLogic('<not closed')).toThrow(/Invalid Flying Logic/);
  });

  it('parses a minimal entity-only document', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<flyingLogic majorversion="5" uuid="abc" instance="x">
  <symbols><entityClass name="Effect"/></symbols>
  <decisionGraph>
    <vertices>
      <vertex eid="1" type="entity" entityClass="Effect">
        <attribute key="title" class="java.lang.String">Hello</attribute>
      </vertex>
    </vertices>
    <edges></edges>
  </decisionGraph>
</flyingLogic>`;
    const doc = importFromFlyingLogic(xml);
    const entities = Object.values(doc.entities);
    expect(entities).toHaveLength(1);
    expect(entities[0]!.title).toBe('Hello');
    expect(entities[0]!.type).toBe('effect');
  });

  it('maps FL entity-class names back to our EntityType', () => {
    const xml = `<?xml version="1.0"?><flyingLogic majorversion="5" uuid="x" instance="x">
  <decisionGraph><vertices>
    <vertex eid="1" type="entity" entityClass="Undesirable Effect"><attribute key="title" class="java.lang.String">UDE</attribute></vertex>
    <vertex eid="2" type="entity" entityClass="Root Cause"><attribute key="title" class="java.lang.String">RC</attribute></vertex>
  </vertices><edges></edges></decisionGraph></flyingLogic>`;
    const doc = importFromFlyingLogic(xml);
    const types = Object.values(doc.entities)
      .map((e) => e.type)
      .sort();
    expect(types).toEqual(['rootCause', 'ude']);
  });
});

describe('round-trip: TP → FL → TP', () => {
  it('preserves entities, edges, and AND grouping through a full round-trip', () => {
    useDocumentStore.getState().setDocument(EXAMPLE_BY_DIAGRAM.crt());
    const original = useDocumentStore.getState().doc;
    const xml = exportToFlyingLogic(original);
    const reimported = importFromFlyingLogic(xml);

    // Entity count + titles match.
    expect(Object.keys(reimported.entities).length).toBe(Object.keys(original.entities).length);
    const titles = (d: typeof original) =>
      Object.values(d.entities)
        .map((e) => e.title)
        .sort();
    expect(titles(reimported)).toEqual(titles(original));

    // Edge count matches (junctors round-trip back into AND groups, so the
    // original `andGroupId`-grouped edges land in TP-Studio form again).
    expect(Object.keys(reimported.edges).length).toBe(Object.keys(original.edges).length);

    // AND groups: same number of grouped edges.
    const andCount = (d: typeof original) =>
      Object.values(d.edges).filter((e) => e.andGroupId).length;
    expect(andCount(reimported)).toBe(andCount(original));
  });

  it('preserves our internal IDs through the round-trip (custom attributes)', () => {
    const a = makeEntity({ title: 'A', annotationNumber: 7 });
    const b = makeEntity({ title: 'B', annotationNumber: 8 });
    const e = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [e]);
    const xml = exportToFlyingLogic(doc);
    const reimported = importFromFlyingLogic(xml);
    // Entity IDs and annotation numbers preserved via custom tp-studio-* attrs.
    expect(reimported.entities[a.id]?.title).toBe('A');
    expect(reimported.entities[a.id]?.annotationNumber).toBe(7);
    expect(reimported.entities[b.id]?.annotationNumber).toBe(8);
    expect(reimported.edges[e.id]).toBeDefined();
  });

  it('preserves edge labels through the round-trip', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const e = makeEdge(a.id, b.id, { label: 'within 30 days' });
    const doc = makeDoc([a, b], [e]);
    const xml = exportToFlyingLogic(doc);
    const reimported = importFromFlyingLogic(xml);
    expect(reimported.edges[e.id]?.label).toBe('within 30 days');
  });
});

describe('importFromFlyingLogic — nested user-saved schema', () => {
  // The FL desktop app's File → Save format differs from the scripting-API
  // shape that our writer emits: it adds a `logicGraph > graph` wrapper,
  // an `<attributes>` container per vertex/edge, and stores entityClass
  // as a nested `<entityClass name="..."/>` child rather than an XML
  // attribute. The reader must accept both shapes. These tests pin the
  // nested form against a hand-crafted minimal fixture so we don't have
  // to ship a real user's .xlogic file.

  const NESTED_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<flyingLogic majorVersion="4" minorVersion="0" uuid="abc">
  <documentInfo author="Tester" comments="Test description" title="Test goal map"/>
  <decisionGraph>
    <logicGraph>
      <graph>
        <vertices>
          <vertex eid="1">
            <attributes>
              <attribute class="java.lang.String" key="type">entity</attribute>
              <attribute class="java.lang.String" key="title">Apex Goal</attribute>
              <attribute class="x" key="entityClass">
                <entityClass name="Goal" uuid="g1"/>
              </attribute>
            </attributes>
          </vertex>
          <vertex eid="2">
            <attributes>
              <attribute class="java.lang.String" key="type">entity</attribute>
              <attribute class="java.lang.String" key="title">Supporting note</attribute>
              <attribute class="x" key="entityClass">
                <entityClass name="Note" uuid="n1"/>
              </attribute>
            </attributes>
          </vertex>
          <vertex eid="3">
            <attributes>
              <attribute class="java.lang.String" key="type">entity</attribute>
              <attribute class="java.lang.String" key="title">Desirable outcome</attribute>
              <attribute class="x" key="entityClass">
                <entityClass name="Desirable Effect" uuid="d1"/>
              </attribute>
            </attributes>
          </vertex>
          <vertex eid="4">
            <attributes>
              <attribute class="java.lang.String" key="type">entity</attribute>
              <attribute class="java.lang.String" key="title">Free-form box</attribute>
              <attribute class="x" key="entityClass">
                <entityClass name="Generic" uuid="x1"/>
              </attribute>
            </attributes>
          </vertex>
        </vertices>
        <edges>
          <edge eid="5" source="2" target="1">
            <attributes>
              <attribute class="java.lang.Double" key="weight">1.0</attribute>
            </attributes>
          </edge>
          <edge eid="6" source="3" target="1"></edge>
          <edge eid="7" source="4" target="1"></edge>
        </edges>
      </graph>
    </logicGraph>
  </decisionGraph>
</flyingLogic>`;

  it('parses the nested logicGraph > graph wrapper structure', () => {
    const doc = importFromFlyingLogic(NESTED_FIXTURE);
    expect(Object.keys(doc.entities)).toHaveLength(4);
    expect(Object.keys(doc.edges)).toHaveLength(3);
  });

  it('reads titles from <attribute key="title"> children inside <attributes>', () => {
    const doc = importFromFlyingLogic(NESTED_FIXTURE);
    const titles = Object.values(doc.entities)
      .map((e) => e.title)
      .sort();
    expect(titles).toEqual(['Apex Goal', 'Desirable outcome', 'Free-form box', 'Supporting note']);
  });

  it('reads entityClass from a nested <entityClass name="..."/> child element', () => {
    const doc = importFromFlyingLogic(NESTED_FIXTURE);
    const apex = Object.values(doc.entities).find((e) => e.title === 'Apex Goal');
    expect(apex?.type).toBe('goal');
  });

  it('maps "Desirable Effect" (the FL spelling variant) to desiredEffect', () => {
    const doc = importFromFlyingLogic(NESTED_FIXTURE);
    const de = Object.values(doc.entities).find((e) => e.title === 'Desirable outcome');
    expect(de?.type).toBe('desiredEffect');
  });

  it('maps Generic / Knowledge fallback to plain effect; Note maps to the native note type', () => {
    const doc = importFromFlyingLogic(NESTED_FIXTURE);
    const note = Object.values(doc.entities).find((e) => e.title === 'Supporting note');
    const generic = Object.values(doc.entities).find((e) => e.title === 'Free-form box');
    // FL-ET7 (Session 72): FL's stock "Note" class round-trips to our
    // new `note` entity type. Generic / Knowledge keep falling back to
    // plain effect (no native analog in TP Studio).
    expect(note?.type).toBe('note');
    expect(generic?.type).toBe('effect');
  });

  it('reads document title/author/description from <documentInfo>', () => {
    const doc = importFromFlyingLogic(NESTED_FIXTURE);
    expect(doc.title).toBe('Test goal map');
    expect(doc.author).toBe('Tester');
    expect(doc.description).toBe('Test description');
  });

  it('connects edges to the correct entities under the nested layout', () => {
    const doc = importFromFlyingLogic(NESTED_FIXTURE);
    const apex = Object.values(doc.entities).find((e) => e.title === 'Apex Goal');
    expect(apex).toBeDefined();
    const incomingToApex = Object.values(doc.edges).filter((e) => e.targetId === apex?.id);
    expect(incomingToApex).toHaveLength(3);
  });

  it('handles junctors expressed in the nested form (AND-grouped edges)', () => {
    const ANDED = `<?xml version="1.0" encoding="UTF-8"?>
<flyingLogic majorVersion="4" minorVersion="0" uuid="abc">
  <decisionGraph><logicGraph><graph>
    <vertices>
      <vertex eid="1">
        <attributes>
          <attribute key="type">entity</attribute>
          <attribute key="title">A</attribute>
          <attribute key="entityClass"><entityClass name="Effect"/></attribute>
        </attributes>
      </vertex>
      <vertex eid="2">
        <attributes>
          <attribute key="type">entity</attribute>
          <attribute key="title">B</attribute>
          <attribute key="entityClass"><entityClass name="Effect"/></attribute>
        </attributes>
      </vertex>
      <vertex eid="3">
        <attributes>
          <attribute key="type">entity</attribute>
          <attribute key="title">Target</attribute>
          <attribute key="entityClass"><entityClass name="Effect"/></attribute>
        </attributes>
      </vertex>
      <vertex eid="J">
        <attributes><attribute key="type">junctor</attribute></attributes>
      </vertex>
    </vertices>
    <edges>
      <edge eid="e1" source="1" target="J"></edge>
      <edge eid="e2" source="2" target="J"></edge>
      <edge eid="e3" source="J" target="3"></edge>
    </edges>
  </graph></logicGraph></decisionGraph>
</flyingLogic>`;
    const doc = importFromFlyingLogic(ANDED);
    expect(Object.keys(doc.entities)).toHaveLength(3); // junctor dropped
    const edges = Object.values(doc.edges);
    expect(edges).toHaveLength(2); // 2 AND-grouped edges into Target
    const grouped = edges.filter((e) => e.andGroupId);
    expect(grouped).toHaveLength(2);
    // Both edges share the same andGroupId.
    expect(grouped[0]?.andGroupId).toBe(grouped[1]?.andGroupId);
  });
});
