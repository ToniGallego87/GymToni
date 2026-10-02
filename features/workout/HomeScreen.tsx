import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import { useDeferredReady } from '@hooks/useDeferredReady';
import { useAccountLevel } from '@hooks/useAccountLevel';
import {
  WorkoutDay,
  WorkoutRoutine,
  WorkoutLog,
  ExerciseLog,
} from '../../types';
import { getDisplayDayName, theme } from '@lib/theme';
import { dayNameText, weekTitleText } from '@lib/textStyles';
import { t, dateLocale } from '@lib/i18n';
import { buildWorkoutImprovement, ImprovementResult } from '@lib/progress';
import {
  findDayInRoutines,
  getLogTimestamp,
  getToday,
  logDateKey,
} from '@lib/utils';
import { animateLayout } from '@lib/layoutAnimation';
import {
  buildWeekProgress,
  computeStreak,
  currentWeekDayState,
  getWeekImprovement,
  groupLogsIntoWeekBlocks,
  isDeloadBlock,
  isWeekCompleted,
  logsBeforeBlock,
  orderedBlockNumbers,
  workoutsUpToBlock,
  WeekProgressPoint,
} from '@lib/weeks';
import { computeWeekAchievements, WeekAchievements } from '@lib/achievements';
import {
  AnchorMenu,
  Button,
  ChallengesModal,
  Collapsible,
  ConfirmModal,
  AppModal,
  DayAccentIcon,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  HeroCard,
  ChallengesStrip,
  StatsStrip,
  ProgressRing,
  HeroVariant,
  GradientFill,
  TrendDelta,
  BarChart,
  ChartCard,
  BarChartPoint,
  getChartWidth,
  resolveDayIcon,
  SEGMENTED_FILTER_CHART_GAP,
  SectionLegend,
  SegmentedFilter,
  SegmentedOption,
  StretchScrollView,
  LoadMoreButton,
} from '../../components';

