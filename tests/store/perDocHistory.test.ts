/**
 * Multi-doc tabs Phase 3, Batch 2.3 — per-doc history infrastructure.
 * See `docs/MULTI_DOC_TABS_PLAN.md`.
 *
 * Design X (additive, mirrors Batch 2.1's `docs` mirror + 2.2's dual-write):
 * the ACTIVE tab's undo/redo stacks stay canonical in the top-level
 * `past`/`future`, so single-tab undo/redo is byte-for-byte unchanged and
 * every existing history test passes untouched. INACTIVE tabs' stacks park
 * in `historyByDoc`, swapped in/out by `applyTabSwitchHistory` — the pure
 * operation Phase 5's `switchTab` will call. There is NO caller yet (still
 * single-tab); these tests pin the mechanism + the behaviour-preserving
 * invariant that `historyByDoc` stays empty while single-tab.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentId, TPDocument } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { applyTabSwitchHistory, type DocHistory, type HistoryEntry } from '@/store/historySlice';
import { makeDoc } from '../domain/helpers';
import { seedEntity } from '../helpers/seedDoc';

const id = (s: string): DocumentId => s as DocumentId;
const s = () => useDocumentStore.getState();

/** A HistoryEntry tagged by doc title so assertions can name the entries. */
const entry = (title: string, t: number): HistoryEntry => {
  const doc: TPDocument = { ...makeDoc([], []), title };
  return { doc, t };
};
const stacks = (pastTitles: string[], futureTitles: string[]): DocHistory => ({
  past: pastTitles.map((tt, i) => entry(tt, i)),
  future: futureTitles.map((tt, i) => entry(tt, i + 100)),
});
const titles = (es: HistoryEntry[]): string[] => es.map((e) => e.doc.title);

describe('Batch 2.3 — applyTabSwitchHistory (the switchTab history core)', () => {
  it('parks the leaving tab and promotes empty stacks for a fresh entering tab', () => {
    const res = applyTabSwitchHistory({}, id('A'), stacks(['a1', 'a2'], ['af1']), id('B'));
    // Entering B has no parked history → live stacks empty.
    expect(res.past).toEqual([]);
    expect(res.future).toEqual([]);
    // Leaving A's live stacks parked verbatim.
    expect(titles(res.historyByDoc[id('A')]?.past ?? [])).toEqual(['a1', 'a2']);
    expect(titles(res.historyByDoc[id('A')]?.future ?? [])).toEqual(['af1']);
    // No parked entry for B — it's the live tab now.
    expect(res.historyByDoc[id('B')]).toBeUndefined();
  });

  it('promotes a parked entering tab and drops its now-redundant parked copy', () => {
    const existing: Record<DocumentId, DocHistory> = { [id('B')]: stacks(['b1'], ['bf1']) };
    const res = applyTabSwitchHistory(existing, id('A'), stacks(['a1'], []), id('B'));
    // B's parked stacks promoted to live.
    expect(titles(res.past)).toEqual(['b1']);
    expect(titles(res.future)).toEqual(['bf1']);
    // A parked; B's parked copy removed so it can't go stale.
    expect(titles(res.historyByDoc[id('A')]?.past ?? [])).toEqual(['a1']);
    expect(res.historyByDoc[id('B')]).toBeUndefined();
  });

  it('round-trips A→B→A and restores A’s original stacks', () => {
    const toB = applyTabSwitchHistory({}, id('A'), stacks(['a1', 'a2'], []), id('B'));
    // Pretend B accrued some live history, then switch back to A.
    const backToA = applyTabSwitchHistory(
      toB.historyByDoc,
      id('B'),
      stacks(['b1'], ['bf1']),
      id('A')
    );
    expect(titles(backToA.past)).toEqual(['a1', 'a2']); // A restored
    expect(titles(backToA.historyByDoc[id('B')]?.past ?? [])).toEqual(['b1']); // B parked
    expect(backToA.historyByDoc[id('A')]).toBeUndefined(); // A is live now
  });

  it('no-op switch (same id) preserves the live stacks and leaves the map clean', () => {
    const res = applyTabSwitchHistory({}, id('A'), stacks(['x1'], ['xf1']), id('A'));
    expect(titles(res.past)).toEqual(['x1']);
    expect(titles(res.future)).toEqual(['xf1']);
    // The active doc is never parked.
    expect(Object.keys(res.historyByDoc)).toEqual([]);
  });

  it('parks empty stacks when the leaving tab had no history', () => {
    const res = applyTabSwitchHistory({}, id('A'), stacks([], []), id('B'));
    expect(res.historyByDoc[id('A')]).toEqual({ past: [], future: [] });
  });

  it('does not mutate the input map (pure)', () => {
    const input: Record<DocumentId, DocHistory> = { [id('B')]: stacks(['b1'], []) };
    const before = JSON.stringify(input);
    applyTabSwitchHistory(input, id('A'), stacks(['a1'], []), id('B'));
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('Batch 2.3 — single-tab behaviour is unchanged (historyByDoc stays empty)', () => {
  beforeEach(resetStoreForTest);

  it('defaults to an empty map on a fresh store', () => {
    expect(s().historyByDoc).toEqual({});
  });

  it('keeps historyByDoc empty while the active stacks grow + undo/redo run', () => {
    const e = seedEntity('A');
    expect(s().past.length).toBeGreaterThan(0); // active history is live, as before
    expect(s().historyByDoc).toEqual({}); // nothing parked in single-tab

    s().updateEntity(e.id, { title: 'B' });
    s().undo();
    s().redo();
    // Active history still drives undo/redo; no per-doc parking happened.
    expect(s().historyByDoc).toEqual({});
    expect(s().doc.entities[e.id]?.title).toBe('B');
  });
});
