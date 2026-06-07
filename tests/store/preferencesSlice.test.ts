import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Coverage for the uncovered setters in `preferencesSlice.ts` that are not
 * already exercised by `preferencesReset.test.ts`, `appMode.test.ts`, or
 * `creationWizard.test.ts`. Each group targets one setter and asserts:
 *   1. The new value is reflected in the store immediately after the call.
 *   2. Where relevant, any side effect (e.g. browse-lock auto-engage) also
 *      fires correctly.
 */

const s = () => useDocumentStore.getState();

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // defensive
  }
  resetStoreForTest();
});

// ─── toggleTheme ──────────────────────────────────────────────────────────────

describe('toggleTheme', () => {
  it("flips light → dark when theme is 'light'", () => {
    s().setTheme('light');
    s().toggleTheme();
    expect(s().theme).toBe('dark');
  });

  it("flips dark → light when theme is 'dark'", () => {
    s().setTheme('dark');
    s().toggleTheme();
    expect(s().theme).toBe('light');
  });
});

// ─── setAnimationSpeed ────────────────────────────────────────────────────────

describe('setAnimationSpeed', () => {
  it("defaults to 'default'", () => {
    expect(s().animationSpeed).toBe('default');
  });

  it("switches to 'fast'", () => {
    s().setAnimationSpeed('fast');
    expect(s().animationSpeed).toBe('fast');
  });

  it("switches to 'slow'", () => {
    s().setAnimationSpeed('slow');
    expect(s().animationSpeed).toBe('slow');
  });

  it("switches to 'instant'", () => {
    s().setAnimationSpeed('instant');
    expect(s().animationSpeed).toBe('instant');
  });

  it('persists the new speed to localStorage', () => {
    s().setAnimationSpeed('fast');
    const raw = localStorage.getItem('tp-studio:prefs:v1');
    expect(raw).not.toBeNull();
    if (raw) {
      const parsed = JSON.parse(raw) as { animationSpeed?: string };
      expect(parsed.animationSpeed).toBe('fast');
    }
  });
});

// ─── setEdgeRouting ───────────────────────────────────────────────────────────

describe('setEdgeRouting', () => {
  it("defaults to 'smart'", () => {
    expect(s().edgeRouting).toBe('smart');
  });

  it("switches to 'direct'", () => {
    s().setEdgeRouting('direct');
    expect(s().edgeRouting).toBe('direct');
  });

  it("switches back to 'smart'", () => {
    s().setEdgeRouting('direct');
    s().setEdgeRouting('smart');
    expect(s().edgeRouting).toBe('smart');
  });

  it('persists the routing choice to localStorage', () => {
    s().setEdgeRouting('direct');
    const raw = localStorage.getItem('tp-studio:prefs:v1');
    expect(raw).not.toBeNull();
    if (raw) {
      const parsed = JSON.parse(raw) as { edgeRouting?: string };
      expect(parsed.edgeRouting).toBe('direct');
    }
  });
});

// ─── setLayoutMode ────────────────────────────────────────────────────────────

describe('setLayoutMode', () => {
  it("defaults to 'flow'", () => {
    expect(s().layoutMode).toBe('flow');
  });

  it("switches to 'radial'", () => {
    s().setLayoutMode('radial');
    expect(s().layoutMode).toBe('radial');
  });

  it("switches back to 'flow'", () => {
    s().setLayoutMode('radial');
    s().setLayoutMode('flow');
    expect(s().layoutMode).toBe('flow');
  });
});

// ─── setLayoutDensity ─────────────────────────────────────────────────────────

describe('setLayoutDensity', () => {
  it("defaults to 'balanced'", () => {
    expect(s().layoutDensity).toBe('balanced');
  });

  it("switches to 'compact'", () => {
    s().setLayoutDensity('compact');
    expect(s().layoutDensity).toBe('compact');
  });

  it("switches to 'spacious'", () => {
    s().setLayoutDensity('spacious');
    expect(s().layoutDensity).toBe('spacious');
  });

  it("switches back to 'balanced'", () => {
    s().setLayoutDensity('compact');
    s().setLayoutDensity('balanced');
    expect(s().layoutDensity).toBe('balanced');
  });

  it('persists the density to localStorage', () => {
    s().setLayoutDensity('compact');
    const raw = localStorage.getItem('tp-studio:prefs:v1');
    expect(raw).not.toBeNull();
    if (raw) {
      const parsed = JSON.parse(raw) as { layoutDensity?: string };
      expect(parsed.layoutDensity).toBe('compact');
    }
  });
});

// ─── setPrintInkSaver ─────────────────────────────────────────────────────────