interface HomeScreenProps {
  onSelectDay: (day: WorkoutDay) => void;
  onSelectLog?: (log: WorkoutLog, day: WorkoutDay) => void;
  onEditLog?: (log: WorkoutLog, day: WorkoutDay) => void;
  onOpenDaySelector?: () => void;
  onOpenRoutineSelector?: () => void;
  // Ficha de la rutina ACTIVA desde el ⋯. Sin rutina activa no se pasa.
  onOpenActiveRoutine?: () => void;
  onCreateRoutine?: () => void;
  // "Ver la comunidad" de Primeros pasos: salta a la pestaña Comunidad.
  onOpenCommunity?: () => void;
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
  //
  // Fuera también lo que no mide progreso: las semanas de DESCARGA (bajan la
  // intensidad a propósito; antes heredaban el % de la carga anterior y
  // dibujaban una meseta azul que no era ningún dato) y las semanas SIN DATO
  // (`isMissing`: con la gráfica filtrada por día, las semanas que no
  // entrenaron ese día pintaban un 0% que se leía como estancamiento).
  //
  // Una semana INCOMPLETA sí se queda: entrenó lo que la serie mide y cada día
  // compara contra su propia base, así que es comparable con el resto.
  const weeks = points
    .slice(1)
    .filter((point) => !point.isDeload && !point.isMissing);

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
      ? theme.colors.primaryFill
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
      // La barra en curso es oro de RELLENO vivo; su etiqueta es texto y necesita
      // la tinta legible (ver theme.ts).
      valueColor: isCurrentWeek ? theme.colors.primary : color,
      highlighted: isCurrentWeek,
    };
  });

  return {
    bars,
    // El eje ARRANCA en 0 mientras no haya ninguna semana por debajo de la base:
    // el margen inferior se aplicaba siempre y pintaba marcas negativas ("−10 %")
    // bajo unas barras que solo subían. Si alguna semana empeora sí hay que bajar
    // del cero, y entonces esa parte del eje se dibuja con su margen.
    domain: {
      min: minValue < 0 ? minValue - domainPadding : 0,
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

// Semanas que se muestran de inicio y cuántas añade "Cargar más" (misma
// paginación que Cardio, para no montar todo el histórico en rutinas largas).
const WEEKS_PAGE = 5;
// Disco de cada día en la fila de la semana en curso.
const WEEK_DAY_DOT_SIZE = 26;

export function HomeScreen({
  onSelectDay,
  onSelectLog,
  onEditLog,
  onOpenDaySelector,
  onOpenRoutineSelector,
  onOpenActiveRoutine,
  onCreateRoutine,
  onOpenCommunity,
  onShowWeekAchievement,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  // Retos de fuerza de la semana, en la tira bajo la hero: el reto solo
  // funciona si se ve donde se decide entrenar.
  const { challenges } = useAccountLevel();
  const heroChallenges = challenges.filter((c) => c.category === 'strength');
  const [showChallenges, setShowChallenges] = useState(false);
  // La cabecera (hero + barra) se pinta al instante; el historial de semanas y
  // demás secciones pesadas se difieren un frame para que abrir Inicio sea ágil.
  const ready = useDeferredReady();
  const [showWeeklyProgressChart, setShowWeeklyProgressChart] = useState(false);
  const [chartDayFilter, setChartDayFilter] = useState<string | undefined>(
    undefined
  );
  const [expandedWeekBlocks, setExpandedWeekBlocks] = useState<
    Record<number, boolean>
  >({});
  // Paginación del historial de semanas: se muestran las 5 más recientes y
  // "Cargar más" añade 5 (como Cardio). Se reinicia al cambiar de rutina.
  const [visibleWeekCount, setVisibleWeekCount] = useState(WEEKS_PAGE);
  const [logToDeleteId, setLogToDeleteId] = useState<string | undefined>(
    undefined
  );
  // Al eliminar un día con cardio: marcado borra el log entero, desmarcado (por
  // defecto) conserva el cardio degradando el día a "Solo cardio".
  const [logWithOptionsId, setLogWithOptionsId] = useState<string | undefined>(
    undefined
  );
  const [selectedLogDayForOptions, setSelectedLogDayForOptions] = useState<
    WorkoutDay | undefined
  >(undefined);
  // Día de una semana pasada que no se entrenó, cuando se toca su tarjeta: el
  // aviso explica que ese hueco no se puede rellenar desde aquí.
  const [missingDayInfo, setMissingDayInfo] = useState<WorkoutDay | undefined>(
    undefined
  );
  // Marcar/quitar descarga en una semana pide confirmación (cambia estadísticas).
  const [pendingWeekDeload, setPendingWeekDeload] = useState<{
    block: number;
    isDeload: boolean;
  } | null>(null);
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
    setVisibleWeekCount(WEEKS_PAGE);
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
    const todayKey = getToday();
    return displayedRoutineLogs.find((log) => logDateKey(log) === todayKey);
  }, [displayedRoutineLogs]);

  // Fracción (0..1) de ejercicios completados del log de hoy; null sin log.
  // Alimenta el estado del día y el anillo que se va llenando en la semana.
  const todayExerciseProgress = useMemo((): number | null => {
    if (!todayLog) return null;

    let todayDay: WorkoutDay | undefined;
    for (const routine of state.routines) {
      const day = routine.days.find((d) => d.id === todayLog.dayId);
      if (day) {
        todayDay = day;
        break;
      }
    }

    if (!todayDay || todayDay.exercises.length === 0) return 1;

    // Un ejercicio está completo cuando alcanza su número de series objetivo
    // (mismo criterio que `isTargetCompleted` en WorkoutLogScreen), no con que
    // tenga solo una serie metida: si falta una serie del objetivo, el
    // entrenamiento sigue en progreso.
    const filled = todayDay.exercises.filter((ex) => {
      const exLog = todayLog.exercises.find(
        (e: ExerciseLog) => e.exerciseId === ex.id
      );
      const setsCount = exLog?.parsedSets?.length ?? 0;
      const targetSets = ex.targetSets && ex.targetSets > 0 ? ex.targetSets : 1;
      return setsCount >= targetSets;
    }).length;
    return filled / todayDay.exercises.length;
  }, [todayLog, state.routines]);

  const todayWorkoutStatus: 'none' | 'in-progress' | 'completed' =
    todayExerciseProgress == null
      ? 'none'
      : todayExerciseProgress >= 1
      ? 'completed'
      : 'in-progress';

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

  // Cómputo caro (puntuación de fuerza por entreno): diferido hasta `ready` para
  // no bloquear la primera pintura. Solo alimenta secciones diferidas (tarjeta de
  // progreso, gráfica, logros), no el hero.
  const weeklyProgress = useMemo(
    () =>
      ready
        ? buildWeekProgress(completionStateLogs, displayedRoutineId, activeDays)
        : [],
    [ready, activeDays, completionStateLogs, displayedRoutineId]
  );
  const chartWidth = getChartWidth(windowWidth);
  const hasNoRoutines = activeDays.length === 0;
  // El día que toca en la semana en curso (el primero que aún no se ha
  // entrenado). La hero lo NOMBRA y lleva directa a él, en vez de mandar
  // siempre a "Elige la sesión" para responder algo que la app ya sabe. Misma
  // fuente que esa pantalla, que lo marca en su lista.
  const { nextDay: suggestedDay } = useMemo(
    () => currentWeekDayState(displayedRoutine, state.logs),
    [displayedRoutine, state.logs]
  );
  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { scrollBottomPadding: homeScrollBottomPadding } =
    getFloatingPrimaryNavMetrics(insets.bottom);

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

    // Entrenamiento del día completado: abrir el registro de hoy para revisarlo
    // o editarlo (antes el toque no hacía nada y la tarjeta parecía rota).
    if (todayWorkoutStatus === 'completed') {
      if (todayLog) {
        const todayDay = getDay(todayLog.dayId);
        if (todayDay) onEditLog?.(todayLog, todayDay);
      }
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

    // Directo al día que toca (el primero que falta esta semana): es lo que la
    // hero anuncia en su subtítulo, así que pulsarla hace exactamente eso. El
    // caso común baja de tres pantallas a dos; entrenar OTRO día sigue a un
    // toque, en "Elegir otro día" justo debajo.
    const dayToStart = suggestedDay ?? activeDays[0];
    if (dayToStart) {
      onSelectDay(dayToStart);
      return;
    }

    onOpenDaySelector?.();
  };

  const getDay = (dayId: string): WorkoutDay | undefined =>
    findDayInRoutines(state.routines, dayId);

  /**
   * Las tarjetas del cuerpo de una semana: sus entrenos y, si la semana ya está
   * cerrada sin completarse (`skipMissing` false), también los días de la
   * rutina que no se hicieron. Cada hueco se cuela antes del primer día
   * entrenado con un número mayor que el suyo (y al final si no hay ninguno),
   * así que queda donde le tocaba sin reordenar lo que sí se hizo.
   */
  const buildWeekEntries = (
    weekLogs: WorkoutLog[],
    skipMissing: boolean
  ): { key: string; day: WorkoutDay; log?: WorkoutLog }[] => {
    const entries: { key: string; day: WorkoutDay; log?: WorkoutLog }[] =
      weekLogs.flatMap((log) => {
        const day = getDay(log.dayId);
        return day ? [{ key: log.id, day, log }] : [];
      });
    if (skipMissing) return entries;

    activeDays
      .filter((day) => !weekLogs.some((log) => log.dayId === day.id))
      .forEach((day) => {
        const entry = { key: `missing-${day.id}`, day };
        const at = entries.findIndex(
          (e) => (e.day.dayNumber ?? 0) > (day.dayNumber ?? 0)
        );
        if (at < 0) entries.push(entry);
        else entries.splice(at, 0, entry);
      });
    return entries;
  };

  const getPreviousFilledLogForSameDay = (currentLog: WorkoutLog) => {
    const currentTs = getLogTimestamp(currentLog);
    return (
      displayedRoutineLogs
        .filter(
          (log: WorkoutLog) =>
            log.dayId === currentLog.dayId && log.id !== currentLog.id
        )
        // La comparación salta las descargas: si la sesión anterior del mismo día
        // cae en una semana de deload no sirve de referencia (pesos rebajados a
        // propósito), así que se busca la anterior de carga.
        .filter((log: WorkoutLog) => !log.isDeload)
        .filter((log: WorkoutLog) => getLogTimestamp(log) < currentTs)
        .sort(
          (a: WorkoutLog, b: WorkoutLog) =>
            getLogTimestamp(b) - getLogTimestamp(a)
        )[0] || null
    );
  };

  // Mejora entre dos sesiones: se agregan los ejercicios que tienen las DOS y
  // se saca UN solo porcentaje (mismo criterio que Detail y la gráfica). Los
  // ejercicios que hoy no se hicieron quedan fuera, no cuentan como cero.
  const computeImprovementBetweenLogs = (
    currentLog: WorkoutLog,
    previousLog: WorkoutLog | null
  ): ImprovementResult | null =>
    buildWorkoutImprovement(currentLog, previousLog);

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

  // Mejora de cada semana frente a su histórico, calculada UNA vez por cambio
  // de logs. Antes iba inline en el render de cada tarjeta de semana, así que
  // cualquier repintado de Inicio (abrir un modal, cambiar de tarjeta la hero)
  // recorría el historial entero por bloque.
  const weekImprovementByBlock = useMemo(() => {
    const result: Record<number, ImprovementResult | null> = {};
    Object.keys(groupedByBlock).forEach((key) => {
      const block = Number(key);
      // Semana de descarga: al margen de las estadísticas. Cada día se compara
      // contra su sesión anterior (saltando descargas), no contra el mismo
      // hueco de la semana previa: si esa semana no tuvo ese día, se retrocede
      // hasta la última en que se hizo. Por eso se pasa TODO el histórico.
      result[block] = isDeloadBlock(groupedByBlock[block] || [])
        ? null
        : getWeekImprovement(
            completionGroupedByBlock[block] || [],
            logsBeforeBlock(completionGroupedByBlock, block),
            activeDays
          );
    });
    return result;
  }, [groupedByBlock, completionGroupedByBlock, activeDays]);

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
    const todayKey = getToday();
    return currentWeekLogsBlock.some((log) => logDateKey(log) === todayKey);
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

  // ¿Se puede desplegar la gráfica de progreso? Primera semana de la rutina:
  // no hay previa con la que comparar. Y puede haber varias semanas y aun así
  // ninguna barra: si todas las posteriores a la base son de descarga o no
  // entrenaron el día filtrado, no hay nada que dibujar. Lo usan la tarjeta
  // de progreso y la hero de estadísticas (que la abre al tocarla).
  const canOpenProgressChart =
    filteredWeeklyProgress.length > 1 && progressChart.bars.length > 0;

  const latestPoint = filteredWeeklyProgress[filteredWeeklyProgress.length - 1];
  // Si la última semana es de descarga, el indicador colapsado hereda el % de la
  // última semana de carga (no baja a 0) y se pinta en azul.
  const latestIsDeload = !!latestPoint?.isDeload;
  const lastLoadImprovement = (() => {
    for (let i = filteredWeeklyProgress.length - 1; i >= 0; i--) {
      if (!filteredWeeklyProgress[i].isDeload)
        return filteredWeeklyProgress[i].improvement;
    }
    return 0;
  })();

  // Resumen del entreno de hoy para la hero de "completado": ejercicios hechos
  // y, si hay con qué comparar, el % frente a la vez anterior (el mismo dato
  // que su tarjeta del historial). En descarga no se compara.
  const todayResultLabel = (): string | undefined => {
    if (!todayLog) return undefined;
    const done = todayLog.exercises.filter((ex) =>
      (ex.parsedSets || []).some((set) => set.weight !== -1 && set.reps !== -1)
    ).length;
    const parts = [
      done === 1 ? t('1 ejercicio') : t('{n} ejercicios', { n: done }),
    ];
    const improvement = todayLog.isDeload ? null : getLogImprovement(todayLog);
    if (improvement) {
      const pct = Math.round(improvement.percent);
      const sign = pct === 0 ? '' : improvement.isImproved ? '+' : '-';
      parts.push(`${sign}${pct} %`);
    }
    return parts.join(' · ');
  };

  // Estado visual de la tarjeta principal según la situación de la rutina/día.
  const getHeroState = (): {
    variant: HeroVariant;
    icon: string;
    title: string;
    titleIcon?: string;
    subtitle?: string;
    // El subtítulo NOMBRA el día que toca, así que puede llevar a cambiarlo.
    // Solo en ese estado: los otros subtítulos de la hero dicen otra cosa
    // ("Pulsa para compartir resultados", "Pulsa para cambiar la rutina") y
    // hacerlos abrir el selector de día contradiría su propio texto.
    subtitleIsDay?: boolean;
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
      // El día que se está entrenando, igual que cuando aún no se ha empezado:
      // es lo que la hero abre al tocarla. Sin "Cambiar": ya hay datos metidos
      // en este día, así que cambiarlo no es una opción (se elige otro desde
      // "Elige la sesión", no desde aquí).
      const inProgressDay = todayLog ? getDay(todayLog.dayId) : undefined;
      return {
        variant: 'start',
        icon: 'weight-lifter',
        title: t('Continúa tu entrenamiento'),
        subtitle: inProgressDay
          ? `${t('Día')} ${inProgressDay.dayNumber} · ${getDisplayDayName(
              inProgressDay.name
            )}`
          : undefined,
      };
    }
    if (todayWorkoutStatus === 'completed') {
      return {
        variant: 'completed',
        icon: 'check-bold',
        title: t('Entrenamiento completado'),
        // El resultado de hoy: es la recompensa del momento y dice qué hay
        // detrás del toque (abre el registro de hoy para revisarlo).
        subtitle: todayResultLabel(),
      };
    }
    return {
      variant: 'start',
      icon: 'weight-lifter',
      title: t('Empezar entrenamiento'),
      // Qué día toca. Antes la hero no lo decía y mandaba a "Elige la sesión" a
      // responderlo de memoria; ahora lo nombra y lleva directa a él.
      subtitle: suggestedDay
        ? `${t('Día')} ${suggestedDay.dayNumber} · ${getDisplayDayName(
            suggestedDay.name
          )}`
        : undefined,
      subtitleIsDay: !!suggestedDay,
    };
  };
  const hero = getHeroState();
  // Elegir otro día cuelga del subtítulo de la hero, y solo cuando ese
  // subtítulo es el nombre del día que toca.
  const canPickAnotherDay = !!hero.subtitleIsDay && !!onOpenDaySelector;

  // Racha de semanas completas (la semana en curso no la rompe) y días
  // entrenados en ella. Ocupa en la tarjeta de progreso el sitio de las cifras
  // de volumen (kg levantados), que se quitaron.
  const streak = useMemo(
    () => computeStreak(completionGroupedByBlock, activeDays),
    [completionGroupedByBlock, activeDays]
  );
  const getExecutionDateLabel = (log: WorkoutLog): string => {
    if (log.date) {
      return new Date(`${log.date}T00:00:00`).toLocaleDateString(dateLocale);
    }

    return new Date(log.createdAt).toLocaleDateString(dateLocale);
  };

  // Una sola forma de responder "¿es de hoy?" en toda la pantalla: la clave
  // de día del log contra la de hoy (ambas locales, `logDateKey`/`getToday`).
  // Antes los logs sin `date` se comparaban por su fecha FORMATEADA, así que
  // convivían dos criterios y de madrugada podían no coincidir: la tarjeta se
  // marcaba como de hoy (con su ⋯ y su borde dorado) mientras la hero ya lo
  // contaba como de ayer. Y es la marca que decide si tocarla EDITA el entreno.
  const isLogFromToday = (log: WorkoutLog): boolean =>
    logDateKey(log) === getToday();

  // El ⋯ de la tarjeta del entreno de HOY abre un menú anclado (los días
  // pasados van directos al Detalle). Solo lleva lo que el toque en la tarjeta
  // no da: ver su Detalle y eliminarlo. Antes era un popup centrado "¿Qué deseas
  // hacer?" con "Continuar" (lo mismo que tocar la tarjeta), "Eliminar" y
  // "Volver". Solo hay una tarjeta de hoy, así que basta un ref.
  const todayOptionsRef = React.useRef<View>(null);

  // Marca/desmarca una semana como descarga (deload). La marca vive en cada log
  // del bloque (semanas derivadas, no guardadas): al margen de las estadísticas.
  const toggleWeekDeload = (block: number) => {
    const weekLogs = groupedByBlock[block] || [];
    if (weekLogs.length === 0) return;
    const nextIsDeload = !isDeloadBlock(weekLogs);
    const stamp = Date.now();
    weekLogs.forEach((log) => {
      dispatch({
        type: 'UPDATE_WORKOUT_LOG',
        payload: {
          ...log,
          isDeload: nextIsDeload || undefined,
          updatedAt: stamp,
        },
      });
    });
  };

  const logToDelete = state.logs.find(
    (l: WorkoutLog) => l.id === logToDeleteId
  );
  // El check del cardio solo se ofrece si el día tiene cardio que salvar.

  const closeDeleteLogModal = () => setLogToDeleteId(undefined);

  const closeLogOptions = () => {
    setLogWithOptionsId(undefined);
    setSelectedLogDayForOptions(undefined);
  };

  // Borrar un entreno borra el entreno, y nada más: su cardio es otra sesión
  // (y los registros viejos que lo llevaban dentro se separaron al arrancar,
  // ver splitMixedCardioLogs), así que ya no hay nada que negociar.
  const handleDeleteLog = () => {
    if (!logToDelete) return;
    dispatch({ type: 'DELETE_WORKOUT_LOG', payload: logToDelete.id });
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
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
            paddingBottom: homeScrollBottomPadding,
          },
        ]}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {hasNoRoutines ? (
          // Sin rutinas: un único estado (añadir rutina), sin carrusel, y
          // debajo "Primeros pasos": es la única pantalla que ve todo usuario
          // nuevo, y la hero sola no decía qué hace la app ni que la rutina se
          // puede traer de la Comunidad. Desaparece con la primera rutina.
          <>
            <HeroCard
              variant={hero.variant}
              icon={hero.icon}
              title={hero.title}
              titleIcon={hero.titleIcon}
              subtitle={hero.subtitle}
              onPress={handleStartPress}
            />
            <View style={styles.firstStepsCard}>
              <GradientFill accent={theme.colors.accentLine} />
              <Text style={styles.firstStepsTitle}>{t('Primeros pasos')}</Text>
              {[
                {
                  icon: 'playlist-plus' as const,
                  text: t('Crea una rutina o trae una de la comunidad'),
                },
                {
                  icon: 'weight-lifter' as const,
                  text: t('Registra tu primer día, serie a serie'),
                },
                {
                  icon: 'chart-line' as const,
                  text: t('Mira cómo progresas semana a semana'),
                },
              ].map((step, index) => (
                <View key={step.icon} style={styles.firstStepRow}>
                  <View style={styles.firstStepNumber}>
                    <Text style={styles.firstStepNumberText}>{index + 1}</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={step.icon}
                    size={18}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.firstStepText}>{step.text}</Text>
                </View>
              ))}
              <View style={styles.firstStepsActions}>
                <Button
                  title={t('Crear rutina')}
                  onPress={() => onCreateRoutine?.()}
                  variant="primary"
                  size="medium"
                  style={styles.firstStepsButton}
                />
                {!!onOpenCommunity && (
                  <Button
                    title={t('Ver la comunidad')}
                    onPress={onOpenCommunity}
                    variant="secondary"
                    size="medium"
                    style={styles.firstStepsButton}
                  />
                )}
              </View>
            </View>
          </>
        ) : (
          // Una sola hero (lo que toca hoy) y, debajo, la tira con la racha y
          // los retos de la semana, siempre a la vista. Antes era un carrusel de
          // dos tarjetas doradas que, mientras hoy no se había entrenado, se
          // quedaba en la de empezar: los retos no se veían justo al decidir
          // entrenar. Las cifras de volumen viven en la tarjeta de progreso.
          <>
            <HeroCard
              variant={hero.variant}
              icon={hero.icon}
              title={hero.title}
              titleIcon={hero.titleIcon}
              subtitle={hero.subtitle}
              onPress={handleStartPress}
              // El subtítulo nombra el día que toca (tocar la tarjeta entra en
              // él); su botón "Cambiar" abre "Elige la sesión" para coger otro.
              onSubtitlePress={
                canPickAnotherDay ? onOpenDaySelector : undefined
              }
              subtitleAccessibilityLabel={t('Elegir otro día')}
            />
            <ChallengesStrip
              challenges={heroChallenges}
              onPress={() => setShowChallenges(true)}
            />
          </>
        )}

        {ready &&
          filteredWeeklyProgress.length > 0 &&
          (() => {
            // Primera semana de la rutina: no hay semana previa con la que
            // comparar, así que la tarjeta no se despliega (no hay gráfico útil),
            // sin flecha ni porcentaje, solo un mensaje de ánimo.
            const isFirstWeek = filteredWeeklyProgress.length <= 1;
            const canOpenChart = canOpenProgressChart;
            // El borde de la tarjeta de la gráfica es siempre el acento
            // estructural. El verde/rojo solo aparece en el dato de
            // subida/bajada de dentro.
            const progressAccent = theme.colors.accentLine;
            return (
              /* Qué MIDE la gráfica, no el nombre de la rutina: ese ya lo dice
                 el subtítulo de la barra superior dos dedos más arriba. Se
                 titula como su gemela de Cardio ("kcal / mes"). */
              <ChartCard
                style={styles.progressCard}
                accent={progressAccent}
                icon="chart-bar"
                title={t('Progreso / semana')}
                expandable={canOpenChart}
                expanded={showWeeklyProgressChart}
                onToggle={() => {
                  animateLayout();
                  setShowWeeklyProgressChart((prev: boolean) => !prev);
                }}
                right={
                  isFirstWeek ? (
                    <Text style={styles.progressEncourage} numberOfLines={2}>
                      {t('¡Ánimo con tu nueva rutina!')}
                    </Text>
                  ) : latestPoint ? (
                    // Este % es ACUMULADO: lo subido desde la primera semana de
                    // la rutina (cada día contra su primera sesión), no contra la
                    // semana anterior como el de las cabeceras del historial. Se
                    // dice debajo para que las dos cifras no parezcan la misma.
                    <View style={styles.progressDeltaWrap}>
                      <TrendDelta
                        value={
                          latestIsDeload
                            ? lastLoadImprovement
                            : latestPoint.improvement
                        }
                        iconSize={16}
                        color={
                          latestIsDeload ? theme.colors.emoji_blue : undefined
                        }
                      />
                      <Text style={styles.progressDeltaBase}>
                        {t('desde la semana 1')}
                      </Text>
                    </View>
                  ) : // Sin punto que mostrar no se inventa un dato: antes caía a
                  // un "0%" verde en texto plano —una TERCERA forma de pintar
                  // la mejora— que además decía "no has progresado" donde en
                  // realidad no había nada que comparar.
                  null
                }
                summary={
                  /* La racha de semanas completas (antes un chip suelto sobre
                     la tarjeta). Sustituye a las cifras de kg levantados. Solo
                     con la rutina activa: una cerrada ya no suma racha. */
                  isDisplayedRoutineActive ? (
                    <StatsStrip
                      icon="fire"
                      iconColor={theme.colors.emoji_orange}
                      value={String(streak.weeks)}
                      unit={
                        streak.weeks === 1
                          ? t('semana seguida')
                          : t('semanas seguidas')
                      }
                      meta={
                        streak.weeks > 0
                          ? t('{n} días entrenados', { n: streak.days })
                          : t('completa la semana para empezarla')
                      }
                    />
                  ) : null
                }
              >
                <BarChart
                  points={progressChart.bars}
                  domain={progressChart.domain}
                  width={chartWidth}
                  formatYTick={(value) => `${Math.round(value)}%`}
                  signed
                />
                <SegmentedFilter
                  style={{
                    width: chartWidth,
                    marginTop: SEGMENTED_FILTER_CHART_GAP,
                  }}
                  options={dayFilterOptions}
                  labelMode="below"
                  value={chartDayFilter}
                  onChange={(id) => {
                    animateLayout();
                    setChartDayFilter(id);
                  }}
                />
              </ChartCard>
            );
          })()}

        {ready && displayedRoutineLogs.length > 0 && (
          // Sin ScrollView anidado: recortaba las sombras de las tarjetas de
          // semana (bordes duros) e interfería con el colapsable. Las semanas
          // scrollean con la vista principal, como en Cardio.
          <View style={styles.weeksSection}>
            {/* Qué miden los % del historial (cabecera de cada semana y de cada
                día): contra la vez anterior. Una línea para toda la lista en vez de
                repetirlo en cada cabecera; el acumulado de la tarjeta de arriba
                lleva su propio rótulo. */}
            <SectionLegend
              title={t('Historial')}
              hint={t('% frente a la vez anterior')}
            />
            <View>
              {blocks.slice(0, visibleWeekCount).map((block: number) => {
                const weekLogs = groupedByBlock[block].slice().reverse();
                const weekCompleted = isWeekCompleted(
                  completionGroupedByBlock[block] || [],
                  activeDays
                );
                // TODAS las semanas arrancan colapsadas, también la que está en
                // curso: el historial se abre para consultar algo concreto, y la
                // semana desplegada de entrada empujaba el resto de la lista
                // fuera de la pantalla. Se despliega con un toque.
                const isExpanded = expandedWeekBlocks[block] ?? false;
                // Semana de descarga: al margen de las estadísticas. En la
                // cabecera, donde va el %, aparece "Descarga" en azul.
                const isDeloadWeek = isDeloadBlock(groupedByBlock[block] || []);
                const weekImprovement = weekImprovementByBlock[block] ?? null;
                const isCurrentWeek =
                  isDisplayedRoutineActive && block === currentWeekBlock;
                // Tarjeta: acento estructural salvo la semana en curso
                // (amarilla). El verde/rojo solo se usa en el dato de
                // subida/bajada.
                const weekAccent = isCurrentWeek
                  ? theme.colors.primaryLine
                  : theme.colors.accentLine;
                // Los hitos solo tienen sentido en una semana ya cerrada: una
                // pasada, o la actual si ya tiene todos sus días. Y una semana
                // cerrada ya no se marca como descarga: los dos botones se
                // turnan.
                const weekClosed = !isCurrentWeek || weekCompleted;
                const canShowWeekAchievement =
                  weekClosed && !!onShowWeekAchievement;
                const canToggleDeload = isCurrentWeek && !weekCompleted;

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
                        {isDeloadWeek && (
                          <Text style={styles.deloadLabel}>
                            {t('Descarga')}
                          </Text>
                        )}
                        {!isDeloadWeek && !!weekImprovement && (
                          <TrendDelta
                            value={weekImprovement.percent}
                            improved={weekImprovement.isImproved}
                          />
                        )}
                      </View>
                      <View style={styles.weekMetaRow}>
                        {/* La cabecera colapsada muestra solo lo esencial (días +
                            chevron). Descarga y "ver hitos" bajan al cuerpo
                            desplegado (weekActionsRow), donde caben como botones
                            etiquetados en vez de iconos sueltos junto al chevron. */}
                        {/* Semana en curso: los días de la rutina dibujados, no
                            "2 de 4 días". Encendido en verde lo hecho, con aro
                            dorado el que toca y apagado lo que falta: responde
                            "¿qué me queda?" sin abrir nada. Con más de seis
                            días no caben junto al título y vuelve el texto. */}
                        {isCurrentWeek &&
                        activeDays.length > 0 &&
                        activeDays.length <= 6 ? (
                          <View
                            style={styles.weekDaysRow}
                            accessible
                            accessibilityLabel={t('{n} de {total} días', {
                              n: weekLogs.length,
                              total: activeDays.length,
                            })}
                          >
                            {activeDays.map((day: WorkoutDay) => {
                              const dayLog = weekLogs.find(
                                (l: WorkoutLog) => l.dayId === day.id
                              );
                              // El día de HOY a medias no se enciende entero:
                              // un anillo verde se va llenando con los
                              // ejercicios completados. Solo se cierra al
                              // completarlos (o al pasar el día, cuando ya no
                              // es el log de hoy).
                              const dayInProgress =
                                !!dayLog &&
                                dayLog.id === todayLog?.id &&
                                todayWorkoutStatus === 'in-progress';
                              const dayDone = !!dayLog && !dayInProgress;
                              // El aro dorado marca el día que TOCA INSERTAR.
                              // Con el de hoy a medias no toca ningún otro
                              // todavía: seguimos dentro de ese, así que nadie
                              // se lleva el dorado hasta cerrarlo.
                              const dayNext =
                                !dayLog &&
                                day.id === suggestedDay?.id &&
                                todayWorkoutStatus !== 'in-progress';
                              if (dayInProgress) {
                                return (
                                  <ProgressRing
                                    key={day.id}
                                    progress={todayExerciseProgress ?? 0}
                                    size={WEEK_DAY_DOT_SIZE}
                                    strokeWidth={2}
                                    color={theme.colors.success}
                                  >
                                    <DayAccentIcon
                                      emoji={day.emoji}
                                      name={day.name}
                                      size={15}
                                      color={theme.colors.text}
                                    />
                                  </ProgressRing>
                                );
                              }
                              return (
                                <View
                                  key={day.id}
                                  style={[
                                    styles.weekDayDot,
                                    dayDone && styles.weekDayDotDone,
                                    dayNext && styles.weekDayDotNext,
                                  ]}
                                >
                                  <DayAccentIcon
                                    emoji={day.emoji}
                                    name={day.name}
                                    size={15}
                                    color={
                                      dayDone
                                        ? theme.colors.success
                                        : dayNext
                                        ? theme.colors.primary
                                        : theme.colors.textSecondary
                                    }
                                  />
                                </View>
                              );
                            })}
                          </View>
                        ) : isCurrentWeek && activeDays.length > 0 ? (
                          <Text style={styles.weekHeaderMeta}>
                            {t('{n} de {total} días', {
                              n: weekLogs.length,
                              total: activeDays.length,
                            })}
                          </Text>
                        ) : (
                          /* Semana cerrada: el veredicto, no el recuento. Un
                             check verde si se hicieron todos los días de la
                             rutina y un aviso gris si faltó alguno (al
                             desplegar se ve cuál). Antes ponía "4 días", que
                             no decía si eran todos los que tocaban. */
                          <MaterialCommunityIcons
                            name={
                              weekCompleted
                                ? 'check-circle'
                                : 'alert-circle-outline'
                            }
                            size={20}
                            color={
                              weekCompleted
                                ? theme.colors.success
                                : theme.colors.textSecondary
                            }
                            accessibilityLabel={
                              weekCompleted
                                ? t('Semana completa: {n} días', {
                                    n: weekLogs.length,
                                  })
                                : t('Semana incompleta: {n} de {total} días', {
                                    n: weekLogs.length,
                                    total: activeDays.length,
                                  })
                            }
                          />
                        )}
                        <MaterialCommunityIcons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={theme.colors.textSecondary}
                        />
                      </View>
                    </Pressable>

                    <Collapsible open={isExpanded}>
                      {/* Las acciones son de la SEMANA, no de su último día: van nada
                          más abrir, bajo la cabecera. Al final del cuerpo quedaban
                          detrás de todas las tarjetas de día (350-450 px de scroll con
                          una rutina de 4-5 días), y "Ver hitos" es la ÚNICA puerta a
                          compartir los de una semana pasada: la hero solo los ofrece el
                          día en que la semana se cierra. */}
                      {(canToggleDeload || canShowWeekAchievement) && (
                        <View style={styles.weekActionsRow}>
                          {canToggleDeload && (
                            <Pressable
                              style={({ pressed }: { pressed: boolean }) => [
                                styles.weekActionButton,
                                styles.weekActionDeload,
                                isDeloadWeek && styles.weekActionDeloadActive,
                                pressed && styles.weekAchievementButtonPressed,
                              ]}
                              onPress={() =>
                                setPendingWeekDeload({
                                  block,
                                  isDeload: isDeloadWeek,
                                })
                              }
                              accessibilityRole="button"
                              accessibilityLabel={
                                isDeloadWeek
                                  ? t('Quitar semana de descarga')
                                  : t('Marcar como semana de descarga')
                              }
                            >
                              <MaterialCommunityIcons
                                name="sleep"
                                size={16}
                                color={theme.colors.emoji_blue}
                              />
                              <Text
                                style={[
                                  styles.weekActionText,
                                  { color: theme.colors.emoji_blue },
                                ]}
                              >
                                {isDeloadWeek
                                  ? t('Quitar descarga')
                                  : t('Marcar descarga')}
                              </Text>
                            </Pressable>
                          )}
                          {canShowWeekAchievement && (
                            <Pressable
                              style={({ pressed }: { pressed: boolean }) => [
                                styles.weekActionButton,
                                styles.weekActionAchievement,
                                pressed && styles.weekAchievementButtonPressed,
                              ]}
                              onPress={() =>
                                handleShowWeekAchievementForBlock(block)
                              }
                              accessibilityRole="button"
                              accessibilityLabel={t('Ver hitos de la semana')}
                            >
                              <MaterialCommunityIcons
                                name="trophy-variant-outline"
                                size={16}
                                color={theme.colors.primary}
                              />
                              <Text
                                style={[
                                  styles.weekActionText,
                                  { color: theme.colors.primary },
                                ]}
                              >
                                {t('Ver hitos')}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                      {buildWeekEntries(
                        weekLogs,
                        isCurrentWeek || weekCompleted
                      ).map(({ key, day, log }) => {
                        // Día que no se hizo: tarjeta apagada en el hueco que
                        // le tocaba, con un toque que lo explica. Antes la
                        // semana solo tenía menos tarjetas y no se veía CUÁL
                        // faltó.
                        if (!log) {
                          return (
                            <Pressable
                              key={key}
                              style={({ pressed }: { pressed: boolean }) => [
                                styles.historyLogCard,
                                styles.historyLogCardMissing,
                                pressed && styles.historyLogCardPressed,
                              ]}
                              onPress={() => setMissingDayInfo(day)}
                              accessibilityRole="button"
                              accessibilityLabel={t('{day}: sin entrenar', {
                                day: getDisplayDayName(day.name),
                              })}
                            >
                              <View style={styles.historyLogHeader}>
                                <View style={styles.historyLogLeft}>
                                  <View
                                    style={[
                                      styles.historyLogAccent,
                                      styles.historyLogAccentMissing,
                                    ]}
                                  >
                                    <DayAccentIcon
                                      emoji={day.emoji}
                                      name={day.name}
                                      size={36}
                                      color={theme.colors.textMuted}
                                    />
                                  </View>
                                  <View style={styles.historyLogInfo}>
                                    <Text
                                      style={[
                                        styles.historyLogDayName,
                                        styles.historyLogDayNameMissing,
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {getDisplayDayName(day.name)}
                                    </Text>
                                    <Text style={styles.historyLogMissingText}>
                                      {t('Sin entrenar')}
                                    </Text>
                                  </View>
                                </View>
                                <MaterialCommunityIcons
                                  name="minus-circle-outline"
                                  size={20}
                                  color={theme.colors.textMuted}
                                />
                              </View>
                            </Pressable>
                          );
                        }
                        const improvement = getLogImprovement(log);
                        const isToday = isLogFromToday(log);

                        return (
                          <View key={key}>
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
                                {/* El % por sesión solo en la semana en curso y en hoy,
                                    donde es accionable ("¿voy mejor que la última vez?").
                                    En semanas cerradas el % de la cabecera ya resume y el
                                    detalle de la sesión conserva su %. Las semanas de
                                    descarga no lo llevan: la cabecera ya rotula "Descarga",
                                    así que sus días se ven como el resto.

                                    Mide lo mismo que el de la cabecera de la semana (contra
                                    la vez anterior), así que se pinta con el mismo
                                    TrendDelta. OJO: el de la tarjeta de progreso NO es este
                                    dato, es el acumulado desde la semana 1, y por eso lleva
                                    su rótulo debajo. Antes era una píldora con fondo de color y el
                                    número en Anton, con cuatro paletas: nadie podía saber
                                    que medía lo mismo que la flecha de la semana. El "igual"
                                    (el "=" en ámbar) lo cubre ya el propio TrendDelta, y
                                    cuando no hay con qué comparar no se pinta nada en vez
                                    de un "—" suelto. */}
                                {(isCurrentWeek || isToday) &&
                                  !isDeloadWeek &&
                                  !!improvement && (
                                    <TrendDelta
                                      value={improvement.percent}
                                      improved={improvement.isImproved}
                                    />
                                  )}
                                {/* Solo el día de HOY lleva el ⋯ aquí (Ver detalle /
                                    Eliminar): un toque en un día pasado ya abre el
                                    Detalle, la única superficie de acciones del log
                                    (editar, fecha, mover semana, borrar). */}
                                {isToday && (
                                  <Pressable
                                    ref={todayOptionsRef}
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
                                )}
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

            {blocks.length > visibleWeekCount && (
              <LoadMoreButton
                onPress={() => {
                  animateLayout();
                  setVisibleWeekCount((c) => c + WEEKS_PAGE);
                }}
              />
            )}
          </View>
        )}
      </StretchScrollView>

      <ChallengesModal
        visible={showChallenges}
        onClose={() => setShowChallenges(false)}
        title={t('Retos de la semana')}
        challenges={heroChallenges}
      />

      <AnchorMenu
        visible={!!logWithOptionsId}
        onClose={closeLogOptions}
        anchorRef={todayOptionsRef}
        items={[
          {
            icon: 'file-document-outline',
            label: t('Ver detalle'),
            onPress: () => {
              const log = displayedRoutineLogs.find(
                (l) => l.id === logWithOptionsId
              );
              if (log && selectedLogDayForOptions) {
                onSelectLog?.(log, selectedLogDayForOptions);
              }
            },
          },
          {
            icon: 'delete-outline',
            label: t('Eliminar'),
            onPress: () => setLogToDeleteId(logWithOptionsId),
          },
        ]}
      />

      {/* Toque en el hueco de un día que no se entrenó. Es informativo (un solo
          botón): explica qué significa el hueco y que una semana cerrada no se
          rellena desde el historial. Para meter ese día a posteriori hay que
          registrarlo y cambiarle la fecha desde su Detalle. */}
      <AppModal
        visible={!!missingDayInfo}
        onRequestClose={() => setMissingDayInfo(undefined)}
        onOverlayPress={() => setMissingDayInfo(undefined)}
        icon="calendar-remove-outline"
        title={t('Día sin entrenar')}
        message={t(
          'Esa semana se cerró sin «{day}», así que no cuenta como completa ni suma en la racha. Un hueco de una semana pasada no se rellena desde aquí: registra el día y cámbiale la fecha en su Detalle.',
          { day: getDisplayDayName(missingDayInfo?.name ?? '') }
        )}
        footer={
          <Button
            title={t('Entendido')}
            onPress={() => setMissingDayInfo(undefined)}
            variant="primary"
            size="medium"
          />
        }
      />

      <ConfirmModal
        visible={!!pendingWeekDeload}
        icon="sleep"
        title={
          pendingWeekDeload?.isDeload
            ? t('¿Quitar semana de descarga?')
            : t('¿Marcar semana de descarga?')
        }
        message={
          pendingWeekDeload?.isDeload
            ? t(
                'La semana volverá a contar como carga normal en racha, progreso y récords. ¿Continuar?'
              )
            : t(
                'La semana quedará al margen de las estadísticas: no compara ni cuenta para récords. ¿Continuar?'
              )
        }
        confirmLabel={t('Continuar')}
        confirmVariant="primary"
        onConfirm={() => {
          if (pendingWeekDeload) toggleWeekDeload(pendingWeekDeload.block);
          setPendingWeekDeload(null);
        }}
        onCancel={() => setPendingWeekDeload(null)}
      />

      <ConfirmModal
        visible={!!logToDeleteId}
        title={t('¿Eliminar entrenamiento?')}
        message={t('Esta acción no se puede deshacer. ¿Estás seguro?')}
        confirmLabel={t('Eliminar')}
        onConfirm={handleDeleteLog}
        onCancel={closeDeleteLogModal}
      />

      {/* La barra de navegación es fija y vive en app/App.tsx (fuera del pager
          de pestañas), para que no deslice con el contenido al cambiar de vista. */}

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
        // El hueco del subtítulo orienta, como en el resto de pantallas: qué
        // rutina estás viendo (Inicio muestra la SELECCIONADA, que no siempre
        // es la activa). Antes gastaba el sitio más visto de la app en el
        // número de versión, que ya vive al pie de Configuración.
        subtitle={displayedRoutine?.name ?? t('Añade tu primera rutina')}
        topInset={insets.top}
        onLayout={onTopBarLayout}
        menuItems={
          onOpenActiveRoutine
            ? [
                {
                  icon: 'file-document-edit-outline',
                  label: t('Ir a la rutina'),
                  onPress: onOpenActiveRoutine,
                },
              ]
            : undefined
        }
      />
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
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
    // Solo márgenes: la piel de la tarjeta (borde, degradado, paddings y el
    // centrado de la gráfica) vive en `ChartCard`, compartida con Cardio.
    // Sin marginTop propio: la separa de los retos el marginBottom de la tira
    // (md), el mismo que separa los retos de la hero. Antes sumaba un xs y el
    // hueco de arriba y el de abajo de los retos no coincidían.
    progressCard: {
      marginHorizontal: theme.spacing.md,
      marginBottom: 0,
    },
    // "Primeros pasos" (solo sin rutinas): tarjeta de lista con dos salidas.
    firstStepsCard: {
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      padding: 16,
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    firstStepsTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    firstStepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    firstStepNumber: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryFill,
    },
    firstStepNumberText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.onGold,
    },
    firstStepText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 19,
    },
    firstStepsActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    firstStepsButton: {
      flex: 1,
    },
    weekMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    // La cifra de la tarjeta de progreso con su base debajo ("desde la
    // semana 1"): es otro dato que el % de las semanas y tiene que verse.
    progressDeltaWrap: {
      alignItems: 'flex-end',
      marginLeft: 12,
    },
    progressDeltaBase: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      lineHeight: 14,
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
    weeksSection: {
      marginHorizontal: theme.spacing.md,
      // Un poco más de aire que entre las tarjetas de arriba (md): aquí empieza
      // otra cosa, una lista con su propia cabecera.
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
    // Título "Semana N": estilo display compartido con Cardio (lib/textStyles).
    // El color lo pone el render inline (blanco), como en Cardio.
    weekTitle: weekTitleText(),
    // "Descarga" en azul en el hueco del %, para una semana de deload.
    deloadLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.emoji_blue,
      backgroundColor: theme.colors.emoji_blueMuted,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.pill,
      overflow: 'hidden',
      lineHeight: 18,
    },
    // Los días de la semana en curso, uno por disco pequeño.
    weekDaysRow: {
      flexDirection: 'row',
      gap: 4,
      marginRight: 2,
    },
    // Pendiente: aro y fondo suaves pero legibles (con `border` a secas y el
    // icono en `textMuted` casi no se distinguía del fondo de la tarjeta).
    weekDayDot: {
      width: WEEK_DAY_DOT_SIZE,
      height: WEEK_DAY_DOT_SIZE,
      borderRadius: WEEK_DAY_DOT_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: theme.colors.textMuted + '99',
      backgroundColor: theme.colors.surfaceAlt,
    },
    weekDayDotDone: {
      borderColor: theme.colors.success,
      backgroundColor: theme.colors.success + '22',
    },
    weekDayDotNext: {
      borderColor: theme.colors.primaryLine,
      borderWidth: 2,
    },
    weekHeaderMeta: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '700',
      lineHeight: 16,
    },
    weekAchievementButtonPressed: {
      opacity: 0.6,
    },
    // Acciones de la semana (descarga / ver logros): botones etiquetados al
    // PRINCIPIO del cuerpo desplegado, no en la cabecera colapsada (antes eran
    // iconos sueltos amontonados junto al chevron) ni al final del todo (antes
    // había que pasar todas las tarjetas de día para llegar a ellos).
    weekActionsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    weekActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      backgroundColor: theme.colors.surface,
    },
    weekActionDeload: {
      borderColor: theme.colors.emoji_blue,
    },
    weekActionDeloadActive: {
      backgroundColor: theme.colors.emoji_blueMuted,
    },
    weekActionAchievement: {
      borderColor: theme.colors.primaryLine,
    },
    weekActionText: {
      fontSize: 13,
      fontWeight: '800',
    },
    // Padding vertical menor que el horizontal y SIN `minHeight`: dentro solo
    // hay un icono de 36 y dos renglones, así que el alto lo fijaba el mínimo y
    // no el contenido, y sobraba aire arriba y abajo en la lista que más se
    // recorre. Con el icono (36) + 10 arriba y abajo la tarjeta mide lo que
    // pesa. Misma medida que su gemela de Cardio (`dailyCard`).
    historyLogCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.md,
      marginTop: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
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
    // Día que no se entrenó: misma caja, sin relleno ni sombra y con el borde
    // a trazos, para que se lea como un hueco y no como una sesión más.
    historyLogCardMissing: {
      backgroundColor: 'transparent',
      borderStyle: 'dashed',
      borderColor: theme.colors.textMuted,
      // Sin elevación: una sombra haría flotar un hueco (en Android la sombra
      // la da `elevation`, así que no basta con shadowOpacity).
      shadowOpacity: 0,
      elevation: 0,
    },
    historyLogAccentMissing: {
      opacity: 0.55,
    },
    historyLogDayNameMissing: {
      color: theme.colors.textSecondary,
    },
    historyLogMissingText: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 2,
      lineHeight: 16,
      fontWeight: '600',
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
    // Nombre de día: estilo display compartido con Cardio y el selector de día.
    historyLogDayName: dayNameText(),
    historyLogDate: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
      fontWeight: '500',
    },
    // Zona de toque de 36 (icono de 20 + 8 por lado) más su hitSlop: dentro de
    // una tarjeta que también se pulsa, quedarse corto abría el registro.
    logOptionsButton: {
      padding: 8,
      // Los márgenes negativos devuelven el padding: el botón crece hacia
      // fuera sin empujar la fila ni hacer más alta la tarjeta.
      margin: -6,
      marginRight: -10,
      borderRadius: theme.borderRadius.sm,
    },
    logOptionsButtonPressed: {
      opacity: 0.6,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
