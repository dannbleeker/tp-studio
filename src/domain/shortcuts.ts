import { en } from '@/i18n/locales/en';
import type { Messages } from '@/i18n/types';

/**
 * Single source of truth for every keyboard shortcut surfaced in the UI.
 *
 * Three downstream consumers used to drift independently:
 *
 *   - `useGlobalKeyboard` — the only place that actually binds keys to behavior.
 *   - `HelpDialog` — a static SECTIONS array describing the same shortcuts.
 *   - `commands/*.ts` — per-command `shortcut?: 'Ctrl+...'` strings shown as
 *     kbd hints in the palette.
 *
 * Whenever the hook gained or lost a shortcut, the other two had to be updated
 * by hand. Three files, no compile-time link. This registry collapses them
 * down to one declarative list; the hook keeps its imperative behavior but
 * cross-references each branch by `id`, and a test (`tests/hooks/shortcut
 * Registry.test.ts`) reads the hook's source and fails CI if any
 * `bindsAt: 'hook'` entry is missing a `// reg: <id>` marker.
 *
 * Display strings are Mac-aware (⌘ in place of Ctrl). Behavior cares about
 * `event.metaKey || event.ctrlKey` either way — the symbol is purely visual.
 */

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
/** Cmd-or-Ctrl glyph used in display strings throughout the app. */
export const M = isMac ? '⌘' : 'Ctrl';

/**
 * Logical "where in the UI this matters" grouping. Drives both the help
 * dialog's section ordering and the headings users see. Adding a group is
 * a compile-time-checked operation because `ShortcutGroup` is a union.
 */
export type ShortcutGroup = 'global' | 'entity' | 'group' | 'canvas';

/**
 * Human-readable section heading for each group. Used by `HelpDialog`.
 * `Record<ShortcutGroup, ...>` forces an entry per group at compile time.
 */
export const SHORTCUT_GROUP_TITLE: Record<ShortcutGroup, string> = en.shortcut.groups;

/** Locale-aware group heading. */
export const shortcutGroupTitle = (messages: Messages, group: ShortcutGroup): string =>
  messages.shortcut.groups[group];

/**
 * Where the binding actually lives:
 *
 *   - `'hook'` — `useGlobalKeyboard` handles this via a keydown listener.
 *     The registry test asserts each `'hook'` entry's id appears in a
 *     `// reg: <id>` comment in the hook source.
 *   - `'reactFlow'` — React Flow's own input handling (drag-handle to
 *     connect, right-click for context menu, shift-click for multi-select).
 *     We don't bind these; we document them.
 *   - `'native'` — handled by the underlying widget (e.g. `Alt+Enter` for a
 *     line break inside a textarea is browser-native; the entity's title
 *     `<textarea>` configures `wrap` and lets the OS do its thing).
 */
export type ShortcutBinding = 'hook' | 'reactFlow' | 'native';

export type Shortcut = {
  /** Stable id — used by the registry-link test and (when matching) by
   *  palette commands to look up their kbd hint via `SHORTCUT_BY_ID`. */
  id: string;
  /** Display string for the `<kbd>` element. Mac-aware via the `M` glyph. */
  keys: string;
  /** Display label shown next to the keys in the help dialog. */
  label: string;
  group: ShortcutGroup;
  bindsAt: ShortcutBinding;
};

/**
 * The full shortcut list. Order within a group is the order shown in the
 * help dialog. Adding a shortcut here is the *only* required step for
 * display — the hook is updated separately, and the registry-link test
 * will fail until the new id appears in a `// reg: <id>` comment.
 */
