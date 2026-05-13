import { exportJPEG, exportPNG, exportSVG } from '@/services/exporters/image';
import type { Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

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
 */

const fakeDoc = { title: 'Test' } as unknown as Parameters<typeof exportPNG>[0];

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
