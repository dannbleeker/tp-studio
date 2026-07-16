import { displayTitle } from '@/domain/entityPalettes';
import { type InterferenceRankItem, rankInterferences } from '@/domain/interferenceRanking';
import type { TPDocument } from '@/domain/types';
import { csvRow, slug, triggerDownload } from './shared';

/**
 * Interference Diagram → Pareto ranking CSV (Sproull & Nelson, *Epiphanized*,
 * App. 4 Fig. 2). One row per interference, ranked by the time it steals, with
 * its share of the total and the paired intermediate objective — the sheet the
 * book builds to drive the "attack the vital few" conversation.
 *
 * Intentionally lossy, like the other CSV exporters (PRT plan, TT tasks); JSON
 * stays the round-trip format.
 *
 *   - `rank`         1-based position by descending impact
 *   - `interference` the interference's title
 *   - `minutes`      its `id-impact` magnitude (blank when unset)
 *   - `pct_of_total` share of the summed impact, as a whole percent
 *   - `paired_io`    the intermediate objective that removes it ("(none)" if unpaired)
 */

const HEADER = ['rank', 'interference', 'minutes', 'pct_of_total', 'paired_io'] as const;

const pairedIoTitle = (doc: TPDocument, item: InterferenceRankItem): string => {
  if (!item.pairedIoId) return '(none)';
  const io = doc.entities[item.pairedIoId];
  return io ? displayTitle(io) : '(none)';
};

/**
 * Build the interference-ranking CSV text for a document. Exported for tests;
 * the production path uses `exportInterferenceRank(doc)`.
 */
export const buildInterferenceRankCsv = (doc: TPDocument): string => {
  const items = rankInterferences(doc);
  const lines: string[] = [csvRow([...HEADER])];
  items.forEach((item, i) => {
    lines.push(
      csvRow([
        i + 1,
        displayTitle(item.entity),
        // Blank rather than 0 when no estimate was given — "unset" reads
        // differently from "genuinely costs nothing".
        item.minutes > 0 ? item.minutes : '',
        `${Math.round(item.pctOfTotal * 100)}%`,
        pairedIoTitle(doc, item),
      ])
    );
  });
  return `${lines.join('\n')}\n`;
};

/**
 * Trigger a browser download of the interference-ranking CSV. Returns the row
 * count (excluding the header) so the caller can toast how many interferences
 * were exported — matching `exportPrtPlan` / `exportTtTasks`.
 */
export const exportInterferenceRank = (doc: TPDocument): number => {
  const csv = buildInterferenceRankCsv(doc);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}-interferences.csv`);
  return rankInterferences(doc).length;
};
