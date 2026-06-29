import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  ALL_EC_SLOTS,
  EC_SLOT_GUIDING_QUESTIONS,
  EC_SLOT_LABEL,
  type ECSlot,
} from '@/domain/ecGuiding';
import {
  type CloudConflict,
  CONFLICT_FIELD_COPY,
  type CoreCloud,
  THREE_CLOUD_COUNT,
} from '@/domain/threeCloud';
import { useDelayedFocus } from '@/hooks/useDelayedFocus';
import { useDocumentStore } from '@/store';

/**
 * E3 — the 3-Cloud rapid-diagnosis wizard. A self-contained overlay (it never
 * touches the active document) that walks the user through the rapid method:
 *
 *   Step 1 — name three undesirable effects and the conflict behind each
 *            (what you do, D, vs what you feel you should do instead, D′).
 *   Step 2 — consolidate the three into one Core Cloud (A/B/C/D/D′).
 *
 * On finish it fires `commitThreeCloudDiagnosis`, which mints a single
 * `cloudType: 'core'` Evaporating Cloud document and opens it in a tab. All
 * elicitation state is local React state, committed once — so dismissing
 * mid-flow leaves the workspace untouched.
 */

/** Which Core Cloud field backs each canonical EC slot. */
const SLOT_TO_CORE: Record<ECSlot, keyof CoreCloud> = {
  a: 'objective',
  b: 'need1',
  c: 'need2',
  d: 'want1',
  dPrime: 'want2',
};

const blankConflicts = (): CloudConflict[] =>
  Array.from({ length: THREE_CLOUD_COUNT }, () => ({ ude: '', doNow: '', doInstead: '' }));

const blankCore = (): CoreCloud => ({
  objective: '',
  need1: '',
  need2: '',
  want1: '',
  want2: '',
});

const inputClass =
  'w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-xs outline-hidden focus:border-accent-400 focus:ring-1 focus:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100';

const labelClass =
  'font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400';

const stepClass = 'flex flex-col gap-4 px-4 py-4';
const hintClass = 'text-[11px] text-neutral-500 dark:text-neutral-400';

