import { defaultEntityType } from '@/domain/entityTypeMeta';
import { validate } from '@/domain/validators';
import { copySelection, cutSelection, pasteClipboard } from '@/services/clipboard';
import { confirmAndDeleteSelection } from '@/services/confirmations';
import { type Command, withWriteGuard } from './types';

export const toolCommands: Command[] = [
  {
    id: 'run-validation',
    label: 'Run validation',
    group: 'Review',
    run: (s) => {
      const warnings = validate(s.doc);
      const open = warnings.filter((w) => !w.resolved).length;
      const resolved = warnings.filter((w) => w.resolved).length;
      // Session 87 UX fix #4 — spell out "Categories of Legitimate
      // Reservation" once in the toast so a fresh user can see what
      // the framework actually stands for. Subsequent references in
      // the same toast use the short form to keep the toast scannable.
      if (warnings.length === 0) {
        s.showToast('success', 'No Categories of Legitimate Reservation concerns to surface.');
      } else if (open === 0) {
        s.showToast(
          'success',
          `All ${resolved} concern${resolved === 1 ? '' : 's'} resolved (Categories of Legitimate Reservation).`
        );
      } else {
        const suffix = resolved > 0 ? `, ${resolved} resolved` : '';
        s.showToast(
          'info',
          `${open} open concern${open === 1 ? '' : 's'}${suffix} (Categories of Legitimate Reservation).`
        );
      }
    },
  },
  withWriteGuard({
    id: 'swap-entities',
    label: 'Swap selected entities',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 2 || !sel.ids[0] || !sel.ids[1]) {
        s.showToast('info', 'Select exactly two entities to swap.');
        return;
      }
      s.swapEntities(sel.ids[0], sel.ids[1]);
      s.showToast('success', 'Swapped entities.');
    },
  }),
  // Session 95 — surfaced for SelectionToolbar parity. The Tab /
  // Shift+Tab keyboard shortcuts have always done this; making it a
  // palette command means the new toolbar can route through the
  // same handler and the Help dialog can document it once.
  withWriteGuard({
    id: 'add-successor',
    label: 'Add child of selected entity',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single entity first.');
        return;
      }
      const parentId = sel.ids[0]!;
      const fresh = s.addEntity({
        type: defaultEntityType(s.doc.diagramType),
        startEditing: true,
      });
      s.connect(parentId, fresh.id);
    },
  }),
  withWriteGuard({
    id: 'add-predecessor',
    label: 'Add parent of selected entity',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single entity first.');
        return;
      }
      const childId = sel.ids[0]!;
      const fresh = s.addEntity({
        type: defaultEntityType(s.doc.diagramType),
        startEditing: true,
      });
      s.connect(fresh.id, childId);
    },
  }),
  // Session 95 — palette entry for the Delete-key behaviour. Routes
  // through the same confirmation flow the keyboard shortcut uses.
  withWriteGuard({
    id: 'confirm-delete-selection',
    label: 'Delete selection',
    group: 'Edit',
    run: () => {
      void confirmAndDeleteSelection();
    },
  }),
  // Session 96 — entity-type changers surfaced for SelectionToolbar
  // parity. These already live in the Inspector's Type picker; the
  // palette entries route through the same `updateEntity({ type })`
  // call. Each is a no-op when the selection isn't a single entity
  // or already has the target type.
  withWriteGuard({
    id: 'mark-as-ude',
    label: 'Mark entity as UDE',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single entity first.');
        return;
      }
      const id = sel.ids[0]!;
      const e = s.doc.entities[id];
      if (!e) return;
      if (e.type === 'ude') return;
      s.updateEntity(id, { type: 'ude' });
    },
  }),
  withWriteGuard({
    id: 'mark-as-rootcause',
    label: 'Mark entity as root cause',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single entity first.');
        return;
      }
      const id = sel.ids[0]!;
      const e = s.doc.entities[id];
      if (!e) return;
      if (e.type === 'rootCause') return;
      s.updateEntity(id, { type: 'rootCause' });
    },
  }),
  // Goal Tree — promote a CSF (or any non-goal entity in a Goal
  // Tree) to the top-level Goal. The existing entity keeps its
  // edges; type changes to 'goal'.
  withWriteGuard({
    id: 'promote-to-goal',
    label: 'Promote entity to Goal',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single entity first.');
        return;
      }
      const id = sel.ids[0]!;
      const e = s.doc.entities[id];
      if (!e) return;
      if (e.type === 'goal') return;
      s.updateEntity(id, { type: 'goal' });
      s.showToast('success', `"${e.title || 'Entity'}" promoted to Goal.`);
    },
  }),
  // Goal Tree — add a necessaryCondition child of the selected
  // entity (typically a CSF or Goal) connected via a necessity
  // edge. Mirrors how the creation wizard fills NCs.
  withWriteGuard({
    id: 'add-nc-child',
    label: 'Add necessary condition child',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single entity first.');
        return;
      }
      const parentId = sel.ids[0]!;
      const nc = s.addEntity({ type: 'necessaryCondition', startEditing: true });
      const edge = s.connect(nc.id, parentId);
      if (edge) s.updateEdge(edge.id, { kind: 'necessity' });
    },
  }),
  // Edge — add an assumption to the currently-selected edge.
  // Already keyboard-bound to `A` on a selected edge; surfaced for
  // toolbar / palette parity.
  withWriteGuard({
    id: 'add-assumption-to-edge',
    label: 'Add assumption to selected edge',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'edges' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single edge first.');
        return;
      }
      const edgeId = sel.ids[0]!;
      const a = s.addAssumptionToEdge(edgeId);
      if (a) s.beginEditing(a.id);
    },
  }),
  // Copy is intentionally NOT guarded — reading the selection into the
  // clipboard doesn't modify the doc, so it stays usable in browse-lock.
  {
    id: 'copy-selection',
    label: 'Copy selection',
    group: 'Edit',
    run: (s) => {
      const n = copySelection();
      if (n > 0) s.showToast('info', `Copied ${n} entit${n === 1 ? 'y' : 'ies'}.`);
      else s.showToast('info', 'Nothing to copy — select entities first.');
    },
  },
  withWriteGuard({
    id: 'cut-selection',
    label: 'Cut selection',
    group: 'Edit',
    run: (s) => {
      const n = cutSelection();
      if (n > 0) s.showToast('info', `Cut ${n} entit${n === 1 ? 'y' : 'ies'}.`);
    },
  }),
  withWriteGuard({
    id: 'paste-clipboard',
    label: 'Paste',
    group: 'Edit',
    run: (s) => {
      const r = pasteClipboard();
      if (r.ok) s.showToast('success', `Pasted ${r.entities} entities, ${r.edges} edges.`);
      else s.showToast('info', 'Clipboard is empty.');
    },
  }),
  withWriteGuard({
    id: 'undo',
    label: 'Undo',
    group: 'Edit',
    run: (s) => {
      s.undo();
    },
  }),
  withWriteGuard({
    id: 'redo',
    label: 'Redo',
    group: 'Edit',
    run: (s) => {
      s.redo();
    },
  }),
];
