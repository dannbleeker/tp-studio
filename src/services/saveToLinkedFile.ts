import { exportToJSON } from '@/domain/persistence';
import { errorMessage } from '@/services/errors';
import { ensureWritePermission, writeTextToHandle } from '@/services/fileSystemAccess';
import { getLinkedFile, linkFile, unlinkFile } from '@/services/storage/fileHandles';
import type { DocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Session 193 — the shared "write the current doc to its linked on-disk file"
 * step, factored out of the "Save to file" palette command so Ctrl/Cmd+S can
 * reuse the identical write / re-stamp / unlink-on-failure sequence instead of
 * duplicating it.
 *
 * Outcomes:
 *   - `saved`             — written; `savedAt` re-stamped (dirty chip clears).
 *   - `error`             — write threw; the link was dropped + a toast shown.
 *   - `no-link`           — the doc isn't linked to a file.
 *   - `permission-denied` — linked, but write permission wasn't granted.
 *
 * The caller decides the fallback for the last two (the palette re-picks a
 * location; Ctrl/Cmd+S flushes to localStorage). All File System Access calls
 * are Chromium-only; on other browsers `getLinkedFile` returns null so this is
 * a clean `no-link`.
 */
export const SAVE_AS_LABEL = 'Save to file as…';

export type LinkedSaveResult = 'saved' | 'error' | 'no-link' | 'permission-denied';

export const saveToLinkedFile = async (s: DocumentStore): Promise<LinkedSaveResult> => {
  const doc = currentDoc(s);
  const linked = await getLinkedFile(doc.id).catch(() => null);
  if (!linked) return 'no-link';

  const permitted = await ensureWritePermission(linked.handle).catch(() => false);
  if (!permitted) return 'permission-denied';

  try {
    await writeTextToHandle(linked.handle, exportToJSON(doc));
    // Re-link to re-stamp `savedAt` (and notify the title chip) — the handle +
    // name are unchanged, only the timestamp advances so the doc reads "clean".
    await linkFile(doc.id, linked.handle);
    s.showToast('success', `Saved to ${linked.name}.`);
    return 'saved';
  } catch (err) {
    // Moved / deleted / access revoked → forget the link so the next save
    // re-picks, and tell the user how.
    await unlinkFile(doc.id).catch(() => undefined);
    s.showToast(
      'error',
      `Couldn't save to ${linked.name}: ${errorMessage(err)}. Use "${SAVE_AS_LABEL}" to pick a new file.`
    );
    return 'error';
  }
};
