import { findCoreDrivers } from '@/domain/coreDriver';
import { topologicalEdgeOrder } from '@/domain/edgeReading';
import { spawnECFromConflict } from '@/domain/spawnEC';
import { validate } from '@/domain/validators';
import { currentDoc } from '@/store/selectors';
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
      const candidates = findCoreDrivers(currentDoc(s));
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
      const newDoc = spawnECFromConflict(currentDoc(s), conflictId);
      const openedNewTab = s.openDocInTab(newDoc);
      s.showToast(
        'success',
        openedNewTab
          ? 'New Evaporating Cloud opened in a new tab — fill in Goal, Needs, and the conflicting Want. (Your CRT stays in its tab.)'
          : 'New Evaporating Cloud seeded — fill in Goal, Needs, and the conflicting Want.'
      );
    },
  }),
  // Phase 1C — what-if speculation. View-state actions (overlay is
  // UI-only, never mutates the doc until Commit), so they skip the
  // write guard. The banner's Commit/Revert + the inspector picker
  // drive the rest of the flow.
  {
    id: 'begin-speculation',
    label: 'Speculate: what changes if… (what-if overlay)',
    group: 'Review',
    run: (s) => {
      if (s.speculationOverlay !== null) {
        s.showToast('info', 'Already speculating — pick an entity state to explore.');
        return;
      }
      s.beginSpeculation();
      s.showToast(
        'info',
        'Speculation on. Pick a state for any entity to preview the downstream cascade.'
      );
    },
  },
  {
    id: 'commit-speculation',
    label: 'Commit speculative states to the document',
    group: 'Review',
    run: (s) => {
      if (s.speculationOverlay === null) {
        s.showToast('info', 'Not speculating.');
        return;
      }
      const n = Object.keys(s.speculationOverlay).length;
      s.commitSpeculation();
      s.showToast(
        'success',
        n > 0 ? `Committed ${n} state change${n === 1 ? '' : 's'}.` : 'Speculation ended.'
      );
    },
  },
  {
    id: 'revert-speculation',
    label: 'Revert speculation (discard what-if)',
    group: 'Review',
    run: (s) => {
      if (s.speculationOverlay === null) {
        s.showToast('info', 'Not speculating.');
        return;
      }
      s.revertSpeculation();
      s.showToast('info', 'Speculation discarded.');
    },
  },
  {
    id: 'start-read-through',
    label: 'Start read-through (step through every edge)',
    group: 'Review',
    run: (s) => {
      const order = topologicalEdgeOrder(currentDoc(s));
      if (order.length === 0) {
        s.showToast('info', 'No edges to walk through yet — connect entities first.');
        return;
      }
      s.startReadThrough(order);
    },
  },
  {
    id: 'read-all-at-once',
    label: 'Read entire diagram at once (one-shot)',
    group: 'Review',
    run: (s) => {
      const order = topologicalEdgeOrder(currentDoc(s));
      if (order.length === 0) {
        s.showToast('info', 'No edges to read yet — connect entities first.');
        return;
      }
      s.openReadAllAtOnce();
    },
  },
  {
    id: 'start-clr-walkthrough',
    label: 'Start CLR walkthrough',
    group: 'Review',
    run: (s) => {
      const warnings = validate(currentDoc(s)).filter((w) => !w.resolved);
      if (warnings.length === 0) {
        s.showToast('success', 'No open CLR concerns to walk through.');
        return;
      }
      s.startClrWalkthrough(warnings.map((w) => w.id));
    },
  },
  // Phase 3 #7 — per-edge CLR scrutiny. Distinct from the walkthrough
  // above (which steps the warnings that already fired across the whole
  // doc): this walks ALL eight canonical CLR questions for one selected
  // edge, including the ones nothing flagged, so the practitioner
  // exercises the full reservation discipline. Read-only review surface
  // (opens a dialog, mutates nothing) → a plain command, no write guard.
  {
    id: 'scrutinize-edge',
    label: 'Scrutinize this edge (walk the CLR questions)',
    group: 'Review',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'edges' || sel.ids.length !== 1 || !sel.ids[0]) {
        s.showToast('info', 'Select a single edge (a cause→effect arrow) to scrutinize.');
        return;
      }
      s.openEdgeScrutiny(sel.ids[0]);
    },
  },
  // Phase 3 #3 — the "Injection Flower". Read-only composite view that groups
  // a single injection's cross-doc links into Cohen's petals (Desired Effects
  // / Negative Branch / Plan) so the user can see whether it's fully vetted.
  // A dialog over the existing `Entity.links` — no mutation, no write guard.
  {
    id: 'view-injection-flower',
    label: 'View the injection flower (desired effects · negative branch · plan)',
    group: 'Review',
    run: (s) => {
      const sel = s.selection;
      const id = sel.kind === 'entities' && sel.ids.length === 1 ? sel.ids[0] : undefined;
      const entity = id ? currentDoc(s).entities[id] : undefined;
      if (!id || entity?.type !== 'injection') {
        s.showToast('info', 'Select a single injection entity to open its flower.');
        return;
      }
      s.openInjectionFlower(id);
    },
  },
];
