import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EntityInspector } from '@/components/inspector/EntityInspector';
import { CUSTOM_CLASS_ICONS } from '@/domain/entityTypeIcons';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * EntityInspector is the editing surface for a single entity: title textarea,
 * type radio grid (driven by PALETTE_BY_DIAGRAM), markdown description,
 * title-size buttons, and the destructive delete button. The Inspector
 * chrome / hide-show logic is covered separately in Inspector.test.tsx; here
 * we drive the body directly.
 *
 * `Browse Lock` (locked === true) disables every input — that's a separate
 * test below to keep the regression net wide. Everything else relies on the
 * store mutators landing as expected.
 */

describe('EntityInspector', () => {
  it('pre-fills the title textarea from the entity', () => {
    const e = seedEntity('Order entry is manual');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.value).toBe('Order entry is manual');
  });

  it('typing in the title textarea writes through to the store', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    act(() => fireEvent.change(ta, { target: { value: 'Manual order entry causes errors' } }));
    expect(useDocumentStore.getState().doc.entities[e.id]?.title).toBe(
      'Manual order entry causes errors'
    );
  });

  it('clicking a different type button updates the entity type', () => {
    const e = seedEntity('A', 'effect');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    // The type radio grid is the second `<Field>` with the "Type" label; each
    // type button is a `<button>` containing the type's display label. We
    // pick "Root Cause" — it's in the default CRT palette.
    const rcBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Root Cause')
    ) as HTMLButtonElement | undefined;
    expect(rcBtn).toBeTruthy();
    act(() => fireEvent.click(rcBtn!));
    expect(useDocumentStore.getState().doc.entities[e.id]?.type).toBe('rootCause');
  });

  it('Title size buttons update titleSize (undefined for md, set for sm/lg)', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const compact = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Compact')
    ) as HTMLButtonElement;
    const large = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Large')
    ) as HTMLButtonElement;
    expect(compact && large).toBeTruthy();
    act(() => fireEvent.click(compact));
    expect(useDocumentStore.getState().doc.entities[e.id]?.titleSize).toBe('sm');
    act(() => fireEvent.click(large));
    expect(useDocumentStore.getState().doc.entities[e.id]?.titleSize).toBe('lg');
  });

  it('Browse Lock disables the title textarea and type buttons', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
    // Every type button should be disabled too. We sample the destructive
    // Delete button — locked is the most consequential gate it carries.
    const del = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete entity')
    ) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
  });

  it('renders nothing when the entity id no longer exists', () => {
    const { container } = render(<EntityInspector entityId="missing-id" warnings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('Attestation textarea writes Entity.attestation (Block C / E6)', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    // The attestation textarea is identified by its placeholder text.
    const ta = container.querySelector(
      'textarea[placeholder*="Source or evidence"]'
    ) as HTMLTextAreaElement | null;
    expect(ta).toBeTruthy();
    expect(ta!.value).toBe('');
    act(() => fireEvent.change(ta!, { target: { value: 'Goldratt, 1990' } }));
    expect(useDocumentStore.getState().doc.entities[e.id]?.attestation).toBe('Goldratt, 1990');
  });

  it('Clearing the Attestation field stores undefined, not an empty string', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().updateEntity(e.id, { attestation: 'previous' }));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const ta = container.querySelector(
      'textarea[placeholder*="Source or evidence"]'
    ) as HTMLTextAreaElement;
    expect(ta.value).toBe('previous');
    act(() => fireEvent.change(ta, { target: { value: '' } }));
    expect(useDocumentStore.getState().doc.entities[e.id]?.attestation).toBeUndefined();
  });

  // Session 87 / EC PPT comparison item #2 — per-slot guiding question.
  it('shows the slot-specific guiding question when an EC slot entity is selected', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    const aSlot = Object.values(useDocumentStore.getState().doc.entities).find(
      (e) => e.ecSlot === 'a'
    );
    expect(aSlot).toBeTruthy();
    const { container } = render(<EntityInspector entityId={aSlot!.id} warnings={[]} />);
    const aside = container.querySelector('[data-component="ec-guiding-question"]');
    expect(aside).toBeTruthy();
    expect(aside?.textContent).toMatch(/common objective/i);
  });

  it("D′ slot shows the 'What is the action I want to do?' prompt", () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    const dPrimeSlot = Object.values(useDocumentStore.getState().doc.entities).find(
      (e) => e.ecSlot === 'dPrime'
    );
    expect(dPrimeSlot).toBeTruthy();
    const { container } = render(<EntityInspector entityId={dPrimeSlot!.id} warnings={[]} />);
    const aside = container.querySelector('[data-component="ec-guiding-question"]');
    expect(aside?.textContent).toMatch(/action I want to do/);
  });

  it('does NOT show the guiding-question aside on a non-EC entity', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    expect(container.querySelector('[data-component="ec-guiding-question"]')).toBeNull();
  });
});

