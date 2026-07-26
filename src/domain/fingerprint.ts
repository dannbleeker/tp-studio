import { edgesArray, entitiesArray, pinnedEntities } from './graph';
import type { TPDocument } from './types';

/**
 * A short string that changes only when something that affects layout or
 * validation changes — entity set, edge set, edge endpoints, AND-grouping,
 * entity types, titles (the validators depend on titles), and hand-positioned
 * coordinates (manual-layout diagrams render off `Entity.position`).
 *
 * Title edits go through this fingerprint too because the clarity / tautology
 * rules read titles. Title-only edits to ONE entity do still change the
 * fingerprint and re-run validation, but that's correct — clarity is
 * per-entity. The win is that pure UI mutations (selection, palette, theme,
 * resolvedWarnings changes) don't churn the layout cache.
 *
 * `Entity.position` is hashed unconditionally even though auto-layout
 * diagrams ignore it at runtime: the cost is one number-pair per entity,
 * and including it keeps the manual-layout branch of `useGraphView`
 * reactive without a parallel fingerprint.
 */
/**
 * Session 135 / Perf #30 — both fingerprints are full O(N log N)
 * sort+stringify passes over every entity & edge, and they're called
 * on every store emission (layout + validator gates). Many store
 * mutations are UI-only (selection, theme, palette) and leave
 * `doc.entities` / `doc.edges` referentially intact, yet the doc
 * reference changes — so without a cache the string was rebuilt for
 * nothing. Caching on the exact input references the function reads
 * means a hit is provably the same string. Old refs GC normally.
 */
const layoutFpCache = new WeakMap<TPDocument['entities'], WeakMap<TPDocument['edges'], string>>();

export const layoutFingerprint = (doc: TPDocument): string => {
  const byEdges = layoutFpCache.get(doc.entities);
  const hit = byEdges?.get(doc.edges);
  if (hit !== undefined) return hit;
  const str = computeLayoutFingerprint(doc);
  if (byEdges) {
    byEdges.set(doc.edges, str);
  } else {
    const m = new WeakMap<TPDocument['edges'], string>();
    m.set(doc.edges, str);
    layoutFpCache.set(doc.entities, m);
  }
  return str;
};

const computeLayoutFingerprint = (doc: TPDocument): string => {
  // Session 76: encode S&T-format state per entity so toggling an
  // injection into / out of the 5-facet card height triggers a
  // relayout. The flag is "any reserved S&T facet attribute is set"
  // — same trigger as `isStNodeFormat` in `graph.ts`. Kept inline
  // rather than imported to avoid a layering cycle (graph.ts already
  // imports from types.ts which is fine, but fingerprint.ts wants
  // to stay leaf-level).
  const stFacetKeys = [
    'stStrategy',
    'stNecessaryAssumption',
    'stParallelAssumption',
    'stSufficiencyAssumption',
  ];
  const entityIds = entitiesArray(doc)
    .map((e) => {
      const hasFacet =
        e.type === 'injection' &&
        e.attributes !== undefined &&
        stFacetKeys.some((k) => e.attributes?.[k] !== undefined);
      // Session 193 — manual sibling ordering feeds the layout's post-dagre
      // reorder pass, so a change to it must invalidate the layout cache.
      const ord = typeof e.ordering === 'number' ? `:o${e.ordering}` : '';
      return `${e.id}${hasFacet ? ':st' : ''}${ord}`;
    })
    .sort();
  const edgeKeys = edgesArray(doc)
    .map(
      (e) =>
        `${e.id}:${e.sourceId}>${e.targetId}:${e.andGroupId ?? ''}:${e.orGroupId ?? ''}:${e.xorGroupId ?? ''}`
    )
    .sort();
  const positions = pinnedEntities(doc)
    .map((e) => `${e.id}@${e.position?.x},${e.position?.y}`)
    .sort();
  return `${entityIds.join(',')}|${edgeKeys.join(',')}|${positions.join(',')}`;
};

