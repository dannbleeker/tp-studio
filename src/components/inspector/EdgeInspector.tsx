import type { EdgeWeight, Entity, Warning } from '@/domain/types';
import { useEdge, useEntity } from '@/hooks/useSelected';
import { useDocumentStore } from '@/store';
import { Lightbulb, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { Button } from '../ui/Button';
import { AssumptionWell } from './AssumptionWell';
import { AttributesSection } from './AttributesSection';
import { EdgeAssumptions } from './EdgeAssumptions';
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

export function EdgeInspector({
  edgeId,
  warnings,
}: {
  edgeId: string;
  warnings: Warning[];
}) {
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
    addAssumptionToEdge,
    setEdgeAttribute,
    removeEdgeAttribute,
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
      addAssumptionToEdge: s.addAssumptionToEdge,
      setEdgeAttribute: s.setEdgeAttribute,
      removeEdgeAttribute: s.removeEdgeAttribute,
      entities: s.doc.entities,
      diagramType: s.doc.diagramType,
      locked: s.browseLocked,
    }))
  );

  if (!edge) return null;

  const assumptions = (edge.assumptionIds ?? [])
    .map((id) => entities[id])
    .filter((e): e is Entity => e?.type === 'assumption');

  return (
    <div className="flex flex-col gap-4">
      <Field label="Cause">
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-neutral-700 text-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {source?.title || <span className="text-neutral-400 italic">Untitled</span>}
        </p>
      </Field>
      <Field label="Effect">
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-neutral-700 text-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {target?.title || <span className="text-neutral-400 italic">Untitled</span>}
        </p>
      </Field>
      <Field label="Kind">
        <p className="text-neutral-500 text-xs uppercase tracking-wider">{edge.kind}</p>
      </Field>
      <Field label="Label">
        <input
          type="text"
          value={edge.label ?? ''}
          placeholder="Optional mid-edge label"
          onChange={(e) => updateEdge(edgeId, { label: e.target.value || undefined })}
          disabled={locked}
          className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </Field>

      <MarkdownField
        label="Description"
        value={edge.description ?? ''}
        onChange={(next) => updateEdge(edgeId, { description: next || undefined })}
        placeholder="Optional longer explanation — why this edge holds, what conditions matter. Markdown supported."
        locked={locked}
      />
      {edge.andGroupId && (
        <Field label="AND group">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-neutral-600 text-xs dark:text-neutral-300">
              {edge.andGroupId}
            </p>
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
        <Field label="OR group">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-neutral-600 text-xs dark:text-neutral-300">
              {edge.orGroupId}
            </p>
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
        <Field label="XOR group">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-neutral-600 text-xs dark:text-neutral-300">
              {edge.xorGroupId}
            </p>
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

      <Field label="Polarity">
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
                className={`rounded-md border px-2 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200'
                    : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900'
                }`}
                title={opt.hint}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Back-edge">
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
        <Field label="Mutual exclusion (EC)">
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

      {diagramType === 'ec' ? (
        <AssumptionWell edgeId={edgeId} assumptions={assumptions} />
      ) : (
        <EdgeAssumptions edgeId={edgeId} assumptions={assumptions} />
      )}

      <AttributesSection
        attributes={edge.attributes}
        onSet={(key, value) => setEdgeAttribute(edgeId, key, value)}
        onRemove={(key) => removeEdgeAttribute(edgeId, key)}
      />

      <WarningsList warnings={warnings} />

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
    <Field label="Brainstorm prompt">
      <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2 dark:border-amber-900/60 dark:bg-amber-950/30">
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
      </div>
    </Field>
  );
}
