import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGraphMutations } from '@/components/canvas/hooks/useGraphMutations';
import { resetStoreForTest, useDocumentStore } from '@/store';
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
    result.current.onConnect({
      source: null,
      target: null,
      sourceHandle: null,
      targetHandle: null,
    });
    expect(Object.keys(s().doc.edges).length).toBe(before);
  });
});

describe('useGraphMutations — onConnectEnd (drop-on-node fallback)', () => {
  it('connects when the drag releases over a node body (no handle hit)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const { result } = renderHook(() => useGraphMutations());
    const before = Object.keys(s().doc.edges).length;
    result.current.onConnectEnd(
      {} as unknown as MouseEvent,
      {
        toHandle: null,
        fromNode: { id: a.id } as unknown as never,
        toNode: { id: b.id } as unknown as never,
        isValid: true,
      } as never
    );
    expect(Object.keys(s().doc.edges).length).toBe(before + 1);
  });

  it('does nothing when source equals target (self-connect)', () => {
    const a = seedEntity('A');
    const { result } = renderHook(() => useGraphMutations());
    const before = Object.keys(s().doc.edges).length;
    result.current.onConnectEnd(
      {} as unknown as MouseEvent,
      {
        toHandle: null,
        fromNode: { id: a.id } as unknown as never,
        toNode: { id: a.id } as unknown as never,
        isValid: false,
      } as never
    );
    expect(Object.keys(s().doc.edges).length).toBe(before);
  });

  it('returns immediately when toHandle is set (handle hit, onConnect already fired)', () => {
    const { result } = renderHook(() => useGraphMutations());
    const before = Object.keys(s().doc.edges).length;
    result.current.onConnectEnd(
      {} as unknown as MouseEvent,
      {
        toHandle: { nodeId: 'x' } as unknown as never,
        fromNode: { id: 'a' } as unknown as never,
        toNode: null,
        isValid: true,
      } as never
    );
    expect(Object.keys(s().doc.edges).length).toBe(before);
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
      {} as unknown as MouseEvent,
      {
        toHandle: null,
        fromNode: { id: coCause.id } as unknown as never,
        toNode: null,
        isValid: false,
      } as never
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
      {} as unknown as MouseEvent,
      {
        toHandle: null,
        fromNode: { id: coCause.id } as unknown as never,
        toNode: null,
        isValid: false,
      } as never
    );
    // Hover was cleared; drop-in-empty-space is a no-op.
    const after = Object.values(s().doc.edges).filter((e) => e.sourceId === coCause.id).length;
    expect(after).toBe(before);
  });
});
