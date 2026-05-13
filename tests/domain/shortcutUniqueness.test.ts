import { SHORTCUTS } from '@/domain/shortcuts';
import { describe, expect, it } from 'vitest';

/**
 * Guard against accidentally registering two shortcuts at the same
 * key chord within the same scope. The registry has grown organically;
 * a future addition that reuses `Ctrl+S` (etc.) would silently overlap
 * — the binding hook only fires the first matching handler, so the
 * second registration would never run.
 *
 * Scope matters: `Enter` on a selected entity (start editing) vs.
 * `Enter` on a selected group (hoist) is intentional; the scope is the
 * `group` field on each shortcut. The uniqueness check groups by
 * `(keys, group)` so cross-scope collisions are fine.
 */

describe('SHORTCUTS uniqueness', () => {
  it('has unique ids', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dups, `Duplicate shortcut ids: ${dups.join(', ')}`).toEqual([]);
  });

  it('has unique (keys, group) pairs', () => {
    const seen = new Map<string, string[]>();
    for (const s of SHORTCUTS) {
      const key = `${s.group}::${s.keys}`;
      const list = seen.get(key) ?? [];
      list.push(s.id);
      seen.set(key, list);
    }
    const dups = Array.from(seen.entries()).filter(([, ids]) => ids.length > 1);
    expect(
      dups,
      `Duplicate key chords within scope: ${dups.map(([k, ids]) => `${k} → [${ids.join(', ')}]`).join('; ')}`
    ).toEqual([]);
  });
});
