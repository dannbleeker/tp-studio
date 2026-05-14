import type { Assumption, Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { Plus, Zap } from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { Button } from '../ui/Button';

/**
 * Session 77 / brief §6 — Injection Workbench.
 *
 * Right-inspector tab for EC documents. Lists every injection entity
 * in the document and lets the user:
 *
 *   - See which assumptions each injection challenges (many-to-many).
 *   - Add a new injection entity directly from this panel.
 *   - Mark an injection "implemented" via the entity's existing
 *     attribute system (`attributes.implemented: { kind: 'bool',
 *     value: true }`) — surfaces the corresponding arrow on the
 *     canvas in green via the AssumptionWell ↔ Injection link.
 *   - Link or unlink any assumption in the document.
 */
export function InjectionWorkbench() {
  const { injections, assumptions, addEntity, linkInjection, unlinkInjection, setEntityAttribute } =
    useDocumentStore(
      useShallow((s) => ({
        injections: Object.values(s.doc.entities).filter((e) => e.type === 'injection'),
        assumptions: s.doc.assumptions ?? ({} as Record<string, Assumption>),
        addEntity: s.addEntity,
        linkInjection: s.linkInjectionToAssumption,
        unlinkInjection: s.unlinkInjectionFromAssumption,
        setEntityAttribute: s.setEntityAttribute,
      }))
    );
  const locked = useDocumentStore((s) => s.browseLocked);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-neutral-600 text-xs dark:text-neutral-300">
          Each injection challenges one or more assumptions. Mark an injection implemented when
          you've shipped the change — the linked assumptions evaporate.
        </p>
      </div>
      <Button
        variant="softViolet"
        size="md"
        disabled={locked}
        onClick={() => addEntity({ type: 'injection', title: '', startEditing: true })}
      >
        <Plus className="h-3.5 w-3.5" />
        New injection
      </Button>
      {injections.length === 0 && (
        <p className="text-[11px] text-neutral-500 italic dark:text-neutral-400">
          No injections yet. Add one above or right-click the canvas to seed one.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {injections.map((inj) => (
          <InjectionRow
            key={inj.id}
            injection={inj}
            assumptions={assumptions}
            locked={locked}
            onToggleImplemented={(impl) =>
              setEntityAttribute(inj.id, 'implemented', { kind: 'bool', value: impl })
            }
            onLink={(asmId) => linkInjection(asmId, inj.id)}
            onUnlink={(asmId) => unlinkInjection(asmId, inj.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function InjectionRow({
  injection,
  assumptions,
  locked,
  onToggleImplemented,
  onLink,
  onUnlink,
}: {
  injection: Entity;
  assumptions: Record<string, Assumption>;
  locked: boolean;
  onToggleImplemented: (next: boolean) => void;
  onLink: (assumptionId: string) => void;
  onUnlink: (assumptionId: string) => void;
}) {
  const updateEntity = useDocumentStore((s) => s.updateEntity);
  const selectEntity = useDocumentStore((s) => s.selectEntity);
  const [picking, setPicking] = useState(false);

  const implementedAttr = injection.attributes?.implemented;
  const implemented = implementedAttr?.kind === 'bool' && implementedAttr.value === true;

  const linkedAssumptions = Object.values(assumptions).filter(
    (a) => a.injectionIds?.includes(injection.id) ?? false
  );
  const unlinkedAssumptions = Object.values(assumptions).filter(
    (a) => !(a.injectionIds?.includes(injection.id) ?? false)
  );

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/40 p-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <input
          type="text"
          value={injection.title}
          onChange={(e) => updateEntity(injection.id, { title: e.target.value })}
          disabled={locked}
          placeholder="Injection title…"
          className="flex-1 bg-transparent px-1 py-0.5 text-neutral-800 text-xs outline-none placeholder:text-neutral-400 disabled:opacity-60 dark:text-neutral-200"
        />
        <button
          type="button"
          onClick={() => selectEntity(injection.id)}
          className="rounded p-0.5 text-neutral-500 transition hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-300"
          title="Open injection in inspector"
          aria-label="Open injection in inspector"
        >
          →
        </button>
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-neutral-700 dark:text-neutral-300">
        <input
          type="checkbox"
          checked={implemented}
          disabled={locked}
          onChange={(e) => onToggleImplemented(e.target.checked)}
        />
        Implemented{' '}
        <span className="text-neutral-500 dark:text-neutral-400">
          ({implemented ? 'arrow shows as evaporated' : 'not yet shipped'})
        </span>
      </label>
      <div className="text-[11px]">
        <span className="text-neutral-500 dark:text-neutral-400">
          Challenges {linkedAssumptions.length} assumption
          {linkedAssumptions.length === 1 ? '' : 's'}:
        </span>
      </div>
      {linkedAssumptions.length > 0 && (
        <ul className="flex flex-col gap-0.5 pl-3">
          {linkedAssumptions.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-1 text-[11px] text-neutral-700 dark:text-neutral-300"
            >
              <span className="flex-1 truncate" title={a.text}>
                — {a.text || <span className="text-neutral-400 italic">(empty)</span>}
              </span>
              <button
                type="button"
                onClick={() => onUnlink(a.id)}
                disabled={locked}
                className="rounded px-1 text-[10px] text-neutral-500 transition hover:bg-red-100 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                title="Unlink"
                aria-label="Unlink assumption"
              >
                unlink
              </button>
            </li>
          ))}
        </ul>
      )}
      {picking ? (
        <div className="flex flex-col gap-0.5 rounded border border-neutral-200 bg-white p-1.5 dark:border-neutral-700 dark:bg-neutral-900">
          <p className="px-1 text-[10px] text-neutral-500 dark:text-neutral-400">Link to:</p>
          {unlinkedAssumptions.length === 0 && (
            <p className="px-1 text-[11px] text-neutral-500 italic dark:text-neutral-400">
              No more assumptions to link.
            </p>
          )}
          <ul aria-label="Assumptions available to link" className="flex flex-col gap-0.5">
            {unlinkedAssumptions.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    onLink(a.id);
                    setPicking(false);
                  }}
                  aria-label={`Link assumption: ${a.text || 'empty'}`}
                  className="w-full rounded px-1 py-0.5 text-left text-[11px] text-neutral-700 transition hover:bg-emerald-100 hover:text-emerald-700 focus:bg-emerald-100 focus:outline-none dark:text-neutral-300 dark:focus:bg-emerald-950/40 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                >
                  {a.text || <span className="italic">(empty)</span>}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="self-start px-1 text-[10px] text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          disabled={locked}
          className="self-start rounded px-1 py-0.5 font-semibold text-[10px] text-emerald-700 uppercase tracking-wide transition hover:bg-emerald-100 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
        >
          + link assumption
        </button>
      )}
    </li>
  );
}
