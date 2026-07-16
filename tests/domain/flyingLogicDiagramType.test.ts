import { describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import { exportToFlyingLogic, importFromFlyingLogic } from '@/domain/flyingLogic';

/**
 * Bug-hunt #5 — the FL writer emits `tp-studio-diagram-type` verbatim, but the
 * reader's KNOWN_DIAGRAMS list omitted `goalTree` and `nbr`, so a round-trip
 * silently reset those docs to CRT (losing the type, palette, and method
 * checklist). The reader now recognises the full diagram-type set.
 */
describe('Flying Logic round-trip preserves the diagram type (bug-hunt #5)', () => {
  for (const dt of [
    'goalTree',
    'nbr',
    'id',
    'crt',
    'frt',
    'prt',
    'tt',
    'ec',
    'st',
    'freeform',
  ] as const) {
    it(`preserves ${dt}`, () => {
      const doc = createDocument(dt);
      const reimported = importFromFlyingLogic(exportToFlyingLogic(doc));
      expect(reimported.diagramType).toBe(dt);
    });
  }
});