/**
 * Session 135 / Perf #5 — used by the validator cache in
 * `validators/index.ts` to short-circuit re-runs when a mutation
 * didn't change any input the rules actually read. Must include
 * every entity / edge field any rule reads; an omission would
 * silently return stale warnings on a fingerprint hit.
 *
 * Currently encoded:
 *   - diagram type
 *   - per-entity: id, type, title, unspecified, spanOfControl,
 *     ecSlot, S&T facet presence (via the `:st` suffix used by
 *     `layoutFingerprint` so toggling a facet attribute counts),
 *     and `state` (the FRT/NBR entry-point rule treats an entry point
 *     asserted `true` in current reality as legitimate — Session 199 A2)
 *   - per-edge: id, source, target, andGroupId, weight, isBackEdge,
 *     delay (the loop-polarity + reinforcing-no-delay rules read these)
 *   - the assumption→edge mapping (`record.edgeId` for every
 *     `doc.assumptions` record) — the EC "≥1 assumption per arrow" rule
 *     counts assumptions per edge, so add / remove / re-home must re-validate
 *   - resolved-warning ids (so "resolve" / "un-resolve" flips
 *     re-validate)
 *   - the custom-class supersetOf mapping (`id>supersetOf` per
 *     `doc.customEntityClasses` entry) — every `isOfBuiltin`-aware rule
 *     (predicted-effect-existence, additional-cause, the NBR shape rules)
 *     re-classifies entities when a class's supersetOf changes, with no
 *     entity/edge mutation involved
 *
 * NOT encoded (mutating these is free):
 *   - position, attestation, owner, lastValidatedAt, evidence,
 *     description, attributes other than S&T facets, collapsed,
 *     titleSize, ordering, edge labels /
 *     descriptions / loopName / loopNarrative, OR/XOR group ids, group
 *     memberships, assumption text / status / kind, custom-class
 *     label / color / hint (only `supersetOf` feeds a rule).
 *
 * `annotationNumber` used to be on that "free" list, and it isn't: three rules
 * read it to pick a warning's anchor or break a tie (`ecMissingConflict`,
 * `goalTreeMultipleGoals`, `coreDriver`). No writer moves it without also
 * changing the title or type, so there was no live trigger — but encoding it
 * costs one token and removes the need to keep re-deriving that argument.
 *
 * Note: a future rule that reads any of the "free" fields needs to
 * either add the field here or invalidate the cache another way.
 */
const ST_FACET_FINGERPRINT_KEYS: readonly string[] = [
  'stStrategy',
  'stNecessaryAssumption',
  'stParallelAssumption',
  'stSufficiencyAssumption',
];

// Perf #30 — keyed on (entities, edges, resolvedWarnings, assumptions,
// customEntityClasses) references. `diagramType` is a primitive and can't be a
// WeakMap key, so it's stored beside the string and re-checked on a hit (it
// changes only at document creation/load, which also changes the other refs —
// the check is belt-and-suspenders). `doc.assumptions` is in the key because
// adding an assumption changes ONLY that map (not `doc.edges`) post
// record-canonical, yet the EC completeness rule reads per-edge assumption
// counts. `doc.customEntityClasses` is in the key for the same reason: editing
// a class's `supersetOf` re-classifies entities for the `isOfBuiltin`-aware
// rules without touching any other map.
const EMPTY_ASSUMPTIONS_FP = Object.freeze({}) as NonNullable<TPDocument['assumptions']>;
const EMPTY_CLASSES_FP = Object.freeze({}) as NonNullable<TPDocument['customEntityClasses']>;

const validationFpCache = new WeakMap<
  TPDocument['entities'],
  WeakMap<
    TPDocument['edges'],
    WeakMap<
      TPDocument['resolvedWarnings'],
      WeakMap<
        NonNullable<TPDocument['assumptions']>,
        WeakMap<
          NonNullable<TPDocument['customEntityClasses']>,
          { dt: string; nc: string; str: string }
        >
      >
    >
  >
>();

export const validationFingerprint = (doc: TPDocument): string => {
  const assumptionsKey = doc.assumptions ?? EMPTY_ASSUMPTIONS_FP;
  const classesKey = doc.customEntityClasses ?? EMPTY_CLASSES_FP;
  let byEdges = validationFpCache.get(doc.entities);
  let byResolved = byEdges?.get(doc.edges);
  let byAssumptions = byResolved?.get(doc.resolvedWarnings);
  let byClasses = byAssumptions?.get(assumptionsKey);
  const hit = byClasses?.get(classesKey);
  // `diagramType` + `ncDepthMode` are primitives (can't key a WeakMap), so they
  // live beside the string and are re-checked on a hit — a mode toggle leaves the
  // entities/edges refs intact, so without this the goalTree-nc-depth rule would
  // serve stale warnings (Session 199 A4).
  if (hit && hit.dt === doc.diagramType && hit.nc === (doc.ncDepthMode ?? '')) return hit.str;

  const str = computeValidationFingerprint(doc);
  if (!byEdges) {
    byEdges = new WeakMap();
    validationFpCache.set(doc.entities, byEdges);
  }
  if (!byResolved) {
    byResolved = new WeakMap();
    byEdges.set(doc.edges, byResolved);
  }
  if (!byAssumptions) {
    byAssumptions = new WeakMap();
    byResolved.set(doc.resolvedWarnings, byAssumptions);
  }
  if (!byClasses) {
    byClasses = new WeakMap();
    byAssumptions.set(assumptionsKey, byClasses);
  }
  byClasses.set(classesKey, { dt: doc.diagramType, nc: doc.ncDepthMode ?? '', str });
  return str;
};

