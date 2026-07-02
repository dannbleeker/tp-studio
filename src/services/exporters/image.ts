import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { PNG_PADDING, PNG_PIXEL_RATIO } from '@/domain/constants';
import { SURFACE_DARK, SURFACE_LIGHT } from '@/domain/tokens';
import type { TPDocument } from '@/domain/types';
import { slug, triggerDataUrlDownload } from './shared';

/**
 * html-to-image-backed exports: PNG, JPEG, and SVG. All three share a
 * common pre-flight (locate the React Flow viewport, compute padded bounds,
 * pick a theme-aware background colour) and then call into
 * `html-to-image`'s per-format `toPng` / `toJpeg` / `toSvg`.
 *
 * `html-to-image` is dynamic-imported so the dependency only pays for
 * itself when the user actually exports — initial bundle stays slim.
 */

/**
 * Common pre-flight: locate the React Flow viewport element, compute padded
 * bounds + a fitted viewport transform, and return the geometry + theme-aware
 * background color. Returns null when there's nothing visible (no nodes, no
 * canvas yet) so callers can early-return.
 */
const prepareExport = (
  nodes: Node[]
): {
  flowEl: HTMLElement;
  width: number;
  height: number;
  style: Record<string, string>;
  backgroundColor: string;
} | null => {
  if (nodes.length === 0) return null;
  const flowEl = document.querySelector('.react-flow__viewport') as HTMLElement | null;
  if (!flowEl) return null;
  const bounds = getNodesBounds(nodes);
  const width = bounds.width + PNG_PADDING * 2;
  const height = bounds.height + PNG_PADDING * 2;
  const viewport = getViewportForBounds(bounds, width, height, 0.5, 2, PNG_PADDING);
  const isDark = document.documentElement.classList.contains('dark');
  return {
    flowEl,
    width,
    height,
    backgroundColor: isDark ? SURFACE_DARK : SURFACE_LIGHT,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  };
};

/**
 * Capture the current React Flow viewport as a PNG data URL (no
 * download triggered). Returns `null` when there's nothing to render
 * (no nodes, no canvas mounted).
 *
 * Extracted from `exportPNG` so other exporters (PPTX deck, future
 * shareable image previews) can embed the canvas snapshot without
 * duplicating the prepare-export + html-to-image plumbing.
 */
export const capturePngDataUrl = async (nodes: Node[]): Promise<string | null> => {
  const ctx = prepareExport(nodes);
  if (!ctx) return null;
  // html-to-image is only used by these paths; load it on demand so it
  // doesn't bloat the initial bundle for users who never export.
  const { toPng } = await import('html-to-image');
  return toPng(ctx.flowEl, {
    backgroundColor: ctx.backgroundColor,
    pixelRatio: PNG_PIXEL_RATIO,
    width: ctx.width,
    height: ctx.height,
    style: ctx.style,
  });
};

export const exportPNG = async (doc: TPDocument, nodes: Node[]): Promise<void> => {
  const dataUrl = await capturePngDataUrl(nodes);
  if (!dataUrl) return;
  triggerDataUrlDownload(dataUrl, `${slug(doc.title)}.png`);
};

/** Outcome of {@link copyPngToClipboard}, so the caller can toast appropriately. */
export type CopyPngResult = 'ok' | 'unsupported' | 'empty' | 'denied';

/**
 * Copy the current canvas as a PNG to the system clipboard — the fastest path
 * into a report or slide (copy → click into the doc → paste), skipping the
 * download → find → insert → delete dance of a file export. Reuses the same
 * in-memory PNG capture as `exportPNG`. Returns:
 *   - `'unsupported'` — the async Clipboard image API is missing (older
 *     Firefox/Safari); the caller falls back to a normal PNG download.
 *   - `'empty'` — nothing to capture (no nodes / no canvas mounted).
 *   - `'denied'` — a permission or write error.
 *   - `'ok'` — the image is on the clipboard.
 */
export const copyPngToClipboard = async (nodes: Node[]): Promise<CopyPngResult> => {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.clipboard?.write !== 'function' ||
    typeof ClipboardItem === 'undefined'
  ) {
    return 'unsupported';
  }
  const dataUrl = await capturePngDataUrl(nodes);
  if (!dataUrl) return 'empty';
  try {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return 'ok';
  } catch {
    return 'denied';
  }
};

/**
 * JPEG mirror of `exportPNG`. Quality 0.92 matches the html-to-image
 * default "good but not lossless" sweet spot.
 */
export const exportJPEG = async (doc: TPDocument, nodes: Node[]): Promise<void> => {
  const ctx = prepareExport(nodes);
  if (!ctx) return;
  const { toJpeg } = await import('html-to-image');
  const dataUrl = await toJpeg(ctx.flowEl, {
    backgroundColor: ctx.backgroundColor,
    quality: 0.92,
    pixelRatio: PNG_PIXEL_RATIO,
    width: ctx.width,
    height: ctx.height,
    style: ctx.style,
  });
  triggerDataUrlDownload(dataUrl, `${slug(doc.title)}.jpg`);
};

/**
 * SVG export. Inline SVG keeps it sharp at any zoom level. Browsers can
 * open the file directly; design tools accept it as an import.
 */
export const exportSVG = async (doc: TPDocument, nodes: Node[]): Promise<void> => {
  const ctx = prepareExport(nodes);
  if (!ctx) return;
  const { toSvg } = await import('html-to-image');
  const dataUrl = await toSvg(ctx.flowEl, {
    backgroundColor: ctx.backgroundColor,
    width: ctx.width,
    height: ctx.height,
    style: ctx.style,
  });
  triggerDataUrlDownload(dataUrl, `${slug(doc.title)}.svg`);
};
