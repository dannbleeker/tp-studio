import { useStore as useRFStore } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Renders a pin per free-floating ("point"-anchored) top-level review comment
 * at its canvas coordinate. The pin's screen position tracks pan/zoom via the
 * React Flow viewport transform, but the pin itself stays a constant on-screen
 * size (it is NOT scaled with zoom) so it's always readable. Clicking a pin
 * opens the Comments panel.
 *
 * Rendered inside `<ReactFlow>` (so `useRFStore` has the transform) as an
 * absolutely-positioned, pointer-events-none layer; only the pin buttons
 * themselves catch pointer events.
 */
export function CommentPinsOverlay() {
  const transform = useRFStore((s) => s.transform);
  const comments = useDocumentStore((s) => currentDoc(s).comments);
  const openCommentsPanel = useDocumentStore((s) => s.openCommentsPanel);

  const [tx, ty, scale] = transform;
  const pins = comments
    ? Object.values(comments).filter((c) => c.parentId === undefined && c.anchor.kind === 'point')
    : [];
  if (pins.length === 0) return null;

  return (
    <div
      data-component="comment-pins-overlay"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {pins.map((c) => {
        if (c.anchor.kind !== 'point') return null;
        // Flow coordinate → screen: scale + translate by the viewport
        // transform. The pin size is constant (not multiplied by scale).
        const left = c.anchor.x * scale + tx;
        const top = c.anchor.y * scale + ty;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => openCommentsPanel()}
            style={{ left, top }}
            // `-translate-x-1/2 -translate-y-full` + the squared bottom-left
            // corner anchor the pin's tip at the exact point, map-marker style.
            className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-full items-center rounded-full rounded-bl-none border border-accent-300 bg-accent-50 p-1 text-accent-700 shadow-sm transition hover:bg-accent-100 dark:border-accent-700 dark:bg-accent-950 dark:text-accent-200 dark:hover:bg-accent-900"
            title={`Pinned comment: ${c.body.slice(0, 80)}`}
            aria-label={`Pinned review comment by ${c.author || 'Anonymous'} — open the Comments panel`}
          >
            <MessageSquare className="h-3 w-3" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
