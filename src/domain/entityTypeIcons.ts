import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  Atom,
  Ban,
  BarChart3,
  Beaker,
  Bell,
  Bookmark,
  BookOpen,
  Box,
  Brain,
  Building,
  Check,
  CheckSquare,
  Clock,
  Cloud,
  Compass,
  Crown,
  Database,
  DollarSign,
  Edit,
  Eye,
  FileText,
  Flag,
  GitBranch,
  Globe,
  GraduationCap,
  Hammer,
  Heart,
  Key,
  Leaf,
  Lightbulb,
  Link2,
  Lock,
  type LucideIcon,
  Mail,
  // Aliased to dodge a shadow of the global `Map` constructor. The
  // catalogue key stays `'Map'` so the JSON wire format and the picker
  // search both still match the Lucide convention.
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Microscope,
  Package,
  Pin,
  Quote,
  Rocket,
  Server,
  Shield,
  Smile,
  Star,
  Sun,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react';

/**
 * B2 — curated catalogue of Lucide icons exposed to custom entity
 * classes. We deliberately ship a small set rather than the full
 * ~1500-icon Lucide library so:
 *   - the picker UI is scannable, not a search-required mega-list
 *   - the bundle doesn't bloat with hundreds of unused icon glyphs
 *   - the icon names that ship today round-trip through JSON forever
 *
 * Each entry is keyed by its Lucide PascalCase name (the same string
 * persisted in `CustomEntityClass.icon`). Adding a new icon: import
 * it above, add the entry here. Removing an icon would break any doc
 * that referenced it; the resolver falls back to `Box` for unknown
 * names so it degrades gracefully, but it's still a breaking change
 * to users with that icon in flight.
 *
 * Session 135 — extracted from `entityTypeMeta.ts` (file split). The
 * ~60-icon import block + catalogue dominated that file; isolating it
 * keeps the meta/resolver logic readable. `entityTypeMeta.ts`
 * re-exports these symbols so existing import sites are unchanged.
 */
export const CUSTOM_CLASS_ICONS: Record<string, LucideIcon> = {
  // Session 71 original 17.
  Box,
  Star,
  Flag,
  Heart,
  Quote,
  FileText,
  BookOpen,
  Lightbulb,
  Target,
  Compass,
  Shield,
  Link2,
  Users,
  CheckSquare,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  // Session 76 expansion — ~40 more icons across the common semantic
  // categories users have asked for. Adding any icon here is forward-
  // compatible: documents that reference one of these names will
  // render with the right glyph; older versions still render Box
  // fallback. Don't remove icons once they're in the catalogue.
  Activity,
  AlertCircle,
  Archive,
  Atom,
  Ban,
  BarChart3,
  Beaker,
  Bell,
  Bookmark,
  Brain,
  Building,
  Check,
  Clock,
  Cloud,
  Crown,
  Database,
  DollarSign,
  Edit,
  Eye,
  GitBranch,
  Globe,
  GraduationCap,
  Hammer,
  Key,
  Leaf,
  Lock,
  Mail,
  // Catalogue key preserved as `'Map'` even though the local binding is
  // `MapIcon` (avoiding a global-shadow lint).
  Map: MapIcon,
  MapPin,
  MessageSquare,
  Microscope,
  Package,
  Pin,
  Rocket,
  Server,
  Smile,
  Sun,
  TrendingUp,
  User,
  Wrench,
  X,
};
export type CustomClassIconName = keyof typeof CUSTOM_CLASS_ICONS;
export const CUSTOM_CLASS_ICON_NAMES = Object.keys(CUSTOM_CLASS_ICONS) as CustomClassIconName[];
