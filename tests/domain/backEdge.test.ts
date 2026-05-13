import { cycleRule, validate } from '@/domain/validators';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const docState = () => useDocumentStore.getState().doc;

describe('back-edge flag + cycle rule exemption', () => {
  it('cycle rule fires by default on a 3-cycle', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const state = useDocumentStore.getState();
    state.connect(a.id, b.id);
    state.connect(b.id, c.id);
    state.connect(c.id, a.id);
    const warnings = cycleRule(docState());
    expect(warnings).toHaveLength(1);
  });

  it('cycle rule stays silent when any edge in the cycle is flagged isBackEdge', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const state = useDocumentStore.getState();
    state.connect(a.id, b.id);
    state.connect(b.id, c.id);
    const closing = state.connect(c.id, a.id);
    expect(closing).not.toBeNull();
    if (!closing) return;
    // Tag the closing edge as a back-edge — user has acknowledged the loop.
    useDocumentStore.getState().updateEdge(closing.id, { isBackEdge: true });
    const warnings = cycleRule(docState());
    expect(warnings).toEqual([]);
  });

  it('cycle rule still fires when a different cycle has no back-edge tagged', () => {
    // Two disjoint cycles. Tag back-edge only on the first.
    const a = seedEntity('A1');
    const b = seedEntity('B1');
    const state = useDocumentStore.getState();
    state.connect(a.id, b.id);
    const closing1 = state.connect(b.id, a.id);
    if (!closing1) return;
    useDocumentStore.getState().updateEdge(closing1.id, { isBackEdge: true });

    const c = seedEntity('C2');
    const d = seedEntity('D2');
    state.connect(c.id, d.id);
    state.connect(d.id, c.id);

    const warnings = cycleRule(docState());
    expect(warnings).toHaveLength(1);
  });

  it('flag survives a JSON round-trip', async () => {
    const { exportToJSON, importFromJSON } = await import('@/domain/persistence');
    const a = seedEntity('A');
    const b = seedEntity('B');
    const state = useDocumentStore.getState();
    state.connect(a.id, b.id);
    const back = state.connect(b.id, a.id);
    if (!back) return;
    useDocumentStore.getState().updateEdge(back.id, { isBackEdge: true });
    const json = exportToJSON(docState());
    const doc = importFromJSON(json);
    expect(doc.edges[back.id]?.isBackEdge).toBe(true);
  });

  it('full validate() pipeline tags the warning with the existence tier when it fires', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const state = useDocumentStore.getState();
    state.connect(a.id, b.id);
    state.connect(b.id, a.id);
    const warnings = validate(docState()).filter((w) => w.ruleId === 'cycle');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.tier).toBe('existence');
  });
});