// ── Locus (spanOfControl) ──────────────────────────────────────────────────

describe('EntityInspector — Locus (spanOfControl)', () => {
  it('clicking Control sets spanOfControl to "control"', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const controlBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Control'
    ) as HTMLButtonElement;
    expect(controlBtn).toBeTruthy();
    act(() => fireEvent.click(controlBtn));
    expect(useDocumentStore.getState().doc.entities[e.id]?.spanOfControl).toBe('control');
  });

  it('clicking Influence sets spanOfControl to "influence"', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const influenceBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Influence'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(influenceBtn!));
    expect(useDocumentStore.getState().doc.entities[e.id]?.spanOfControl).toBe('influence');
  });

  it('clicking External sets spanOfControl to "external"', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const externalBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'External'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(externalBtn!));
    expect(useDocumentStore.getState().doc.entities[e.id]?.spanOfControl).toBe('external');
  });

  it('clicking Unset clears spanOfControl back to undefined', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().updateEntity(e.id, { spanOfControl: 'control' }));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const unsetBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Unset'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(unsetBtn!));
    expect(useDocumentStore.getState().doc.entities[e.id]?.spanOfControl).toBeUndefined();
  });
});

// ── State picker ───────────────────────────────────────────────────────────

describe('EntityInspector — State picker', () => {
  it('clicking True sets entity state to "true"', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const statePicker = container.querySelector('[data-component="entity-state-picker"]');
    expect(statePicker).toBeTruthy();
    const trueBtn = Array.from(statePicker!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'True'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(trueBtn!));
    expect(useDocumentStore.getState().doc.entities[e.id]?.state).toBe('true');
  });

  it('clicking False sets entity state to "false"', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const statePicker = container.querySelector('[data-component="entity-state-picker"]');
    const falseBtn = Array.from(statePicker!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'False'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(falseBtn!));
    expect(useDocumentStore.getState().doc.entities[e.id]?.state).toBe('false');
  });

  it('clicking Disputed sets entity state to "disputed"', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const statePicker = container.querySelector('[data-component="entity-state-picker"]');
    const disputedBtn = Array.from(statePicker!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Disputed'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(disputedBtn!));
    expect(useDocumentStore.getState().doc.entities[e.id]?.state).toBe('disputed');
  });

  it('clicking Unknown clears the entity state to undefined', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().updateEntity(e.id, { state: 'true' }));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const statePicker = container.querySelector('[data-component="entity-state-picker"]');
    const unknownBtn = Array.from(statePicker!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Unknown'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(unknownBtn!));
    expect(useDocumentStore.getState().doc.entities[e.id]?.state).toBeUndefined();
  });
});

// ── Core-problem toggle ────────────────────────────────────────────────────

describe('EntityInspector — core-problem toggle', () => {
  it('clicking "Mark as core problem" sets coreProblem to true', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mark as core problem')
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    act(() => fireEvent.click(btn));
    expect(useDocumentStore.getState().doc.entities[e.id]?.coreProblem).toBe(true);
  });

  it('shows "Core problem — marked" label when coreProblem is true', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().toggleCoreProblem(e.id));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Core problem')
    ) as HTMLButtonElement;
    expect(btn?.textContent).toMatch(/Core problem — marked/);
  });

  it('clicking the marked button clears coreProblem', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().toggleCoreProblem(e.id));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Core problem — marked')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn!));
    expect(useDocumentStore.getState().doc.entities[e.id]?.coreProblem).toBeUndefined();
  });

  it('does NOT render the core-problem button under Browse Lock when coreProblem is unset', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mark as core problem')
    );
    // Locked + coreProblem=false → button is hidden entirely
    expect(btn).toBeUndefined();
  });

  it('renders the core-problem button read-only under Browse Lock when coreProblem IS set', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().toggleCoreProblem(e.id));
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Core problem — marked')
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });
});