const SHORTCUT_DEFS: Omit<Shortcut, 'label'>[] = [
  // Global ------------------------------------------------------------------
  { id: 'palette', keys: `${M}+K`, group: 'global', bindsAt: 'hook' },
  { id: 'undo', keys: `${M}+Z`, group: 'global', bindsAt: 'hook' },
  { id: 'redo', keys: `${M}+Shift+Z`, group: 'global', bindsAt: 'hook' },
  { id: 'save', keys: `${M}+S`, group: 'global', bindsAt: 'hook' },
  { id: 'export-menu', keys: `${M}+E`, group: 'global', bindsAt: 'hook' },
  {
    id: 'print',
    keys: `${M}+P`,
    group: 'global',
    // Print is a palette command that just calls window.print(); the global
    // hook doesn't intercept Ctrl/Cmd+P (the browser handles it natively).
    bindsAt: 'native',
  },
  { id: 'find', keys: `${M}+F`, group: 'global', bindsAt: 'hook' },
  { id: 'settings', keys: `${M}+,`, group: 'global', bindsAt: 'hook' },
  {
    id: 'quick-capture',
    keys: 'E',
    group: 'global',
    bindsAt: 'hook',
  },
  {
    id: 'copy-cut-paste',
    keys: `${M}+C / ${M}+X / ${M}+V`,
    group: 'global',
    bindsAt: 'hook',
  },
  {
    id: 'duplicate',
    keys: `${M}+D`,
    group: 'global',
    bindsAt: 'hook',
  },
  {
    id: 'select-all',
    keys: `${M}+A`,
    group: 'global',
    bindsAt: 'hook',
  },
  {
    id: 'swap-entities',
    keys: `${M}+Shift+S`,
    group: 'global',
    bindsAt: 'hook',
  },
  {
    id: 'select-successors',
    keys: `${M}+Shift+→`,
    group: 'global',
    bindsAt: 'hook',
  },
  {
    id: 'select-predecessors',
    keys: `${M}+Shift+←`,
    group: 'global',
    bindsAt: 'hook',
  },
  {
    id: 'zoom',
    keys: '+ / - / 0',
    group: 'global',
    bindsAt: 'hook',
  },
  // Session 77 / brief §9.
  {
    id: 'toggle-inspector',
    keys: `${M}+\\`,
    group: 'global',
    bindsAt: 'hook',
  },
  {
    id: 'add-assumption-on-edge',
    keys: 'A',
    group: 'global',
    bindsAt: 'hook',
  },
  {
    id: 'escape',
    keys: 'Esc',
    group: 'global',
    bindsAt: 'hook',
  },
  // Multi-doc tabs (Session 138). Browsers reserve Cmd/Ctrl+T / +W / +1–9
  // for their own tab strip and block page overrides, so these bind ONLY in
  // an installed PWA (display-mode: standalone). In a normal browser tab,
  // use the palette commands (New / Close / Next / Previous tab) instead.
  {
    id: 'new-tab',
    keys: `${M}+T`,
    group: 'global',
    bindsAt: 'hook',
  },
  {
    id: 'close-tab',
    keys: `${M}+W`,
    group: 'global',
    bindsAt: 'hook',
  },
  {
    id: 'switch-tab',
    keys: `${M}+1…9`,
    group: 'global',
    bindsAt: 'hook',
  },

  // On a selected entity ----------------------------------------------------
  { id: 'rename', keys: 'Enter / F2', group: 'entity', bindsAt: 'hook' },
  {
    id: 'newline-in-title',
    keys: 'Alt+Enter',
    group: 'entity',
    // The entity title's <textarea> wraps native — useGlobalKeyboard
    // explicitly skips when the event target is editable.
    bindsAt: 'native',
  },
  { id: 'add-child', keys: 'Tab', group: 'entity', bindsAt: 'hook' },
  {
    id: 'add-parent',
    keys: 'Shift+Tab',
    group: 'entity',
    bindsAt: 'hook',
  },
  {
    id: 'move-to-effect',
    keys: '↑',
    group: 'entity',
    bindsAt: 'hook',
  },
  {
    id: 'move-to-cause',
    keys: '↓',
    group: 'entity',
    bindsAt: 'hook',
  },
  {
    id: 'move-to-sibling',
    keys: '← / →',
    group: 'entity',
    bindsAt: 'hook',
  },
  {
    id: 'delete-entity',
    keys: 'Del / Backspace',
    group: 'entity',
    bindsAt: 'hook',
  },

  // On a selected group -----------------------------------------------------
  { id: 'hoist-group', keys: 'Enter', group: 'group', bindsAt: 'hook' },
  {
    id: 'expand-group',
    keys: '→',
    group: 'group',
    bindsAt: 'hook',
  },
  {
    id: 'collapse-group',
    keys: '←',
    group: 'group',
    bindsAt: 'hook',
  },
  {
    id: 'delete-group',
    keys: 'Del / Backspace',
    group: 'group',
    bindsAt: 'hook',
  },

  // Canvas ------------------------------------------------------------------
  {
    id: 'canvas-double-click',
    keys: 'Double-click',
    group: 'canvas',
    bindsAt: 'reactFlow',
  },
  {
    id: 'canvas-right-click',
    keys: 'Right-click',
    group: 'canvas',
    bindsAt: 'reactFlow',
  },
  {
    id: 'canvas-shift-click-edge',
    keys: 'Shift+click',
    group: 'canvas',
    bindsAt: 'reactFlow',
  },
  {
    id: 'canvas-drag-handle',
    keys: 'Drag handle',
    group: 'canvas',
    bindsAt: 'reactFlow',
  },
];

