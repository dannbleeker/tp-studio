/**
 * Multi-doc tabs Phase 6 — polish: walkthrough-on-switch + forget-closed-doc.
 *
 *  - A guided walkthrough's `targetIds` point at the active doc's edges /
 *    warnings, so any tab transition (open / switch / close) must drop it —
 *    otherwise the overlay renders against a doc that doesn't contain those
 *    ids.
 *  - `forgetClosedDocs` reclaims storage held by documents the user has
 *    closed (their revisions linger after `closeTab` by design) while
 *    leaving every open tab's history intact.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import { resetStoreForTest, useDocumentStore } from '@/store';

const s = () => useDocumentStore.getState();

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});

describe('Phase 6 — walkthrough drops on a tab transition', () => {
  it('opening a new tab closes an active walkthrough', () => {
    s().startReadThrough(['e1', 'e2']);
    expect(s().walkthrough.kind).toBe('read-through');
    s().openTab(createDocument('frt'));
    expect(s().walkthrough.kind).toBe('closed');
  });

  it('switching tabs closes an active walkthrough', () => {
    const aId = s().activeDocId;
    s().openTab(createDocument('frt')); // active = B
    s().startReadThrough(['e1']);
    expect(s().walkthrough.kind).toBe('read-through');
    s().switchTab(aId);
    expect(s().walkthrough.kind).toBe('closed');
  });

  it('closing the active tab closes an active walkthrough', () => {
    s().openTab(createDocument('frt')); // active = B
    s().startReadThrough(['e1']);
    s().closeTab(s().activeDocId);
    expect(s().walkthrough.kind).toBe('closed');
  });
});

describe('Phase 6 — forgetClosedDocs', () => {
  it('purges revisions for closed docs but keeps every open tab', () => {
    const aId = s().activeDocId;
    s().captureSnapshot('A rev'); // doc A gets a revision in storage
    s().openTab(createDocument('frt')); // tabs [A, B], active = B
    s().captureSnapshot('B rev'); // doc B gets a revision
    s().closeTab(aId); // A closed → its revisions linger, A not in tabOrder
    expect(s().tabOrder).not.toContain(aId);

    const { docsForgotten, revisionsDropped } = s().forgetClosedDocs();

    expect(docsForgotten).toBe(1);
    expect(revisionsDropped).toBe(1);
    // The still-open doc keeps its history.
    expect(s().revisions.length).toBeGreaterThanOrEqual(1);
  });

  it('is a no-op when every saved doc is still open', () => {
    s().captureSnapshot('rev');
    const { docsForgotten, revisionsDropped } = s().forgetClosedDocs();
    expect(docsForgotten).toBe(0);
    expect(revisionsDropped).toBe(0);
  });
});
