import { redactDocument } from '@/domain/redact';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

/**
 * `redactDocument` produces a sharable copy of a document by stripping
 * user-supplied text while preserving structure. Critical invariants:
 *
 *   - Entity titles → `"#N"` based on annotationNumber.
 *   - Entity descriptions → undefined (omitted, not blanked).
 *   - Group titles → `"Group N"` (1-based positional).
 *   - Edge labels → undefined.
 *   - Document title / author / description → blanked.
 *   - Structure (ids, edges, AND-grouping, annotation numbers) is
 *     preserved exactly. This is the property tests should pin down.
 */

describe('redactDocument', () => {
  it('replaces entity titles with #N annotation numbers', () => {
    seedEntity('Sensitive title 1');
    seedEntity('Sensitive title 2');
    const doc = useDocumentStore.getState().doc;
    const redacted = redactDocument(doc);
    const titles = Object.values(redacted.entities).map((e) => e.title);
    expect(titles).toContain('#1');
    expect(titles).toContain('#2');
    // None of the original text leaks.
    expect(titles.some((t) => t.includes('Sensitive'))).toBe(false);
  });

  it('strips entity descriptions (omits the field, not just blanks)', () => {
    const e = seedEntity('A');
    useDocumentStore.getState().updateEntity(e.id, { description: 'private note' });
    const doc = useDocumentStore.getState().doc;
    const redacted = redactDocument(doc);
    const re = redacted.entities[e.id];
    expect(re?.description).toBeUndefined();
  });

  it('strips edge labels', () => {
    const { edge } = seedConnectedPair('A', 'B');
    useDocumentStore.getState().updateEdge(edge.id, { label: 'inside 30 days' });
    const doc = useDocumentStore.getState().doc;
    const redacted = redactDocument(doc);
    expect(redacted.edges[edge.id]?.label).toBeUndefined();
  });

  it('renames groups to "Group 1", "Group 2", … in iteration order', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const state = useDocumentStore.getState();
    state.createGroupFromSelection([a.id], { title: 'Private group A' });
    state.createGroupFromSelection([b.id], { title: 'Private group B' });
    const doc = useDocumentStore.getState().doc;
    const redacted = redactDocument(doc);
    const titles = Object.values(redacted.groups).map((g) => g.title);
    expect(titles).toEqual(['Group 1', 'Group 2']);
  });

  it('blanks the document title and clears author + description', () => {
    useDocumentStore.getState().setTitle('My private CRT');
    useDocumentStore
      .getState()
      .setDocumentMeta({ author: 'Jane Doe', description: 'Internal review' });
    const doc = useDocumentStore.getState().doc;
    const redacted = redactDocument(doc);
    expect(redacted.title).toBe('Untitled');
    expect(redacted.author).toBeUndefined();
    expect(redacted.description).toBeUndefined();
  });

  it('preserves structural fields (ids, edge endpoints, andGroupId, schemaVersion)', () => {
    const { a, b, edge } = seedConnectedPair();
    const doc = useDocumentStore.getState().doc;
    const redacted = redactDocument(doc);
    // Entity / edge ids unchanged.
    expect(redacted.entities[a.id]?.id).toBe(a.id);
    expect(redacted.entities[b.id]?.id).toBe(b.id);
    expect(redacted.edges[edge.id]?.sourceId).toBe(a.id);
    expect(redacted.edges[edge.id]?.targetId).toBe(b.id);
    expect(redacted.schemaVersion).toBe(doc.schemaVersion);
  });

  it('is pure — does not mutate the source document', () => {
    seedEntity('A');
    const doc = useDocumentStore.getState().doc;
    const beforeTitle = Object.values(doc.entities)[0]?.title;
    redactDocument(doc);
    const afterTitle = Object.values(doc.entities)[0]?.title;
    expect(afterTitle).toBe(beforeTitle);
  });
});
