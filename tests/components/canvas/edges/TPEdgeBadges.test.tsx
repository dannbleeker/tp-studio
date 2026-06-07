import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AggregateBadge,
  AssumptionBadge,
  BackEdgeBadge,
  CommentBadge,
  DelayBadge,
  DescriptionBadge,
  EdgeInlineLabel,
  FallbackLabel,
  LoopNameBadge,
  LoopPolarityBadge,
  MutexBadge,
  WeightBadge,
} from '@/components/canvas/edges/TPEdgeBadges';

/**
 * Unit tests for the mid-edge badge sub-components in TPEdgeBadges.tsx.
 *
 * React Flow's `EdgeLabelRenderer` portals its children into a host node that
 * only exists under a live `<ReactFlow>` runtime. We stub it to a passthrough
 * so each badge's own DOM is queryable in isolation — the portal placement is
 * React Flow's concern, not these units'.
 */
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => children,
  };
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// BackEdgeBadge
// ---------------------------------------------------------------------------
describe('BackEdgeBadge', () => {
  it('renders the ↻ glyph', () => {
    const { getByRole } = render(<BackEdgeBadge labelX={100} labelY={200} />);
    const el = getByRole('img', { name: /back-edge/i });
    expect(el.textContent).toBe('↻');
  });

  it('includes the anchor offset in its transform style (labelX+16, labelY-14)', () => {
    const { getByRole } = render(<BackEdgeBadge labelX={50} labelY={75} />);
    const style = getByRole('img', { name: /back-edge/i }).getAttribute('style') ?? '';
    // BackEdgeBadge offsets: labelX+16=66, labelY-14=61
    expect(style).toContain('66px');
    expect(style).toContain('61px');
  });

  it('has a descriptive title attribute', () => {
    const { getByRole } = render(<BackEdgeBadge labelX={0} labelY={0} />);
    const el = getByRole('img', { name: /back-edge/i });
    expect(el.getAttribute('title')).toMatch(/back-edge/i);
  });
});

// ---------------------------------------------------------------------------
// MutexBadge
// ---------------------------------------------------------------------------
describe('MutexBadge', () => {
  it('renders the ⚡ glyph', () => {
    const { getByRole } = render(<MutexBadge labelX={0} labelY={0} />);
    const el = getByRole('img', { name: /mutually exclusive/i });
    expect(el.textContent).toContain('⚡');
  });

  it('has the mutually-exclusive title', () => {
    const { getByRole } = render(<MutexBadge labelX={0} labelY={0} />);
    expect(getByRole('img', { name: /mutually exclusive/i }).getAttribute('title')).toMatch(
      /mutually exclusive/i
    );
  });

  it('applies translate with the given labelX/labelY offset (labelX, labelY-14)', () => {
    const { getByRole } = render(<MutexBadge labelX={30} labelY={60} />);
    const style = getByRole('img', { name: /mutually exclusive/i }).getAttribute('style') ?? '';
    // MutexBadge offsets: labelX+0=30, labelY-14=46
    expect(style).toContain('30px');
    expect(style).toContain('46px');
  });
});

// ---------------------------------------------------------------------------
// WeightBadge — negative vs zero branch
// ---------------------------------------------------------------------------
describe('WeightBadge', () => {
  it('shows the − glyph and aria-label for negative weight', () => {
    const { getByRole } = render(<WeightBadge labelX={0} labelY={0} weight="negative" />);
    const el = getByRole('img', { name: /negative/i });
    expect(el.textContent).toBe('−');
  });

  it('shows the ∅ glyph for zero weight', () => {
    const { getByRole } = render(<WeightBadge labelX={0} labelY={0} weight="zero" />);
    const el = getByRole('img', { name: /zero/i });
    expect(el.textContent).toBe('∅');
  });

  it('title describes negative correlation for negative weight', () => {
    const { getByRole } = render(<WeightBadge labelX={0} labelY={0} weight="negative" />);
    expect(getByRole('img', { name: /negative/i }).getAttribute('title')).toMatch(/negative/i);
  });

  it('title describes neutral/zero for zero weight', () => {
    const { getByRole } = render(<WeightBadge labelX={0} labelY={0} weight="zero" />);
    expect(getByRole('img', { name: /zero/i }).getAttribute('title')).toMatch(/zero/i);
  });

  it('applies rose border class for negative weight', () => {
    const { getByRole } = render(<WeightBadge labelX={0} labelY={0} weight="negative" />);
    expect(getByRole('img', { name: /negative/i }).className).toContain('rose');
  });

  it('applies neutral border class for zero weight', () => {
    const { getByRole } = render(<WeightBadge labelX={0} labelY={0} weight="zero" />);
    expect(getByRole('img', { name: /zero/i }).className).toContain('neutral');
  });
});

