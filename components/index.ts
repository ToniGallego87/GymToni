export { HeroCard } from './HeroCard';
export type { HeroVariant, HeroCardStat } from './HeroCard';
export { StatsStrip } from './StatsStrip';
export { SectionLegend } from './SectionLegend';
export { ActivityList } from './ActivityList';
export type { StatsStripStat } from './StatsStrip';
export { ChallengesStrip } from './ChallengesStrip';
export { ChallengesModal } from './ChallengesModal';
export { AnchorMenu } from './AnchorMenu';
export type { AnchorMenuItem } from './AnchorMenu';
export { AwardModal } from './AwardModal';
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
export { BarChart, getChartWidth } from './BarChart';
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
export { ExerciseEditorModal, ExerciseSummaryRow } from './ExerciseFormRow';
export { SortableList } from './SortableList';
export { WeightTrendChart } from './WeightTrendChart';
// ExercisePickerModal / GifViewerModal no se re-exportan: son piezas internas
// que solo consumen otros componentes por ruta relativa. ExerciseGifButton sí,
// desde que también lo usan pantallas (Progreso por ejercicio) y no solo
// componentes.
export { ExerciseGifButton } from './ExerciseGifButton';
// El tipo `ExerciseTile` no se re-exporta: la cuadrícula recibe directamente
// los ejercicios del día y nadie de fuera construye la lista a mano.
export { ExerciseTileGrid } from './ExerciseTileGrid';
export { LevelPill } from './LevelPill';
export { CardioInputField } from './CardioInputField';
export { Toast } from './Toast';
export {
  LikeButton,
  SaveRoutineButton,
  RoutineOriginPill,
  StatBubble,
  StatBubbleSkeleton,
  seriesExplanation,
  daysExplanation,
} from './SaveRoutineButton';
export {
  RoutineIntensityPill,
  RoutineIntensityPillSkeleton,
} from './RoutineIntensityPill';
export { PublicRoutineCard } from './PublicRoutineCard';
export type { PublicRoutineCardItem } from './PublicRoutineCard';
export { WhatsNewModal } from './WhatsNewModal';
export { UpdateAvailableModal } from './UpdateAvailableModal';
export { ThemeRevealOverlay } from './ThemeRevealOverlay';
export { PipRestTimer } from './PipRestTimer';
// REST_TIMER_BAR_HEIGHT no se re-exporta: la barra se coloca con el `bottom`
// que le pasa App.tsx y su alto solo lo usa ella misma.
export { RestTimerBar } from './RestTimerBar';
export { ProgressRing } from './ProgressRing';
export { Button } from './Button';
export { AppModal } from './AppModal';
export { ConfirmModal } from './ConfirmModal';
export { RestTimerModal } from './RestTimerModal';
export { ReportModal } from './ReportModal';
export { TopBarActionButton } from './TopBarActionButton';
export { DatePickerModal } from './DatePickerModal';
export {
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
} from './GlassTopBar';
export {
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
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
export { ValueStepper } from './ValueStepper';
export {
  getMenuTileWidth,
  MENU_TILE_GAP,
  MENU_TILE_INSET,
  MENU_TILE_PADDING,
  MENU_TILES_PER_ROW,
} from './menuTileTokens';
export { ChartCard, ChartArea } from './ChartCard';
