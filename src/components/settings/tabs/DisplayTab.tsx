import { useShallow } from 'zustand/shallow';
import { Field } from '@/components/inspector/Field';
import { useT } from '@/i18n/useT';
import type { CausalityLabel, DefaultLayoutDirection, EdgeRouting } from '@/store';
import { useDocumentStore } from '@/store';
import { RadioGroup, Section, Toggle } from '../formPrimitives';

type LayoutDensity = 'compact' | 'balanced' | 'spacious';

/**
 * Session 121 — Display tab extracted from `SettingsDialog`. Covers six
 * canvas-overlay toggles plus the two reading-direction radio groups.
 * Largest tab by control count; keeping it on its own file makes it
 * easier to see at a glance which display affordance lives where.
 */
export function DisplayTab() {
  const t = useT();
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

  const d = t.settings.display;
  const causalityOptions: { id: CausalityLabel; label: string; hint?: string }[] = [
    { id: 'none', label: d.causality.none, hint: d.causality.noneHint },
    { id: 'auto', label: d.causality.auto, hint: d.causality.autoHint },
    { id: 'because', label: d.causality.because, hint: d.causality.becauseHint },
    { id: 'therefore', label: d.causality.therefore, hint: d.causality.thereforeHint },
    { id: 'in-order-to', label: d.causality.inOrderTo, hint: d.causality.inOrderToHint },
  ];
  // FL-TO3 — default direction for NEW documents; existing docs keep their own
  // per-doc `layoutConfig`. Auto = the diagram type's natural default.
  const directionOptions: { id: DefaultLayoutDirection; label: string; hint?: string }[] = [
    { id: 'auto', label: d.directions.auto, hint: d.directions.autoHint },
    { id: 'BT', label: d.directions.bt, hint: d.directions.btHint },
    { id: 'TB', label: d.directions.tb },
    { id: 'LR', label: d.directions.lr },
    { id: 'RL', label: d.directions.rl },
  ];
  const densityOptions: { id: LayoutDensity; label: string; hint?: string }[] = [
    { id: 'compact', label: d.density.compact, hint: d.density.compactHint },
    { id: 'balanced', label: d.density.balanced, hint: d.density.balancedHint },
    { id: 'spacious', label: d.density.spacious, hint: d.density.spaciousHint },
  ];
  // Phase C of the obstacle-aware edge-routing project — the user-facing
  // toggle between the smart router and the pre-Phase-C bezier.
  const routingOptions: { id: EdgeRouting; label: string; hint?: string }[] = [
    { id: 'smart', label: d.routing.smart, hint: d.routing.smartHint },
    { id: 'direct', label: d.routing.direct, hint: d.routing.directHint },
  ];

  return (
    <Section title={d.section}>
      <Toggle
        label={d.annotationNumbers}
        hint={d.annotationNumbersHint}
        checked={showAnnotationNumbers}
        onChange={setShowAnnotationNumbers}
      />
      <Toggle
        label={d.entityIds}
        hint={d.entityIdsHint}
        checked={showEntityIds}
        onChange={setShowEntityIds}
      />
      <Toggle
        label={d.growCards}
        hint={d.growCardsHint}
        checked={growCardsToFitText}
        onChange={setGrowCardsToFitText}
      />
      <Toggle
        label={d.reachBadge}
        hint={d.reachBadgeHint}
        checked={showReachBadges}
        onChange={setShowReachBadges}
      />
      <Toggle
        label={d.reverseReachBadge}
        hint={d.reverseReachBadgeHint}
        checked={showReverseReachBadges}
        onChange={setShowReverseReachBadges}
      />
      <Toggle
        label={d.actionEligibility}
        hint={d.actionEligibilityHint}
        checked={showActionEligibility}
        onChange={setShowActionEligibility}
      />
      <Toggle
        label={d.minimap}
        hint={d.minimapHint}
        checked={showMinimap}
        onChange={setShowMinimap}
      />
      <Toggle
        label={d.inkSaver}
        hint={d.inkSaverHint}
        checked={printInkSaver}
        onChange={setPrintInkSaver}
      />
      <Field label={d.causalityReading}>
        <RadioGroup
          name="causalityLabel"
          value={causalityLabel}
          onChange={setCausalityLabel}
          options={causalityOptions}
        />
      </Field>
      <Field label={d.defaultDirection}>
        <RadioGroup
          name="defaultLayoutDirection"
          value={defaultLayoutDirection}
          onChange={setDefaultLayoutDirection}
          options={directionOptions}
        />
      </Field>
      <Field label={d.layoutDensity}>
        <RadioGroup
          name="layoutDensity"
          value={layoutDensity}
          onChange={setLayoutDensity}
          options={densityOptions}
        />
      </Field>
      <Field label={d.edgeRouting}>
        <RadioGroup
          name="edgeRouting"
          value={edgeRouting}
          onChange={setEdgeRouting}
          options={routingOptions}
        />
      </Field>
    </Section>
  );
}
