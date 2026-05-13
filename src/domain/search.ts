import type { TPDocument } from './types';

export type Match = {
  /** What kind of object the match lives on. */
  kind: 'entity' | 'edge' | 'group';
  /** The id of that object. */
  id: string;
  /** Which field on the object matched. */
  field: 'title' | 'description' | 'author' | 'label';
  /** A short rendered preview of the matched text. */
  preview: string;
};

export type SearchOptions = {
  /** Match `query` as a regex pattern. Invalid regex returns no matches. */
  regex?: boolean;
  /** Case-sensitive comparison. */
  caseSensitive?: boolean;
  /** Whole-word matching. */
  wholeWord?: boolean;
};

const PREVIEW_MAX = 80;

const buildMatcher = (
  query: string,
  opts: SearchOptions
): { test: (haystack: string) => boolean } | null => {
  if (!query) return null;
  const flags = opts.caseSensitive ? '' : 'i';
  try {
    if (opts.regex) {
      // Detect `/pattern/flags` form for power users; otherwise treat as
      // raw pattern with our flags.
      const slashMatch = /^\/(.+)\/([a-z]*)$/.exec(query);
      const pattern = slashMatch ? slashMatch[1]! : query;
      const userFlags = slashMatch ? slashMatch[2]! : flags;
      const re = new RegExp(pattern, userFlags || flags);
      return { test: (h) => re.test(h) };
    }
    if (opts.wholeWord) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, flags);
      return { test: (h) => re.test(h) };
    }
    const needle = opts.caseSensitive ? query : query.toLowerCase();
    return {
      test: (h) => (opts.caseSensitive ? h : h.toLowerCase()).includes(needle),
    };
  } catch {
    // Invalid regex pattern — caller treats `null` as "no matches".
    return null;
  }
};

const makePreview = (text: string): string => {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= PREVIEW_MAX) return trimmed;
  return `${trimmed.slice(0, PREVIEW_MAX - 1)}…`;
};

/**
 * Pure search over the document. Scope per X-Search-2: entity title +
 * description, group title, edge author (we don't ship edge annotations yet
 * so this slot is reserved for Phase 6). Matches are returned in document
 * order: entities first, then groups, then edges, each in object-key order.
 */
export const findMatches = (doc: TPDocument, query: string, opts: SearchOptions = {}): Match[] => {
  const matcher = buildMatcher(query, opts);
  if (!matcher) return [];
  const out: Match[] = [];

  for (const entity of Object.values(doc.entities)) {
    if (entity.title && matcher.test(entity.title)) {
      out.push({
        kind: 'entity',
        id: entity.id,
        field: 'title',
        preview: makePreview(entity.title),
      });
    }
    if (entity.description && matcher.test(entity.description)) {
      out.push({
        kind: 'entity',
        id: entity.id,
        field: 'description',
        preview: makePreview(entity.description),
      });
    }
  }

  for (const group of Object.values(doc.groups)) {
    if (group.title && matcher.test(group.title)) {
      out.push({
        kind: 'group',
        id: group.id,
        field: 'title',
        preview: makePreview(group.title),
      });
    }
  }

  for (const edge of Object.values(doc.edges)) {
    if (edge.label && matcher.test(edge.label)) {
      out.push({
        kind: 'edge',
        id: edge.id,
        field: 'label',
        preview: makePreview(edge.label),
      });
    }
  }

  return out;
};
