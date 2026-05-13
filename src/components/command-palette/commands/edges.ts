import { getSelectedEdges } from '@/services/canvasRef';
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
      const before = s.doc.edges[id];
      if (!before) return;
      s.reverseEdge(id);
      const after = s.doc.edges[id];
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
];
