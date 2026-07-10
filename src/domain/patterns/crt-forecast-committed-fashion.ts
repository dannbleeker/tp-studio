import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Forecast-committed fashion (Current Reality Tree).
 *
 * The apparel-industry analysis Goldratt walks through in *The Choice*
 * (2008), abstracted as a CRT: commit a whole season to a long-lead forecast
 * that cannot be accurate at SKU level and both tails bite — the winners
 * sell out mid-season while the rest end on markdown, and the distorted
 * sell-through then trains next season's forecast. The conflict beneath it
 * ships as the forecast-vs-react cloud. Node text is original.
 */
export const buildPatternCRTForecastCommittedFashion = (): TPDocument => {
  const t = Date.now();

  const rcCommit = buildEntity(
    'rootCause',
    'Production is committed to a full-season forecast months before the first sale',
    t,
    1
  );
  const rcUnreliable = buildEntity(
    'rootCause',
    'SKU-level forecasts that far out are inherently unreliable',
    t,
    2
  );
  const effMismatch = buildEntity(
    'effect',
    "Stores receive too much of what won't sell and too little of what does",
    t,
    3
  );
  const udeSellOut = buildEntity(
    'ude',
    'Runners sell out mid-season and those sales are gone',
    t,
    4
  );
  const udeMarkdown = buildEntity('ude', 'Slow movers linger and end the season on markdown', t, 5);
  const udeMargin = buildEntity(
    'ude',
    'Margin bleeds at both ends — missed sales and clearance discounts',
    t,
    6
  );
  const udeDistorted = buildEntity(
    'ude',
    "Distorted sell-through feeds the next season's forecast",
    t,
    7
  );

  const entities = [
    rcCommit,
    rcUnreliable,
    effMismatch,
    udeSellOut,
    udeMarkdown,
    udeMargin,
    udeDistorted,
  ];

  const andMismatch = nanoid(8);
  const andMargin = nanoid(8);

  const edges: Edge[] = [
    // The long-lead commitment AND forecast unreliability jointly produce the mismatch.
    buildEdge(rcCommit.id, effMismatch.id, { andGroupId: andMismatch }),
    buildEdge(rcUnreliable.id, effMismatch.id, { andGroupId: andMismatch }),
    // The mismatch bites at both tails of the assortment.
    buildEdge(effMismatch.id, udeSellOut.id),
    buildEdge(effMismatch.id, udeMarkdown.id),
    // Missed sales AND clearance discounts jointly bleed margin.
    buildEdge(udeSellOut.id, udeMargin.id, { andGroupId: andMargin }),
    buildEdge(udeMarkdown.id, udeMargin.id, { andGroupId: andMargin }),
    // The distorted sell-through feeds forward into next season.
    buildEdge(effMismatch.id, udeDistorted.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Forecast-committed fashion CRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 8,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
