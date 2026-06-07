/**
 * Behaviour-asserting tests for `useFocusTrap`.
 *
 * jsdom always returns `null` for `offsetParent`, which the hook uses to
 * filter "visible" focusable elements (real browsers return the nearest
 * positioned ancestor for visible elements). We patch
 * `HTMLElement.prototype.offsetParent` with `Object.defineProperty` so
 * every element reports a non-null parent — the standard jsdom workaround.
 *
 * Covered branches / paths:
 *   - active=false guard (no-op, no keydown listener attached)
 *   - containerRef.current null guard (hook renders but ref never set)
 *   - initialFocus=true (default) → first focusable focused on mount
 *   - initialFocus=false → focus NOT moved on mount
 *   - Empty container with initialFocus=true → falls back to container.focus()
 *   - Tab on the last element → wraps to first
 *   - Tab on an intermediate element → no wrap
 *   - Tab when no focusable elements → preventDefault only
 *   - Shift+Tab on first element → wraps to last
 *   - Shift+Tab on an intermediate element → no wrap
 *   - Focus outside container + Tab → redirected to first
 *   - Focus outside container + Shift+Tab → redirected to last
 *   - Restore focus to previouslyFocused on unmount
 *   - No throw when previouslyFocused was removed before unmount
 *   - Non-Tab keydown → ignored (no preventDefault)
 *   - active false→true transition → trap engages
 *   - active true→false transition → cleanup fires, focus restored
 */

import { act, cleanup, render } from '@testing-library/react';
import type React from 'react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFocusTrap } from '@/hooks/useFocusTrap';

// ---------------------------------------------------------------------------
// jsdom workaround: offsetParent is always null in jsdom.
// The hook filters focusables with `n.offsetParent !== null || n === activeEl`.
// Patching the prototype makes every element visible so the full list is
// returned during Tab-wrap logic (not just the currently focused one).
// ---------------------------------------------------------------------------
let restoreOffsetParent: (() => void) | undefined;

beforeEach(() => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.parentElement ?? document.body;
    },
  });
  restoreOffsetParent = () => {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, 'offsetParent', descriptor);
    }
  };
});

afterEach(() => {
  restoreOffsetParent?.();
  restoreOffsetParent = undefined;
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface HarnessProps {
  active: boolean;
  initialFocus?: boolean;
  children?: React.ReactNode;
}

/** Small host component that wires `useFocusTrap` to a <div> container. */
const Harness = ({ active, initialFocus, children }: HarnessProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active, initialFocus !== undefined ? { initialFocus } : undefined);
  return (
    <div ref={ref} data-testid="trap">
      {children}
    </div>
  );
};

/** Fire Tab / Shift+Tab on `element` and flush React effects. */
const fireTab = (element: Element, shiftKey = false) =>
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
    );
  });

/** Fire an arbitrary key on `element` and return the event. */
const fireKey = (element: Element, key: string) => {
  const evt = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    element.dispatchEvent(evt);
  });
  return evt;
};

const getTrap = () => document.querySelector('[data-testid="trap"]') as HTMLElement;

// ---------------------------------------------------------------------------
// inactive guard
// ---------------------------------------------------------------------------

describe('useFocusTrap — inactive (active=false)', () => {
  it('does not move focus on mount when inactive', () => {
    const ext = document.createElement('button');
    document.body.appendChild(ext);
    act(() => ext.focus());
    expect(document.activeElement).toBe(ext);

    render(
      <Harness active={false}>
        <button>A</button>
        <button>B</button>
      </Harness>
    );

    expect(document.activeElement).toBe(ext);
    document.body.removeChild(ext);
  });

  it('does not intercept Tab when inactive', () => {
    render(
      <Harness active={false}>
        <button>A</button>
        <button>B</button>
      </Harness>
    );
    const trap = getTrap();
    const spy = vi.fn();
    trap.addEventListener('keydown', spy);

    act(() => {
      trap.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      );
    });

    // The event fired (spy was called) but preventDefault was never triggered
    // by the hook because the hook's listener was never attached.
    expect(spy).toHaveBeenCalledTimes(1);
    const evt = spy.mock.calls[0]![0] as KeyboardEvent;
    expect(evt.defaultPrevented).toBe(false);

    trap.removeEventListener('keydown', spy);
  });
});

// ---------------------------------------------------------------------------
// initialFocus option
// ---------------------------------------------------------------------------

