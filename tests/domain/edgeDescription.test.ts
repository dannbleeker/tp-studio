import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const doc = () => useDocumentStore.getState().doc;

describe('Edge.description field', () => {
  it('round-trips through JSON when set', () => {
    const { edge } = seedConnectedPair();
    const longText = 'A markdown **explanation** of why this edge holds.\n\n- One point\n- Another';
    useDocumentStore.getState().updateEdge(edge.id, { description: longText });
    const json = exportToJSON(doc());
    const restored = importFromJSON(json);
    expect(restored.edges[edge.id]?.description).toBe(longText);
  });

  it('clears the field when set to undefined', () => {
    const { edge } = seedConnectedPair();
    const state = useDocumentStore.getState();
    state.updateEdge(edge.id, { description: 'something' });
    expect(doc().edges[edge.id]?.description).toBe('something');
    state.updateEdge(edge.id, { description: undefined });
    expect(doc().edges[edge.id]?.description).toBeUndefined();
  });

  it('coexists with label and an edge assumption', () => {
    const { edge } = seedConnectedPair();
    const state = useDocumentStore.getState();
    state.updateEdge(edge.id, { label: 'within 30 days', description: 'long form' });
    state.addAssumptionToEdge(edge.id);
    const e = doc().edges[edge.id];
    expect(e?.label).toBe('within 30 days');
    expect(e?.description).toBe('long form');
    // Record-canonical (v10): the assumption is a `doc.assumptions` record
    // keyed to the edge via `edgeId`, not an `edge.assumptionIds` entry.
    const records = Object.values(doc().assumptions ?? {}).filter((a) => a.edgeId === edge.id);
    expect(records.length).toBe(1);
  });

  it('persistence rejects non-string description', () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().updateEdge(edge.id, { description: 'real' });
    const json = JSON.parse(exportToJSON(doc()));
    // Tamper.
    json.edges[edge.id].description = 42;
    expect(() => importFromJSON(JSON.stringify(json))).toThrow(/non-string description/);
  });
});
