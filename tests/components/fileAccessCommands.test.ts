import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the File System Access service so the command logic is exercised without
// the (headless-impossible) browser picker.
vi.mock('@/services/fileSystemAccess', () => ({
  isFileAccessSupported: () => true,
  saveToFile: vi.fn(),
  openFromFile: vi.fn(),
}));

import { fileAccessCommands } from '@/components/command-palette/commands/fileAccess';
import { openFromFile, saveToFile } from '@/services/fileSystemAccess';
import { resetStoreForTest, useDocumentStore } from '@/store';

const cmd = (id: string) => {
  const c = fileAccessCommands.find((x) => x.id === id);
  if (!c) throw new Error(`command ${id} not found`);
  return c;
};
const s = () => useDocumentStore.getState();

beforeEach(resetStoreForTest);
afterEach(() => vi.clearAllMocks());

describe('save-to-file command', () => {
  it('serializes the active doc, saves it, and toasts success', async () => {
    vi.mocked(saveToFile).mockResolvedValue('saved');
    await cmd('save-to-file').run(s());
    expect(saveToFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.tps\.json$/),
      expect.stringContaining('"diagramType"')
    );
    expect(s().toasts.some((t) => /saved to file/i.test(t.message))).toBe(true);
  });

  it('toasts info when the user cancels the picker', async () => {
    vi.mocked(saveToFile).mockResolvedValue('cancelled');
    await cmd('save-to-file').run(s());
    expect(s().toasts.some((t) => /save cancelled/i.test(t.message))).toBe(true);
  });

  it('toasts an error when the write fails', async () => {
    vi.mocked(saveToFile).mockRejectedValue(new Error('permission denied'));
    await cmd('save-to-file').run(s());
    expect(s().toasts.some((t) => t.kind === 'error' && /couldn't save/i.test(t.message))).toBe(
      true
    );
  });
});

describe('open-from-file command', () => {
  const validDoc = JSON.stringify({
    schemaVersion: 9,
    id: 'opened-from-file',
    diagramType: 'crt',
    title: 'Opened',
    nextAnnotationNumber: 1,
    entities: {},
    edges: {},
  });

  it('opens a valid file as the active document', async () => {
    vi.mocked(openFromFile).mockResolvedValue(validDoc);
    await cmd('open-from-file').run(s());
    expect(s().doc.id).toBe('opened-from-file');
  });

  it('is a no-op when the user cancels (null)', async () => {
    vi.mocked(openFromFile).mockResolvedValue(null);
    const before = s().doc.id;
    await cmd('open-from-file').run(s());
    expect(s().doc.id).toBe(before);
  });

  it('toasts an error when the file is not a valid TP Studio document', async () => {
    vi.mocked(openFromFile).mockResolvedValue('not json at all');
    await cmd('open-from-file').run(s());
    expect(
      s().toasts.some((t) => t.kind === 'error' && /valid TP Studio document/i.test(t.message))
    ).toBe(true);
  });
});
