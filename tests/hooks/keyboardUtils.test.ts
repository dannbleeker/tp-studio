import { describe, expect, it } from 'vitest';
import { isEditableTarget, isInteractiveTarget } from '@/hooks/keyboardUtils';

/**
 * `isInteractiveTarget` gates the bare-key canvas shortcuts in
 * `useSelectionShortcuts` so they defer to a focused control. The canvas itself
 * must NOT be caught: React Flow marks the pane `role="application"` and a node
 * `role="group"`, neither of which is in the denylist — otherwise the primary
 * "select a node, press Delete" gesture would break.
 */
const el = (html: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild as HTMLElement;
};

describe('isInteractiveTarget', () => {
  it('is true on a button, a link with href, or a select', () => {
    expect(isInteractiveTarget(el('<button>x</button>'))).toBe(true);
    expect(isInteractiveTarget(el('<a href="#">x</a>'))).toBe(true);
    expect(isInteractiveTarget(el('<select><option>a</option></select>'))).toBe(true);
  });

  it('is true on ARIA button / menuitem roles', () => {
    expect(isInteractiveTarget(el('<div role="button">x</div>'))).toBe(true);
    expect(isInteractiveTarget(el('<div role="menuitem">x</div>'))).toBe(true);
  });

  it('is true for a focusable child inside a control (via closest)', () => {
    const button = el('<button><span>label</span></button>');
    expect(isInteractiveTarget(button.querySelector('span'))).toBe(true);
  });

  it('is false on the canvas pane (role=application) and a node (role=group)', () => {
    // The two markers React Flow puts on the canvas — must stay deletable.
    expect(isInteractiveTarget(el('<div role="application"></div>'))).toBe(false);
    expect(isInteractiveTarget(el('<div role="group"></div>'))).toBe(false);
  });

  it('is false on a plain div, an anchor without href, null, and window', () => {
    expect(isInteractiveTarget(el('<div></div>'))).toBe(false);
    expect(isInteractiveTarget(el('<a>no href</a>'))).toBe(false);
    expect(isInteractiveTarget(null)).toBe(false);
    expect(isInteractiveTarget(window)).toBe(false);
  });
});

describe('isEditableTarget', () => {
  it('is true on input / textarea, falsy on a button or null', () => {
    expect(isEditableTarget(el('<input />'))).toBe(true);
    expect(isEditableTarget(el('<textarea></textarea>'))).toBe(true);
    // jsdom leaves `isContentEditable` undefined on a plain button; the value is
    // falsy either way, which is all the `|| isInteractiveTarget(...)` OR needs.
    expect(isEditableTarget(el('<button>x</button>'))).toBeFalsy();
    expect(isEditableTarget(null)).toBe(false);
  });
});