/**
 * `SHORTCUTS` indexed by id, for O(1) lookup.
 */
/**
 * English view of the registry. Callers inside a React render should use
 * {@link shortcutsFor} so the labels follow the active locale; this stays for
 * the registry tests and any non-React consumer.
 */
export const SHORTCUTS: Shortcut[] = SHORTCUT_DEFS.map((d) => ({
  ...d,
  label: en.shortcut.label[d.id as keyof typeof en.shortcut.label],
}));

/** Locale-aware registry. */
export const shortcutsFor = (messages: Messages): Shortcut[] =>
  SHORTCUT_DEFS.map((d) => ({
    ...d,
    label: messages.shortcut.label[d.id as keyof Messages['shortcut']['label']],
  }));

export const SHORTCUT_BY_ID: Record<string, Shortcut> = Object.fromEntries(
  SHORTCUTS.map((s) => [s.id, s])
);

/**
 * `SHORTCUTS` partitioned by group, preserving insertion order within each.
 * Used by `HelpDialog` to render section-by-section.
 */
export const SHORTCUTS_BY_GROUP: Record<ShortcutGroup, Shortcut[]> = {
  global: SHORTCUTS.filter((s) => s.group === 'global'),
  entity: SHORTCUTS.filter((s) => s.group === 'entity'),
  group: SHORTCUTS.filter((s) => s.group === 'group'),
  canvas: SHORTCUTS.filter((s) => s.group === 'canvas'),
};

/** Locale-aware equivalent of {@link SHORTCUTS_BY_GROUP}. */
export const shortcutsByGroupFor = (messages: Messages): Record<ShortcutGroup, Shortcut[]> => {
  const all = shortcutsFor(messages);
  return {
    global: all.filter((s) => s.group === 'global'),
    entity: all.filter((s) => s.group === 'entity'),
    group: all.filter((s) => s.group === 'group'),
    canvas: all.filter((s) => s.group === 'canvas'),
  };
};

/**
 * Per-palette-command kbd hints. The help dialog often groups related keys
 * onto one row ("⌘+C / ⌘+X / ⌘+V"), but the palette renders one command per
 * line and each gets its own kbd hint. This map covers the cases where the
 * palette command `id` doesn't 1:1 match a registry `Shortcut.id` (typically
 * because the registry row is an aggregate) — keyed by palette command id.
 *
 * For commands whose id DOES match a registry id (e.g. palette `'undo'` ↔
 * `SHORTCUT_BY_ID.undo`), the palette can fall back to that lookup. This
 * map only carries the overrides.
 */
