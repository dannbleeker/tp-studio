import { findParentGroup } from '@/domain/groups';
import type { TPDocument } from '@/domain/types';

/**
 * Round-trippable CSV export of the entire document (FL-EX5).
 *
 * Row shape — one CSV per row, `kind` column discriminates:
 *
 * | kind   | id      | type    | title       | source_id | target_id | parent_group_id | and_group_id | annotation_number | description |
 * | ------ | ------- | ------- | ----------- | --------- | --------- | --------------- | ------------ | ----------------- | ----------- |
 * | entity | abc123  | effect  | Foo         |           |           | grp_xyz         |              | 4                 | …           |
 * | edge   | e_999   |         |             | abc123    | def456    |                 | and_abc      |                   |             |
 * | group  | grp_xyz |         | Some group  |           |           | grp_outer       |              |                   |             |
 *
 * The CSV importer (`csvImport.ts`) reads entities + parent_title; this
 * export's `kind=entity` rows are a superset, and entity rows here can be
 * fed back through the importer (it ignores extra columns).
 */

const HEADER = [
  'kind',
  'id',
  'type',
  'title',
  'source_id',
  'target_id',
  'parent_group_id',
  'and_group_id',
  'annotation_number',
  'description',
] as const;

/** RFC 4180-safe escaper: wrap in quotes if the cell has a comma, quote, or newline; double up any embedded quote. */
const csvCell = (raw: string | number | undefined): string => {
  if (raw === undefined || raw === null) return '';
  const s = String(raw);
  if (s.length === 0) return '';
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const row = (cells: (string | number | undefined)[]): string => cells.map(csvCell).join(',');

export const exportToCsv = (doc: TPDocument): string => {
  const lines: string[] = [row([...HEADER])];

  for (const entity of Object.values(doc.entities)) {
    const parentGroup = findParentGroup(doc, entity.id);
    lines.push(
      row([
        'entity',
        entity.id,
        entity.type,
        entity.title,
        '',
        '',
        parentGroup?.id ?? '',
        '',
        entity.annotationNumber,
        entity.description ?? '',
      ])
    );
  }

  for (const edge of Object.values(doc.edges)) {
    lines.push(
      row([
        'edge',
        edge.id,
        '',
        edge.label ?? '',
        edge.sourceId,
        edge.targetId,
        '',
        edge.andGroupId ?? '',
        '',
        '',
      ])
    );
  }

  for (const group of Object.values(doc.groups)) {
    const parentGroup = findParentGroup(doc, group.id);
    lines.push(
      row(['group', group.id, '', group.title, '', '', parentGroup?.id ?? '', '', '', ''])
    );
  }

  return `${lines.join('\n')}\n`;
};
