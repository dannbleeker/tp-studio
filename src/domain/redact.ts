import type { Assumption, Edge, Entity, Group, TPDocument } from './types';

/**
 * Strip user-supplied text from a document so it can be safely shared outside
 * the organization (A7).
 *
 * **This is an ALLOWLIST, not a denylist.** It used to be the other way round:
 * five named fields were blanked and everything else rode a `...rest` spread
 * through untouched. Every optional field added since — and this model grows one
 * or two most sessions — was therefore leaked by default, silently, by a feature
 * whose entire job is not leaking. The audit found `doc.assumptions[].text` (the
 * core TOC artifact), `entity.owner`, `entity.attributes[].value`,
 * `entity.evidence[].description` / `.url`, `entity.need`,
 * `entity.workingAssumption`, `entity.attestation`, `entity.alternativeMeans`,
 * `doc.systemScope.*` and `doc.comments[].body` all present in a file the export
 * dialog describes as "a structural sample" and the success toast says has had
 * its descriptions and labels stripped.
 *
 * So the rule is now: a field is copied ONLY if it is named below. Adding a
 * free-text field to `Entity` leaks nothing until someone deliberately adds it
 * here — the failure mode of forgetting is over-redaction, which is visible and
 * harmless, rather than under-redaction, which is neither.
 *
 * What survives is structure and non-text state: ids, types, wiring, geometry,
 * annotation numbers, and the closed-vocabulary enums the diagram's shape
 * depends on. Titles become `#N`, group titles become `Group N`, and every
 * free-text or attribution field is dropped outright.
 *
 * The function is pure — it does NOT mutate the input.
 */

/**
 * Entity fields that carry no user prose and are needed to reproduce the
 * diagram's shape. Everything not listed is dropped.
 *
 * `links` / `importedFrom` are deliberately ABSENT: both name other documents
 * (and `importedFrom` snapshots the source entity's title), which is exactly the
 * cross-document context a redacted sample should not carry.
 */
const ENTITY_STRUCTURAL_KEYS = [
  'id',
  'type',
  'annotationNumber',
  'titleSize',
  'collapsed',
  'ordering',
  'position',
  'coreProblem',
  'state',
  'spanOfControl',
  'tier',
  'unspecified',
  'ongoing',
  'ecSlot',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof Entity)[];

/** Edge fields that carry no user prose. `label` and any assumption text go. */
const EDGE_STRUCTURAL_KEYS = [
  'id',
  'sourceId',
  'targetId',
  'kind',
  'andGroupId',
  'andMode',
  'xorGroupId',
  'orGroupId',
  'weight',
  'isBackEdge',
  'isMutualExclusion',
  'delay',
] as const satisfies readonly (keyof Edge)[];

const GROUP_STRUCTURAL_KEYS = [
  'id',
  'memberIds',
  'color',
  'collapsed',
  'archived',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof Group)[];

/** Assumption fields that carry no prose. `text` — the assumption itself — is
 *  the single most sensitive string in a cloud, so the record keeps only its
 *  wiring and its closed-vocabulary tags. */
const ASSUMPTION_STRUCTURAL_KEYS = [
  'id',
  'edgeId',
  'annotationNumber',
  'kind',
  'status',
  'resolved',
  'injectionIds',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof Assumption)[];

/** Copy only the listed keys, skipping any that are absent — so an optional
 *  field stays optional rather than becoming an explicit `undefined`, which
 *  `exactOptionalPropertyTypes` rejects and which would also change the JSON. */
const pick = <T extends object, K extends readonly (keyof T)[]>(
  source: T,
  keys: K
): Pick<T, K[number]> => {
  const out: Partial<T> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out as Pick<T, K[number]>;
};

export const redactDocument = (doc: TPDocument): TPDocument => {
  const entities: Record<string, Entity> = {};
  for (const e of Object.values(doc.entities)) {
    entities[e.id] = {
      ...pick(e, ENTITY_STRUCTURAL_KEYS),
      title: `#${e.annotationNumber}`,
    } as Entity;
  }

  const edges: Record<string, Edge> = {};
  for (const edge of Object.values(doc.edges)) {
    edges[edge.id] = pick(edge, EDGE_STRUCTURAL_KEYS) as Edge;
  }

  const groups: Record<string, Group> = {};
  for (const [i, g] of Object.values(doc.groups).entries()) {
    groups[g.id] = { ...pick(g, GROUP_STRUCTURAL_KEYS), title: `Group ${i + 1}` } as Group;
  }

  const assumptions: Record<string, Assumption> | undefined = doc.assumptions
    ? Object.fromEntries(
        Object.values(doc.assumptions).map((a) => [
          a.id,
          {
            ...pick(a, ASSUMPTION_STRUCTURAL_KEYS),
            text: a.annotationNumber === undefined ? '' : `#${a.annotationNumber}`,
          } as Assumption,
        ])
      )
    : undefined;

  return {
    // Document-level: the same allowlist discipline. `author`, `description`,
    // `systemScope` and `comments` are all free text or attribution and are
    // simply not rebuilt. `customEntityClasses` keeps its ids (entities
    // reference them) but its user-chosen labels are replaced.
    schemaVersion: doc.schemaVersion,
    id: doc.id,
    diagramType: doc.diagramType,
    title: 'Untitled',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    nextAnnotationNumber: doc.nextAnnotationNumber,
    entities,
    edges,
    groups,
    resolvedWarnings: doc.resolvedWarnings,
    ...(assumptions ? { assumptions } : {}),
    ...(doc.layoutConfig ? { layoutConfig: doc.layoutConfig } : {}),
    ...(doc.cloudType ? { cloudType: doc.cloudType } : {}),
    ...(doc.methodChecklist ? { methodChecklist: doc.methodChecklist } : {}),
    ...(doc.locale ? { locale: doc.locale } : {}),
    ...(doc.customEntityClasses
      ? {
          customEntityClasses: Object.fromEntries(
            Object.entries(doc.customEntityClasses).map(([id, cls], i) => [
              id,
              { ...cls, label: `Class ${i + 1}` },
            ])
          ),
        }
      : {}),
  };
};