export const PALETTE_KBD_BY_COMMAND_ID: Record<string, string> = {
  // Copy / cut / paste — help row is the aggregate "⌘+C / ⌘+X / ⌘+V"
  'copy-selection': `${M}+C`,
  'cut-selection': `${M}+X`,
  'paste-clipboard': `${M}+V`,
  // Duplicate — palette command id is "duplicate-selection", registry id is "duplicate"
  'duplicate-selection': `${M}+D`,
  // Find in document — palette command id is "open-search", registry id is "find"
  'open-search': `${M}+F`,
  // Fit view — registry row is the aggregate "+ / - / 0"
  'zoom-fit': '0',
  // Quick Capture — palette id is "open-quick-capture", registry id is "quick-capture"
  'open-quick-capture': 'E',
  // Settings — palette id is "open-settings", registry id is "settings"
  'open-settings': `${M}+,`,
};

/**
 * Look up the palette kbd hint for a given command. Tries the override map
 * first, then falls back to the registry by matching command id.
 */
export function paletteKbdForCommand(commandId: string): string | undefined {
  return PALETTE_KBD_BY_COMMAND_ID[commandId] ?? SHORTCUT_BY_ID[commandId]?.keys;
}

/**
 * Convert a registry `keys` string (display format, like `⌘+K`,
 * `Ctrl+Shift+Z`, `Enter`) into a WAI-ARIA `aria-keyshortcuts` value.
 *
 * ARIA syntax requires:
 *   - Modifiers spelled out: `Alt`, `Control`, `Meta`, `Shift`.
 *   - Multiple chords separated by spaces (so a Cmd-or-Ctrl shortcut is
 *     emitted as two chords — `Meta+K Control+K` — because the binding
 *     listens to `event.metaKey || event.ctrlKey` and screen readers
 *     should announce both as valid invocations).
 *
 * Returns `undefined` for shortcuts that aren't really keyboard chords
 * ("Drag handle", arrow nav like "← →", etc.) — callers should omit
 * the `aria-keyshortcuts` attribute entirely in that case.
 */
export function shortcutToAria(keys: string): string | undefined {
  // Reject non-chord display strings (mouse, drag, arrow-glyph notation).
  if (/Drag|Click|←|→|↑|↓/i.test(keys)) return undefined;
  if (keys.includes('/')) return undefined; // aggregate rows like "⌘+C / ⌘+X / ⌘+V"

  const renderChord = (chord: string, useMeta: boolean): string =>
    chord
      .split('+')
      .map((part) => {
        const p = part.trim();
        if (p === '⌘') return useMeta ? 'Meta' : 'Control';
        if (p === 'Ctrl') return 'Control';
        if (p === 'Shift' || p === 'Alt' || p === 'Meta' || p === 'Control') return p;
        if (p === 'Enter') return 'Enter';
        if (p === 'Tab') return 'Tab';
        if (p === 'Escape' || p === 'Esc') return 'Escape';
        if (p === 'Space' || p === ' ') return ' ';
        // Single character key — keep as-is (uppercased).
        return p.length === 1 ? p.toUpperCase() : p;
      })
      .join('+');

  // ⌘-prefixed shortcuts should announce as both Meta+ and Control+
  // because the binding listens to either modifier. Plain shortcuts
  // (Enter, Tab) emit a single chord.
  if (keys.includes('⌘') || keys.startsWith('Ctrl')) {
    const metaForm = renderChord(keys.replace(/Ctrl/g, '⌘'), true);
    const ctrlForm = renderChord(keys.replace(/⌘/g, 'Ctrl'), false);
    return metaForm === ctrlForm ? metaForm : `${metaForm} ${ctrlForm}`;
  }
  return renderChord(keys, false);
}
