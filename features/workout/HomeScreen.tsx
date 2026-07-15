import React, { useMemo, useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
  Modal,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import { DayCard } from '@components/DayCard';
import {
  WorkoutDay,
  WorkoutRoutine,
  WorkoutLog,
  ExerciseLog,
} from '../../types';
import { getDisplayDayName, theme } from '@lib/theme';
import { t, dateLocale } from '@lib/i18n';
import {
  buildImprovementFromStrengthScores,
  getWorkoutStrengthScore,
  ImprovementResult,
} from '@lib/progress';
import { getImprovementDisplay, getLogTimestamp } from '@lib/utils';
import { hasAnyCardio } from '@lib/cardio';
import { animateLayout } from '@lib/layoutAnimation';
import { groupLogsIntoWeekBlocks, getWeekStrengthScore } from '@lib/weeks';
import { computeWeekAchievements, WeekAchievements } from '@lib/achievements';
import {
  Collapsible,
  ConfirmModal,
  DayAccentIcon,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  getFloatingPrimaryNavMetrics,
  FloatingPrimaryNav,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  HeroCard,
  HeroCarousel,
  HeroStatsCard,
  HeroStat,
  HeroVariant,
  GradientFill,
  AnimatedCounter,
  StretchScrollView,
} from '../../components';

interface HomeScreenProps {
  onSelectDay: (day: WorkoutDay) => void;
  onSelectLog?: (log: WorkoutLog, day: WorkoutDay) => void;
  onEditLog?: (log: WorkoutLog, day: WorkoutDay) => void;
  onNavigateHome?: () => void;
  onNavigateCardio?: () => void;
  onNavigateCalendar?: () => void;
  onNavigateProfile?: () => void;
  onOpenDaySelector?: () => void;
  onOpenRoutineSelector?: () => void;
  onOpenRoutineDetails?: (routine: WorkoutRoutine) => void;
  onCreateRoutine?: () => void;
  onScanRoutineQR?: () => void;
  onDeleteCurrentRoutine?: () => void;
  onShowWeekAchievement?: (
    achievements: WeekAchievements,
    routineName?: string
  ) => void;
  canDeleteCurrentRoutine?: boolean;
  initialShowRoutineSelector?: boolean;
  onCloseRoutineSelector?: () => void;
}

interface WeekProgressPoint {
  week: number;
  improvement: number;
  isCurrent?: boolean;
  /** La semana no tiene todos los días de la rutina entrenados. */
  isIncomplete?: boolean;
}

function buildWeekProgress(
  logs: WorkoutLog[],
  activeRoutineId?: string,
  activeDays: WorkoutDay[] = [],
  dayFilter?: string
): WeekProgressPoint[] {
  if (!activeRoutineId) return [];

  // El progreso solo se calcula con la rutina actualmente seleccionada en
  // Inicio. Las sesiones de solo cardio no cuentan como entrenamiento de fuerza.
  const routineLogs = logs.filter(
    (log) => log.routineId === activeRoutineId && !log.cardioOnly
  );
  if (routineLogs.length === 0) return [];

  // Agrupación por dayId directamente — sin depender del mapping dayId→dayNumber,
  // que puede fallar si la rutina fue modificada y los IDs de días cambiaron.
  const sortedLogs = [...routineLogs].sort(
    (a, b) => getLogTimestamp(a) - getLogTimestamp(b)
  );
  const groupedByBlock: Record<number, WorkoutLog[]> = {};
  let blockNum = 1;
  let blockLogs: WorkoutLog[] = [];
  let seenDayIds = new Set<string>();

  for (const log of sortedLogs) {
    // Igual que lib/weeks.ts: se abre bloque nuevo si el usuario forzó nueva
    // semana o si reaparece un día ya entrenado en el bloque.
    const repeatsDay = !!log.dayId && seenDayIds.has(log.dayId);
    if ((log.startsNewWeek || repeatsDay) && blockLogs.length > 0) {
      groupedByBlock[blockNum++] = blockLogs;
      blockLogs = [];
      seenDayIds = new Set();
    }
    blockLogs.push(log);
    if (log.dayId) seenDayIds.add(log.dayId);
  }
  if (blockLogs.length > 0) groupedByBlock[blockNum] = blockLogs;

  const orderedBlocks = Object.keys(groupedByBlock)
    .map(Number)
    .sort((a, b) => a - b);

  // Una semana está incompleta si no tiene entrenados todos los días de la rutina.
  const isBlockIncomplete = (logsForBlock: WorkoutLog[]) =>
    activeDays.length > 0 &&
    !activeDays.every((d) => logsForBlock.some((l) => l.dayId === d.id));

  const blockHasDay = (logsForBlock: WorkoutLog[], dayId: string) =>
    logsForBlock.some((l) => l.dayId === dayId);

  // El gráfico compara cada semana contra la PRIMERA (progreso acumulado),
  // a diferencia del listado, que compara contra la semana anterior.
  const points: WeekProgressPoint[] = orderedBlocks.map(
    (blockNumber, index) => {
      const currentWeekLogsForBlock = groupedByBlock[blockNumber] || [];

      // Con filtro por día activo, una semana está "incompleta" si NO entrenó ese
      // día; sin filtro, si le faltan días de la rutina.
      const isIncomplete = dayFilter
        ? !blockHasDay(currentWeekLogsForBlock, dayFilter)
        : isBlockIncomplete(currentWeekLogsForBlock);

      if (index === 0) {
        return { week: 1, improvement: 0, isIncomplete };
      }

      const firstBlockNumber = orderedBlocks[0];
      const previousWeekLogsForBlock = groupedByBlock[firstBlockNumber] || [];

      if (!currentWeekLogsForBlock.length || !previousWeekLogsForBlock.length) {
        return { week: index + 1, improvement: 0, isIncomplete };
      }

      // Con filtro activo, las semanas que no entrenaron ese día no puntúan (0%).
      if (dayFilter && !blockHasDay(currentWeekLogsForBlock, dayFilter)) {
        return { week: index + 1, improvement: 0, isIncomplete };
      }

      // Una semana incompleta NO se penaliza por días que faltan: solo se cuentan
      // los días entrenados (o el día filtrado), comparándolos contra esos mismos
      // días de la semana base (igual que el porcentaje del listado).
      const currentDayIds = dayFilter
        ? [dayFilter]
        : Array.from(
            new Set(
              currentWeekLogsForBlock.map((log) => log.dayId).filter(Boolean)
            )
          );
      const scoreOptions = {
        activeDaysCount: activeDays.length,
        restrictToDayIds: currentDayIds,
        applyMissingPenalty: false,
      };
      const currentStrength = getWeekStrengthScore(
        currentWeekLogsForBlock,
        scoreOptions
      );
      const previousStrength = getWeekStrengthScore(
        previousWeekLogsForBlock,
        scoreOptions
      );
      const improvement = buildImprovementFromStrengthScores(
        currentStrength,
        previousStrength
      );

      const signedDelta = improvement
        ? improvement.isImproved
          ? improvement.percent
          : -improvement.percent
        : 0;

      return {
        week: index + 1,
        improvement: Math.round(signedDelta * 10) / 10,
        isIncomplete,
      };
    }
  );

  // La última semana entrenada es la "semana en curso" SOLO si aún le faltan días.
  // Si está completa, no hay semana en curso abierta: no se añade ningún punto
  // sintético (evita mostrar una semana fantasma extra en rutinas cerradas o
  // recién completadas que nunca se entrenó).
  const lastBlockNumber = orderedBlocks[orderedBlocks.length - 1];
  const lastBlockLogs = groupedByBlock[lastBlockNumber] || [];
  const trainedDayIds = new Set(lastBlockLogs.map((l: WorkoutLog) => l.dayId));
  const lastBlockIsComplete =
    activeDays.length > 0 && activeDays.every((d) => trainedDayIds.has(d.id));

  if (!lastBlockIsComplete && points.length > 0) {
    points[points.length - 1] = {
      ...points[points.length - 1],
      isCurrent: true,
    };
  }

  return points;
}

function ProgressBarChart({
  points,
  width,
}: {
  points: WeekProgressPoint[];
  width: number;
}) {
  // Semana 1 es siempre la base (mejora 0), no se muestra.
  const filteredPoints = points.slice(1);

  const chartPadding = { top: 16, right: 12, bottom: 28, left: 38 };
  const chartHeight = 170;
  const chartWidth = width;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;

  const values = filteredPoints.map((point) => point.improvement);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const sameValueRange = minValue === maxValue;
  const domainPadding = sameValueRange
    ? 10
    : Math.max((maxValue - minValue) * 0.15, 5);
  const domainMin = Math.min(minValue - domainPadding, 0);
  const domainMax = Math.max(maxValue + domainPadding, 0);

  const barSlotWidth =
    filteredPoints.length > 0 ? plotWidth / filteredPoints.length : plotWidth;
  const barWidth = Math.max(18, Math.min(barSlotWidth * 0.55, 34));
  const getBarX = (index: number) => {
    return (
      chartPadding.left + index * barSlotWidth + (barSlotWidth - barWidth) / 2
    );
  };

  const getY = (value: number) => {
    if (domainMax === domainMin) return chartPadding.top + plotHeight / 2;
    return (
      chartPadding.top +
      ((domainMax - value) / (domainMax - domainMin)) * plotHeight
    );
  };

  const zeroAxisY = getY(0);
  const yTicks = [domainMax, (domainMax + domainMin) / 2, domainMin];

  return (
    <View style={styles.progressChartWrapper}>
      <View style={[styles.progressChart, { width: chartWidth }]}>
        {yTicks.map((tick, idx) => {
          const y = getY(tick);
          return (
            <View
              key={`grid-${idx}`}
              style={[
                styles.chartGridLine,
                { top: y, left: chartPadding.left, width: plotWidth },
              ]}
            />
          );
        })}

        <View
          style={[
            styles.chartAxisLine,
            { top: zeroAxisY, left: chartPadding.left, width: plotWidth },
          ]}
        />

        {filteredPoints.map((point, index) => {
          const x = getBarX(index);
          const y = getY(point.improvement);
          const barTop = point.improvement >= 0 ? y : zeroAxisY;
          const barHeight = Math.max(Math.abs(zeroAxisY - y), 4);
          const isPositive = point.improvement >= 0;
          const isCurrentWeek = !!point.isCurrent;
          // Amarillo solo para la semana en curso; azul para una semana anterior
          // (no en curso) que quedó incompleta en días.
          const isPrevIncomplete = !isCurrentWeek && !!point.isIncomplete;
          const isHighlighted = isCurrentWeek || isPrevIncomplete;
          const barColor = isCurrentWeek
            ? theme.colors.primary
            : isPrevIncomplete
            ? theme.colors.emoji_blue
            : isPositive
            ? theme.colors.success
            : theme.colors.error;
          const valueLabelTop = isPositive
            ? barTop - 16
            : barTop + barHeight + 2;
          const signedLabel = `${point.improvement > 0 ? '+' : ''}${Math.round(
            point.improvement
          )}%`;

          return (
            <React.Fragment key={`point-${point.week}-${index}`}>
              <View
                style={[
                  styles.chartBar,
                  {
                    left: x,
                    top: barTop,
                    height: barHeight,
                    width: barWidth,
                    backgroundColor: barColor,
                  },
                ]}
              />
              <Text
                style={[
                  styles.chartValueLabel,
                  isHighlighted && styles.chartValueLabelCurrent,
                  isPrevIncomplete && styles.chartLabelBlue,
                  { left: x + barWidth / 2 - 20, top: valueLabelTop },
                ]}
                numberOfLines={1}
              >
                {signedLabel}
              </Text>
              <Text
                style={[
                  styles.chartXLabel,
                  isCurrentWeek && styles.chartXLabelCurrent,
                  { left: x + barWidth / 2 - 16, top: chartHeight - 20 },
                ]}
              >
                S{point.week}
              </Text>
            </React.Fragment>
          );
        })}

        {yTicks.map((tick, idx) => {
          const y = getY(tick);
          return (
            <Text
              key={`y-label-${idx}`}
              style={[styles.chartYLabel, { top: y - 8 }]}
            >
              {`${Math.round(tick)}%`}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

// Contenido desplegable de cada semana. El layout refluye de forma síncrona
// (correcto, sin solapes) y cada día anima su aparición/desaparición con
// `entering`/`exiting` de Reanimated en el propio item (opacidad + transform
// sobre el hueco ya reservado). Animar la altura medía 0 en release y
// LayoutAnimation no refluía bien dentro del ScrollView anidado (las cabeceras
// tapaban los días); por eso solo animamos opacidad/transform, que es fiable.
// El contenedor se mantiene montado siempre (solo se alternan los hijos) para
// que la animación de salida `exiting` se reproduzca con un padre estable.
type TrendKind = 'up' | 'down' | 'neutral';

// Icono de tendencia coherente (sustituye las flechas Unicode ↑↓=).
function TrendIcon({
  kind,
  size,
  color,
}: {
  kind: TrendKind;
  size: number;
  color: string;
}) {
  const name =
    kind === 'up'
      ? 'arrow-up-bold'
      : kind === 'down'
      ? 'arrow-down-bold'
      : 'equal';
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export function HomeScreen({
  onSelectDay,
  onSelectLog,
  onEditLog,
  onNavigateHome,
  onNavigateCardio,
  onNavigateCalendar,
  onNavigateProfile,
  onOpenDaySelector,
  onOpenRoutineSelector,
  onOpenRoutineDetails,
  onCreateRoutine,
  onScanRoutineQR,
  onDeleteCurrentRoutine,
  onShowWeekAchievement,
  canDeleteCurrentRoutine = false,
  initialShowRoutineSelector = false,
  onCloseRoutineSelector,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const showCardioTab = hasAnyCardio(state.logs);
  const [showRoutineSelector, setShowRoutineSelector] = useState(
    initialShowRoutineSelector
  );
  const [showWeeklyProgressChart, setShowWeeklyProgressChart] = useState(false);
  const [chartDayFilter, setChartDayFilter] = useState<string | undefined>(
    undefined
  );
  const [expandedWeekBlocks, setExpandedWeekBlocks] = useState<
    Record<number, boolean>
  >({});
  const [routineToDeleteId, setRoutineToDeleteId] = useState<
    string | undefined
  >(undefined);
  const [logToDeleteId, setLogToDeleteId] = useState<string | undefined>(
    undefined
  );
  const [logWithOptionsId, setLogWithOptionsId] = useState<string | undefined>(
    undefined
  );
  const [selectedLogDayForOptions, setSelectedLogDayForOptions] = useState<
    WorkoutDay | undefined
  >(undefined);
  const { width: windowWidth } = useWindowDimensions();

  const activeRoutine = state.routines.find(
    (routine: WorkoutRoutine) => routine.id === state.activeRoutineId
  );

  // La rutina que se muestra en Inicio es la SELECCIONADA (persistida en el
  // estado; se marca en la vista de Rutinas). Si la seleccionada ya no existe,
  // se cae a la activa. Seleccionar una rutina no la activa (ver item Rutinas).
  const displayedRoutineId = state.routines.some(
    (routine) => routine.id === state.selectedRoutineId
  )
    ? state.selectedRoutineId
    : state.activeRoutineId;
  const displayedRoutine = state.routines.find(
    (routine: WorkoutRoutine) => routine.id === displayedRoutineId
  );

  // Al cambiar de rutina visualizada, resetear el filtro de la gráfica a "Todos"
  // (los IDs de día pertenecen a otra rutina y dejarían de existir).
  useEffect(() => {
    setChartDayFilter(undefined);
  }, [displayedRoutineId]);

  // Detectar si la rutina visualizada es la activa
  const isDisplayedRoutineActive = displayedRoutineId === state.activeRoutineId;

  // Detectar si la rutina visualizada es una vieja (tiene logs)
  const isRoutineOld =
    displayedRoutineId &&
    state.logs.some((log) => log.routineId === displayedRoutineId);

  // Usar la rutina visualizada para mostrar datos
  const activeDays = displayedRoutine?.days || [];
  const displayedRoutineLogs = useMemo(
    () =>
      state.logs
        .filter(
          (log: WorkoutLog) =>
            (!displayedRoutineId || log.routineId === displayedRoutineId) &&
            // Solo cardio no aparece en Inicio (Fuerza), solo en Cardio.
            !log.cardioOnly
        )
        .sort((a: WorkoutLog, b: WorkoutLog) => b.createdAt - a.createdAt),
    [displayedRoutineId, state.logs]
  );
  const weeklyProgress = useMemo(
    () => buildWeekProgress(state.logs, displayedRoutineId, activeDays),
    [activeDays, state.logs, displayedRoutineId]
  );
  const chartWidth = Math.max(
    250,
    Math.min(windowWidth - theme.spacing.md * 2 - 20, 420)
  );
  const hasNoRoutines = activeDays.length === 0;
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const {
    bottom: floatingNavBottom,
    scrollBottomPadding: floatingNavScrollBottomPadding,
  } = getFloatingPrimaryNavMetrics(insets.bottom);
  // El selector de rutinas no es una pestaña de navegación: lleva botón Volver
  // abajo en lugar de la barra, así que su padding se calcula con la altura del
  // botón (no con la de la barra flotante).
  const selectorBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const selectorScrollBottomPadding =
    selectorBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;
  const homeScrollBottomPadding = floatingNavScrollBottomPadding;
  const appVersion = Constants.expoConfig?.version ?? '';

  const formatImprovementDisplay = (imp: {
    isImproved: boolean;
    percent: number;
  }) => {
    const { symbol, display, kind } = getImprovementDisplay(imp);
    const styleKey =
      kind === 'up'
        ? 'weekImprovementUp'
        : kind === 'down'
        ? 'weekImprovementDown'
        : 'weekImprovementNeutral';
    return { symbol, styleKey, display, kind };
  };

  const todayWorkoutStatus = useMemo(():
    | 'none'
    | 'in-progress'
    | 'completed' => {
    const todayKey = new Date().toISOString().split('T')[0];
    const todayLog = displayedRoutineLogs.find((log) =>
      log.date
        ? log.date === todayKey
        : new Date(log.createdAt).toISOString().split('T')[0] === todayKey
    );
    if (!todayLog) return 'none';

    let todayDay: WorkoutDay | undefined;
    for (const routine of state.routines) {
      const day = routine.days.find((d) => d.id === todayLog.dayId);
      if (day) {
        todayDay = day;
        break;
      }
    }

    if (!todayDay || todayDay.exercises.length === 0) return 'completed';

    // Un ejercicio está completo cuando alcanza su número de series objetivo
    // (mismo criterio que `isTargetCompleted` en WorkoutLogScreen), no con que
    // tenga solo una serie metida: si falta una serie del objetivo, el
    // entrenamiento sigue en progreso.
    const allFilled = todayDay.exercises.every((ex) => {
      const exLog = todayLog.exercises.find(
        (e: ExerciseLog) => e.exerciseId === ex.id
      );
      const setsCount = exLog?.parsedSets?.length ?? 0;
      const targetSets = ex.targetSets && ex.targetSets > 0 ? ex.targetSets : 1;
      return setsCount >= targetSets;
    });
    return allFilled ? 'completed' : 'in-progress';
  }, [displayedRoutineLogs, state.routines]);

  const handleStartPress = () => {
    if (hasNoRoutines) {
      onCreateRoutine?.();
      return;
    }

    // Semana completada hoy: abrir la imagen de logros en lugar de iniciar entreno.
    if (isCurrentWeekCompletedToday) {
      handleShowWeekAchievement();
      return;
    }

    // Entrenamiento del día completado: no hacer nada
    if (todayWorkoutStatus === 'completed') {
      return;
    }

    // Rutina cerrada (vieja y no activa): pulsar la hero lleva a Rutinas para
    // cambiar de rutina, en vez de iniciar un entrenamiento.
    if (isRoutineOld && !isDisplayedRoutineActive) {
      onOpenRoutineSelector?.();
      return;
    }

    // Entrenamiento iniciado pero con ejercicios pendientes: abrir directamente
    if (todayWorkoutStatus === 'in-progress') {
      const todayKey = new Date().toISOString().split('T')[0];
      const todayLog = displayedRoutineLogs.find((log) =>
        log.date
          ? log.date === todayKey
          : new Date(log.createdAt).toISOString().split('T')[0] === todayKey
      );
      if (todayLog) {
        const todayDay = getDay(todayLog.dayId);
        if (todayDay) {
          onSelectDay(todayDay);
          return;
        }
      }
    }

    if (onOpenDaySelector) {
      onOpenDaySelector();
      return;
    }

    const firstDay = activeDays[0];
    if (firstDay) {
      onSelectDay(firstDay);
    }
  };

  const getDay = (dayId: string): WorkoutDay | undefined => {
    for (const routine of state.routines) {
      const day = routine.days.find((d: WorkoutDay) => d.id === dayId);
      if (day) return day;
    }
    return undefined;
  };

  const isWeekCompleted = (weekLogs: WorkoutLog[]): boolean => {
    if (weekLogs.length === 0) return false;
    if (activeDays.length === 0) return false;

    const daysWithLogs = new Set(weekLogs.map((log) => log.dayId));
    return activeDays.every((day) => daysWithLogs.has(day.id));
  };

  const buildWeekDataForLogs = (sourceLogs: WorkoutLog[]) => ({
    groupedByBlock: groupLogsIntoWeekBlocks(
      sourceLogs,
      (log) => getDay(log.dayId)?.dayNumber
    ),
  });

  const getPreviousFilledLogForSameDay = (currentLog: WorkoutLog) => {
    const currentTs = getLogTimestamp(currentLog);
    return (
      displayedRoutineLogs
        .filter(
          (log: WorkoutLog) =>
            log.dayId === currentLog.dayId && log.id !== currentLog.id
        )
        .filter((log: WorkoutLog) => getLogTimestamp(log) < currentTs)
        .sort(
          (a: WorkoutLog, b: WorkoutLog) =>
            getLogTimestamp(b) - getLogTimestamp(a)
        )[0] || null
    );
  };

  // Mejora entre dos sesiones: se agrega el volumen de carga total de cada una
  // y se saca UN solo porcentaje (mismo criterio que Detail y la gráfica).
  const computeImprovementBetweenLogs = (
    currentLog: WorkoutLog,
    previousLog: WorkoutLog | null
  ): ImprovementResult | null => {
    if (!previousLog) return null;
    return buildImprovementFromStrengthScores(
      getWorkoutStrengthScore(currentLog),
      getWorkoutStrengthScore(previousLog)
    );
  };

  // Mejora de una sesión respecto a la anterior del mismo día (independiente de la semana).
  const getLogImprovement = (currentLog: WorkoutLog) =>
    computeImprovementBetweenLogs(
      currentLog,
      getPreviousFilledLogForSameDay(currentLog)
    );

  const getWeekImprovement = (
    groupedByBlock: Record<number, WorkoutLog[]>,
    blockNumber: number
  ) => {
    if (blockNumber === 1) return null;

    const currentWeekLogs = groupedByBlock[blockNumber] || [];
    const previousWeekLogs = groupedByBlock[blockNumber - 1] || [];

    if (activeDays.length === 0) return null;

    // Solo se comparan los días entrenados esta semana, contra esos mismos días de
    // la semana anterior (sin penalizar los que falten), igual que la gráfica.
    const currentDayIds = Array.from(
      new Set(currentWeekLogs.map((log) => log.dayId).filter(Boolean))
    );
    if (currentDayIds.length === 0) return null;

    const scoreOptions = {
      activeDaysCount: activeDays.length,
      restrictToDayIds: currentDayIds,
      applyMissingPenalty: false,
    };
    const currentStrength = getWeekStrengthScore(currentWeekLogs, scoreOptions);
    const previousStrength = getWeekStrengthScore(
      previousWeekLogs,
      scoreOptions
    );

    return buildImprovementFromStrengthScores(
      currentStrength,
      previousStrength
    );
  };

  const { groupedByBlock, blocks, currentWeekBlock } = useMemo(() => {
    const { groupedByBlock } = buildWeekDataForLogs(displayedRoutineLogs);
    const blocks = Object.keys(groupedByBlock)
      .map(Number)
      .sort((a, b) => b - a);
    return {
      groupedByBlock,
      blocks,
      currentWeekBlock: blocks[0],
    };
  }, [displayedRoutineLogs]);

  // Racha: semanas completadas consecutivas hasta la última. Una semana en curso
  // (la más reciente, aún incompleta) no rompe la racha.
  const completedStreak = useMemo(() => {
    const asc = Object.keys(groupedByBlock)
      .map(Number)
      .sort((a, b) => a - b);
    let streak = 0;
    for (let i = asc.length - 1; i >= 0; i--) {
      const weekLogs = groupedByBlock[asc[i]] || [];
      if (isWeekCompleted(weekLogs)) {
        streak++;
      } else if (i === asc.length - 1) {
        continue;
      } else {
        break;
      }
    }
    return streak;
  }, [groupedByBlock, activeDays]);

  // Días entrenados consecutivos sin saltarse ningún entreno: suma de días de
  // cada semana completa de la racha actual (la métrica que muestra el póster).
  const streakDays = useMemo(() => {
    const asc = Object.keys(groupedByBlock)
      .map(Number)
      .sort((a, b) => a - b);
    let days = 0;
    for (let i = asc.length - 1; i >= 0; i--) {
      const weekLogs = groupedByBlock[asc[i]] || [];
      if (isWeekCompleted(weekLogs)) {
        days += new Set(weekLogs.map((l) => l.dayId).filter(Boolean)).size;
      } else if (i === asc.length - 1) {
        continue;
      } else {
        break;
      }
    }
    return days;
  }, [groupedByBlock, activeDays]);

  // Semana en curso completada: todos los días de la rutina activa entrenados en
  // el bloque más reciente. Es la condición que convierte la tarjeta principal en
  // "¡Semana completada!" y habilita la imagen de logros.
  const currentWeekLogsBlock = groupedByBlock[currentWeekBlock] || [];
  const isCurrentWeekCompleted =
    isDisplayedRoutineActive && isWeekCompleted(currentWeekLogsBlock);

  // El botón/tarjeta "¡Semana completada!" solo está disponible el mismo día en que
  // se completó la semana (hay algún log del bloque con fecha de hoy). Al día
  // siguiente la tarjeta vuelve a "Empezar entrenamiento" para iniciar la siguiente.
  const isCurrentWeekCompletedToday = useMemo(() => {
    if (!isCurrentWeekCompleted) return false;
    const todayKey = new Date().toISOString().split('T')[0];
    return currentWeekLogsBlock.some(
      (log) =>
        (log.date ?? new Date(log.createdAt).toISOString().split('T')[0]) ===
        todayKey
    );
  }, [isCurrentWeekCompleted, currentWeekLogsBlock]);

  // Racha perfecta: todas las semanas registradas están completas (nunca se ha
  // faltado un solo día de la rutina).
  const streakIsPerfect = useMemo(() => {
    const allBlocks = Object.keys(groupedByBlock).map(Number);
    return (
      allBlocks.length > 0 &&
      allBlocks.every((block) => isWeekCompleted(groupedByBlock[block] || []))
    );
  }, [groupedByBlock, activeDays]);

  // Logs de todas las semanas anteriores a un bloque (histórico para récords) y
  // entrenos totales (días distintos entrenados) hasta un bloque inclusive.
  const logsBeforeBlock = (block: number): WorkoutLog[] =>
    Object.keys(groupedByBlock)
      .map(Number)
      .filter((b) => b < block)
      .flatMap((b) => groupedByBlock[b] || []);
  const workoutsUpToBlock = (block: number): number =>
    Object.keys(groupedByBlock)
      .map(Number)
      .filter((b) => b <= block)
      .reduce(
        (sum, b) =>
          sum +
          new Set(
            (groupedByBlock[b] || []).map((log) => log.dayId).filter(Boolean)
          ).size,
        0
      );

  const weekAchievements = useMemo<WeekAchievements | null>(() => {
    if (!isCurrentWeekCompleted) return null;
    return computeWeekAchievements({
      weekLogs: currentWeekLogsBlock,
      previousWeekLogs: groupedByBlock[currentWeekBlock - 1] || [],
      weekNumber: currentWeekBlock,
      streakDays,
      streakIsPerfect,
      historyLogs: logsBeforeBlock(currentWeekBlock),
      totalWorkouts: workoutsUpToBlock(currentWeekBlock),
      progressSeries: weeklyProgress.map((point) => ({
        week: point.week,
        improvement: point.improvement,
      })),
    });
  }, [
    isCurrentWeekCompleted,
    currentWeekLogsBlock,
    groupedByBlock,
    currentWeekBlock,
    streakDays,
    streakIsPerfect,
    weeklyProgress,
  ]);

  const handleShowWeekAchievement = () => {
    if (weekAchievements && onShowWeekAchievement) {
      onShowWeekAchievement(weekAchievements, displayedRoutine?.name);
    }
  };

  // Logros de una semana pasada concreta (long-press en su cabecera). Reconstruye
  // racha y serie de progreso tal como estaban al cerrar esa semana.
  const handleShowWeekAchievementForBlock = (block: number) => {
    if (!onShowWeekAchievement) return;
    const weekLogs = groupedByBlock[block];
    if (!weekLogs || weekLogs.length === 0) return;

    const asc = Object.keys(groupedByBlock)
      .map(Number)
      .sort((a, b) => a - b);

    // Racha (días consecutivos sin saltar entreno) hasta esta semana inclusive.
    let streakDaysForBlock = 0;
    for (let i = asc.indexOf(block); i >= 0; i--) {
      const logs = groupedByBlock[asc[i]] || [];
      if (isWeekCompleted(logs)) {
        streakDaysForBlock += new Set(logs.map((l) => l.dayId).filter(Boolean))
          .size;
      } else {
        break;
      }
    }

    const blocksUpTo = asc.filter((b) => b <= block);
    const streakIsPerfectForBlock =
      blocksUpTo.length > 0 &&
      blocksUpTo.every((b) => isWeekCompleted(groupedByBlock[b] || []));

    const achievements = computeWeekAchievements({
      weekLogs,
      previousWeekLogs: groupedByBlock[block - 1] || [],
      weekNumber: block,
      streakDays: streakDaysForBlock,
      streakIsPerfect: streakIsPerfectForBlock,
      historyLogs: logsBeforeBlock(block),
      totalWorkouts: workoutsUpToBlock(block),
      progressSeries: weeklyProgress
        .filter((point) => point.week <= block)
        .map((point) => ({ week: point.week, improvement: point.improvement })),
    });

    onShowWeekAchievement(achievements, displayedRoutine?.name);
  };

  // El gráfico muestra todas las semanas entrenadas tal cual: la última semana en
  // curso (incompleta) se muestra resaltada como "actual" desde buildWeekProgress,
  // y no se añaden semanas fantasma. No hay nada que recortar aquí.
  const filteredWeeklyProgress = useMemo(
    () =>
      chartDayFilter
        ? buildWeekProgress(
            state.logs,
            displayedRoutineId,
            activeDays,
            chartDayFilter
          )
        : weeklyProgress,
    [chartDayFilter, weeklyProgress, state.logs, displayedRoutineId, activeDays]
  );

  const latestPoint = filteredWeeklyProgress[filteredWeeklyProgress.length - 1];

  // Estado visual de la tarjeta principal según la situación de la rutina/día.
  const getHeroState = (): {
    variant: HeroVariant;
    icon: string;
    title: string;
    titleIcon?: string;
    subtitle?: string;
  } => {
    if (hasNoRoutines) {
      return {
        variant: 'add',
        icon: 'plus-thick',
        title: t('Añade una rutina'),
      };
    }
    if (isRoutineOld && !isDisplayedRoutineActive) {
      return {
        variant: 'closed',
        icon: 'lock-outline',
        title: t('Rutina cerrada'),
        subtitle: t('Pulsa para cambiar la rutina'),
      };
    }
    if (isCurrentWeekCompletedToday) {
      return {
        variant: 'week-completed',
        icon: 'trophy-variant',
        title: t('¡Semana completada!'),
        subtitle: t('Pulsa para compartir resultados'),
      };
    }
    if (todayWorkoutStatus === 'in-progress') {
      return {
        variant: 'start',
        icon: 'weight-lifter',
        title: t('Continúa tu entrenamiento'),
      };
    }
    if (todayWorkoutStatus === 'completed') {
      return {
        variant: 'completed',
        icon: 'check-bold',
        title: t('Entrenamiento completado'),
      };
    }
    return {
      variant: 'start',
      icon: 'weight-lifter',
      title: t('Empezar entrenamiento'),
    };
  };
  const hero = getHeroState();

  // Estadísticas de fuerza para el estado "estadísticas" de la hero card
  // (carrusel). Espejo de la hero de Cardio pero con volumen (kg levantados)
  // por semana de la rutina mostrada. El volumen ignora el peso corporal
  // (series sin carga) por definición de "kg levantados".
  const strengthStats = useMemo(() => {
    const workoutVolume = (log: WorkoutLog): number =>
      log.exercises.reduce(
        (sum, ex) =>
          sum +
          (ex.parsedSets || []).reduce(
            (a, set) =>
              a + (set.weight > 0 && set.reps > 0 ? set.weight * set.reps : 0),
            0
          ),
        0
      );

    const blockNums = Object.keys(groupedByBlock)
      .map(Number)
      .sort((a, b) => a - b);
    if (blockNums.length === 0) {
      return { hasData: false as const };
    }

    const weekVolume = (block: number) =>
      (groupedByBlock[block] || []).reduce((s, l) => s + workoutVolume(l), 0);

    const latest = blockNums[blockNums.length - 1];
    const prev = blockNums.length > 1 ? blockNums[blockNums.length - 2] : null;
    const currentVol = weekVolume(latest);
    const lastVol = prev != null ? weekVolume(prev) : null;
    const completed = blockNums.filter((b) => b !== latest);
    const avgVol = completed.length
      ? completed.reduce((s, b) => s + weekVolume(b), 0) / completed.length
      : null;
    const bestVol = Math.max(...blockNums.map(weekVolume));

    const currentLogs = groupedByBlock[latest] || [];
    const entrenos = new Set(
      currentLogs.map((l) => l.dayId).filter(Boolean)
    ).size;
    const series = currentLogs.reduce(
      (s, l) =>
        s + l.exercises.reduce((a, ex) => a + (ex.parsedSets?.length || 0), 0),
      0
    );
    // Repeticiones y ejercicios distintos de la semana en curso: datos que
    // siempre tienen sentido (también en la primera semana, cuando media/mejor
    // no aportan nada).
    const reps = currentLogs.reduce(
      (s, l) =>
        s +
        l.exercises.reduce(
          (a, ex) =>
            a +
            (ex.parsedSets || []).reduce(
              (r, set) => r + (set.reps > 0 ? set.reps : 0),
              0
            ),
          0
        ),
      0
    );
    const ejercicios = new Set(
      currentLogs.flatMap((l) => l.exercises.map((ex) => ex.exerciseId))
    ).size;
    // % de cambio de volumen vs la semana pasada (null si no hay con qué comparar).
    const deltaPct =
      lastVol != null && lastVol > 0
        ? ((currentVol - lastVol) / lastVol) * 100
        : null;

    return {
      hasData: true as const,
      weeksCount: blockNums.length,
      currentVol,
      lastVol,
      avgVol,
      bestVol,
      deltaPct,
      entrenos,
      series,
      reps,
      ejercicios,
    };
  }, [groupedByBlock]);

  const fmtKg = (v: number | null | undefined) =>
    v == null ? '—' : Math.round(v).toLocaleString(dateLocale);
  const fmtInt = (v: number) => Math.round(v).toLocaleString(dateLocale);
  const fmtPct = (v: number | null) =>
    v == null ? '—' : `${v >= 0 ? '+' : ''}${Math.round(v)}%`;

  // Fila de 3 datos de la hero de Fuerza, adaptada a las semanas disponibles
  // (comparativa progresiva): en la primera semana no hay con qué comparar, así
  // que se muestra la composición del entreno; en la segunda, la semana pasada y
  // el cambio; a partir de la tercera, las referencias históricas.
  const strengthHeroStats: HeroStat[] = !strengthStats.hasData
    ? []
    : strengthStats.weeksCount >= 3
      ? [
          { value: fmtKg(strengthStats.lastVol), label: t('semana pasada') },
          { value: fmtKg(strengthStats.avgVol), label: t('media semanal') },
          { value: fmtKg(strengthStats.bestVol), label: t('mejor semana') },
        ]
      : strengthStats.weeksCount === 2
        ? [
            { value: fmtKg(strengthStats.lastVol), label: t('semana pasada') },
            { value: fmtPct(strengthStats.deltaPct), label: t('cambio') },
            { value: fmtInt(strengthStats.reps), label: t('reps') },
          ]
        : [
            { value: fmtInt(strengthStats.series), label: t('series') },
            { value: fmtInt(strengthStats.reps), label: t('reps') },
            { value: fmtInt(strengthStats.ejercicios), label: t('ejercicios') },
          ];

  const handleSelectRoutine = (routineId: string) => {
    // Pulsar una rutina solo la marca como seleccionada: NO la activa ni
    // navega a Inicio. Queda seleccionada (persistente) hasta elegir otra.
    dispatch({ type: 'SET_SELECTED_ROUTINE', payload: routineId });
  };

  const handleDeleteRoutine = () => {
    if (!routineToDeleteId) return;

    const routine = state.routines.find((r) => r.id === routineToDeleteId);
    if (!routine) return;

    // El reducer reajusta la selección si se borra la seleccionada.
    dispatch({ type: 'DELETE_ROUTINE', payload: routineToDeleteId });

    setRoutineToDeleteId(undefined);
  };

  const getExecutionDateLabel = (log: WorkoutLog): string => {
    if (log.date) {
      return new Date(`${log.date}T00:00:00`).toLocaleDateString(dateLocale);
    }

    return new Date(log.createdAt).toLocaleDateString(dateLocale);
  };

  const isLogFromToday = (log: WorkoutLog): boolean => {
    const todayKey = new Date().toISOString().split('T')[0];
    return log.date
      ? log.date === todayKey
      : getExecutionDateLabel(log) ===
          new Date().toLocaleDateString(dateLocale);
  };

  // El modal de opciones ("¿Qué deseas hacer?") se abre tanto al pulsar el
  // registro de hoy como al mantener pulsado cualquier otro día pasado. Solo
  // en el primer caso, y si aún quedan ejercicios sin rellenar, el botón
  // "Editar" pasa a "Continuar" (misma acción: abre el registro para seguir
  // metiendo series).
  const optionsLog = displayedRoutineLogs.find(
    (l) => l.id === logWithOptionsId
  );
  const isTodayLogInProgress =
    !!optionsLog &&
    isLogFromToday(optionsLog) &&
    todayWorkoutStatus === 'in-progress';

  const handleDeleteLog = () => {
    if (!logToDeleteId) return;
    dispatch({ type: 'DELETE_WORKOUT_LOG', payload: logToDeleteId });
    setLogToDeleteId(undefined);
  };

  const handleCloseRoutineSelector = () => {
    if (onCloseRoutineSelector) {
      onCloseRoutineSelector();
      return;
    }

    setShowRoutineSelector(false);
  };

  if (showRoutineSelector) {
    const selectedRoutineInSelector = state.routines.find(
      (r) => r.id === displayedRoutineId
    );

    return (
      <View style={styles.container}>
        <StatusBar
          style={theme.statusBarStyle}
          translucent
          backgroundColor="transparent"
        />

        <StretchScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.routineListContainer,
            {
              paddingTop: topBarHeight + 28,
              paddingBottom: selectorScrollBottomPadding,
            },
          ]}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
        >
          {state.routines.map((routine: WorkoutRoutine) => {
            const routineHasLogs = state.logs.some(
              (log) => log.routineId === routine.id
            );
            const isActive = routine.id === state.activeRoutineId;
            // "Preparada": creada pero aún no entrenada (no es la activa y sin
            // historial). Se activará al registrar su primer día.
            const isPrepared = !isActive && !routineHasLogs;
            const canDelete = !routineHasLogs;

            return (
              <RoutineCard
                key={routine.id}
                routine={routine}
                isViewed={routine.id === displayedRoutineId}
                isActive={isActive}
                isPrepared={isPrepared}
                onPress={() => handleSelectRoutine(routine.id)}
                onLongPress={
                  canDelete ? () => setRoutineToDeleteId(routine.id) : undefined
                }
              />
            );
          })}

          {onCreateRoutine && (
            <TouchableOpacity
              style={styles.newRoutineCard}
              onPress={() => {
                setShowRoutineSelector(false);
                onCreateRoutine();
              }}
            >
              <Text style={styles.newRoutineCardText}>
                {t('+ Nueva rutina')}
              </Text>
            </TouchableOpacity>
          )}

          {!!selectedRoutineInSelector && !!onOpenRoutineDetails && (
            <TouchableOpacity
              style={styles.selectorDetailsButton}
              onPress={() => onOpenRoutineDetails(selectedRoutineInSelector)}
            >
              <Text style={styles.selectorDetailsButtonText}>
                {t('Consultar detalles de esta rutina')}
              </Text>
            </TouchableOpacity>
          )}
        </StretchScrollView>

        <GlassTopBar
          title={t('Rutinas')}
          icon="book-open-variant"
          subtitle={t('Consulta la que desees o crea una nueva')}
          topInset={insets.top}
        />

        <FloatingBackButton
          onPress={handleCloseRoutineSelector}
          bottom={selectorBackBottom}
        />

        <ConfirmModal
          visible={!!routineToDeleteId}
          title={t('¿Eliminar rutina?')}
          message={t('Esta acción no se puede deshacer. ¿Estás seguro?')}
          confirmLabel={t('Eliminar')}
          onConfirm={handleDeleteRoutine}
          onCancel={() => setRoutineToDeleteId(undefined)}
        />

        <ConfirmModal
          visible={!!logToDeleteId}
          title={t('¿Eliminar entrenamiento?')}
          message={t('Esta acción no se puede deshacer. ¿Estás seguro?')}
          confirmLabel={t('Eliminar')}
          onConfirm={handleDeleteLog}
          onCancel={() => setLogToDeleteId(undefined)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

      <StretchScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.homeScrollContent,
          {
            paddingTop: topBarHeight + 28,
            paddingBottom: homeScrollBottomPadding,
          },
        ]}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {hasNoRoutines ? (
          // Sin rutinas: un único estado (añadir rutina), sin carrusel.
          <HeroCard
            variant={hero.variant}
            icon={hero.icon}
            title={hero.title}
            titleIcon={hero.titleIcon}
            subtitle={hero.subtitle}
            onPress={handleStartPress}
          />
        ) : (
          // Tres estados con flechas: situación actual, ir a las rutinas y
          // estadísticas de fuerza (volumen semanal).
          <HeroCarousel
            slides={[
              <HeroCard
                key="status"
                variant={hero.variant}
                icon={hero.icon}
                title={hero.title}
                titleIcon={hero.titleIcon}
                subtitle={hero.subtitle}
                onPress={handleStartPress}
              />,
              <HeroCard
                key="routines"
                variant="start"
                icon="book-open-variant"
                title={t('Ver rutinas')}
                onPress={() => onOpenRoutineSelector?.()}
              />,
              <HeroStatsCard
                key="stats"
                isEmpty={!strengthStats.hasData}
                emptyText={t('Aún no hay entrenamientos registrados.')}
                kicker={t('Esta semana')}
                mainIcon="weight-lifter"
                mainValue={fmtKg(
                  strengthStats.hasData ? strengthStats.currentVol : null
                )}
                mainUnit="kg"
                subline={
                  strengthStats.hasData
                    ? `${strengthStats.entrenos} ${
                        strengthStats.entrenos === 1
                          ? t('entreno')
                          : t('entrenos')
                      } · ${strengthStats.series} ${
                        strengthStats.series === 1 ? t('serie') : t('series')
                      }`
                    : ''
                }
                stats={strengthHeroStats}
              />,
            ]}
          />
        )}

        {isDisplayedRoutineActive && completedStreak >= 2 && (
          <View style={styles.streakChip}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>
              {t('{n} semanas seguidas', { n: completedStreak })}
            </Text>
          </View>
        )}

        {filteredWeeklyProgress.length > 0 &&
          (() => {
            // Primera semana de la rutina: no hay semana previa con la que
            // comparar, así que la tarjeta no se despliega (no hay gráfico útil),
            // sin flecha ni porcentaje, solo un mensaje de ánimo.
            const isFirstWeek = filteredWeeklyProgress.length <= 1;
            // El borde de la tarjeta de la gráfica es siempre blanco. El
            // verde/rojo solo aparece en el dato de subida/bajada de dentro.
            const progressAccent = theme.colors.white;
            return (
              <View
                style={[styles.progressCard, { borderColor: progressAccent }]}
              >
                <GradientFill accent={progressAccent} />
                <TouchableOpacity
                  style={styles.progressToggleButton}
                  onPress={
                    isFirstWeek
                      ? undefined
                      : () => {
                          animateLayout();
                          setShowWeeklyProgressChart((prev: boolean) => !prev);
                        }
                  }
                  disabled={isFirstWeek}
                  activeOpacity={0.85}
                >
                  <View style={styles.progressHeaderRow}>
                    <View style={styles.progressTitleRow}>
                      <MaterialCommunityIcons
                        name="chart-bar"
                        size={18}
                        style={styles.progressTitleIcon}
                      />
                      <Text style={styles.progressTitle}>
                        Rutina{' '}
                        {state.routines.findIndex(
                          (r: WorkoutRoutine) => r.id === displayedRoutineId
                        ) + 1}
                      </Text>
                      {!isFirstWeek && (
                        <MaterialCommunityIcons
                          name={
                            showWeeklyProgressChart
                              ? 'chevron-up'
                              : 'chevron-down'
                          }
                          size={20}
                          color={theme.colors.text}
                        />
                      )}
                    </View>
                    {isFirstWeek ? (
                      <Text style={styles.progressEncourage} numberOfLines={2}>
                        ¡Ánimo con tu nueva rutina!
                      </Text>
                    ) : latestPoint ? (
                      <View style={styles.deltaRow}>
                        <TrendIcon
                          kind={latestPoint.improvement >= 0 ? 'up' : 'down'}
                          size={16}
                          color={
                            latestPoint.improvement >= 0
                              ? theme.colors.success
                              : theme.colors.error
                          }
                        />
                        <AnimatedCounter
                          value={Math.abs(latestPoint.improvement)}
                          decimals={1}
                          suffix="%"
                          style={[
                            styles.progressLatest,
                            latestPoint.improvement >= 0
                              ? styles.progressLatestUp
                              : styles.progressLatestDown,
                          ]}
                        />
                      </View>
                    ) : (
                      <Text
                        style={[styles.progressLatest, styles.progressLatestUp]}
                      >
                        0%
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {!isFirstWeek &&
                  showWeeklyProgressChart &&
                  (() => {
                    // Un único botón que rota entre "Semana completa" y cada día de la
                    // rutina a cada pulsación (vuelve al principio al llegar al final).
                    const dayOptions = [
                      {
                        id: undefined as string | undefined,
                        label: t('Semana completa'),
                      },
                      ...activeDays.map((day: WorkoutDay, index: number) => ({
                        id: day.id,
                        label:
                          getDisplayDayName(day.name) ||
                          `${t('Día')} ${index + 1}`,
                      })),
                    ];
                    const currentIndex = Math.max(
                      0,
                      dayOptions.findIndex((opt) => opt.id === chartDayFilter)
                    );
                    const current = dayOptions[currentIndex];
                    const cycleDay = () => {
                      animateLayout();
                      const next =
                        dayOptions[(currentIndex + 1) % dayOptions.length];
                      setChartDayFilter(next.id);
                    };
                    return (
                      <>
                        <ProgressBarChart
                          points={filteredWeeklyProgress}
                          width={chartWidth}
                        />
                        <TouchableOpacity
                          style={styles.chartFilterButton}
                          onPress={cycleDay}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons
                            name="autorenew"
                            size={16}
                            color={theme.colors.text}
                          />
                          <Text
                            style={styles.chartFilterButtonText}
                            numberOfLines={1}
                          >
                            {current.label}
                          </Text>
                        </TouchableOpacity>
                      </>
                    );
                  })()}
              </View>
            );
          })()}

        {displayedRoutineLogs.length > 0 && (
          // Sin ScrollView anidado: recortaba las sombras de las tarjetas de
          // semana (bordes duros) e interfería con el colapsable. Las semanas
          // scrollean con la vista principal, como en Cardio.
          <View style={styles.weeksSection}>
            <View>
              {blocks.map((block: number) => {
                const weekLogs = groupedByBlock[block].slice().reverse();
                const weekLogsFull = groupedByBlock[block];
                const weekCompleted = isWeekCompleted(weekLogsFull);
                // Si la rutina no es activa, todas las semanas están colapsadas
                // Si es activa y la semana no está completada, la última semana está expandida por defecto
                // Las semanas completadas están colapsadas por defecto, pero se pueden expandir/colapsar manualmente
                const isExpanded =
                  isDisplayedRoutineActive && !weekCompleted
                    ? expandedWeekBlocks[block] ?? block === currentWeekBlock
                    : expandedWeekBlocks[block] ?? false;
                const weekImprovement = getWeekImprovement(
                  groupedByBlock,
                  block
                );
                const isCurrentWeek =
                  isDisplayedRoutineActive && block === currentWeekBlock;
                // Tarjeta: siempre blanca salvo la semana en curso (amarilla).
                // El verde/rojo solo se usa en el dato de subida/bajada.
                const weekAccent = isCurrentWeek
                  ? theme.colors.primary
                  : theme.colors.white;

                return (
                  // Sin `Animated.View layout`: un padre con animación de layout
                  // (transform) rompía la sombra de elevación de las tarjetas
                  // hijas en Android (aparecía cortada/sin redondear). El colapso
                  // lo anima <Collapsible/> por su propia altura.
                  <View key={block} style={styles.weekBlock}>
                    <Pressable
                      style={[
                        styles.weekHeaderButton,
                        { borderColor: weekAccent },
                      ]}
                      onPress={() => {
                        // Sin LayoutAnimation: dentro del ScrollView anidado no
                        // refluía bien y las cabeceras tapaban los días. Render
                        // condicional directo → reflujo síncrono correcto.
                        setExpandedWeekBlocks(
                          (prev: Record<number, boolean>) => ({
                            ...prev,
                            [block]: !isExpanded,
                          })
                        );
                      }}
                      onLongPress={
                        !isCurrentWeek
                          ? () => handleShowWeekAchievementForBlock(block)
                          : undefined
                      }
                      delayLongPress={3000}
                    >
                      <GradientFill accent={weekAccent} />

                      <View style={styles.weekTitleRow}>
                        <Text
                          style={[styles.weekTitle, { color: theme.colors.white }]}
                        >
                          {t('Semana')} {block}
                        </Text>
                        {!!weekImprovement && (
                          <View style={styles.deltaRow}>
                            <TrendIcon
                              kind={weekImprovement.isImproved ? 'up' : 'down'}
                              size={15}
                              color={
                                weekImprovement.isImproved
                                  ? theme.colors.success
                                  : theme.colors.error
                              }
                            />
                            <AnimatedCounter
                              value={weekImprovement.percent}
                              decimals={1}
                              suffix="%"
                              style={[
                                styles.weekImprovementText,
                                weekImprovement.isImproved
                                  ? styles.weekImprovementUp
                                  : styles.weekImprovementDown,
                              ]}
                            />
                          </View>
                        )}
                      </View>
                      <View style={styles.weekMetaRow}>
                        <Text style={styles.weekHeaderMeta}>
                          {weekLogs.length} día
                          {weekLogs.length === 1 ? '' : 's'}
                        </Text>
                        <MaterialCommunityIcons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={theme.colors.textSecondary}
                        />
                      </View>
                    </Pressable>

                    <Collapsible open={isExpanded}>
                      {weekLogs.map((log: WorkoutLog, logIndex: number) => {
                        const day = getDay(log.dayId);
                        const improvement = getLogImprovement(log);
                        const improvementFmt = improvement
                          ? formatImprovementDisplay(improvement)
                          : null;
                        const isToday = isLogFromToday(log);
                        if (!day) return null;

                        return (
                          <View key={log.id}>
                            <Pressable
                              style={({ pressed }: { pressed: boolean }) => [
                                styles.historyLogCard,
                                isToday && styles.historyLogCardToday,
                                pressed && styles.historyLogCardPressed,
                              ]}
                              onPress={() => {
                                if (isToday) {
                                  // Hoy: mostrar modal con opciones (editar / eliminar)
                                  setLogWithOptionsId(log.id);
                                  setSelectedLogDayForOptions(day);
                                } else {
                                  // Días pasados: ir directamente a la vista de detalle
                                  onSelectLog?.(log, day);
                                }
                              }}
                              onLongPress={() => {
                                // Long press en cualquier log para opciones (editar / eliminar)
                                setLogWithOptionsId(log.id);
                                setSelectedLogDayForOptions(day);
                              }}
                              delayLongPress={1000}
                            >
                              {isToday && (
                                <GradientFill accent={theme.colors.primary} />
                              )}
                              <View style={styles.historyLogHeader}>
                                <View style={styles.historyLogLeft}>
                                  <View style={styles.historyLogAccent}>
                                    <DayAccentIcon
                                      emoji={day.emoji}
                                      name={day.name}
                                      size={36}
                                    />
                                  </View>
                                  <View style={styles.historyLogInfo}>
                                    <View style={styles.historyLogNameRow}>
                                      <Text
                                        style={styles.historyLogDayName}
                                        numberOfLines={1}
                                      >
                                        {getDisplayDayName(day.name)}
                                      </Text>
                                    </View>
                                    <Text style={styles.historyLogDate}>
                                      {getExecutionDateLabel(log)}
                                    </Text>
                                  </View>
                                </View>
                                <Text
                                  style={[
                                    styles.historyLogBadge,
                                    improvementFmt &&
                                      (improvementFmt.kind === 'up'
                                        ? styles.historyLogBadgeUp
                                        : improvementFmt.kind === 'down'
                                        ? styles.historyLogBadgeDown
                                        : styles.historyLogBadgeNeutral),
                                  ]}
                                >
                                  {improvementFmt
                                    ? `${
                                        improvementFmt.kind === 'up'
                                          ? '+'
                                          : improvementFmt.kind === 'down'
                                          ? '-'
                                          : ''
                                      }${improvementFmt.display}%`
                                    : '—'}
                                </Text>
                              </View>
                            </Pressable>
                          </View>
                        );
                      })}
                    </Collapsible>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </StretchScrollView>

      <Modal
        visible={!!logWithOptionsId}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setLogWithOptionsId(undefined);
          setSelectedLogDayForOptions(undefined);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('¿Qué deseas hacer?')}</Text>
            <Text style={styles.modalMessage}>
              {isTodayLogInProgress
                ? t('Puedes continuar o eliminar el registro')
                : t('Puedes editar o eliminar el registro')}
            </Text>
            <View style={styles.modalButtonsContainer}>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButtonEdit}
                  onPress={() => {
                    const log = displayedRoutineLogs.find(
                      (l) => l.id === logWithOptionsId
                    );
                    if (log && selectedLogDayForOptions && onEditLog) {
                      onEditLog(log, selectedLogDayForOptions);
                    }
                    setLogWithOptionsId(undefined);
                    setSelectedLogDayForOptions(undefined);
                  }}
                >
                  <View style={styles.modalActionRow}>
                    <MaterialCommunityIcons
                      name={
                        isTodayLogInProgress ? 'play-outline' : 'pencil-outline'
                      }
                      size={16}
                      color={theme.colors.onGold}
                    />
                    <Text style={styles.modalButtonEditText}>
                      {isTodayLogInProgress ? t('Continuar') : t('Editar')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonDelete}
                  onPress={() => {
                    setLogToDeleteId(logWithOptionsId);
                    setLogWithOptionsId(undefined);
                    setSelectedLogDayForOptions(undefined);
                  }}
                >
                  <View style={styles.modalActionRow}>
                    <MaterialCommunityIcons
                      name="delete-outline"
                      size={16}
                      color={theme.colors.onGold}
                    />
                    <Text style={styles.modalButtonDeleteText}>
                      {t('Eliminar')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.modalButtonCancel,
                  styles.modalButtonCancelFullWidth,
                ]}
                onPress={() => {
                  setLogWithOptionsId(undefined);
                  setSelectedLogDayForOptions(undefined);
                }}
              >
                <View style={styles.modalActionRow}>
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.modalButtonCancelText}>
                    {t('Volver')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!logToDeleteId}
        title={t('¿Eliminar entrenamiento?')}
        message={t('Esta acción no se puede deshacer. ¿Estás seguro?')}
        confirmLabel={t('Eliminar')}
        onConfirm={handleDeleteLog}
        onCancel={() => setLogToDeleteId(undefined)}
      />

      {!hasNoRoutines && (
        <FloatingPrimaryNav
          bottom={floatingNavBottom}
          activeTab="home"
          showCardio={showCardioTab}
          onPressHome={onNavigateHome}
          onPressCardio={onNavigateCardio}
          onPressCalendar={onNavigateCalendar}
          onPressProfile={onNavigateProfile}
        />
      )}

      <GlassTopBar
        title={t('Inicio')}
        titleElement={
          <Image
            source={
              theme.mode === 'light'
                ? require('../../assets/title-day.png')
                : require('../../assets/title.png')
            }
            style={styles.titleImage}
            resizeMode="contain"
          />
        }
        subtitle={`${t('Versión')} ${appVersion}`}
        topInset={insets.top}
      />
    </View>
  );
}

interface RoutineCardProps {
  routine: WorkoutRoutine;
  isViewed: boolean; // Para el borde grueso (seleccionada)
  isActive: boolean; // Para el check "Activa"
  isPrepared: boolean; // Para la etiqueta "Preparada"
  onPress: () => void;
  onLongPress?: () => void;
}

function RoutineCard({
  routine,
  isViewed,
  isActive,
  isPrepared,
  onPress,
  onLongPress,
}: RoutineCardProps) {
  return (
    <TouchableOpacity
      style={[styles.routineCard, isViewed && styles.routineCardActive]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={1000}
    >
      <GradientFill accent={theme.colors.primary} />
      <View style={styles.routineCardContent}>
        <Text style={styles.routineCardName}>{routine.name}</Text>
        <Text style={styles.routineCardDesc}>{routine.description}</Text>
        <Text style={styles.routineCardDays}>
          {t('{n} días de entrenamiento', { n: routine.days.length })}
        </Text>
      </View>
      {isActive ? (
        <View style={styles.routineCardActiveIndicator}>
          <MaterialCommunityIcons
            name="check-bold"
            size={13}
            color={theme.colors.primaryLight}
          />
          <Text style={styles.routineCardActiveText}>{t('Activa')}</Text>
        </View>
      ) : isPrepared ? (
        <View style={styles.routineCardPreparedIndicator}>
          <MaterialCommunityIcons
            name="progress-clock"
            size={13}
            color={theme.colors.emoji_blue}
          />
          <Text style={styles.routineCardPreparedText}>{t('Preparada')}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  homeScrollContent: {
    flexGrow: 1,
  },
  titleImage: {
    width: 115,
    height: 24,
    alignSelf: 'flex-start',
  },
  progressCard: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xs,
    marginBottom: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 0,
    overflow: 'hidden',
    alignItems: 'center',
    ...theme.shadow.card,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 7,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.35)',
  },
  streakEmoji: {
    fontSize: 15,
    lineHeight: 18,
  },
  streakText: {
    color: theme.colors.emoji_orange,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  weekMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  progressTitleIcon: {
    color: theme.colors.text,
  },
  progressToggleButton: {
    paddingVertical: 0,
    paddingHorizontal: 16,
    width: '100%',
  },
  progressTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.5,
    color: theme.colors.text,
    lineHeight: 24,
    includeFontPadding: false,
    textAlignVertical: 'center',
    transform: [{ translateY: Platform.OS === 'android' ? 9 : 5 }],
  },
  progressLatest: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 20,
  },
  progressEncourage: {
    flexShrink: 1,
    marginLeft: 12,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
    lineHeight: 17,
    textAlign: 'right',
  },
  progressLatestUp: {
    color: theme.colors.success,
  },
  progressLatestDown: {
    color: theme.colors.error,
  },
  progressChartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
    flexDirection: 'row',
    marginTop: 12,
  },
  chartFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chartFilterButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  progressChart: {
    height: 170,
    position: 'relative',
  },
  chartGridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.8,
  },
  chartAxisLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: theme.colors.veryLightGray,
    opacity: 0.65,
  },
  chartBar: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.surface,
  },
  chartValueLabel: {
    position: 'absolute',
    width: 40,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    lineHeight: 14,
  },
  chartValueLabelCurrent: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  chartLabelBlue: {
    color: theme.colors.emoji_blue,
  },
  chartXLabel: {
    position: 'absolute',
    width: 32,
    textAlign: 'center',
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    lineHeight: 16,
  },
  chartXLabelCurrent: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  chartYLabel: {
    position: 'absolute',
    left: 0,
    width: 36,
    textAlign: 'right',
    fontSize: 13,
    color: theme.colors.textSecondary,
    paddingRight: 6,
    lineHeight: 16,
  },
  weeksSection: {
    marginHorizontal: theme.spacing.md,
    // Misma separación que hay entre la HeroCard y la tarjeta de la gráfica
    // (HeroCard marginBottom md=16 + progressCard marginTop xs=6 = 22 = lg).
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  weekBlock: {
    // Mismo ritmo vertical que Cardio: separación entre semanas = 10, y las
    // tarjetas de día se separan 12 con su propio marginTop (ver historyLogCard).
    marginBottom: 10,
  },
  weekHeaderButton: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 5,
    borderColor: theme.colors.primary,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...theme.shadow.soft,
  },
  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weekTitle: {
    fontSize: 21,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.5,
    color: theme.colors.primary,
    lineHeight: 26,
    includeFontPadding: false,
    textAlignVertical: 'center',
    // Anton se dibuja pegado al borde superior de su caja; en Android
    // (includeFontPadding:false) queda más alto que en web, así que necesita un
    // empuje mayor para centrarse verticalmente frente al texto de al lado.
    transform: [{ translateY: Platform.OS === 'android' ? 9 : 5 }],
  },
  weekImprovementText: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  weekImprovementUp: {
    color: theme.colors.success,
  },
  weekImprovementDown: {
    color: theme.colors.error,
  },
  weekHeaderMeta: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    lineHeight: 16,
  },
  historyLogCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  historyLogCardToday: {
    borderColor: theme.colors.primary,
    borderWidth: 2.5,
    borderLeftWidth: 2.5,
    borderLeftColor: theme.colors.primary,
  },
  historyLogCardPressed: {
    opacity: 0.8,
  },
  historyLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  historyLogLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyLogAccent: {
    marginLeft: -4,
    marginRight: 12,
  },
  historyLogInfo: {
    flex: 1,
    minWidth: 0,
  },
  historyLogNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyLogDayName: {
    fontSize: 19,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.3,
    color: theme.colors.text,
    lineHeight: 22,
  },
  historyLogDate: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '500',
  },
  historyLogBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.pill,
    fontSize: 15,
    fontFamily: theme.fonts.display,
    fontWeight: '800',
    overflow: 'hidden',
    lineHeight: 18,
    textAlign: 'center',
    color: theme.colors.primaryLight,
    backgroundColor: theme.colors.primaryMuted,
  },
  historyLogBadgeUp: {
    color: theme.colors.success,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  historyLogBadgeDown: {
    color: theme.colors.error,
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
  },
  historyLogBadgeNeutral: {
    color: theme.colors.warning,
    backgroundColor: 'rgba(255, 196, 0, 0.12)',
  },
  routineListContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 0,
  },
  routineCard: {
    backgroundColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  routineCardActive: {
    borderColor: theme.colors.primary,
    borderWidth: 3,
  },
  routineCardContent: {
    flex: 1,
  },
  routineCardName: {
    fontSize: 21,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.4,
    color: theme.colors.text,
    marginBottom: 4,
    lineHeight: 26,
  },
  routineCardDesc: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  routineCardDays: {
    fontSize: 14,
    color: theme.colors.lightGray,
  },
  routineCardActiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
  },
  routineCardActiveText: {
    fontSize: 13,
    color: theme.colors.primaryLight,
    fontWeight: '800',
  },
  routineCardPreparedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 122, 255, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
  },
  routineCardPreparedText: {
    fontSize: 13,
    color: theme.colors.emoji_blue,
    fontWeight: '800',
  },
  newRoutineCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 18,
    alignItems: 'center',
  },
  newRoutineCardText: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  selectorDetailsButton: {
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 14,
    alignItems: 'center',
  },
  selectorDetailsButtonText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  modalMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: 19,
  },
  modalButtonsContainer: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancelFullWidth: {
    flex: 0,
    width: '100%',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: theme.colors.primary,
  },
  modalButtonDelete: {
    flex: 1,
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  modalButtonDeleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.onGold,
  },
  modalButtonEdit: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  modalButtonEditText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.onGold,
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
