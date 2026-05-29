/**
 * Multi-doc tabs Phase 5, Batch 5.2b — tab palette commands.
 *
 * The portable tab controls (reachable via Cmd+K everywhere, unlike the
 * browser-shadowed Cmd+T/W/1-9). Each command's `run` is exercised against
 * the live store.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { tabCommands } from '@/components/command-palette/commands/tabs';
import { createDocument } from '@/domain/factory';
import { resetStoreForTest, useDocumentStore } from '@/store';

const s = () => useDocumentStore.getState();
const run = (id: string): void => {
  const cmd = tabCommands.find((c) => c.id === id);
  if (!cmd) throw new Error(`no tab command "${id}"`);
  void cmd.run(useDocumentStore.getState());
};

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});

describe('Batch 5.2b — tab palette commands', () => {
  it('registers the five tab commands', () => {
    expect(tabCommands.map((c) => c.id).sort()).toEqual([
      'close-tab',
      'duplicate-tab',
      'new-tab',
      'next-tab',
      'previous-tab',
    ]);
  });

  it('New tab opens a new tab', () => {
    const before = s().tabOrder.length;
    run('new-tab');
    expect(s().tabOrder.length).toBe(before + 1);
  });

  it('Duplicate tab creates an independent (copy)', () => {
    s().setTitle('Orig');
    run('duplicate-tab');
    expect(s().doc.title).toBe('Orig (copy)');
    expect(s().tabOrder).toHaveLength(2);
  });

  it('Next / Previous cycle the active tab (with wraparound)', () => {
    const aId = s().activeDocId;
    s().openTab(createDocument('frt')); // [A, B], active = B
    const bId = s().activeDocId;
    run('next-tab'); // B → wraps to A
    expect(s().activeDocId).toBe(aId);
    run('previous-tab'); // A → wraps to B
    expect(s().activeDocId).toBe(bId);
  });

  it('Close tab closes the active tab', () => {
    const aId = s().activeDocId;
    s().openTab(createDocument('frt')); // active = B
    run('close-tab');
    expect(s().tabOrder).toEqual([aId]);
    expect(s().activeDocId).toBe(aId);
  });
});
