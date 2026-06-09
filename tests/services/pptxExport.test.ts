import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildReasoningSentences } from '@/domain/reasoningExport';
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
 * narrative-sentence ordering.
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

  it('delegates to the canonical reasoning builder for TT (AND-junctor triples)', () => {
    // A Transition Tree where one target is fed by an ACTION plus a precondition.
    // The canonical builder collapses those two edges into a single
    // "in order to obtain T, do A given P" triple; the deck must match it. An
    // earlier divergent copy in the exporter emitted two generic per-edge
    // sentences, so a TT deck read differently from every other export of the
    // same tree — this pins the deck to the shared builder.
    useDocumentStore.getState().newDocument('tt');
    const action = seedEntity('Pull the lever', 'action');
    const precondition = seedEntity('Lever is unlocked', 'effect');
    const target = seedEntity('Machine starts', 'effect');
    const s = useDocumentStore.getState();
    s.connect(action.id, target.id);
    s.connect(precondition.id, target.id);

    const ttDoc = doc();
    // Deck output equals the canonical narrative / print builder exactly.
    expect(buildSentencesForTest(ttDoc, 'auto')).toEqual(buildReasoningSentences(ttDoc, 'auto'));
    // Teeth: the TT triple actually fired (one combined line, not two per-edge).
    const deck = buildSentencesForTest(ttDoc, 'auto');
    expect(deck).toHaveLength(1);
    expect(deck[0]).toBe(
      'In order to obtain "Machine starts", do "Pull the lever" given "Lever is unlocked".'
    );
  });
});
