import { printLegendFor } from '@/domain/printLegend';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Print "how-to-read legend" (Session 178) — a one-line, type-specific reading
 * rule printed just under the title so a shared printout explains itself to a
 * reader who doesn't know the Thinking Process.
 *
 * Hidden on screen and until the "Include how-to-read legend" toggle is on
 * (`print.css` gates visibility on `body.print-include-legend`, which
 * `usePrintCanvas` sets from the persisted `printLayout.showLegend` pref so a
 * bare Ctrl+P honours it too). Renders nothing for freeform diagrams, which
 * have no fixed reading rule. `aria-hidden` keeps the always-in-DOM block out
 * of the screen-reader tree during normal browsing.
 */
export function PrintLegend() {
  const diagramType = useDocumentStore((s) => currentDoc(s).diagramType);
  const legend = printLegendFor(diagramType);
  if (!legend) return null;
  return (
    <aside
      data-component="print-legend"
      aria-hidden="true"
      style={{ fontSize: '10pt', fontStyle: 'italic', color: '#525252', margin: '0 0 12pt' }}
    >
      {legend}
    </aside>
  );
}
