import { describe, expect, it } from 'vitest';
import { nodeSizeFor } from '@/components/canvas/hooks/graphViewConstants';
import { NODE_MIN_HEIGHT, NODE_WIDTH, ST_NODE_HEIGHT } from '@/domain/constants';
import { createDocument } from '@/domain/factory';
import type { TPDocument } from '@/domain/types';

/**
 * `nodeSizeFor` is the single rule every render/layout stage uses to size a
 * node (dagre input, A* obstacle box, group bbox, MiniMap hint). Pinned here so
 * the per-kind dimensions can't drift and the S&T-taller case stays correct.
 */
describe('nodeSizeFor', () => {
  it('sizes a normal entity at NODE_WIDTH × NODE_MIN_HEIGHT', () => {
    const doc = {
      ...createDocument('crt'),
      entities: {
        e1: {
          id: 'e1',
          type: 'ude',
          title: 'A UDE',
          annotationNumber: 1,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    } as unknown as TPDocument;
    expect(nodeSizeFor(doc, 'e1')).toEqual({ width: NODE_WIDTH, height: NODE_MIN_HEIGHT });
  });

  it('sizes an S&T-format entity (injection + ST facet) taller — ST_NODE_HEIGHT', () => {
    const doc = {
      ...createDocument('st'),
      entities: {
        'st-1': {
          id: 'st-1',
          type: 'injection',
          title: 'Strategy',
          annotationNumber: 1,
          attributes: { stStrategy: 'do the thing' },
          createdAt: 0,
          updatedAt: 0,
        },
      },
    } as unknown as TPDocument;
    expect(nodeSizeFor(doc, 'st-1')).toEqual({ width: NODE_WIDTH, height: ST_NODE_HEIGHT });
  });

  it('sizes a (collapsed-root) group at the COLLAPSED dimensions', () => {
    const doc = {
      ...createDocument('crt'),
      entities: {},
      groups: { g1: { id: 'g1', title: 'G', memberIds: [], collapsed: true } },
    } as unknown as TPDocument;
    const size = nodeSizeFor(doc, 'g1');
    // COLLAPSED_WIDTH × COLLAPSED_HEIGHT (220 × 90); asserted by value so the
    // group branch is pinned without importing the canvas-local constants.
    expect(size).toEqual({ width: 220, height: 90 });
  });

  it('returns null for an id that is neither a known entity nor a group', () => {
    const doc = createDocument('crt');
    expect(nodeSizeFor(doc, 'does-not-exist')).toBeNull();
  });
});
