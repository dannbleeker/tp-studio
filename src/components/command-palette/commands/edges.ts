import { defaultEntityType } from '@/domain/entityTypeMeta';
import { getSelectedEdges } from '@/services/canvasRef';
import { currentDoc } from '@/store/selectors';
import { type Command, withWriteGuard } from './types';

export const edgeCommands: Command[] = [
  withWriteGuard({
    id: 'reverse-edge',
    label: 'Reverse selected edge',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'edges' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single edge to reverse.');
        return;
      }
      const id = sel.ids[0]!;
      const before = currentDoc(s).edges[id];
      if (!before) return;
      s.reverseEdge(id);
      const after = currentDoc(s).edges[id];
      if (after && (after.sourceId !== before.sourceId || after.targetId !== before.targetId)) {
        s.showToast('success', 'Edge reversed.');
      } else {
        s.showToast('info', 'Cannot reverse — the opposite-direction edge already exists.');
      }
    },
  }),
  withWriteGuard({
    id: 'group-and',
    label: 'Group selected edges as AND',
    group: 'Edit',
    run: (s) => {
      const ids = getSelectedEdges().map((e) => e.id);
      const result = s.groupAsAnd(ids);
      if (!result.ok) s.showToast('info', result.reason);
    },
  }),
  // Session 133 — drag-substitute for AND-junction creation. With a
  // single edge selected, this enters "join mode": the next edge the
  // user clicks gets AND-grouped with the held edge via `groupAsAnd`.
  // Discoverable via the selection toolbar verb of the same name; the
  // palette command exists for keyboard parity.
  withWriteGuard({
    id: 'start-edge-join-and',
    label: 'AND-join with another edge…',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'edges' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single edge first.');
        return;
      }
      const id = sel.ids[0]!;
      s.startEdgeJoinMode(id);
      s.showToast('info', 'Click another edge to AND-join. Esc to cancel.');
    },
  }),
  // Session 135 — a11y slice 5. Keyboard-only edge creation. Two-step
  // palette flow: select the source entity, run `start-edge-from-selection`;
  // select the target (Tab or arrow keys), run `complete-edge-to-selection`.
  // Mirrors the mouse-drag default (sufficiency edge) without ever leaving
  // the keyboard. Esc cancels via the global cascade.
  withWriteGuard({
    id: 'start-edge-from-selection',
    label: 'Start edge from selected entity… (keyboard)',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single entity to start the edge from.');
        return;
      }
      s.startPendingEdge(sel.ids[0]!);
      s.showToast(
        'info',
        'Edge pending — select another entity, then Cmd/Ctrl+K → "Complete edge to selected entity". Esc cancels.'
      );
    },
  }),
  withWriteGuard({
    id: 'complete-edge-to-selection',
    label: 'Complete edge to selected entity (keyboard)',
    group: 'Edit',
    run: (s) => {
      if (!s.pendingEdgeSourceId) {
        s.showToast('info', 'No edge pending. Start one via "Start edge from selected entity".');
        return;
      }
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single target entity, then run this command.');
        return;
      }
      const targetId = sel.ids[0]!;
      if (targetId === s.pendingEdgeSourceId) {
        s.showToast('info', 'Target must differ from the source.');
        s.cancelPendingEdge();
        return;
      }
      const result = s.completePendingEdge(targetId);
      if (result) s.showToast('success', 'Edge created.');
      else s.showToast('info', 'Could not create that edge (duplicate?).');
    },
  }),
  withWriteGuard({
    id: 'ungroup-and',
    label: 'Ungroup selected AND edges',
    group: 'Edit',
    run: (s) => {
      const ids = getSelectedEdges().map((e) => e.id);
      if (ids.length === 0) {
        s.showToast('info', 'Select one or more AND-grouped edges first.');
        return;
      }
      s.ungroupAnd(ids);
    },
  }),
  // Bundle 8 / FL-ED4: OR junctor.
  withWriteGuard({
    id: 'group-or',
    label: 'Group selected edges as OR',
    group: 'Edit',
    run: (s) => {
      const ids = getSelectedEdges().map((e) => e.id);
      const result = s.groupAsOr(ids);
      if (!result.ok) s.showToast('info', result.reason);
    },
  }),
  withWriteGuard({
    id: 'ungroup-or',
    label: 'Ungroup selected OR edges',
    group: 'Edit',
    run: (s) => {
      const ids = getSelectedEdges().map((e) => e.id);
      if (ids.length === 0) {
        s.showToast('info', 'Select one or more OR-grouped edges first.');
        return;
      }
      s.ungroupOr(ids);
    },
  }),
  // Bundle 8 / FL-ED3: XOR junctor.
  withWriteGuard({
    id: 'group-xor',
    label: 'Group selected edges as XOR',
    group: 'Edit',
    run: (s) => {
      const ids = getSelectedEdges().map((e) => e.id);
      const result = s.groupAsXor(ids);
      if (!result.ok) s.showToast('info', result.reason);
    },
  }),
  withWriteGuard({
    id: 'ungroup-xor',
    label: 'Ungroup selected XOR edges',
    group: 'Edit',
    run: (s) => {
      const ids = getSelectedEdges().map((e) => e.id);
      if (ids.length === 0) {
        s.showToast('info', 'Select one or more XOR-grouped edges first.');
        return;
      }
      s.ungroupXor(ids);
    },
  }),
  // Session 95 — surfaced for parity with the new SelectionToolbar's
  // "Splice" verb. Pre-existed as a ContextMenu-only action; now
  // reachable via Cmd+K too.
  withWriteGuard({
    id: 'splice-into-edge',
    label: 'Splice entity into selected edge',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'edges' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single edge to splice into.');
        return;
      }
      const edgeId = sel.ids[0]!;
      const doc = currentDoc(s);
      const edge = doc.edges[edgeId];
      if (!edge) return;
      const fresh = s.addEntity({
        type: defaultEntityType(doc.diagramType),
        startEditing: true,
      });
      const ok = s.spliceEntityIntoEdge(fresh.id, edgeId);
      if (!ok) {
        // Roll back: spliceEntityIntoEdge returns false on self-loop
        // or unknown edge — neither possible here, but defensive
        // cleanup keeps state tidy in the failure mode.
        s.deleteEntity(fresh.id);
        s.showToast('error', 'Could not splice into this edge.');
      }
    },
  }),
];
