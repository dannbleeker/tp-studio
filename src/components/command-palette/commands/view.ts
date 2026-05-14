import { pinnedEntities } from '@/domain/graph';
import { type Command, withWriteGuard } from './types';

export const viewCommands: Command[] = [
  // Session 90 — `Toggle dark mode` and `Toggle Browse Lock` removed
  // from the palette: both are reachable as dedicated TopBar buttons
  // (`Theme` / `Lock`) on sm+ and via the KebabMenu on xs. Duplicate
  // entries in the palette were just visual noise. Settings stays
  // here — it's an open-modal action, not a state flip.
  {
    id: 'open-settings',
    label: 'Settings…',
    group: 'View',
    run: (s) => s.openSettings(),
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
