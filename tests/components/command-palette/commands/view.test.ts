import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { viewCommands } from '@/components/command-palette/commands/view';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../../helpers/seedDoc';
import { findCommand, runCommand } from './helpers';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('viewCommands — open-settings', () => {
  it('opens the settings dialog', async () => {
    await runCommand(findCommand(viewCommands, 'open-settings'));
    expect(s().settingsOpen).toBe(true);
  });
});

describe('viewCommands — reset-layout', () => {
  it('toasts info when no entities are pinned', async () => {
    seedEntity('Loose');
    await runCommand(findCommand(viewCommands, 'reset-layout'));
    expect(s().toasts.some((t) => /no pinned entit/i.test(t.message))).toBe(true);
  });

  it('does NOT clear positions when the confirm prompt is declined', async () => {
    const e = seedEntity('Pinned');
    useDocumentStore.getState().setEntityPosition(e.id, { x: 100, y: 100 });
    // Stub confirm to "no" by intercepting via `confirmDialog` state.
    // Easier: rebind `confirm` on the store before invoking the command.
    const originalConfirm = useDocumentStore.getState().confirm;
    useDocumentStore.setState({ confirm: async () => false });
    try {
      await runCommand(findCommand(viewCommands, 'reset-layout'));
      expect(s().doc.entities[e.id]?.position).toEqual({ x: 100, y: 100 });
    } finally {
      useDocumentStore.setState({ confirm: originalConfirm });
    }
  });

  it('clears positions when confirmed', async () => {
    const e = seedEntity('Pinned');
    useDocumentStore.getState().setEntityPosition(e.id, { x: 100, y: 100 });
    const originalConfirm = useDocumentStore.getState().confirm;
    useDocumentStore.setState({ confirm: async () => true });
    try {
      await runCommand(findCommand(viewCommands, 'reset-layout'));
      expect(s().doc.entities[e.id]?.position).toBeUndefined();
    } finally {
      useDocumentStore.setState({ confirm: originalConfirm });
    }
  });
});
