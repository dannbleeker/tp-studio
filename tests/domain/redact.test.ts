import { beforeEach, describe, expect, it } from 'vitest';
import { redactDocument } from '@/domain/redact';
import { resetStoreForTest, useDocumentStore } from '@/store';
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

/**
 * The property that actually matters, expressed once rather than field by field:
 * serialize a document with EVERY free-text field populated with a unique
 * marker, redact it, and assert not one marker survives.
 *
 * Written this way on purpose. The previous implementation was a denylist —
 * five named fields blanked, everything else passed through by `...rest` — so
 * each optional field added since (owner, evidence, attributes, need,
 * workingAssumption, attestation, alternativeMeans, assumption text, comments,
 * systemScope) leaked, and a per-field test suite would only have caught the
 * fields someone remembered to write a test for. This one fails the moment any
 * new prose field reaches the export without being considered.
 */
describe('redactDocument leaks no free text', () => {
  it('drops every user-authored string, not just the five it used to name', () => {
    const { id: aId } = seedEntity('SECRET-title');
    const doc = useDocumentStore.getState().doc;
    const entity = doc.entities[aId];
    if (!entity) throw new Error('seed failed');

    const loaded = {
      ...doc,
      title: 'SECRET-doctitle',
      author: 'SECRET-author',
      description: 'SECRET-docdesc',
      systemScope: { boundary: 'SECRET-boundary', outside: 'SECRET-outside' },
      comments: {
        c1: {
          id: 'c1',
          body: 'SECRET-comment',
          author: 'SECRET-commentauthor',
          createdAt: 1,
          updatedAt: 1,
        },
      },
      customEntityClasses: { cls: { id: 'cls', label: 'SECRET-classlabel' } },
      assumptions: {
        a1: {
          id: 'a1',
          edgeId: 'e1',
          text: 'SECRET-assumption',
          status: 'open',
          source: 'SECRET-assumptionsource',
          annotationNumber: 9,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      entities: {
        [aId]: {
          ...entity,
          description: 'SECRET-desc',
          owner: 'SECRET-owner',
          need: 'SECRET-need',
          workingAssumption: 'SECRET-workingassumption',
          attestation: 'SECRET-attestation',
          alternativeMeans: ['SECRET-altmeans'],
          attributes: { k: { kind: 'text', value: 'SECRET-attrvalue' } },
          evidence: [
            {
              id: 'ev1',
              description: 'SECRET-evidence',
              url: 'https://example.com/SECRET-url',
              source: 'document',
              strength: 'strong',
              validatedBy: 'SECRET-validatedby',
              createdAt: 1,
              updatedAt: 1,
            },
          ],
          importedFrom: { docId: 'd', entityId: 'e', sourceTitle: 'SECRET-sourcetitle' },
        },
      },
    } as unknown as Parameters<typeof redactDocument>[0];

    const serialized = JSON.stringify(redactDocument(loaded));
    expect(serialized).not.toMatch(/SECRET-/);
  });

  it('still preserves the structure a shared sample is for', () => {
    const { a, b, edge } = seedConnectedPair();
    const redacted = redactDocument(useDocumentStore.getState().doc);
    expect(Object.keys(redacted.entities).sort()).toEqual([a.id, b.id].sort());
    const redactedEdge = redacted.edges[edge.id];
    expect(redactedEdge?.sourceId).toBe(a.id);
    expect(redactedEdge?.targetId).toBe(b.id);
    expect(redactedEdge?.kind).toBe(edge.kind);
  });
});
