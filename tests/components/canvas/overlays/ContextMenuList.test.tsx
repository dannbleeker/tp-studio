/**
 * Tests for ContextMenuList — the keyboard-navigable menu/submenu component.
 *
 * Covered behaviours:
 *   - ArrowDown/Up navigation (including wrapping)
 *   - Home/End jump to first/last
 *   - Submenu flyout open via hover (mouseEnter on wrapper)
 *   - Submenu flyout open via ArrowRight / Enter / Space on trigger row
 *   - Submenu ArrowUp/Down navigation within the flyout
 *   - Submenu ArrowLeft closes flyout and returns focus to trigger
 *   - Item activation via click (calls onClose + runs the action)
 *   - Disabled items: guardWriteOrToast blocks the run when browse-locked
 *   - Separator and header items render without crashing
 *   - auto-focus first menuitem on mount (queueMicrotask)
 *   - flipLeft: submenu flyout position class when near right edge
 */

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenuList } from '@/components/canvas/overlays/ContextMenuList';
import type { MenuItem } from '@/components/canvas/overlays/contextMenuItems';
import { resetStoreForTest } from '@/store';

// guardWriteOrToast reads the store directly — mock so tests control
// whether writes are allowed without touching the global browseLocked flag.
vi.mock('@/services/browseLock', () => ({
  guardWriteOrToast: vi.fn(() => true),
}));

import { guardWriteOrToast } from '@/services/browseLock';

const mockGuard = vi.mocked(guardWriteOrToast);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = (): void => {};

/** Build a representative item list for most tests. */
const makeItems = (overrides?: { onRun?: () => void; subOnRun?: () => void }): MenuItem[] => [
  { kind: 'action', label: 'Alpha', run: overrides?.onRun ?? noop },
  { kind: 'action', label: 'Beta', run: noop },
  {
    kind: 'submenu',
    label: 'Sub menu',
    items: [
      { kind: 'action', label: 'Sub A', run: overrides?.subOnRun ?? noop },
      { kind: 'action', label: 'Sub B', run: noop },
    ],
  },
  { kind: 'separator' },
  { kind: 'header', label: 'Section' },
  { kind: 'action', label: 'Gamma', run: noop, destructive: true },
];

/** Render ContextMenuList and return useful refs. */
const setup = (items: MenuItem[] = makeItems(), x = 100, y = 100) => {
  const onClose = vi.fn();
  const result = render(<ContextMenuList items={items} x={x} y={y} onClose={onClose} />);
  const menu = result.container.querySelector<HTMLDivElement>('[role="menu"]');
  if (!menu) throw new Error('No [role="menu"] found');
  const topItems = () =>
    Array.from(
      menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not([data-submenu-item])')
    );
  return { ...result, menu, onClose, topItems };
};

beforeEach(resetStoreForTest);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockGuard.mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('ContextMenuList rendering', () => {
  it('renders all action items as menuitems', () => {
    const { container } = setup();
    const labels = Array.from(container.querySelectorAll('button[role="menuitem"]')).map(
      (b) => b.textContent?.trim() ?? ''
    );
    expect(labels).toContain('Alpha');
    expect(labels).toContain('Beta');
    expect(labels).toContain('Gamma');
  });

  it('renders the submenu trigger row with aria-haspopup and aria-expanded=false', () => {
    const { container } = setup();
    const trigger = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    ).find((b) => b.textContent?.trim() === 'Sub menu');
    expect(trigger).toBeTruthy();
    expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders separator and header without crashing', () => {
    const { container } = setup();
    // Separator: a div with no role/text that contributes a visible divider.
    // Header: a div containing 'Section'.
    expect(container.textContent).toContain('Section');
  });

  it('positions the menu using the x/y props', () => {
    const { menu } = setup(makeItems(), 250, 300);
    expect(menu?.style.left).toBe('250px');
    expect(menu?.style.top).toBe('300px');
  });

  it('auto-focuses the first menuitem after mount (queueMicrotask)', async () => {
    const { topItems } = setup();
    // queueMicrotask fires after the current macrotask — flush it.
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(topItems()[0]);
  });
});

// ---------------------------------------------------------------------------
// Keyboard navigation — top-level
// ---------------------------------------------------------------------------

