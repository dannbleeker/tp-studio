import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StFacetRow } from '@/components/canvas/nodes/StFacetRow';
import { newEntityId } from '@/domain/ids';
import type { Entity } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Behaviour-asserting tests for `StFacetRow` — the single-row inline-
 * edit component used in the S&T 5-facet tactic card.
 *
 * Covers:
 *   - Static render: label + value, label + empty placeholder, accent styling
 *   - Double-click → edit mode (textarea appears, value pre-filled)
 *   - Browse Lock blocks the edit entry (double-click is a no-op)
 *   - Enter key commits the new value via setEntityAttribute
 *   - Blur commits the new value via setEntityAttribute
 *   - Empty draft on commit clears via removeEntityAttribute
 *   - No-op commit (value unchanged) does NOT mutate the store
 *   - Escape cancels without writing to the store
 */

beforeEach(resetStoreForTest);
afterEach(cleanup);

/** Seed a minimal entity with a single string attribute into the store and return its id. */
function seedEntityWithAttr(attrKey: string, attrValue: string): string {
  const id = newEntityId();
  const entity: Entity = {
    id,
    type: 'injection',
    title: 'Tactic title',
    annotationNumber: 1,
    createdAt: 0,
    updatedAt: 0,
    attributes: {
      [attrKey]: { kind: 'string', value: attrValue },
    },
  };
  useDocumentStore.setState((s) => ({
    doc: { ...s.doc, entities: { ...s.doc.entities, [id]: entity } },
  }));
  return id;
}

/** Seed an entity WITHOUT the facet attribute (so value is undefined). */
function seedEntityNoAttr(): string {
  const id = newEntityId();
  const entity: Entity = {
    id,
    type: 'injection',
    title: 'Tactic title',
    annotationNumber: 1,
    createdAt: 0,
    updatedAt: 0,
  };
  useDocumentStore.setState((s) => ({
    doc: { ...s.doc, entities: { ...s.doc.entities, [id]: entity } },
  }));
  return id;
}

// ---------------------------------------------------------------------------
// Static render
// ---------------------------------------------------------------------------

