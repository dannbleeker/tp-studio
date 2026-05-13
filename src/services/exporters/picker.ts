import { useDocumentStore } from '@/store';
import { errorMessage } from '../errors';

/**
 * Shared file-picker pipeline for every importer in `services/exporters/`.
 *
 * Each importer used to redeclare the same shape:
 *   1. Create a hidden `<input type="file">` with an `accept` allowlist.
 *   2. Wait for `onchange`.
 *   3. Read `file.text()`.
 *   4. Parse the text into a `TPDocument` (or whatever the importer's
 *      target type is) inside a try/catch.
 *   5. Surface parse failures via a toast.
 *
 * Centralizing the shape gives:
 *   - One try/catch with consistent error reporting (toast, not alert).
 *   - One place to add cancel / drag-and-drop / recent-files later.
 *   - Each format's importer collapses to a single `parse: (text) => T`
 *     call, decoupled from the browser file-picker plumbing.
 *
 * Importers pass `parse` directly; if `parse` throws, the user sees a
 * toast like `<label> failed: <message>` and the promise resolves to
 * `null` so the caller can no-op cleanly.
 */
export function pickFile<T>(opts: {
  /** File extensions + MIME types (the `<input accept>` allowlist). */
  accept: string;
  /** Short, capitalized format name used in the failure toast. */
  label: string;
  /** Parse the file text into the target type. May throw on bad input. */
  parse: (text: string) => T;
}): Promise<T | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = opts.accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        resolve(opts.parse(text));
      } catch (err) {
        useDocumentStore
          .getState()
          .showToast('error', `${opts.label} import failed: ${errorMessage(err)}`);
        resolve(null);
      }
    };
    input.click();
  });
}
