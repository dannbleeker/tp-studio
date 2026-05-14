import { redactDocument } from '@/domain/redact';
import { getCanvasNodes } from '@/services/canvasRef';
import {
  exportAnnotationsMd,
  exportAnnotationsTxt,
  exportCSV,
  exportDOT,
  exportFlyingLogic,
  exportHTMLViewer,
  exportJPEG,
  exportJSON,
  exportMermaid,
  exportOPML,
  exportPNG,
  exportReasoningNarrativeMd,
  exportReasoningOutlineMd,
  exportSVG,
  exportVGL,
} from '@/services/exporters';
import { SHARE_LINK_SOFT_WARN_BYTES, generateShareLink } from '@/services/shareLink';
import type { Command } from './types';

export const exportCommands: Command[] = [
  {
    id: 'export-flying-logic',
    label: 'Export as Flying Logic file',
    group: 'Export',
    run: (s) => exportFlyingLogic(s.doc),
  },
  {
    id: 'export-json',
    label: 'Export as JSON',
    group: 'Export',
    run: (s) => exportJSON(s.doc),
  },
  {
    // Session 77 / brief §11 — self-contained HTML viewer. One file,
    // no network, opens in any browser; carries the diagram + verbal
    // form + assumptions read-only and embeds the JSON for round-trip.
    id: 'export-html-viewer',
    label: 'Export as self-contained HTML viewer',
    group: 'Export',
    run: (s) => exportHTMLViewer(s.doc),
  },
  {
    id: 'export-png',
    label: 'Export as PNG (2×)',
    group: 'Export',
    run: async (s) => {
      const nodes = getCanvasNodes();
      await exportPNG(s.doc, nodes);
    },
  },
  {
    id: 'export-json-redacted',
    label: 'Export as JSON (redacted)',
    group: 'Export',
    run: (s) => {
      exportJSON(redactDocument(s.doc));
      s.showToast(
        'info',
        'Exported with titles replaced by #N and descriptions / labels stripped.'
      );
    },
  },
  {
    id: 'export-jpeg',
    label: 'Export as JPEG (2×)',
    group: 'Export',
    run: async (s) => {
      const nodes = getCanvasNodes();
      await exportJPEG(s.doc, nodes);
    },
  },
  {
    id: 'export-svg',
    label: 'Export as SVG',
    group: 'Export',
    run: async (s) => {
      const nodes = getCanvasNodes();
      await exportSVG(s.doc, nodes);
    },
  },
  {
    id: 'export-csv',
    label: 'Export as CSV',
    group: 'Export',
    run: (s) => exportCSV(s.doc),
  },
  {
    id: 'export-annotations-md',
    label: 'Export annotations as Markdown',
    group: 'Export',
    run: (s) => exportAnnotationsMd(s.doc),
  },
  {
    id: 'export-annotations-txt',
    label: 'Export annotations as text',
    group: 'Export',
    run: (s) => exportAnnotationsTxt(s.doc),
  },
  {
    id: 'export-opml',
    label: 'Export as OPML outline',
    group: 'Export',
    run: (s) => exportOPML(s.doc),
  },
  {
    id: 'export-dot',
    label: 'Export as Graphviz DOT',
    group: 'Export',
    run: (s) => exportDOT(s.doc),
  },
  {
    id: 'export-mermaid',
    label: 'Export as Mermaid diagram',
    group: 'Export',
    run: (s) => exportMermaid(s.doc),
  },
  {
    id: 'export-reasoning-narrative',
    label: 'Export reasoning as narrative (Markdown)',
    group: 'Export',
    run: (s) => exportReasoningNarrativeMd(s.doc),
  },
  {
    id: 'export-reasoning-outline',
    label: 'Export reasoning as outline (Markdown)',
    group: 'Export',
    run: (s) => exportReasoningOutlineMd(s.doc),
  },
  {
    id: 'export-vgl',
    label: 'Export as VGL (declarative)',
    group: 'Export',
    run: (s) => exportVGL(s.doc),
  },
  {
    // FL-CO1 — Reader Mode share-link. Compresses the current document
    // into a URL fragment and copies the whole link to the clipboard.
    // The receiver opens it in their browser; App.tsx detects the
    // `#!share=` payload on boot, loads the doc, and auto-engages
    // Browse Lock so the receiver can't accidentally edit it.
    id: 'copy-share-link',
    label: 'Copy read-only share link',
    group: 'Export',
    run: async (s) => {
      try {
        const link = await generateShareLink(s.doc);
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(link);
          const tooLarge = link.length > SHARE_LINK_SOFT_WARN_BYTES;
          s.showToast(
            tooLarge ? 'info' : 'success',
            tooLarge
              ? `Share link copied (${(link.length / 1024).toFixed(1)} KB). Some chat clients may truncate links this large — consider exporting JSON instead.`
              : 'Read-only share link copied to clipboard.'
          );
        } else {
          s.showToast(
            'error',
            "This browser doesn't expose the clipboard API. Use the JSON export to share."
          );
        }
      } catch (err) {
        s.showToast('error', err instanceof Error ? err.message : 'Could not generate share link.');
      }
    },
  },
  {
    id: 'print',
    label: 'Print / Save as PDF…',
    group: 'Export',
    run: (s) => {
      // Session 77 / brief §10 — open the print preview modal so the
      // user can pick mode + appendix + header/footer before handing
      // off to the browser's print dialog.
      s.openPrintPreview();
    },
  },
];