describe('StFacetRow — static render', () => {
  it('renders the label and value when both are provided', () => {
    const entityId = seedEntityWithAttr('stStrategy', 'Reduce waste');
    render(<StFacetRow entityId={entityId} attrKey="stStrategy" label="S" value="Reduce waste" />);
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.getByText('Reduce waste')).toBeTruthy();
  });

  it('renders the "(unset)" placeholder when value is undefined', () => {
    const entityId = seedEntityNoAttr();
    render(
      <StFacetRow
        entityId={entityId}
        attrKey="stNecessaryAssumption"
        label="NA"
        value={undefined}
      />
    );
    expect(screen.getByText('(unset)')).toBeTruthy();
  });

  it('shows a button (not a textarea) in the default (non-editing) state', () => {
    const entityId = seedEntityWithAttr('stStrategy', 'Grow revenue');
    const { container } = render(
      <StFacetRow entityId={entityId} attrKey="stStrategy" label="S" value="Grow revenue" />
    );
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('applies the accent (indigo) class on the label span when accent=true', () => {
    const entityId = seedEntityWithAttr('stStrategy', 'Accelerate');
    const { container } = render(
      <StFacetRow entityId={entityId} attrKey="stStrategy" label="S" value="Accelerate" accent />
    );
    const label = container.querySelector('span');
    expect(label?.className ?? '').toMatch(/indigo/);
  });

  it('does NOT apply indigo class when accent is omitted', () => {
    const entityId = seedEntityWithAttr('stNecessaryAssumption', 'Assumption text');
    const { container } = render(
      <StFacetRow
        entityId={entityId}
        attrKey="stNecessaryAssumption"
        label="NA"
        value="Assumption text"
      />
    );
    const label = container.querySelector('span');
    // neutral styling, not accent indigo
    expect(label?.className ?? '').not.toMatch(/text-indigo-700/);
  });

  it('button aria-label references the provided label', () => {
    const entityId = seedEntityWithAttr('stParallelAssumption', 'PA value');
    render(
      <StFacetRow entityId={entityId} attrKey="stParallelAssumption" label="PA" value="PA value" />
    );
    expect(screen.getByRole('button', { name: /Edit PA facet/i })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Double-click → edit mode
// ---------------------------------------------------------------------------

describe('StFacetRow — double-click enters edit mode', () => {
  it('shows a textarea after double-clicking the value button', () => {
    const entityId = seedEntityWithAttr('stStrategy', 'Current strategy');
    const { container } = render(
      <StFacetRow entityId={entityId} attrKey="stStrategy" label="S" value="Current strategy" />
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.doubleClick(btn);
    expect(container.querySelector('textarea')).not.toBeNull();
  });

  it('pre-fills the textarea with the current value on entry', () => {
    const entityId = seedEntityWithAttr('stStrategy', 'Pre-filled value');
    const { container } = render(
      <StFacetRow entityId={entityId} attrKey="stStrategy" label="S" value="Pre-filled value" />
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.doubleClick(btn);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.value).toBe('Pre-filled value');
  });

  it('pre-fills with empty string when value is undefined', () => {
    const entityId = seedEntityNoAttr();
    const { container } = render(
      <StFacetRow
        entityId={entityId}
        attrKey="stNecessaryAssumption"
        label="NA"
        value={undefined}
      />
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.doubleClick(btn);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.value).toBe('');
  });

  it('textarea aria-label references the facet label', () => {
    const entityId = seedEntityWithAttr('stSufficiencyAssumption', 'SA value');
    const { container } = render(
      <StFacetRow
        entityId={entityId}
        attrKey="stSufficiencyAssumption"
        label="SA"
        value="SA value"
      />
    );
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    const ta = container.querySelector('textarea');
    expect(ta?.getAttribute('aria-label')).toMatch(/Edit SA facet/i);
  });
});

// ---------------------------------------------------------------------------
// Browse Lock blocks edit entry
// ---------------------------------------------------------------------------

describe('StFacetRow — Browse Lock blocks edit entry', () => {
  it('double-click is a no-op when the document is browse-locked', () => {
    useDocumentStore.setState({ browseLocked: true });
    const entityId = seedEntityWithAttr('stStrategy', 'Locked');
    const { container } = render(
      <StFacetRow entityId={entityId} attrKey="stStrategy" label="S" value="Locked" />
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.doubleClick(btn);
    // Textarea must NOT appear — edit mode was blocked.
    expect(container.querySelector('textarea')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Commit via Enter key
// ---------------------------------------------------------------------------

describe('StFacetRow — Enter key commits', () => {
  it('Enter commits the new value to the store via setEntityAttribute', () => {
    const attrKey = 'stStrategy';
    const entityId = seedEntityWithAttr(attrKey, 'Old value');

    const { container } = render(
      <StFacetRow entityId={entityId} attrKey={attrKey} label="S" value="Old value" />
    );
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.change(ta, { target: { value: 'New value' } });
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false });

    const entity = useDocumentStore.getState().doc.entities[entityId];
    expect(entity?.attributes?.[attrKey]?.value).toBe('New value');
  });

  it('Enter exits edit mode (textarea disappears)', () => {
    const entityId = seedEntityWithAttr('stStrategy', 'Some text');
    const { container } = render(
      <StFacetRow entityId={entityId} attrKey="stStrategy" label="S" value="Some text" />
    );
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'Updated' } });
    fireEvent.keyDown(ta, { key: 'Enter' });

    // After commit the textarea should be gone.
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('Shift+Enter does NOT commit (allows newlines)', () => {
    const attrKey = 'stNecessaryAssumption';
    const entityId = seedEntityWithAttr(attrKey, 'Original');
    const { container } = render(
      <StFacetRow entityId={entityId} attrKey={attrKey} label="NA" value="Original" />
    );
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'Line one\nLine two' } });
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });

    // Still in edit mode (textarea present).
    expect(container.querySelector('textarea')).not.toBeNull();
    // Store not yet mutated.
    const entity = useDocumentStore.getState().doc.entities[entityId];
    expect(entity?.attributes?.[attrKey]?.value).toBe('Original');
  });
});

// ---------------------------------------------------------------------------
// Commit via blur
// ---------------------------------------------------------------------------

describe('StFacetRow — blur commits', () => {
  it('blur commits the new value to the store', () => {
    const attrKey = 'stParallelAssumption';
    const entityId = seedEntityWithAttr(attrKey, 'Before blur');

    const { container } = render(
      <StFacetRow entityId={entityId} attrKey={attrKey} label="PA" value="Before blur" />
    );
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.change(ta, { target: { value: 'After blur' } });
    fireEvent.blur(ta);

    const entity = useDocumentStore.getState().doc.entities[entityId];
    expect(entity?.attributes?.[attrKey]?.value).toBe('After blur');
  });

  it('blur exits edit mode', () => {
    const entityId = seedEntityWithAttr('stSufficiencyAssumption', 'SA text');
    const { container } = render(
      <StFacetRow
        entityId={entityId}
        attrKey="stSufficiencyAssumption"
        label="SA"
        value="SA text"
      />
    );
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'Updated SA' } });
    fireEvent.blur(ta);

    expect(container.querySelector('textarea')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty draft → removeEntityAttribute
// ---------------------------------------------------------------------------

describe('StFacetRow — empty draft clears the attribute', () => {
  it('committing an empty string calls removeEntityAttribute (no attribute left on entity)', () => {
    const attrKey = 'stStrategy';
    const entityId = seedEntityWithAttr(attrKey, 'Will be deleted');

    const { container } = render(
      <StFacetRow entityId={entityId} attrKey={attrKey} label="S" value="Will be deleted" />
    );
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;

    // Clear the textarea and commit.
    fireEvent.change(ta, { target: { value: '   ' } }); // whitespace-only trims to ''
    fireEvent.blur(ta);

    const entity = useDocumentStore.getState().doc.entities[entityId];
    // After removal the attribute key should be absent.
    expect(entity?.attributes?.[attrKey]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// No-op when value is unchanged
// ---------------------------------------------------------------------------

describe('StFacetRow — no-op when value unchanged', () => {
  it('committing the same value does not mutate updatedAt', () => {
    const attrKey = 'stNecessaryAssumption';
    const entityId = seedEntityWithAttr(attrKey, 'Same value');
    const before = useDocumentStore.getState().doc.entities[entityId]?.updatedAt ?? 0;

    const { container } = render(
      <StFacetRow entityId={entityId} attrKey={attrKey} label="NA" value="Same value" />
    );
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    // Same value (trimming is handled in commit).
    fireEvent.change(ta, { target: { value: 'Same value' } });
    fireEvent.blur(ta);

    const after = useDocumentStore.getState().doc.entities[entityId]?.updatedAt ?? 0;
    // No mutation → updatedAt unchanged.
    expect(after).toBe(before);
    // Edit mode exited.
    expect(container.querySelector('textarea')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Escape cancels without mutation
// ---------------------------------------------------------------------------

describe('StFacetRow — Escape cancels', () => {
  it('Escape exits edit mode without writing to the store', () => {
    const attrKey = 'stParallelAssumption';
    const entityId = seedEntityWithAttr(attrKey, 'Untouched');

    const { container } = render(
      <StFacetRow entityId={entityId} attrKey={attrKey} label="PA" value="Untouched" />
    );
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'Abandoned edit' } });
    fireEvent.keyDown(ta, { key: 'Escape' });

    // Edit mode closed.
    expect(container.querySelector('textarea')).toBeNull();
    // Store unchanged.
    const entity = useDocumentStore.getState().doc.entities[entityId];
    expect(entity?.attributes?.[attrKey]?.value).toBe('Untouched');
  });

  it('re-entering edit mode after Escape shows the original value', () => {
    const attrKey = 'stSufficiencyAssumption';
    const entityId = seedEntityWithAttr(attrKey, 'Original SA');

    const { container } = render(
      <StFacetRow entityId={entityId} attrKey={attrKey} label="SA" value="Original SA" />
    );

    // First edit: type something then cancel.
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    let ta = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'Cancelled text' } });
    fireEvent.keyDown(ta, { key: 'Escape' });

    // Second edit: the draft should be reset to the original prop value.
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.value).toBe('Original SA');
  });
});

// ---------------------------------------------------------------------------
// Keyboard event propagation stoppers (click / mousedown / keydown)
// ---------------------------------------------------------------------------

describe('StFacetRow — event propagation inside textarea', () => {
  it('click on the textarea does NOT propagate to a parent handler', () => {
    const entityId = seedEntityWithAttr('stStrategy', 'Click stop');
    let parentClicked = false;

    const { container } = render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test scaffold only — verifying stopPropagation
      // biome-ignore lint/a11y/useKeyWithClickEvents: div is a pane stand-in, keyboard nav out of scope
      <div
        onClick={() => {
          parentClicked = true;
        }}
      >
        <StFacetRow entityId={entityId} attrKey="stStrategy" label="S" value="Click stop" />
      </div>
    );
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.click(ta);
    expect(parentClicked).toBe(false);
  });

  it('mousedown on the textarea does NOT propagate to a parent handler', () => {
    const entityId = seedEntityWithAttr('stNecessaryAssumption', 'Mousedown stop');
    let parentMousedDown = false;

    const { container } = render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test scaffold only — verifying stopPropagation
      <div
        onMouseDown={() => {
          parentMousedDown = true;
        }}
      >
        <StFacetRow
          entityId={entityId}
          attrKey="stNecessaryAssumption"
          label="NA"
          value="Mousedown stop"
        />
      </div>
    );
    fireEvent.doubleClick(container.querySelector('button') as HTMLButtonElement);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.mouseDown(ta);
    expect(parentMousedDown).toBe(false);
  });
});
