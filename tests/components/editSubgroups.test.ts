/**
 * Session 138 — palette `Edit`-group sub-sections.
 *
 * Guards the central `EDIT_SUBGROUP` map against drift: every `Edit` command
 * must have a sub-section, no key may reference a non-`Edit` command, and the
 * sort must lay commands out in sub-section order.
 */

import { describe, expect, it } from 'vitest';
import { COMMANDS } from '@/components/command-palette/commands';
import {
  EDIT_SUBGROUP,
  EDIT_SUBGROUP_ORDER,
  sortEditItems,
} from '@/components/command-palette/editSubgroups';

const editCommands = () => COMMANDS.filter((c) => c.group === 'Edit');

describe('Edit-group sub-sections', () => {
  it('assigns every Edit-group command to a known sub-section', () => {
    const cmds = editCommands();
    expect(cmds.length).toBeGreaterThan(0);
    for (const cmd of cmds) {
      const sub = EDIT_SUBGROUP[cmd.id];
      expect(sub, `Edit command "${cmd.id}" is missing a sub-section`).toBeDefined();
      expect(EDIT_SUBGROUP_ORDER as readonly string[]).toContain(sub);
    }
  });

  it('maps no stale ids (every key is a real Edit command)', () => {
    const ids = new Set(editCommands().map((c) => c.id));
    for (const id of Object.keys(EDIT_SUBGROUP)) {
      expect(ids.has(id), `EDIT_SUBGROUP maps "${id}", which is not an Edit command`).toBe(true);
    }
  });

  it('sortEditItems lays commands out in sub-section order', () => {
    const idxOf = (id: string): number => {
      const sub = EDIT_SUBGROUP[id];
      return sub ? EDIT_SUBGROUP_ORDER.indexOf(sub) : EDIT_SUBGROUP_ORDER.length;
    };
    const sorted = sortEditItems(editCommands());
    for (let i = 1; i < sorted.length; i++) {
      // The sub-section index is non-decreasing across the sorted list.
      expect(idxOf(sorted[i]!.id)).toBeGreaterThanOrEqual(idxOf(sorted[i - 1]!.id));
    }
  });
});
