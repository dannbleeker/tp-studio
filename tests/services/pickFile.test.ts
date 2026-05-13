import { pickFile } from '@/services/exporters/picker';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `pickFile` is the shared file-picker pipeline used by every importer.
 * jsdom can't simulate a real user file selection, but we can drive the
 * `<input>` element directly:
 *   - User cancels (no file selected) → resolves null, no toast.
 *   - Parse throws → resolves null, error toast fires with the label.
 *
 * The happy path (parse succeeds) needs a real `File` so we use
 * jsdom's `File`/`Blob` constructors plus a tiny dispatched 'change'.
 */

beforeEach(resetStoreForTest);
afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Stub `input.click()` to immediately fire 'change' after attaching the
 * passed files. Returns the spy so the caller can override files per
 * test. The picker always creates the `<input>` via
 * `document.createElement('input')`; this intercepts that creation and
 * wires the click handler.
 */
/**
 * Build a File-like that responds to `.text()` reliably under jsdom —
 * the jsdom File implementation may not include `.text()` depending
 * on the version. We override per-instance.
 */
const makeTextFile = (content: string, name = 'test.txt'): File => {
  const file = new File([content], name);
  Object.defineProperty(file, 'text', {
    configurable: true,
    value: () => Promise.resolve(content),
  });
  return file;
};

const interceptFilePicker = (files: File[] | null) => {
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const el = realCreate(tag);
    if (tag === 'input') {
      const input = el as HTMLInputElement;
      // Replace click() with our synchronous "user picked these files" stub.
      input.click = () => {
        if (files !== null) {
          // Define a `files` getter that returns a fake FileList-like.
          Object.defineProperty(input, 'files', {
            configurable: true,
            get: () => ({
              length: files.length,
              item: (i: number) => files[i] ?? null,
              0: files[0],
            }),
          });
        }
        // Fire the change handler the picker attached.
        input.onchange?.(new Event('change'));
      };
    }
    return el;
  }) as typeof document.createElement);
};

describe('pickFile', () => {
  it('resolves null when the user cancels (no file selected)', async () => {
    interceptFilePicker([]);
    const result = await pickFile({
      accept: '*',
      label: 'Test',
      parse: () => 'ok',
    });
    expect(result).toBeNull();
    // No toast fires on cancel — the user dismissed deliberately.
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
  });

  it('passes file text to parse and returns the result', async () => {
    const file = makeTextFile('hello world');
    interceptFilePicker([file]);
    const result = await pickFile({
      accept: 'text/plain',
      label: 'Text',
      parse: (text) => text.toUpperCase(),
    });
    expect(result).toBe('HELLO WORLD');
  });

  it('surfaces a parse-time exception as a toast and resolves null', async () => {
    const file = makeTextFile('bad input', 'bad.txt');
    interceptFilePicker([file]);
    const result = await pickFile({
      accept: 'text/plain',
      label: 'Custom',
      parse: () => {
        throw new Error('bad shape');
      },
    });
    expect(result).toBeNull();
    const toasts = useDocumentStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.kind).toBe('error');
    expect(toasts[0]?.message).toContain('Custom import failed');
    expect(toasts[0]?.message).toContain('bad shape');
  });

  it('uses the errorMessage fallback for non-Error throws', async () => {
    const file = makeTextFile('x', 'x.txt');
    interceptFilePicker([file]);
    // Deliberate non-Error throw to exercise the errorMessage fallback
    // in the picker — the picker should still surface a toast carrying
    // the stringified payload.
    const throwingParse = () => {
      // Throwing through `unknown` keeps the parse callback's return
      // type compatible with `pickFile`'s expectation while still
      // hitting the non-Error branch of `errorMessage`.
      const payload: unknown = 'string-thrown';
      throw payload;
    };
    await pickFile({
      accept: 'text/plain',
      label: 'Custom',
      parse: throwingParse,
    });
    expect(useDocumentStore.getState().toasts[0]?.message).toContain('string-thrown');
  });
});
