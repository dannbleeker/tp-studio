import { renderEdgeSentence, resolveEdgeConnector } from '@/domain/edgeReading';
import { validationFingerprint } from '@/domain/fingerprint';
import { validate } from '@/domain/validators';
import { useFingerprintMemo } from '@/hooks/useFingerprintMemo';
import { useDocumentStore } from '@/store';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { Button } from '../ui/Button';

/**
 * Walkthrough overlay — fullscreen-ish floating card that steps through an
 * ordered list of "things to consider" one at a time. Two flavors:
 *
 *   - **Read-through** — walks edges in topological order and renders each
 *     as a complete English sentence using the global causality reading
 *     ("[Effect] because [Cause]", "In order to obtain [Effect], [Cause]
 *     must hold", etc.). Forces the user to verbalize each causal step.
 *   - **CLR walkthrough** — walks every open CLR warning one at a time
 *     with three actions: Resolve, Skip, Open in inspector.
 *
 * Keyboard: → / Space advance, ← go back, Esc close. The overlay catches
 * its own keys via a `useEffect`-attached listener (no global keymap
 * change needed) and cleans up on unmount.
 */

export function WalkthroughOverlay() {
  const walkthrough = useDocumentStore((s) => s.walkthrough);
  if (walkthrough.kind === 'closed') return null;
  return <WalkthroughOverlayBody />;
}

function WalkthroughOverlayBody() {
  const {
    walkthrough,
    walkthroughNext,
    walkthroughPrev,
    closeWalkthrough,
    doc,
    causalityLabel,
    selectEdge,
    selectEntity,
    resolveWarning,
  } = useDocumentStore(
    useShallow((s) => ({
      walkthrough: s.walkthrough,
      walkthroughNext: s.walkthroughNext,
      walkthroughPrev: s.walkthroughPrev,
      closeWalkthrough: s.closeWalkthrough,
      doc: s.doc,
      causalityLabel: s.causalityLabel,
      selectEdge: s.selectEdge,
      selectEntity: s.selectEntity,
      resolveWarning: s.resolveWarning,
    }))
  );

  // Esc / Arrow / Space keys.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeWalkthrough();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        walkthroughNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        walkthroughPrev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [walkthroughNext, walkthroughPrev, closeWalkthrough]);

  // Recompute the live warnings only for clr-walkthrough so a Resolve action
  // immediately reflects in the position counter / completion logic. Gating
  // on `validationFingerprint` (instead of the raw `doc` ref) lets
  // title-only / description-only edits skip the re-validation, matching
  // the gating pattern in `Inspector.tsx`.
  const liveWarnings = useFingerprintMemo(
    () => (walkthrough.kind === 'clr-walkthrough' ? validate(doc) : []),
    `${validationFingerprint(doc)}|kind:${walkthrough.kind}`
  );

  if (walkthrough.kind === 'closed') return null;
  const total = walkthrough.targetIds.length;
  const position = `${walkthrough.index + 1} / ${total}`;

  return (
    // biome-ignore lint/a11y/useSemanticElements: native <dialog> conflicts with our keyboard listener.
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard equivalent (Esc) is wired in useEffect.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Walkthrough"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeWalkthrough();
      }}
    >
      <div className="flex max-w-2xl flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <header className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {walkthrough.kind === 'read-through' ? 'Read-through' : 'CLR walkthrough'}
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
              {position}
            </span>
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeWalkthrough}
            aria-label="Close walkthrough"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        {walkthrough.kind === 'read-through' && (
          <ReadThroughBody edgeId={walkthrough.targetIds[walkthrough.index] ?? ''} />
        )}
        {walkthrough.kind === 'clr-walkthrough' && (
          <ClrWalkthroughBody
            warningId={walkthrough.targetIds[walkthrough.index] ?? ''}
            liveWarnings={liveWarnings}
            onResolve={(id) => {
              resolveWarning(id);
              walkthroughNext();
            }}
            onOpenInInspector={(target) => {
              if (target.kind === 'entity') selectEntity(target.id);
              else if (target.kind === 'edge') selectEdge(target.id);
              closeWalkthrough();
            }}
          />
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <Button
            variant="softNeutral"
            size="sm"
            onClick={walkthroughPrev}
            disabled={walkthrough.index === 0}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            ← → arrows to navigate · Esc to close
          </span>
          <Button variant="softViolet" size="sm" onClick={walkthroughNext}>
            {walkthrough.index === total - 1 ? 'Finish' : 'Next'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </footer>
      </div>
    </div>
  );

  function ReadThroughBody({ edgeId }: { edgeId: string }) {
    const edge = doc.edges[edgeId];
    if (!edge) {
      return (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Edge no longer exists.</p>
      );
    }
    const source = doc.entities[edge.sourceId];
    const target = doc.entities[edge.targetId];
    if (!source || !target) {
      return (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Edge endpoints no longer exist.
        </p>
      );
    }
    const connector = resolveEdgeConnector(edge, causalityLabel, doc.diagramType);
    const sentence = renderEdgeSentence(source, target, connector);
    return (
      <div className="flex flex-col gap-3">
        <p className="text-2xl font-medium leading-snug text-neutral-900 dark:text-neutral-100">
          {sentence}
        </p>
        {edge.label && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Edge label: <span className="font-mono">{edge.label}</span>
          </p>
        )}
        <Button
          variant="softNeutral"
          size="sm"
          onClick={() => selectEdge(edge.id)}
          className="self-start"
        >
          Open this edge in the inspector
        </Button>
      </div>
    );
  }
}

function ClrWalkthroughBody({
  warningId,
  liveWarnings,
  onResolve,
  onOpenInInspector,
}: {
  warningId: string;
  liveWarnings: ReturnType<typeof validate>;
  onResolve: (id: string) => void;
  onOpenInInspector: (target: ReturnType<typeof validate>[number]['target']) => void;
}) {
  const warning = liveWarnings.find((w) => w.id === warningId);
  const doc = useDocumentStore((s) => s.doc);
  if (!warning) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Warning resolved or no longer applies.
      </p>
    );
  }
  // Resolve the warning's target into a human-readable description.
  const targetLabel = (() => {
    if (warning.target.kind === 'entity') {
      const e = doc.entities[warning.target.id];
      return e ? `Entity: ${e.title.trim() || 'Untitled'}` : 'Entity (missing)';
    }
    if (warning.target.kind === 'edge') {
      const e = doc.edges[warning.target.id];
      if (!e) return 'Edge (missing)';
      const s = doc.entities[e.sourceId];
      const t = doc.entities[e.targetId];
      return `Edge: ${s?.title.trim() || '?'} → ${t?.title.trim() || '?'}`;
    }
    return 'Document';
  })();

  return (
    <div className="flex flex-col gap-3">
      <span className="inline-flex w-fit items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
        {warning.tier} · {warning.ruleId}
      </span>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{targetLabel}</p>
      <p className="text-base leading-snug text-neutral-900 dark:text-neutral-100">
        {warning.message}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="softViolet" size="sm" onClick={() => onResolve(warning.id)}>
          <Check className="h-3.5 w-3.5" />
          Resolve
        </Button>
        <Button variant="softNeutral" size="sm" onClick={() => onOpenInInspector(warning.target)}>
          Open in inspector
        </Button>
      </div>
    </div>
  );
}
