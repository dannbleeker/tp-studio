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
  // Record-canonical: an assumption isn't an entity type any more (it's an edge
  // annotation). An imported FL "Assumption" node becomes a `note` so its text is
  // preserved on the canvas; the user can re-attach it to an edge via the
  // Assumption Well if they want it as a first-class assumption.
  Assumption: 'note',
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

export /**
 * Characters XML 1.0 forbids OUTRIGHT — they cannot be escaped, numerically or
 * otherwise, so a file containing one simply fails to open. `\t`, `\n` and `\r`
 * are the three C0 codes that ARE legal and are kept.
 *
 * The entry point is real: `validateEntity` only type-checks titles, and CSV
 * import trims whitespace, which does not remove `\x01`. So a title pasted from
 * a badly-encoded source produced an export nothing could read.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching the illegal control characters is the point
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export const escapeXml = (s: string): string =>
  s
    .replace(XML_ILLEGAL, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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
  // Session 206 fix — a bare index reaches Object.prototype, so an FL file with
  // `entityClass="toString"` (or "constructor" / "valueOf" / "hasOwnProperty" …)
  // resolved to the INHERITED function. `??` only guards null/undefined, so that
  // function sailed through as the entity's `type` — a Function where an
  // EntityType belongs, from a merely odd input file. TypeScript can't catch it:
  // `Record<string, EntityType>` claims the index is an EntityType. `Object.hasOwn`
  // restricts the lookup to real mappings, so anything else falls back as intended.
  return Object.hasOwn(FL_TO_ENTITY_TYPE, flClass)
    ? (FL_TO_ENTITY_TYPE[flClass] ?? 'effect')
    : 'effect';
};

// Session 94 added `__ENTITY_TYPE_TO_FL_FOR_TEST` as a test-mode alias
// for `ENTITY_TYPE_TO_FL`, anticipating tests that would assert
// individual mappings. Two years later no test uses it. Session 112
// knip pass removed both the alias and its re-export from `./index`;
// tests can import `ENTITY_TYPE_TO_FL` directly if they want the map.