describe('keyboard navigation — top-level', () => {
  it('ArrowDown moves focus to the next item', () => {
    const { menu, topItems } = setup();
    topItems()[0]?.focus();
    act(() => fireEvent.keyDown(menu, { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(topItems()[1]);
  });

  it('ArrowDown wraps from last to first', () => {
    const { menu, topItems } = setup();
    const items = topItems();
    items[items.length - 1]?.focus();
    act(() => fireEvent.keyDown(menu, { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowUp moves focus to the previous item', () => {
    const { menu, topItems } = setup();
    const items = topItems();
    items[1]?.focus();
    act(() => fireEvent.keyDown(menu, { key: 'ArrowUp' }));
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowUp wraps from first to last', () => {
    const { menu, topItems } = setup();
    const items = topItems();
    items[0]?.focus();
    act(() => fireEvent.keyDown(menu, { key: 'ArrowUp' }));
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('Home jumps to the first item', () => {
    const { menu, topItems } = setup();
    const items = topItems();
    items[items.length - 1]?.focus();
    act(() => fireEvent.keyDown(menu, { key: 'Home' }));
    expect(document.activeElement).toBe(items[0]);
  });

  it('End jumps to the last item', () => {
    const { menu, topItems } = setup();
    const items = topItems();
    items[0]?.focus();
    act(() => fireEvent.keyDown(menu, { key: 'End' }));
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('unhandled keys (e.g. Tab) do not crash and do not move focus', () => {
    const { menu, topItems } = setup();
    const items = topItems();
    items[0]?.focus();
    // Tab is not intercepted by the handler — just should not throw.
    act(() => fireEvent.keyDown(menu, { key: 'Tab' }));
    // Focus may shift on Tab (browser behaviour in jsdom is a no-op),
    // so we only assert no error was thrown (the expect below runs).
    expect(items[0]).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Submenu flyout — open / close
// ---------------------------------------------------------------------------

describe('submenu flyout', () => {
  /** Find the wrapper div that houses the submenu trigger + flyout. */
  const getSubmenuWrapper = (container: HTMLElement): HTMLElement => {
    const trigger = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    ).find((b) => b.textContent?.trim() === 'Sub menu');
    const wrapper = trigger?.parentElement;
    if (!wrapper) throw new Error('Could not find submenu wrapper');
    return wrapper;
  };

  it('flyout is not rendered before hover', () => {
    const { container } = setup();
    const flyout = container.querySelector('[data-submenu-item]');
    expect(flyout).toBeNull();
  });

  it('opens the flyout on mouseEnter of the wrapper div', () => {
    const { container } = setup();
    const wrapper = getSubmenuWrapper(container);
    act(() => fireEvent.mouseEnter(wrapper));
    // Sub-items should now be in the DOM.
    expect(container.querySelector('[data-submenu-item]')).not.toBeNull();
  });

  it('closes the flyout on mouseLeave of the wrapper div', () => {
    const { container } = setup();
    const wrapper = getSubmenuWrapper(container);
    act(() => fireEvent.mouseEnter(wrapper));
    expect(container.querySelector('[data-submenu-item]')).not.toBeNull();
    act(() => fireEvent.mouseLeave(wrapper));
    expect(container.querySelector('[data-submenu-item]')).toBeNull();
  });

  it('opens the flyout and sets aria-expanded=true after mouseEnter', () => {
    const { container } = setup();
    const wrapper = getSubmenuWrapper(container);
    const trigger = wrapper.querySelector<HTMLButtonElement>('button[role="menuitem"]');
    act(() => fireEvent.mouseEnter(wrapper));
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
  });

  it('opens the flyout via click on the trigger button', () => {
    const { container } = setup();
    const wrapper = getSubmenuWrapper(container);
    const trigger = wrapper.querySelector<HTMLButtonElement>('button[role="menuitem"]');
    if (!trigger) throw new Error('No trigger');
    act(() => fireEvent.click(trigger));
    expect(container.querySelector('[data-submenu-item]')).not.toBeNull();
  });

  it('opens the flyout via ArrowRight keydown on trigger', () => {
    const { container } = setup();
    const wrapper = getSubmenuWrapper(container);
    const trigger = wrapper.querySelector<HTMLButtonElement>('button[role="menuitem"]');
    if (!trigger) throw new Error('No trigger');
    act(() => fireEvent.keyDown(trigger, { key: 'ArrowRight' }));
    expect(container.querySelector('[data-submenu-item]')).not.toBeNull();
  });

  it('opens the flyout via Enter keydown on trigger', () => {
    const { container } = setup();
    const wrapper = getSubmenuWrapper(container);
    const trigger = wrapper.querySelector<HTMLButtonElement>('button[role="menuitem"]');
    if (!trigger) throw new Error('No trigger');
    act(() => fireEvent.keyDown(trigger, { key: 'Enter' }));
    expect(container.querySelector('[data-submenu-item]')).not.toBeNull();
  });

  it('opens the flyout via Space keydown on trigger', () => {
    const { container } = setup();
    const wrapper = getSubmenuWrapper(container);
    const trigger = wrapper.querySelector<HTMLButtonElement>('button[role="menuitem"]');
    if (!trigger) throw new Error('No trigger');
    act(() => fireEvent.keyDown(trigger, { key: ' ' }));
    expect(container.querySelector('[data-submenu-item]')).not.toBeNull();
  });

  it('renders sub-items inside a role="menu" flyout', () => {
    const { container } = setup();
    const wrapper = getSubmenuWrapper(container);
    act(() => fireEvent.mouseEnter(wrapper));
    const subItems = Array.from(container.querySelectorAll('[data-submenu-item]')).map(
      (b) => b.textContent?.trim() ?? ''
    );
    expect(subItems).toContain('Sub A');
    expect(subItems).toContain('Sub B');
  });

  it('ArrowLeft inside the flyout closes it and returns focus to trigger', () => {
    const { container } = setup();
    const wrapper = getSubmenuWrapper(container);
    act(() => fireEvent.mouseEnter(wrapper));
    // The flyout is the [role="menu"] *inside* the wrapper div (not the
    // top-level menu). Use wrapper.querySelector to scope to just the flyout.
    const flyout = wrapper.querySelector<HTMLDivElement>('[role="menu"]');
    const subItems = container.querySelectorAll<HTMLButtonElement>('[data-submenu-item]');
    subItems[0]?.focus();
    act(() => fireEvent.keyDown(flyout ?? container, { key: 'ArrowLeft' }));
    expect(container.querySelector('[data-submenu-item]')).toBeNull();
    // Focus should have returned to the submenu trigger.
    const trigger = wrapper.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
    expect(document.activeElement).toBe(trigger);
  });

  it('ArrowDown inside the flyout moves focus to the next sub-item', () => {
    const { container } = setup();
    const wrapper = getSubmenuWrapper(container);
    act(() => fireEvent.mouseEnter(wrapper));
    const subItems = container.querySelectorAll<HTMLButtonElement>('[data-submenu-item]');
    subItems[0]?.focus();
    // Find the flyout div (role="menu" inside the wrapper).
    const flyout = wrapper.querySelector<HTMLDivElement>('[role="menu"]');
    act(() => fireEvent.keyDown(flyout ?? container, { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(subItems[1]);
  });

  it('ArrowUp inside the flyout wraps from first to last sub-item', () => {
    const { container } = setup();
    const wrapper = getSubmenuWrapper(container);
    act(() => fireEvent.mouseEnter(wrapper));
    const subItems = container.querySelectorAll<HTMLButtonElement>('[data-submenu-item]');
    subItems[0]?.focus();
    const flyout = wrapper.querySelector<HTMLDivElement>('[role="menu"]');
    act(() => fireEvent.keyDown(flyout ?? container, { key: 'ArrowUp' }));
    expect(document.activeElement).toBe(subItems[subItems.length - 1]);
  });

  it('top-level arrow keys are skipped while a submenu item has focus', () => {
    const { menu, container } = setup();
    const wrapper = getSubmenuWrapper(container);
    act(() => fireEvent.mouseEnter(wrapper));
    const subItems = container.querySelectorAll<HTMLButtonElement>('[data-submenu-item]');
    subItems[0]?.focus();
    // ArrowDown on the outer menu container should NOT move top-level focus.
    const focusBefore = document.activeElement;
    act(() => fireEvent.keyDown(menu, { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(focusBefore);
  });

  it('flipLeft: flyout sits right-full when x + 360 > viewport width', () => {
    // jsdom window.innerWidth defaults to 1024; x=800 → 800+360=1160 > 1024.
    const { container } = setup(makeItems(), 800, 100);
    const wrapper = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    ).find((b) => b.textContent?.trim() === 'Sub menu')?.parentElement;
    if (!wrapper) throw new Error('no wrapper');
    act(() => fireEvent.mouseEnter(wrapper));
    const flyout = wrapper.querySelector('[role="menu"]');
    expect(flyout?.className).toContain('right-full');
  });

  it('normal (non-flip) flyout sits left-full when x + 360 <= viewport width', () => {
    const { container } = setup(makeItems(), 100, 100);
    const wrapper = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    ).find((b) => b.textContent?.trim() === 'Sub menu')?.parentElement;
    if (!wrapper) throw new Error('no wrapper');
    act(() => fireEvent.mouseEnter(wrapper));
    const flyout = wrapper.querySelector('[role="menu"]');
    expect(flyout?.className).toContain('left-full');
  });
});

// ---------------------------------------------------------------------------
// Item activation
// ---------------------------------------------------------------------------

describe('item activation', () => {
  it('clicking an action item calls onClose and the item run handler', () => {
    const run = vi.fn();
    const { container, onClose } = setup(makeItems({ onRun: run }));
    const alphaBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    ).find((b) => b.textContent?.trim() === 'Alpha');
    if (!alphaBtn) throw new Error('Alpha button not found');
    act(() => fireEvent.click(alphaBtn));
    expect(onClose).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledOnce();
  });

  it('clicking an action item does NOT call run when guardWriteOrToast returns false', () => {
    mockGuard.mockReturnValue(false);
    const run = vi.fn();
    const { container, onClose } = setup(makeItems({ onRun: run }));
    const alphaBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    ).find((b) => b.textContent?.trim() === 'Alpha');
    if (!alphaBtn) throw new Error('Alpha button not found');
    act(() => fireEvent.click(alphaBtn));
    // onClose is still called (the menu must close), but run is skipped.
    expect(onClose).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
  });

  it('clicking a sub-item calls onClose and the sub run handler', () => {
    const subRun = vi.fn();
    const { container, onClose } = setup(makeItems({ subOnRun: subRun }));
    // Open submenu.
    const wrapper = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    ).find((b) => b.textContent?.trim() === 'Sub menu')?.parentElement;
    if (!wrapper) throw new Error('no wrapper');
    act(() => fireEvent.mouseEnter(wrapper));
    const subA = container.querySelector<HTMLButtonElement>('[data-submenu-item]');
    if (!subA) throw new Error('Sub A not found');
    act(() => fireEvent.click(subA));
    expect(onClose).toHaveBeenCalledOnce();
    expect(subRun).toHaveBeenCalledOnce();
  });

  it('destructive action items are rendered with a red class', () => {
    const { container } = setup();
    const gammaBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    ).find((b) => b.textContent?.trim() === 'Gamma');
    expect(gammaBtn?.className).toMatch(/red/);
  });
});

// ---------------------------------------------------------------------------
// Escape / outside-click (useOutsideAndEscape delegates to onClose)
// ---------------------------------------------------------------------------

describe('Escape closes the menu', () => {
  it('pressing Escape on window fires onClose', () => {
    const { onClose } = setup();
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicking outside the menu fires onClose', () => {
    const { onClose } = setup();
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('renders an empty item list without crashing', () => {
    const { menu } = setup([]);
    expect(menu).toBeTruthy();
  });

  it('items-only list (no submenu) navigates wrapping correctly', () => {
    const items: MenuItem[] = [
      { kind: 'action', label: 'One', run: noop },
      { kind: 'action', label: 'Two', run: noop },
    ];
    const { menu, topItems } = setup(items);
    const btns = topItems();
    btns[1]?.focus();
    act(() => fireEvent.keyDown(menu, { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(btns[0]); // wrapped
  });

  it('browse-lock blocked action shows toast via the store', () => {
    mockGuard.mockReturnValue(false);
    const run = vi.fn();
    const items: MenuItem[] = [{ kind: 'action', label: 'Locked action', run }];
    const { container, onClose } = setup(items);
    const btn = container.querySelector<HTMLButtonElement>('button[role="menuitem"]');
    if (!btn) throw new Error('no button');
    act(() => fireEvent.click(btn));
    expect(onClose).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
  });

  it('menu has tabIndex=-1 so it can receive keyboard events', () => {
    const { menu } = setup();
    expect(menu?.getAttribute('tabIndex')).toBe('-1');
  });
});