/** Step 1 — capture three undesirable effects + the conflict behind each. */
function SymptomsStep({
  conflicts,
  firstFieldRef,
  onField,
}: {
  conflicts: CloudConflict[];
  firstFieldRef: RefObject<HTMLInputElement | null>;
  onField: (index: number, key: keyof CloudConflict, value: string) => void;
}) {
  return (
    <div className={stepClass}>
      <p className={hintClass}>
        Name three things that bother you, and the conflict you feel behind each — what you do (
        <strong>D</strong>) versus what you feel you should do instead (<strong>D′</strong>). Next
        you'll consolidate them into one core conflict.
      </p>
      {conflicts.map((c, i) => (
        <fieldset
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length positional slots, never reordered.
          key={i}
          className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <legend className={labelClass}>Cloud {i + 1}</legend>
          <input
            ref={i === 0 ? firstFieldRef : undefined}
            aria-label={`Undesirable effect ${i + 1}`}
            className={inputClass}
            placeholder={CONFLICT_FIELD_COPY.ude.placeholder}
            value={c.ude}
            onChange={(e) => onField(i, 'ude', e.target.value)}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              aria-label={`Action you take ${i + 1}`}
              className={inputClass}
              placeholder={CONFLICT_FIELD_COPY.doNow.placeholder}
              value={c.doNow}
              onChange={(e) => onField(i, 'doNow', e.target.value)}
            />
            <input
              aria-label={`Action you feel you should take instead ${i + 1}`}
              className={inputClass}
              placeholder={CONFLICT_FIELD_COPY.doInstead.placeholder}
              value={c.doInstead}
              onChange={(e) => onField(i, 'doInstead', e.target.value)}
            />
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/** Step 2 — the three conflicts side by side + the consolidated core-cloud form. */
function ConsolidateStep({
  conflicts,
  core,
  title,
  onCoreField,
  onTitle,
}: {
  conflicts: CloudConflict[];
  core: CoreCloud;
  title: string;
  onCoreField: (key: keyof CoreCloud, value: string) => void;
  onTitle: (value: string) => void;
}) {
  return (
    <div className={stepClass}>
      <div className="rounded-lg border border-accent-100 bg-accent-50/50 p-3 dark:border-accent-900/40 dark:bg-accent-950/20">
        <p className={labelClass}>The three conflicts</p>
        <ul className="mt-1 flex flex-col gap-1 text-[11px] text-neutral-700 dark:text-neutral-200">
          {conflicts.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length positional slots, never reordered.
            <li key={i}>
              <span className="font-medium">{c.ude.trim() || `Cloud ${i + 1}`}</span>
              {c.doNow.trim() && c.doInstead.trim() ? (
                <span className="text-neutral-500 dark:text-neutral-400">
                  {' '}
                  — {c.doNow} vs {c.doInstead}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <p className={hintClass}>
        What single conflict sits under all three? Write the one core cloud — the shared objective,
        the two needs it protects, and the two opposing wants.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ALL_EC_SLOTS.map((slot) => (
          <div key={slot} className="flex flex-col gap-1">
            <label className={labelClass} htmlFor={`tc-core-${slot}`}>
              {EC_SLOT_LABEL[slot]}
            </label>
            <input
              id={`tc-core-${slot}`}
              className={inputClass}
              placeholder={EC_SLOT_GUIDING_QUESTIONS[slot]}
              value={core[SLOT_TO_CORE[slot]]}
              onChange={(e) => onCoreField(SLOT_TO_CORE[slot], e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass} htmlFor="tc-doc-title">
          Document title (optional)
        </label>
        <input
          id="tc-doc-title"
          className={inputClass}
          placeholder="Core cloud — 3-cloud diagnosis"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
        />
      </div>
    </div>
  );
}

export function ThreeCloudWizard() {
  const open = useDocumentStore((s) => s.threeCloudOpen);
  const close = useDocumentStore((s) => s.closeThreeCloud);
  const commit = useDocumentStore((s) => s.commitThreeCloudDiagnosis);
  const showToast = useDocumentStore((s) => s.showToast);

  const [phase, setPhase] = useState<'symptoms' | 'consolidate'>('symptoms');
  const [conflicts, setConflicts] = useState<CloudConflict[]>(blankConflicts);
  const [core, setCore] = useState<CoreCloud>(blankCore);
  const [title, setTitle] = useState('');
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // Reset to a clean slate every time the wizard opens.
  useEffect(() => {
    if (!open) return;
    setPhase('symptoms');
    setConflicts(blankConflicts());
    setCore(blankCore());
    setTitle('');
  }, [open]);

  useDelayedFocus(firstFieldRef, open && phase === 'symptoms', 50);

  const setConflictField = (i: number, key: keyof CloudConflict, value: string): void => {
    setConflicts((prev) => prev.map((c, j) => (j === i ? { ...c, [key]: value } : c)));
  };
  const setCoreField = (key: keyof CoreCloud, value: string): void => {
    setCore((prev) => ({ ...prev, [key]: value }));
  };

  const allUdesNamed = conflicts.every((c) => c.ude.trim() !== '');
  const allCoreFilled = (Object.values(core) as string[]).every((v) => v.trim() !== '');

  const create = (): void => {
    if (!allCoreFilled) return;
    commit({ conflicts, core, title });
    showToast('success', 'Core cloud created from your 3-cloud diagnosis.');
  };

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-3xl" labelledBy="tc-title" align="top">
      <header className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-500" />
          <h2
            id="tc-title"
            className="font-semibold text-neutral-900 text-sm dark:text-neutral-100"
          >
            Rapid 3-cloud diagnosis
          </h2>
        </div>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close 3-cloud wizard">
          <X className="h-4 w-4" />
        </Button>
      </header>

      {phase === 'symptoms' ? (
        <SymptomsStep
          conflicts={conflicts}
          firstFieldRef={firstFieldRef}
          onField={setConflictField}
        />
      ) : (
        <ConsolidateStep
          conflicts={conflicts}
          core={core}
          title={title}
          onCoreField={setCoreField}
          onTitle={setTitle}
        />
      )}

      <footer className="flex items-center justify-end gap-2 border-neutral-200 border-t px-4 py-3 dark:border-neutral-800">
        {phase === 'symptoms' ? (
          <>
            <span className={`mr-auto ${hintClass}`}>Step 1 of 2 · capture the symptoms</span>
            <Button variant="softNeutral" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => setPhase('consolidate')}
              disabled={!allUdesNamed}
            >
              Next: consolidate <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <span className={`mr-auto ${hintClass}`}>
              Step 2 of 2 · consolidate to a core cloud
            </span>
            <Button variant="softNeutral" onClick={() => setPhase('symptoms')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button variant="primary" onClick={create} disabled={!allCoreFilled}>
              Create core cloud
            </Button>
          </>
        )}
      </footer>
    </Modal>
  );
}
