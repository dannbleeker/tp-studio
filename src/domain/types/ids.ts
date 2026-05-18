// Session 130 — split from `domain/types.ts`. Pure phantom branded ID
// types + the `Patch<T>` helper. Every other types/* file imports
// these; nothing here imports from elsewhere in the types/ folder.

// Pure phantom branding: at runtime these are plain strings. The brand exists
// to let TypeScript catch "I accidentally passed an edge id where an entity
// id was expected" at compile time. Records remain keyed by plain `string`
// so that Object.keys() and external string IDs from React Flow / file
// pickers don't need casts on the way in — values produced by our factory
// functions narrow on the way out.

/**
 * Brand a primitive with a phantom literal-string tag. One pattern instead
 * of four hand-rolled unique-symbol brands; trivially extensible when a
 * future entity type needs its own id (e.g. `Brand<string, 'WorkspaceId'>`).
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type EntityId = Brand<string, 'EntityId'>;
export type EdgeId = Brand<string, 'EdgeId'>;
export type DocumentId = Brand<string, 'DocumentId'>;
export type GroupId = Brand<string, 'GroupId'>;
/** Session 113 — brand `RevisionId` so accidental cross-mixing with
 *  EntityId / EdgeId is caught at compile time. Revisions are created
 *  by `captureSnapshot` in revisionsSlice; the nanoid string casts
 *  through `Brand<...>` at that single creation site. The 18 read
 *  sites (compare / side-by-side / restore / rename / delete actions
 *  + the test hook) now type-check their revision-id arguments
 *  against the branded type. `AssumptionId` and `InjectionId` are
 *  deliberately NOT branded: assumptions share id-space with
 *  assumption-Entity records during the v6→v7 migration; injections
 *  ARE entities, so they already carry `EntityId`. */
export type RevisionId = Brand<string, 'RevisionId'>;

/**
 * Session 117 — `Patch<T>` for store-action patch parameters.
 *
 * Under `exactOptionalPropertyTypes: true`, `Partial<{ field?: U }>`
 * accepts `{}` and `{ field: U }` but rejects `{ field: undefined }`.
 * Our store actions (`updateEntity`, `updateEdge`, etc.) idiomatically
 * accept `{ field: undefined }` to mean "clear this field" — so the
 * canonical Partial<T> shape under exactOptional doesn't match how
 * callers want to use the actions.
 *
 * `Patch<T>` maps every optional field `field?: U` to `field?: U |
 * undefined`, preserving the "may be omitted" semantics while
 * explicitly allowing "may be explicitly cleared." Required fields are
 * preserved as-is (you can't patch them away).
 *
 * Use anywhere a store action takes a partial mutation of a domain
 * type, e.g. `Patch<Omit<Entity, 'id' | 'createdAt'>>`.
 */
export type Patch<T> = { [K in keyof T]?: T[K] | undefined };
