import { exportToDot } from '@/domain/dotExport';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedAndGroupable, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const exportCurrent = (): string => exportToDot(useDocumentStore.getState().doc);

describe('exportToDot (Block D / N2)', () => {
  it('emits a digraph with the document title and rankdir=BT', () => {
    useDocumentStore.getState().setTitle('My CRT');
    const dot = exportCurrent();
    expect(dot).toMatch(/^digraph "My CRT" \{/);
    expect(dot).toContain('rankdir=BT;');
    expect(dot.trimEnd().endsWith('}')).toBe(true);
  });

  it('renders each structural entity as a node carrying its label and stripe colour', () => {
    seedEntity('Bad thing', 'ude');
    const dot = exportCurrent();
    expect(dot).toContain('label="Undesirable Effect');
    expect(dot).toContain('Bad thing');
    // Stripe colour appears on the node's color attribute. The token comes
    // from ENTITY_STRIPE_COLOR; we just sanity-check the hex prefix is present.
    expect(dot).toMatch(/color="#[0-9a-fA-F]{6}"/);
  });

  it('emits one edge directive per structural edge with sourceId -> targetId', () => {
    const { a, b } = seedConnectedPair();
    const dot = exportCurrent();
    // Both node identifiers should appear, and the arrow should exist
    // between them (in that order).
    const safeA = a.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const safeB = b.id.replace(/[^a-zA-Z0-9_]/g, '_');
    expect(dot).toContain(`n_${safeA} -> n_${safeB}`);
  });

  it('excludes assumption entities and edges that touch them', () => {
    seedEntity('Structural', 'effect');
    seedEntity('Floating note', 'assumption');
    const dot = exportCurrent();
    expect(dot).toContain('Structural');
    expect(dot).not.toContain('Floating note');
  });

  it('renders AND-grouped edges with style=bold', () => {
    const { a, b, c } = seedAndGroupable();
    const result = useDocumentStore.getState().groupAsAnd([
      // Edge ids — pull from edges record where source ∈ {a,b} and target = c.
      ...Object.values(useDocumentStore.getState().doc.edges)
        .filter((e) => (e.sourceId === a.id || e.sourceId === b.id) && e.targetId === c.id)
        .map((e) => e.id),
    ]);
    expect(result.ok).toBe(true);
    const dot = exportCurrent();
    // Both grouped edges should carry style=bold.
    const boldCount = (dot.match(/style=bold/g) ?? []).length;
    expect(boldCount).toBe(2);
  });

  it('escapes double quotes, backslashes, and newlines inside labels', () => {
    seedEntity('He said "hi"\nand left');
    const dot = exportCurrent();
    expect(dot).toContain('\\"hi\\"');
    expect(dot).toContain('\\nand left');
    expect(dot).not.toMatch(/\\\\(?!n)/); // no spurious backslashes
  });
});
