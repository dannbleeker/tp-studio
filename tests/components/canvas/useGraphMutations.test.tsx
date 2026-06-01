import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGraphMutations } from '@/components/canvas/hooks/useGraphMutations';
import { setCanvasInstance, setHoveredJunctor } from '@/services/canvasRef';
import { resetStoreForTest, useDocumentStore } from '@/store';
import {
  mockConnection,
  mockConnectStartParams,
  mockFinalConnectionState,
  mockMouseEvent,
} from '../../helpers/reactFlowFixtures';
import { seedConnectedPair, seedEntity } from '../../helpers/seedDoc';

/**
 * Session 134 coverage push (round 3) — `useGraphMutations` was at
 * 49% statements / 52% lines.
 *
 * The hook is a React Flow → store bridge. We test each callback
 * directly: invoke with the React Flow event shape, assert the
 * corresponding store mutation lands. No React Flow host required;
 * the callbacks are pure functions over the event payloads.
 */

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('useGraphMutations — onConnect', () => {
  it('connects source → target via the store on a valid Connection', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const { result } = renderHook(() => useGraphMutations());
    const before = Object.keys(s().doc.edges).length;
    result.current.onConnect({
      source: a.id,
      target: b.id,
      sourceHandle: null,
      targetHandle: null,
    });
    expect(Object.keys(s().doc.edges).length).toBe(before + 1);
  });

  it('ignores a Connection with missing source/target', () => {
    const { result } = renderHook(() => useGraphMutations());
    const before = Object.keys(s().doc.edges).length;
    // React Flow's Connection type marks source/target as `string`, but
    // in practice the cancel path delivers `null`. `mockConnection`
    // owns the cast so the test reads naturally.
    result.current.onConnect(mockConnection({ source: null, target: null }));
    expect(Object.keys(s().doc.edges).length).toBe(before);
  });

  it('toasts "already linked" on a duplicate instead of failing silently', () => {
    // Dann's "I can't add a new edge from #2 to #6 — why?": the pair was already
    // connected, so connect() refused and the edge silently never appeared.
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().connect(a.id, b.id); // the link already exists
    const edgesBefore = Object.keys(s().doc.edges).length;
    const { result } = renderHook(() => useGraphMutations());
    result.current.onConnect({
      source: a.id,
      target: b.id,
      sourceHandle: null,
      targetHandle: null,
    });
    expect(Object.keys(s().doc.edges).length).toBe(edgesBefore); // no duplicate
    expect(s().toasts.some((t) => /already linked/i.test(t.message))).toBe(true);
  });

  it('stays quiet on an accidental self-loop (no toast noise)', () => {
    const a = seedEntity('A');
    const toastsBefore = s().toasts.length;
    const { result } = renderHook(() => useGraphMutations());
    result.current.onConnect({
      source: a.id,
      target: a.id,
      sourceHandle: null,
      targetHandle: null,
    });
    expect(s().toasts.length).toBe(toastsBefore);
  });
});

describe('useGraphMutations — onReconnect (re-target an edge)', () => {
  // The handler only reads id / source / target off the old edge.
  type OldEdge = Parameters<ReturnType<typeof useGraphMutations>['onReconnect']>[0];
  const oldEdge = (id: string, source: string, target: string): OldEdge =>
    ({ id, source, target }) as unknown as OldEdge;

  it('re-targets the edge via the store on a valid reconnect', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const id = s().connect(a.id, b.id)?.id ?? '';
    const { result } = renderHook(() => useGraphMutations());
    result.current.onReconnect(
      oldEdge(id, a.id, b.id),
      mockConnection({ source: a.id, target: c.id })
    );
    expect(s().doc.edges[id]?.targetId).toBe(c.id);
  });

  it('is a no-op when the endpoints are unchanged', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const id = s().connect(a.id, b.id)?.id ?? '';
    const before = s().doc;
    const { result } = renderHook(() => useGraphMutations());
    result.current.onReconnect(
      oldEdge(id, a.id, b.id),
      mockConnection({ source: a.id, target: b.id })
    );
    expect(s().doc).toBe(before);
  });

  it('respects Browse Lock — a locked doc is not re-targeted', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const id = s().connect(a.id, b.id)?.id ?? '';
    useDocumentStore.setState({ browseLocked: true });
    const { result } = renderHook(() => useGraphMutations());
    result.current.onReconnect(
      oldEdge(id, a.id, b.id),
      mockConnection({ source: a.id, target: c.id })
    );
    expect(s().doc.edges[id]?.targetId).toBe(b.id); // unchanged
  });

  it('toasts when the store rejects the move (e.g. would self-loop)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const id = s().connect(a.id, b.id)?.id ?? '';
    const toastsBefore = s().toasts.length;
    const { result } = renderHook(() => useGraphMutations());
    // Drop the source onto the target → self-loop, rejected by the store.
    result.current.onReconnect(
      oldEdge(id, a.id, b.id),
      mockConnection({ source: b.id, target: b.id })
    );
    expect(s().doc.edges[id]?.sourceId).toBe(a.id); // unchanged
    expect(s().toasts.length).toBeGreaterThan(toastsBefore);
  });
});