// ── Custom icon picker ─────────────────────────────────────────────────────

describe('EntityInspector — custom icon picker', () => {
  it('clicking an icon sets entity.icon to that icon name', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const firstName = Object.keys(CUSTOM_CLASS_ICONS)[0]!;
    const iconBtn = container.querySelector(
      `button[aria-label="Icon: ${firstName}"]`
    ) as HTMLButtonElement;
    expect(iconBtn).toBeTruthy();
    act(() => fireEvent.click(iconBtn));
    expect(useDocumentStore.getState().doc.entities[e.id]?.icon).toBe(firstName);
  });

  it('clicking "None" clears entity.icon to undefined', () => {
    const e = seedEntity('A');
    const firstName = Object.keys(CUSTOM_CLASS_ICONS)[0]!;
    act(() => useDocumentStore.getState().updateEntity(e.id, { icon: firstName }));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const noneBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'None'
    ) as HTMLButtonElement;
    expect(noneBtn).toBeTruthy();
    act(() => fireEvent.click(noneBtn));
    expect(useDocumentStore.getState().doc.entities[e.id]?.icon).toBeUndefined();
  });

  it('icon button shows aria-pressed=true when that icon is active', () => {
    const e = seedEntity('A');
    const iconName = Object.keys(CUSTOM_CLASS_ICONS)[0]!;
    act(() => useDocumentStore.getState().updateEntity(e.id, { icon: iconName }));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const iconBtn = container.querySelector(
      `button[aria-label="Icon: ${iconName}"]`
    ) as HTMLButtonElement;
    expect(iconBtn.getAttribute('aria-pressed')).toBe('true');
  });
});

// ── Description field ──────────────────────────────────────────────────────

describe('EntityInspector — description field', () => {
  it('editing the description textarea updates entity.description', () => {
    const e = seedEntity('A');
    render(<EntityInspector entityId={e.id} warnings={[]} />);
    // MarkdownField renders a preview + a raw textarea toggled by Edit/Preview buttons.
    // In edit mode there's a textarea with the description placeholder.
    const placeholderPattern = /Optional notes/;
    const ta = screen.getByPlaceholderText(placeholderPattern) as HTMLTextAreaElement | null;
    expect(ta).toBeTruthy();
    act(() => fireEvent.change(ta!, { target: { value: 'Some notes' } }));
    expect(useDocumentStore.getState().doc.entities[e.id]?.description).toBe('Some notes');
  });
});

// ── Owner + mark-validated ────────────────────────────────────────────────

describe('EntityInspector — owner and mark-validated', () => {
  it('typing in the Owner field updates entity.owner', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const ownerInput = container.querySelector(
      'input[aria-label="Owner"]'
    ) as HTMLInputElement | null;
    expect(ownerInput).toBeTruthy();
    act(() => fireEvent.change(ownerInput!, { target: { value: 'Alice' } }));
    expect(useDocumentStore.getState().doc.entities[e.id]?.owner).toBe('Alice');
  });

  it('clearing the Owner field stores undefined, not empty string', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().updateEntity(e.id, { owner: 'Alice' }));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const ownerInput = container.querySelector('input[aria-label="Owner"]') as HTMLInputElement;
    act(() => fireEvent.change(ownerInput, { target: { value: '' } }));
    expect(useDocumentStore.getState().doc.entities[e.id]?.owner).toBeUndefined();
  });

  it('clicking "Mark validated" sets lastValidatedAt to a number', () => {
    const e = seedEntity('A');
    const before = Date.now();
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const validateBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mark validated')
    ) as HTMLButtonElement;
    expect(validateBtn).toBeTruthy();
    act(() => fireEvent.click(validateBtn));
    const ts = useDocumentStore.getState().doc.entities[e.id]?.lastValidatedAt;
    expect(typeof ts).toBe('number');
    expect(ts).toBeGreaterThanOrEqual(before);
  });

  it('shows Re-validate button after the entity has already been validated', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().updateEntity(e.id, { lastValidatedAt: Date.now() }));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const revalidateBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Re-validate')
    );
    expect(revalidateBtn).toBeTruthy();
  });
});

