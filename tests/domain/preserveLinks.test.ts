import { describe, expect, it } from 'vitest';
import { preserveLinks } from '@/domain/preserveLinks';
import type { EntityLink, TPDocument } from '@/domain/types';
import { makeDoc, makeEntity, resetIds } from './helpers';

const link = (docId: string, entityId: string): EntityLink =>
  ({ docId, entityId }) as unknown as EntityLink;

/** Same doc id on both sides — the normal undo-within-a-document case. */
const pair = (
  snapshotLinks: EntityLink[] | undefined,
  liveLinks: EntityLink[] | undefined
): { restored: TPDocument; live: TPDocument } => {
  resetIds();
  const base = makeEntity({ type: 'effect', title: 'A' });
  const restored = makeDoc([snapshotLinks ? { ...base, links: snapshotLinks } : base], [], 'crt');
  const live: TPDocument = {
    ...restored,
    entities: {
      [base.id]: liveLinks ? { ...base, links: liveLinks } : base,
    },
  };
  return { restored, live };
};

describe('preserveLinks', () => {
  it('carries a live link onto a snapshot that predates it', () => {
    const { restored, live } = pair(undefined, [link('doc-b', 'b1')]);
    const out = preserveLinks(restored, live);
    expect(Object.values(out.entities)[0]?.links).toEqual([{ docId: 'doc-b', entityId: 'b1' }]);
  });

  it('drops a snapshot link the live doc no longer has (an explicit unlink stands)', () => {
    const { restored, live } = pair([link('doc-b', 'b1')], undefined);
    const out = preserveLinks(restored, live);
    expect(Object.values(out.entities)[0]?.links).toBeUndefined();
    // The field is dropped entirely, not left as an empty array.
    expect('links' in (Object.values(out.entities)[0] ?? {})).toBe(false);
  });

  it('returns the ORIGINAL object when nothing changed (keeps memo identity)', () => {
    const { restored, live } = pair([link('doc-b', 'b1')], [link('doc-b', 'b1')]);
    expect(preserveLinks(restored, live)).toBe(restored);
  });

  it('leaves a restored doc with a DIFFERENT id untouched (replace-mode undo)', () => {
    const { restored, live } = pair(undefined, [link('doc-b', 'b1')]);
    const otherLive: TPDocument = { ...live, id: 'a-different-doc' as TPDocument['id'] };
    // A replace-mode undo restores a different document entirely — its links are
    // its own, and the live doc's links have nothing to do with it.
    expect(preserveLinks(restored, otherLive)).toBe(restored);
  });

  it('keeps a snapshot-only entity as-is (undoing a delete)', () => {
    resetIds();
    const kept = makeEntity({ type: 'effect', title: 'Kept' });
    const deleted = {
      ...makeEntity({ type: 'effect', title: 'Deleted' }),
      links: [link('d', 'x')],
    };
    const restored = makeDoc([kept, deleted], [], 'crt');
    // The live doc no longer has `deleted` — the entity being restored.
    const live: TPDocument = { ...restored, entities: { [kept.id]: kept } };
    const out = preserveLinks(restored, live);
    expect(out.entities[deleted.id]?.links).toEqual([{ docId: 'd', entityId: 'x' }]);
  });
});
