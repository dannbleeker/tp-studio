import { confirmAndDeleteEntity } from '@/services/confirmations';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(resetStoreForTest);

const originalConfirm = globalThis.confirm;
afterEach(() => {
  globalThis.confirm = originalConfirm;
});

const addEntity = (title = 'Node') =>
  useDocumentStore.getState().addEntity({ type: 'effect', title });

const connect = (sourceId: string, targetId: string) =>
  useDocumentStore.getState().connect(sourceId, targetId);

describe('confirmAndDeleteEntity', () => {
  it('deletes silently when the entity has no connections', () => {
    const a = addEntity('Lonely');
    const confirmSpy = vi.fn(() => true);
    globalThis.confirm = confirmSpy;

    confirmAndDeleteEntity(a.id);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().doc.entities[a.id]).toBeUndefined();
  });

  it('prompts with the connection count when the entity has edges', () => {
    const a = addEntity('Cause');
    const b = addEntity('Effect');
    connect(a.id, b.id);
    let prompt = '';
    globalThis.confirm = (message?: string) => {
      prompt = message ?? '';
      return true;
    };

    confirmAndDeleteEntity(a.id);

    expect(prompt).toContain('Cause');
    expect(prompt).toContain('1 connection');
    expect(useDocumentStore.getState().doc.entities[a.id]).toBeUndefined();
  });

  it('uses plural "connections" when more than one', () => {
    const a = addEntity('Hub');
    const b = addEntity('B');
    const c = addEntity('C');
    connect(a.id, b.id);
    connect(a.id, c.id);
    let prompt = '';
    globalThis.confirm = (message?: string) => {
      prompt = message ?? '';
      return true;
    };

    confirmAndDeleteEntity(a.id);

    expect(prompt).toContain('2 connections');
  });

  it('does nothing when the user cancels the confirm', () => {
    const a = addEntity('Cause');
    const b = addEntity('Effect');
    connect(a.id, b.id);
    globalThis.confirm = () => false;

    confirmAndDeleteEntity(a.id);

    expect(useDocumentStore.getState().doc.entities[a.id]).toBeDefined();
  });

  it('is a no-op for an unknown id', () => {
    const confirmSpy = vi.fn(() => true);
    globalThis.confirm = confirmSpy;

    confirmAndDeleteEntity('does-not-exist');

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('uses "this entity" as a fallback label when title is blank', () => {
    const a = addEntity('   ');
    const b = addEntity('B');
    connect(a.id, b.id);
    let prompt = '';
    globalThis.confirm = (message?: string) => {
      prompt = message ?? '';
      return true;
    };

    confirmAndDeleteEntity(a.id);

    expect(prompt).toContain('this entity');
  });
});
