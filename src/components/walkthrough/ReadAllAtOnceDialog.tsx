import { Copy, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  renderEdgeSentence,
  resolveEdgeConnector,
  topologicalEdgeOrder,
} from '@/domain/edgeReading';
import { useTimeoutFn } from '@/hooks/useTimeoutFn';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/**
 * Session 133 — "Read entire diagram at once" dialog.
 *
 * Alternative to the step-through Read-through walkthrough
 * (`WalkthroughOverlay` in `read-through` mode). Users with large
 * CRTs (50+ edges) reported that clicking through one sentence per
 * page tires the eye; this dialog renders every edge's sentence in
 * topological order in a single scrollable panel, with a Copy button
 * to drop the full transcript into the clipboard for a meeting
 * note / brief / Slack message.
 *
 * Reuses `topologicalEdgeOrder` + `renderEdgeSentence` from
 * `edgeReading.ts` so the wording is identical to what the
 * step-through overlay shows on each page.
 *
 * Empty-state handling: when the diagram has no edges, surface a
 * friendly hint instead of an empty scrollable panel. Same UX shape
 * as the palette command's pre-open check (it shows a toast and
 * skips opening), but in case the user opens directly via the
 * panel command the dialog handles the case too.
 */
export function ReadAllAtOnceDialog() {
  const { open, doc, causalityLabel, close } = useDocumentStore(
    useShallow((s) => ({
      open: s.readAllAtOnceOpen,
      doc: currentDoc(s),
      causalityLabel: s.causalityLabel,
      close: s.closeReadAllAtOnce,
    }))
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const setCopyTimer = useTimeoutFn();

  // Topologically order + render every edge. Memoize on the doc + label
  // so reopening the same diagram doesn't recompute.
  const sentences = useMemo(() => {
    if (!open) return [];
    const order = topologicalEdgeOrder(doc);
    return order
      .map((edgeId) => {
        const edge = doc.edges[edgeId];
        if (!edge) return null;
        const source = doc.entities[edge.sourceId];
        const target = doc.entities[edge.targetId];
        if (!source || !target) return null;
        const connector = resolveEdgeConnector(edge, causalityLabel, doc.diagramType);
        return { edgeId, sentence: renderEdgeSentence(source, target, connector) };
      })
      .filter((x): x is { edgeId: string; sentence: string } => x !== null);
  }, [open, doc, causalityLabel]);

  if (!open) return null;

  const fullText = sentences.map((s) => s.sentence).join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopyState('copied');
      setCopyTimer(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('failed');
      setCopyTimer(() => setCopyState('idle'), 2000);
    }
  };

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-3xl" labelledBy="read-all-at-once-title">
      <div className="flex max-h-[80vh] flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <header className="flex items-center justify-between">
          <div>
            <h2
              id="read-all-at-once-title"
              className="font-semibold text-neutral-900 dark:text-neutral-100"
            >
              Read the diagram aloud
            </h2>
            <p className="mt-1 text-neutral-500 text-xs dark:text-neutral-400">
              Every edge as a sentence, in topological order — copy or read straight through.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        {sentences.length === 0 ? (
          <p className="text-neutral-500 text-sm dark:text-neutral-400">
            No edges to read yet — connect entities first, then re-open.
          </p>
        ) : (
          <ol className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-800 text-sm leading-relaxed dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
            {sentences.map(({ edgeId, sentence }, i) => (
              <li key={edgeId} className="flex gap-2">
                <span className="w-6 shrink-0 text-right text-neutral-400 tabular-nums dark:text-neutral-500">
                  {i + 1}.
                </span>
                <span>{sentence}</span>
              </li>
            ))}
          </ol>
        )}

        <footer className="flex items-center justify-between gap-3 border-neutral-200 border-t pt-4 dark:border-neutral-800">
          <span className="text-neutral-500 text-xs dark:text-neutral-400">
            {sentences.length === 0
              ? ''
              : `${sentences.length} edge${sentences.length === 1 ? '' : 's'} · `}
            Esc closes
          </span>
          <Button
            variant={copyState === 'copied' ? 'softViolet' : 'softNeutral'}
            size="sm"
            onClick={handleCopy}
            disabled={sentences.length === 0}
          >
            <Copy className="h-3.5 w-3.5" />
            {copyState === 'copied'
              ? 'Copied!'
              : copyState === 'failed'
                ? 'Copy failed'
                : 'Copy all'}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
