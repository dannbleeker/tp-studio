import { confirmAndDeleteEntity } from '@/services/confirmations';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

// Local aliases over the shared seedDoc helpers.
const addEntity = (title = 'Node') => seedEntity(title);

const connect = (sourceId: string, targetId: string) =>
  useDocumentStore.getState().connect(sourceId, targetId);

/**
 * The confirm helpers used to delegate to `window.confirm` (synchronous,
 * thread-blocking). They now use the store's async `confirm()` action,
 * which opens an in-app ConfirmDialog and returns a Promise<boolean>.
 *
 * Tests drive the async flow by:
 *   1. Calling `confirmAndDeleteEntity(...)` (don't await).
 *   2. Polling `state.confirmDialog` until it's non-null.
 *   3. Resolving via `state.resolveConfirm(true|false)`.
 *   4. Awaiting the original promise.
 */
const settleNextConfirm = (answer: boolean): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    // Poll for the open confirm. Vitest's fake-timers aren't on for this
    // suite, so a small polling loop is the cheap way to wait for the
    // microtask that opens the dialog.
    const start = Date.now();
    const tick = () => {
      const cur = useDocumentStore.getState().confirmDialog;
      if (cur) {
        const msg = cur.message;
        useDocumentStore.getState().resolveConfirm(answer);
        resolve(msg);
        return;
      }
      if (Date.now() - start > 1000) {
        reject(new Error('Timeout waiting for ConfirmDialog to open'));
        return;
      }
      setTimeout(tick, 5);
    };
    tick();
  });

describe('confirmAndDeleteEntity', () => {
  it('deletes silently when the entity has no connections', async () => {
    const a = addEntity('Lonely');
    await confirmAndDeleteEntity(a.id);
    expect(useDocumentStore.getState().doc.entities[a.id]).toBeUndefined();
    // No confirm was opened.
    expect(useDocumentStore.getState().confirmDialog).toBeNull();
  });

  it('prompts with the connection count when the entity has edges', async () => {
    const a = addEntity('Cause');
    const b = addEntity('Effect');
    connect(a.id, b.id);

    const pending = confirmAndDeleteEntity(a.id);
    const prompt = await settleNextConfirm(true);
    await pending;

    expect(prompt).toContain('Cause');
    expect(prompt).toContain('1 connection');
    expect(useDocumentStore.getState().doc.entities[a.id]).toBeUndefined();
  });

  it('uses plural "connections" when more than one', async () => {
    const a = addEntity('Hub');
    const b = addEntity('B');
    const c = addEntity('C');
    connect(a.id, b.id);
    connect(a.id, c.id);

    const pending = confirmAndDeleteEntity(a.id);
    const prompt = await settleNextConfirm(true);
    await pending;

    expect(prompt).toContain('2 connections');
  });

  it('does nothing when the user cancels the confirm', async () => {
    const a = addEntity('Cause');
    const b = addEntity('Effect');
    connect(a.id, b.id);

    const pending = confirmAndDeleteEntity(a.id);
    await settleNextConfirm(false);
    await pending;

    expect(useDocumentStore.getState().doc.entities[a.id]).toBeDefined();
  });

  it('is a no-op for an unknown id', async () => {
    await confirmAndDeleteEntity('does-not-exist');
    expect(useDocumentStore.getState().confirmDialog).toBeNull();
  });

  it('uses "this entity" as a fallback label when title is blank', async () => {
    const a = addEntity('   ');
    const b = addEntity('B');
    connect(a.id, b.id);

    const pending = confirmAndDeleteEntity(a.id);
    const prompt = await settleNextConfirm(true);
    await pending;

    expect(prompt).toContain('this entity');
  });
});
