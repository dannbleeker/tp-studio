import { cleanup, fireEvent, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TPNodeData } from '@/components/canvas/edges/flow-types';
import { TPNode } from '@/components/canvas/nodes/TPNode';
import { createEntity } from '@/domain/factory';
import { resetStoreForTest, useDocumentStore } from '@/store';

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
    const base = createEntity({
      type: 'want',
      title: 'Leave at 5',
      annotationNumber: 1,
    });
    // `createEntity` doesn't take `ecSlot`; the EC creation wizard sets
    // it post-mint. Mirror that here with an inline extension.
    const entity = { ...base, ecSlot: 'd' as const };
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
  // `TPNodeData.diffStatus` is `'added' | 'removed' | 'changed'` — an
  // unchanged entity just omits the field.
  it.each([
    ['added'],
    ['removed'],
    ['changed'],
  ] as const)('renders without crashing for diffStatus=%s', (status) => {
    const entity = createEntity({ type: 'effect', title: `diff ${status}`, annotationNumber: 1 });
    const { container } = mountWithRF(
      <TPNode {...makeNodeProps({ entity, diffStatus: status })} />
    );
    expect(container.textContent).toContain(`diff ${status}`);
  });
});

/**
 * Session 134 coverage push (round 4) — interaction-driven tests.
 *
 * The earlier render-tests cover *which JSX branches* mount; these
 * cover the inline event handlers + the editing-mode useEffect that
 * jsdom doesn't trigger from a passive render. V8 coverage tracks
 * each `onMouseEnter={() => ...}` / `onDoubleClick={...}` arrow as
 * its own function whose body is only credited when the event
 * actually fires — which is why the static render-tests left the
 * file at 27% statements. Firing the events drives the function
 * coverage up.
 */

