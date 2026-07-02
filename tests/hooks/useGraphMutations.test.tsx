import { act, cleanup, renderHook } from '@testing-library/react';
import type { FinalConnectionState } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGraphMutations } from '@/components/canvas/hooks/useGraphMutations';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { mockFinalConnectionState, mockMouseEvent } from '../helpers/reactFlowFixtures';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Session 49 — `onConnectEnd` fallback. When the user drags a connection
 * and releases over the *body* of a target node (not its handle dot),
 * React Flow's `onConnect` doesn't fire. The fallback in `useGraphMutations`
 * inspects the `FinalConnectionState` and bridges that to the same
 * `connect()` action.
 *
 * jsdom doesn't actually simulate the drag — we synthesize a
 * `FinalConnectionState` matching what React Flow would emit and assert
 * the hook routes it correctly. The test focuses on the *bridging logic*,
 * which is the new code; the drag-to-handle path stays exercised by
 * existing canvas tests.
 *
 * Session 135 — migrated from local `fakeNode` / `finalStateOverBody` /
 * `finalStateOverEmptyCanvas` helpers (each carrying its own
 * `as unknown as` cast) to the shared `mockFinalConnectionState`
 * fixture in `tests/helpers/reactFlowFixtures.ts`. The fixture knows
 * the production hook only reads `toHandle` + `fromNode.id` +
 * `toNode.id` + `isValid`, so the minimal-payload it returns matches
 * production's actual surface area.
 */

const finalStateOverBody = (fromId: string, toId: string): FinalConnectionState =>
  mockFinalConnectionState({ fromId, toId, isValid: true });

const finalStateOverEmptyCanvas = (fromId: string): FinalConnectionState =>
  mockFinalConnectionState({ fromId, toId: null, isValid: false });

const fakeEvent = mockMouseEvent();

describe('useGraphMutations.onConnectEnd', () => {
  it('connects when released over a target node body (no handle hit)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    expect(Object.values(useDocumentStore.getState().doc.edges)).toHaveLength(0);

    const { result } = renderHook(() => useGraphMutations());
    act(() => result.current.onConnectEnd(fakeEvent, finalStateOverBody(a.id, b.id)));

    const edges = Object.values(useDocumentStore.getState().doc.edges);
    expect(edges).toHaveLength(1);
    expect(edges[0]?.sourceId).toBe(a.id);
    expect(edges[0]?.targetId).toBe(b.id);
  });

  it('creates a connected child when a source-handle drag is released over empty canvas', () => {
    const a = seedEntity('A');
    const { result } = renderHook(() => useGraphMutations());
    act(() => result.current.onConnectEnd(fakeEvent, finalStateOverEmptyCanvas(a.id)));
    // Empty-space release now mints a fresh entity and wires it (source handle
    // → new downstream child), instead of silently doing nothing.
    const doc = useDocumentStore.getState().doc;
    const edges = Object.values(doc.edges);
    expect(Object.keys(doc.entities)).toHaveLength(2);
    expect(edges).toHaveLength(1);
    expect(edges[0]?.sourceId).toBe(a.id);
    expect(edges[0]?.targetId).not.toBe(a.id);
  });

  it('creates a connected parent when a target-handle drag is released over empty canvas', () => {
    const a = seedEntity('A');
    const { result } = renderHook(() => useGraphMutations());
    const state = mockFinalConnectionState({ fromId: a.id, toId: null, fromHandleType: 'target' });
    act(() => result.current.onConnectEnd(fakeEvent, state));
    const doc = useDocumentStore.getState().doc;
    const edges = Object.values(doc.edges);
    expect(Object.keys(doc.entities)).toHaveLength(2);
    expect(edges).toHaveLength(1);
    // Target handle → the new entity is the upstream parent (cause).
    expect(edges[0]?.targetId).toBe(a.id);
    expect(edges[0]?.sourceId).not.toBe(a.id);
  });

  it('does nothing on a self-loop (released over the source node body)', () => {
    const a = seedEntity('A');
    const { result } = renderHook(() => useGraphMutations());
    act(() => result.current.onConnectEnd(fakeEvent, finalStateOverBody(a.id, a.id)));
    expect(Object.values(useDocumentStore.getState().doc.edges)).toHaveLength(0);
  });

  it('does nothing when toHandle is set (the normal onConnect path)', () => {
    // When React Flow already snapped to a handle, `toHandle` is non-null
    // and `onConnect` has fired (or will fire). The fallback must NOT
    // fire a second connect in that case.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const withHandle: FinalConnectionState = mockFinalConnectionState({
      fromId: a.id,
      toId: b.id,
      isValid: true,
      toHandle: { nodeId: b.id },
    });
    const { result } = renderHook(() => useGraphMutations());
    act(() => result.current.onConnectEnd(fakeEvent, withHandle));
    expect(Object.values(useDocumentStore.getState().doc.edges)).toHaveLength(0);
  });

  it('does nothing when Browse Lock is on (gated by guardWriteOrToast)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    act(() => useDocumentStore.getState().setBrowseLocked(true));

    const { result } = renderHook(() => useGraphMutations());
    act(() => result.current.onConnectEnd(fakeEvent, finalStateOverBody(a.id, b.id)));
    expect(Object.values(useDocumentStore.getState().doc.edges)).toHaveLength(0);
  });
});
