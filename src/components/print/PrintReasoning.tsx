import { buildReasoningSentences } from '@/domain/reasoningExport';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Print "reasoning companion" — the diagram's cause→effect read-out as a
 * numbered list, printed after the diagram (and after the annotation appendix
 * when both are on). The same sentences the on-screen verbalisation + the
 * Markdown reasoning export produce (`buildReasoningSentences`, diagram-natural
 * reading).
 *
 * Hidden in normal view + until the user ticks "Include reasoning narrative" in
 * the print preview; `print.css` gates visibility on `body.print-include-reasoning`.
 * Mirrors {@link PrintAppendix}; `aria-hidden` keeps the always-in-DOM block out
 * of the screen-reader tree during normal browsing.
 */
export function PrintReasoning() {
  const doc = useDocumentStore((s) => currentDoc(s));
  const sentences = buildReasoningSentences(doc);
  return (
    <aside
      data-component="print-reasoning"
      aria-hidden="true"
      style={{ padding: '24pt 0', fontFamily: 'inherit', color: '#171717' }}
    >
      <h2 style={{ fontSize: '14pt', marginBottom: '12pt' }}>Reasoning</h2>
      {sentences.length === 0 ? (
        <p style={{ fontSize: '11pt', fontStyle: 'italic', color: '#525252' }}>
          No edges drawn yet.
        </p>
      ) : (
        <ol style={{ paddingLeft: '24pt', margin: 0 }}>
          {sentences.map((s) => (
            <li key={s} style={{ marginBottom: '6pt', fontSize: '11pt', lineHeight: 1.4 }}>
              {s}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
