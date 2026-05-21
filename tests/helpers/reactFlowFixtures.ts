/**
 * Session 135 / infra-debt — typed builders for React Flow's partial
 * event payloads. React Flow's runtime sometimes hands callbacks
 * `null` where its TypeScript types say `string` (the cancelled-drag
 * path delivers `null` source/target on Connection objects); React
 * Flow's `OnConnectEnd` shape exposes a deeply-nested
 * `FinalConnectionState` that mostly carries values we don't care
 * about for store-level tests.
 *
 * Before this file, every test of `useGraphMutations` /
 * `useGraphPositions` etc. open-coded these mocks with
 * `as unknown as never` casts (~15 instances across the test suite).
 * Centralising the builders does two things:
 *
 *   1. Single place to update if React Flow shifts its event shape.
 *   2. The casts live in this fixture, not scattered across test
 *      bodies. Reading the tests is easier when the test logic
 *      doesn't open-code the type gymnastics.
 *
 * Each helper takes a small `Partial<…>` of what the test actually
 * needs and builds the minimum-viable payload. The `as never` exit
 * casts are intentional — they hand the real React Flow type
 * checker something it accepts without making the test imports
 * heavier.
 */

import type { Connection, FinalConnectionState } from '@xyflow/react';

/**
 * A Connection where the cancel path may pass `null` source/target.
 * Tests of `onConnect`'s missing-data guard use this to exercise the
 * fallback. Defaults match what React Flow's runtime hands the
 * callback when the user drops outside any handle.
 */
export function mockConnection(partial: {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): Connection {
  return {
    source: (partial.source ?? null) as string,
    target: (partial.target ?? null) as string,
    sourceHandle: partial.sourceHandle ?? null,
    targetHandle: partial.targetHandle ?? null,
  };
}

/**
 * Build a minimal `FinalConnectionState` for `onConnectEnd` tests.
 * Real React Flow payloads carry positions, viewport transforms, and
 * deeper node internals; the production hook only reads
 * `toHandle`, `fromNode.id`, `toNode.id`, and `isValid`. We populate
 * just those four (plus the runtime requires the keys to exist —
 * `toHandle: null` rather than `undefined`).
 */
export function mockFinalConnectionState(partial: {
  fromId?: string | null;
  toId?: string | null;
  toHandle?: { nodeId: string } | null;
  isValid?: boolean;
}): FinalConnectionState {
  // Distinguish "key not in partial" (→ undefined → default null) from
  // "key present, value null" (→ explicit null, not a node). Using
  // `in` here matters: `partial.toId === null` would be true for both
  // "not passed" and "passed as null" cases.
  const fromNode =
    'fromId' in partial && partial.fromId !== null && partial.fromId !== undefined
      ? { id: partial.fromId }
      : null;
  const toNode =
    'toId' in partial && partial.toId !== null && partial.toId !== undefined
      ? { id: partial.toId }
      : null;
  return {
    toHandle: partial.toHandle ?? null,
    fromNode,
    toNode,
    isValid: partial.isValid ?? null,
  } as never;
}

/**
 * An empty `MouseEvent` cast that satisfies `onConnectEnd`'s first
 * parameter without dragging in jsdom event construction. The
 * production hook doesn't read any property off this arg — the
 * second arg (`FinalConnectionState`) carries everything.
 */
export function mockMouseEvent(): MouseEvent {
  return {} as MouseEvent;
}
