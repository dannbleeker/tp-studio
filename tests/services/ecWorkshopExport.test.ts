import { buildExampleCRT } from '@/domain/examples/crt';
import { buildExampleEC } from '@/domain/examples/ec';
import { exportECWorkshopSheet } from '@/services/ecWorkshopExport';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Session 87 / EC PPT comparison item #5 — workshop-handout export.
 *
 * The export builds a fixed-layout one-page EC sheet via jspdf and
 * triggers a download. These tests verify the gate-by-diagram-type,
 * the happy-path completes without throwing, and the produced blob
 * is a real (non-empty) PDF byte stream.
 *
 * Doesn't test pixel-level layout — that's a visual artifact best
 * verified by opening the PDF. The structural tests pin the shape
 * of the function so regressions in the gating / blob generation are
 * caught even when the visual layout isn't.
 */

// Stub the DOM download trigger: jspdf produces a real Blob and the
// `triggerDownload` helper would attempt a real browser-level
// download. In jsdom we just want to know the blob came out non-empty.
let lastBlob: Blob | null = null;
let lastFilename: string | null = null;
vi.mock('@/services/exporters/shared', async () => {
  const actual = await vi.importActual<typeof import('@/services/exporters/shared')>(
    '@/services/exporters/shared'
  );
  return {
    ...actual,
    triggerDownload: (blob: Blob, filename: string) => {
      lastBlob = blob;
      lastFilename = filename;
    },
  };
});

afterEach(() => {
  lastBlob = null;
  lastFilename = null;
});

describe('exportECWorkshopSheet', () => {
  it('returns false and produces no blob for non-EC docs', async () => {
    const crt = buildExampleCRT();
    const ok = await exportECWorkshopSheet(crt);
    expect(ok).toBe(false);
    expect(lastBlob).toBeNull();
  });

  it('produces a non-empty PDF blob for an EC doc and saves it with a .pdf name', async () => {
    const ec = buildExampleEC();
    const ok = await exportECWorkshopSheet(ec);
    expect(ok).toBe(true);
    expect(lastBlob).not.toBeNull();
    // jspdf-generated blobs are application/pdf; the byte stream
    // starts with the PDF magic header "%PDF-".
    expect(lastBlob?.type).toMatch(/pdf/);
    expect(lastBlob?.size ?? 0).toBeGreaterThan(500);
    expect(lastFilename).toMatch(/\.pdf$/);
    expect(lastFilename).toMatch(/-workshop\.pdf$/);
  });
});
