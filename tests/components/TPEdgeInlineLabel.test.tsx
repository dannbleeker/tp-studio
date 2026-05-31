import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EdgeInlineLabel } from '@/components/canvas/edges/TPEdgeBadges';

/**
 * Goal #3 — the inline edge label is a click-to-select affordance (a much
 * bigger target than the thin line / tiny assumption badge).
 *
 * React Flow's `EdgeLabelRenderer` portals its children into a host node
 * that only exists under a live `<ReactFlow>` runtime (see the note in
 * `TPEdgeAssumptionBadge.test.tsx`). We stub it to a passthrough so the
 * label's own DOM is queryable in isolation — the portal placement is React
 * Flow's concern, not this unit's.
 */
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => children,
  };
});

afterEach(cleanup);

const TRUNCATED = 'Short label';
const FULL = 'Short label that is actually much longer than the inline cap';

const renderLabel = (onSelect?: () => void, onParentClick?: () => void) =>
  render(
    // The parent stands in for the React Flow pane: a real click bubbles to
    // it and — WITHOUT the label's stopPropagation — the pane handler would
    // clear the very selection the label just made. This test pins that the
    // stopPropagation holds, so the parent's onClick must NOT fire.
    // biome-ignore lint/a11y/noStaticElementInteractions: test scaffold standing in for the React Flow pane; it only needs to observe bubbled clicks.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same — pane stand-in; keyboard behaviour is out of scope for this bubbling assertion.
    <div data-testid="pane" onClick={onParentClick}>
      <EdgeInlineLabel
        labelX={10}
        labelY={20}
        fullLabel={FULL}
        truncated={TRUNCATED}
        {...(onSelect ? { onSelect } : {})}
      />
    </div>
  );

describe('EdgeInlineLabel — click-to-select (goal #3)', () => {
  it('calls onSelect exactly once when clicked', () => {
    const onSelect = vi.fn();
    const { getByText } = renderLabel(onSelect);
    fireEvent.click(getByText(TRUNCATED));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('stops propagation so the click never reaches the pane (which would clear selection)', () => {
    const onSelect = vi.fn();
    const onParentClick = vi.fn();
    const { getByText } = renderLabel(onSelect, onParentClick);
    fireEvent.click(getByText(TRUNCATED));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('exposes the full (untruncated) label on the title attribute for hover', () => {
    const { getByText } = renderLabel(vi.fn());
    expect(getByText(TRUNCATED).getAttribute('title')).toBe(FULL);
  });

  it('stays a <div> — edges carry their own keyboard focus/select path, so a button here would be a spurious tab stop', () => {
    const { getByText } = renderLabel(vi.fn());
    expect(getByText(TRUNCATED).tagName).toBe('DIV');
  });

  it('is a no-op (does not throw) when clicked with no onSelect handler', () => {
    const { getByText } = renderLabel();
    expect(() => fireEvent.click(getByText(TRUNCATED))).not.toThrow();
  });
});
