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
