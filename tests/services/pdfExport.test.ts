import {
  computePageCount,
  decodeSvgDataUrl,
  estimateAppendixPages,
  resolvePagePlaceholders,
} from '@/services/pdfExport';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { describe, expect, it } from 'vitest';

/**
 * Session 80 — direct tests of the pdfExport helpers.
 *
 * The full export entry point (`exportToVectorPdf`) drives a heavy DOM /
 * SVG / jsPDF pipeline that's painful to mount in jsdom — covered by the
 * Playwright e2e suite. The pure helpers (data-url decoder, page-count
 * math, placeholder resolution, appendix-page estimator) carry the
 * regression risk that fits a unit test; they're tested directly here.
 */

describe('decodeSvgDataUrl', () => {
  it('decodes percent-encoded SVG payloads', () => {
    const dataUrl =
      'data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%2F%3E';
    expect(decodeSvgDataUrl(dataUrl)).toBe('<svg width="100" height="100"/>');
  });

  it('decodes base64 SVG payloads', () => {
    const svg = '<svg width="100" height="100"/>';
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
    expect(decodeSvgDataUrl(dataUrl)).toBe(svg);
  });

  it('returns the input unchanged when no comma is present', () => {
    expect(decodeSvgDataUrl('not-a-data-url')).toBe('not-a-data-url');
  });
});

describe('computePageCount', () => {
  it('returns 1 for a diagram that fits one page', () => {
    // 800px wide scaled to 186mm usable → 0.2325 mm/px scale →
    // 600px tall ≈ 139.5mm — well under any reasonable page height.
    expect(computePageCount(800, 600, 186, 250)).toBe(1);
  });

  it('paginates when the scaled diagram exceeds page height', () => {
    // 800px wide → 186mm. 4000px tall × 0.2325 = 930mm. Across 250mm
    // pages → ceil(930/250) = 4 pages.
    expect(computePageCount(800, 4000, 186, 250)).toBe(4);
  });

  it('always returns at least 1 page', () => {
    expect(computePageCount(0, 0, 186, 250)).toBe(1);
    expect(computePageCount(-100, 50, 186, 250)).toBe(1);
  });

  it('handles tall narrow diagrams', () => {
    // 200px × 5000px scaled to 186mm width → scale 0.93 → 4650mm tall.
    expect(computePageCount(200, 5000, 186, 250)).toBeGreaterThanOrEqual(18);
  });
});

describe('resolvePagePlaceholders', () => {
  it('substitutes {pageNumber} and {pageCount}', () => {
    expect(resolvePagePlaceholders('Page {pageNumber} of {pageCount}', 2, 5)).toBe('Page 2 of 5');
  });

  it('leaves other text untouched', () => {
    expect(resolvePagePlaceholders('My Title · {pageNumber}', 1, 1)).toBe('My Title · 1');
  });

  it('replaces every occurrence', () => {
    expect(resolvePagePlaceholders('{pageNumber} {pageNumber}', 3, 4)).toBe('3 3');
  });
});

describe('estimateAppendixPages', () => {
  it('returns 0 when no entities have descriptions', () => {
    resetStoreForTest();
    useDocumentStore.getState().addEntity({ type: 'effect', title: 'No desc here' });
    const doc = useDocumentStore.getState().doc;
    expect(estimateAppendixPages(doc, 297, 186)).toBe(0);
  });

  it('returns at least 1 page when entities carry descriptions', () => {
    resetStoreForTest();
    const e = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    useDocumentStore
      .getState()
      .updateEntity(e.id, { description: 'A short description that fits one line.' });
    const doc = useDocumentStore.getState().doc;
    expect(estimateAppendixPages(doc, 297, 186)).toBeGreaterThanOrEqual(1);
  });

  it('grows with the number of described entities', () => {
    resetStoreForTest();
    const longDesc = 'a'.repeat(2000);
    for (let i = 0; i < 30; i++) {
      const e = useDocumentStore.getState().addEntity({ type: 'effect', title: `Entity ${i}` });
      useDocumentStore.getState().updateEntity(e.id, { description: longDesc });
    }
    const doc = useDocumentStore.getState().doc;
    expect(estimateAppendixPages(doc, 297, 186)).toBeGreaterThan(1);
  });
});