// ---------------------------------------------------------------------------
// LoopPolarityBadge — reinforcing / balancing / unknown
// ---------------------------------------------------------------------------
describe('LoopPolarityBadge', () => {
  it('renders R for reinforcing polarity', () => {
    const { getByRole } = render(
      <LoopPolarityBadge labelX={0} labelY={0} polarity="reinforcing" />
    );
    const el = getByRole('img', { name: /reinforcing/i });
    expect(el.textContent).toBe('R');
  });

  it('renders B for balancing polarity', () => {
    const { getByRole } = render(<LoopPolarityBadge labelX={0} labelY={0} polarity="balancing" />);
    const el = getByRole('img', { name: /balancing/i });
    expect(el.textContent).toBe('B');
  });

  it('renders nothing for unknown polarity', () => {
    const { container } = render(<LoopPolarityBadge labelX={0} labelY={0} polarity="unknown" />);
    expect(container.firstChild).toBeNull();
  });

  it('title mentions reinforcing for reinforcing polarity', () => {
    const { getByRole } = render(
      <LoopPolarityBadge labelX={0} labelY={0} polarity="reinforcing" />
    );
    expect(getByRole('img', { name: /reinforcing/i }).getAttribute('title')).toMatch(
      /reinforcing/i
    );
  });

  it('title mentions balancing for balancing polarity', () => {
    const { getByRole } = render(<LoopPolarityBadge labelX={0} labelY={0} polarity="balancing" />);
    expect(getByRole('img', { name: /balancing/i }).getAttribute('title')).toMatch(/balancing/i);
  });

  it('applies emerald class for reinforcing', () => {
    const { getByRole } = render(
      <LoopPolarityBadge labelX={0} labelY={0} polarity="reinforcing" />
    );
    expect(getByRole('img', { name: /reinforcing/i }).className).toContain('emerald');
  });

  it('applies sky class for balancing', () => {
    const { getByRole } = render(<LoopPolarityBadge labelX={0} labelY={0} polarity="balancing" />);
    expect(getByRole('img', { name: /balancing/i }).className).toContain('sky');
  });
});

// ---------------------------------------------------------------------------
// DelayBadge
// ---------------------------------------------------------------------------
describe('DelayBadge', () => {
  it('renders the // glyph', () => {
    const { getByRole } = render(<DelayBadge labelX={0} labelY={0} />);
    const el = getByRole('img', { name: /delayed/i });
    expect(el.textContent).toBe('//');
  });

  it('has a title describing the delayed effect', () => {
    const { getByRole } = render(<DelayBadge labelX={0} labelY={0} />);
    expect(getByRole('img', { name: /delayed/i }).getAttribute('title')).toMatch(/delayed/i);
  });

  it('includes labelY in the transform to position below the edge label', () => {
    const { getByRole } = render(<DelayBadge labelX={10} labelY={50} />);
    const style = getByRole('img', { name: /delayed/i }).getAttribute('style') ?? '';
    // Delay badge sits at labelY + 14, so style should reference the Y anchor
    expect(style).toContain('50');
  });
});

// ---------------------------------------------------------------------------
// LoopNameBadge
// ---------------------------------------------------------------------------
describe('LoopNameBadge', () => {
  it('renders the loop name as text', () => {
    const { getByRole } = render(<LoopNameBadge labelX={0} labelY={0} name="Growth Engine" />);
    const el = getByRole('img', { name: /loop name: growth engine/i });
    expect(el.textContent).toBe('Growth Engine');
  });

  it('title attribute shows Loop: <name>', () => {
    const { getByRole } = render(<LoopNameBadge labelX={0} labelY={0} name="Vicious Cycle" />);
    expect(getByRole('img', { name: /loop name: vicious cycle/i }).getAttribute('title')).toBe(
      'Loop: Vicious Cycle'
    );
  });

  it('renders a long loop name without truncating content (max-w via CSS)', () => {
    const longName = 'A very long loop name that exceeds any reasonable badge width';
    const { getByRole } = render(<LoopNameBadge labelX={0} labelY={0} name={longName} />);
    expect(getByRole('img', { name: new RegExp(longName.slice(0, 20), 'i') }).textContent).toBe(
      longName
    );
  });
});

