import { describe, expect, it } from 'vitest';
import { printLegendFor } from '@/domain/printLegend';
import { EDGE_KIND_COACHING, ENTITY_TYPE_COACHING } from '@/domain/readerModeCoaching';
import type { DiagramType, EdgeKind, EntityType } from '@/domain/types';

/**
 * Session 180 / E6 — Reader mode coaching registry smoke tests.
 *
 * Goals:
 *   1. All 15 EntityType values have a coaching entry with non-empty
 *      label + tip (guarantees no hover tooltip is silently blank).
 *   2. Both EdgeKind values have a coaching entry.
 *   3. printLegendFor returns non-empty for every structured diagram
 *      type; '' for freeform (used by ReaderModeBanner).
 */

// The canonical 15 entity types from src/domain/types/entity.ts.
const ALL_ENTITY_TYPES: EntityType[] = [
  'ude',
  'effect',
  'rootCause',
  'injection',
  'desiredEffect',
  'assumption',
  'goal',
  'criticalSuccessFactor',
  'necessaryCondition',
  'obstacle',
  'intermediateObjective',
  'action',
  'need',
  'want',
  'note',
];

const ALL_EDGE_KINDS: EdgeKind[] = ['sufficiency', 'necessity'];

const STRUCTURED_DIAGRAM_TYPES: DiagramType[] = [
  'crt',
  'frt',
  'prt',
  'tt',
  'ec',
  'goalTree',
  'st',
  'nbr',
];

describe('ENTITY_TYPE_COACHING', () => {
  it('has an entry for every EntityType (15 total)', () => {
    for (const type of ALL_ENTITY_TYPES) {
      const entry = ENTITY_TYPE_COACHING[type];
      expect(entry, `Missing coaching entry for EntityType "${type}"`).toBeDefined();
      expect(entry.label.trim().length, `Empty label for EntityType "${type}"`).toBeGreaterThan(0);
      expect(entry.tip.trim().length, `Empty tip for EntityType "${type}"`).toBeGreaterThan(0);
    }
  });

  it('labels are title-case short names (not sentence fragments)', () => {
    for (const type of ALL_ENTITY_TYPES) {
      const { label } = ENTITY_TYPE_COACHING[type];
      // Should not end with a full stop (that's what tips do)
      expect(label, `Label for "${type}" should not end with "."`).not.toMatch(/\.$/);
      // Should not exceed 60 chars (tooltip header must fit)
      expect(label.length, `Label for "${type}" is too long`).toBeLessThanOrEqual(60);
    }
  });

  it('tips are non-trivial prose (at least 30 characters)', () => {
    for (const type of ALL_ENTITY_TYPES) {
      const { tip } = ENTITY_TYPE_COACHING[type];
      expect(tip.length, `Tip for "${type}" is too short`).toBeGreaterThan(30);
    }
  });
});

describe('EDGE_KIND_COACHING', () => {
  it('has an entry for both EdgeKind values', () => {
    for (const kind of ALL_EDGE_KINDS) {
      const entry = EDGE_KIND_COACHING[kind];
      expect(entry, `Missing coaching entry for EdgeKind "${kind}"`).toBeDefined();
      expect(entry.label.trim().length, `Empty label for EdgeKind "${kind}"`).toBeGreaterThan(0);
      expect(entry.tip.trim().length, `Empty tip for EdgeKind "${kind}"`).toBeGreaterThan(0);
    }
  });

  it('sufficiency tip contains reading instruction', () => {
    expect(EDGE_KIND_COACHING.sufficiency.tip).toMatch(/If.*then/i);
  });

  it('necessity tip contains reading instruction', () => {
    expect(EDGE_KIND_COACHING.necessity.tip).toMatch(/In order to/i);
  });
});

describe('ReaderModeBanner — printLegendFor integration', () => {
  it('returns non-empty for every structured diagram type', () => {
    for (const t of STRUCTURED_DIAGRAM_TYPES) {
      const legend = printLegendFor(t);
      expect(legend, `printLegendFor("${t}") should be non-empty`).not.toBe('');
      expect(legend.trim().length).toBeGreaterThan(10);
    }
  });

  it('returns empty string for freeform (banner renders nothing)', () => {
    expect(printLegendFor('freeform')).toBe('');
  });
});