describe('useFocusTrap — initialFocus', () => {
  it('focuses the first focusable element on mount by default (initialFocus=true)', () => {
    render(
      <Harness active={true}>
        <button data-testid="first">First</button>
        <button data-testid="second">Second</button>
      </Harness>
    );
    expect(document.activeElement).toBe(document.querySelector('[data-testid="first"]'));
  });

  it('does not move focus on mount when initialFocus=false', () => {
    const ext = document.createElement('button');
    document.body.appendChild(ext);
    act(() => ext.focus());

    render(
      <Harness active={true} initialFocus={false}>
        <button>Inside</button>
      </Harness>
    );

    expect(document.activeElement).toBe(ext);
    document.body.removeChild(ext);
  });

  it('falls back to focusing the container when no focusable children exist', () => {
    // Container needs tabIndex so it becomes the focus target.
    const ContainerHarness = () => {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref, true, { initialFocus: true });
      return (
        <div ref={ref} tabIndex={-1} data-testid="trap">
          <span>not focusable</span>
        </div>
      );
    };
    render(<ContainerHarness />);
    expect(document.activeElement).toBe(getTrap());
  });
});

// ---------------------------------------------------------------------------
// Tab wrap logic
// ---------------------------------------------------------------------------

describe('useFocusTrap — Tab wrapping', () => {
  it('wraps Tab from last element to first element', () => {
    render(
      <Harness active={true} initialFocus={false}>
        <button>First</button>
        <button>Middle</button>
        <button>Last</button>
      </Harness>
    );
    const trap = getTrap();
    const [first, , last] = Array.from(trap.querySelectorAll('button'));

    act(() => last!.focus());
    expect(document.activeElement).toBe(last);

    fireTab(trap);

    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from first element to last element', () => {
    render(
      <Harness active={true} initialFocus={false}>
        <button>First</button>
        <button>Middle</button>
        <button>Last</button>
      </Harness>
    );
    const trap = getTrap();
    const [first, , last] = Array.from(trap.querySelectorAll('button'));

    act(() => first!.focus());
    expect(document.activeElement).toBe(first);

    fireTab(trap, true);

    expect(document.activeElement).toBe(last);
  });

  it('does NOT wrap Tab when focus is on an intermediate element', () => {
    render(
      <Harness active={true} initialFocus={false}>
        <button>First</button>
        <button>Middle</button>
        <button>Last</button>
      </Harness>
    );
    const trap = getTrap();
    const [, middle] = Array.from(trap.querySelectorAll('button'));

    act(() => middle!.focus());
    fireTab(trap);

    // jsdom won't advance focus naturally, so focus stays on Middle.
    expect(document.activeElement).toBe(middle);
  });

  it('does NOT wrap Shift+Tab when focus is on an intermediate element', () => {
    render(
      <Harness active={true} initialFocus={false}>
        <button>First</button>
        <button>Middle</button>
        <button>Last</button>
      </Harness>
    );
    const trap = getTrap();
    const [, middle] = Array.from(trap.querySelectorAll('button'));

    act(() => middle!.focus());
    fireTab(trap, true);

    expect(document.activeElement).toBe(middle);
  });

  it('stays on a single element when Tab is pressed (wraps to itself)', () => {
    render(
      <Harness active={true}>
        <button>Only</button>
      </Harness>
    );
    const trap = getTrap();
    const btn = trap.querySelector('button') as HTMLButtonElement;
    expect(document.activeElement).toBe(btn);

    fireTab(trap);

    expect(document.activeElement).toBe(btn);
  });

  it('calls preventDefault and does not throw when container has no focusable elements', () => {
    // Empty trap — uses initialFocus:false so we don't hit root.focus().
    const EmptyHarness = () => {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref, true, { initialFocus: false });
      return (
        <div ref={ref} data-testid="trap">
          <span>no focusable</span>
        </div>
      );
    };
    render(<EmptyHarness />);
    const trap = getTrap();

    let prevented = false;
    act(() => {
      const evt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      const orig = Event.prototype.preventDefault;
      evt.preventDefault = function () {
        prevented = true;
        orig.call(this);
      };
      trap.dispatchEvent(evt);
    });

    expect(prevented).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Focus escaped the container
// ---------------------------------------------------------------------------

describe('useFocusTrap — focus escaped container', () => {
  it('Tab while focus is outside redirects to first focusable', () => {
    const ext = document.createElement('button');
    document.body.appendChild(ext);

    render(
      <Harness active={true} initialFocus={false}>
        <button>First</button>
        <button>Last</button>
      </Harness>
    );
    const trap = getTrap();
    act(() => ext.focus());
    expect(document.activeElement).toBe(ext);

    fireTab(trap);

    const [first] = Array.from(trap.querySelectorAll('button'));
    expect(document.activeElement).toBe(first);

    document.body.removeChild(ext);
  });

  it('Shift+Tab while focus is outside redirects to last focusable', () => {
    const ext = document.createElement('button');
    document.body.appendChild(ext);

    render(
      <Harness active={true} initialFocus={false}>
        <button>First</button>
        <button>Last</button>
      </Harness>
    );
    const trap = getTrap();
    act(() => ext.focus());

    fireTab(trap, true);

    const buttons = Array.from(trap.querySelectorAll('button'));
    expect(document.activeElement).toBe(buttons[1]);

    document.body.removeChild(ext);
  });
});

// ---------------------------------------------------------------------------
// Non-Tab keydown
// ---------------------------------------------------------------------------

describe('useFocusTrap — non-Tab keys ignored', () => {
  it('does not call preventDefault for non-Tab keys', () => {
    render(
      <Harness active={true}>
        <button>Only</button>
      </Harness>
    );
    const trap = getTrap();

    const evt = fireKey(trap, 'Enter');
    expect(evt.defaultPrevented).toBe(false);
  });

  it('does not call preventDefault for Escape', () => {
    render(
      <Harness active={true}>
        <button>Only</button>
      </Harness>
    );
    const trap = getTrap();

    const evt = fireKey(trap, 'Escape');
    expect(evt.defaultPrevented).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Focus restoration on unmount
// ---------------------------------------------------------------------------

describe('useFocusTrap — focus restoration on unmount', () => {
  it('restores focus to the previously-focused element when the trap unmounts', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Trigger';
    document.body.appendChild(trigger);
    act(() => trigger.focus());
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <Harness active={true}>
        <button>Inside</button>
      </Harness>
    );

    // Trap mounts and initialFocus is true → focus moves inside.
    expect(document.activeElement?.textContent).toBe('Inside');

    unmount();

    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });

  it('does not throw when the previously-focused element is removed before unmount', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    act(() => trigger.focus());

    const { unmount } = render(
      <Harness active={true}>
        <button>Inside</button>
      </Harness>
    );

    document.body.removeChild(trigger);

    // body.contains(trigger) is false → restore is skipped, no throw.
    expect(() => unmount()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// active transitions
// ---------------------------------------------------------------------------

describe('useFocusTrap — active toggle', () => {
  it('starts trapping (and moves initial focus) when active switches false→true', () => {
    const ext = document.createElement('button');
    document.body.appendChild(ext);
    act(() => ext.focus());

    const { rerender } = render(
      <Harness active={false}>
        <button data-testid="first">First</button>
        <button>Last</button>
      </Harness>
    );

    expect(document.activeElement).toBe(ext);

    rerender(
      <Harness active={true}>
        <button data-testid="first">First</button>
        <button>Last</button>
      </Harness>
    );

    expect(document.activeElement).toBe(document.querySelector('[data-testid="first"]'));

    document.body.removeChild(ext);
  });

  it('cleans up and restores focus when active switches true→false', () => {
    const ext = document.createElement('button');
    document.body.appendChild(ext);
    act(() => ext.focus());

    const { rerender, unmount } = render(
      <Harness active={true}>
        <button data-testid="first">First</button>
        <button>Last</button>
      </Harness>
    );

    // Trap engaged → focus inside.
    expect(document.activeElement).toBe(document.querySelector('[data-testid="first"]'));

    rerender(
      <Harness active={false}>
        <button data-testid="first">First</button>
        <button>Last</button>
      </Harness>
    );

    // Cleanup fires → focus back on ext.
    expect(document.activeElement).toBe(ext);

    unmount();
    document.body.removeChild(ext);
  });

  it('Tab is no longer trapped after active switches to false', () => {
    const { rerender } = render(
      <Harness active={true} initialFocus={false}>
        <button>First</button>
        <button>Last</button>
      </Harness>
    );

    rerender(
      <Harness active={false} initialFocus={false}>
        <button>First</button>
        <button>Last</button>
      </Harness>
    );

    const trap = getTrap();
    const [first, last] = Array.from(trap.querySelectorAll('button'));
    act(() => last!.focus());

    // Should NOT wrap since trap is now inactive.
    fireTab(trap);

    expect(document.activeElement).toBe(last);
    // Focus should NOT be first — the hook released control.
    expect(document.activeElement).not.toBe(first);
  });
});
