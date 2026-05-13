import { pinnedEntities } from '@/domain/graph';
import { type Command, withWriteGuard } from './types';

export const viewCommands: Command[] = [
  // Theme, Settings, Browse Lock toggle are all view-state changes that
  // don't mutate the doc — they stay unguarded so the user can flip them
  // even while Browse Lock is on (and especially so they can turn the
  // lock back off).
  {
    id: 'toggle-theme',
    label: 'Toggle dark mode',
    group: 'View',
    run: (s) => s.toggleTheme(),
  },
  {
    id: 'open-settings',
    label: 'Settings…',
    group: 'View',
    run: (s) => s.openSettings(),
  },
  {
    id: 'toggle-browse-lock',
    label: 'Toggle Browse Lock',
    group: 'View',
    run: (s) => {
      const next = !s.browseLocked;
      s.setBrowseLocked(next);
      s.showToast('info', next ? 'Browse Lock on.' : 'Browse Lock off.');
    },
  },
  withWriteGuard({
    // LA5 (Session 63): clear every pinned position so auto-layout
    // reclaims the entire canvas. On manual-layout diagrams this resets
    // EC geometry to the origin too — the canonical 5-box layout will
    // need to be redrawn. Confirm before doing the destructive thing.
    id: 'reset-layout',
    label: 'Reset layout — unpin all entities',
    group: 'View',
    run: async (s) => {
      const pinnedCount = pinnedEntities(s.doc).length;
      if (pinnedCount === 0) {
        s.showToast('info', 'No pinned entities — nothing to reset.');
        return;
      }
      const ok = await s.confirm(
        `Unpin ${pinnedCount} entit${pinnedCount === 1 ? 'y' : 'ies'}? Auto-layout will reclaim them.`,
        { confirmLabel: 'Unpin' }
      );
      if (!ok) return;
      const cleared = s.clearAllEntityPositions();
      s.showToast('success', `Unpinned ${cleared} entit${cleared === 1 ? 'y' : 'ies'}.`);
    },
  }),
];
