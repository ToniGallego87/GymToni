import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
  Image,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
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
import { CARDIO_ONLY_DAY_ID, hasAnyCardio } from '@lib/cardio';
import { animateLayout } from '@lib/layoutAnimation';
import {
  buildWeekProgress,
  computeStreak,
  getWeekImprovement,
  groupLogsIntoWeekBlocks,
  isWeekCompleted,
  logsBeforeBlock,
  orderedBlockNumbers,
  workoutsUpToBlock,
  WeekProgressPoint,
} from '@lib/weeks';
import { computeWeekAchievements, WeekAchievements } from '@lib/achievements';
import {
  AppModal,
  Button,
  Collapsible,
  ConfirmModal,
  DayAccentIcon,
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
  BarChart,
  BarChartPoint,
  resolveDayIcon,
  SegmentedFilter,
  SegmentedOption,
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
  onCreateRoutine?: () => void;
  onShowWeekAchievement?: (
    achievements: WeekAchievements,
    routineName?: string
  ) => void;
}

// Traduce las semanas a barras: color y etiquetas del progreso semanal. El
// dibujo lo hace <BarChart/> (compartido con la gráfica de Cardio).
function buildProgressChart(points: WeekProgressPoint[]): {
  bars: BarChartPoint[];
  domain: { min: number; max: number };
} {
  // Semana 1 es siempre la base (mejora 0), no se muestra.
  const weeks = points.slice(1);

  const values = weeks.map((point) => point.improvement);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const domainPadding =
    minValue === maxValue ? 10 : Math.max((maxValue - minValue) * 0.15, 5);

  const bars = weeks.map((point) => {
    const isCurrentWeek = !!point.isCurrent;
    // Amarillo solo para la semana en curso; azul para una semana anterior
    // (no en curso) que quedó incompleta en días.
    const isPrevIncomplete = !isCurrentWeek && !!point.isIncomplete;
    const color = isCurrentWeek
      ? theme.colors.primaryLine
      : isPrevIncomplete
      ? theme.colors.emoji_blue
      : point.improvement >= 0
      ? theme.colors.success
      : theme.colors.error;

    return {
      key: `week-${point.week}`,
      value: point.improvement,
      label: `S${point.week}`,
      valueLabel: `${point.improvement > 0 ? '+' : ''}${Math.round(
        point.improvement
      )}%`,
      color,
      // La barra en curso es oro de LÍNEA; su etiqueta es texto y necesita la
      // tinta (ver theme.ts).
      valueColor: isCurrentWeek ? theme.colors.primary : color,
      highlighted: isCurrentWeek,
    };
  });

  return {
    bars,
    domain: {
      min: Math.min(minValue - domainPadding, 0),
      max: Math.max(maxValue + domainPadding, 0),
    },
  };
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
  onCreateRoutine,
  onShowWeekAchievement,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const showCardioTab = hasAnyCardio(state.logs);
  const [showWeeklyProgressChart, setShowWeeklyProgressChart] = useState(false);
  const [chartDayFilter, setChartDayFilter] = useState<string | undefined>(
    undefined
  );
  const [expandedWeekBlocks, setExpandedWeekBlocks] = useState<
    Record<number, boolean>
  >({});
  const [logToDeleteId, setLogToDeleteId] = useState<string | undefined>(
    undefined
  );
  // Al eliminar un día con cardio: marcado borra el log entero, desmarcado (por
  // defecto) conserva el cardio degradando el día a "Solo cardio".
  const [deleteCardioToo, setDeleteCardioToo] = useState(false);
  const [logWithOptionsId, setLogWithOptionsId] = useState<string | undefined>(
    undefined
  );
  const [selectedLogDayForOptions, setSelectedLogDayForOptions] = useState<
    WorkoutDay | undefined
  >(undefined);
  const { width: windowWidth } = useWindowDimensions();

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
  // Log de hoy (si existe) para esta rutina, y si ya está completo. Se calcula
  // aquí (antes de la gráfica y el agrupado por semanas) porque ambos deben
  // ignorar ese log MIENTRAS esté a medias: un día empezado y sin terminar no
  // debe sumar en el % de semana ni en la gráfica hasta que se complete o
  // deje de ser "hoy" (ver `completionLogs`/`completionGroupedByBlock` más abajo).
  const todayLog = useMemo(() => {
    const todayKey = new Date().toISOString().split('T')[0];
    return displayedRoutineLogs.find((log) =>
      log.date
        ? log.date === todayKey
        : new Date(log.createdAt).toISOString().split('T')[0] === todayKey
    );
  }, [displayedRoutineLogs]);

  const todayWorkoutStatus = useMemo(():
    | 'none'
    | 'in-progress'
    | 'completed' => {
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
  }, [todayLog, state.routines]);

  // Logs "de completitud": iguales a los reales salvo que excluyen el de hoy
  // mientras esté a medias, para que streak/semana/gráfica no lo cuenten como
  // un día ya entrenado. El log sigue existiendo y se ve en el historial (no
  // se toca `state.logs` ni `displayedRoutineLogs`), solo se ignora en los
  // cálculos de "¿está la semana completa?".
  const completionLogs = useMemo(
    () =>
      todayWorkoutStatus === 'in-progress' && todayLog
        ? displayedRoutineLogs.filter((log) => log.id !== todayLog.id)
        : displayedRoutineLogs,
    [displayedRoutineLogs, todayWorkoutStatus, todayLog]
  );
  const completionStateLogs = useMemo(
    () =>
      todayWorkoutStatus === 'in-progress' && todayLog
        ? state.logs.filter((log) => log.id !== todayLog.id)
        : state.logs,
    [state.logs, todayWorkoutStatus, todayLog]
  );

  const weeklyProgress = useMemo(
    () =>
      buildWeekProgress(completionStateLogs, displayedRoutineId, activeDays),
    [activeDays, completionStateLogs, displayedRoutineId]
  );
  const chartWidth = Math.max(
    250,
    Math.min(windowWidth - theme.spacing.md * 2 - 20, 420)
  );
  const hasNoRoutines = activeDays.length === 0;
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const {
    bottom: floatingNavBottom,
    scrollBottomPadding: homeScrollBottomPadding,
  } = getFloatingPrimaryNavMetrics(insets.bottom);
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
    if (todayWorkoutStatus === 'in-progress' && todayLog) {
      const todayDay = getDay(todayLog.dayId);
      if (todayDay) {
        onSelectDay(todayDay);
        return;
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

  const { groupedByBlock, blocks, currentWeekBlock } = useMemo(() => {
    const groupedByBlock = groupLogsIntoWeekBlocks(
      displayedRoutineLogs,
      (log) => getDay(log.dayId)?.dayNumber
    );
    // De la semana más reciente a la más antigua: así se listan en Inicio.
    const blocks = orderedBlockNumbers(groupedByBlock).reverse();
    return { groupedByBlock, blocks, currentWeekBlock: blocks[0] };
  }, [displayedRoutineLogs]);

  // Mismo agrupado, pero sobre `completionLogs` (sin el día de hoy si está a
  // medias): se usa para todo lo que decide si un día/semana cuenta como
  // "entrenado" (racha, semana completada, gráfica), NUNCA para lo que se
  // pinta en el historial (eso sigue usando `groupedByBlock`, que sí incluye
  // el log de hoy para poder seguir editándolo). El log de hoy solo puede
  // afectar al ÚLTIMO bloque (es el más reciente por fecha), así que los
  // números de bloque coinciden con `groupedByBlock` para todo lo anterior.
  const completionGroupedByBlock = useMemo(
    () =>
      groupLogsIntoWeekBlocks(
        completionLogs,
        (log) => getDay(log.dayId)?.dayNumber
      ),
    [completionLogs]
  );

  // Racha de semanas completas y si nunca se ha faltado a un día.
  const streak = useMemo(
    () => computeStreak(completionGroupedByBlock, activeDays),
    [completionGroupedByBlock, activeDays]
  );

  // Semana en curso completada: todos los días de la rutina activa entrenados en
  // el bloque más reciente. Es la condición que convierte la tarjeta principal en
  // "¡Semana completada!" y habilita la imagen de logros. Usa el bloque de
  // completitud: un día de hoy a medias no puede "cerrar" la semana.
  const currentWeekLogsBlock = groupedByBlock[currentWeekBlock] || [];
  const isCurrentWeekCompleted =
    isDisplayedRoutineActive &&
    isWeekCompleted(
      completionGroupedByBlock[currentWeekBlock] || [],
      activeDays
    );

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

  // Logros de una semana concreta. Reconstruye racha y serie de progreso tal
  // como estaban al cerrar esa semana, así que sirve igual para la semana en
  // curso recién completada que para una pasada.
  const buildAchievementsForBlock = (
    block: number
  ): WeekAchievements | null => {
    const weekLogs = groupedByBlock[block];
    if (!weekLogs || weekLogs.length === 0) return null;

    const streakForBlock = computeStreak(groupedByBlock, activeDays, block);

    return computeWeekAchievements({
      weekLogs,
      previousWeekLogs: groupedByBlock[block - 1] || [],
      weekNumber: block,
      streakDays: streakForBlock.days,
      streakIsPerfect: streakForBlock.isPerfect,
      historyLogs: logsBeforeBlock(groupedByBlock, block),
      totalWorkouts: workoutsUpToBlock(groupedByBlock, block),
      progressSeries: weeklyProgress
        .filter((point) => point.week <= block)
        .map((point) => ({ week: point.week, improvement: point.improvement })),
    });
  };

  const handleShowWeekAchievementForBlock = (block: number) => {
    const achievements = buildAchievementsForBlock(block);
    if (achievements) {
      onShowWeekAchievement?.(achievements, displayedRoutine?.name);
    }
  };

  const handleShowWeekAchievement = () => {
    if (isCurrentWeekCompleted) {
      handleShowWeekAchievementForBlock(currentWeekBlock);
    }
  };

  // El gráfico muestra todas las semanas entrenadas tal cual: la última semana en
  // curso (incompleta) se muestra resaltada como "actual" desde buildWeekProgress,
  // y no se añaden semanas fantasma. No hay nada que recortar aquí.
  const filteredWeeklyProgress = useMemo(
    () =>
      chartDayFilter
        ? buildWeekProgress(
            completionStateLogs,
            displayedRoutineId,
            activeDays,
            chartDayFilter
          )
        : weeklyProgress,
    [
      chartDayFilter,
      weeklyProgress,
      completionStateLogs,
      displayedRoutineId,
      activeDays,
    ]
  );

  // Opciones del filtro de la gráfica: la semana completa (por defecto) o cada
  // día de la rutina. Los días se identifican por su silueta (el nombre real,
  // "Pecho y tríceps", no cabe en el chip): el texto solo sale en el activo.
  const dayFilterOptions: SegmentedOption<string | undefined>[] = useMemo(
    () => [
      { id: undefined, label: t('Semana completa'), icon: 'calendar-week' },
      ...activeDays.map((day: WorkoutDay, index: number) => ({
        id: day.id as string | undefined,
        label: getDisplayDayName(day.name) || `${t('Día')} ${index + 1}`,
        gymIcon: resolveDayIcon(day.emoji, day.name),
      })),
    ],
    [activeDays]
  );

  const progressChart = useMemo(
    () => buildProgressChart(filteredWeeklyProgress),
    [filteredWeeklyProgress]
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
    const entrenos = new Set(currentLogs.map((l) => l.dayId).filter(Boolean))
      .size;
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
    // % de cambio de volumen vs la semana pasada. La semana en curso está a
    // medias, así que compararla con la anterior ENTERA daría un -X% que solo
    // mide los días que faltan (el lunes, -100%). Se compara contra los mismos
    // días que ya se han entrenado esta semana: pera con pera desde el primer
    // día, y al completar la semana converge solo al % de semana entera.
    const doneDayIds = new Set(currentLogs.map((l) => l.dayId).filter(Boolean));
    const lastVolSameDays =
      prev != null
        ? (groupedByBlock[prev] || [])
            .filter((l) => !!l.dayId && doneDayIds.has(l.dayId))
            .reduce((s, l) => s + workoutVolume(l), 0)
        : null;
    const deltaPct =
      lastVolSameDays != null && lastVolSameDays > 0
        ? ((currentVol - lastVolSameDays) / lastVolSameDays) * 100
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
        { value: fmtPct(strengthStats.deltaPct), label: t('vs mismos días') },
        { value: fmtInt(strengthStats.reps), label: t('reps') },
      ]
    : [
        { value: fmtInt(strengthStats.series), label: t('series') },
        { value: fmtInt(strengthStats.reps), label: t('reps') },
        { value: fmtInt(strengthStats.ejercicios), label: t('ejercicios') },
      ];

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

  const logToDelete = state.logs.find(
    (l: WorkoutLog) => l.id === logToDeleteId
  );
  // El check del cardio solo se ofrece si el día tiene cardio que salvar.
  const logToDeleteHasCardio = !!logToDelete?.cardio?.rawInput?.trim();

  const closeDeleteLogModal = () => {
    setLogToDeleteId(undefined);
    setDeleteCardioToo(false);
  };

  const closeLogOptions = () => {
    setLogWithOptionsId(undefined);
    setSelectedLogDayForOptions(undefined);
  };

  const handleDeleteLog = () => {
    if (!logToDelete) return;

    // Sin marcar el check, el cardio sobrevive: el log se queda sin la fuerza y
    // pasa a ser una sesión de "Solo cardio" de ese mismo día.
    if (logToDeleteHasCardio && !deleteCardioToo) {
      dispatch({
        type: 'UPDATE_WORKOUT_LOG',
        payload: {
          ...logToDelete,
          dayId: CARDIO_ONLY_DAY_ID,
          exercises: [],
          cardioOnly: true,
          startsNewWeek: undefined,
          updatedAt: Date.now(),
        },
      });
    } else {
      dispatch({ type: 'DELETE_WORKOUT_LOG', payload: logToDelete.id });
    }

    closeDeleteLogModal();
  };

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

        {isDisplayedRoutineActive && streak.weeks >= 2 && (
          <View style={styles.streakChip}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>
              {t('{n} semanas seguidas', { n: streak.weeks })}
            </Text>
          </View>
        )}

        {filteredWeeklyProgress.length > 0 &&
          (() => {
            // Primera semana de la rutina: no hay semana previa con la que
            // comparar, así que la tarjeta no se despliega (no hay gráfico útil),
            // sin flecha ni porcentaje, solo un mensaje de ánimo.
            const isFirstWeek = filteredWeeklyProgress.length <= 1;
            // El borde de la tarjeta de la gráfica es siempre el acento
            // estructural. El verde/rojo solo aparece en el dato de
            // subida/bajada de dentro.
            const progressAccent = theme.colors.accentLine;
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
                      {/* El nombre que puso el usuario, no "Rutina N" (que era
                          el índice del array y no decía qué rutina es). */}
                      <Text style={styles.progressTitle} numberOfLines={1}>
                        {displayedRoutine?.name ?? t('Rutina')}
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
                        {t('¡Ánimo con tu nueva rutina!')}
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

                {!isFirstWeek && showWeeklyProgressChart && (
                  <>
                    <BarChart
                      points={progressChart.bars}
                      domain={progressChart.domain}
                      width={chartWidth}
                      formatYTick={(value) => `${Math.round(value)}%`}
                      signed
                    />
                    <SegmentedFilter
                      style={{ width: chartWidth }}
                      options={dayFilterOptions}
                      labelMode="below"
                      value={chartDayFilter}
                      onChange={(id) => {
                        animateLayout();
                        setChartDayFilter(id);
                      }}
                    />
                  </>
                )}
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
                const weekCompleted = isWeekCompleted(
                  completionGroupedByBlock[block] || [],
                  activeDays
                );
                // Si la rutina no es activa, todas las semanas están colapsadas
                // Si es activa y la semana no está completada, la última semana está expandida por defecto
                // Las semanas completadas están colapsadas por defecto, pero se pueden expandir/colapsar manualmente
                const isExpanded =
                  isDisplayedRoutineActive && !weekCompleted
                    ? expandedWeekBlocks[block] ?? block === currentWeekBlock
                    : expandedWeekBlocks[block] ?? false;
                // La primera semana no tiene anterior con la que compararse.
                const weekImprovement =
                  block === 1
                    ? null
                    : getWeekImprovement(
                        completionGroupedByBlock[block] || [],
                        completionGroupedByBlock[block - 1] || [],
                        activeDays
                      );
                const isCurrentWeek =
                  isDisplayedRoutineActive && block === currentWeekBlock;
                // Tarjeta: acento estructural salvo la semana en curso
                // (amarilla). El verde/rojo solo se usa en el dato de
                // subida/bajada.
                const weekAccent = isCurrentWeek
                  ? theme.colors.primaryLine
                  : theme.colors.accentLine;
                // Los logros solo tienen sentido en una semana ya cerrada: la
                // que está en curso todavía está sumando.
                const canShowWeekAchievement =
                  !isCurrentWeek && !!onShowWeekAchievement;

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
                    >
                      <GradientFill accent={weekAccent} />

                      <View style={styles.weekTitleRow}>
                        <Text
                          style={[
                            styles.weekTitle,
                            { color: theme.colors.white },
                          ]}
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
                        {/* Los logros de una semana pasada se abrían con un
                            long-press de 3s en la cabecera: nada lo insinuaba.
                            Ahora es un botón. */}
                        {canShowWeekAchievement && (
                          <Pressable
                            style={({ pressed }: { pressed: boolean }) => [
                              styles.weekAchievementButton,
                              pressed && styles.weekAchievementButtonPressed,
                            ]}
                            onPress={() =>
                              handleShowWeekAchievementForBlock(block)
                            }
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={t('Ver logros de la semana')}
                          >
                            <MaterialCommunityIcons
                              name="trophy-variant-outline"
                              size={17}
                              color={theme.colors.primary}
                            />
                          </Pressable>
                        )}
                        <Text style={styles.weekHeaderMeta}>
                          {weekLogs.length === 1
                            ? t('1 día')
                            : t('{n} días', { n: weekLogs.length })}
                        </Text>
                        <MaterialCommunityIcons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={theme.colors.textSecondary}
                        />
                      </View>
                    </Pressable>

                    <Collapsible open={isExpanded}>
                      {weekLogs.map((log: WorkoutLog) => {
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
                                  // Hoy: toque directo continúa/edita el registro
                                  // (lo que se quiere el 95% de las veces). El
                                  // ⋯ sigue dando acceso a eliminar.
                                  onEditLog?.(log, day);
                                } else {
                                  // Días pasados: ir directamente a la vista de detalle
                                  onSelectLog?.(log, day);
                                }
                              }}
                            >
                              {isToday && (
                                <GradientFill
                                  accent={theme.colors.primaryLine}
                                />
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
                                {/* Editar/eliminar estaba solo tras un
                                    long-press de 1s, sin nada que lo indicara. */}
                                <Pressable
                                  style={({
                                    pressed,
                                  }: {
                                    pressed: boolean;
                                  }) => [
                                    styles.logOptionsButton,
                                    pressed && styles.logOptionsButtonPressed,
                                  ]}
                                  onPress={() => {
                                    setLogWithOptionsId(log.id);
                                    setSelectedLogDayForOptions(day);
                                  }}
                                  hitSlop={8}
                                  accessibilityRole="button"
                                  accessibilityLabel={t('Más opciones')}
                                >
                                  <MaterialCommunityIcons
                                    name="dots-horizontal"
                                    size={20}
                                    color={theme.colors.textSecondary}
                                  />
                                </Pressable>
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

      <AppModal
        visible={!!logWithOptionsId}
        onRequestClose={closeLogOptions}
        title={t('¿Qué deseas hacer?')}
        icon="dots-horizontal-circle-outline"
        message={
          isTodayLogInProgress
            ? t('Puedes continuar o eliminar el registro')
            : t('Puedes editar o eliminar el registro')
        }
        footer={
          <>
            <View style={styles.modalButtonRow}>
              <Button
                title={isTodayLogInProgress ? t('Continuar') : t('Editar')}
                onPress={() => {
                  const log = displayedRoutineLogs.find(
                    (l) => l.id === logWithOptionsId
                  );
                  if (log && selectedLogDayForOptions && onEditLog) {
                    onEditLog(log, selectedLogDayForOptions);
                  }
                  closeLogOptions();
                }}
                variant="primary"
                size="medium"
                style={styles.modalButton}
              />
              <Button
                title={t('Eliminar')}
                onPress={() => {
                  setLogToDeleteId(logWithOptionsId);
                  closeLogOptions();
                }}
                variant="danger"
                size="medium"
                style={styles.modalButton}
              />
            </View>
            <Button
              title={t('Volver')}
              onPress={closeLogOptions}
              variant="secondary"
              size="medium"
            />
          </>
        }
      />

      <ConfirmModal
        visible={!!logToDeleteId}
        title={t('¿Eliminar entrenamiento?')}
        message={t('Esta acción no se puede deshacer. ¿Estás seguro?')}
        confirmLabel={t('Eliminar')}
        checkLabel={
          logToDeleteHasCardio ? t('Borrar también el cardio') : undefined
        }
        checked={deleteCardioToo}
        onToggleCheck={() => setDeleteCardioToo((prev) => !prev)}
        onConfirm={handleDeleteLog}
        onCancel={closeDeleteLogModal}
      />

      {/* La nav se muestra siempre, también con la BD vacía: si no, no hay
          forma de llegar a Perfil → Datos → Importar en el primer arranque
          (restaurar un backup tras reinstalar o cambiar de móvil). */}
      <FloatingPrimaryNav
        bottom={floatingNavBottom}
        activeTab="home"
        showCardio={showCardioTab}
        onPressHome={onNavigateHome}
        onPressCardio={onNavigateCardio}
        onPressCalendar={onNavigateCalendar}
        onPressProfile={onNavigateProfile}
      />

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

const makeStyles = () => StyleSheet.create({
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
    borderColor: theme.colors.primaryLine,
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
    backgroundColor: theme.colors.emoji_orangeMuted,
    borderWidth: 1,
    borderColor: theme.colors.emoji_orangeMutedBorder,
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
    // El nombre de la rutina lo pone el usuario: puede ser largo, así que la
    // fila cede antes que el dato de mejora de la derecha.
    flexShrink: 1,
    minWidth: 0,
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
    flexShrink: 1,
    transform: [{ translateY: Platform.OS === 'android' ? 3 : 5 }],
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
    borderColor: theme.colors.primaryLine,
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
    // Anton se dibuja pegado al borde superior de su caja, así que hace falta un
    // pequeño empuje hacia abajo para centrarlo frente al texto/icono de al lado.
    transform: [{ translateY: Platform.OS === 'android' ? 3 : 5 }],
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
  weekAchievementButton: {
    padding: 4,
    marginRight: 4,
    borderRadius: theme.borderRadius.sm,
  },
  weekAchievementButtonPressed: {
    opacity: 0.6,
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
    borderColor: theme.colors.primaryLine,
    borderWidth: 2.5,
    borderLeftWidth: 2.5,
    borderLeftColor: theme.colors.primaryLine,
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
    backgroundColor: theme.colors.successMuted,
  },
  historyLogBadgeDown: {
    color: theme.colors.error,
    backgroundColor: theme.colors.errorMuted,
  },
  historyLogBadgeNeutral: {
    color: theme.colors.warning,
    backgroundColor: theme.colors.warningMuted,
  },
  logOptionsButton: {
    padding: 2,
    marginRight: -4,
    borderRadius: theme.borderRadius.sm,
  },
  logOptionsButtonPressed: {
    opacity: 0.6,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
  },
});

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
