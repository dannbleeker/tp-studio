import type { EntityType, GroupColor } from '../types';

/**
 * Flying Logic interop — type maps + small parser/serializer helpers.
 *
 * The two `EntityType ↔ FL entityClass` maps live here (rather than in the
 * writer or reader) because both directions need them and re-exporting
 * across writer/reader would be circular. The asymmetry — TS → FL is
 * exhaustive (`Record<EntityType, string>` so a new EntityType compiles
 * loudly), FL → TS accepts multiple aliases for backward-compat with
 * older Flying Logic versions — is intentional.
 *
 * Round-trip contract: every entity type round-trips losslessly. Some FL
 * aliases (e.g. "Cause" → rootCause) are imported but not exported; on a
 * TS → FL → TS round-trip those aliases drop to their canonical form.
 */

export const ENTITY_TYPE_TO_FL: Record<EntityType, string> = {
  ude: 'Undesirable Effect',
  effect: 'Effect',
  rootCause: 'Root Cause',
  injection: 'Injection',
  desiredEffect: 'Desired Effect',
  assumption: 'Assumption',
  // Goal Tree classes (A4) — Flying Logic doesn't predefine matching classes,
  // so we emit them under their natural names. FL imports unknown entity
  // classes as a custom user class without complaint.
  goal: 'Goal',
  criticalSuccessFactor: 'Critical Success Factor',
  necessaryCondition: 'Necessary Condition',
  // PRT (A2). FL has no native obstacle / IO class; we emit under their
  // natural names so a real Flying Logic file just sees user-defined classes.
  obstacle: 'Obstacle',
  intermediateObjective: 'Intermediate Objective',
  // TT (A3). Same shape — FL has no native action class; emit under the
  // natural name, and accept "Action" / "Step" as inbound aliases on import.
  action: 'Action',
  // EC (A1). FL has no native need / want class; emit under the natural
  // names. Position data IS dropped on FL round-trip (FL doesn't store
  // positions either) — re-importing an EC document loses its geometry.
  need: 'Need',
  want: 'Want',
  // FL-ET7. Flying Logic carries a stock "Note" class; emit under that
  // name so round-tripping a note preserves its type.
  note: 'Note',
};

export const FL_TO_ENTITY_TYPE: Record<string, EntityType> = {
  'Undesirable Effect': 'ude',
  UDE: 'ude',
  'Negative Effect': 'ude',
  Effect: 'effect',
  'Intermediate Effect': 'effect',
  'Root Cause': 'rootCause',
  Cause: 'rootCause',
  Injection: 'injection',
  'Desired Effect': 'desiredEffect',
  // FL's user-saved files occasionally use "Desirable Effect" (note the
  // spelling difference — possibly a regional variant or older build).
  // Map to the same TS type as "Desired Effect".
  'Desirable Effect': 'desiredEffect',
  Assumption: 'assumption',
  Goal: 'goal',
  Objective: 'goal',
  'Critical Success Factor': 'criticalSuccessFactor',
  CSF: 'criticalSuccessFactor',
  'Necessary Condition': 'necessaryCondition',
  Obstacle: 'obstacle',
  'Intermediate Objective': 'intermediateObjective',
  IO: 'intermediateObjective',
  Action: 'action',
  Step: 'action',
  Need: 'need',
  Want: 'want',
  // FL stock classes that don't have a structural CLR analogue in TP Studio.
  // Map to `effect` so the entity loads (with its title + edges intact) and
  // the user can re-type it from the inspector if they care to.
  Generic: 'effect',
  Knowledge: 'effect',
  // FL-ET7: Flying Logic's stock "Note" class maps to our new note entity.
  Note: 'note',
};

export const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const VALID_GROUP_COLORS: ReadonlySet<GroupColor> = new Set([
  'slate',
  'indigo',
  'emerald',
  'amber',
  'rose',
  'violet',
]);

/**
 * Best-effort lookup from a Flying Logic `entityClass` attribute to our
 * `EntityType`. Falls back to `'effect'` for unknown FL classes — they're
 * preserved as plain effect nodes rather than failing the entire import.
 */
export const mapEntityType = (flClass: string | null): EntityType => {
  if (!flClass) return 'effect';
  return FL_TO_ENTITY_TYPE[flClass] ?? 'effect';
};

/** Test seam — re-export the entity-type map so tests can assert mappings. */
export const __ENTITY_TYPE_TO_FL_FOR_TEST = ENTITY_TYPE_TO_FL;
