import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

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
