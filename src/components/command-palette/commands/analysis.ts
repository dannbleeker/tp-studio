import { findCoreDrivers } from '@/domain/coreDriver';
import { topologicalEdgeOrder } from '@/domain/edgeReading';
import { spawnECFromConflict } from '@/domain/spawnEC';
import { validate } from '@/domain/validators';
import { type Command, withWriteGuard } from './types';

/**
 * "Analysis" command family — actions that derive insight from the diagram
 * rather than mutate its content directly. Today: Core Driver finder +
 * Spawn EC from selection. Future candidates from the TOC reading: Read
 * diagram aloud, CLR walkthrough wizard, etc.
 */

export const analysisCommands: Command[] = [
  {
    id: 'find-core-drivers',
    label: 'Find core driver(s)',
    group: 'Review',
    run: (s) => {
      const candidates = findCoreDrivers(s.doc);
      if (candidates.length === 0) {
        s.showToast(
          'info',
          'No core driver candidates — needs at least one UDE reached from a root cause.'
        );
        return;
      }
      // Select the candidate entities so the canvas highlights them.
      s.selectEntities(candidates.map((c) => c.entity.id));
      if (candidates.length === 1) {
        const c = candidates[0];
        if (!c) return;
        s.showToast(
          'success',
          `Core driver: "${c.entity.title || 'Untitled'}" reaches ${c.reachedUdeCount} UDE${c.reachedUdeCount === 1 ? '' : 's'}.`
        );
      } else {
        const headline = candidates
          .map((c) => `"${(c.entity.title || 'Untitled').slice(0, 30)}" (${c.reachedUdeCount})`)
          .join(', ');
        s.showToast('info', `Core driver candidates: ${headline}.`);
      }
    },
  },
  withWriteGuard({
    id: 'spawn-ec-from-selection',
    label: 'Spawn Evaporating Cloud from selected entity',
    group: 'File',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1 || !sel.ids[0]) {
        s.showToast(
          'info',
          'Select exactly one entity (usually a root cause) to seed the EC from.'
        );
        return;
      }
      const conflictId = sel.ids[0];
      const newDoc = spawnECFromConflict(s.doc, conflictId);
      s.setDocument(newDoc);
      s.showToast(
        'success',
        'New Evaporating Cloud seeded — fill in Goal, Needs, and the conflicting Want.'
      );
    },
  }),
  {
    id: 'start-read-through',
    label: 'Start read-through (verbalize every edge)',
    group: 'Review',
    run: (s) => {
      const order = topologicalEdgeOrder(s.doc);
      if (order.length === 0) {
        s.showToast('info', 'No edges to walk through yet — connect entities first.');
        return;
      }
      s.startReadThrough(order);
    },
  },
  {
    id: 'start-clr-walkthrough',
    label: 'Start CLR walkthrough',
    group: 'Review',
    run: (s) => {
      const warnings = validate(s.doc).filter((w) => !w.resolved);
      if (warnings.length === 0) {
        s.showToast('success', 'No open CLR concerns to walk through.');
        return;
      }
      s.startClrWalkthrough(warnings.map((w) => w.id));
    },
  },
];
