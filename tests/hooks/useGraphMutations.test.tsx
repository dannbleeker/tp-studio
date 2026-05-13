import { useGraphMutations } from '@/components/canvas/useGraphMutations';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { FinalConnectionState, InternalNode } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
 */

const fakeNode = (id: string): InternalNode =>
  ({ id, position: { x: 0, y: 0 }, data: {} }) as unknown as InternalNode;

const finalStateOverBody = (fromId: string, toId: string): FinalConnectionState =>
  ({
    fromHandle: { id: null, type: 'source', nodeId: fromId, position: 'top' },
    fromNode: fakeNode(fromId),
    fromPosition: 'top',
    isValid: true,
    to: { x: 0, y: 0 },
    toHandle: null,
    toNode: fakeNode(toId),
    toPosition: 'bottom',
    pointer: { x: 0, y: 0 },
  }) as unknown as FinalConnectionState;

const finalStateOverEmptyCanvas = (fromId: string): FinalConnectionState =>
  ({
    fromHandle: { id: null, type: 'source', nodeId: fromId, position: 'top' },
    fromNode: fakeNode(fromId),
    fromPosition: 'top',
    isValid: false,
    to: { x: 0, y: 0 },
    toHandle: null,
    toNode: null,
    toPosition: 'bottom',
    pointer: { x: 0, y: 0 },
  }) as unknown as FinalConnectionState;

const fakeEvent = new MouseEvent('mouseup');

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

  it('does nothing when released over empty canvas (toNode is null)', () => {
    const a = seedEntity('A');
    const { result } = renderHook(() => useGraphMutations());
    act(() => result.current.onConnectEnd(fakeEvent, finalStateOverEmptyCanvas(a.id)));
    expect(Object.values(useDocumentStore.getState().doc.edges)).toHaveLength(0);
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
    const withHandle: FinalConnectionState = {
      ...finalStateOverBody(a.id, b.id),
      toHandle: { id: null, type: 'target', nodeId: b.id, position: 'bottom' } as never,
    };
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
