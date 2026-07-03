import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCloudEvaporation } from '@/components/canvas/hooks/useCloudEvaporation';
import type { Assumption, DocumentId, Entity, TPDocument } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../../domain/helpers';

/**
 * Rising-edge contract of the Session 195 evaporation easter egg: fires only
 * when a doc transitions unresolved → resolved while being watched — never on
 * first observation of a doc (mount or tab switch).
 */

const buildCloudDoc = (broken: boolean, docId = 'doc-1'): TPDocument => {
  resetIds();
  const d = makeEntity({ type: 'want', title: 'D', ecSlot: 'd' });
  const dPrime = makeEntity({ type: 'want', title: "D'", ecSlot: 'dPrime' });
  const injection: Entity = makeEntity({
    type: 'injection',
    title: 'Injection',
    ...(broken ? { attributes: { implemented: { kind: 'bool', value: true } } } : {}),
  });
  const conflict = makeEdge(d.id, dPrime.id, { kind: 'necessity', isMutualExclusion: true });
  const assumption: Assumption = {
    id: 'asm-1',
    edgeId: conflict.id,
    text: 'Only one of us can have it',
    status: 'unexamined',
    ...(broken ? { injectionIds: [injection.id] } : {}),
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };
  return {
    ...makeDoc([d, dPrime, injection], [conflict], 'ec'),
    id: docId as DocumentId,
    assumptions: { [assumption.id]: assumption },
  };
};

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('useCloudEvaporation', () => {
  it('does NOT fire on first observation of an already-broken cloud', () => {
    renderHook(({ doc }) => useCloudEvaporation(doc), {
      initialProps: { doc: buildCloudDoc(true) },
    });
    expect(useDocumentStore.getState().evaporatingEntityIds).toBeNull();
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
  });

  it('fires exactly once on the unresolved → resolved transition', () => {
    const before = buildCloudDoc(false);
    const after = buildCloudDoc(true);
    const { rerender } = renderHook(({ doc }) => useCloudEvaporation(doc), {
      initialProps: { doc: before },
    });
    rerender({ doc: after });
    const state = useDocumentStore.getState();
    expect(state.evaporatingEntityIds).toHaveLength(2);
    expect(state.toasts.some((t) => t.message.includes('Goldratt'))).toBe(true);
  });

  it('does not fire when switching tabs onto an already-broken cloud', () => {
    const docA = buildCloudDoc(false, 'doc-a');
    const docB = buildCloudDoc(true, 'doc-b');
    const { rerender } = renderHook(({ doc }) => useCloudEvaporation(doc), {
      initialProps: { doc: docA },
    });
    rerender({ doc: docB });
    expect(useDocumentStore.getState().evaporatingEntityIds).toBeNull();
  });

  it('does not fire while the cloud stays resolved', () => {
    const broken = buildCloudDoc(true);
    const { rerender } = renderHook(({ doc }) => useCloudEvaporation(doc), {
      initialProps: { doc: broken },
    });
    rerender({ doc: { ...broken, title: 'Renamed' } });
    expect(useDocumentStore.getState().evaporatingEntityIds).toBeNull();
  });

  it('re-arms after the cloud is un-broken and broken again', () => {
    const resolved = buildCloudDoc(true);
    const unresolved = buildCloudDoc(false);
    const { rerender } = renderHook(({ doc }) => useCloudEvaporation(doc), {
      initialProps: { doc: unresolved },
    });
    rerender({ doc: resolved });
    rerender({ doc: { ...unresolved } });
    rerender({ doc: { ...resolved } });
    const state = useDocumentStore.getState();
    // Two separate firings — dedupe on the toast keeps the message single,
    // but the effect state reflects the latest trigger.
    expect(state.evaporatingEntityIds).toHaveLength(2);
  });
});
