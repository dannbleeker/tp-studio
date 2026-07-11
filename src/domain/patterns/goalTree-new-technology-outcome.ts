import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: New technology brings increased outcome (Goal Tree).
 *
 * From Dann Bleeker Pedersen's own MindManager-era technology-value map —
 * his node text, lightly expanded to Goal-Tree statement form (the same
 * own-work carve-out as `goalTree-it-function`; the "no copy-paste from the
 * TOC literature" rule doesn't apply).
 *
 * The map pours Goldratt's technology dictum from *Necessary But Not
 * Sufficient* (2000) into necessity logic: a new technology increases
 * outcome **only if** it diminishes a real limitation (left arm) **and**
 * the system is actually used (right arm). The left arm carries the
 * book's argument — the technology must open opportunities *and* the
 * organization must be able to use them, which decomposes into seeing the
 * limitations, breaking them, and implementing the new rules that exploit
 * the freedom. The right arm is the adoption half every platform team
 * knows: the system works (functions properly + can be adapted) and users
 * adopt it.
 *
 * Two-arm shape like `goalTree-it-function`, so the soft 3–5-CSF scope
 * nudge fires by design. The arms decompose through **nested NCs**
 * (NC → NC necessity edges) — Dettmer's format allows multiple NC layers
 * beneath a CSF.
 */
export const buildPatternGoalTreeNewTechnologyOutcome = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity('goal', 'New technology brings increased outcome', t, 1);

  // Left arm — Goldratt's dictum: the benefit lives in the diminished limitation.
  const csfLimitation = buildEntity(
    'criticalSuccessFactor',
    'The technology diminishes a limitation',
    t,
    2,
    {
      description:
        'Goldratt, Necessary But Not Sufficient: a technology can bring benefits ' +
        'if and only if it diminishes a limitation — and the size of the benefit ' +
        'is capped by how binding that limitation was. Diminishing it is ' +
        'necessary but not sufficient; the conditions beneath are what it takes ' +
        'to actually cash in.',
    }
  );
  const csfUsed = buildEntity('criticalSuccessFactor', 'The system is used', t, 3);

  // Left arm NCs.
  const ncOpportunities = buildEntity(
    'necessaryCondition',
    'The technology opens new technical opportunities',
    t,
    4
  );
  const ncAbility = buildEntity(
    'necessaryCondition',
    'We are able to use the new opportunities',
    t,
    5
  );
  const ncSee = buildEntity('necessaryCondition', 'We see the limitations', t, 6);
  const ncBreak = buildEntity('necessaryCondition', 'We break the limitations', t, 7);
  const ncRules = buildEntity('necessaryCondition', 'We implement new rules', t, 8);

  // Right arm NCs.
  const ncWorks = buildEntity('necessaryCondition', 'The system works', t, 9);
  const ncFunctions = buildEntity('necessaryCondition', 'The platform functions properly', t, 10);
  const ncAdapt = buildEntity('necessaryCondition', 'We are able to adapt the platform', t, 11);
  const ncAdoption = buildEntity('necessaryCondition', 'Users adopt the system', t, 12);

  const entities = [
    goal,
    csfLimitation,
    csfUsed,
    ncOpportunities,
    ncAbility,
    ncSee,
    ncBreak,
    ncRules,
    ncWorks,
    ncFunctions,
    ncAdapt,
    ncAdoption,
  ];
  const edges: Edge[] = [
    // Both arms are each necessary for the goal.
    buildEdge(csfLimitation.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfUsed.id, goal.id, { kind: 'necessity' }),
    // Diminishing a limitation needs the opportunity and the ability to use it.
    buildEdge(ncOpportunities.id, csfLimitation.id, { kind: 'necessity' }),
    buildEdge(ncAbility.id, csfLimitation.id, { kind: 'necessity' }),
    // Using the opportunities: see → break → re-rule (nested NC layer).
    buildEdge(ncSee.id, ncAbility.id, { kind: 'necessity' }),
    buildEdge(ncBreak.id, ncAbility.id, { kind: 'necessity' }),
    buildEdge(ncRules.id, ncAbility.id, { kind: 'necessity' }),
    // A used system works and is adopted.
    buildEdge(ncWorks.id, csfUsed.id, { kind: 'necessity' }),
    buildEdge(ncAdoption.id, csfUsed.id, { kind: 'necessity' }),
    // A working system functions properly and can be adapted (nested NC layer).
    buildEdge(ncFunctions.id, ncWorks.id, { kind: 'necessity' }),
    buildEdge(ncAdapt.id, ncWorks.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'goalTree',
    title: 'New technology brings increased outcome',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 13,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
