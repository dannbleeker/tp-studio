import { defaultEntityType } from '@/domain/entityTypeMeta';
import { GROUP_COLORS_ORDER } from '@/domain/groupColors';
import type { EntityType } from '@/domain/types';
import { validate } from '@/domain/validators';
import { copySelection, cutSelection, pasteClipboard } from '@/services/clipboard';
import { confirmAndDeleteSelection } from '@/services/confirmations';
import { currentDoc } from '@/store/selectors';
import { type Command, withWriteGuard } from './types';

/**
 * Shared body for the `mark-as-*` palette verbs: retype the single selected
 * entity to `type`. Nudges with a toast when the selection isn't a single
 * entity, and is a silent no-op when it's already that type — matching what
 * each command inlined before. Mirrors the Inspector's Type picker.
 */
const markEntityAs = (s: Parameters<Command['run']>[0], type: EntityType): void => {
  const sel = s.selection;
  if (sel.kind !== 'entities' || sel.ids.length !== 1) {
    s.showToast('info', 'Select a single entity first.');
    return;
  }
  const id = sel.ids[0]!;
  const e = currentDoc(s).entities[id];
  if (!e) return;
  if (e.type === type) return;
  s.updateEntity(id, { type });
};

export const toolCommands: Command[] = [
  {
    id: 'run-validation',
    label: 'Run validation',
    group: 'Review',
    run: (s) => {
      const warnings = validate(currentDoc(s));
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
        type: defaultEntityType(currentDoc(s).diagramType),
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
        type: defaultEntityType(currentDoc(s).diagramType),
        startEditing: true,
      });
      s.connect(fresh.id, childId);
    },
  }),
  // Phase 3 #4 (TP completeness — NBR trimming) — add a trimming injection that
  // negatively-causes the selected undesirable effect, breaking the negative
  // branch. One undoable step via the atomic `trimBranch` action.
  withWriteGuard({
    id: 'trim-branch',
    label: 'Trim this branch (add a trimming injection)',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select the undesirable effect to trim a branch from.');
        return;
      }
      const inj = s.trimBranch(sel.ids[0]!);
      if (inj) {
        s.showToast(
          'success',
          'Added a trimming injection (negative edge) — name it to say what breaks the branch.'
        );
      }
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
    run: (s) => markEntityAs(s, 'ude'),
  }),
  withWriteGuard({
    id: 'mark-as-rootcause',
    label: 'Mark entity as root cause',
    group: 'Edit',
    run: (s) => markEntityAs(s, 'rootCause'),
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
      const e = currentDoc(s).entities[id];
      if (!e) return;
      if (e.type === 'goal') return;
      s.updateEntity(id, { type: 'goal' });
      s.showToast('success', `"${e.title || 'Entity'}" promoted to Goal.`);
    },
  }),
  // Goal Tree — flip a non-CSF entity to a Critical Success Factor.
  // Session 127: symmetric with `promote-to-goal`. CSFs are the mid-
  // level "make-or-break" conditions between the top Goal and the
  // necessaryCondition leaves; surfacing this as a verb lets the
  // toolbar mirror the Inspector's Type picker.
  withWriteGuard({
    id: 'mark-as-csf',
    label: 'Mark entity as Critical Success Factor',
    group: 'Edit',
    run: (s) => markEntityAs(s, 'criticalSuccessFactor'),
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
  // Session 97 — EC slot "Add prerequisite". Selected entity must be a
  // `want` (D or D′ in an EC). Adds a `need` entity upstream and a
  // necessity edge from the new need → the want. Maps to the canonical
  // EC reading "to obtain this want we must satisfy this need."
  withWriteGuard({
    id: 'add-prerequisite-need',
    label: 'Add prerequisite need (EC)',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single Want first.');
        return;
      }
      const wantId = sel.ids[0]!;
      const want = currentDoc(s).entities[wantId];
      if (!want || want.type !== 'want') {
        s.showToast('info', 'Add prerequisite is for the Wants (D / D′) of an EC.');
        return;
      }
      const need = s.addEntity({ type: 'need', startEditing: true });
      const edge = s.connect(need.id, wantId);
      if (edge) s.updateEdge(edge.id, { kind: 'necessity' });
    },
  }),
  // Session 128 — Transition Tree slot verbs. Mirror the CRT/FRT
  // `mark-as-*` pattern for the two TT-specific roles (the Action
  // step and the desired Outcome at the top of a TT subtree).
  // Surfaced only on TT diagrams via the selectionVerbs registry.
  withWriteGuard({
    id: 'mark-as-action',
    label: 'Mark entity as Action (TT)',
    group: 'Edit',
    run: (s) => markEntityAs(s, 'action'),
  }),
  withWriteGuard({
    id: 'mark-as-outcome',
    label: 'Mark entity as desired Outcome (TT)',
    group: 'Edit',
    run: (s) => markEntityAs(s, 'desiredEffect'),
  }),
  // TT step-completion verb. The `complete-step` validator (Session 53)
  // fires on Actions whose outgoing edge to an Outcome lacks a non-
  // Action sibling — the canonical TT step is `(precondition, action)
  // → outcome`. This verb finds the Action's first outgoing edge,
  // creates a paired `effect` (precondition slot), and wires it into
  // the same Outcome so the step becomes complete.
  withWriteGuard({
    id: 'add-precondition',
    label: 'Add precondition to Action (TT)',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single Action first.');
        return;
      }
      const actionId = sel.ids[0]!;
      const doc = currentDoc(s);
      const action = doc.entities[actionId];
      if (!action || action.type !== 'action') {
        s.showToast('info', 'Add precondition is for Action entities in a Transition Tree.');
        return;
      }
      // Find the Action's first outgoing edge to identify the Outcome
      // we need to also feed. If the Action has no outgoing edge yet,
      // we can't infer the Outcome — surface a hint and bail.
      const outgoing = Object.values(doc.edges).find((e) => e.sourceId === actionId);
      if (!outgoing) {
        s.showToast(
          'info',
          'Action needs an Outcome edge first — connect this Action to an outcome, then add precondition.'
        );
        return;
      }
      const outcomeId = outgoing.targetId;
      const precondition = s.addEntity({ type: 'effect', startEditing: true });
      s.connect(precondition.id, outcomeId);
    },
  }),
  // Session 128 — Prerequisite Tree slot verbs. The PRT method pairs
  // each Obstacle with an Intermediate Objective that removes it;
  // surfacing the type-flippers + a one-shot "Add IO for this
  // obstacle" matches the working-set vocabulary of a PRT build.
  withWriteGuard({
    id: 'mark-as-obstacle',
    label: 'Mark entity as Obstacle (PRT)',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single entity first.');
        return;
      }
      const id = sel.ids[0]!;
      const e = currentDoc(s).entities[id];
      if (!e) return;
      if (e.type === 'obstacle') return;
      s.updateEntity(id, { type: 'obstacle' });
    },
  }),
  withWriteGuard({
    id: 'mark-as-io',
    label: 'Mark entity as Intermediate Objective (PRT)',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single entity first.');
        return;
      }
      const id = sel.ids[0]!;
      const e = currentDoc(s).entities[id];
      if (!e) return;
      if (e.type === 'intermediateObjective') return;
      s.updateEntity(id, { type: 'intermediateObjective' });
    },
  }),
  // PRT pairing helper. From a selected Obstacle, mint an IO that
  // overcomes it and connect IO → Obstacle. Matches the canonical PRT
  // reading "the IO removes this obstacle on the way to the Goal."
  withWriteGuard({
    id: 'add-io-for-obstacle',
    label: 'Add Intermediate Objective for this Obstacle (PRT)',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single Obstacle first.');
        return;
      }
      const obstacleId = sel.ids[0]!;
      const obstacle = currentDoc(s).entities[obstacleId];
      if (!obstacle || obstacle.type !== 'obstacle') {
        s.showToast('info', 'Add IO is for Obstacle entities in a Prerequisite Tree.');
        return;
      }
      const io = s.addEntity({ type: 'intermediateObjective', startEditing: true });
      s.connect(io.id, obstacleId);
    },
  }),
  // Session 97 — cycle an edge through the 4 polarity states
  // (undefined → positive → negative → zero → undefined). One verb
  // instead of a sub-menu; users click repeatedly to land where they
  // want, the EdgeInspector's explicit picker covers the alternative
  // path for users who want to set a specific value in one click.
  withWriteGuard({
    id: 'cycle-edge-polarity',
    label: 'Cycle edge polarity',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'edges' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single edge first.');
        return;
      }
      const id = sel.ids[0]!;
      const edge = currentDoc(s).edges[id];
      if (!edge) return;
      const next =
        edge.weight === undefined
          ? 'positive'
          : edge.weight === 'positive'
            ? 'negative'
            : edge.weight === 'negative'
              ? 'zero'
              : undefined;
      s.setEdgeWeight(id, next);
      const label = next === undefined ? 'default' : next;
      s.showToast('info', `Edge polarity → ${label}.`);
    },
  }),
  // Session 97 — cycle the selected group's color through the
  // canonical 6-color palette. One verb covers all 6 colors via
  // repeated click; the Group Inspector still provides explicit
  // single-click color selection for users who want to land on a
  // specific shade in one step.
  withWriteGuard({
    id: 'cycle-group-color',
    label: 'Cycle group color',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'groups' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single group first.');
        return;
      }
      const id = sel.ids[0]!;
      const group = currentDoc(s).groups[id];
      if (!group) return;
      const idx = GROUP_COLORS_ORDER.indexOf(group.color);
      const next = GROUP_COLORS_ORDER[(idx + 1) % GROUP_COLORS_ORDER.length]!;
      s.recolorGroup(id, next);
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
