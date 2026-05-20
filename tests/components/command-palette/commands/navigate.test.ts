import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { navigateCommands } from '@/components/command-palette/commands/navigate';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedChain, seedConnectedPair } from '../../../helpers/seedDoc';
import { findCommand, runCommand } from './helpers';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('navigateCommands — open-search', () => {
  it('opens the search panel', async () => {
    await runCommand(findCommand(navigateCommands, 'open-search'));
    expect(s().searchOpen).toBe(true);
  });
});

describe('navigateCommands — select-path-between', () => {
  it('selects the entities on the path between two endpoints', async () => {
    const { entities } = seedChain(['A', 'B', 'C', 'D']);
    const first = entities[0]!;
    const last = entities[entities.length - 1]!;
    useDocumentStore.getState().selectEntities([first.id, last.id]);
    await runCommand(findCommand(navigateCommands, 'select-path-between'));
    const sel = s().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind !== 'entities') return;
    // Path includes both endpoints plus the intermediates.
    expect(sel.ids.length).toBe(4);
  });

  it('toasts info when not exactly two entities are selected', async () => {
    const { a } = seedConnectedPair();
    useDocumentStore.getState().selectEntities([a.id]);
    await runCommand(findCommand(navigateCommands, 'select-path-between'));
    expect(s().toasts.some((t) => /exactly two entities/i.test(t.message))).toBe(true);
  });
});

describe('navigateCommands — select-successors', () => {
  it('selects every forward-reachable entity', async () => {
    const { entities } = seedChain(['Root', 'Mid', 'Top']);
    useDocumentStore.getState().selectEntities([entities[0]!.id]);
    await runCommand(findCommand(navigateCommands, 'select-successors'));
    const sel = s().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind !== 'entities') return;
    expect(sel.ids.length).toBe(3);
  });

  it('toasts info when nothing is selected', async () => {
    await runCommand(findCommand(navigateCommands, 'select-successors'));
    expect(s().toasts.some((t) => /select one or more/i.test(t.message))).toBe(true);
  });
});

describe('navigateCommands — select-predecessors', () => {
  it('selects every backward-reachable entity', async () => {
    const { entities } = seedChain(['Root', 'Mid', 'Top']);
    useDocumentStore.getState().selectEntities([entities[2]!.id]);
    await runCommand(findCommand(navigateCommands, 'select-predecessors'));
    const sel = s().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind !== 'entities') return;
    expect(sel.ids.length).toBe(3);
  });
});

describe('navigateCommands — zoom-fit', () => {
  it('runs without throwing when no canvas is mounted (jsdom)', async () => {
    // The handler short-circuits when `getCanvasInstance()` returns null,
    // which is the jsdom default. The test verifies the command is
    // wired correctly + doesn't blow up.
    await expect(runCommand(findCommand(navigateCommands, 'zoom-fit'))).resolves.toBeUndefined();
  });
});
