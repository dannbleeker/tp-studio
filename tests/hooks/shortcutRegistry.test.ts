import { SHORTCUTS } from '@/domain/shortcuts';
import GLOBAL_HOOK_SOURCE from '@/hooks/useGlobalShortcuts.ts?raw';
import SELECTION_HOOK_SOURCE from '@/hooks/useSelectionShortcuts.ts?raw';
import { describe, expect, it } from 'vitest';

/**
 * Source-text link check. The shortcut registry is the single source of
 * truth for what the help dialog and palette display; the actual key
 * bindings live imperatively in the two context-keyed sub-hooks
 * (`useGlobalShortcuts` for selection-agnostic keys and
 * `useSelectionShortcuts` for keys that depend on what's selected). To
 * keep the registry and the bindings in sync, every registry entry with
 * `bindsAt: 'hook'` is required to appear as a `// reg: <id>` comment in
 * one of those two sub-hooks. Adding a new hook-bound shortcut without
 * the marker fails this test — CI catches the drift instead of waiting
 * for a user to notice the help dialog is off.
 *
 * Reverse direction (every `// reg: <id>` marker corresponds to a real
 * registry entry) is also checked — typos in markers should fail loudly.
 *
 * Sources are loaded via Vite's `?raw` import so no Node `fs` types are
 * needed; vitest's transform handles the suffix transparently. The
 * monolithic `useGlobalKeyboard.ts` is now just a 2-call composer and
 * carries no markers itself.
 */

/** Combined source text from both sub-hooks. */
const HOOK_SOURCE = `${GLOBAL_HOOK_SOURCE}\n${SELECTION_HOOK_SOURCE}`;

/**
 * Pull every id in `// reg: id [/ id [/ id...]]` markers out of the sources.
 * The regex is anchored to line start (with optional leading whitespace) so it
 * matches real line-comments only — JSDoc lines beginning with ` *` are
 * skipped, which prevents the explanatory ``// reg: <id>`` mention in each
 * sub-hook's header doc from being parsed as an actual marker.
 */
const markerRe = /^\s*\/\/\s*reg:\s*([^\n]+)/gm;
const markersInSource = new Set<string>();
for (const match of HOOK_SOURCE.matchAll(markerRe)) {
  // The marker can list multiple ids separated by " / " (e.g.
  // "// reg: undo / redo" when one branch handles two registry entries).
  const ids = match[1]!.split('/').map((s: string) => s.trim());
  for (const id of ids) markersInSource.add(id);
}

describe('shortcut registry ↔ keyboard-shortcut hooks linkage', () => {
  it('every hook-bound shortcut is referenced in a // reg: <id> marker', () => {
    const hookBound = SHORTCUTS.filter((s) => s.bindsAt === 'hook').map((s) => s.id);
    const missing = hookBound.filter((id) => !markersInSource.has(id));
    expect(
      missing,
      `Missing // reg: markers in useGlobalShortcuts.ts / useSelectionShortcuts.ts: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('every // reg: <id> marker corresponds to a real registry entry', () => {
    const registryIds = new Set(SHORTCUTS.map((s) => s.id));
    const unknown = [...markersInSource].filter((id) => !registryIds.has(id));
    expect(unknown, `Markers reference unknown shortcut ids: ${unknown.join(', ')}`).toEqual([]);
  });

  it('every marker id either binds at the hook or is reachable via a hook branch', () => {
    // A marker pointing at a non-hook entry would be a category error.
    // (Markers exist to prove the hook implements the shortcut; pointing
    // at a `reactFlow` or `native` entry means the registry's `bindsAt`
    // is wrong, or the marker is.)
    const byId = Object.fromEntries(SHORTCUTS.map((s) => [s.id, s] as const));
    const offenders = [...markersInSource].filter((id) => {
      const s = byId[id];
      return s && s.bindsAt !== 'hook';
    });
    expect(offenders, `Markers point at non-hook entries: ${offenders.join(', ')}`).toEqual([]);
  });
});
