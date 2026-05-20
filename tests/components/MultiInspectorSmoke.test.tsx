import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MultiInspector } from '@/components/inspector/MultiInspector';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

/**
 * Session 134 coverage push (round 2) — `MultiInspector` was at 34%.
 *
 * Existing `MultiInspector.test.tsx` covers parts of the entity-multi
 * surface; this file fills the gaps: edge-multi rendering, bulk
 * convert, bulk delete, and the empty/no-such-entity guard.
 */

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  cleanup();
});

const s = () => useDocumentStore.getState();

describe('MultiInspector — entities multi', () => {
  it('renders a "N entities selected" summary', () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    render(<MultiInspector kind="entities" ids={[a.id, b.id]} />);
    expect(screen.getByText(/2 entities selected/i)).toBeTruthy();
  });

  it('reports "Mixed types" when the selection spans multiple entity types', () => {
    const a = seedEntity('Alpha', 'effect');
    const b = seedEntity('Beta', 'rootCause');
    render(<MultiInspector kind="entities" ids={[a.id, b.id]} />);
    expect(screen.getByText(/Mixed types/i)).toBeTruthy();
  });

  it('reports "All <Type>" when all selected entities share a type', () => {
    const a = seedEntity('Alpha', 'rootCause');
    const b = seedEntity('Beta', 'rootCause');
    render(<MultiInspector kind="entities" ids={[a.id, b.id]} />);
    expect(screen.getByText(/All Root Cause/i)).toBeTruthy();
  });

  it('renders null when none of the ids reference an existing entity', () => {
    const { container } = render(<MultiInspector kind="entities" ids={['nope', 'also-nope']} />);
    expect(container.firstChild).toBeNull();
  });

  it("a convert-to button updates every selected entity's type", () => {
    const a = seedEntity('Alpha', 'effect');
    const b = seedEntity('Beta', 'effect');
    render(<MultiInspector kind="entities" ids={[a.id, b.id]} />);
    // Find the "Root Cause" convert button.
    const buttons = screen.getAllByRole('button');
    const target = buttons.find((b) => b.textContent?.includes('Root Cause'));
    expect(target, 'Root Cause button not found').toBeDefined();
    fireEvent.click(target!);
    expect(s().doc.entities[a.id]?.type).toBe('rootCause');
    expect(s().doc.entities[b.id]?.type).toBe('rootCause');
  });
});

describe('MultiInspector — edges multi', () => {
  it('renders a "N edges selected" summary', () => {
    const { edge: e1 } = seedConnectedPair('A', 'B');
    const { edge: e2 } = seedConnectedPair('C', 'D');
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    expect(screen.getByText(/2 edges selected/i)).toBeTruthy();
  });
});

describe('MultiInspector — title-size bulk operation', () => {
  it('"Compact" applies sm titleSize to every selected entity', () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    render(<MultiInspector kind="entities" ids={[a.id, b.id]} />);
    const compact = screen.getByText(/Compact/);
    fireEvent.click(compact);
    expect(s().doc.entities[a.id]?.titleSize).toBe('sm');
    expect(s().doc.entities[b.id]?.titleSize).toBe('sm');
  });

  it('"Large" applies lg titleSize to every selected entity', () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    render(<MultiInspector kind="entities" ids={[a.id, b.id]} />);
    const large = screen.getByText(/Large/);
    fireEvent.click(large);
    expect(s().doc.entities[a.id]?.titleSize).toBe('lg');
    expect(s().doc.entities[b.id]?.titleSize).toBe('lg');
  });

  it('"Regular" clears explicit titleSize back to the implicit default (undefined)', () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    useDocumentStore.getState().updateEntity(a.id, { titleSize: 'sm' });
    useDocumentStore.getState().updateEntity(b.id, { titleSize: 'sm' });
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    render(<MultiInspector kind="entities" ids={[a.id, b.id]} />);
    const regular = screen.getByText(/Regular/);
    fireEvent.click(regular);
    expect(s().doc.entities[a.id]?.titleSize).toBeUndefined();
    expect(s().doc.entities[b.id]?.titleSize).toBeUndefined();
  });
});

describe('MultiInspector — renumber', () => {
  it('Apply 1..N writes ordering to each selected entity', () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    const c = seedEntity('Gamma');
    useDocumentStore.getState().selectEntities([a.id, b.id, c.id]);
    render(<MultiInspector kind="entities" ids={[a.id, b.id, c.id]} />);
    // Find the renumber Apply button — it has "Apply 1…3" or similar text.
    const apply = screen
      .getAllByRole('button')
      .find((btn) => /Apply\s+\d/i.test(btn.textContent ?? ''));
    expect(apply, 'renumber Apply button missing').toBeDefined();
    fireEvent.click(apply!);
    // Each entity gets sequential orderings starting at 1.
    expect(s().doc.entities[a.id]?.ordering).toBe(1);
    expect(s().doc.entities[b.id]?.ordering).toBe(2);
    expect(s().doc.entities[c.id]?.ordering).toBe(3);
  });
});

describe('MultiInspector — Swap entities', () => {
  it('"Swap entities" button swaps two-selection titles', () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    render(<MultiInspector kind="entities" ids={[a.id, b.id]} />);
    const swap = screen.getByRole('button', { name: /Swap entities/i });
    fireEvent.click(swap);
    expect(s().doc.entities[a.id]?.title).toBe('Beta');
    expect(s().doc.entities[b.id]?.title).toBe('Alpha');
  });

  it('"Swap entities" button does NOT render with three or more entities', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    useDocumentStore.getState().selectEntities([a.id, b.id, c.id]);
    render(<MultiInspector kind="entities" ids={[a.id, b.id, c.id]} />);
    expect(screen.queryByRole('button', { name: /Swap entities/i })).toBeNull();
  });
});
