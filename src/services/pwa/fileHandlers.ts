import { importFromFlyingLogic } from '@/domain/flyingLogic';
import { useDocumentStore } from '@/store';

/**
 * PWA file handling — when a `.xlogic` / `.logicx` / `.logic` (Flying Logic) file
 * is double-clicked in the OS, an installed TP Studio (Chromium) is launched and
 * the file arrives on `window.launchQueue`. We read it, parse it with the existing
 * `importFromFlyingLogic`, and open it in a new tab — the same result as the manual
 * *Import → Flying Logic file* command, just triggered by the OS.
 *
 * The manifest side lives in `vite.config.ts` (`file_handlers`, keyed off
 * `fileHandlerTypes.ts`). This consumer is a no-op where the API is absent
 * (Firefox / Safari, or a non-installed tab), so importing it is always safe.
 */

// Minimal shapes for the File Handling API (not in every lib.dom yet).
type LaunchParams = { files?: readonly FileSystemFileHandle[] };
type LaunchQueue = { setConsumer: (consumer: (params: LaunchParams) => void) => void };

export const registerLaunchFileHandler = (): void => {
  if (typeof window === 'undefined') return;
  const launchQueue = (window as unknown as { launchQueue?: LaunchQueue }).launchQueue;
  if (!launchQueue) return;

  launchQueue.setConsumer(async (params) => {
    const files = params.files ?? [];
    if (files.length === 0) return;
    const store = useDocumentStore.getState();
    for (const handle of files) {
      let name = 'file';
      try {
        const file = await handle.getFile();
        name = file.name || name;
        const doc = importFromFlyingLogic(await file.text());
        store.openDocInTab(doc);
        store.showToast('success', `Opened “${name}” in TP Studio.`);
      } catch {
        store.showToast('error', `Couldn't open ${name} — not a valid Flying Logic file.`);
      }
    }
  });
};
