import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintPreviewDialog } from '@/components/print/PrintPreviewDialog';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

/**
 * Session 193 — the non-Latin-1 caution the Print / Save-as-PDF dialog shows
 * when the document's text carries characters jsPDF's built-in Latin-1 fonts
 * can't render. Scoped to the vector-PDF path; browser print is unaffected.
 */

// The canvas ref returns [] in jsdom — the dialog only reads it inside the
// PDF handler, which these tests don't invoke, but stub it for safety.
vi.mock('@/services/canvasRef', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/canvasRef')>('@/services/canvasRef');
  return { ...actual, getCanvasNodes: vi.fn(() => []) };
});

const openPrint = (): void => {
  act(() => useDocumentStore.getState().openPrintPreview());
};

beforeEach(() => {
  resetStoreForTest();
  vi.clearAllMocks();
});
afterEach(cleanup);

const CAUTION = /outside the Latin-1 range/i;

describe('PrintPreviewDialog — non-Latin-1 caution', () => {
  it('renders nothing when the dialog is closed', () => {
    const { container } = render(<PrintPreviewDialog />);
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('omits the caution for an all-ASCII document', () => {
    seedEntity('Reduce lead time', 'effect');
    openPrint();
    const { container } = render(<PrintPreviewDialog />);
    expect(container.textContent).not.toMatch(CAUTION);
  });

  it('omits the caution for Latin-1 accents (café résumé naïve)', () => {
    // é (0xE9), ï (0xEF) all sit inside Latin-1, so no warning.
    seedEntity('Café résumé naïve', 'effect');
    openPrint();
    const { container } = render(<PrintPreviewDialog />);
    expect(container.textContent).not.toMatch(CAUTION);
  });

  it('shows the caution for an em dash (U+2014, just outside Latin-1)', () => {
    seedEntity('Lead time — cut in half', 'effect');
    openPrint();
    const { container } = render(<PrintPreviewDialog />);
    expect(container.textContent).toMatch(CAUTION);
  });

  it('shows the caution when an entity title uses a non-Latin script', () => {
    seedEntity('Цель проекта', 'effect'); // Cyrillic
    openPrint();
    const { container } = render(<PrintPreviewDialog />);
    expect(container.textContent).toMatch(CAUTION);
  });

  it('shows the caution when a description uses a non-Latin script', () => {
    const e = seedEntity('Plain title', 'effect');
    act(() => useDocumentStore.getState().updateEntity(e.id, { description: '目標を達成する' }));
    openPrint();
    const { container } = render(<PrintPreviewDialog />);
    expect(container.textContent).toMatch(CAUTION);
  });
});
