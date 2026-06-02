import { afterEach, describe, expect, it, vi } from 'vitest';
import { isFileAccessSupported, openFromFile, saveToFile } from '@/services/fileSystemAccess';

/**
 * The File System Access service is the only part of the "Save to file / Open
 * from file" feature with real logic; the browser picker can't run headless, so
 * we stub `window.showSaveFilePicker` / `showOpenFilePicker` + a mock handle.
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

describe('saveToFile', () => {
  it('writes the text to the picked file and resolves "saved"', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const handle = { createWritable: vi.fn().mockResolvedValue({ write, close }) };
    w.showSaveFilePicker = vi.fn().mockResolvedValue(handle);

    expect(await saveToFile('doc.tps.json', '{"a":1}')).toBe('saved');
    expect(w.showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'doc.tps.json' })
    );
    expect(write).toHaveBeenCalledWith('{"a":1}');
    expect(close).toHaveBeenCalled();
  });

  it('returns "cancelled" when the user dismisses the picker (AbortError)', async () => {
    w.showSaveFilePicker = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'));
    expect(await saveToFile('d.json', 'x')).toBe('cancelled');
  });

  it('returns "cancelled" when the API is unsupported', async () => {
    expect(await saveToFile('d.json', 'x')).toBe('cancelled');
  });

  it('rethrows a genuine write failure (not an AbortError)', async () => {
    w.showSaveFilePicker = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    await expect(saveToFile('d.json', 'x')).rejects.toThrow();
  });

  it('always closes the writable even if write() throws', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const write = vi.fn().mockRejectedValue(new Error('disk full'));
    const handle = { createWritable: vi.fn().mockResolvedValue({ write, close }) };
    w.showSaveFilePicker = vi.fn().mockResolvedValue(handle);
    await expect(saveToFile('d.json', 'x')).rejects.toThrow('disk full');
    expect(close).toHaveBeenCalled();
  });
});

describe('openFromFile', () => {
  it('returns the chosen file text', async () => {
    const file = { text: vi.fn().mockResolvedValue('{"b":2}') };
    const handle = { getFile: vi.fn().mockResolvedValue(file) };
    w.showOpenFilePicker = vi.fn().mockResolvedValue([handle]);
    expect(await openFromFile()).toBe('{"b":2}');
  });

  it('returns null on cancel (AbortError)', async () => {
    w.showOpenFilePicker = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'));
    expect(await openFromFile()).toBeNull();
  });

  it('returns null when the API is unsupported', async () => {
    expect(await openFromFile()).toBeNull();
  });
});
