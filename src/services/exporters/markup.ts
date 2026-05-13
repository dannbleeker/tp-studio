import { exportToDot } from '@/domain/dotExport';
import { exportToMermaid } from '@/domain/mermaidExport';
import { importFromMermaid } from '@/domain/mermaidImport';
import { exportToOpml } from '@/domain/opmlExport';
import { exportReasoningNarrative, exportReasoningOutline } from '@/domain/reasoningExport';
import type { TPDocument } from '@/domain/types';
import { exportToVgl } from '@/domain/vglExport';
import { pickFile } from './picker';
import { slug, triggerDownload } from './shared';

/**
 * Markup-format exports (N1 / N2 / N3): OPML for outliners, DOT for
 * Graphviz, Mermaid for everywhere Markdown renders. All three share the
 * same pipeline as `text.ts` — domain layer produces a string, this layer
 * wraps it in a blob and triggers a browser download.
 */

export const exportOPML = (doc: TPDocument): void => {
  const xml = exportToOpml(doc);
  const blob = new Blob([xml], { type: 'text/x-opml;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}.opml`);
};

export const exportDOT = (doc: TPDocument): void => {
  const dot = exportToDot(doc);
  const blob = new Blob([dot], { type: 'text/vnd.graphviz;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}.dot`);
};

export const exportMermaid = (doc: TPDocument): void => {
  const md = exportToMermaid(doc);
  const blob = new Blob([md], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}.mmd`);
};

/**
 * TOC-reading: reasoning exports. Compile the diagram's causal logic
 * into a Markdown document the user can paste into a brief, deck, or
 * postmortem. Two shapes — narrative (sentence per edge in topological
 * order) and outline (terminal effects as headings, causes nested).
 * Both honor the user's global causality reading preference; consumers
 * pass it in via the second argument.
 */
export const exportReasoningNarrativeMd = (doc: TPDocument): void => {
  const md = exportReasoningNarrative(doc);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}-reasoning.md`);
};

export const exportReasoningOutlineMd = (doc: TPDocument): void => {
  const md = exportReasoningOutline(doc);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}-reasoning-outline.md`);
};

/**
 * N5 (Session 64): VGL-like declarative export. Writes a `.vgl` file
 * with the format described in `src/domain/vglExport.ts`. Not a true
 * Flying Logic VGL — see that file's JSDoc for the dialect notes.
 */
export const exportVGL = (doc: TPDocument): void => {
  const vgl = exportToVgl(doc);
  const blob = new Blob([vgl], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}.vgl`);
};

/**
 * N3 (Session 64): Mermaid `graph` IMPORT picker. Reverse of
 * `exportMermaid` from Block D — accepts `.mmd` or `.txt` files and
 * parses them via `importFromMermaid`. Returns the parsed TPDocument
 * or null when the user cancels / parse fails (alert surfaces the
 * error message).
 */
export const pickMermaid = (): Promise<TPDocument | null> =>
  pickFile({
    accept: '.mmd,.txt,text/plain',
    label: 'Mermaid',
    parse: (text) => importFromMermaid(text),
  });
