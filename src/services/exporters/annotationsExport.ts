import { ENTITY_TYPE_META } from '@/domain/entityTypeMeta';
import type { TPDocument } from '@/domain/types';

/**
 * Annotations-only export (FL-EX6). Lists every entity ordered by its
 * stable annotation number, with its label, type, and description (verbatim
 * — markdown stays as raw markdown in the .md export and is rendered as
 * indented plain text in the .txt export).
 */

type Entry = { n: number; title: string; type: string; description: string };

const collect = (doc: TPDocument): Entry[] =>
  Object.values(doc.entities)
    .map((e) => ({
      n: e.annotationNumber,
      title: e.title.trim() || 'Untitled',
      type: ENTITY_TYPE_META[e.type].label,
      description: e.description?.trim() ?? '',
    }))
    .sort((a, b) => a.n - b.n);

/**
 * Markdown variant — uses the document title as a H1, entity titles as H2
 * with the annotation number prefix, and the description rendered verbatim
 * so the user's own markdown formatting carries through to PDF / web.
 */
export const exportAnnotationsMarkdown = (doc: TPDocument): string => {
  const entries = collect(doc);
  const out: string[] = [];
  out.push(`# ${doc.title.trim() || 'Untitled'}`);
  if (doc.author?.trim()) out.push(`_by ${doc.author.trim()}_`);
  if (doc.description?.trim()) out.push('', doc.description.trim());
  out.push('');
  for (const e of entries) {
    out.push(`## #${e.n} — ${e.title}`);
    out.push(`_${e.type}_`);
    if (e.description) out.push('', e.description);
    out.push('');
  }
  return `${out.join('\n').trimEnd()}\n`;
};

/**
 * Plain-text variant. Indented description below each entity. No markdown
 * dressing; descriptions are dropped in as-is so links / emphasis read as
 * source text.
 */
export const exportAnnotationsText = (doc: TPDocument): string => {
  const entries = collect(doc);
  const out: string[] = [];
  out.push(doc.title.trim() || 'Untitled');
  if (doc.author?.trim()) out.push(`by ${doc.author.trim()}`);
  if (doc.description?.trim()) out.push('', doc.description.trim());
  out.push('');
  for (const e of entries) {
    out.push(`#${e.n} ${e.title} (${e.type})`);
    if (e.description) {
      for (const line of e.description.split(/\r?\n/)) out.push(`    ${line}`);
    }
    out.push('');
  }
  return `${out.join('\n').trimEnd()}\n`;
};
