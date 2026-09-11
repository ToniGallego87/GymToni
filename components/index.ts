export { HeroCard } from './HeroCard';
export type { HeroVariant } from './HeroCard';
export { HeroCarousel } from './HeroCarousel';
export { HeroStatsCard } from './HeroStatsCard';
export type { HeroStat } from './HeroStatsCard';
export { HeroWeightCard } from './HeroWeightCard';
export {
  AchievementPoster,
  POSTER_WIDTH,
  POSTER_HEIGHT,
} from './AchievementPoster';
export { GradientFill } from './GradientFill';
export { Avatar } from './Avatar';
// AnimatedCounter no se re-exporta: solo lo consume TrendDelta por ruta relativa.
export { TrendDelta } from './TrendDelta';
export { BarChart } from './BarChart';
export type { BarChartPoint } from './BarChart';
export { DayAccentIcon } from './DayAccentIcon';
export {
  GymIcon,
  GYM_ICON_NAMES,
  GYM_ICON_LABELS,
  isGymIconName,
  detectGymIcon,
  resolveDayIcon,
} from './GymIcon';
export type { GymIconName } from './GymIcon';
export { GymIconGrid } from './GymIconGrid';
export { GradientCtaButton } from './GradientCtaButton';
export { ExerciseResultDisplay } from './ExerciseResultDisplay';
export { ExerciseInputField } from './ExerciseInputField';
export type { InvalidAddReason } from './ExerciseInputField';
export { ExerciseFormRow, ExerciseSummaryRow } from './ExerciseFormRow';
// ExercisePickerModal / GifViewerModal no se re-exportan: son piezas internas
// que solo consumen otros componentes por ruta relativa. ExerciseGifButton sí,
// desde que también lo usan pantallas (Progreso por ejercicio) y no solo
// componentes.
export { ExerciseGifButton } from './ExerciseGifButton';
export { CardioInputField } from './CardioInputField';
export { Toast } from './Toast';
export { SaveRoutineButton, RoutineOriginPill } from './SaveRoutineButton';
export { RoutineIntensityPill } from './RoutineIntensityPill';
export { WhatsNewModal } from './WhatsNewModal';
export { UpdateAvailableModal } from './UpdateAvailableModal';
export { ThemeRevealOverlay } from './ThemeRevealOverlay';
export { PipRestTimer } from './PipRestTimer';
export { RestTimerBar, REST_TIMER_BAR_HEIGHT } from './RestTimerBar';
export { Button } from './Button';
export { AppModal } from './AppModal';
export { ConfirmModal } from './ConfirmModal';
export { RestTimerModal } from './RestTimerModal';
export { ReportModal } from './ReportModal';
export { DatePickerModal } from './DatePickerModal';
export { GlassTopBar, GLASS_TOP_BAR_BASE_HEIGHT } from './GlassTopBar';
export {
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  getFloatingBackButtonMetrics,
} from './FloatingBackButton';
export {
  getFloatingPrimaryNavMetrics,
  FLOATING_GLASS_BAR_HEIGHT,
} from './FloatingGlassBar';
export { FloatingPrimaryNav } from './FloatingPrimaryNav';
export { StretchScrollView } from './StretchScrollView';
export { LoadMoreButton } from './LoadMoreButton';
export { Collapsible } from './Collapsible';
export { SegmentedFilter, SEGMENTED_FILTER_CHART_GAP } from './SegmentedFilter';
export type { SegmentedOption } from './SegmentedFilter';
export { OptionToggle } from './OptionToggle';
export type { OptionToggleOption } from './OptionToggle';
