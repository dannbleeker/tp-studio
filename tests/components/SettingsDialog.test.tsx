import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * SettingsDialog mirrors most of the persisted-prefs slice into a UI surface:
 * theme, animation speed, edge palette, browse-lock, and four display toggles
 * (annotation numbers, entity IDs, minimap, ink-saver print mode).
 *
 * Each radio-group option is a `<button aria-pressed>` with the visible label
 * as its text content; each toggle is a `<label>` wrapping a checkbox.
 * Clicks fire through to the store setters, which is what we verify here.
 */

const open = (): void => {
  act(() => useDocumentStore.getState().openSettings());
};

/**
 * Session 87 (S25) — Settings is now tabbed. Tests that interact with
 * a control in a non-default tab must first switch to the right tab.
 */
const selectTab = (container: HTMLElement, tabName: string): void => {
  const tab = Array.from(container.querySelectorAll('[role="tab"]')).find(
    (t) => t.textContent?.trim() === tabName
  ) as HTMLButtonElement | undefined;
  if (!tab) throw new Error(`No tab "${tabName}"`);
  act(() => fireEvent.click(tab));
};

const clickByText = (container: HTMLElement, text: string): void => {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.trim().startsWith(text)
  );
  if (!btn) throw new Error(`No button starting with "${text}"`);
  act(() => fireEvent.click(btn));
};

const checkboxByLabel = (container: HTMLElement, label: string): HTMLInputElement => {
  const lbl = Array.from(container.querySelectorAll('label')).find((l) =>
    l.textContent?.includes(label)
  );
  if (!lbl) throw new Error(`No label containing "${label}"`);
  const cb = lbl.querySelector('input[type="checkbox"]') as HTMLInputElement;
  if (!cb) throw new Error(`Label "${label}" has no checkbox`);
  return cb;
};

