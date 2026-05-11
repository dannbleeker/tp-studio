import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  clearLocalStorage,
  exportToJSON,
  importFromJSON,
  loadFromLocalStorage,
  saveToLocalStorage,
} from '../../src/domain/persistence';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(() => {
  resetIds();
  localStorage.clear();
});

const sampleDoc = () => {
  const a = makeEntity({ type: 'rootCause', title: 'Root' });
  const b = makeEntity({ type: 'effect', title: 'Intermediate' });
  const c = makeEntity({ type: 'ude', title: 'Customer churn' });
  const ab = makeEdge(a.id, b.id);
  const bc = makeEdge(b.id, c.id);
  return makeDoc([a, b, c], [ab, bc], 'crt');
};

describe('exportToJSON / importFromJSON', () => {
  it('round-trips a document', () => {
    const doc = sampleDoc();
    const json = exportToJSON(doc);
    const restored = importFromJSON(json);
    expect(restored).toEqual(doc);
  });

  it('throws on invalid JSON', () => {
    expect(() => importFromJSON('not json')).toThrow(/not valid JSON/);
  });

  it('throws on unsupported schemaVersion', () => {
    const bad = JSON.stringify({ ...sampleDoc(), schemaVersion: 99 });
    expect(() => importFromJSON(bad)).toThrow(/Unsupported schemaVersion/);
  });

  it('throws on bad diagramType', () => {
    const doc = sampleDoc();
    const bad = JSON.stringify({ ...doc, diagramType: 'pt' });
    expect(() => importFromJSON(bad)).toThrow(/bad diagramType/);
  });

  it('throws on malformed entity', () => {
    const doc = sampleDoc();
    const malformed = {
      ...doc,
      entities: { ...doc.entities, broken: { id: 'broken' } },
    };
    expect(() => importFromJSON(JSON.stringify(malformed))).toThrow(/entities/);
  });

  it('defaults resolvedWarnings when absent', () => {
    const { resolvedWarnings: _omit, ...stripped } = sampleDoc();
    const restored = importFromJSON(JSON.stringify(stripped));
    expect(restored.resolvedWarnings).toEqual({});
  });
});

describe('localStorage round-trip', () => {
  it('saves and loads under the canonical key', () => {
    const doc = sampleDoc();
    saveToLocalStorage(doc);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(loadFromLocalStorage()).toEqual(doc);
  });

  it('returns null when nothing is stored', () => {
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('returns null and survives corrupt storage', () => {
    localStorage.setItem(STORAGE_KEY, '{ corrupt');
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('clears the entry', () => {
    saveToLocalStorage(sampleDoc());
    clearLocalStorage();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
