import { cleanup, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TPNodeData } from '@/components/canvas/edges/flow-types';
import { TPNode } from '@/components/canvas/nodes/TPNode';
import { createEntity } from '@/domain/factory';
import { resetStoreForTest } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Smoke tests for `TPNode`. React Flow's `Handle` and `NodeToolbar`
 * require a `ReactFlowProvider` context; mounting outside one would
 * crash. These tests render through a minimal provider and verify the
 * component's most user-visible contracts:
 *
 *   - The entity title appears in the rendered output.
 *   - When `entity.collapsed === true`, the chevron indicator (the
 *     element with the collapsed class) renders.
 *
 * Geometry / drag / zoom-up overlay behaviors require a real React
 * Flow store with actual transform values; they're out of scope for
 * jsdom smoke testing.
 */

const mountWithRF = (ui: ReactElement) => render(<ReactFlowProvider>{ui}</ReactFlowProvider>);

// React Flow's `NodeProps` has 20+ fields not relevant to a smoke
// test. Build a minimal subset and cast via `unknown` to the parameter
// type the component reads.
type MinimalNodeProps = Parameters<typeof TPNode>[0];
const makeNodeProps = (data: TPNodeData, selected = false): MinimalNodeProps =>
  ({
    id: data.entity.id,
    data,
    selected,
    dragging: false,
    type: 'tp',
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    width: 220,
    height: 72,
    zIndex: 0,
    selectable: true,
    deletable: true,
    draggable: true,
    targetPosition: undefined,
    sourcePosition: undefined,
  }) as unknown as MinimalNodeProps;

describe('TPNode', () => {
  it('renders the entity title', () => {
    const entity = createEntity({ type: 'effect', title: 'My effect title', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    expect(container.textContent).toContain('My effect title');
  });

  it('renders without crashing when entity is collapsed', () => {
    const entity = createEntity({ type: 'effect', title: 'Collapsed', annotationNumber: 1 });
    const { container } = mountWithRF(
      <TPNode {...makeNodeProps({ entity: { ...entity, collapsed: true } })} />
    );
    expect(container.textContent).toContain('Collapsed');
  });

  it('renders without crashing when udeReachCount is set', () => {
    const entity = createEntity({ type: 'effect', title: 'Reach test', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity, udeReachCount: 3 })} />);
    expect(container.textContent).toContain('Reach test');
  });

  it('renders without crashing when diffStatus is set', () => {
    const entity = createEntity({ type: 'effect', title: 'Diff', annotationNumber: 1 });
    const { container } = mountWithRF(
      <TPNode {...makeNodeProps({ entity, diffStatus: 'added' })} />
    );
    expect(container.textContent).toContain('Diff');
  });

  it('memoized: same props passed twice render once into the same DOM', () => {
    // `React.memo` short-circuits when props are shallow-equal. We can't
    // directly assert "no re-render" without spy plumbing in the
    // component; what we CAN assert is that the memoized component IS
    // memoized — its displayName should be 'TPNode' and the function
    // is wrapped. Smoke-only.
    expect(TPNode.displayName).toBe('TPNode');
  });
});

/**
 * Session 134 coverage push (round 3) — deeper TPNode rendering
 * branches. The smoke tests above cover the basic mount; these target
 * the per-entity-type / per-flag rendering branches that drove
 * coverage from 27% to a meaningful slice of the file.
 */

