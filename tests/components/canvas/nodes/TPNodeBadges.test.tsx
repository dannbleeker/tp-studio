/**
 * Unit tests for `TPNodeBadges.tsx` — the on-node badge cluster.
 *
 * Each exported badge component is tested in isolation via RTL `render`.
 * No store access, no React Flow context: every badge is a pure-render
 * function that takes props and returns JSX or null.
 *
 * Covered branches:
 *   - AnnotationBadge: always renders with the given number
 *   - StepBadge: always renders with the given ordering
 *   - LocusPill: control → "C", influence → "I", external → "E", undefined → null
 *   - PinBadge: manual-layout diagrams (ec) → null; auto-layout diagrams → renders
 *   - ReachForwardBadge: count=1 (singular), count=N (plural) text + aria-label
 *   - ReachReverseBadge: count=1 (singular), count=N (plural) text + aria-label
 *   - StateBadge: 'unknown' → null; 'true' → T; 'false' → F; 'disputed' → ?
 *   - StateBadge: speculated=false vs speculated=true (dashed ring class + label)
 *   - EligibilityBadge: eligible ✓, blocked ✗, pending … glyphs + aria-labels
 *   - CommentCountBadge: renders count, calls onOpen on click, stops propagation
 *   - CollapsedExpandButton: renders ▸, shows +N chip when count>0, hides when 0
 *   - CollapsedExpandButton: calls onToggle with entity id; no call when browse-locked
 */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnnotationBadge,
  CollapsedExpandButton,
  CommentCountBadge,
  EligibilityBadge,
  LocusPill,
  PinBadge,
  ReachForwardBadge,
  ReachReverseBadge,
  StateBadge,
  StepBadge,
} from '@/components/canvas/nodes/TPNodeBadges';
import type { EligibilityStatus } from '@/domain/actionEligibility';
import { createEntity } from '@/domain/factory';
import type { DiagramType, EntityState } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';

// guardWriteOrToast reads the store directly — mock so the
// CollapsedExpandButton browse-lock branch can be driven without
// touching global state side-effects (toast rendering etc.)
vi.mock('@/services/browseLock', () => ({
  guardWriteOrToast: vi.fn(() => true),
}));

import { guardWriteOrToast } from '@/services/browseLock';

const mockGuard = vi.mocked(guardWriteOrToast);

beforeEach(resetStoreForTest);
afterEach(cleanup);

// ---------------------------------------------------------------------------
// AnnotationBadge
// ---------------------------------------------------------------------------

describe('AnnotationBadge', () => {
  it('renders the annotation number with a # prefix', () => {
    const { container } = render(<AnnotationBadge annotationNumber={42} />);
    expect(container.textContent).toContain('#42');
  });

  it('has an aria-label containing the number', () => {
    const { container } = render(<AnnotationBadge annotationNumber={7} />);
    const badge = container.querySelector('[aria-label]');
    expect(badge?.getAttribute('aria-label')).toContain('7');
  });

  it('renders number 1 without crashing', () => {
    const { container } = render(<AnnotationBadge annotationNumber={1} />);
    expect(container.textContent).toContain('#1');
  });
});

// ---------------------------------------------------------------------------
// StepBadge
// ---------------------------------------------------------------------------

describe('StepBadge', () => {
  it('renders "Step N" text', () => {
    const { container } = render(<StepBadge ordering={3} />);
    expect(container.textContent).toContain('Step 3');
  });

  it('has an aria-label containing the step number', () => {
    const { container } = render(<StepBadge ordering={5} />);
    const badge = container.querySelector('[aria-label]');
    expect(badge?.getAttribute('aria-label')).toContain('5');
  });

  it('renders step 1 correctly', () => {
    const { container } = render(<StepBadge ordering={1} />);
    expect(container.textContent).toContain('Step 1');
  });
});

// ---------------------------------------------------------------------------
// LocusPill
// ---------------------------------------------------------------------------

