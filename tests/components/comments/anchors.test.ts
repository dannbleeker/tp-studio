import { describe, expect, it } from 'vitest';
import { anchorFromSelection, describeAnchor } from '@/components/comments/anchors';
import type { Edge, Entity } from '@/domain/types';
import type { EdgeId, EntityId } from '@/domain/types/ids';
import type { Selection } from '@/store/uiSlice/types';

const eid = (s: string) => s as EntityId;
const edid = (s: string) => s as EdgeId;

describe('anchorFromSelection', () => {
  it('maps a single entity selection to an entity anchor', () => {
    const sel: Selection = { kind: 'entities', ids: [eid('e1')] };
    expect(anchorFromSelection(sel)).toEqual({ kind: 'entity', entityId: 'e1' });
  });

  it('maps a single edge selection to an edge anchor', () => {
    const sel: Selection = { kind: 'edges', ids: [edid('ed1')] };
    expect(anchorFromSelection(sel)).toEqual({ kind: 'edge', edgeId: 'ed1' });
  });

  it('falls back to a document anchor for none / multi / group selections', () => {
    expect(anchorFromSelection({ kind: 'none' })).toEqual({ kind: 'document' });
    expect(anchorFromSelection({ kind: 'entities', ids: [eid('a'), eid('b')] })).toEqual({
      kind: 'document',
    });
    expect(anchorFromSelection({ kind: 'groups', ids: ['g1' as never] })).toEqual({
      kind: 'document',
    });
  });
});

describe('describeAnchor', () => {
  const entities: Record<string, Entity> = {
    e1: { title: 'Root cause' } as Entity,
    e2: { title: 'Effect' } as Entity,
    blank: { title: '   ' } as Entity,
  };
  const edges: Record<string, Edge> = {
    ed1: { sourceId: eid('e1'), targetId: eid('e2') } as Edge,
  };

  it('labels a document anchor', () => {
    expect(describeAnchor({ kind: 'document' }, entities, edges)).toEqual({
      text: 'Whole diagram',
      missing: false,
    });
  });

  it('labels an entity anchor by title, with an Untitled fallback', () => {
    expect(describeAnchor({ kind: 'entity', entityId: eid('e1') }, entities, edges).text).toBe(
      'Root cause'
    );
    expect(describeAnchor({ kind: 'entity', entityId: eid('blank') }, entities, edges).text).toBe(
      'Untitled'
    );
  });

  it('labels an edge anchor as "Source → Target"', () => {
    expect(describeAnchor({ kind: 'edge', edgeId: edid('ed1') }, entities, edges).text).toBe(
      'Root cause → Effect'
    );
  });

  it('flags a missing entity / edge anchor', () => {
    expect(describeAnchor({ kind: 'entity', entityId: eid('gone') }, entities, edges)).toEqual({
      text: 'Deleted entity',
      missing: true,
    });
    expect(describeAnchor({ kind: 'edge', edgeId: edid('gone') }, entities, edges)).toEqual({
      text: 'Deleted connection',
      missing: true,
    });
  });
});