describe('SettingsDialog', () => {
  it('renders nothing when settingsOpen is false', () => {
    const { container } = render(<SettingsDialog />);
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('renders the dialog with the Settings title when open', () => {
    open();
    const { getByText } = render(<SettingsDialog />);
    expect(getByText('Settings')).toBeTruthy();
  });

  it('Close button (X) closes the dialog', () => {
    open();
    const { container } = render(<SettingsDialog />);
    const closeBtn = container.querySelector(
      'button[aria-label="Close settings"]'
    ) as HTMLButtonElement | null;
    expect(closeBtn).toBeTruthy();
    act(() => fireEvent.click(closeBtn!));
    expect(useDocumentStore.getState().settingsOpen).toBe(false);
  });

  it('clicking the Dark theme option updates store.theme', () => {
    open();
    const { container } = render(<SettingsDialog />);
    expect(useDocumentStore.getState().theme).toBe('light');
    clickByText(container, 'Dark');
    expect(useDocumentStore.getState().theme).toBe('dark');
  });

  it('clicking the Colorblind-safe palette option updates store.edgePalette', () => {
    open();
    const { container } = render(<SettingsDialog />);
    expect(useDocumentStore.getState().edgePalette).toBe('default');
    clickByText(container, 'Colorblind-safe');
    expect(useDocumentStore.getState().edgePalette).toBe('colorblindSafe');
  });

  it('clicking the Fast animation speed updates store.animationSpeed', () => {
    open();
    const { container } = render(<SettingsDialog />);
    selectTab(container, 'Behavior');
    expect(useDocumentStore.getState().animationSpeed).toBe('default');
    clickByText(container, 'Fast');
    expect(useDocumentStore.getState().animationSpeed).toBe('fast');
  });

  it('Browse Lock toggle flips store.browseLocked', () => {
    open();
    const { container } = render(<SettingsDialog />);
    selectTab(container, 'Behavior');
    const cb = checkboxByLabel(container, 'Browse Lock');
    expect(cb.checked).toBe(false);
    act(() => fireEvent.click(cb));
    expect(useDocumentStore.getState().browseLocked).toBe(true);
  });

  it('Show minimap toggle flips store.showMinimap', () => {
    open();
    const { container } = render(<SettingsDialog />);
    selectTab(container, 'Display');
    // Defaults to true so the first click should turn it off.
    expect(useDocumentStore.getState().showMinimap).toBe(true);
    const cb = checkboxByLabel(container, 'Show minimap');
    expect(cb.checked).toBe(true);
    act(() => fireEvent.click(cb));
    expect(useDocumentStore.getState().showMinimap).toBe(false);
  });

  it('Show annotation numbers toggle flips store.showAnnotationNumbers', () => {
    open();
    const { container } = render(<SettingsDialog />);
    selectTab(container, 'Display');
    const cb = checkboxByLabel(container, 'Show annotation numbers');
    expect(cb.checked).toBe(false);
    act(() => fireEvent.click(cb));
    expect(useDocumentStore.getState().showAnnotationNumbers).toBe(true);
  });

  it('clicking a Causality reading option updates store.causalityLabel', () => {
    open();
    const { container } = render(<SettingsDialog />);
    selectTab(container, 'Display');
    expect(useDocumentStore.getState().causalityLabel).toBe('none');
    clickByText(container, 'Because');
    expect(useDocumentStore.getState().causalityLabel).toBe('because');
    clickByText(container, 'Therefore');
    expect(useDocumentStore.getState().causalityLabel).toBe('therefore');
  });

  it('Layout Direction radio writes doc.layoutConfig.direction (Block A)', () => {
    open();
    const { container } = render(<SettingsDialog />);
    selectTab(container, 'Layout');
    expect(useDocumentStore.getState().doc.layoutConfig).toBeUndefined();
    // FL-TO3 (Session 61) added another "Top → Bottom" option for the
    // per-app default-direction preference — disambiguate by data attribute.
    const tbBtn = Array.from(
      container.querySelectorAll('[data-radio-name="layoutDirection"]')
    ).find((b) => b.textContent?.trim().startsWith('Top → Bottom')) as
      | HTMLButtonElement
      | undefined;
    if (!tbBtn) throw new Error('Layout Direction "Top → Bottom" not found');
    act(() => fireEvent.click(tbBtn));
    expect(useDocumentStore.getState().doc.layoutConfig?.direction).toBe('TB');
  });

  it('Layout Bias radio uses Auto sentinel to clear align (Block A)', () => {
    // Pre-populate with a non-Auto bias…
    act(() => useDocumentStore.getState().setLayoutConfig({ align: 'UL' }));
    open();
    const { container } = render(<SettingsDialog />);
    selectTab(container, 'Layout');
    expect(useDocumentStore.getState().doc.layoutConfig?.align).toBe('UL');
    // …then click the Bias-group "Auto" specifically. The Causality
    // reading + default-direction groups also offer "Auto" now, so
    // disambiguate by data-radio-name.
    const biasAuto = Array.from(container.querySelectorAll('[data-radio-name="layoutBias"]')).find(
      (b) => b.textContent?.trim().startsWith('Auto')
    ) as HTMLButtonElement | undefined;
    if (!biasAuto) throw new Error('Bias Auto button not found');
    act(() => fireEvent.click(biasAuto));
    expect(useDocumentStore.getState().doc.layoutConfig?.align).toBeUndefined();
  });

  it('Layout Compactness slider scales nodesep + ranksep (Block A)', () => {
    open();
    const { container } = render(<SettingsDialog />);
    selectTab(container, 'Layout');
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    // The slider starts at 50 (defaults). Drag to 100 — should produce
    // ~double the spacing values (factor = 2^((100-50)/50) = 2).
    act(() => fireEvent.change(slider, { target: { value: '100' } }));
    const cfg = useDocumentStore.getState().doc.layoutConfig;
    expect(cfg?.nodesep).toBeGreaterThan(40); // > default
    expect(cfg?.ranksep).toBeGreaterThan(80);
  });

  it('Reset to defaults button clears doc.layoutConfig entirely (Block A)', () => {
    act(() => useDocumentStore.getState().setLayoutConfig({ direction: 'LR', nodesep: 60 }));
    open();
    const { container } = render(<SettingsDialog />);
    selectTab(container, 'Layout');
    const resetBtn = container.querySelector(
      'button[aria-label="Reset layout to defaults"]'
    ) as HTMLButtonElement | null;
    expect(resetBtn).toBeTruthy();
    act(() => fireEvent.click(resetBtn!));
    expect(useDocumentStore.getState().doc.layoutConfig).toBeUndefined();
  });

  it('shows the manual-layout note instead of knobs on Evaporating Cloud (Block A)', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    open();
    const { container } = render(<SettingsDialog />);
    selectTab(container, 'Layout');
    expect(container.textContent).toContain('hand-positioned layout');
    // Direction radio should be absent for manual-layout diagrams.
    const dirRadio = Array.from(container.querySelectorAll('button[data-radio-name]')).filter(
      (b) => b.getAttribute('data-radio-name') === 'layoutDirection'
    );
    expect(dirRadio).toHaveLength(0);
  });
});
