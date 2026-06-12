import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TPAssumptionNode as TPAssumptionNodeType } from '@/components/canvas/edges/flow-types';
import { TPAssumptionNode } from '@/components/canvas/nodes/TPAssumptionNode';
import type { Assumption } from '@/domain/types';
import { resetStoreForTest } from '@/store';

/**
 * Export-XSS regression guard.
 *
 * The SVG and vector-PDF exports both snapshot the live canvas by handing the
 * `.react-flow__viewport` DOM to `html-to-image`'s `toSvg` (see
 * `services/exporters/image.ts` `exportSVG` and `services/exporters/pdfExport.ts`
 * `captureCanvasSvg`). `toSvg` wraps a *clone of that DOM* inside an SVG
 * `<foreignObject>`. When the resulting `.svg` is opened in a browser — or the
 * PDF capture is briefly attached to the live document for `svg2pdf` to walk —
 * any LIVE markup in that clone becomes live markup: a `<script>` or an
 * `onerror=` handler would execute. (This is the exact class of bug that bit the
 * sibling MindMap Studio, whose renderer re-injected node text as raw HTML.)
 *
 * TP Studio is safe from it for one structural reason: the canvas renders all
 * user-controlled content as React children (text nodes — escaped) and React
 * style objects (contained to a CSS property). It never injects raw HTML and
 * never renders a user-controlled `href`/`src` on the canvas (the one
 * user-supplied URL — an Evidence citation — lives in the inspector, gated by
 * `isSafeHref`, outside the export's DOM subtree).
 *
 * These two tests lock that invariant: (1) a hostile entity payload rendered on
 * a canvas card stays inert text, and (2) no canvas component ever reaches for
 * `dangerouslySetInnerHTML`. If a future change renders rich HTML on a card, it
 * must sanitise first (DOMPurify, as `MarkdownPreview` does in the inspector)
 * and this guard updated deliberately — not silently bypassed.
 */

vi.mock('@/services/browseLock', () => ({ guardWriteOrToast: vi.fn(() => true) }));

const HOSTILE = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

const rec = (over: Partial<Assumption> = {}): Assumption => ({
  id: 'asm1',
  edgeId: 'e1',
  text: 'safe text',
  status: 'unexamined',
  annotationNumber: 1,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

beforeEach(() => {
  resetStoreForTest();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('canvas export safety', () => {
  it('renders a hostile entity payload as inert text, never live markup', () => {
    const data = { assumption: rec({ text: HOSTILE }) } as TPAssumptionNodeType['data'];
    const { container } = render(
      <TPAssumptionNode {...({ id: 'asm1', data } as unknown as NodeProps<TPAssumptionNodeType>)} />
    );
    // The payload reaches the DOM only as escaped text — no element was parsed
    // out of it, so html-to-image clones inert content into the export SVG.
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain(HOSTILE);
  });

  it('no canvas component uses dangerouslySetInnerHTML (export-clone invariant)', () => {
    const canvasDir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../src/components/canvas'
    );
    const sourceFiles = readdirSync(canvasDir, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      .filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));

    const offenders = sourceFiles.filter((rel) =>
      readFileSync(join(canvasDir, rel), 'utf8').includes('dangerouslySetInnerHTML')
    );
    expect(sourceFiles.length).toBeGreaterThan(0); // guard against a bad path silently passing
    expect(offenders).toEqual([]);
  });
});