const computeValidationFingerprint = (doc: TPDocument): string => {
  const entitySig = entitiesArray(doc)
    .map((e) => {
      const u = e.unspecified === true ? 'u' : '';
      const s = e.spanOfControl ? `:${e.spanOfControl[0]}` : '';
      const slot = e.ecSlot ? `:${e.ecSlot}` : '';
      // Encode each S&T facet's FILLED state (not just "has any"): the
      // st-tactic-assumptions rule counts how many of the three assumption
      // facets are non-empty, so a 1-facet vs 2-facet vs 3-facet tactic must
      // yield distinct fingerprints (a single `:st` bit collapsed them all →
      // stale cache). "Filled" matches the rule: a string attr counts only when
      // non-blank; a non-string attr counts when present.
      const st =
        e.type === 'injection' && e.attributes !== undefined
          ? `:st${ST_FACET_FINGERPRINT_KEYS.map((k) => {
              const a = e.attributes?.[k];
              if (!a) return '0';
              return a.kind === 'string' ? (a.value.trim() !== '' ? '1' : '0') : '1';
            }).join('')}`
          : '';
      // Session 199 (backlog A2) — the entry-point rule reads `state` (an entry
      // point asserted `true` in current reality is legitimate), so a state
      // toggle must invalidate the cache or the warning goes stale on a hit.
      const state = e.state ? `:@${e.state}` : '';
      // `title` goes through JSON.stringify, every other segment is a closed
      // vocabulary. Interpolated raw, a title containing `:` and `|` forged
      // extra records: `{n1: "A", n2: "B"}` and `{n1: "A:|n2:ude:B"}` produced
      // the SAME fingerprint. The LRU is module-global and shared across tabs
      // and saved docs (`useSavedTrees` validates every tree in the library), so
      // that collision returned one document's warnings for another — pointing
      // at entity ids the second document doesn't contain. JSON string encoding
      // is injective and its delimiters are unambiguous, so the whole record is.
      return `${e.id}:${e.type}:${JSON.stringify(e.title)}:${e.annotationNumber}:${u}${s}${slot}${st}${state}`;
    })
    .sort()
    .join('|');
  const edgeSig = edgesArray(doc)
    // weight + isBackEdge feed the loop-polarity rule; delay feeds the
    // reinforcing-no-delay rule (Theme A / A4); kind (sufficiency vs necessity)
    // feeds logic-type-mismatch / long-arrow / cause-sufficiency; and
    // isMutualExclusion feeds the EC missing-conflict + completeness rules — so
    // toggling any of them must re-run validation rather than hit a stale
    // fingerprint (Session 191 — kind + isMutualExclusion were missing).
    // ALL THREE junctor group ids are encoded: indirect-effect + cause-
    // sufficiency now exempt any junctor (not just AND), so toggling an OR / XOR
    // group must invalidate the cache too (Session 192 — or/xorGroupId were
    // missing, silently defeating the junctor-aware exemption on cache hits).
    .map(
      (e) =>
        `${e.id}:${e.sourceId}>${e.targetId}:${e.andGroupId ?? ''}:${e.orGroupId ?? ''}:${e.xorGroupId ?? ''}:${e.weight ?? ''}:${e.isBackEdge ? 'b' : ''}:${e.delay ? 'd' : ''}:${e.kind}:${e.isMutualExclusion ? 'm' : ''}`
    )
    .sort()
    .join('|');
  const resolvedSig = Object.keys(doc.resolvedWarnings).sort().join(',');
  // The assumption→edge mapping (multiset of host edge ids) — captures per-edge
  // assumption counts for the EC completeness rule. Text/status/kind are NOT
  // encoded (no rule reads them).
  const assumptionSig = Object.values(doc.assumptions ?? {})
    .map((a) => a.edgeId)
    .sort()
    .join(',');
  // The custom-class supersetOf mapping — the only class field any rule reads
  // (via `isOfBuiltin`). Label / color / hint edits stay fingerprint-free.
  const classesSig = Object.values(doc.customEntityClasses ?? {})
    .map((c) => `${c.id}>${c.supersetOf ?? ''}`)
    .sort()
    .join(',');
  // `ncDepthMode` (A4) is a doc-level field the goalTree-nc-depth rule reads.
  return `${doc.diagramType}:${doc.ncDepthMode ?? ''}|${entitySig}|${edgeSig}|${resolvedSig}|${assumptionSig}|${classesSig}`;
};
