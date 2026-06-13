import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { groupByDiagramType } from '@/components/start/diagramMeta';
import { TemplateGallery } from '@/components/start/TemplateGallery';
import { PATTERNS } from '@/domain/patterns';
import type { DiagramType } from '@/domain/types';
import { resetStoreForTest } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

const item = (id: string, diagramType: DiagramType) => ({ id, diagramType });

/**
 * The Templates page is the core requirement: it must show EVERY entry in the
 * unified library (`PATTERNS` — patterns + folded templates) and stay dynamic —
 * adding a registry entry makes a card appear with zero edits to the gallery.
 * These tests pin that contract via the pure grouping helper (so no
 * import-mocking is needed) plus a render check.
 */
describe('groupByDiagramType', () => {
  it('groups every registry entry, in canonical order, with no empty groups', () => {
    const groups = groupByDiagramType(PATTERNS);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
    expect(groups.flatMap((g) => g.items)).toHaveLength(PATTERNS.length);
    // Canonical method order: goalTree → ec → crt (and the rest follow).
    const order = groups.map((g) => g.type);
    expect(order.indexOf('goalTree')).toBeLessThan(order.indexOf('ec'));
    expect(order.indexOf('ec')).toBeLessThan(order.indexOf('crt'));
  });

  it('is registry-driven: a newly-added entry appears in its group automatically', () => {
    const groups = groupByDiagramType([...PATTERNS, item('throwaway-ec', 'ec')]);
    const ec = groups.find((g) => g.type === 'ec');
    expect(ec?.items.some((i) => i.id === 'throwaway-ec')).toBe(true);
  });

  it('degrades gracefully for an unrecognised diagram type (appended last, never thrown)', () => {
    const groups = groupByDiagramType([...PATTERNS, item('mystery', 'mindmap' as DiagramType)]);
    const last = groups[groups.length - 1];
    expect(last?.type).toBe('mindmap');
    expect(last?.items.some((i) => i.id === 'mystery')).toBe(true);
  });
});

describe('TemplateGallery', () => {
  it('renders exactly one card per registry template', () => {
    const { container } = render(<TemplateGallery />);
    const cards = container.querySelectorAll('button[aria-label^="Open template:"]');
    expect(cards).toHaveLength(PATTERNS.length);
  });

  it('caps each group at limitPerGroup and shows an overflow hint', () => {
    const typeCount = new Set(PATTERNS.map((p) => p.diagramType)).size;
    const { container } = render(<TemplateGallery limitPerGroup={1} />);
    const cards = container.querySelectorAll('button[aria-label^="Open template:"]');
    // One card per diagram-type group → at most one per present type.
    expect(cards.length).toBeLessThanOrEqual(typeCount);
    expect(container.textContent).toMatch(/\+\d+ more/);
  });
});
