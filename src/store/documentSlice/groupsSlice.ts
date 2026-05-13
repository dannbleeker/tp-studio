import { createGroup } from '@/domain/factory';
import { wouldCreateCycle } from '@/domain/groups';
import type { EntityId, Group, GroupColor } from '@/domain/types';
import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import { makeApplyDocChange, touch } from './docMutate';

/**
 * Group-level mutations: create/delete/rename/recolor, member add/remove,
 * collapse toggle. The cycle-prevention helper (`wouldCreateCycle`) is
 * imported from `@/domain/groups` and used by `addToGroup`; the slice
 * itself stays purely the orchestration layer.
 */
export type GroupsSlice = {
  createGroupFromSelection: (
    memberIds: string[],
    params?: { title?: string; color?: GroupColor }
  ) => Group | null;
  deleteGroup: (id: string) => void;
  renameGroup: (id: string, title: string) => void;
  recolorGroup: (id: string, color: GroupColor) => void;
  addToGroup: (groupId: string, memberId: string) => void;
  removeFromGroup: (groupId: string, memberId: string) => void;
  toggleGroupCollapsed: (id: string) => void;
};

export const createGroupsSlice: StateCreator<RootStore, [], [], GroupsSlice> = (set, get) => {
  const applyDocChange = makeApplyDocChange(get, set);

  return {
    // Create a group from a multi-selection. Members can be entity IDs or
    // existing group IDs (nested groups). Returns null when nothing valid is
    // passed in. Members that already belong to a group are NOT auto-detached
    // here — the caller decides whether to flatten first. (Most flows pass
    // the current entity selection which is naturally non-overlapping.)
    createGroupFromSelection: (memberIds, params = {}) => {
      const doc = get().doc;
      const valid = memberIds.filter((id) => Boolean(doc.entities[id]) || Boolean(doc.groups[id]));
      if (valid.length === 0) return null;
      const group = createGroup({ ...params, memberIds: valid });
      applyDocChange((prev) =>
        touch({
          ...prev,
          groups: { ...prev.groups, [group.id]: group },
        })
      );
      // `valid` is a `string[]` (it can mix entity ids and nested-group
      // ids); the selection bucket carries branded EntityIds. Same
      // "groups travel via the entities bucket" rationale as
      // TPGroupNode — cast at this single boundary.
      set({ selection: { kind: 'entities', ids: valid as EntityId[] } });
      return group;
    },

    // Delete a group: the group record goes away, members are NOT deleted.
    // FL-GR5: when the deleted group was nested inside a parent, its members
    // are promoted up one level (the parent's `memberIds` swaps the deleted
    // group out and the children in, in the same slot).
    deleteGroup: (id) => {
      applyDocChange((prev) => {
        const target = prev.groups[id];
        if (!target) return prev;
        // Find the (single) parent group, if any.
        let parentId: string | undefined;
        for (const [pid, p] of Object.entries(prev.groups)) {
          if (pid === id) continue;
          if (p.memberIds.includes(id)) {
            parentId = pid;
            break;
          }
        }
        const { [id]: _removed, ...restGroups } = prev.groups;
        let nextGroups = restGroups;
        if (parentId) {
          const parent = restGroups[parentId];
          if (parent) {
            // Splice: where the deleted group's id appeared, insert its
            // memberIds in-place; preserves ordering relative to siblings.
            const promoted = parent.memberIds.flatMap((m) =>
              m === id ? [...target.memberIds] : [m]
            );
            nextGroups = {
              ...restGroups,
              [parentId]: { ...parent, memberIds: promoted, updatedAt: Date.now() },
            };
          }
        }
        return touch({ ...prev, groups: nextGroups });
      });
    },

    renameGroup: (id, title) => {
      applyDocChange(
        (prev) => {
          const cur = prev.groups[id];
          if (!cur || cur.title === title) return prev;
          const next: Group = { ...cur, title, updatedAt: Date.now() };
          return touch({ ...prev, groups: { ...prev.groups, [id]: next } });
        },
        { coalesceKey: `group:${id}:title` }
      );
    },

    recolorGroup: (id, color) => {
      applyDocChange((prev) => {
        const cur = prev.groups[id];
        if (!cur || cur.color === color) return prev;
        const next: Group = { ...cur, color, updatedAt: Date.now() };
        return touch({ ...prev, groups: { ...prev.groups, [id]: next } });
      });
    },

    addToGroup: (groupId, memberId) => {
      applyDocChange((prev) => {
        const cur = prev.groups[groupId];
        if (!cur) return prev;
        const isEntity = Boolean(prev.entities[memberId]);
        const isGroup = Boolean(prev.groups[memberId]);
        if (!isEntity && !isGroup) return prev;
        if (cur.memberIds.includes(memberId)) return prev;
        // Cycle guard: a group can't be added to itself or to any descendant.
        if (wouldCreateCycle(prev, groupId, memberId)) return prev;
        const next: Group = {
          ...cur,
          memberIds: [...cur.memberIds, memberId],
          updatedAt: Date.now(),
        };
        return touch({ ...prev, groups: { ...prev.groups, [groupId]: next } });
      });
    },

    removeFromGroup: (groupId, memberId) => {
      applyDocChange((prev) => {
        const cur = prev.groups[groupId];
        if (!cur || !cur.memberIds.includes(memberId)) return prev;
        const next: Group = {
          ...cur,
          memberIds: cur.memberIds.filter((m) => m !== memberId),
          updatedAt: Date.now(),
        };
        return touch({ ...prev, groups: { ...prev.groups, [groupId]: next } });
      });
    },

    toggleGroupCollapsed: (id) => {
      applyDocChange((prev) => {
        const cur = prev.groups[id];
        if (!cur) return prev;
        const next: Group = { ...cur, collapsed: !cur.collapsed, updatedAt: Date.now() };
        return touch({ ...prev, groups: { ...prev.groups, [id]: next } });
      });
    },
  };
};
