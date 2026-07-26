import { en } from '@/i18n/locales/en';
import type { Messages } from '@/i18n/types';
import type { CloudType } from './types';

/**
 * Display metadata for the optional EC **cloud-type** tag (TP Basics gap #1 —
 * Cloud progression). The `CloudType` union itself lives in `types/document.ts`;
 * the ordered list + human labels live here so the Document panel dropdown, the
 * title chip, and the import validator share one source of truth.
 *
 * The order is the escalation Cohen describes — a single dilemma/conflict, then
 * the UDE cloud behind one undesirable effect, up through the Consolidated and
 * Core clouds, with the Firefighting (Lieutenant) cloud as the recurring
 * symptom-vs-cause trap.
 */
export const CLOUD_TYPES: readonly CloudType[] = [
  'dilemma',
  'conflict',
  'ude',
  'consolidated',
  'core',
  'firefighting',
];

/** English view; React callers should use {@link cloudTypeLabel}. */
export const CLOUD_TYPE_LABEL: Record<CloudType, string> = Object.fromEntries(
  CLOUD_TYPES.map((c) => [c, en.cloudType[c].label])
) as Record<CloudType, string>;

/** Locale-aware cloud-type label. */
export const cloudTypeLabel = (messages: Messages, cloudType: CloudType): string =>
  messages.cloudType[cloudType].label;

/** Trust-boundary guard for persistence: is `value` one of the six cloud types? */
export const isCloudType = (value: unknown): value is CloudType =>
  typeof value === 'string' && (CLOUD_TYPES as readonly string[]).includes(value);