describe('setPrintInkSaver', () => {
  it('defaults to false', () => {
    expect(s().printInkSaver).toBe(false);
  });

  it('enables ink saver', () => {
    s().setPrintInkSaver(true);
    expect(s().printInkSaver).toBe(true);
  });

  it('disables ink saver', () => {
    s().setPrintInkSaver(true);
    s().setPrintInkSaver(false);
    expect(s().printInkSaver).toBe(false);
  });
});

// ─── setCommentAuthorName ─────────────────────────────────────────────────────

describe('setCommentAuthorName', () => {
  it("defaults to ''", () => {
    expect(s().commentAuthorName).toBe('');
  });

  it('sets the author name', () => {
    s().setCommentAuthorName('Alice');
    expect(s().commentAuthorName).toBe('Alice');
  });

  it('clears the author name', () => {
    s().setCommentAuthorName('Alice');
    s().setCommentAuthorName('');
    expect(s().commentAuthorName).toBe('');
  });

  it('persists the name to localStorage', () => {
    s().setCommentAuthorName('Bob');
    const raw = localStorage.getItem('tp-studio:prefs:v1');
    expect(raw).not.toBeNull();
    if (raw) {
      const parsed = JSON.parse(raw) as { commentAuthorName?: string };
      expect(parsed.commentAuthorName).toBe('Bob');
    }
  });
});

// ─── setShowReachBadges ───────────────────────────────────────────────────────

describe('setShowReachBadges', () => {
  it('defaults to false', () => {
    expect(s().showReachBadges).toBe(false);
  });

  it('enables reach badges', () => {
    s().setShowReachBadges(true);
    expect(s().showReachBadges).toBe(true);
  });

  it('disables reach badges', () => {
    s().setShowReachBadges(true);
    s().setShowReachBadges(false);
    expect(s().showReachBadges).toBe(false);
  });
});

// ─── setShowReverseReachBadges ────────────────────────────────────────────────

describe('setShowReverseReachBadges', () => {
  it('defaults to false', () => {
    expect(s().showReverseReachBadges).toBe(false);
  });

  it('enables reverse reach badges', () => {
    s().setShowReverseReachBadges(true);
    expect(s().showReverseReachBadges).toBe(true);
  });

  it('disables reverse reach badges', () => {
    s().setShowReverseReachBadges(true);
    s().setShowReverseReachBadges(false);
    expect(s().showReverseReachBadges).toBe(false);
  });
});

// ─── setShowActionEligibility ─────────────────────────────────────────────────

describe('setShowActionEligibility', () => {
  it('defaults to false', () => {
    expect(s().showActionEligibility).toBe(false);
  });

  it('enables the action-eligibility badge', () => {
    s().setShowActionEligibility(true);
    expect(s().showActionEligibility).toBe(true);
  });

  it('disables the action-eligibility badge', () => {
    s().setShowActionEligibility(true);
    s().setShowActionEligibility(false);
    expect(s().showActionEligibility).toBe(false);
  });
});

// ─── setVerbalisationStripCollapsed ───────────────────────────────────────────

describe('setVerbalisationStripCollapsed', () => {
  it('defaults to true (collapsed per Session 87 UX feedback)', () => {
    expect(s().verbalisationStripCollapsed).toBe(true);
  });

  it('expands the strip', () => {
    s().setVerbalisationStripCollapsed(false);
    expect(s().verbalisationStripCollapsed).toBe(false);
  });

  it('collapses the strip again', () => {
    s().setVerbalisationStripCollapsed(false);
    s().setVerbalisationStripCollapsed(true);
    expect(s().verbalisationStripCollapsed).toBe(true);
  });

  it('persists the collapse state to localStorage', () => {
    s().setVerbalisationStripCollapsed(false);
    const raw = localStorage.getItem('tp-studio:prefs:v1');
    expect(raw).not.toBeNull();
    if (raw) {
      const parsed = JSON.parse(raw) as { verbalisationStripCollapsed?: boolean };
      expect(parsed.verbalisationStripCollapsed).toBe(false);
    }
  });
});

// ─── setECChromeCollapsed ─────────────────────────────────────────────────────

describe('setECChromeCollapsed', () => {
  it('defaults to true (hidden per Session 89 cleanup)', () => {
    expect(s().ecChromeCollapsed).toBe(true);
  });

  it('shows the EC chrome', () => {
    s().setECChromeCollapsed(false);
    expect(s().ecChromeCollapsed).toBe(false);
  });

  it('hides it again', () => {
    s().setECChromeCollapsed(false);
    s().setECChromeCollapsed(true);
    expect(s().ecChromeCollapsed).toBe(true);
  });
});

// ─── setOpenDocsInNewTab ──────────────────────────────────────────────────────

