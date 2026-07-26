import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Session-68 #10: `showToast` deduplicates against the queue so a single
 * edit firing several validators doesn't stack identical toasts. The
 * dedup key is `(kind, message)` — different kinds or different messages
 * coexist; identical pairs collapse.
 *
 * The queue auto-dismisses on a timer; these tests assert the dedup
 * behavior synchronously by inspecting `toasts` immediately after the
 * showToast calls, before the dismiss timer fires.
 */

beforeEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('showToast dedup', () => {
  it('drops a second identical (kind, message) while the first is still on the queue', () => {
    const { showToast } = useDocumentStore.getState();
    showToast('info', 'Saved.');
    showToast('info', 'Saved.');
    expect(useDocumentStore.getState().toasts).toHaveLength(1);
  });

  it('keeps two messages with different text', () => {
    const { showToast } = useDocumentStore.getState();
    showToast('info', 'Saved.');
    showToast('info', 'Exported.');
    expect(useDocumentStore.getState().toasts).toHaveLength(2);
  });

  it('keeps the same message at two different kinds', () => {
    const { showToast } = useDocumentStore.getState();
    showToast('info', 'Saved.');
    showToast('error', 'Saved.');
    expect(useDocumentStore.getState().toasts).toHaveLength(2);
  });
});

/**
 * Session 209 — the dedupe keyed on (kind, message) alone, ignoring the attached
 * action. Deleting two trees both titled "Untitled" produced the same message
 * twice, and the second toast was dropped along with its Undo — whose closure
 * held the only remaining copy of the deleted document body. The dedupe exists
 * to stop repeated notifications piling up, not to discard an offer.
 */
describe('toasts carrying an action are never deduped', () => {
  it('keeps both toasts when the message repeats but each has its own Undo', () => {
    const runs: string[] = [];
    s().showToast('info', 'Deleted “Untitled”.', {
      action: { label: 'Undo', run: () => runs.push('first') },
    });
    s().showToast('info', 'Deleted “Untitled”.', {
      action: { label: 'Undo', run: () => runs.push('second') },
    });

    const matching = s().toasts.filter((t) => t.message === 'Deleted “Untitled”.');
    expect(matching).toHaveLength(2);
    for (const t of matching) t.action?.run();
    expect(runs).toEqual(['first', 'second']);
  });

  it('still dedupes plain notifications with no action', () => {
    s().showToast('info', 'Same thing');
    s().showToast('info', 'Same thing');
    expect(s().toasts.filter((t) => t.message === 'Same thing')).toHaveLength(1);
  });
});
