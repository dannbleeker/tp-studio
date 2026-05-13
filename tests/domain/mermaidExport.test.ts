import { exportToMermaid } from '@/domain/mermaidExport';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedAndGroupable, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const exportCurrent = (): string => exportToMermaid(useDocumentStore.getState().doc);

describe('exportToMermaid (Block D / N3)', () => {
  it('emits a Mermaid graph with frontmatter title and BT direction', () => {
    useDocumentStore.getState().setTitle('My CRT');
    const md = exportCurrent();
    expect(md).toContain('---\ntitle: My CRT\n---');
    expect(md).toContain('graph BT');
  });

  it('renders each structural entity as a labeled node', () => {
    const e = seedEntity('Bad thing', 'ude');
    const md = exportCurrent();
    // Node form: nXX["#N Undesirable Effect<br/>Bad thing"]
    expect(md).toMatch(
      new RegExp(`n_[a-zA-Z0-9_]+\\["#${e.annotationNumber} Undesirable Effect<br/>Bad thing"]`)
    );
  });

  it('emits one --> edge per structural edge', () => {
    const { a, b } = seedConnectedPair();
    const md = exportCurrent();
    const safeA = a.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const safeB = b.id.replace(/[^a-zA-Z0-9_]/g, '_');
    expect(md).toContain(`n_${safeA} --> n_${safeB}`);
  });

  it('uses ==> (thick arrow) for AND-grouped edges', () => {
    const { a, b, c } = seedAndGroupable();
    const edgeIds = Object.values(useDocumentStore.getState().doc.edges)
      .filter((e) => (e.sourceId === a.id || e.sourceId === b.id) && e.targetId === c.id)
      .map((e) => e.id);
    const result = useDocumentStore.getState().groupAsAnd(edgeIds);
    expect(result.ok).toBe(true);
    const md = exportCurrent();
    const thickCount = (md.match(/==>/g) ?? []).length;
    expect(thickCount).toBe(2);
  });

  it('emits one classDef per entity type present, and applies it via `class`', () => {
    seedEntity('UDE 1', 'ude');
    seedEntity('Effect 1', 'effect');
    const md = exportCurrent();
    expect(md).toContain('classDef type_ude');
    expect(md).toContain('classDef type_effect');
    expect(md).toMatch(/class n_[a-zA-Z0-9_]+ type_ude;/);
    expect(md).toMatch(/class n_[a-zA-Z0-9_]+ type_effect;/);
  });

  it('replaces newlines with <br/> and HTML-escapes quotes inside labels', () => {
    seedEntity('Line one\nLine "two"');
    const md = exportCurrent();
    expect(md).toContain('Line one<br/>Line &quot;two&quot;');
  });

  it('excludes assumption entities from the output', () => {
    seedEntity('Structural', 'effect');
    seedEntity('Side note', 'assumption');
    const md = exportCurrent();
    expect(md).toContain('Structural');
    expect(md).not.toContain('Side note');
  });
});
