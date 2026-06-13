import { beforeEach, describe, expect, it } from 'vitest';
import { exportCommands } from '@/components/command-palette/commands/export';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { findCommand, runCommand } from './helpers';

beforeEach(resetStoreForTest);
const s = () => useDocumentStore.getState();

describe('exportCommands', () => {
  it('open-export-picker opens the export picker dialog', async () => {
    expect(s().exportPickerOpen).toBe(false);
    await runCommand(findCommand(exportCommands, 'open-export-picker'));
    expect(s().exportPickerOpen).toBe(true);
  });
});