describe('setOpenDocsInNewTab', () => {
  it('defaults to true', () => {
    expect(s().openDocsInNewTab).toBe(true);
  });

  it('disables new-tab behaviour', () => {
    s().setOpenDocsInNewTab(false);
    expect(s().openDocsInNewTab).toBe(false);
  });

  it('re-enables new-tab behaviour', () => {
    s().setOpenDocsInNewTab(false);
    s().setOpenDocsInNewTab(true);
    expect(s().openDocsInNewTab).toBe(true);
  });

  it('persists the pref to localStorage', () => {
    s().setOpenDocsInNewTab(false);
    const raw = localStorage.getItem('tp-studio:prefs:v1');
    expect(raw).not.toBeNull();
    if (raw) {
      const parsed = JSON.parse(raw) as { openDocsInNewTab?: boolean };
      expect(parsed.openDocsInNewTab).toBe(false);
    }
  });
});

// ─── setPrintLayout ───────────────────────────────────────────────────────────

describe('setPrintLayout', () => {
  it('starts with the default A4 portrait fit-page layout', () => {
    const pl = s().printLayout;
    expect(pl.paper).toBe('a4');
    expect(pl.orientation).toBe('portrait');
    expect(pl.scale).toBe('fit-page');
    expect(pl.showLegend).toBe(true);
  });

  it('patches paper to letter without touching other fields', () => {
    s().setPrintLayout({ paper: 'letter' });
    const pl = s().printLayout;
    expect(pl.paper).toBe('letter');
    expect(pl.orientation).toBe('portrait'); // unchanged
    expect(pl.scale).toBe('fit-page'); // unchanged
  });

  it('patches orientation to landscape', () => {
    s().setPrintLayout({ orientation: 'landscape' });
    expect(s().printLayout.orientation).toBe('landscape');
  });

  it('patches scale to fit-width', () => {
    s().setPrintLayout({ scale: 'fit-width' });
    expect(s().printLayout.scale).toBe('fit-width');
  });

  it('patches showLegend to false', () => {
    s().setPrintLayout({ showLegend: false });
    expect(s().printLayout.showLegend).toBe(false);
  });

  it('merges multiple patch fields at once', () => {
    s().setPrintLayout({ paper: 'letter', orientation: 'landscape', scale: 'fit-width' });
    const pl = s().printLayout;
    expect(pl.paper).toBe('letter');
    expect(pl.orientation).toBe('landscape');
    expect(pl.scale).toBe('fit-width');
  });

  it('persists the print layout to localStorage', () => {
    s().setPrintLayout({ paper: 'letter' });
    const raw = localStorage.getItem('tp-studio:prefs:v1');
    expect(raw).not.toBeNull();
    if (raw) {
      const parsed = JSON.parse(raw) as { printLayout?: { paper?: string } };
      expect(parsed.printLayout?.paper).toBe('letter');
    }
  });
});

// ─── dismissSelectionToolbarTip ───────────────────────────────────────────────

describe('dismissSelectionToolbarTip', () => {
  it('starts un-dismissed so first-time users see the discoverability tip', () => {
    expect(s().selectionToolbarTipDismissed).toBe(false);
  });

  it('dismisses the tip on first call', () => {
    s().dismissSelectionToolbarTip();
    expect(s().selectionToolbarTipDismissed).toBe(true);
  });

  it('is idempotent — repeated calls leave it true and do not throw', () => {
    s().dismissSelectionToolbarTip();
    s().dismissSelectionToolbarTip();
    s().dismissSelectionToolbarTip();
    expect(s().selectionToolbarTipDismissed).toBe(true);
  });

  it('persists the dismissal to localStorage', () => {
    s().dismissSelectionToolbarTip();
    const raw = localStorage.getItem('tp-studio:prefs:v1');
    expect(raw).not.toBeNull();
    if (raw) {
      const parsed = JSON.parse(raw) as { selectionToolbarTipDismissed?: boolean };
      expect(parsed.selectionToolbarTipDismissed).toBe(true);
    }
  });
});

// ─── setAppMode side-effects not yet covered ──────────────────────────────────
// The appMode.test.ts already covers reader + presentation Browse Lock
// auto-engage in detail. These two tests close the remaining gaps: guided
// and workshop modes do NOT touch Browse Lock.

describe('setAppMode — guided + workshop do not touch Browse Lock', () => {
  it("'guided' leaves browseLocked false", () => {
    expect(s().browseLocked).toBe(false);
    s().setAppMode('guided');
    expect(s().browseLocked).toBe(false);
  });

  it("'workshop' leaves browseLocked false", () => {
    expect(s().browseLocked).toBe(false);
    s().setAppMode('workshop');
    expect(s().browseLocked).toBe(false);
  });
});