describe('useGraphMutations — onConnectEnd (drop-on-node fallback)', () => {
  it('connects when the drag releases over a node body (no handle hit)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const { result } = renderHook(() => useGraphMutations());
    const before = Object.keys(s().doc.edges).length;
    result.current.onConnectEnd(
      mockMouseEvent(),
      mockFinalConnectionState({ fromId: a.id, toId: b.id, isValid: true })
    );
    expect(Object.keys(s().doc.edges).length).toBe(before + 1);
  });

  it('does nothing when source equals target (self-connect)', () => {
    const a = seedEntity('A');
    const { result } = renderHook(() => useGraphMutations());
    const before = Object.keys(s().doc.edges).length;
    result.current.onConnectEnd(
      mockMouseEvent(),
      mockFinalConnectionState({ fromId: a.id, toId: a.id, isValid: false })
    );
    expect(Object.keys(s().doc.edges).length).toBe(before);
  });

  it('returns immediately when toHandle is set (handle hit, onConnect already fired)', () => {
    const { result } = renderHook(() => useGraphMutations());
    const before = Object.keys(s().doc.edges).length;
    result.current.onConnectEnd(
      mockMouseEvent(),
      mockFinalConnectionState({
        fromId: 'a',
        toHandle: { nodeId: 'x' },
        isValid: true,
      })
    );
    expect(Object.keys(s().doc.edges).length).toBe(before);
  });

  it('a junctor drop with no live canvas instance fails open with a "group no longer exists" toast', () => {
    const a = seedEntity('A');
    // JunctorOverlay sets this on hover; with no React Flow instance registered
    // in the test, `getCanvasInstance()` is null → no member edge found → the
    // defensive info toast fires. Pins the Session-138-audited false-negative so
    // a future clickability refactor can't silently change it.
    setCanvasInstance(null);
    setHoveredJunctor({ groupId: 'g1', kind: 'AND' });
    const { result } = renderHook(() => useGraphMutations());
    result.current.onConnectEnd(
      mockMouseEvent(),
      mockFinalConnectionState({ fromId: a.id, isValid: false })
    );
    expect(s().toasts.some((t) => /group no longer exists/i.test(t.message))).toBe(true);
  });
});

describe('useGraphMutations — onNodesChange', () => {
  it('removes an entity when React Flow emits a node-remove change', () => {
    const e = seedEntity('to-delete');
    const { result } = renderHook(() => useGraphMutations());
    result.current.onNodesChange([{ id: e.id, type: 'remove' }] as never);
    expect(s().doc.entities[e.id]).toBeUndefined();
  });

  it('persists position on a settled drag (dragging: false)', () => {
    const e = seedEntity('to-drag');
    const { result } = renderHook(() => useGraphMutations());
    result.current.onNodesChange([
      {
        id: e.id,
        type: 'position',
        position: { x: 123, y: 456 },
        dragging: false,
      },
    ] as never);
    expect(s().doc.entities[e.id]?.position).toEqual({ x: 123, y: 456 });
  });

  it('does NOT persist position during a live drag (dragging: true)', () => {
    const e = seedEntity('still-dragging');
    const { result } = renderHook(() => useGraphMutations());
    result.current.onNodesChange([
      {
        id: e.id,
        type: 'position',
        position: { x: 99, y: 99 },
        dragging: true,
      },
    ] as never);
    expect(s().doc.entities[e.id]?.position).toBeUndefined();
  });
});

describe('useGraphMutations — onEdgesChange', () => {
  it('removes an edge when React Flow emits an edge-remove change', () => {
    const { edge } = seedConnectedPair();
    const { result } = renderHook(() => useGraphMutations());
    result.current.onEdgesChange([{ id: edge.id, type: 'remove' }] as never);
    expect(s().doc.edges[edge.id]).toBeUndefined();
  });

  it('ignores non-remove edge changes', () => {
    const { edge } = seedConnectedPair();
    const { result } = renderHook(() => useGraphMutations());
    result.current.onEdgesChange([{ id: edge.id, type: 'select', selected: true }] as never);
    // Edge survives.
    expect(s().doc.edges[edge.id]).toBeDefined();
  });
});

