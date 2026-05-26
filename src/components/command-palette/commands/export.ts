import type { Command } from './types';

/**
 * Session 90 — the entire `Export as X` family (~17 commands) is now
 * routed through a single picker. The palette stays scannable; the
 * picker dialog groups exports by category (Images / Documents /
 * Data / Annotations / Share) and surfaces a short hint per option
 * so format choice no longer requires reading 17 palette rows.
 *
 * The actual exporter functions are unchanged — `ExportPickerDialog`
 * dispatches the same ones the per-command rows used to.
 */
export const exportCommands: Command[] = [
  {
    id: 'open-export-picker',
    label: 'Export…',
    // Session 136 — was its own `'Export'` group; merged into the
    // `'File'` family so the palette mirrors a desktop File menu
    // (Open / Import / Export / Save-as adjacent to each other) per
    // Dann's usage feedback.
    group: 'File',
    run: (s) => s.openExportPicker(),
  },
];
