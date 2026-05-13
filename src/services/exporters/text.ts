import { exportToJSON, importFromJSON } from '@/domain/persistence';
import type { TPDocument } from '@/domain/types';
import { exportAnnotationsMarkdown, exportAnnotationsText } from '../annotationsExport';
import { exportToCsv } from '../csvExport';
import { pickFile } from './picker';
import { slug, triggerDownload } from './shared';

/**
 * Text-format exports: JSON, CSV, and the two annotation flavors (Markdown
 * and plain text). All four share the same pattern — domain-layer function
 * builds a string, this layer wraps it in a `Blob` and triggers a browser
 * download. JSON also gets the import-side `pickJSON` here because the file
 * picker is a thin reverse of the export pipeline (open file → parse).
 */

export const exportJSON = (doc: TPDocument): void => {
  const json = exportToJSON(doc);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, `${slug(doc.title)}.tps.json`);
};

export const exportCSV = (doc: TPDocument): void => {
  const csv = exportToCsv(doc);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}.csv`);
};

export const exportAnnotationsMd = (doc: TPDocument): void => {
  const md = exportAnnotationsMarkdown(doc);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}-annotations.md`);
};

export const exportAnnotationsTxt = (doc: TPDocument): void => {
  const txt = exportAnnotationsText(doc);
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}-annotations.txt`);
};

/**
 * Browser file-picker wrapper for `.tps.json` imports. Resolves with the
 * parsed `TPDocument`, or null when the user cancels / the file fails to
 * parse. The user sees an alert with the parse-error message on failure
 * (cheap UX — the JSON validator's messages are already user-readable).
 */
export const pickJSON = (): Promise<TPDocument | null> =>
  pickFile({
    accept: 'application/json,.json',
    label: 'JSON',
    parse: importFromJSON,
  });
