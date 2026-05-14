import { ECSlotIndicator } from '@/components/canvas/ECSlotIndicator';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Session 93 / EC PPT comparison #32 — ECSlotIndicator unit tests.
 *
 * The component is a small inline SVG showing the canonical 5-box EC
 * layout with one slot highlighted. Tests pin the rendering contract:
 * always renders 5 boxes (one per slot), the targeted box gets the
 * `fill-indigo-500` class, and the title attribute updates to name
 * the targeted slot. We don't pin exact coordinates — the layout map
 * is the source of truth and changing it shouldn't break tests.
 */

afterEach(cleanup);

describe('ECSlotIndicator', () => {
  it('renders five rectangles, one per EC slot', () => {
    const { container } = render(<ECSlotIndicator targetSlot={null} />);
    const rects = container.querySelectorAll('rect');
    expect(rects).toHaveLength(5);
  });

  it('renders one text label per slot (A / B / C / D / D′)', () => {
    const { container } = render(<ECSlotIndicator targetSlot={null} />);
    const labels = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(labels).toContain('A');
    expect(labels).toContain('B');
    expect(labels).toContain('C');
    expect(labels).toContain('D');
    expect(labels).toContain('D′');
  });

  it('highlights the targeted slot with the indigo fill class', () => {
    const { container } = render(<ECSlotIndicator targetSlot="b" />);
    // The "B" slot's <text> sits next to a <rect>. Find the rect that
    // shares the indigo-filled class set.
    const rects = Array.from(container.querySelectorAll('rect'));
    const filled = rects.filter((r) => r.getAttribute('class')?.includes('fill-indigo-500'));
    // Exactly one rect should be filled.
    expect(filled).toHaveLength(1);
  });

  it('renders no filled slot when targetSlot is null', () => {
    const { container } = render(<ECSlotIndicator targetSlot={null} />);
    const filled = Array.from(container.querySelectorAll('rect')).filter((r) =>
      r.getAttribute('class')?.includes('fill-indigo-500')
    );
    expect(filled).toHaveLength(0);
  });

  it('updates the title to mention the targeted slot label', () => {
    const { container } = render(<ECSlotIndicator targetSlot="dPrime" />);
    const title = container.querySelector('title');
    expect(title?.textContent).toContain('D′');
  });
});
