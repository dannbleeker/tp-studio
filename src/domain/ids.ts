import { nanoid } from 'nanoid';
import type { DocumentId, EdgeId, EntityId, GroupId, RevisionId } from './types';

/**
 * Branded-id factories. `nanoid()` returns a plain `string`; these
 * wrappers brand it at the construction boundary so call sites can name
 * an id by its phantom type instead of casting `nanoid() as EntityId`
 * scattered across the codebase.
 *
 * Centralizing here also lets a future implementation swap propagate
 * everywhere (e.g. switching to UUID v7 for monotonic ordering, or to
 * deterministic test ids when running under Vitest).
 *
 * Session 113 — added `newRevisionId` paired with the `RevisionId`
 * brand. Revisions used `nanoid(10)` directly at four call sites in
 * `revisionsSlice.ts`; the factory keeps that 10-char length and
 * centralizes the cast.
 */

export const newEntityId = (): EntityId => nanoid() as EntityId;
export const newEdgeId = (): EdgeId => nanoid() as EdgeId;
export const newDocumentId = (): DocumentId => nanoid() as DocumentId;
export const newGroupId = (): GroupId => nanoid() as GroupId;
export const newRevisionId = (): RevisionId => nanoid(10) as RevisionId;
