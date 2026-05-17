import { Field } from '@/components/inspector/Field';
import type { CausalityLabel, DefaultLayoutDirection } from '@/store';
import { useDocumentStore } from '@/store';
import { useShallow } from 'zustand/shallow';
import { RadioGroup, Section, Toggle } from '../formPrimitives';

const CAUSALITY_OPTIONS: { id: CausalityLabel; label: string; hint?: string }[] = [
  { id: 'none', label: 'None', hint: 'No fallback label' },
  { id: 'auto', label: 'Auto', hint: 'CRT/FRT/TT → "because", PRT/EC → "in order to"' },
  { id: 'because', label: 'Because', hint: 'Sufficient-cause read, bottom-up' },
  { id: 'therefore', label: 'Therefore', hint: 'Sufficient-cause read, top-down' },
  { id: 'in-order-to', label: 'In order to', hint: 'Necessary-condition read (PRT/EC)' },
];

/** FL-TO3 — Default layout direction for *new* documents (existing docs
 *  keep their own per-doc `layoutConfig`). Auto = use the diagram type's
 *  natural default. Session 88 audit (S12 candidate) — labels were
 *  already long-form ("Bottom → Top"); the two-letter codes only live
 *  in `id`. No change needed. */
const DEFAULT_DIRECTION_OPTIONS: {
  id: DefaultLayoutDirection;
  label: string;
  hint?: string;
}[] = [
  { id: 'auto', label: 'Auto', hint: 'Each diagram type picks its own default' },
  { id: 'BT', label: 'Bottom → Top', hint: 'CRT / FRT default' },
  { id: 'TB', label: 'Top → Bottom' },
  { id: 'LR', label: 'Left → Right' },
  { id: 'RL', label: 'Right → Left' },
];

/**
 * Session 121 — Display tab extracted from `SettingsDialog`. Covers six
 * canvas-overlay toggles plus the two reading-direction radio groups.
 * Largest tab by control count; keeping it on its own file makes it
 * easier to see at a glance which display affordance lives where.
 */
export function DisplayTab() {
  const {
    showAnnotationNumbers,
    showEntityIds,
    showReachBadges,
    showReverseReachBadges,
    showMinimap,
    printInkSaver,
    causalityLabel,
    defaultLayoutDirection,
    setShowAnnotationNumbers,
    setShowEntityIds,
    setShowReachBadges,
    setShowReverseReachBadges,
    setShowMinimap,
    setPrintInkSaver,
    setCausalityLabel,
    setDefaultLayoutDirection,
  } = useDocumentStore(
    useShallow((s) => ({
      showAnnotationNumbers: s.showAnnotationNumbers,
      showEntityIds: s.showEntityIds,
      showReachBadges: s.showReachBadges,
      showReverseReachBadges: s.showReverseReachBadges,
      showMinimap: s.showMinimap,
      printInkSaver: s.printInkSaver,
      causalityLabel: s.causalityLabel,
      defaultLayoutDirection: s.defaultLayoutDirection,
      setShowAnnotationNumbers: s.setShowAnnotationNumbers,
      setShowEntityIds: s.setShowEntityIds,
      setShowReachBadges: s.setShowReachBadges,
      setShowReverseReachBadges: s.setShowReverseReachBadges,
      setShowMinimap: s.setShowMinimap,
      setPrintInkSaver: s.setPrintInkSaver,
      setCausalityLabel: s.setCausalityLabel,
      setDefaultLayoutDirection: s.setDefaultLayoutDirection,
    }))
  );

  return (
    <Section title="Display">
      <Toggle
        label="Show annotation numbers"
        hint="A small #N badge on each entity"
        checked={showAnnotationNumbers}
        onChange={setShowAnnotationNumbers}
      />
      <Toggle
        label="Show entity IDs"
        hint="Mono-font caption below each title"
        checked={showEntityIds}
        onChange={setShowEntityIds}
      />
      <Toggle
        label="Show UDE-reach badge"
        hint="On each entity, a bottom-left pill counting how many UDEs it transitively reaches (the Core Driver signal). Hidden on diagrams without UDEs."
        checked={showReachBadges}
        onChange={setShowReachBadges}
      />
      <Toggle
        label="Show root-cause-reach badge"
        hint="On each entity, a bottom-right pill counting how many root causes transitively feed it. Useful on Goal Trees / FRTs where multiple injections converge. Hidden on diagrams without root causes."
        checked={showReverseReachBadges}
        onChange={setShowReverseReachBadges}
      />
      <Toggle
        label="Show minimap"
        hint="Bottom-left thumbnail of the whole diagram"
        checked={showMinimap}
        onChange={setShowMinimap}
      />
      <Toggle
        label="Ink-saving print mode"
        hint="When on, Print / Save as PDF drops colour fills (only the entity-type label is colorized)"
        checked={printInkSaver}
        onChange={setPrintInkSaver}
      />
      <Field label="Causality reading">
        <RadioGroup
          name="causalityLabel"
          value={causalityLabel}
          onChange={setCausalityLabel}
          options={CAUSALITY_OPTIONS}
        />
      </Field>
      <Field label="Default direction for new documents">
        <RadioGroup
          name="defaultLayoutDirection"
          value={defaultLayoutDirection}
          onChange={setDefaultLayoutDirection}
          options={DEFAULT_DIRECTION_OPTIONS}
        />
      </Field>
    </Section>
  );
}
