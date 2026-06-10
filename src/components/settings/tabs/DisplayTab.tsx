import { useShallow } from 'zustand/shallow';
import { Field } from '@/components/inspector/Field';
import type { CausalityLabel, DefaultLayoutDirection, EdgeRouting } from '@/store';
import { useDocumentStore } from '@/store';
import { RadioGroup, Section, Toggle } from '../formPrimitives';

type LayoutDensity = 'compact' | 'balanced' | 'spacious';

const LAYOUT_DENSITY_OPTIONS: { id: LayoutDensity; label: string; hint?: string }[] = [
  { id: 'compact', label: 'Compact', hint: 'Pull entities closer (0.75× spacing) — dense maps' },
  { id: 'balanced', label: 'Balanced', hint: 'Default — tightened in Session 136' },
  {
    id: 'spacious',
    label: 'Spacious',
    hint: 'Loosen for projector / accessibility (1.5× spacing)',
  },
];

/** Phase C of the obstacle-aware edge routing project — the user-
 *  facing toggle between the smart router and the pre-Phase-C bezier.
 *  Default `'smart'` per the proposal's locked decision. */
const EDGE_ROUTING_OPTIONS: { id: EdgeRouting; label: string; hint?: string }[] = [
  {
    id: 'smart',
    label: 'Smart (avoid obstacles)',
    hint: 'Routes edges around non-endpoint node bodies (default)',
  },
  {
    id: 'direct',
    label: 'Direct (curves through anything)',
    hint: 'Pre-routing behavior — every edge is React Flow’s default bezier',
  },
];

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
    showActionEligibility,
    showMinimap,
    growCardsToFitText,
    printInkSaver,
    causalityLabel,
    defaultLayoutDirection,
    layoutDensity,
    edgeRouting,
    setShowAnnotationNumbers,
    setShowEntityIds,
    setShowReachBadges,
    setShowReverseReachBadges,
    setShowActionEligibility,
    setShowMinimap,
    setGrowCardsToFitText,
    setPrintInkSaver,
    setCausalityLabel,
    setDefaultLayoutDirection,
    setLayoutDensity,
    setEdgeRouting,
  } = useDocumentStore(
    useShallow((s) => ({
      showAnnotationNumbers: s.showAnnotationNumbers,
      showEntityIds: s.showEntityIds,
      showReachBadges: s.showReachBadges,
      showReverseReachBadges: s.showReverseReachBadges,
      showActionEligibility: s.showActionEligibility,
      showMinimap: s.showMinimap,
      growCardsToFitText: s.growCardsToFitText,
      printInkSaver: s.printInkSaver,
      causalityLabel: s.causalityLabel,
      defaultLayoutDirection: s.defaultLayoutDirection,
      layoutDensity: s.layoutDensity,
      edgeRouting: s.edgeRouting,
      setShowAnnotationNumbers: s.setShowAnnotationNumbers,
      setShowEntityIds: s.setShowEntityIds,
      setShowReachBadges: s.setShowReachBadges,
      setShowReverseReachBadges: s.setShowReverseReachBadges,
      setShowActionEligibility: s.setShowActionEligibility,
      setShowMinimap: s.setShowMinimap,
      setGrowCardsToFitText: s.setGrowCardsToFitText,
      setPrintInkSaver: s.setPrintInkSaver,
      setCausalityLabel: s.setCausalityLabel,
      setDefaultLayoutDirection: s.setDefaultLayoutDirection,
      setLayoutDensity: s.setLayoutDensity,
      setEdgeRouting: s.setEdgeRouting,
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
        label="Grow cards to fit text"
        hint="Let entity cards grow taller to show the full title, up to 6 lines. Off keeps the fixed card height with a 2-line clamp."
        checked={growCardsToFitText}
        onChange={setGrowCardsToFitText}
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
        label="Show action-eligibility badge"
        hint="On Transition Tree Action nodes, a right-edge ✓ / ✗ / … pill: eligible (every precondition true), blocked (one is false), or pending (undecided). Reflects entity states; the full readout is in the Inspector."
        checked={showActionEligibility}
        onChange={setShowActionEligibility}
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
      <Field label="Layout density">
        <RadioGroup
          name="layoutDensity"
          value={layoutDensity}
          onChange={setLayoutDensity}
          options={LAYOUT_DENSITY_OPTIONS}
        />
      </Field>
      <Field label="Edge routing">
        <RadioGroup
          name="edgeRouting"
          value={edgeRouting}
          onChange={setEdgeRouting}
          options={EDGE_ROUTING_OPTIONS}
        />
      </Field>
    </Section>
  );
}
