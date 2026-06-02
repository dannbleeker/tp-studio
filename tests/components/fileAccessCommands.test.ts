import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the File System Access service + the link store so the command
// orchestration is exercised without the (headless-impossible) browser picker
// or a real IndexedDB.
vi.mock('@/services/fileSystemAccess', () => ({
  isFileAccessSupported: () => true,
  saveToFile: vi.fn(),
  openFromFile: vi.fn(),
  writeTextToHandle: vi.fn(),
  ensureWritePermission: vi.fn(),
}));
vi.mock('@/services/storage/fileHandles', () => ({
  getLinkedFile: vi.fn(),
  linkFile: vi.fn(),
  unlinkFile: vi.fn(),
}));

import { fileAccessCommands } from '@/components/command-palette/commands/fileAccess';
import {
  ensureWritePermission,
  openFromFile,
  saveToFile,
  writeTextToHandle,
} from '@/services/fileSystemAccess';
import { getLinkedFile, linkFile, unlinkFile } from '@/services/storage/fileHandles';
import { resetStoreForTest, useDocumentStore } from '@/store';

const cmd = (id: string) => {
  const c = fileAccessCommands.find((x) => x.id === id);
  if (!c) throw new Error(`command ${id} not found`);
  return c;
};
const s = () => useDocumentStore.getState();
const toastSome = (re: RegExp, kind?: string) =>
  s().toasts.some((t) => re.test(t.message) && (kind ? t.kind === kind : true));
const fakeHandle = (name: string): FileSystemFileHandle =>
  ({ name }) as unknown as FileSystemFileHandle;

