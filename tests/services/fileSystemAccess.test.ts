import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ensureWritePermission,
  isFileAccessSupported,
  openFromFile,
  saveToFile,
  writeTextToHandle,
} from '@/services/fileSystemAccess';

/**
 * The File System Access service is the only part of the "Save to file / Open
 * from file" feature with real logic; the browser picker can't run headless, so
 * we stub `window.showSaveFilePicker` / `showOpenFilePicker` + mock handles.
 */

const w = window as unknown as Record<string, unknown>;

afterEach(() => {
  delete w.showSaveFilePicker;
  delete w.showOpenFilePicker;
  vi.restoreAllMocks();
});

describe('isFileAccessSupported', () => {
  it('is false when the pickers are absent (jsdom / Firefox / Safari)', () => {
    expect(isFileAccessSupported()).toBe(false);
  });

  it('is true only when BOTH pickers exist (Chromium)', () => {
    w.showSaveFilePicker = vi.fn();
    expect(isFileAccessSupported()).toBe(false); // need both
    w.showOpenFilePicker = vi.fn();
    expect(isFileAccessSupported()).toBe(true);
  });
});

describe('writeTextToHandle', () => {
  it('writes the text and closes the stream', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const handle = {
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    } as unknown as FileSystemFileHandle;
    await writeTextToHandle(handle, '{"a":1}');
    expect(write).toHaveBeenCalledWith('{"a":1}');
    expect(close).toHaveBeenCalled();
  });

  it('always closes the writable even if write() throws', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const write = vi.fn().mockRejectedValue(new Error('disk full'));
    const handle = {
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    } as unknown as FileSystemFileHandle;
    await expect(writeTextToHandle(handle, 'x')).rejects.toThrow('disk full');
    expect(close).toHaveBeenCalled();
  });
});

describe('ensureWritePermission', () => {
  it('is true when already granted, without prompting', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const handle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission,
    } as unknown as FileSystemFileHandle;
    expect(await ensureWritePermission(handle)).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('prompts and is true when the request is granted', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const handle = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission,
    } as unknown as FileSystemFileHandle;
    expect(await ensureWritePermission(handle)).toBe(true);
    expect(requestPermission).toHaveBeenCalled();
  });

  it('is false when the request is denied', async () => {
    const handle = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    } as unknown as FileSystemFileHandle;
    expect(await ensureWritePermission(handle)).toBe(false);
  });

  it('is optimistically true when the permission API is absent', async () => {
    expect(await ensureWritePermission({} as FileSystemFileHandle)).toBe(true);
  });
});

describe('saveToFile', () => {
  it('writes to the picked file and resolves "saved" with the handle', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const handle = {
      name: 'doc.tps.json',
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    };
    w.showSaveFilePicker = vi.fn().mockResolvedValue(handle);

    expect(await saveToFile('doc.tps.json', '{"a":1}')).toEqual({ status: 'saved', handle });
    expect(w.showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'doc.tps.json' })
    );
    expect(write).toHaveBeenCalledWith('{"a":1}');
    expect(close).toHaveBeenCalled();
  });

  it('returns "cancelled" when the user dismisses the picker (AbortError)', async () => {
    w.showSaveFilePicker = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'));
    expect(await saveToFile('d.json', 'x')).toEqual({ status: 'cancelled' });
  });

  it('returns "cancelled" when the API is unsupported', async () => {
    expect(await saveToFile('d.json', 'x')).toEqual({ status: 'cancelled' });
  });

  it('rethrows a genuine picker failure (not an AbortError)', async () => {
    w.showSaveFilePicker = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    await expect(saveToFile('d.json', 'x')).rejects.toThrow();
  });
});

describe('openFromFile', () => {
  it('returns the chosen file text and handle', async () => {
    const file = { text: vi.fn().mockResolvedValue('{"b":2}') };
    const handle = { name: 'b.json', getFile: vi.fn().mockResolvedValue(file) };
    w.showOpenFilePicker = vi.fn().mockResolvedValue([handle]);
    expect(await openFromFile()).toEqual({ text: '{"b":2}', handle });
  });

  it('returns null on cancel (AbortError)', async () => {
    w.showOpenFilePicker = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'));
    expect(await openFromFile()).toBeNull();
  });

  it('returns null when the API is unsupported', async () => {
    expect(await openFromFile()).toBeNull();
  });
});
