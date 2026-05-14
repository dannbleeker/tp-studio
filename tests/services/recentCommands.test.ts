import {
  RECENT_COMMANDS_LIMIT,
  __resetRecentCommandsForTest,
  getRecentCommandIds,
  recordRecentCommand,
} from '@/services/recentCommands';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(() => {
  __resetRecentCommandsForTest();
});

/**
 * Session 88 (S17) — Recent palette commands service.
 *
 * Tests cover the persistence layer in isolation: order-preserving
 * insert, de-duplication (re-running the same command moves it to
 * the front rather than duplicating), and the cap at
 * RECENT_COMMANDS_LIMIT. The palette wiring (rendering the Recent
 * section, snapshotting on open, skipping in the filtered view) is
 * exercised separately in `tests/components/CommandPalette.test.tsx`.
 */

describe('recentCommands service', () => {
  it('starts empty on a fresh test environment', () => {
    expect(getRecentCommandIds()).toEqual([]);
  });

  it('records a single command and surfaces it', () => {
    recordRecentCommand('open-help');
    expect(getRecentCommandIds()).toEqual(['open-help']);
  });

  it('places the most-recent command first', () => {
    recordRecentCommand('a');
    recordRecentCommand('b');
    recordRecentCommand('c');
    expect(getRecentCommandIds()).toEqual(['c', 'b', 'a']);
  });

  it('de-duplicates: re-running the same command moves it to the front, no duplicate row', () => {
    recordRecentCommand('a');
    recordRecentCommand('b');
    recordRecentCommand('a');
    expect(getRecentCommandIds()).toEqual(['a', 'b']);
  });

  it('caps the list at RECENT_COMMANDS_LIMIT entries', () => {
    for (let i = 0; i < RECENT_COMMANDS_LIMIT + 3; i++) {
      recordRecentCommand(`cmd-${i}`);
    }
    const list = getRecentCommandIds();
    expect(list).toHaveLength(RECENT_COMMANDS_LIMIT);
    // Most-recent first; the earliest entries fell off the back.
    expect(list[0]).toBe(`cmd-${RECENT_COMMANDS_LIMIT + 2}`);
  });
});
