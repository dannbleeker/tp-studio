import { useEffect, useState } from 'react';
import { getLinkedFile, subscribeLinkChange } from '@/services/storage/fileHandles';

/**
 * The on-disk file the document `docId` is linked to (via the File System
 * Access "Save to file" feature) — its `name` and the `savedAt` epoch-ms of the
 * last write — or `null` if none. Refreshes when a save links / re-stamps a
 * file or a clear unlinks one. The caller compares `savedAt` against the doc's
 * `updatedAt` (see `isDirtySinceSave`) to show an "unsaved since last save" chip.
 *
 * Reads the async IndexedDB-backed link store directly rather than routing it
 * through the Zustand store — the link is a service-layer concern, and keeping
 * it out of the document state preserves the "purely additive" guarantee (no
 * change to the document model or its persistence). Returns `null` everywhere
 * the feature can't be used (Firefox / Safari / SSR), so callers can render a
 * "linked" affordance unconditionally.
 */
export const useLinkedFileStatus = (docId: string): { name: string; savedAt: number } | null => {
  const [status, setStatus] = useState<{ name: string; savedAt: number } | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = (): void => {
      getLinkedFile(docId)
        .then((file) => {
          if (active) setStatus(file ? { name: file.name, savedAt: file.savedAt } : null);
        })
        .catch(() => {
          if (active) setStatus(null);
        });
    };
    refresh();
    const unsubscribe = subscribeLinkChange(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [docId]);
  return status;
};
