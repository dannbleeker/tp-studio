import { exportToVgl } from '@/domain/vglExport';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedAndGroupable, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const docState = () => useDocumentStore.getState().doc;

describe('exportToVgl (N5)', () => {
  it('emits a graph header with title + type + direction', () => {
    useDocumentStore.getState().setTitle('My CRT');
    const vgl = exportToVgl(docState());
    expect(vgl).toMatch(/^graph "My CRT" type:crt direction:BT \{/);
    expect(vgl.trimEnd().endsWith('}')).toBe(true);
  });

  it('renders one entity block per structural entity', () => {
    seedEntity('A', 'effect');
    seedEntity('B', 'ude');
    const vgl = exportToVgl(docState());
    expect(vgl).toMatch(/entity e_[\w]+ class:"Effect" \{/);
    expect(vgl).toMatch(/entity e_[\w]+ class:"Undesirable Effect" \{/);
    expect((vgl.match(/title: /g) ?? []).length).toBe(2);
  });

  it('renders title, annotation, and (when present) description per entity', () => {
    const e = seedEntity('A real title', 'effect');
    useDocumentStore.getState().updateEntity(e.id, { description: 'A note' });
    const vgl = exportToVgl(docState());
    expect(vgl).toContain('title: "A real title"');
    expect(vgl).toContain(`annotation: ${e.annotationNumber}`);
    expect(vgl).toContain('description: "A note"');
  });

  it('skips assumption-typed entities entirely', () => {
    seedEntity('Real entity', 'effect');
    seedEntity('Side note', 'assumption');
    const vgl = exportToVgl(docState());
    expect(vgl).toContain('"Real entity"');
    expect(vgl).not.toContain('"Side note"');
  });

  it('plain edges render as a single line (no body) when no label is set', () => {
    seedConnectedPair('A', 'B');
    const vgl = exportToVgl(docState());
    expect(vgl).toMatch(/edge e_[\w]+ -> e_[\w]+/);
  });

  it('edges with labels render as a block with the label inside', () => {
    const { edge } = seedConnectedPair('A', 'B');
    useDocumentStore.getState().updateEdge(edge.id, { label: 'within 30 days' });
    const vgl = exportToVgl(docState());
    expect(vgl).toMatch(/edge e_[\w]+ -> e_[\w]+ \{[\s\S]*label: "within 30 days"[\s\S]*\}/);
  });

  it('AND-grouped edges with 2+ members render as one `edge_and` block', () => {
    const { e1, e2 } = seedAndGroupable();
    const r = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    expect(r.ok).toBe(true);
    const vgl = exportToVgl(docState());
    expect(vgl).toMatch(/edge_and target:e_[\w]+ \{/);
    // Both members listed inside.
    const block = vgl.match(/edge_and[\s\S]*?\}/)?.[0] ?? '';
    expect((block.match(/^\s{4}e_\w+$/gm) ?? []).length).toBe(2);
  });

  it('escapes double quotes and backslashes inside titles', () => {
    seedEntity('She said \\"hi\\"', 'effect');
    const vgl = exportToVgl(docState());
    // Backslash should escape; quote should escape.
    expect(vgl).toContain('title: "She said \\\\\\"hi\\\\\\""');
  });
});
