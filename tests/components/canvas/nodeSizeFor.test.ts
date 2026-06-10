import { describe, expect, it } from 'vitest';
import {
  estimateTitleLines,
  MAX_CARD_GROW_LINES,
  nodeSizeFor,
} from '@/components/canvas/hooks/graphViewConstants';
import { NODE_MIN_HEIGHT, NODE_WIDTH, ST_NODE_HEIGHT } from '@/domain/constants';
import { createDocument } from '@/domain/factory';
import type { TPDocument } from '@/domain/types';

/** A CRT doc with a single UDE entity carrying `title` (+ optional extra fields),
 *  so the grow-to-fit height can be exercised without standing up a whole graph. */
const udeDoc = (title: string, extra: Record<string, unknown> = {}): TPDocument =>
  ({
    ...createDocument('crt'),
    entities: {
      e1: {
        id: 'e1',
        type: 'ude',
        title,
        annotationNumber: 1,
        createdAt: 0,
        updatedAt: 0,
        ...extra,
      },
    },
  }) as unknown as TPDocument;

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

  // --- Grow-to-fit (opts.growToFit) — behaviour is opt-in; omitting opts is
  // identical to the legacy fixed-height path (pinned by the cases above). ---

  it('grow-to-fit keeps a ≤2-line title at the NODE_MIN_HEIGHT floor', () => {
    // Two explicit lines = the base clamp, so no growth.
    const size = nodeSizeFor(udeDoc('line one\nline two'), 'e1', { growToFit: true });
    expect(size).toEqual({ width: NODE_WIDTH, height: NODE_MIN_HEIGHT });
  });

  it('grow-to-fit grows a 3-line title by exactly one default line-height', () => {
    // 3 paragraphs → 3 lines; height = 72 + ceil(1 × 15·1.35) = 72 + 21 = 93.
    const size = nodeSizeFor(udeDoc('a\nb\nc'), 'e1', { growToFit: true });
    expect(size).toEqual({ width: NODE_WIDTH, height: 93 });
  });

  it('grow-to-fit caps height at MAX_CARD_GROW_LINES (no unbounded growth)', () => {
    const many = Array.from({ length: 12 }, (_, i) => `l${i}`).join('\n');
    const capped = nodeSizeFor(udeDoc(many), 'e1', { growToFit: true });
    // 72 + ceil((6 − 2) × 15·1.35) = 72 + 81 = 153.
    expect(capped).toEqual({ width: NODE_WIDTH, height: 153 });
    // A title already at the cap can't grow any taller.
    const evenMore = nodeSizeFor(udeDoc(`${many}\nl12\nl13\nl14`), 'e1', { growToFit: true });
    expect(evenMore).toEqual(capped);
    expect(MAX_CARD_GROW_LINES).toBe(6);
  });

  it('grow-to-fit uses the workshop-mode font (taller lines) when appMode is set', () => {
    const many = Array.from({ length: 12 }, (_, i) => `l${i}`).join('\n');
    // 72 + ceil(4 × 18·1.40) = 72 + 101 = 173 — taller than the 153 default.
    const size = nodeSizeFor(udeDoc(many), 'e1', { growToFit: true, appMode: 'workshop' });
    expect(size).toEqual({ width: NODE_WIDTH, height: 173 });
  });

  it('grow-to-fit does NOT change an S&T-format card (still ST_NODE_HEIGHT)', () => {
    const doc = {
      ...createDocument('st'),
      entities: {
        'st-1': {
          id: 'st-1',
          type: 'injection',
          title: 'a\nb\nc\nd\ne\nf\ng',
          annotationNumber: 1,
          attributes: { stStrategy: 'do the thing' },
          createdAt: 0,
          updatedAt: 0,
        },
      },
    } as unknown as TPDocument;
    expect(nodeSizeFor(doc, 'st-1', { growToFit: true })).toEqual({
      width: NODE_WIDTH,
      height: ST_NODE_HEIGHT,
    });
  });

  it('omitting opts (or growToFit:false) is unchanged even for a long title', () => {
    const long = udeDoc('a\nb\nc\nd\ne\nf');
    expect(nodeSizeFor(long, 'e1')).toEqual({ width: NODE_WIDTH, height: NODE_MIN_HEIGHT });
    expect(nodeSizeFor(long, 'e1', { growToFit: false })).toEqual({
      width: NODE_WIDTH,
      height: NODE_MIN_HEIGHT,
    });
  });
});

/**
 * `estimateTitleLines` is the pure word-wrap line counter behind grow-to-fit.
 * Newline-based cases pin exact counts (independent of the char-width model);
 * the wrap/monotonicity cases pin the model's direction without over-fitting it.
 */
describe('estimateTitleLines', () => {
  it('treats empty / short titles as a single line', () => {
    expect(estimateTitleLines('', 15)).toBe(1);
    expect(estimateTitleLines('short', 15)).toBe(1);
  });

  it('counts one line per explicit newline paragraph', () => {
    expect(estimateTitleLines('a\nb\nc', 15)).toBe(3);
    expect(estimateTitleLines('only one', 15)).toBe(1);
  });

  it('wraps a long sentence onto multiple lines', () => {
    const long =
      'Minimize the cost and time of developing and maintaining the IT assets across the whole organisation';
    expect(estimateTitleLines(long, 15)).toBeGreaterThanOrEqual(3);
  });

  it('breaks a single over-long word across lines', () => {
    expect(estimateTitleLines('x'.repeat(300), 15)).toBeGreaterThanOrEqual(6);
  });

  it('estimates more lines at a larger font size (monotonic in fontSize)', () => {
    const text = 'the quick brown fox jumps over the lazy dog again and again and again';
    expect(estimateTitleLines(text, 18)).toBeGreaterThanOrEqual(estimateTitleLines(text, 15));
  });
});