// ── Unspecified placeholder checkbox ──────────────────────────────────────

describe('EntityInspector — unspecified placeholder', () => {
  it('checking the unspecified checkbox sets entity.unspecified to true', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    act(() => fireEvent.click(checkbox));
    expect(useDocumentStore.getState().doc.entities[e.id]?.unspecified).toBe(true);
  });

  it('unchecking the unspecified checkbox clears entity.unspecified to undefined', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().updateEntity(e.id, { unspecified: true }));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    act(() => fireEvent.click(checkbox));
    expect(useDocumentStore.getState().doc.entities[e.id]?.unspecified).toBeUndefined();
  });
});

// ── Injection flower — type-conditional ───────────────────────────────────

describe('EntityInspector — injection flower button (type-conditional)', () => {
  it('shows the injection flower button when entity type is "injection"', () => {
    const e = seedEntity('A', 'injection');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const flowerBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('View the injection flower')
    );
    expect(flowerBtn).toBeTruthy();
  });

  it('does NOT show the injection flower button for non-injection entity types', () => {
    const e = seedEntity('A', 'effect');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const flowerBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('View the injection flower')
    );
    expect(flowerBtn).toBeUndefined();
  });
});

// ── S&T facets — only for injection in 'st' diagram ──────────────────────

describe('EntityInspector — S&T facets (st diagram + injection type)', () => {
  it('shows S&T facet textareas when diagramType is "st" and entity is "injection"', () => {
    act(() => useDocumentStore.getState().newDocument('st'));
    const e = useDocumentStore.getState().addEntity({ type: 'injection', title: 'Tactic' });
    render(<EntityInspector entityId={e.id} warnings={[]} />);
    // StFacetsSection renders "Necessary Assumption" label
    expect(screen.queryByText(/Necessary Assumption/i)).toBeTruthy();
  });

  it('does NOT show S&T facets when diagramType is "crt" even for injection', () => {
    // CRT is the default from resetStoreForTest
    const e = seedEntity('A', 'injection');
    render(<EntityInspector entityId={e.id} warnings={[]} />);
    expect(screen.queryByText(/Necessary Assumption/i)).toBeNull();
  });
});

// ── importedFrom badge ─────────────────────────────────────────────────────

describe('EntityInspector — importedFrom badge', () => {
  it('shows the "Imported from" field when entity.importedFrom is set', () => {
    const e = seedEntity('A');
    act(() =>
      useDocumentStore.getState().updateEntity(e.id, {
        importedFrom: {
          docId: 'doc-abc' as import('@/domain/types/ids').DocumentId,
          entityId: 'ent-xyz' as import('@/domain/types/ids').EntityId,
          sourceTitle: 'Source CRT',
          importedAt: '2025-01-15T10:00:00.000Z',
        },
      })
    );
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    expect(container.textContent).toContain('Source CRT');
    expect(container.textContent).toContain('doc-abc');
  });

  it('does NOT show the "Imported from" field when entity.importedFrom is absent', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    expect(container.textContent).not.toContain('Imported from');
  });

  it('shows "(untitled source)" when importedFrom has no sourceTitle', () => {
    const e = seedEntity('A');
    act(() =>
      useDocumentStore.getState().updateEntity(e.id, {
        importedFrom: {
          docId: 'doc-123' as import('@/domain/types/ids').DocumentId,
          entityId: 'ent-456' as import('@/domain/types/ids').EntityId,
        },
      })
    );
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    expect(container.textContent).toContain('(untitled source)');
  });
});