describe('useGraphMutations — edge-hover ref + drop-on-edge fallback', () => {
  it('tracks hovered edge id and fires addCoCauseToEdge on drop-in-empty-space', () => {
    const { edge } = seedConnectedPair('Root', 'Effect');
    const coCause = seedEntity('Co-cause');
    const { result } = renderHook(() => useGraphMutations());
    // Simulate the mouse entering the edge mid-drag.
    result.current.onEdgeMouseEnter(null, { id: edge.id } as never);
    // Release in empty space (toNode null, toHandle null) with the fromNode
    // being our co-cause candidate.
    const before = Object.values(s().doc.edges).filter((e) => e.sourceId === coCause.id).length;
    result.current.onConnectEnd(
      mockMouseEvent(),
      mockFinalConnectionState({ fromId: coCause.id, toId: null, isValid: false })
    );
    const after = Object.values(s().doc.edges).filter((e) => e.sourceId === coCause.id).length;
    expect(after).toBeGreaterThan(before);
  });

  it("clears the hovered edge ref on mouse-leave so a stale hover doesn't trigger", () => {
    const { edge } = seedConnectedPair();
    const coCause = seedEntity('Co-cause');
    const { result } = renderHook(() => useGraphMutations());
    result.current.onEdgeMouseEnter(null, { id: edge.id } as never);
    result.current.onEdgeMouseLeave(null, { id: edge.id } as never);
    const before = Object.values(s().doc.edges).filter((e) => e.sourceId === coCause.id).length;
    result.current.onConnectEnd(
      mockMouseEvent(),
      mockFinalConnectionState({ fromId: coCause.id, toId: null, isValid: false })
    );
    // Hover was cleared; drop-in-empty-space is a no-op.
    const after = Object.values(s().doc.edges).filter((e) => e.sourceId === coCause.id).length;
    expect(after).toBe(before);
  });
});

describe('useGraphMutations — connection-drag feedback (goal #2)', () => {
  it('onConnectStart records the drag source in connectingFromId', () => {
    const { result } = renderHook(() => useGraphMutations());
    expect(s().connectingFromId).toBeNull();
    result.current.onConnectStart(mockMouseEvent(), mockConnectStartParams({ nodeId: 'node-7' }));
    expect(s().connectingFromId).toBe('node-7');
  });

  it('onEdgeMouseEnter flags the hovered edge ONLY while a connection is in progress', () => {
    const { result } = renderHook(() => useGraphMutations());
    const edge = { id: 'edge-1' } as never;
    // Not connecting → hovering an edge does not flag a drop target.
    result.current.onEdgeMouseEnter(null, edge);
    expect(s().connectionDropEdgeId).toBeNull();
    // Start a connection, then hover → the edge is flagged as the drop target.
    result.current.onConnectStart(mockMouseEvent(), mockConnectStartParams({ nodeId: 'node-7' }));
    result.current.onEdgeMouseEnter(null, edge);
    expect(s().connectionDropEdgeId).toBe('edge-1');
    // Leaving the edge clears it.
    result.current.onEdgeMouseLeave(null, edge);
    expect(s().connectionDropEdgeId).toBeNull();
  });

  it('onConnectEnd clears both feedback flags', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const { result } = renderHook(() => useGraphMutations());
    result.current.onConnectStart(mockMouseEvent(), mockConnectStartParams({ nodeId: a.id }));
    s().setConnectionDropEdge('edge-1');
    expect(s().connectingFromId).toBe(a.id);
    result.current.onConnectEnd(
      mockMouseEvent(),
      mockFinalConnectionState({ fromId: a.id, toId: b.id, isValid: true })
    );
    expect(s().connectingFromId).toBeNull();
    expect(s().connectionDropEdgeId).toBeNull();
  });
});

describe('useGraphMutations — hovered-edge select cue (goal #3)', () => {
  it('onEdgeMouseEnter sets hoveredEdgeId even when no connection is in progress', () => {
    const { result } = renderHook(() => useGraphMutations());
    const edge = { id: 'edge-9' } as never;
    expect(s().hoveredEdgeId).toBeNull();
    // No connection drag in flight — the select-hover cue still flags the
    // edge. The store stays dumb here: the COMPONENT decides whether to
    // suppress the cue mid-drag, not the writer.
    result.current.onEdgeMouseEnter(null, edge);
    expect(s().hoveredEdgeId).toBe('edge-9');
    // ...and it did NOT also light up the connection drop-target (no drag).
    expect(s().connectionDropEdgeId).toBeNull();
  });

  it('onEdgeMouseLeave clears hoveredEdgeId even while a connection is in progress', () => {
    const { result } = renderHook(() => useGraphMutations());
    const edge = { id: 'edge-9' } as never;
    result.current.onConnectStart(mockMouseEvent(), mockConnectStartParams({ nodeId: 'node-1' }));
    result.current.onEdgeMouseEnter(null, edge);
    expect(s().hoveredEdgeId).toBe('edge-9');
    result.current.onEdgeMouseLeave(null, edge);
    // Leave always clears, regardless of the in-flight connection drag.
    expect(s().hoveredEdgeId).toBeNull();
  });
});
