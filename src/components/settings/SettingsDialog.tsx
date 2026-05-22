import { X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TabBar } from '@/components/ui/TabBar';
import { useDocumentStore } from '@/store';
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
        {/* Design audit #13 — text-base to match LargeDialog's title
            size so the Settings header reads as authoritative as the
            picker dialogs. */}
        <h2
          id="settings-title"
          className="font-semibold text-base text-neutral-900 dark:text-neutral-100"
        >
          Settings
        </h2>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close settings">
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* Session 87 (S25) — tab bar replacing the single-scroll layout.
          Session 135 — shared `<TabBar>` (design audit #11). */}
      <TabBar
        tabs={TABS}
        active={activeTab}
        onChange={setActiveTab}
        ariaLabel="Settings sections"
      />

      <div className="max-h-[70vh] space-y-6 overflow-y-auto px-4 py-4">
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'behavior' && <BehaviorTab />}
        {activeTab === 'display' && <DisplayTab />}
        {activeTab === 'layout' && <LayoutTab />}
      </div>
    </Modal>
  );
}
