/**
 * Multi-doc tabs Phase 6 — polish: walkthrough-on-switch + forget-closed-doc.
 *
 *  - A guided walkthrough's `targetIds` point at the active doc's edges /
 *    warnings, so any tab transition (open / switch / close) must drop it —
 *    otherwise the overlay renders against a doc that doesn't contain those
 *    ids.
 *  - `forgetClosedDocs` reclaims storage held by documents the user has
 *    closed — their body (Session 184) and any revisions linger after
 *    `closeTab` by design — while leaving every open tab intact.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import { listSavedDocIds } from '@/domain/persistence';
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

  it('also forgets a closed doc with only a body and no revisions (Session 185)', () => {
    const ec = createDocument('ec');
    s().openTab(ec); // saves ec's body, tabs [A, ec]
    s().closeTab(ec.id); // ec closed → body kept (reopenable), but it has NO revisions
    expect(s().tabOrder).not.toContain(ec.id);
    // Pre-Session-185 this committed-only body was invisible to forgetClosedDocs
    // (it scanned the revisions map); now it's swept too.
    expect(listSavedDocIds()).toContain(ec.id);
    const { docsForgotten } = s().forgetClosedDocs();
    expect(docsForgotten).toBe(1);
    expect(listSavedDocIds()).not.toContain(ec.id); // body gone — no longer reopenable
  });

  it('is a no-op when every saved doc is still open', () => {
    s().captureSnapshot('rev');
    const { docsForgotten, revisionsDropped } = s().forgetClosedDocs();
    expect(docsForgotten).toBe(0);
    expect(revisionsDropped).toBe(0);
  });
});

describe('Phase 6 follow-up — walkthrough drops on a doc replace / new', () => {
  it('replacing the active doc (setDocument, the replace-mode load path) closes it', () => {
    s().startReadThrough(['e1']);
    expect(s().walkthrough.kind).toBe('read-through');
    s().setDocument(createDocument('frt'));
    expect(s().walkthrough.kind).toBe('closed');
  });

  it('creating a new document closes it', () => {
    s().startReadThrough(['e1']);
    s().newDocument('frt');
    expect(s().walkthrough.kind).toBe('closed');
  });
});