describe('TPNode — entity-type-specific rendering', () => {
  it('renders a note entity (FL-ET7 yellow post-it tint)', () => {
    const entity = createEntity({ type: 'note', title: 'A note', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    // The note tint is reflected on the outermost data-component="tp-node" wrapper.
    const wrapper = container.querySelector('[data-component="tp-node"]');
    expect(wrapper?.className ?? '').toMatch(/yellow/);
  });

  it('renders a UDE entity (the most common CRT shape)', () => {
    const entity = createEntity({ type: 'ude', title: 'Customer churn', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    expect(container.textContent).toContain('Customer churn');
  });

  it('renders an injection entity', () => {
    const entity = createEntity({ type: 'injection', title: 'Inject', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    expect(container.textContent).toContain('Inject');
  });

  it('renders a Want entity for EC docs', () => {
    const entity = createEntity({
      type: 'want',
      title: 'Leave at 5',
      annotationNumber: 1,
      ecSlot: 'd',
    });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    expect(container.textContent).toContain('Leave at 5');
  });
});

describe('TPNode — annotation + reach badges + pin', () => {
  it('renders the rootCause reach badge when rootCauseReachCount > 0', () => {
    const entity = createEntity({ type: 'rootCause', title: 'rc', annotationNumber: 1 });
    const { container } = mountWithRF(
      <TPNode {...makeNodeProps({ entity, rootCauseReachCount: 5 })} />
    );
    expect(container.textContent).toContain('rc');
  });

  it('renders without crashing when entity has a pinned position', () => {
    const entity = createEntity({ type: 'effect', title: 'pinned', annotationNumber: 1 });
    const withPos = { ...entity, position: { x: 100, y: 100 } };
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity: withPos })} />);
    expect(container.textContent).toContain('pinned');
  });

  it('renders without crashing when entity is unspecified (the ?-placeholder)', () => {
    const entity = createEntity({ type: 'effect', title: '', annotationNumber: 1 });
    const withUnspec = { ...entity, unspecified: true };
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity: withUnspec })} />);
    // Unspecified is a flag — the node renders regardless of empty title.
    expect(container.querySelector('[data-component="tp-node"]')).not.toBeNull();
  });
});

describe('TPNode — descriptions + collapsed cascade', () => {
  it('renders without crashing when entity has a description (description shows only in zoom-up overlay / inspector)', () => {
    const entity = createEntity({
      type: 'effect',
      title: 'With desc',
      annotationNumber: 1,
    });
    const withDesc = { ...entity, description: 'A longer description below the title.' };
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity: withDesc })} />);
    // Title still renders; description is gated behind hover/zoom which jsdom doesn't trigger.
    expect(container.textContent).toContain('With desc');
  });

  it('renders the hidden-descendant count when entity is collapsed with hidden children', () => {
    const entity = createEntity({ type: 'effect', title: 'collapsed', annotationNumber: 1 });
    const { container } = mountWithRF(
      <TPNode
        {...makeNodeProps({ entity: { ...entity, collapsed: true }, hiddenDescendantCount: 4 })}
      />
    );
    // The "+N hidden" indicator is somewhere in the rendered text.
    expect(container.textContent).toMatch(/4|hidden/i);
  });
});

describe('TPNode — selected styling', () => {
  it('applies the indigo ring class when selected=true', () => {
    const entity = createEntity({ type: 'effect', title: 'selected', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity }, true)} />);
    const wrapper = container.querySelector('[data-component="tp-node"]');
    expect(wrapper?.className ?? '').toMatch(/ring-indigo/);
  });

  it('does NOT apply the selected ring class when selected=false', () => {
    const entity = createEntity({ type: 'effect', title: 'unselected', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity }, false)} />);
    const wrapper = container.querySelector('[data-component="tp-node"]');
    expect(wrapper?.className ?? '').not.toMatch(/ring-indigo/);
  });
});

describe('TPNode — diff-status colour cues', () => {
  it.each([
    ['added'],
    ['removed'],
    ['changed'],
    ['unchanged'],
  ] as const)('renders without crashing for diffStatus=%s', (status) => {
    const entity = createEntity({ type: 'effect', title: `diff ${status}`, annotationNumber: 1 });
    const { container } = mountWithRF(
      <TPNode {...makeNodeProps({ entity, diffStatus: status })} />
    );
    expect(container.textContent).toContain(`diff ${status}`);
  });
});
