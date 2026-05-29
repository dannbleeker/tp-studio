import { createDocument } from '@/domain/factory';
import { type Command, withWriteGuard } from './types';

/**
 * Multi-doc tabs Phase 5 (Batch 5.2b) — tab management from the command
 * palette. Reachable everywhere via Cmd+K, including a normal browser tab
 * where the conventional Cmd+T / Cmd+W / Cmd+1–9 keys are intercepted by
 * the browser (those only reach an installed PWA in standalone mode, so
 * the palette is the portable path).
 *
 * New / Duplicate create a document, so they're write-guarded like
 * `new-document` / `load-example`. Close / Next / Previous are tab
 * navigation, not edits to the active doc, so they run unguarded.
 */
export const tabCommands: Command[] = [
  withWriteGuard({
    id: 'new-tab',
    label: 'New tab',
    group: 'File',
    run: (s) => s.openTab(createDocument('crt')),
  }),
  withWriteGuard({
    id: 'duplicate-tab',
    label: 'Duplicate tab',
    group: 'File',
    run: (s) => s.duplicateTab(s.activeDocId),
  }),
  {
    id: 'close-tab',
    label: 'Close tab',
    group: 'View',
    run: (s) => s.closeTab(s.activeDocId),
  },
  {
    id: 'next-tab',
    label: 'Next tab',
    group: 'View',
    run: (s) => {
      const { tabOrder, activeDocId } = s;
      if (tabOrder.length < 2) return;
      const i = tabOrder.indexOf(activeDocId);
      const next = tabOrder[(i + 1) % tabOrder.length];
      if (next) s.switchTab(next);
    },
  },
  {
    id: 'previous-tab',
    label: 'Previous tab',
    group: 'View',
    run: (s) => {
      const { tabOrder, activeDocId } = s;
      if (tabOrder.length < 2) return;
      const i = tabOrder.indexOf(activeDocId);
      const prev = tabOrder[(i - 1 + tabOrder.length) % tabOrder.length];
      if (prev) s.switchTab(prev);
    },
  },
];
