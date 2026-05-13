import { exportToOpml } from '@/domain/opmlExport';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedChain, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const exportCurrent = (): string => exportToOpml(useDocumentStore.getState().doc);

describe('exportToOpml (Block D / N1)', () => {
  it('emits a valid OPML 2.0 envelope with the document title in the head', () => {
    useDocumentStore.getState().setTitle('My CRT');
    const xml = exportCurrent();
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
    expect(xml).toContain('<opml version="2.0">');
    expect(xml).toContain('<title>My CRT</title>');
    expect(xml).toContain('<body>');
    expect(xml.trimEnd().endsWith('</opml>')).toBe(true);
  });

  it('renders an empty document as a body with no outlines', () => {
    const xml = exportCurrent();
    // Body opens and immediately closes (no <outline> elements).
    expect(xml).toMatch(/<body>\s*<\/body>/);
  });

  it('nests causes under effects in the outline (effect as outline parent)', () => {
    // A (root cause) → B (effect). B has no outgoing edges → B is the root;
    // A is its child.
    seedConnectedPair('Cause A', 'Effect B');
    const xml = exportCurrent();
    // B should appear before A; A indented one level deeper.
    const idxB = xml.indexOf('text="Effect B"');
    const idxA = xml.indexOf('text="Cause A"');
    expect(idxB).toBeGreaterThan(-1);
    expect(idxA).toBeGreaterThan(idxB);
    // The cause-line should be more deeply indented than the effect-line.
    const lineB = xml.slice(0, idxB).split('\n').pop() ?? '';
    const lineA = xml.slice(0, idxA).split('\n').pop() ?? '';
    expect(lineA.length).toBeGreaterThan(lineB.length);
  });

  it('escapes XML special characters in titles and descriptions', () => {
    const e = seedEntity('Tom & Jerry "vs." <foo>');
    useDocumentStore.getState().updateEntity(e.id, {
      description: 'Note with <tags> & "quotes"',
    });
    const xml = exportCurrent();
    expect(xml).toContain('text="Tom &amp; Jerry &quot;vs.&quot; &lt;foo&gt;"');
    expect(xml).toContain('_note="Note with &lt;tags&gt; &amp; &quot;quotes&quot;"');
  });

  it('omits assumptions from the outline (they belong to edges, not the causal flow)', () => {
    seedEntity('Structural effect', 'effect');
    seedEntity('Side note', 'assumption');
    const xml = exportCurrent();
    expect(xml).toContain('text="Structural effect"');
    expect(xml).not.toContain('text="Side note"');
  });

  it('chains a three-link causal chain into a 3-deep outline tree', () => {
    seedChain(['A', 'B', 'C']);
    const xml = exportCurrent();
    // Outline shape: C (root, no outgoing) → B child → A grandchild.
    const idxC = xml.indexOf('text="C"');
    const idxB = xml.indexOf('text="B"');
    const idxA = xml.indexOf('text="A"');
    expect(idxC).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxA);
    // Three distinct indentation depths.
    const indentOf = (txt: string, idx: number): number => {
      const start = txt.lastIndexOf('\n', idx) + 1;
      return idx - start;
    };
    const dC = indentOf(xml, idxC);
    const dB = indentOf(xml, idxB);
    const dA = indentOf(xml, idxA);
    expect(dB).toBeGreaterThan(dC);
    expect(dA).toBeGreaterThan(dB);
  });

  it('stamps each outline with _type and _annotation attributes', () => {
    const e = seedEntity('Bad thing', 'ude');
    const xml = exportCurrent();
    expect(xml).toContain('text="Bad thing"');
    expect(xml).toContain('_type="Undesirable Effect"');
    expect(xml).toContain(`_annotation="${e.annotationNumber}"`);
  });

  it('renders the document author as <ownerName> when set', () => {
    useDocumentStore.getState().setDocumentMeta({ author: 'Alice' });
    const xml = exportCurrent();
    expect(xml).toContain('<ownerName>Alice</ownerName>');
  });
});
