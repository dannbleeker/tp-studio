import { type Node, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { exportToJSON, importFromJSON } from '../domain/persistence';
import type { TPDocument } from '../domain/types';

const slug = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const triggerDataUrlDownload = (dataUrl: string, filename: string): void => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const exportJSON = (doc: TPDocument): void => {
  const json = exportToJSON(doc);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, `${slug(doc.title)}.tps.json`);
};

export const exportPNG = async (doc: TPDocument, nodes: Node[]): Promise<void> => {
  if (nodes.length === 0) {
    return;
  }
  const flowEl = document.querySelector('.react-flow__viewport') as HTMLElement | null;
  if (!flowEl) return;

  const PIXEL_RATIO = 2;
  const PADDING = 32;
  const bounds = getNodesBounds(nodes);
  const width = bounds.width + PADDING * 2;
  const height = bounds.height + PADDING * 2;
  const viewport = getViewportForBounds(bounds, width, height, 0.5, 2, PADDING);

  const isDark = document.documentElement.classList.contains('dark');
  const bg = isDark ? '#0a0a0a' : '#ffffff';

  const dataUrl = await toPng(flowEl, {
    backgroundColor: bg,
    pixelRatio: PIXEL_RATIO,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });

  triggerDataUrlDownload(dataUrl, `${slug(doc.title)}.png`);
};

export const pickJSON = (): Promise<TPDocument | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        resolve(importFromJSON(text));
      } catch (err) {
        // eslint-disable-next-line no-alert
        window.alert(`Import failed: ${(err as Error).message}`);
        resolve(null);
      }
    };
    input.click();
  });
