import { useEffect, useState } from 'react';
import { getLinkedFile, subscribeLinkChange } from '@/services/storage/fileHandles';

/**
 * The name of the on-disk file the document `docId` is linked to (via the
 * File System Access "Save to file" feature), or `null` if none. Refreshes
 * when a save links a file or a clear unlinks one.
 *
 * Reads the async IndexedDB-backed link store directly rather than routing it
 * through the Zustand store — the link is a service-layer concern, and keeping
 * it out of the document state preserves the "purely additive" guarantee (no
 * change to the document model or its persistence). Returns `null` everywhere
 * the feature can't be used (Firefox / Safari / SSR), so callers can render a
 * "linked" affordance unconditionally.
 */
export const useLinkedFileName = (docId: string): string | null => {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = (): void => {
      getLinkedFile(docId)
        .then((file) => {
          if (active) setName(file?.name ?? null);
        })
        .catch(() => {
          if (active) setName(null);
        });
    };
    refresh();
    const unsubscribe = subscribeLinkChange(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [docId]);
  return name;
};
