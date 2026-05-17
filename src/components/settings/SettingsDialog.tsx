import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useState } from 'react';
import { AppearanceTab } from './tabs/AppearanceTab';
import { BehaviorTab } from './tabs/BehaviorTab';
import { DisplayTab } from './tabs/DisplayTab';
import { LayoutTab } from './tabs/LayoutTab';

/**
 * Session 87 (S25) — Settings is now tabbed. Single-scroll layout
 * grew past ~15 controls; jumping to a setting required scanning
 * the whole dialog. Four tabs match the existing section titles.
 *
 * Session 121 — Each tab's contents extracted into its own file in
 * `tabs/` so this file stays a thin orchestrator (modal shell + tab
 * bar + active-tab switch). Each tab owns its own Zustand
 * subscription via `useShallow`, so editing one tab's prefs doesn't
 * re-render the other three. The split was Tier-2 #5 from the
 * Session 112–114 maintainability backlog.
 */
type SettingsTab = 'appearance' | 'behavior' | 'display' | 'layout';
const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'display', label: 'Display' },
  { id: 'layout', label: 'Layout' },
];

export function SettingsDialog() {
  const open = useDocumentStore((s) => s.settingsOpen);
  const close = useDocumentStore((s) => s.closeSettings);
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-md" labelledBy="settings-title">
      <header className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
        <h2
          id="settings-title"
          className="font-semibold text-neutral-900 text-sm dark:text-neutral-100"
        >
          Settings
        </h2>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close settings">
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* Session 87 (S25) — tab bar replacing the single-scroll
          layout. ARIA tablist semantics so screen readers announce
          the tab transitions. */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex border-neutral-200 border-b px-2 dark:border-neutral-800"
      >
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'flex-1 px-2 py-2 font-semibold text-[11px] uppercase tracking-wide transition',
                active
                  ? 'border-indigo-500 border-b-2 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                  : 'border-transparent border-b-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="max-h-[70vh] space-y-6 overflow-y-auto px-4 py-4">
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'behavior' && <BehaviorTab />}
        {activeTab === 'display' && <DisplayTab />}
        {activeTab === 'layout' && <LayoutTab />}
      </div>
    </Modal>
  );
}
