import { ancestorChain } from '@/domain/groups';
import { getCanvasInstance } from '@/services/canvasRef';
import { prefersReducedMotion } from '@/services/prefersReducedMotion';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Reveal + focus an entity (or group) on the canvas: expand any collapsed
 * ancestor groups, unhoist if the target sits outside the current hoist, select
 * it, and centre the viewport on it. Shared by the Find panel and the command
 * palette's "Go to…" rows so the two navigation surfaces can't drift. Honours
 * the reduced-motion setting for the camera move.
 */
export const jumpToEntity = (id: string): void => {
  const state = useDocumentStore.getState();
  const ancestors = ancestorChain(currentDoc(state), id);
  // Expand collapsed ancestors so the target becomes visible.
  for (const a of ancestors) {
    if (a.collapsed) state.toggleGroupCollapsed(a.id);
  }
  // If hoisted elsewhere, unhoist so the target is reachable.
  if (state.hoistedGroupId) {
    const inHoist = ancestors.some((a) => a.id === state.hoistedGroupId);
    if (!inHoist && id !== state.hoistedGroupId) state.unhoist();
  }
  state.selectEntity(id);
  const inst = getCanvasInstance();
  const node = inst?.getNode(id);
  if (node && inst) {
    // setCenter is forgiving — defer a frame so the just-mutated selection and
    // any expand/unhoist re-render land first.
    window.requestAnimationFrame(() => {
      inst.setCenter(node.position.x + 140, node.position.y + 40, {
        zoom: inst.getZoom(),
        duration: prefersReducedMotion() ? 0 : 250,
      });
    });
  }
};
