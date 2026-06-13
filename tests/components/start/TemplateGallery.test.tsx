import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { groupTemplatesByType } from '@/components/start/diagramMeta';
import { TemplateGallery } from '@/components/start/TemplateGallery';
import type { DiagramType } from '@/domain/types';
import { resetStoreForTest } from '@/store';
import { TEMPLATE_SPECS, type TemplateSpec } from '@/templates';

beforeEach(resetStoreForTest);
afterEach(cleanup);

const fakeSpec = (id: string, diagramType: DiagramType): TemplateSpec => ({
  id,
  title: `Template ${id}`,
  diagramType,
  description: 'A throwaway spec used to prove the gallery is registry-driven.',
  entities: [],
  edges: [],
});

/**
 * The Templates page is the core requirement: it must show EVERY template in
 * the registry and stay dynamic — adding a TemplateSpec module makes a card
 * appear with zero edits to the picker. These tests pin that contract via the
 * pure grouping helper (so no import-mocking is needed) plus a render check.
 */
describe('groupTemplatesByType', () => {
  it('groups every registry template, in canonical order, with no empty groups', () => {
    const groups = groupTemplatesByType(TEMPLATE_SPECS);
    expect(groups.every((g) => g.specs.length > 0)).toBe(true);
    expect(groups.flatMap((g) => g.specs)).toHaveLength(TEMPLATE_SPECS.length);
    // Canonical method order: goalTree → ec → crt (the three types present today).
    const order = groups.map((g) => g.type);
    expect(order.indexOf('goalTree')).toBeLessThan(order.indexOf('ec'));
    expect(order.indexOf('ec')).toBeLessThan(order.indexOf('crt'));
  });

  it('is registry-driven: a newly-added spec appears in its group automatically', () => {
    const groups = groupTemplatesByType([...TEMPLATE_SPECS, fakeSpec('throwaway-ec', 'ec')]);
    const ec = groups.find((g) => g.type === 'ec');
    expect(ec?.specs.some((s) => s.id === 'throwaway-ec')).toBe(true);
  });

  it('degrades gracefully for an unrecognised diagram type (appended last, never thrown)', () => {
    const groups = groupTemplatesByType([
      ...TEMPLATE_SPECS,
      fakeSpec('mystery', 'mindmap' as DiagramType),
    ]);
    const last = groups[groups.length - 1];
    expect(last?.type).toBe('mindmap');
    expect(last?.specs.some((s) => s.id === 'mystery')).toBe(true);
  });
});

describe('TemplateGallery', () => {
  it('renders exactly one card per registry template', () => {
    const { container } = render(<TemplateGallery />);
    const cards = container.querySelectorAll('button[aria-label^="Open template:"]');
    expect(cards).toHaveLength(TEMPLATE_SPECS.length);
  });

  it('caps each group at limitPerGroup and shows an overflow hint', () => {
    const { container } = render(<TemplateGallery limitPerGroup={1} />);
    const cards = container.querySelectorAll('button[aria-label^="Open template:"]');
    // 3 diagram-type groups present today → at most one card each.
    expect(cards.length).toBeLessThanOrEqual(3);
    expect(container.textContent).toMatch(/\+\d+ more/);
  });
});
