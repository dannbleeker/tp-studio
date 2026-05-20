import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSentencesForTest, chunkForTest } from '@/services/exporters/pptxExport';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedChain, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const doc = () => useDocumentStore.getState().doc;

/**
 * Session 134 — pure-helper tests for the PowerPoint exporter.
 *
 * The full `exportPPTX` pipeline drives pptxgenjs + html-to-image +
 * `URL.createObjectURL` + a synthetic anchor click — none of which
 * compose cleanly in jsdom. End-to-end coverage will land in the
 * Playwright suite when a follow-up session wires it. For now we
 * unit-test the pure data-shaping helpers (`chunkForTest`,
 * `buildSentencesForTest`) since they carry the regression risk that
 * a unit test catches: the slide pagination + the
 * narrative-sentence ordering / assumption filtering.
 */

describe('chunkForTest', () => {
  it('returns an empty array on empty input', () => {
    expect(chunkForTest([], 5)).toEqual([]);
  });

  it('returns one chunk when the input is shorter than the size', () => {
    expect(chunkForTest([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
  });

  it('splits at exact chunk boundaries', () => {
    expect(chunkForTest([1, 2, 3, 4, 5, 6], 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('lets the last chunk be short', () => {
    expect(chunkForTest([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it('preserves the input order across chunks', () => {
    const flat = chunkForTest(['a', 'b', 'c', 'd', 'e'], 2).flat();
    expect(flat).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('buildSentencesForTest', () => {
  it('returns an empty array when no edges are drawn', () => {
    expect(buildSentencesForTest(doc(), 'auto')).toEqual([]);
  });

  it('returns one sentence per edge in topological order (causes first)', () => {
    seedChain(['A', 'B', 'C']);
    const sentences = buildSentencesForTest(doc(), 'auto');
    // CRT default 'auto' resolves to "because"; sentences read effect-first.
    expect(sentences.length).toBe(2);
    expect(sentences[0]).toContain('"B" because "A"');
    expect(sentences[1]).toContain('"C" because "B"');
  });

  it('skips edges where either endpoint is an assumption', () => {
    // Two structural entities + one assumption hanging off the edge between them.
    const a = seedEntity('Effect A', 'effect');
    const b = seedEntity('Effect B', 'effect');
    const assumption = seedEntity('Hidden assumption', 'assumption');
    const s = useDocumentStore.getState();
    s.connect(a.id, b.id);
    // An edge that touches the assumption shouldn't appear in the deck.
    s.connect(assumption.id, b.id);

    const sentences = buildSentencesForTest(doc(), 'auto');
    expect(sentences.length).toBe(1);
    expect(sentences[0]).toContain('Effect');
    expect(sentences.join('\n')).not.toContain('Hidden assumption');
  });

  it('handles a single edge with the expected wording', () => {
    seedConnectedPair('Root cause', 'Visible effect');
    const sentences = buildSentencesForTest(doc(), 'auto');
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toBe('"Visible effect" because "Root cause".');
  });

  it('respects an explicit "in-order-to" causality label (necessity framing)', () => {
    seedConnectedPair('Authorization', 'Launch');
    const sentences = buildSentencesForTest(doc(), 'in-order-to');
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toBe('In order to obtain "Launch", "Authorization" must hold.');
  });
});
