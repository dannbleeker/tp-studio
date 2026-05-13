import { exportToMermaid } from '@/domain/mermaidExport';
import { importFromMermaid } from '@/domain/mermaidImport';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedAndGroupable, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('importFromMermaid — basics', () => {
  it('parses a minimal graph with two nodes and one edge', () => {
    const mmd = `graph BT
  a["Hello A"]
  b["Hello B"]
  a --> b
`;
    const doc = importFromMermaid(mmd);
    expect(Object.keys(doc.entities)).toHaveLength(2);
    expect(Object.keys(doc.edges)).toHaveLength(1);
    const titles = Object.values(doc.entities)
      .map((e) => e.title)
      .sort();
    expect(titles).toEqual(['Hello A', 'Hello B']);
  });

  it('picks up the frontmatter title and the graph direction', () => {
    const mmd = `---
title: My CRT
---
graph TB
  a["A"]
`;
    const doc = importFromMermaid(mmd);
    expect(doc.title).toBe('My CRT');
    expect(doc.layoutConfig?.direction).toBe('TB');
  });

  it('treats TD as a synonym for TB', () => {
    const doc = importFromMermaid(`graph TD\n  a["A"]\n`);
    expect(doc.layoutConfig?.direction).toBe('TB');
  });

  it('throws on a document with no nodes', () => {
    expect(() => importFromMermaid('')).toThrow(/no nodes found/);
    expect(() => importFromMermaid('graph BT\n')).toThrow(/no nodes found/);
  });

  it('decodes <br/> as a newline and &quot; as a literal quote', () => {
    const mmd = `graph BT
  a["Line one<br/>Line &quot;two&quot;"]
`;
    const doc = importFromMermaid(mmd);
    const e = Object.values(doc.entities)[0];
    expect(e?.title).toBe('Line one\nLine "two"');
  });

  it('strips the "#N TypeName" preamble our exporter emits', () => {
    const mmd = `graph BT
  a["#3 Undesirable Effect<br/>Real title here"]
`;
    const doc = importFromMermaid(mmd);
    const e = Object.values(doc.entities)[0];
    expect(e?.title).toBe('Real title here');
  });

  it('applies class declarations to entity types', () => {
    const mmd = `graph BT
  a["A"]
  b["B"]
  classDef type_ude stroke:#dc2626
  class a type_ude;
  class b type_effect;
`;
    const doc = importFromMermaid(mmd);
    const types = new Map(Object.values(doc.entities).map((e) => [e.title, e.type]));
    expect(types.get('A')).toBe('ude');
    expect(types.get('B')).toBe('effect');
  });

  it('parses edges with inline labels', () => {
    const mmd = `graph BT
  a["A"]
  b["B"]
  a -->|"within 30 days"| b
`;
    const doc = importFromMermaid(mmd);
    const edge = Object.values(doc.edges)[0];
    expect(edge?.label).toBe('within 30 days');
  });

  it('groups ==> edges to the same target into one andGroupId', () => {
    const mmd = `graph BT
  a["A"]
  b["B"]
  c["C"]
  a ==> c
  b ==> c
`;
    const doc = importFromMermaid(mmd);
    const edges = Object.values(doc.edges);
    expect(edges).toHaveLength(2);
    const groupIds = new Set(edges.map((e) => e.andGroupId));
    expect(groupIds.size).toBe(1);
    expect([...groupIds][0]).toBeTruthy();
  });

  it('tolerates subgraph / end blocks without bringing back groups', () => {
    const mmd = `graph BT
  subgraph Group1
    a["A"]
    b["B"]
  end
  a --> b
`;
    const doc = importFromMermaid(mmd);
    expect(Object.keys(doc.entities)).toHaveLength(2);
    expect(Object.keys(doc.edges)).toHaveLength(1);
    expect(Object.keys(doc.groups)).toHaveLength(0);
  });

  it('quietly skips unknown lines instead of throwing', () => {
    const mmd = `graph BT
  %% a comment
  a["A"]
  some other nonsense here
  a --> b
`;
    const doc = importFromMermaid(mmd);
    expect(Object.keys(doc.entities).length).toBeGreaterThan(0);
  });

  it('tolerates missing class for a node (defaults to effect)', () => {
    const doc = importFromMermaid(`graph BT\n  a["A"]\n`);
    const e = Object.values(doc.entities)[0];
    expect(e?.type).toBe('effect');
  });
});

describe('importFromMermaid — round-trip via our exporter', () => {
  it('preserves entity titles + edge connectivity end-to-end', () => {
    seedConnectedPair('Cause A', 'Effect B');
    const original = useDocumentStore.getState().doc;
    const mmd = exportToMermaid(original);
    const restored = importFromMermaid(mmd);
    const origTitles = Object.values(original.entities)
      .map((e) => e.title)
      .sort();
    const restoredTitles = Object.values(restored.entities)
      .map((e) => e.title)
      .sort();
    expect(restoredTitles).toEqual(origTitles);
    expect(Object.keys(restored.edges).length).toBe(Object.keys(original.edges).length);
  });

  it('preserves entity types on round-trip', () => {
    seedEntity('UDE one', 'ude');
    seedEntity('Root one', 'rootCause');
    const original = useDocumentStore.getState().doc;
    const restored = importFromMermaid(exportToMermaid(original));
    const restoredTypes = Object.values(restored.entities)
      .map((e) => e.type)
      .sort();
    expect(restoredTypes).toEqual(['rootCause', 'ude']);
  });

  it('preserves AND-grouped edges through the round-trip', () => {
    const { e1, e2 } = seedAndGroupable();
    const grouped = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    expect(grouped.ok).toBe(true);
    const restored = importFromMermaid(exportToMermaid(useDocumentStore.getState().doc));
    const grpIds = new Set(
      Object.values(restored.edges)
        .map((e) => e.andGroupId)
        .filter(Boolean)
    );
    expect(grpIds.size).toBe(1);
    expect(Object.values(restored.edges).filter((e) => e.andGroupId).length).toBe(2);
  });
});
