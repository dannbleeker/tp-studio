import type { Node } from '@xyflow/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyPngToClipboard, exportJPEG, exportPNG, exportSVG } from '@/services/exporters/image';
import { makeDoc } from '../domain/helpers';

/**
 * The three image exporters delegate the heavy lifting to `html-to-image`,
 * which is dynamic-imported and exercises real DOM measurement. jsdom
 * can't render React Flow with real geometry, so a full happy-path test
 * isn't feasible.
 *
 * What we CAN verify deterministically:
 *   - The exporter early-returns when there are no nodes (empty graph).
 *   - The exporter early-returns when no `.react-flow__viewport` element
 *     exists in the DOM (canvas not mounted).
 *
 * Both early-returns prevent the dynamic-import of `html-to-image` from
 * firing, which is the safe thing to do in a test environment where the
 * downloaded file can't go anywhere.
 *
 * Session 135 — `fakeDoc` was originally `{ title: 'Test' } as unknown
 * as Parameters<…>[0]` to bypass the full TPDocument shape. Now uses
 * the proper `makeDoc([], [])` builder so the cast is gone and the
 * test reads as a real (empty) TPDocument.
 */

const fakeDoc = makeDoc([], []);

describe('image exporters (early-return paths)', () => {
  it('exportPNG returns without throwing when nodes is empty', async () => {
    await expect(exportPNG(fakeDoc, [])).resolves.toBeUndefined();
  });

  it('exportJPEG returns without throwing when nodes is empty', async () => {
    await expect(exportJPEG(fakeDoc, [])).resolves.toBeUndefined();
  });

  it('exportSVG returns without throwing when nodes is empty', async () => {
    await expect(exportSVG(fakeDoc, [])).resolves.toBeUndefined();
  });

  it('exportPNG returns when the react-flow viewport element is missing', async () => {
    // Non-empty node list but no `.react-flow__viewport` in the DOM —
    // `prepareExport` returns null and the exporter exits early.
    const oneNode = [{ id: 'n', type: 'input', position: { x: 0, y: 0 }, data: {} }] as Node[];
    await expect(exportPNG(fakeDoc, oneNode)).resolves.toBeUndefined();
  });
});

describe('copyPngToClipboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns "unsupported" when the async Clipboard image API is missing', async () => {
    vi.stubGlobal('navigator', {}); // no navigator.clipboard.write
    expect(await copyPngToClipboard([])).toBe('unsupported');
  });

  it('returns "unsupported" when ClipboardItem is undefined (older browsers)', async () => {
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn() } });
    vi.stubGlobal('ClipboardItem', undefined);
    expect(await copyPngToClipboard([])).toBe('unsupported');
  });

  it('returns "empty" (no clipboard write) when there is nothing to capture', async () => {
    const write = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { write } });
    vi.stubGlobal('ClipboardItem', class {});
    // Empty nodes → prepareExport returns null → no capture, no write.
    expect(await copyPngToClipboard([])).toBe('empty');
    expect(write).not.toHaveBeenCalled();
  });
});
