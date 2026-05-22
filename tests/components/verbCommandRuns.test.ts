import { describe, expect, it } from 'vitest';
import { hasVerbCommand } from '@/components/command-palette/verbCommandRuns';

/**
 * Session 135 / Perf #35 — the verb-command registry imports only the four
 * command modules that hold verb-dispatchable commands (analysis / edges /
 * groups / tools), so the always-mounted SelectionToolbar + ContextMenu no
 * longer drag the whole catalogue (incl. palette-only export / help / view /
 * navigate / document) onto the eager path.
 *
 * This test is the load-bearing contract guard: every command a selection
 * verb can dispatch MUST resolve through the light registry. If a future
 * change moves one of these commands into a palette-only module, the toolbar
 * / context-menu verb would silently no-op — this catches that at test time.
 */

// Every `paletteCommandId` referenced by a selection verb (grep of
// src/domain/selectionVerbs*.ts). Keep in sync if verbs gain/lose a command.
const VERB_COMMAND_IDS = [
  'add-assumption-to-edge',
  'add-io-for-obstacle',
  'add-nc-child',
  'add-precondition',
  'add-predecessor',
  'add-prerequisite-need',
  'add-successor',
  'confirm-delete-selection',
  'cycle-edge-polarity',
  'cycle-group-color',
  'group-and',
  'group-or',
  'group-selected-entities',
  'group-xor',
  'mark-as-action',
  'mark-as-csf',
  'mark-as-io',
  'mark-as-obstacle',
  'mark-as-outcome',
  'mark-as-rootcause',
  'mark-as-ude',
  'promote-to-goal',
  'reverse-edge',
  'spawn-ec-from-selection',
  'splice-into-edge',
  'start-edge-join-and',
  'start-negative-branch',
  'swap-entities',
  'toggle-group-collapsed',
  'ungroup-and',
  'ungroup-or',
  'ungroup-xor',
  'unhoist',
];

describe('verbCommandRuns registry (Perf #35)', () => {
  it.each(VERB_COMMAND_IDS)('resolves verb-dispatchable command %s', (id) => {
    expect(hasVerbCommand(id)).toBe(true);
  });

  it('does not resolve palette-only commands (they stay in the lazy catalogue)', () => {
    // Real ids from the excluded modules (export / view / help / navigate /
    // document) — reachable via Cmd+K, never via a selection verb, so the
    // light registry must NOT carry them.
    expect(hasVerbCommand('open-export-picker')).toBe(false); // export
    expect(hasVerbCommand('help')).toBe(false); // help
    expect(hasVerbCommand('open-search')).toBe(false); // navigate
    expect(hasVerbCommand('load-example')).toBe(false); // document
    expect(hasVerbCommand('not-a-real-command')).toBe(false);
  });
});
