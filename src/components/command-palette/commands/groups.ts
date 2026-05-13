import { presetById, presetByTitle } from '@/domain/groupPresets';
import { type Command, withWriteGuard } from './types';

export const groupCommands: Command[] = [
  withWriteGuard({
    id: 'group-selected-entities',
    label: 'Group selected entities',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length === 0) {
        s.showToast('info', 'Select one or more entities to group.');
        return;
      }
      const g = s.createGroupFromSelection(sel.ids);
      if (g) s.showToast('success', `Grouped ${sel.ids.length} into "${g.title}".`);
    },
  }),
  withWriteGuard({
    id: 'ungroup-selected',
    label: 'Delete selected group',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single group to delete.');
        return;
      }
      const id = sel.ids[0]!;
      if (!s.doc.groups[id]) {
        s.showToast('info', 'Selection is not a group.');
        return;
      }
      s.deleteGroup(id);
      s.showToast('info', 'Group deleted. Members preserved.');
    },
  }),
  withWriteGuard({
    id: 'toggle-group-collapsed',
    label: 'Collapse / expand selected group',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single group to collapse or expand.');
        return;
      }
      const id = sel.ids[0]!;
      if (!s.doc.groups[id]) {
        s.showToast('info', 'Selection is not a group.');
        return;
      }
      s.toggleGroupCollapsed(id);
    },
  }),
  // Hoist + Unhoist are view-state changes (which group's contents to
  // focus on), not document mutations, so they intentionally skip the
  // write guard — the user should be able to hoist into a group while
  // the doc is locked for browsing.
  {
    id: 'hoist-into-group',
    label: 'Hoist into selected group',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single group to hoist into.');
        return;
      }
      const id = sel.ids[0]!;
      if (!s.doc.groups[id]) {
        s.showToast('info', 'Selection is not a group.');
        return;
      }
      s.hoistGroup(id);
    },
  },
  {
    id: 'unhoist',
    label: 'Exit hoist',
    group: 'Edit',
    run: (s) => {
      if (s.hoistedGroupId === null) {
        s.showToast('info', 'Not currently hoisted.');
        return;
      }
      s.unhoist();
    },
  },
  withWriteGuard({
    // TOC-reading: archive pruned alternatives without deleting them.
    // The CRT/PRT method tells the user to *record* what was considered
    // and rejected rather than scrub it out. This command finds the
    // existing "Archive" group in the doc (by canonical title) and adds
    // the multi-selection to it, or creates one with the Archive preset
    // (slate + collapsed) when none exists.
    id: 'archive-selected',
    label: 'Move selection to Archive group',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length === 0) {
        s.showToast('info', 'Select one or more entities to archive.');
        return;
      }
      const preset = presetById('archive');
      if (!preset) return;
      // Reuse an existing Archive group when present so the doc doesn't
      // accumulate multiple "Archive (2)", "Archive (3)" duplicates.
      const existing = Object.values(s.doc.groups).find(
        (g) => g.title.trim().toLowerCase() === preset.title.toLowerCase()
      );
      if (existing) {
        for (const id of sel.ids) s.addToGroup(existing.id, id);
        if (!existing.collapsed) s.toggleGroupCollapsed(existing.id);
        s.showToast('info', `Added ${sel.ids.length} to existing Archive group.`);
        return;
      }
      const g = s.createGroupFromSelection(sel.ids, {
        title: preset.title,
        color: preset.color,
      });
      if (g && !g.collapsed) s.toggleGroupCollapsed(g.id);
      if (g) s.showToast('success', 'Created Archive group (collapsed).');
    },
  }),
  withWriteGuard({
    // TOC-reading: start a Negative Branch sub-tree from the selected
    // entity. The book frames NBR as "an FRT injection has produced an
    // unintended UDE; capture the branch leading to it and decide how to
    // mitigate or replace the injection."
    id: 'start-negative-branch',
    label: 'Start Negative Branch from selected entity',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1 || !sel.ids[0]) {
        s.showToast('info', 'Select exactly one entity (usually a UDE) to root the branch.');
        return;
      }
      const preset = presetByTitle('Negative Branch');
      if (!preset) return;
      const g = s.createGroupFromSelection([sel.ids[0]], {
        title: preset.title,
        color: preset.color,
      });
      if (g) {
        s.showToast(
          'success',
          'Negative Branch started. Add the chain leading to this UDE inside the group.'
        );
      }
    },
  }),
];
