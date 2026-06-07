import { pinnedEntities } from '@/domain/graph';
import type { AppMode } from '@/store';
import { currentDoc } from '@/store/selectors';
import { type Command, withWriteGuard } from './types';

// Session 135 / spec major gap #9 — app-mode commands. One palette
// entry per mode so the user can switch via Cmd+K. The label
// includes a trailing "mode" word so the palette query "expert"
// surfaces "Expert mode" cleanly. Toasts confirm the switch — useful
// because Phase 1 doesn't yet wire visible chrome changes per mode,
// so without the toast the user wouldn't know the switch happened.
const APP_MODE_OPTIONS: Array<{
  id: AppMode;
  label: string;
  hint: string;
}> = [
  { id: 'expert', label: 'Expert', hint: 'default — every affordance available' },
  { id: 'guided', label: 'Guided', hint: 'method-checklist + creation wizards prominent' },
  { id: 'workshop', label: 'Workshop', hint: 'facilitator + group session affordances' },
  { id: 'presentation', label: 'Presentation', hint: 'canvas-only, read-only, full-screen' },
  // Session 180 / E6 — reader / trainee mode: clean chrome, coaching
  // tooltips on hover, and "Challenge?" button on edges.
  { id: 'reader', label: 'Reader', hint: 'distraction-free read-only with coaching tooltips' },
];

const appModeCommands: Command[] = APP_MODE_OPTIONS.map((opt) => ({
  id: `switch-app-mode-${opt.id}`,
  label: `Switch to ${opt.label} mode`,
  group: 'View',
  run: (s) => {
    if (s.appMode === opt.id) {
      s.showToast('info', `Already in ${opt.label} mode.`);
      return;
    }
    s.setAppMode(opt.id);
    s.showToast('success', `${opt.label} mode (${opt.hint}).`);
  },
}));

export const viewCommands: Command[] = [
  ...appModeCommands,
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
      const pinnedCount = pinnedEntities(currentDoc(s)).length;
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