beforeEach(() => {
  resetStoreForTest();
  vi.mocked(getLinkedFile).mockResolvedValue(null);
  vi.mocked(linkFile).mockResolvedValue(undefined);
  vi.mocked(unlinkFile).mockResolvedValue(undefined);
  vi.mocked(ensureWritePermission).mockResolvedValue(true);
  vi.mocked(writeTextToHandle).mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe('save-to-file — first save (no link yet)', () => {
  it('picks a location, links it, and toasts the filename', async () => {
    const handle = fakeHandle('my-tree.tps.json');
    vi.mocked(saveToFile).mockResolvedValue({ status: 'saved', handle });
    await cmd('save-to-file').run(s());
    expect(saveToFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.tps\.json$/),
      expect.stringContaining('"diagramType"')
    );
    expect(linkFile).toHaveBeenCalledWith(s().doc.id, handle);
    expect(writeTextToHandle).not.toHaveBeenCalled(); // went through the picker
    expect(toastSome(/saved to my-tree\.tps\.json/i, 'success')).toBe(true);
  });

  it('toasts info when the user cancels the picker', async () => {
    vi.mocked(saveToFile).mockResolvedValue({ status: 'cancelled' });
    await cmd('save-to-file').run(s());
    expect(toastSome(/save cancelled/i)).toBe(true);
    expect(linkFile).not.toHaveBeenCalled();
  });

  it('toasts an error when the picker save throws', async () => {
    vi.mocked(saveToFile).mockRejectedValue(new Error('permission denied'));
    await cmd('save-to-file').run(s());
    expect(toastSome(/couldn't save to file/i, 'error')).toBe(true);
  });
});

describe('save-to-file — one-click re-save to the linked file', () => {
  it('writes to the remembered handle without re-picking', async () => {
    vi.mocked(getLinkedFile).mockResolvedValue({
      handle: fakeHandle('budget.tps.json'),
      name: 'budget.tps.json',
    });
    await cmd('save-to-file').run(s());
    expect(ensureWritePermission).toHaveBeenCalled();
    expect(writeTextToHandle).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'budget.tps.json' }),
      expect.stringContaining('"diagramType"')
    );
    expect(saveToFile).not.toHaveBeenCalled(); // no picker shown
    expect(toastSome(/saved to budget\.tps\.json/i, 'success')).toBe(true);
  });

  it('clears the link and guides to "Save as" when the write fails', async () => {
    vi.mocked(getLinkedFile).mockResolvedValue({
      handle: fakeHandle('gone.tps.json'),
      name: 'gone.tps.json',
    });
    vi.mocked(writeTextToHandle).mockRejectedValue(new Error('file not found'));
    await cmd('save-to-file').run(s());
    expect(unlinkFile).toHaveBeenCalledWith(s().doc.id);
    expect(toastSome(/couldn't save to gone\.tps\.json/i, 'error')).toBe(true);
    expect(saveToFile).not.toHaveBeenCalled(); // does NOT auto-open a picker on write failure
  });

  it('falls back to the picker when write permission is lost', async () => {
    vi.mocked(getLinkedFile).mockResolvedValue({
      handle: fakeHandle('locked.tps.json'),
      name: 'locked.tps.json',
    });
    vi.mocked(ensureWritePermission).mockResolvedValue(false);
    const handle = fakeHandle('new-spot.tps.json');
    vi.mocked(saveToFile).mockResolvedValue({ status: 'saved', handle });
    await cmd('save-to-file').run(s());
    expect(writeTextToHandle).not.toHaveBeenCalled();
    expect(saveToFile).toHaveBeenCalled(); // re-picked
    expect(linkFile).toHaveBeenCalledWith(s().doc.id, handle);
    expect(toastSome(/lost write access/i)).toBe(true);
  });
});

describe('save-to-file-as', () => {
  it('always picks + links, even when a link already exists', async () => {
    vi.mocked(getLinkedFile).mockResolvedValue({
      handle: fakeHandle('old.tps.json'),
      name: 'old.tps.json',
    });
    const handle = fakeHandle('copy.tps.json');
    vi.mocked(saveToFile).mockResolvedValue({ status: 'saved', handle });
    await cmd('save-to-file-as').run(s());
    expect(writeTextToHandle).not.toHaveBeenCalled();
    expect(saveToFile).toHaveBeenCalled();
    expect(linkFile).toHaveBeenCalledWith(s().doc.id, handle);
    expect(toastSome(/saved to copy\.tps\.json/i, 'success')).toBe(true);
  });

  it('toasts info on cancel', async () => {
    vi.mocked(saveToFile).mockResolvedValue({ status: 'cancelled' });
    await cmd('save-to-file-as').run(s());
    expect(toastSome(/save cancelled/i)).toBe(true);
  });
});

describe('open-from-file', () => {
  const validDoc = JSON.stringify({
    schemaVersion: 9,
    id: 'opened-from-file',
    diagramType: 'crt',
    title: 'Opened',
    nextAnnotationNumber: 1,
    entities: {},
    edges: {},
  });

  it('opens a valid file as the active document and links it for re-save', async () => {
    const handle = fakeHandle('opened.tps.json');
    vi.mocked(openFromFile).mockResolvedValue({ text: validDoc, handle });
    await cmd('open-from-file').run(s());
    expect(s().doc.id).toBe('opened-from-file');
    expect(linkFile).toHaveBeenCalledWith('opened-from-file', handle);
  });

  it('is a no-op when the user cancels (null)', async () => {
    vi.mocked(openFromFile).mockResolvedValue(null);
    const before = s().doc.id;
    await cmd('open-from-file').run(s());
    expect(s().doc.id).toBe(before);
    expect(linkFile).not.toHaveBeenCalled();
  });

  it('toasts an error when the file is not a valid TP Studio document', async () => {
    vi.mocked(openFromFile).mockResolvedValue({
      text: 'not json at all',
      handle: fakeHandle('x.json'),
    });
    await cmd('open-from-file').run(s());
    expect(toastSome(/valid TP Studio document/i, 'error')).toBe(true);
    expect(linkFile).not.toHaveBeenCalled();
  });

  it('toasts an error when opening throws', async () => {
    vi.mocked(openFromFile).mockRejectedValue(new Error('read failed'));
    await cmd('open-from-file').run(s());
    expect(toastSome(/couldn't open the file/i, 'error')).toBe(true);
  });
});
