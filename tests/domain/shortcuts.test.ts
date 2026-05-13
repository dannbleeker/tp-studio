import {
  PALETTE_KBD_BY_COMMAND_ID,
  SHORTCUTS,
  SHORTCUTS_BY_GROUP,
  SHORTCUT_BY_ID,
  SHORTCUT_GROUP_TITLE,
  paletteKbdForCommand,
} from '@/domain/shortcuts';
import { describe, expect, it } from 'vitest';

/**
 * Sanity-pin the shortcut registry — the file is meant to be the single
 * source of truth for both the help dialog and the palette's kbd hints, so
 * a stray duplicate id or a missing group entry would silently propagate
 * to two different consumer surfaces.
 */

describe('shortcut registry', () => {
  it('every shortcut id is unique', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('SHORTCUT_BY_ID round-trips every entry', () => {
    for (const s of SHORTCUTS) {
      expect(SHORTCUT_BY_ID[s.id]).toBe(s);
    }
  });

  it('SHORTCUTS_BY_GROUP partitions the list without losing or duplicating entries', () => {
    const total =
      SHORTCUTS_BY_GROUP.global.length +
      SHORTCUTS_BY_GROUP.entity.length +
      SHORTCUTS_BY_GROUP.group.length +
      SHORTCUTS_BY_GROUP.canvas.length;
    expect(total).toBe(SHORTCUTS.length);
    // Every group also has at least one entry — an empty group would be a
    // bug (the help dialog would render an orphan heading).
    expect(SHORTCUTS_BY_GROUP.global.length).toBeGreaterThan(0);
    expect(SHORTCUTS_BY_GROUP.entity.length).toBeGreaterThan(0);
    expect(SHORTCUTS_BY_GROUP.group.length).toBeGreaterThan(0);
    expect(SHORTCUTS_BY_GROUP.canvas.length).toBeGreaterThan(0);
  });

  it('SHORTCUT_GROUP_TITLE covers every group used in the registry', () => {
    for (const s of SHORTCUTS) {
      expect(SHORTCUT_GROUP_TITLE[s.group]).toBeDefined();
    }
  });

  it('every entry has non-empty keys + label', () => {
    for (const s of SHORTCUTS) {
      expect(s.keys.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it('paletteKbdForCommand prefers the override map over the registry fallback', () => {
    // `copy-selection` is in the override map (registry has the aggregate
    // "⌘+C / ⌘+X / ⌘+V" instead).
    expect(paletteKbdForCommand('copy-selection')).toBe(
      PALETTE_KBD_BY_COMMAND_ID['copy-selection']
    );
    // `undo` is NOT in the override map; registry has it directly.
    expect(paletteKbdForCommand('undo')).toBe(SHORTCUT_BY_ID.undo?.keys);
  });

  it('paletteKbdForCommand returns undefined for unknown command ids', () => {
    expect(paletteKbdForCommand('not-a-real-id')).toBeUndefined();
  });
});
