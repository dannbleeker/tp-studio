import type { Group, TPDocument } from './types';

/**
 * Pure helpers over the `doc.groups` map. None of these mutate; they all
 * derive sets of ids or boolean queries from the snapshot they're given.
 * Layout, collapse / expand, hoist, and cycle detection all consume them.
 */

/** The group (if any) that directly contains `memberId` — entity OR group. */
export const findParentGroup = (doc: TPDocument, memberId: string): Group | undefined => {
  for (const g of Object.values(doc.groups)) {
    if (g.memberIds.includes(memberId)) return g;
  }
  return undefined;
};

/**
 * Ordered ancestor chain: from the direct parent up to the outermost group.
 * Empty when `memberId` is at the root or unknown.
 */
export const ancestorChain = (doc: TPDocument, memberId: string): Group[] => {
  const chain: Group[] = [];
  let cur: string | undefined = memberId;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur)) break; // defensive — should be impossible after cycle guard
    seen.add(cur);
    const parent = findParentGroup(doc, cur);
    if (!parent) break;
    chain.push(parent);
    cur = parent.id;
  }
  return chain;
};

/** Every member id reachable from `groupId`, including nested groups. */
export const descendantIds = (doc: TPDocument, groupId: string): Set<string> => {
  const out = new Set<string>();
  const stack: string[] = [groupId];
  while (stack.length) {
    const cur = stack.pop()!;
    const g = doc.groups[cur];
    if (!g) continue;
    for (const m of g.memberIds) {
      if (out.has(m)) continue;
      out.add(m);
      if (doc.groups[m]) stack.push(m);
    }
  }
  return out;
};

/**
 * Returns true when adding `candidateId` to `groupId`'s memberIds would form
 * a cycle. Cycles can only happen when `candidateId` is itself a group AND
 * its descendant set contains `groupId`, OR `candidateId === groupId`.
 */
export const wouldCreateCycle = (
  doc: TPDocument,
  groupId: string,
  candidateId: string
): boolean => {
  if (groupId === candidateId) return true;
  if (!doc.groups[candidateId]) return false;
  // If groupId is reachable from candidateId, adding candidateId under
  // groupId would close a loop.
  return descendantIds(doc, candidateId).has(groupId);
};

/**
 * For a given doc, returns:
 *  - hiddenEntityIds: every entity inside a transitively-collapsed group
 *  - collapsedRoots: collapsed groups that have no collapsed ancestor
 *  - entityToCollapsedRoot: maps each hidden entity id to the outermost
 *    collapsed group that visually represents it
 *  - hiddenGroupIds: nested groups inside a collapsed ancestor (which
 *    shouldn't render their own rectangle)
 *
 * Used by useGraphView to derive the visible-node set and to remap edges
 * across collapsed boundaries.
 */
export const computeCollapseProjection = (
  doc: TPDocument
): {
  hiddenEntityIds: Set<string>;
  hiddenGroupIds: Set<string>;
  collapsedRoots: Set<string>;
  entityToCollapsedRoot: Map<string, string>;
  groupToCollapsedRoot: Map<string, string>;
} => {
  const hiddenEntityIds = new Set<string>();
  const hiddenGroupIds = new Set<string>();
  const collapsedRoots = new Set<string>();
  const entityToCollapsedRoot = new Map<string, string>();
  const groupToCollapsedRoot = new Map<string, string>();

  for (const g of Object.values(doc.groups)) {
    if (!g.collapsed) continue;
    // Skip groups whose ancestor is already collapsed (they aren't a root).
    const ancestors = ancestorChain(doc, g.id);
    if (ancestors.some((a) => a.collapsed)) continue;
    collapsedRoots.add(g.id);
    const descendants = descendantIds(doc, g.id);
    for (const id of descendants) {
      if (doc.entities[id]) {
        hiddenEntityIds.add(id);
        entityToCollapsedRoot.set(id, g.id);
      } else if (doc.groups[id]) {
        hiddenGroupIds.add(id);
        groupToCollapsedRoot.set(id, g.id);
      }
    }
  }

  return {
    hiddenEntityIds,
    hiddenGroupIds,
    collapsedRoots,
    entityToCollapsedRoot,
    groupToCollapsedRoot,
  };
};

/**
 * Returns the set of entity ids visible when `hoistedGroupId` is hoisted.
 * Empty `null` hoist returns all entity ids. When a group is hoisted, only
 * its transitive entity members are visible (groups nested inside still
 * render their rectangles, collapsed or not).
 */
export const visibleEntityIdsForHoist = (
  doc: TPDocument,
  hoistedGroupId: string | null
): Set<string> => {
  if (!hoistedGroupId) return new Set(Object.keys(doc.entities));
  const visible = new Set<string>();
  for (const id of descendantIds(doc, hoistedGroupId)) {
    if (doc.entities[id]) visible.add(id);
  }
  return visible;
};
