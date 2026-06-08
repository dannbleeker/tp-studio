import { describe, expect, it } from 'vitest';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { makeDoc, makeEntity, resetIds } from './helpers';

/**
 * `importFromJSON` validates in two tiers: structural / non-recoverable fields
 * (id, diagramType, schemaVersion, the graph records) throw and reject the doc;
 * cosmetic / recoverable fields soft-degrade to a sane default so one bad value
 * never costs the user the whole document on load (`tryParseDoc` would otherwise
 * drop it and fall back to a backup slot). These pin the soft-degrade tier — and
 * the structural boundary that must STILL throw.
 */
const baseJson = (): Record<string, unknown> => {
  resetIds();
  const e = makeEntity({ title: 'A', annotationNumber: 5 });
  return JSON.parse(exportToJSON(makeDoc([e], []))) as Record<string, unknown>;
};

describe('importFromJSON — cosmetic fields soft-degrade instead of failing the load', () => {
  it('resets a resolvedWarnings map with non-true values to {}', () => {
    const json = baseJson();
    json.resolvedWarnings = { 'some-rule': 1 };
    expect(importFromJSON(JSON.stringify(json)).resolvedWarnings).toEqual({});
  });

  it('resets a non-object resolvedWarnings to {}', () => {
    const json = baseJson();
    json.resolvedWarnings = 'nope';
    expect(importFromJSON(JSON.stringify(json)).resolvedWarnings).toEqual({});
  });

  it('keeps a well-formed resolvedWarnings map', () => {
    const json = baseJson();
    json.resolvedWarnings = { 'rule-1': true };
    expect(importFromJSON(JSON.stringify(json)).resolvedWarnings).toEqual({ 'rule-1': true });
  });

  it('drops a non-string author / description rather than throwing, but keeps valid strings', () => {
    const bad = baseJson();
    bad.author = 123;
    bad.description = { not: 'a string' };
    const badDoc = importFromJSON(JSON.stringify(bad));
    expect(badDoc.author).toBeUndefined();
    expect(badDoc.description).toBeUndefined();

    const good = baseJson();
    good.author = 'Dann';
    good.description = 'A real description.';
    const goodDoc = importFromJSON(JSON.stringify(good));
    expect(goodDoc.author).toBe('Dann');
    expect(goodDoc.description).toBe('A real description.');
  });

  it('rebuilds a non-number nextAnnotationNumber from max(annotation) + 1', () => {
    const json = baseJson();
    // The one entity has annotationNumber 5, so the counter recomputes to 6.
    json.nextAnnotationNumber = 'corrupt';
    expect(importFromJSON(JSON.stringify(json)).nextAnnotationNumber).toBe(6);
  });

  it('drops edges whose endpoints no longer resolve to an entity', () => {
    resetIds();
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const json = JSON.parse(exportToJSON(makeDoc([a, b], []))) as Record<string, unknown>;
    // A valid edge a->b plus a dangling edge whose target is a ghost id — only
    // reachable via a malformed / hand-edited import (validateEdge checks shape,
    // not endpoint existence).
    json.edges = {
      keep: { id: 'keep', sourceId: a.id, targetId: b.id, kind: 'sufficiency' },
      drop: { id: 'drop', sourceId: a.id, targetId: 'ghost', kind: 'sufficiency' },
    };
    const imported = importFromJSON(JSON.stringify(json));
    expect(imported.edges.keep).toBeDefined();
    expect(imported.edges.drop).toBeUndefined();
  });
});

describe('importFromJSON — structural fields still reject the document', () => {
  it('throws on a non-string id', () => {
    const json = baseJson();
    json.id = 5;
    expect(() => importFromJSON(JSON.stringify(json))).toThrow(/id/);
  });

  it('throws on a bad diagramType', () => {
    const json = baseJson();
    json.diagramType = 'nope';
    expect(() => importFromJSON(JSON.stringify(json))).toThrow(/diagramType/);
  });
});
