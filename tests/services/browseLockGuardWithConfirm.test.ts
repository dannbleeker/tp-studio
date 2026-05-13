import { confirmAndDeleteEntity } from '@/services/confirmations';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedConnectedPair } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

/**
 * The Browse-Lock contract: when locked, mutating actions must
 * short-circuit BEFORE prompting the user. Showing a confirm dialog
 * and THEN refusing to act would be wrong — the user would see a
 * "Delete?" prompt that does nothing on either answer.
 *
 * Today `confirmAndDeleteEntity` and `confirmAndDeleteSelection` are
 * the only confirm-using paths that don't go through `withWriteGuard`
 * (they're called from context-menu / keyboard handlers directly). The
 * helpers themselves check `browseLocked` via the deletion action
 * inside the store, which silently no-ops. The tests here pin down
 * that the user-facing behavior is "no prompt, no toast, no delete."
 *
 * `withWriteGuard`-wrapped palette commands are covered by their own
 * guard tests; this file is specifically about the confirm-bearing
 * paths that don't use the wrapper.
 */

describe('Browse Lock + ConfirmDialog interaction', () => {
  it('confirmAndDeleteEntity does NOT open a confirm when browseLocked is on', async () => {
    const { a } = seedConnectedPair('A', 'B');
    useDocumentStore.getState().setBrowseLocked(true);
    // Fire-and-forget (no await would race with the assertion).
    void confirmAndDeleteEntity(a.id);
    // Give the microtask queue a tick — if a confirm WAS going to
    // open, it would have set `confirmDialog` by now.
    await new Promise((r) => setTimeout(r, 5));
    expect(useDocumentStore.getState().confirmDialog).toBeNull();
    // The entity is still present — the store's deleteEntity is gated
    // by browseLocked at the slice level.
    expect(useDocumentStore.getState().doc.entities[a.id]).toBeDefined();
  });

  it('unlocking after a lock allows the confirm to open normally', async () => {
    const { a } = seedConnectedPair('A', 'B');
    useDocumentStore.getState().setBrowseLocked(true);
    void confirmAndDeleteEntity(a.id);
    await new Promise((r) => setTimeout(r, 5));
    expect(useDocumentStore.getState().confirmDialog).toBeNull();

    // Unlock and retry — should now produce a prompt.
    useDocumentStore.getState().setBrowseLocked(false);
    void confirmAndDeleteEntity(a.id);
    await new Promise((r) => setTimeout(r, 5));
    expect(useDocumentStore.getState().confirmDialog).not.toBeNull();
    // Tidy up: resolve the pending confirm so the test doesn't leak state.
    useDocumentStore.getState().resolveConfirm(false);
  });
});