describe('LocusPill', () => {
  it('renders "C" for control locus with correct aria-label', () => {
    const { container } = render(<LocusPill spanOfControl="control" />);
    const pill = container.querySelector('[aria-label="Locus: control"]');
    expect(pill).not.toBeNull();
    expect(pill?.textContent?.trim()).toBe('C');
  });

  it('renders "I" for influence locus with correct aria-label', () => {
    const { container } = render(<LocusPill spanOfControl="influence" />);
    const pill = container.querySelector('[aria-label="Locus: influence"]');
    expect(pill).not.toBeNull();
    expect(pill?.textContent?.trim()).toBe('I');
  });

  it('renders "E" for external locus with correct aria-label', () => {
    const { container } = render(<LocusPill spanOfControl="external" />);
    const pill = container.querySelector('[aria-label="Locus: external"]');
    expect(pill).not.toBeNull();
    expect(pill?.textContent?.trim()).toBe('E');
  });

  it('renders nothing when spanOfControl is undefined', () => {
    const { container } = render(<LocusPill spanOfControl={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('control pill uses emerald colour class', () => {
    const { container } = render(<LocusPill spanOfControl="control" />);
    const pill = container.querySelector('[aria-label="Locus: control"]');
    expect(pill?.className).toMatch(/emerald/);
  });

  it('influence pill uses amber colour class', () => {
    const { container } = render(<LocusPill spanOfControl="influence" />);
    const pill = container.querySelector('[aria-label="Locus: influence"]');
    expect(pill?.className).toMatch(/amber/);
  });

  it('external pill uses neutral colour class', () => {
    const { container } = render(<LocusPill spanOfControl="external" />);
    const pill = container.querySelector('[aria-label="Locus: external"]');
    expect(pill?.className).toMatch(/neutral/);
  });
});

// ---------------------------------------------------------------------------
// PinBadge
// ---------------------------------------------------------------------------

describe('PinBadge', () => {
  it('renders the pin icon for an auto-layout diagram type (crt)', () => {
    const { container } = render(<PinBadge diagramType={'crt' as DiagramType} />);
    const badge = container.querySelector('[aria-label="Pinned position"]');
    expect(badge).not.toBeNull();
  });

  it('renders for frt diagram type (auto-layout)', () => {
    const { container } = render(<PinBadge diagramType={'frt' as DiagramType} />);
    expect(container.querySelector('[aria-label="Pinned position"]')).not.toBeNull();
  });

  it('renders for tt diagram type (auto-layout)', () => {
    const { container } = render(<PinBadge diagramType={'tt' as DiagramType} />);
    expect(container.querySelector('[aria-label="Pinned position"]')).not.toBeNull();
  });

  it('renders nothing for ec diagram type (manual-layout)', () => {
    const { container } = render(<PinBadge diagramType={'ec' as DiagramType} />);
    expect(container.firstChild).toBeNull();
  });

  it('sits at the corner by default (bottom-1.5, no lift)', () => {
    const { container } = render(<PinBadge diagramType={'crt' as DiagramType} />);
    const badge = container.querySelector('[aria-label="Pinned position"]');
    expect(badge?.className).toMatch(/-bottom-1\.5/);
    expect(badge?.className).not.toMatch(/(?<!-)bottom-5/);
  });

  it('lifts above the reverse-reach pill when stacked', () => {
    const { container } = render(<PinBadge diagramType={'crt' as DiagramType} stacked />);
    const badge = container.querySelector('[aria-label="Pinned position"]');
    // Session 193 — de-collision: lifted to bottom-5, no longer the corner offset.
    expect(badge?.className).toMatch(/bottom-5/);
    expect(badge?.className).not.toMatch(/-bottom-1\.5/);
  });
});

// ---------------------------------------------------------------------------
// ReachForwardBadge
// ---------------------------------------------------------------------------

describe('ReachForwardBadge', () => {
  it('renders "→1 UDE" in singular form when count is 1', () => {
    const { container } = render(<ReachForwardBadge count={1} />);
    expect(container.textContent).toContain('→1 UDE');
    expect(container.textContent).not.toContain('UDEs');
  });

  it('renders "→N UDEs" in plural form when count > 1', () => {
    const { container } = render(<ReachForwardBadge count={5} />);
    expect(container.textContent).toContain('→5 UDEs');
  });

  it('has singular aria-label for count=1', () => {
    const { container } = render(<ReachForwardBadge count={1} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toBe('Reaches 1 undesirable effect');
  });

  it('has plural aria-label for count=3', () => {
    const { container } = render(<ReachForwardBadge count={3} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toBe('Reaches 3 undesirable effects');
  });

  it('uses amber colour class', () => {
    const { container } = render(<ReachForwardBadge count={2} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.className).toMatch(/amber/);
  });
});

// ---------------------------------------------------------------------------
// ReachReverseBadge
// ---------------------------------------------------------------------------

describe('ReachReverseBadge', () => {
  it('renders "←1 root" in singular form when count is 1', () => {
    const { container } = render(<ReachReverseBadge count={1} />);
    expect(container.textContent).toContain('←1 root');
    expect(container.textContent).not.toContain('roots');
  });

  it('renders "←N roots" in plural form when count > 1', () => {
    const { container } = render(<ReachReverseBadge count={4} />);
    expect(container.textContent).toContain('←4 roots');
  });

  it('has singular aria-label for count=1', () => {
    const { container } = render(<ReachReverseBadge count={1} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toBe('Fed by 1 root cause');
  });

  it('has plural aria-label for count=2', () => {
    const { container } = render(<ReachReverseBadge count={2} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toBe('Fed by 2 root causes');
  });

  it('uses sky colour class', () => {
    const { container } = render(<ReachReverseBadge count={2} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.className).toMatch(/sky/);
  });
});

// ---------------------------------------------------------------------------
// StateBadge
// ---------------------------------------------------------------------------

describe('StateBadge', () => {
  it('renders nothing when state is "unknown"', () => {
    const { container } = render(<StateBadge state={'unknown' as EntityState} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "T" glyph for state "true"', () => {
    const { container } = render(<StateBadge state={'true' as EntityState} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe('T');
  });

  it('renders "F" glyph for state "false"', () => {
    const { container } = render(<StateBadge state={'false' as EntityState} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.textContent?.trim()).toBe('F');
  });

  it('renders "?" glyph for state "disputed"', () => {
    const { container } = render(<StateBadge state={'disputed' as EntityState} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.textContent?.trim()).toBe('?');
  });

  it('"true" badge has aria-label "State: true"', () => {
    const { container } = render(<StateBadge state={'true' as EntityState} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toBe('State: true');
  });

  it('"false" badge has aria-label "State: false"', () => {
    const { container } = render(<StateBadge state={'false' as EntityState} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toBe('State: false');
  });

  it('"disputed" badge has aria-label "State: disputed"', () => {
    const { container } = render(<StateBadge state={'disputed' as EntityState} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toBe('State: disputed');
  });

  it('"true" badge uses emerald colour class', () => {
    const { container } = render(<StateBadge state={'true' as EntityState} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.className).toMatch(/emerald/);
  });

  it('"false" badge uses red colour class', () => {
    const { container } = render(<StateBadge state={'false' as EntityState} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.className).toMatch(/red/);
  });

  it('"disputed" badge uses amber colour class', () => {
    const { container } = render(<StateBadge state={'disputed' as EntityState} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.className).toMatch(/amber/);
  });

  it('non-speculated badge has no dashed ring class', () => {
    const { container } = render(<StateBadge state={'true' as EntityState} speculated={false} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.className).not.toMatch(/border-dashed/);
  });

  it('speculated=true adds dashed ring + "(speculative)" suffix to aria-label', () => {
    const { container } = render(<StateBadge state={'true' as EntityState} speculated={true} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.className).toMatch(/border-dashed/);
    expect(badge?.getAttribute('aria-label')).toContain('speculative');
  });

  it('speculated=true on false state has correct speculative aria-label', () => {
    const { container } = render(<StateBadge state={'false' as EntityState} speculated={true} />);
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toBe('State: false (speculative)');
  });

  it('speculated=true on disputed state has correct speculative aria-label', () => {
    const { container } = render(
      <StateBadge state={'disputed' as EntityState} speculated={true} />
    );
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toBe('State: disputed (speculative)');
  });
});

// ---------------------------------------------------------------------------
// EligibilityBadge
// ---------------------------------------------------------------------------

describe('EligibilityBadge', () => {
  it('renders ✓ glyph for "eligible" status', () => {
    const { container } = render(
      <EligibilityBadge status={'eligible' as Exclude<EligibilityStatus, 'na'>} />
    );
    const badge = container.querySelector('[role="img"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe('✓');
  });

  it('renders ✗ glyph for "blocked" status', () => {
    const { container } = render(
      <EligibilityBadge status={'blocked' as Exclude<EligibilityStatus, 'na'>} />
    );
    const badge = container.querySelector('[role="img"]');
    expect(badge?.textContent?.trim()).toBe('✗');
  });

  it('renders … glyph for "pending" status', () => {
    const { container } = render(
      <EligibilityBadge status={'pending' as Exclude<EligibilityStatus, 'na'>} />
    );
    const badge = container.querySelector('[role="img"]');
    expect(badge?.textContent?.trim()).toBe('…');
  });

  it('"eligible" badge has correct aria-label', () => {
    const { container } = render(
      <EligibilityBadge status={'eligible' as Exclude<EligibilityStatus, 'na'>} />
    );
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toContain('eligible');
  });

  it('"blocked" badge has correct aria-label', () => {
    const { container } = render(
      <EligibilityBadge status={'blocked' as Exclude<EligibilityStatus, 'na'>} />
    );
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toContain('blocked');
  });

  it('"pending" badge has correct aria-label', () => {
    const { container } = render(
      <EligibilityBadge status={'pending' as Exclude<EligibilityStatus, 'na'>} />
    );
    const badge = container.querySelector('[role="img"]');
    expect(badge?.getAttribute('aria-label')).toContain('pending');
  });

  it('"eligible" badge uses emerald colour class', () => {
    const { container } = render(
      <EligibilityBadge status={'eligible' as Exclude<EligibilityStatus, 'na'>} />
    );
    const badge = container.querySelector('[role="img"]');
    expect(badge?.className).toMatch(/emerald/);
  });

  it('"blocked" badge uses red colour class', () => {
    const { container } = render(
      <EligibilityBadge status={'blocked' as Exclude<EligibilityStatus, 'na'>} />
    );
    const badge = container.querySelector('[role="img"]');
    expect(badge?.className).toMatch(/red/);
  });

  it('"pending" badge uses amber colour class', () => {
    const { container } = render(
      <EligibilityBadge status={'pending' as Exclude<EligibilityStatus, 'na'>} />
    );
    const badge = container.querySelector('[role="img"]');
    expect(badge?.className).toMatch(/amber/);
  });
});

// ---------------------------------------------------------------------------
// CommentCountBadge
// ---------------------------------------------------------------------------

describe('CommentCountBadge', () => {
  it('renders the comment count', () => {
    const onOpen = vi.fn();
    const { container } = render(<CommentCountBadge count={3} onOpen={onOpen} />);
    expect(container.textContent).toContain('3');
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    const { container } = render(<CommentCountBadge count={1} onOpen={onOpen} />);
    const button = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('stops propagation on click (does not bubble to parent)', () => {
    const onOpen = vi.fn();
    const parentClick = vi.fn();
    const { container } = render(
      // biome-ignore lint/a11y/noStaticElementInteractions: event-sink test harness that catches bubbling to assert the badge stops propagation; not interactive UI.
      <div onClick={parentClick} onKeyDown={parentClick}>
        <CommentCountBadge count={2} onOpen={onOpen} />
      </div>
    );
    const button = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('has singular aria-label for count=1', () => {
    const { container } = render(<CommentCountBadge count={1} onOpen={vi.fn()} />);
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toContain('1 open comment');
    expect(button?.getAttribute('aria-label')).not.toContain('comments');
  });

  it('has plural aria-label for count > 1', () => {
    const { container } = render(<CommentCountBadge count={5} onOpen={vi.fn()} />);
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toContain('5 open comments');
  });

  it('renders a button element', () => {
    const { container } = render(<CommentCountBadge count={2} onOpen={vi.fn()} />);
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('sits at the corner by default (top-1.5, no drop)', () => {
    const { container } = render(<CommentCountBadge count={2} onOpen={vi.fn()} />);
    const button = container.querySelector('button');
    expect(button?.className).toMatch(/-top-1\.5/);
    expect(button?.className).not.toMatch(/(?<!-)top-5/);
  });

  it('drops below the Step badge when stacked', () => {
    const { container } = render(<CommentCountBadge count={2} onOpen={vi.fn()} stacked />);
    const button = container.querySelector('button');
    // Session 193 — de-collision: dropped to top-5, no longer the corner offset.
    expect(button?.className).toMatch(/top-5/);
    expect(button?.className).not.toMatch(/-top-1\.5/);
  });
});

// ---------------------------------------------------------------------------
// CollapsedExpandButton
// ---------------------------------------------------------------------------

describe('CollapsedExpandButton', () => {
  const entity = createEntity({ type: 'effect', title: 'collapsed', annotationNumber: 1 });

  it('renders the expand arrow ▸', () => {
    const { container } = render(
      <CollapsedExpandButton entity={entity} hiddenDescendantCount={undefined} onToggle={vi.fn()} />
    );
    expect(container.textContent).toContain('▸');
  });

  it('shows +N chip when hiddenDescendantCount > 0', () => {
    const { container } = render(
      <CollapsedExpandButton entity={entity} hiddenDescendantCount={6} onToggle={vi.fn()} />
    );
    expect(container.textContent).toContain('+6');
  });

  it('does NOT show a +N chip when hiddenDescendantCount is 0', () => {
    const { container } = render(
      <CollapsedExpandButton entity={entity} hiddenDescendantCount={0} onToggle={vi.fn()} />
    );
    expect(container.textContent).not.toMatch(/\+\s*0\b/);
  });

  it('does NOT show a +N chip when hiddenDescendantCount is undefined', () => {
    const { container } = render(
      <CollapsedExpandButton entity={entity} hiddenDescendantCount={undefined} onToggle={vi.fn()} />
    );
    // No "+undefined" or similar noise
    expect(container.textContent).not.toMatch(/\+/);
  });

  it('has correct aria-label with count when hiddenDescendantCount > 1', () => {
    const { container } = render(
      <CollapsedExpandButton entity={entity} hiddenDescendantCount={3} onToggle={vi.fn()} />
    );
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toContain('3');
    expect(button?.getAttribute('aria-label')).toContain('hidden');
  });

  it('has correct singular aria-label when hiddenDescendantCount is 1', () => {
    const { container } = render(
      <CollapsedExpandButton entity={entity} hiddenDescendantCount={1} onToggle={vi.fn()} />
    );
    const button = container.querySelector('button');
    // singular: "1 hidden descendant" (not "descendants")
    const label = button?.getAttribute('aria-label') ?? '';
    expect(label).toContain('1 hidden descendant');
    expect(label).not.toContain('descendants');
  });

  it('calls onToggle with entity.id when guard returns true', () => {
    mockGuard.mockReturnValue(true);
    const onToggle = vi.fn();
    const { container } = render(
      <CollapsedExpandButton entity={entity} hiddenDescendantCount={2} onToggle={onToggle} />
    );
    const button = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith(entity.id);
  });

  it('does NOT call onToggle when guardWriteOrToast returns false (browse-locked)', () => {
    mockGuard.mockReturnValue(false);
    const onToggle = vi.fn();
    const { container } = render(
      <CollapsedExpandButton entity={entity} hiddenDescendantCount={2} onToggle={onToggle} />
    );
    const button = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('stops propagation on click (does not bubble to parent)', () => {
    mockGuard.mockReturnValue(true);
    const onToggle = vi.fn();
    const parentClick = vi.fn();
    const { container } = render(
      // biome-ignore lint/a11y/noStaticElementInteractions: event-sink test harness that catches bubbling to assert the badge stops propagation; not interactive UI.
      <div onClick={parentClick} onKeyDown={parentClick}>
        <CollapsedExpandButton entity={entity} hiddenDescendantCount={2} onToggle={onToggle} />
      </div>
    );
    const button = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(button);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('has fallback aria-label "Expand downstream" when hiddenDescendantCount is undefined', () => {
    const { container } = render(
      <CollapsedExpandButton entity={entity} hiddenDescendantCount={undefined} onToggle={vi.fn()} />
    );
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toContain('Expand downstream');
  });

  it('store reset does not break badge (store is irrelevant — pure render)', () => {
    // Confirm resetStoreForTest doesn't interfere with the pure-render badges.
    useDocumentStore.setState({ browseLocked: true });
    resetStoreForTest();
    mockGuard.mockReturnValue(true);
    const onToggle = vi.fn();
    const { container } = render(
      <CollapsedExpandButton entity={entity} hiddenDescendantCount={1} onToggle={onToggle} />
    );
    fireEvent.click(container.querySelector('button') as HTMLButtonElement);
    expect(onToggle).toHaveBeenCalledWith(entity.id);
  });
});
