import clsx from 'clsx';
import { Lightbulb, ListChecks, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import type { EdgeWeight, Entity, Warning } from '@/domain/types';
import { useEdge, useEntity } from '@/hooks/useSelected';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { Select, TextInput } from '../settings/formPrimitives';
import { Button } from '../ui/Button';
import {
  SELECTED_BUTTON_CLASS,
  TOGGLE_BUTTON_BASE,
  UNSELECTED_BUTTON_CLASS,
} from '../ui/buttonClasses';
import { InsetCard } from '../ui/InsetCard';
import { AssumptionWell } from './AssumptionWell';
// Session 136 — AttributesSection removed (user-custom attributes
// feature dropped per Dann's usage feedback). Edges retain their
// `attributes` field in the data model for any S&T-or-FL-imported
// payloads, but there's no UI to author them.
import { Field } from './Field';
import { MarkdownField } from './MarkdownField';
import { WarningsList } from './WarningsList';

// Bundle 8 / FL-ED1 — picker options for the edge polarity field. The
// "Default" entry maps to `undefined` (the cleanest data representation
// of "user has not opined") rather than literally `'positive'`, so the
// JSON export stays minimal for the vast majority of edges that don't
// need a polarity tag.
const WEIGHT_OPTIONS: { id: EdgeWeight | undefined; label: string; hint: string }[] = [
  { id: undefined, label: 'Default', hint: 'Positive sufficiency (the TOC default).' },
  { id: 'positive', label: 'Positive', hint: 'Explicit positive correlation.' },
  { id: 'negative', label: 'Negative', hint: 'This cause reduces this effect.' },
  { id: 'zero', label: 'Zero', hint: 'Neutral — flagged as non-influential.' },
];

export function EdgeInspector({ edgeId, warnings }: { edgeId: string; warnings: Warning[] }) {
  const edge = useEdge(edgeId);
  const source = useEntity(edge?.sourceId);
  const target = useEntity(edge?.targetId);
  // Session 94 (Top-30 #2) — consolidated 12 individual subscriptions
  // into one `useShallow` selector so the inspector doesn't re-render
  // on unrelated store mutations.
  const {
    deleteEdge,
    ungroupAnd,
    ungroupOr,
    ungroupXor,
    setEdgeWeight,
    updateEdge,
    reconnectEdge,
    addAssumptionToEdge,
    openEdgeScrutiny,
    showToast,
    entities,
    diagramType,
    locked,
  } = useDocumentStore(
    useShallow((s) => ({
      deleteEdge: s.deleteEdge,
      ungroupAnd: s.ungroupAnd,
      ungroupOr: s.ungroupOr,
      ungroupXor: s.ungroupXor,
      setEdgeWeight: s.setEdgeWeight,
      updateEdge: s.updateEdge,
      reconnectEdge: s.reconnectEdge,
      addAssumptionToEdge: s.addAssumptionToEdge,
      // Phase 3 #7 — launch the guided CLR-scrutiny dialog for this edge.
      openEdgeScrutiny: s.openEdgeScrutiny,
      showToast: s.showToast,
      // Session 136 — setEdgeAttribute / removeEdgeAttribute dropped
      // here because the AttributesSection UI is gone (user-custom
      // attributes feature removed). Store actions remain available
      // for any S&T-or-FL-imported payloads that touch edge
      // attributes directly.
      entities: currentDoc(s).entities,
      diagramType: currentDoc(s).diagramType,
      locked: s.browseLocked,
    }))
  );

  // #1 (recommended primary) — options for the cause/effect re-wire dropdowns:
  // every structural entity (not assumptions/notes), labelled by title and
  // live-updating as entities are renamed. Built before the early return below
  // so the hook order stays stable.
  const entityOptions = useMemo(() => {
    const label = (e: Entity): string => e.title.trim() || `(untitled #${e.annotationNumber})`;
    return Object.values(entities)
      .filter((e) => e.type !== 'assumption' && e.type !== 'note')
      .map((e) => ({ value: e.id, label: label(e) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [entities]);

  if (!edge) return null;

  const assumptions = (edge.assumptionIds ?? [])
    .map((id) => entities[id])
    .filter((e): e is Entity => e?.type === 'assumption');

  // Re-wire is offered only for a normal causal cause→effect edge. A note-edge
  // (one endpoint a note) keeps the read-only display — its semantics aren't a
  // cause/effect pair. `reconnectEdge` itself guards self-loops + duplicates.
  const canRewire =
    source != null && target != null && source.type !== 'note' && target.type !== 'note';
  const rewire = (sourceId: string, targetId: string): void => {
    if (reconnectEdge(edgeId, sourceId, targetId) === null) {
      showToast('info', "Couldn't redirect — an edge between those two already exists.");
    }
  };
  // Disable the opposite endpoint in each list so the obvious self-loop can't be
  // picked; `reconnectEdge` still guards duplicates + missing endpoints.
  const causeOptions = entityOptions.map((o) => ({ ...o, disabled: o.value === edge.targetId }));
  const effectOptions = entityOptions.map((o) => ({ ...o, disabled: o.value === edge.sourceId }));

  return (
    <div className="flex flex-col gap-4">
      {canRewire ? (
        <>
          <Field label="Cause">
            <Select
              ariaLabel="Cause (edge source)"
              value={edge.sourceId}
              disabled={locked}
              onChange={(next) => rewire(next, edge.targetId)}
              options={causeOptions}
            />
          </Field>
          <Field label="Effect">
            <Select
              ariaLabel="Effect (edge target)"
              value={edge.targetId}
              disabled={locked}
              onChange={(next) => rewire(edge.sourceId, next)}
              options={effectOptions}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Cause" as="group">
            <p className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-neutral-700 text-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              {source?.title || <span className="text-neutral-400 italic">Untitled</span>}
            </p>
          </Field>
          <Field label="Effect" as="group">
            <p className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-neutral-700 text-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              {target?.title || <span className="text-neutral-400 italic">Untitled</span>}
            </p>
          </Field>
        </>
      )}
      <Field label="Kind" as="group">
        <p className="text-neutral-500 text-xs uppercase tracking-wider">{edge.kind}</p>
      </Field>
      <Field label="Label">
        <TextInput
          value={edge.label ?? ''}
          placeholder="Optional mid-edge label"
          onChange={(next) => updateEdge(edgeId, { label: next || undefined })}
          disabled={locked}
        />
      </Field>

      <MarkdownField
        label="Description"
        value={edge.description ?? ''}
        onChange={(next) => updateEdge(edgeId, { description: next || undefined })}
        placeholder="Optional longer explanation — why this edge holds, what conditions matter. Markdown supported."
        locked={locked}
      />
      {/* Design audit #8 — the junctor group id is a nanoid, not a
          user-facing string. Show a short hash (enough to tell two
          groups apart on one edge's inspector) instead of the raw id;
          the label + Ungroup button carry the actionable meaning. */}
      {edge.andGroupId && (
        <Field label="AND group" as="group">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-neutral-500 text-xs dark:text-neutral-400">
              #{edge.andGroupId.slice(0, 4)}
            </span>
            <Button
              variant="softViolet"
              size="sm"
              onClick={() => ungroupAnd([edgeId])}
              disabled={locked}
            >
              Ungroup
            </Button>
          </div>
        </Field>
      )}
      {edge.orGroupId && (
        <Field label="OR group" as="group">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-neutral-500 text-xs dark:text-neutral-400">
              #{edge.orGroupId.slice(0, 4)}
            </span>
            <Button
              variant="softViolet"
              size="sm"
              onClick={() => ungroupOr([edgeId])}
              disabled={locked}
            >
              Ungroup
            </Button>
          </div>
        </Field>
      )}
      {edge.xorGroupId && (
        <Field label="XOR group" as="group">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-neutral-500 text-xs dark:text-neutral-400">
              #{edge.xorGroupId.slice(0, 4)}
            </span>
            <Button
              variant="softViolet"
              size="sm"
              onClick={() => ungroupXor([edgeId])}
              disabled={locked}
            >
              Ungroup
            </Button>
          </div>
        </Field>
      )}

      <Field label="Polarity" as="group">
        {/* Bundle 8 / FL-ED1: edge weight (positive / negative / zero).
            Metadata only — CLR rules don't change behavior on weight.
            Used by exporters (Flying Logic round-trips it) and as a
            visual tag for counter-causal edges. */}
        <div className="grid grid-cols-4 gap-1.5 text-xs">
          {WEIGHT_OPTIONS.map((opt) => {
            const selected = (edge.weight ?? undefined) === opt.id;
            return (
              <button
                key={opt.label}
                type="button"
                disabled={locked}
                onClick={() => setEdgeWeight(edgeId, opt.id)}
                className={clsx(
                  TOGGLE_BUTTON_BASE,
                  selected ? SELECTED_BUTTON_CLASS : UNSELECTED_BUTTON_CLASS
                )}
                title={opt.hint}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Back-edge" as="group">
        <label className="flex items-start gap-2 text-neutral-600 text-xs dark:text-neutral-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={edge.isBackEdge === true}
            disabled={locked}
            onChange={(e) =>
              updateEdge(edgeId, { isBackEdge: e.target.checked ? true : undefined })
            }
          />
          <span>
            Tag as an intentional loop-closer. The cycle CLR rule stays silent on this cycle and the
            edge renders with a thicker dashed stroke + a ↻ glyph. Use for vicious circles in a CRT
            or positive reinforcing loops in an FRT.
          </span>
        </label>
      </Field>

      {source?.type === 'want' && target?.type === 'want' && (
        <Field label="Mutual exclusion (EC)" as="group">
          <label className="flex items-start gap-2 text-neutral-600 text-xs dark:text-neutral-300">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={edge.isMutualExclusion === true}
              disabled={locked}
              onChange={(e) =>
                updateEdge(edgeId, {
                  isMutualExclusion: e.target.checked ? true : undefined,
                })
              }
            />
            <span>
              Mark these two Wants as mutually exclusive — the diagnostic at the heart of an
              Evaporating Cloud. The edge renders red with a ⊥ glyph; the EC-missing-conflict CLR
              rule stops firing once any pair of Wants is marked this way.
            </span>
          </label>
        </Field>
      )}

      {/*
        EC brainstorm prompt — the book prescribes three specific questions
        to ask of each EC edge, depending on which two boxes it joins.
        Surfacing the right question inline gives the user the canonical
        starting point for "…because" assumptions on this edge.
      */}
      {diagramType === 'ec' && source && target && (
        <EcBrainstormPrompt
          edgeId={edgeId}
          source={source}
          target={target}
          locked={locked}
          onAddAsAssumption={(text) => {
            const seedTitle = `…because ${text}`;
            addAssumptionToEdge(edgeId, seedTitle);
          }}
        />
      )}

      {/* Session 135 — unified on `<AssumptionWell>` for every diagram
          type (previously EC used AssumptionWell and non-EC used the
          lighter-weight EdgeAssumptions). The status chip
          (unexamined / valid / invalid / challengeable) is universally
          useful — the book chapter on assumptions treats status as a
          cross-diagram concept — and ditching the second component
          collapses two near-identical row implementations into one
          source of truth. The richer pill UX is a strict improvement
          on CRT / FRT / PRT / TT edges. */}
      <AssumptionWell edgeId={edgeId} assumptions={assumptions} />

      <WarningsList warnings={warnings} />

      {/* Phase 3 #7 — guided CLR scrutiny. A read-only review surface, so
          it stays enabled under Browse Lock (unlike the editing controls
          above). Walks the eight canonical reservations one at a time for
          this single edge. */}
      <Button
        variant="softNeutral"
        size="sm"
        onClick={() => openEdgeScrutiny(edgeId)}
        className="mt-1"
      >
        <ListChecks className="h-3.5 w-3.5" />
        Scrutinize against the CLR
      </Button>

      <Button
        variant="destructive"
        onClick={() => deleteEdge(edgeId)}
        className="mt-2"
        disabled={locked}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete edge
      </Button>
    </div>
  );
}

/**
 * Compute the canonical EC brainstorm question for an edge based on the
 * types of its two endpoints. The three book-prescribed questions, one
 * per edge role in a 5-box EC:
 *
 *   - **Want → Need** — "How can we satisfy [Need] without obtaining [Want]?"
 *     (challenges whether the Want is the only way to meet the Need)
 *   - **Need → Goal** — "How can we accomplish [Goal] without satisfying [Need]?"
 *     (challenges whether the Need is actually necessary for the Goal)
 *   - **Want ↔ Want** (mutual exclusion) — "How can we obtain both [Want] and
 *     [Want']?" (challenges the conflict itself)
 *
 * Any other edge role on an EC returns null — the user can still author
 * assumptions freely, but there's no book-prescribed prompt to display.
 */
function ecQuestionFor(source: Entity, target: Entity): string | null {
  const srcName = source.title.trim() || 'this entity';
  const tgtName = target.title.trim() || 'that entity';
  // Want → Need
  if (source.type === 'want' && target.type === 'need') {
    return `How can we satisfy "${tgtName}" without obtaining "${srcName}"?`;
  }
  // Need → Goal
  if (source.type === 'need' && target.type === 'goal') {
    return `How can we accomplish "${tgtName}" without satisfying "${srcName}"?`;
  }
  // Want ↔ Want (the mutual-exclusion edge)
  if (source.type === 'want' && target.type === 'want') {
    return `How can we obtain both "${srcName}" and "${tgtName}"?`;
  }
  return null;
}

function EcBrainstormPrompt({
  source,
  target,
  locked,
  onAddAsAssumption,
}: {
  edgeId: string;
  source: Entity;
  target: Entity;
  locked: boolean;
  onAddAsAssumption: (text: string) => void;
}) {
  const question = ecQuestionFor(source, target);
  if (!question) return null;
  return (
    <Field label="Brainstorm prompt" as="group">
      <InsetCard tone="amber" className="flex flex-col gap-2">
        <p className="text-amber-900 text-xs leading-snug dark:text-amber-100">{question}</p>
        <Button
          variant="softViolet"
          size="sm"
          disabled={locked}
          onClick={() => onAddAsAssumption(question)}
        >
          <Lightbulb className="h-3 w-3" />
          Add as a new assumption
        </Button>
      </InsetCard>
    </Field>
  );
}
