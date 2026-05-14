import { navigateToEntity, resolveEntityRef } from '@/services/entityRefs';
import { renderMarkdown } from '@/services/markdown';
import { useMemo } from 'react';

/**
 * Render a markdown source string as styled, sanitized HTML. Internal entity
 * references rendered with `data-entity-ref` are intercepted on click and
 * resolved to a selection via `navigateToEntity` (FL-AN5).
 */
export function MarkdownPreview({ source }: { source: string }) {
  const html = useMemo(() => renderMarkdown(source), [source]);

  if (!source.trim()) {
    return <p className="text-neutral-400 text-xs italic">No description.</p>;
  }

  // Click + keyboard delegator for internal entity references. Anchors
  // without href but with data-entity-ref are intercepted; everything else
  // falls through to default behavior. Keyboard support handles the
  // a11y/useKeyWithClickEvents lint rule.
  const handle = (target: EventTarget | null): boolean => {
    const el = (target as HTMLElement | null)?.closest('[data-entity-ref]') as HTMLElement | null;
    if (!el) return false;
    const ref = el.getAttribute('data-entity-ref');
    if (!ref) return false;
    const id = resolveEntityRef(ref);
    if (id) navigateToEntity(id);
    return true;
  };
  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: renderMarkdown sanitizes with DOMPurify.
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        if (handle(e.target)) e.preventDefault();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (handle(e.target)) e.preventDefault();
      }}
      className="prose-tp text-neutral-800 text-sm leading-relaxed dark:text-neutral-200"
    />
  );
}
