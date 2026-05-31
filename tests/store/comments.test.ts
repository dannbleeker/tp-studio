import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

/**
 * Review-comment store actions. Comments live in `doc.comments`, mutate via
 * `applyDocChange` (undoable + persisted), and are pruned when their anchored
 * entity/edge is deleted.
 */
beforeEach(resetStoreForTest);
const s = () => useDocumentStore.getState();

describe('comments store — CRUD', () => {
  it('adds a comment, trims the body, and stamps the author from prefs', () => {
    s().setCommentAuthorName('Dann');
    const e = seedEntity('A');
    const c = s().addComment({ kind: 'entity', entityId: e.id }, '  needs work  ');
    if (!c) throw new Error('addComment returned null');
    expect(c.body).toBe('needs work');
    expect(c.author).toBe('Dann');
    expect(s().doc.comments?.[c.id]).toBeDefined();
  });

  it('returns null on an empty body', () => {
    expect(s().addComment({ kind: 'document' }, '   ')).toBeNull();
  });

  it('replies share the parent anchor and stay one level deep', () => {
    const e = seedEntity('A');
    const top = s().addComment({ kind: 'entity', entityId: e.id }, 'top');
    if (!top) throw new Error('addComment failed');
    const reply = s().replyToComment(top.id, 'reply');
    if (!reply) throw new Error('replyToComment failed');
    expect(reply.parentId).toBe(top.id);
    expect(reply.anchor).toEqual(top.anchor);
    // Reply-to-a-reply re-targets the top-level comment.
    const nested = s().replyToComment(reply.id, 'nested');
    expect(nested?.parentId).toBe(top.id);
  });

  it('edits a comment body', () => {
    const c = s().addComment({ kind: 'document' }, 'a');
    if (!c) throw new Error('addComment failed');
    s().editComment(c.id, 'b');
    expect(s().doc.comments?.[c.id]?.body).toBe('b');
  });

  it('deleting a top-level comment removes its replies', () => {
    const c = s().addComment({ kind: 'document' }, 'top');
    if (!c) throw new Error('addComment failed');
    const r = s().replyToComment(c.id, 'reply');
    if (!r) throw new Error('replyToComment failed');
    s().deleteComment(c.id);
    expect(s().doc.comments?.[c.id]).toBeUndefined();
    expect(s().doc.comments?.[r.id]).toBeUndefined();
  });

  it('resolves + re-opens a thread (flag on the top-level comment)', () => {
    const c = s().addComment({ kind: 'document' }, 'top');
    if (!c) throw new Error('addComment failed');
    s().resolveComment(c.id, true);
    expect(s().doc.comments?.[c.id]?.resolved).toBe(true);
    s().resolveComment(c.id, false);
    expect(s().doc.comments?.[c.id]?.resolved).toBeUndefined();
  });

  it('is undoable', () => {
    const c = s().addComment({ kind: 'document' }, 'top');
    if (!c) throw new Error('addComment failed');
    s().undo();
    expect(s().doc.comments?.[c.id]).toBeUndefined();
  });
});

describe('comments store — prune on delete', () => {
  it('drops a comment when its anchored entity is deleted', () => {
    const e = seedEntity('A');
    const c = s().addComment({ kind: 'entity', entityId: e.id }, 'x');
    if (!c) throw new Error('addComment failed');
    s().deleteEntity(e.id);
    expect(s().doc.comments?.[c.id]).toBeUndefined();
  });

  it('drops a comment when its anchored edge is deleted', () => {
    const { edge } = seedConnectedPair();
    const c = s().addComment({ kind: 'edge', edgeId: edge.id }, 'x');
    if (!c) throw new Error('addComment failed');
    s().deleteEdge(edge.id);
    expect(s().doc.comments?.[c.id]).toBeUndefined();
  });

  it('keeps a document-anchored comment when an entity is deleted', () => {
    const e = seedEntity('A');
    const c = s().addComment({ kind: 'document' }, 'general');
    if (!c) throw new Error('addComment failed');
    s().deleteEntity(e.id);
    expect(s().doc.comments?.[c.id]).toBeDefined();
  });
});