// ---------------------------------------------------------------------------
// AggregateBadge
// ---------------------------------------------------------------------------
describe('AggregateBadge', () => {
  it('renders ×N where N is the count', () => {
    const { container } = render(<AggregateBadge labelX={0} labelY={0} count={5} />);
    expect(container.textContent).toBe('×5');
  });

  it('renders ×1 correctly', () => {
    const { container } = render(<AggregateBadge labelX={0} labelY={0} count={1} />);
    expect(container.textContent).toBe('×1');
  });

  it('title includes the count', () => {
    const { container } = render(<AggregateBadge labelX={0} labelY={0} count={7} />);
    const el = container.querySelector('[title]') as HTMLElement;
    expect(el.getAttribute('title')).toContain('7');
  });
});

// ---------------------------------------------------------------------------
// AssumptionBadge
// ---------------------------------------------------------------------------
describe('AssumptionBadge', () => {
  it('renders "A" for a single assumption (count === 1)', () => {
    const { getByRole } = render(
      <AssumptionBadge labelX={0} labelY={0} edgeId="e1" count={1} onOpen={() => undefined} />
    );
    expect(getByRole('button').textContent).toBe('A');
  });

  it('renders "A2" for count === 2', () => {
    const { getByRole } = render(
      <AssumptionBadge labelX={0} labelY={0} edgeId="e1" count={2} onOpen={() => undefined} />
    );
    expect(getByRole('button').textContent).toBe('A2');
  });

  it('renders "A10" for count === 10', () => {
    const { getByRole } = render(
      <AssumptionBadge labelX={0} labelY={0} edgeId="e1" count={10} onOpen={() => undefined} />
    );
    expect(getByRole('button').textContent).toBe('A10');
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    const { getByRole } = render(
      <AssumptionBadge labelX={0} labelY={0} edgeId="e1" count={1} onOpen={onOpen} />
    );
    fireEvent.click(getByRole('button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('stops propagation so the click does not reach the pane', () => {
    const onOpen = vi.fn();
    const onParentClick = vi.fn();
    const { getByRole } = render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test pane stand-in
      // biome-ignore lint/a11y/useKeyWithClickEvents: test pane stand-in
      <div onClick={onParentClick}>
        <AssumptionBadge labelX={0} labelY={0} edgeId="e1" count={1} onOpen={onOpen} />
      </div>
    );
    fireEvent.click(getByRole('button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('has data-edge-id attribute matching the edgeId prop', () => {
    const { getByRole } = render(
      <AssumptionBadge labelX={0} labelY={0} edgeId="edge-42" count={1} onOpen={() => undefined} />
    );
    expect(getByRole('button').getAttribute('data-edge-id')).toBe('edge-42');
  });

  it('aria-label uses singular "assumption" for count 1', () => {
    const { getByRole } = render(
      <AssumptionBadge labelX={0} labelY={0} edgeId="e1" count={1} onOpen={() => undefined} />
    );
    expect(getByRole('button').getAttribute('aria-label')).toMatch(/1 assumption[^s]/);
  });

  it('aria-label uses plural "assumptions" for count > 1', () => {
    const { getByRole } = render(
      <AssumptionBadge labelX={0} labelY={0} edgeId="e1" count={3} onOpen={() => undefined} />
    );
    expect(getByRole('button').getAttribute('aria-label')).toMatch(/3 assumptions/);
  });
});

// ---------------------------------------------------------------------------
// CommentBadge
// ---------------------------------------------------------------------------
describe('CommentBadge', () => {
  it('renders the comment count as text', () => {
    const { getByRole } = render(
      <CommentBadge labelX={0} labelY={0} edgeId="e1" count={3} onOpen={() => undefined} />
    );
    expect(getByRole('button').textContent).toContain('3');
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    const { getByRole } = render(
      <CommentBadge labelX={0} labelY={0} edgeId="e1" count={2} onOpen={onOpen} />
    );
    fireEvent.click(getByRole('button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('stops propagation so the click does not reach the pane', () => {
    const onOpen = vi.fn();
    const onParentClick = vi.fn();
    const { getByRole } = render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test pane stand-in
      // biome-ignore lint/a11y/useKeyWithClickEvents: test pane stand-in
      <div onClick={onParentClick}>
        <CommentBadge labelX={0} labelY={0} edgeId="e1" count={2} onOpen={onOpen} />
      </div>
    );
    fireEvent.click(getByRole('button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('has data-edge-id attribute matching the edgeId prop', () => {
    const { getByRole } = render(
      <CommentBadge labelX={0} labelY={0} edgeId="edge-99" count={1} onOpen={() => undefined} />
    );
    expect(getByRole('button').getAttribute('data-edge-id')).toBe('edge-99');
  });

  it('aria-label uses singular "comment" for count 1', () => {
    const { getByRole } = render(
      <CommentBadge labelX={0} labelY={0} edgeId="e1" count={1} onOpen={() => undefined} />
    );
    expect(getByRole('button').getAttribute('aria-label')).toMatch(/1 open comment[^s]/);
  });

  it('aria-label uses plural "comments" for count > 1', () => {
    const { getByRole } = render(
      <CommentBadge labelX={0} labelY={0} edgeId="e1" count={4} onOpen={() => undefined} />
    );
    expect(getByRole('button').getAttribute('aria-label')).toMatch(/4 open comments/);
  });
});

// ---------------------------------------------------------------------------
// DescriptionBadge
// ---------------------------------------------------------------------------
describe('DescriptionBadge', () => {
  it('renders the 📝 emoji', () => {
    const { getByRole } = render(<DescriptionBadge labelX={0} labelY={0} />);
    const el = getByRole('img', { name: /description/i });
    expect(el.textContent).toContain('📝');
  });

  it('title mentions description', () => {
    const { getByRole } = render(<DescriptionBadge labelX={0} labelY={0} />);
    expect(getByRole('img', { name: /description/i }).getAttribute('title')).toMatch(
      /description/i
    );
  });
});

// ---------------------------------------------------------------------------
// EdgeInlineLabel
// ---------------------------------------------------------------------------
describe('EdgeInlineLabel', () => {
  it('renders the truncated label text', () => {
    const { getByText } = render(
      <EdgeInlineLabel labelX={0} labelY={0} fullLabel="Full long label text" truncated="Short…" />
    );
    expect(getByText('Short…')).toBeTruthy();
  });

  it('exposes the full label on the title attribute', () => {
    const { getByText } = render(
      <EdgeInlineLabel labelX={0} labelY={0} fullLabel="Full long label text" truncated="Short…" />
    );
    expect(getByText('Short…').getAttribute('title')).toBe('Full long label text');
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    const { getByText } = render(
      <EdgeInlineLabel
        labelX={0}
        labelY={0}
        fullLabel="Full label"
        truncated="Label"
        onSelect={onSelect}
      />
    );
    fireEvent.click(getByText('Label'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('stops propagation so click never reaches the pane', () => {
    const onSelect = vi.fn();
    const onParentClick = vi.fn();
    const { getByText } = render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test pane stand-in
      // biome-ignore lint/a11y/useKeyWithClickEvents: test pane stand-in
      <div onClick={onParentClick}>
        <EdgeInlineLabel
          labelX={0}
          labelY={0}
          fullLabel="Full label"
          truncated="Label"
          onSelect={onSelect}
        />
      </div>
    );
    fireEvent.click(getByText('Label'));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('is a <div> — not a button — to avoid a spurious tab stop', () => {
    const { getByText } = render(
      <EdgeInlineLabel labelX={0} labelY={0} fullLabel="Full" truncated="Short" />
    );
    expect(getByText('Short').tagName).toBe('DIV');
  });

  it('does not throw when clicked without an onSelect handler', () => {
    const { getByText } = render(
      <EdgeInlineLabel labelX={0} labelY={0} fullLabel="Full" truncated="Short" />
    );
    expect(() => fireEvent.click(getByText('Short'))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// FallbackLabel
// ---------------------------------------------------------------------------
describe('FallbackLabel', () => {
  it('renders the provided text', () => {
    const { container } = render(<FallbackLabel labelX={0} labelY={0} text="because" />);
    expect(container.textContent).toBe('because');
  });

  it('renders a different text value', () => {
    const { container } = render(<FallbackLabel labelX={0} labelY={0} text="therefore" />);
    expect(container.textContent).toBe('therefore');
  });

  it('is aria-hidden (decorative fallback, not conveying unique info)', () => {
    const { container } = render(<FallbackLabel labelX={0} labelY={0} text="because" />);
    const el = container.querySelector('[aria-hidden]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('aria-hidden')).toBe('true');
  });
});
