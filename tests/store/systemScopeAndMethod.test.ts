import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const doc = () => useDocumentStore.getState().doc;

describe('setSystemScope', () => {
  it('merges new fields onto an empty scope', () => {
    useDocumentStore.getState().setSystemScope({ goal: 'Ship the thing' });
    expect(doc().systemScope?.goal).toBe('Ship the thing');
  });

  it('preserves existing fields when patching a different one', () => {
    useDocumentStore.getState().setSystemScope({ goal: 'A' });
    useDocumentStore.getState().setSystemScope({ boundaries: 'B' });
    expect(doc().systemScope?.goal).toBe('A');
    expect(doc().systemScope?.boundaries).toBe('B');
  });

  it('clears a field when patched with empty / whitespace-only string', () => {
    useDocumentStore.getState().setSystemScope({ goal: 'A' });
    useDocumentStore.getState().setSystemScope({ goal: '' });
    expect(doc().systemScope?.goal).toBeUndefined();
  });

  it('drops the whole systemScope object when last field clears', () => {
    useDocumentStore.getState().setSystemScope({ goal: 'A' });
    useDocumentStore.getState().setSystemScope({ goal: '' });
    expect(doc().systemScope).toBeUndefined();
  });

  it('no-ops when patching with the same value', () => {
    useDocumentStore.getState().setSystemScope({ goal: 'A' });
    const before = doc();
    useDocumentStore.getState().setSystemScope({ goal: 'A' });
    expect(doc()).toBe(before);
  });
});

describe('setMethodStep', () => {
  it('adds a step to the checklist when toggled on', () => {
    useDocumentStore.getState().setMethodStep('crt.scope', true);
    expect(doc().methodChecklist?.['crt.scope']).toBe(true);
  });

  it('removes a step when toggled off', () => {
    useDocumentStore.getState().setMethodStep('crt.scope', true);
    useDocumentStore.getState().setMethodStep('crt.scope', false);
    expect(doc().methodChecklist?.['crt.scope']).toBeUndefined();
  });

  it('drops the whole methodChecklist when the last step clears', () => {
    useDocumentStore.getState().setMethodStep('crt.scope', true);
    useDocumentStore.getState().setMethodStep('crt.scope', false);
    expect(doc().methodChecklist).toBeUndefined();
  });

  it('handles multiple steps independently', () => {
    const s = useDocumentStore.getState();
    s.setMethodStep('crt.scope', true);
    s.setMethodStep('crt.udes', true);
    s.setMethodStep('crt.scope', false);
    expect(doc().methodChecklist?.['crt.scope']).toBeUndefined();
    expect(doc().methodChecklist?.['crt.udes']).toBe(true);
  });

  it('no-ops when toggling an already-checked step on', () => {
    useDocumentStore.getState().setMethodStep('crt.scope', true);
    const before = doc();
    useDocumentStore.getState().setMethodStep('crt.scope', true);
    expect(doc()).toBe(before);
  });
});

describe('JSON round-trip', () => {
  it('preserves systemScope through export / import', () => {
    useDocumentStore.getState().setSystemScope({
      goal: 'Drive down support wait time',
      successMeasures: 'p90 wait < 4h',
    });
    const json = exportToJSON(doc());
    const restored = importFromJSON(json);
    expect(restored.systemScope?.goal).toBe('Drive down support wait time');
    expect(restored.systemScope?.successMeasures).toBe('p90 wait < 4h');
  });

  it('preserves methodChecklist through export / import', () => {
    const s = useDocumentStore.getState();
    s.setMethodStep('crt.scope', true);
    s.setMethodStep('crt.core', true);
    const json = exportToJSON(doc());
    const restored = importFromJSON(json);
    expect(restored.methodChecklist?.['crt.scope']).toBe(true);
    expect(restored.methodChecklist?.['crt.core']).toBe(true);
    expect(restored.methodChecklist?.['crt.udes']).toBeUndefined();
  });

  it('drops malformed systemScope sub-fields on import (non-string values)', () => {
    const s = useDocumentStore.getState();
    s.setSystemScope({ goal: 'real value' });
    // Tamper with the export.
    const json = JSON.parse(exportToJSON(doc()));
    json.systemScope = { goal: 42, boundaries: 'real' };
    const restored = importFromJSON(JSON.stringify(json));
    expect(restored.systemScope?.goal).toBeUndefined(); // numeric → dropped
    expect(restored.systemScope?.boundaries).toBe('real');
  });

  it('drops malformed methodChecklist entries on import (non-true values)', () => {
    const s = useDocumentStore.getState();
    s.setMethodStep('crt.scope', true);
    const json = JSON.parse(exportToJSON(doc()));
    json.methodChecklist = { 'crt.scope': true, 'crt.udes': false, 'crt.core': 'yes' };
    const restored = importFromJSON(JSON.stringify(json));
    expect(restored.methodChecklist?.['crt.scope']).toBe(true);
    expect(restored.methodChecklist?.['crt.udes']).toBeUndefined();
    expect(restored.methodChecklist?.['crt.core']).toBeUndefined();
  });
});
