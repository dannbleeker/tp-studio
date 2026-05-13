import { PALETTE_BY_DIAGRAM, resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import { isNonCausal, isNote, structuralEntities } from '@/domain/graph';
import { exportReasoningNarrative, exportReasoningOutline } from '@/domain/reasoningExport';
import { clarityRule } from '@/domain/validators/clarity';
import { entityExistenceRule } from '@/domain/validators/entityExistence';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedChain, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

/**
 * FL-ET7 — Note entities are free-form annotations that sit OUTSIDE the
 * causal graph. They render on canvas as their own (yellow-stripe) cards
 * but can't connect via edges, don't trigger CLR rules, and don't appear
 * in causality exports.
 */

describe('Note entity (FL-ET7)', () => {
  it('isNote / isNonCausal predicates discriminate correctly', () => {
    const note = seedEntity('A reminder', 'note');
    const effect = seedEntity('Some effect', 'effect');
    const assumption = seedEntity('A claim', 'assumption');

    expect(isNote(note)).toBe(true);
    expect(isNote(effect)).toBe(false);
    expect(isNote(assumption)).toBe(false);

    expect(isNonCausal(note)).toBe(true);
    expect(isNonCausal(assumption)).toBe(true);
    expect(isNonCausal(effect)).toBe(false);
  });

  it('structuralEntities excludes notes', () => {
    seedEntity('eff', 'effect');
    seedEntity('rc', 'rootCause');
    seedEntity('note', 'note');
    const doc = useDocumentStore.getState().doc;
    const structural = structuralEntities(doc);
    expect(structural.map((e) => e.type)).toEqual(expect.arrayContaining(['effect', 'rootCause']));
    expect(structural.map((e) => e.type)).not.toContain('note');
  });

  it('appears in every diagram type palette', () => {
    expect(PALETTE_BY_DIAGRAM.crt).toContain('note');
    expect(PALETTE_BY_DIAGRAM.frt).toContain('note');
    expect(PALETTE_BY_DIAGRAM.prt).toContain('note');
    expect(PALETTE_BY_DIAGRAM.tt).toContain('note');
    expect(PALETTE_BY_DIAGRAM.ec).toContain('note');
  });

  it('resolveEntityTypeMeta returns the Note label + yellow stripe', () => {
    const meta = resolveEntityTypeMeta('note');
    expect(meta.label).toBe('Note');
    // Yellow-500 — matches the post-it tint chosen in tokens.ts.
    expect(meta.stripeColor.toLowerCase()).toBe('#eab308');
  });

  it('connect() refuses to make a note an edge endpoint', () => {
    const note = seedEntity('A reminder', 'note');
    const effect = seedEntity('Some effect', 'effect');
    const state = useDocumentStore.getState();

    // Note → effect rejected.
    expect(state.connect(note.id, effect.id)).toBeNull();
    // Effect → note rejected.
    expect(state.connect(effect.id, note.id)).toBeNull();
    // Note → note rejected (same-id guard also catches this, but the
    // type guard is the load-bearing one we want covered).
    const note2 = seedEntity('Another reminder', 'note');
    expect(state.connect(note.id, note2.id)).toBeNull();

    expect(Object.keys(state.doc.edges)).toHaveLength(0);
  });

  it('addCoCauseToEdge refuses notes as source', () => {
    const { edges } = seedChain(['A', 'B'], 'effect');
    const note = seedEntity('A reminder', 'note');
    const result = useDocumentStore.getState().addCoCauseToEdge(edges[0]!.id, note.id);
    expect(result).toBeNull();
  });

  it('entityExistenceRule skips the disconnected check on notes', () => {
    // Seed enough entities to clear the DISCONNECTED_GRAPH_FLOOR (default 4):
    // 5 connected structural entities + one disconnected note.
    seedChain(['A', 'B', 'C', 'D', 'E'], 'effect');
    const orphanNote = useDocumentStore.getState().addEntity({ type: 'note', title: 'jot' });
    const warnings = entityExistenceRule(useDocumentStore.getState().doc);
    // The chain is fully connected; the note is the only candidate for the
    // disconnected warning, and it should be exempt.
    expect(warnings.some((w) => w.target.kind === 'entity' && w.target.id === orphanNote.id)).toBe(
      false
    );
  });

  it('entityExistenceRule still flags an empty-titled note (notes need content)', () => {
    // Empty title check applies to notes too — a blank note is a stub the
    // user almost certainly meant to fill in.
    useDocumentStore.getState().addEntity({ type: 'note', title: '' });
    const warnings = entityExistenceRule(useDocumentStore.getState().doc);
    expect(warnings.some((w) => w.message === 'Entity has no title.')).toBe(true);
  });

  it('clarityRule skips notes (multi-sentence prose is fine, questions are fine)', () => {
    const longProse =
      'This is a long sticky-note style annotation that easily blows past the 25-word clarity ' +
      'limit because notes are deliberately prose and may contain multiple sentences with their ' +
      'own punctuation, just like a real sticky note on a physical wall would.';
    useDocumentStore.getState().addEntity({ type: 'note', title: longProse });
    useDocumentStore.getState().addEntity({ type: 'note', title: 'Should we revisit this?' });
    const warnings = clarityRule(useDocumentStore.getState().doc);
    expect(warnings).toHaveLength(0);
  });

  it('reasoning narrative + outline exports skip note entities', () => {
    const { entities } = seedChain(['A', 'B'], 'effect');
    seedEntity('A side note about the analysis', 'note');
    const narrative = exportReasoningNarrative(useDocumentStore.getState().doc);
    const outline = exportReasoningOutline(useDocumentStore.getState().doc);
    expect(narrative).toContain(entities[0]!.title);
    expect(narrative).not.toContain('A side note about the analysis');
    expect(outline).not.toContain('A side note about the analysis');
  });
});