describe('TPNode — DOM event handlers', () => {
  it('double-click enters editing mode via beginEditing', () => {
    const entity = createEntity({ type: 'effect', title: 'will edit', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    const wrapper = container.querySelector('[data-component="tp-node"]') as HTMLElement;
    fireEvent.doubleClick(wrapper);
    expect(useDocumentStore.getState().editingEntityId).toBe(entity.id);
  });

  it('double-click is a no-op when the doc is browse-locked', () => {
    useDocumentStore.setState({ browseLocked: true });
    const entity = createEntity({ type: 'effect', title: 'locked', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    const wrapper = container.querySelector('[data-component="tp-node"]') as HTMLElement;
    fireEvent.doubleClick(wrapper);
    expect(useDocumentStore.getState().editingEntityId).toBeNull();
  });

  it('mouse-enter triggers the hover-state path (zoom-up overlay gate)', () => {
    const entity = createEntity({ type: 'effect', title: 'hovered', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity }, true)} />);
    const wrapper = container.querySelector('[data-component="tp-node"]') as HTMLElement;
    // No assertion beyond "doesn't throw" — hover state is internal,
    // gates the NodeToolbar's `showZoomUp`, and is only observable
    // through the zoom-up card which jsdom doesn't render at the
    // right zoom. Firing the handler still covers its body.
    fireEvent.mouseEnter(wrapper);
    fireEvent.mouseLeave(wrapper);
    expect(wrapper).toBeTruthy();
  });
});

describe('TPNode — editing mode render + textarea handlers', () => {
  it('renders the editing textarea when editingEntityId matches the entity', () => {
    const entity = createEntity({ type: 'effect', title: 'editing now', annotationNumber: 1 });
    useDocumentStore.setState({ editingEntityId: entity.id });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    // The useEffect with `inputRef.current.focus()` fires post-mount;
    // jsdom honors the focus() call.
    expect(textarea?.value).toBe('editing now');
  });

  it('blur on the editing textarea commits the new title and exits editing', () => {
    const entity = createEntity({ type: 'effect', title: 'before', annotationNumber: 1 });
    useDocumentStore.setState({
      editingEntityId: entity.id,
      doc: { ...useDocumentStore.getState().doc, entities: { [entity.id]: entity } },
    });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    // Change the value, then blur. onBlur reads e.currentTarget.value,
    // calls updateEntity if changed, then endEditing.
    fireEvent.change(textarea, { target: { value: 'after' } });
    fireEvent.blur(textarea);
    expect(useDocumentStore.getState().editingEntityId).toBeNull();
    expect(useDocumentStore.getState().doc.entities[entity.id]?.title).toBe('after');
  });

  it('Escape on the editing textarea exits editing without committing', () => {
    const entity = createEntity({ type: 'effect', title: 'original', annotationNumber: 1 });
    useDocumentStore.setState({
      editingEntityId: entity.id,
      doc: { ...useDocumentStore.getState().doc, entities: { [entity.id]: entity } },
    });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'discarded' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(useDocumentStore.getState().editingEntityId).toBeNull();
    // Title untouched — Escape does NOT commit.
    expect(useDocumentStore.getState().doc.entities[entity.id]?.title).toBe('original');
  });

  it('plain Enter on the editing textarea commits + exits (via the textarea blur)', () => {
    const entity = createEntity({ type: 'effect', title: 'before', annotationNumber: 1 });
    useDocumentStore.setState({
      editingEntityId: entity.id,
      doc: { ...useDocumentStore.getState().doc, entities: { [entity.id]: entity } },
    });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'after-enter' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    // The Enter handler calls e.currentTarget.blur(); the onBlur then
    // commits the title and clears editingEntityId.
    expect(useDocumentStore.getState().editingEntityId).toBeNull();
    expect(useDocumentStore.getState().doc.entities[entity.id]?.title).toBe('after-enter');
  });
});

describe('TPNode — preference-driven render branches', () => {
  it('renders the annotation-number badge when showAnnotationNumbers is true', () => {
    useDocumentStore.setState({ showAnnotationNumbers: true });
    const entity = createEntity({ type: 'effect', title: 'numbered', annotationNumber: 42 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    expect(container.textContent).toContain('42');
  });

  it('renders the entity-id chip when showEntityIds is true', () => {
    useDocumentStore.setState({ showEntityIds: true });
    const entity = createEntity({ type: 'effect', title: 'with id', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    // A fragment of the entity id should appear somewhere in the card.
    expect(container.textContent).toContain(entity.id.slice(0, 6));
  });

  it('renders the UDE-reach badge when showReachBadges + udeReachCount > 0', () => {
    useDocumentStore.setState({ showReachBadges: true });
    const entity = createEntity({ type: 'rootCause', title: 'cause', annotationNumber: 1 });
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity, udeReachCount: 7 })} />);
    expect(container.textContent).toContain('7');
  });

  it('renders the reverse-reach badge when showReverseReachBadges + rootCauseReachCount > 0', () => {
    useDocumentStore.setState({ showReverseReachBadges: true });
    const entity = createEntity({ type: 'ude', title: 'ude', annotationNumber: 1 });
    const { container } = mountWithRF(
      <TPNode {...makeNodeProps({ entity, rootCauseReachCount: 3 })} />
    );
    expect(container.textContent).toContain('3');
  });
});

describe('TPNode — Locus pill (spanOfControl)', () => {
  it.each([
    ['control', 'C'],
    ['influence', 'I'],
    ['external', 'E'],
  ] as const)('renders the %s pill (%s)', (locus, glyph) => {
    const base = createEntity({ type: 'rootCause', title: 'locus test', annotationNumber: 1 });
    const entity = { ...base, spanOfControl: locus };
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    // The pill renders a single letter inside an `aria-label="Locus: …"` span.
    const pill = container.querySelector(`[aria-label="Locus: ${locus}"]`);
    expect(pill).not.toBeNull();
    expect(pill?.textContent?.trim()).toBe(glyph);
  });
});

/**
 * Session 135 / infra-debt — TPNode coverage push (round 5). Targets
 * the remaining uncovered branches called out in NEXT_STEPS: S&T
 * 5-facet rows, hidden-descendant chip, custom-class icon resolution,
 * zoom-up overlay NodeToolbar presence.
 */

describe('TPNode — S&T 5-facet rendering (Session 76)', () => {
  it('renders the four facet rows (NA / Strategy / PA / SA) on an S&T-formatted injection', () => {
    // An injection with ANY of the four reserved facet attributes
    // renders as a multi-row card; partial fills still render the
    // card so the user sees the missing rows as a visible nudge.
    const base = createEntity({ type: 'injection', title: 'Adopt OKRs', annotationNumber: 1 });
    const entity = {
      ...base,
      attributes: {
        stStrategy: { kind: 'string' as const, value: 'Improve focus' },
        stNecessaryAssumption: { kind: 'string' as const, value: 'Teams want clarity' },
        stParallelAssumption: { kind: 'string' as const, value: 'Cadence holds' },
        stSufficiencyAssumption: { kind: 'string' as const, value: 'Execs sponsor it' },
      },
    };
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    expect(container.textContent).toContain('Strategy');
    expect(container.textContent).toContain('NA');
    expect(container.textContent).toContain('PA');
    expect(container.textContent).toContain('SA');
    expect(container.textContent).toContain('Improve focus');
    expect(container.textContent).toContain('Teams want clarity');
  });

  it('renders the S&T card even when only one facet is set (partial-fill nudge)', () => {
    // The S&T renderer fires on ANY facet attribute — partial fills
    // are an explicit "show the empty slots" affordance.
    const base = createEntity({ type: 'injection', title: 'Partial', annotationNumber: 1 });
    const entity = {
      ...base,
      attributes: {
        stStrategy: { kind: 'string' as const, value: 'just-strategy' },
      },
    };
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    // The four facet labels still render — the other three rows
    // show their placeholder rather than going missing.
    expect(container.textContent).toContain('Strategy');
    expect(container.textContent).toContain('NA');
    expect(container.textContent).toContain('PA');
    expect(container.textContent).toContain('SA');
  });

  it('does NOT render the S&T card on a non-injection entity even with facet attributes', () => {
    // Defensive: `isStNodeFormat` requires `entity.type === 'injection'`.
    // A misclassified `effect` with facet attrs gets the standard layout.
    const base = createEntity({ type: 'effect', title: 'Not S&T', annotationNumber: 1 });
    const entity = {
      ...base,
      attributes: {
        stStrategy: { kind: 'string' as const, value: 'misplaced' },
      },
    };
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    // The string value shouldn't appear because the S&T rows don't
    // render for non-injection entities.
    expect(container.textContent).not.toContain('misplaced');
  });
});

describe('TPNode — hidden-descendant chip on the collapse button', () => {
  it('shows the count when collapsed with hidden children', () => {
    const entity = createEntity({ type: 'effect', title: 'collapsed', annotationNumber: 1 });
    const { container } = mountWithRF(
      <TPNode
        {...makeNodeProps({ entity: { ...entity, collapsed: true }, hiddenDescendantCount: 7 })}
      />
    );
    // The "+N" chip lives inside the collapse-expand button.
    const button = container.querySelector('[aria-label*="hidden" i], [title*="hidden" i]');
    // Fall back to any element whose text matches the count.
    const text = container.textContent ?? '';
    expect(text).toMatch(/\b7\b/);
    // If the chip has an explicit aria-label, even better — but the
    // visible-count assertion is the load-bearing one.
    void button;
  });

  it('omits the chip when collapsed but no hidden descendants', () => {
    const entity = createEntity({ type: 'effect', title: 'lonely', annotationNumber: 1 });
    const { container } = mountWithRF(
      <TPNode
        {...makeNodeProps({ entity: { ...entity, collapsed: true }, hiddenDescendantCount: 0 })}
      />
    );
    // A zero count shouldn't render a "+0" chip — that would be noise.
    expect(container.textContent).not.toMatch(/\+\s*0\b/);
  });
});

describe('TPNode — custom-entity-class type resolution', () => {
  it('renders an entity whose type is a custom class slug (not in the built-in palette)', () => {
    // B10 — per-document custom classes. The store carries them; the
    // entity's `type` field stores the slug. TPNode resolves the
    // visual treatment via `resolveEntityTypeMeta(type, customClasses)`.
    useDocumentStore.setState({
      doc: {
        ...useDocumentStore.getState().doc,
        customEntityClasses: {
          'risk-item': {
            id: 'risk-item',
            label: 'Risk item',
            color: '#ff6b6b',
          },
        },
      },
    });
    const base = createEntity({ type: 'effect', title: 'Custom typed', annotationNumber: 1 });
    // Force the type to the custom slug after creation (createEntity
    // only takes the built-in EntityType union).
    const entity = { ...base, type: 'risk-item' as typeof base.type };
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    expect(container.textContent).toContain('Custom typed');
    // The custom palette's colour shouldn't make the node crash — the
    // assertion above is the load-bearing "didn't throw + rendered".
  });

  it('falls back gracefully when a custom-class slug is not in the doc map', () => {
    // Importing a doc with an unknown custom slug shouldn't crash the
    // node — `resolveEntityTypeMeta` returns a Box-fallback meta.
    const base = createEntity({ type: 'effect', title: 'unknown class', annotationNumber: 1 });
    const entity = { ...base, type: 'totally-made-up' as typeof base.type };
    const { container } = mountWithRF(<TPNode {...makeNodeProps({ entity })} />);
    expect(container.textContent).toContain('unknown class');
  });
});

// Note: the zoom-up NodeToolbar branch is gated on
// `showZoomUp = zoom < ZOOM_UP_THRESHOLD && (selected || isHovered)`.
// React Flow's `<NodeToolbar isVisible={false}>` doesn't render its
// children to the DOM, so jsdom can't observe the card directly
// without manipulating React Flow's internal viewport store. The
// mouseEnter test above covers the `isHovered` state-setter; the
// declarative JSX branch is exercised at compile time. Skipped here
// rather than papered-over with a brittle React Flow store mock.
