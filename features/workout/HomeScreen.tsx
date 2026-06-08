import React, { useMemo, useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import { DayCard } from '@components/DayCard';
import { WorkoutDay, WorkoutRoutine, WorkoutLog, ExerciseLog } from '../../types';
import { getDisplayDayName, theme } from '@lib/theme';
import { buildImprovementFromStrengthScores, getExerciseImprovementPercent, ImprovementResult } from '@lib/progress';
import { getImprovementDisplay, getLogTimestamp } from '@lib/utils';
import { groupLogsIntoWeekBlocks, getWeekStrengthScore } from '@lib/weeks';
import {
  DayAccentIcon,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  getFloatingPrimaryNavMetrics,
  FloatingPrimaryNav,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  HeroCard,
  HeroVariant,
  GradientFill,
} from '../../components';

interface HomeScreenProps {
  onSelectDay: (day: WorkoutDay) => void;
  onSelectLog?: (log: WorkoutLog, day: WorkoutDay) => void;
  onEditLog?: (log: WorkoutLog, day: WorkoutDay) => void;
  onNavigateHome?: () => void;
  onNavigateCalendar?: () => void;
  onNavigateData?: () => void;
  onOpenDaySelector?: () => void;
  onOpenRoutineSelector?: () => void;
  onOpenRoutineDetails?: (routine: WorkoutRoutine) => void;
  onCreateRoutine?: () => void;
  onDeleteCurrentRoutine?: () => void;
  canDeleteCurrentRoutine?: boolean;
  initialShowRoutineSelector?: boolean;
  onCloseRoutineSelector?: () => void;
}

interface WeekProgressPoint {
  week: number;
  improvement: number;
}

function buildWeekProgress(
  logs: WorkoutLog[],
  activeRoutineId?: string,
  activeDays: WorkoutDay[] = []
): WeekProgressPoint[] {
  if (!activeRoutineId) return [];

  // El progreso solo se calcula con la rutina actualmente seleccionada en Inicio.
  const routineLogs = logs.filter(log => log.routineId === activeRoutineId);
  if (routineLogs.length === 0) return [];

  const dayIdToDayNumber: Record<string, number> = {};
  activeDays.forEach(day => {
    dayIdToDayNumber[day.id] = day.dayNumber;
  });

  const groupedByBlock = groupLogsIntoWeekBlocks(routineLogs, log => dayIdToDayNumber[log.dayId]);
  const orderedBlocks = Object.keys(groupedByBlock)
    .map(Number)
    .sort((a, b) => a - b);

  // El gráfico compara cada semana contra la PRIMERA (progreso acumulado),
  // a diferencia del listado, que compara contra la semana anterior.
  return orderedBlocks.map((blockNumber, index) => {
    if (index === 0) {
      return { week: 1, improvement: 0 };
    }

    const firstBlockNumber = orderedBlocks[0];
    const currentWeekLogsForBlock = groupedByBlock[blockNumber] || [];
    const previousWeekLogsForBlock = groupedByBlock[firstBlockNumber] || [];

    if (!currentWeekLogsForBlock.length || !previousWeekLogsForBlock.length) {
      return { week: index + 1, improvement: 0 };
    }

    const currentStrength = getWeekStrengthScore(currentWeekLogsForBlock, { activeDaysCount: activeDays.length });
    const previousStrength = getWeekStrengthScore(previousWeekLogsForBlock, { activeDaysCount: activeDays.length });
    const improvement = buildImprovementFromStrengthScores(currentStrength, previousStrength);

    const signedDelta = improvement
      ? (improvement.isImproved ? improvement.percent : -improvement.percent)
      : 0;

    return {
      week: index + 1,
      improvement: Math.round(signedDelta * 10) / 10,
    };
  });
}

function ProgressBarChart({ points, width }: { points: WeekProgressPoint[]; width: number }) {
  const chartPadding = { top: 16, right: 12, bottom: 28, left: 38 };
  const chartHeight = 170;
  const chartWidth = width;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;

  const values = points.map(point => point.improvement);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const sameValueRange = minValue === maxValue;
  const domainPadding = sameValueRange ? 10 : Math.max((maxValue - minValue) * 0.15, 5);
  const domainMin = Math.min(minValue - domainPadding, 0);
  const domainMax = Math.max(maxValue + domainPadding, 0);

  const barSlotWidth = points.length > 0 ? plotWidth / points.length : plotWidth;
  const barWidth = Math.max(18, Math.min(barSlotWidth * 0.55, 34));
  const getBarX = (index: number) => {
    return chartPadding.left + (index * barSlotWidth) + ((barSlotWidth - barWidth) / 2);
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
              style={[styles.chartGridLine, { top: y, left: chartPadding.left, width: plotWidth }]}
            />
          );
        })}

        <View
          style={[
            styles.chartAxisLine,
            { top: zeroAxisY, left: chartPadding.left, width: plotWidth },
          ]}
        />

        {points.map((point, index) => {
          const x = getBarX(index);
          const y = getY(point.improvement);
          const barTop = point.improvement >= 0 ? y : zeroAxisY;
          const barHeight = Math.max(Math.abs(zeroAxisY - y), 4);
          const isPositive = point.improvement >= 0;
          const shouldRenderBar = index > 0;

          return (
            <React.Fragment key={`point-${point.week}-${index}`}>
              {shouldRenderBar && (
                <View
                  style={[
                    styles.chartBar,
                    {
                      left: x,
                      top: barTop,
                      height: barHeight,
                      width: barWidth,
                      backgroundColor: isPositive ? theme.colors.success : theme.colors.error,
                    },
                  ]}
                />
              )}
              <Text style={[styles.chartXLabel, { left: x + (barWidth / 2) - 16, top: chartHeight - 20 }]}>S{point.week}</Text>
            </React.Fragment>
          );
        })}

        {yTicks.map((tick, idx) => {
          const y = getY(tick);
          return (
            <Text key={`y-label-${idx}`} style={[styles.chartYLabel, { top: y - 8 }]}>
              {`${Math.round(tick)}%`}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

export function HomeScreen({
  onSelectDay,
  onSelectLog,
  onEditLog,
  onNavigateHome,
  onNavigateCalendar,
  onNavigateData,
  onOpenDaySelector,
  onOpenRoutineSelector,
  onOpenRoutineDetails,
  onCreateRoutine,
  onDeleteCurrentRoutine,
  canDeleteCurrentRoutine = false,
  initialShowRoutineSelector = false,
  onCloseRoutineSelector,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const [showRoutineSelector, setShowRoutineSelector] = useState(initialShowRoutineSelector);
  const [showWeeklyProgressChart, setShowWeeklyProgressChart] = useState(false);
  const [expandedWeekBlocks, setExpandedWeekBlocks] = useState<Record<number, boolean>>({});
  const [viewedRoutineId, setViewedRoutineId] = useState<string | undefined>(state.activeRoutineId);
  const [routineToDeleteId, setRoutineToDeleteId] = useState<string | undefined>(undefined);
  const [logToDeleteId, setLogToDeleteId] = useState<string | undefined>(undefined);
  const [logWithOptionsId, setLogWithOptionsId] = useState<string | undefined>(undefined);
  const [selectedLogDayForOptions, setSelectedLogDayForOptions] = useState<WorkoutDay | undefined>(undefined);
  const { width: windowWidth } = useWindowDimensions();

  // Sincronizar con la rutina activa cuando cambia (ej: tras hidratación del storage)
  useEffect(() => {
    setViewedRoutineId(state.activeRoutineId);
  }, [state.activeRoutineId]);

  const activeRoutine = state.routines.find(
    (routine: WorkoutRoutine) => routine.id === state.activeRoutineId
  );
  
  // Determine qué rutina se está visualizando (puede ser diferente a la activa)
  const displayedRoutineId = viewedRoutineId || state.activeRoutineId;
  const displayedRoutine = state.routines.find(
    (routine: WorkoutRoutine) => routine.id === displayedRoutineId
  );
  
  // Detectar si la rutina visualizada es la activa
  const isDisplayedRoutineActive = displayedRoutineId === state.activeRoutineId;
  
  // Detectar si la rutina visualizada es una vieja (tiene logs)
  const isRoutineOld = displayedRoutineId && state.logs.some(log => log.routineId === displayedRoutineId);
  
  // Usar la rutina visualizada para mostrar datos
  const activeDays = displayedRoutine?.days || [];
  const displayedRoutineLogs = useMemo(
    () => state.logs
      .filter((log: WorkoutLog) => !displayedRoutineId || log.routineId === displayedRoutineId)
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
  const { bottom: floatingNavBottom, scrollBottomPadding: floatingNavScrollBottomPadding } =
    getFloatingPrimaryNavMetrics(insets.bottom);
  const selectorNavBottom = floatingNavBottom;
  const selectorScrollBottomPadding = floatingNavScrollBottomPadding;
  const homeScrollBottomPadding = floatingNavScrollBottomPadding;
  const appVersion = require('../../app.json').expo.version;

  const formatImprovementDisplay = (imp: { isImproved: boolean; percent: number }) => {
    const { symbol, display, kind } = getImprovementDisplay(imp);
    const styleKey =
      kind === 'up' ? 'weekImprovementUp'
      : kind === 'down' ? 'weekImprovementDown'
      : 'weekImprovementNeutral';
    return { symbol, styleKey, display };
  };

  const handleStartPress = () => {
    if (hasNoRoutines) {
      onCreateRoutine?.();
      return;
    }

    // Si el entrenamiento de hoy ya está completado, no hacer nada
    if (isTodayWorkoutCompleted()) {
      return;
    }

    // No permitir iniciar entrenamiento con rutina vieja que NO sea la activa
    if (isRoutineOld && !isDisplayedRoutineActive) {
      return;
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

  const isTodayWorkoutCompleted = (): boolean => {
    const todayKey = new Date().toISOString().split('T')[0];
    return displayedRoutineLogs.some(log => {
      if (log.date) {
        return log.date === todayKey;
      }
      return new Date(log.createdAt).toISOString().split('T')[0] === todayKey;
    });
  };

  const isWeekCompleted = (weekLogs: WorkoutLog[]): boolean => {
    if (weekLogs.length === 0) return false;
    if (activeDays.length === 0) return false;
    
    const daysWithLogs = new Set(weekLogs.map(log => log.dayId));
    return activeDays.every(day => daysWithLogs.has(day.id));
  };

  const buildWeekDataForLogs = (sourceLogs: WorkoutLog[]) => ({
    groupedByBlock: groupLogsIntoWeekBlocks(sourceLogs, log => getDay(log.dayId)?.dayNumber),
  });

  const getPreviousFilledLogForSameDay = (currentLog: WorkoutLog) => {
    const currentTs = getLogTimestamp(currentLog);
    return displayedRoutineLogs
      .filter((log: WorkoutLog) => log.dayId === currentLog.dayId && log.id !== currentLog.id)
      .filter((log: WorkoutLog) => getLogTimestamp(log) < currentTs)
      .sort((a: WorkoutLog, b: WorkoutLog) => getLogTimestamp(b) - getLogTimestamp(a))[0] || null;
  };

  // Media de la mejora por ejercicio entre dos sesiones concretas (negativo = 0).
  const computeImprovementBetweenLogs = (
    currentLog: WorkoutLog,
    previousLog: WorkoutLog | null
  ): ImprovementResult | null => {
    if (!previousLog) return null;

    // Mapeo de ejercicios anteriores por ID y por nombre (para casar renombrados)
    const previousByExerciseId: Record<string, ExerciseLog> = {};
    const previousByExerciseName: Record<string, ExerciseLog> = {};
    previousLog.exercises.forEach(ex => {
      previousByExerciseId[ex.exerciseId] = ex;
      previousByExerciseName[ex.exerciseName] = ex;
    });

    const exerciseImprovements: number[] = [];
    currentLog.exercises.forEach(currentEx => {
      const previousEx = previousByExerciseId[currentEx.exerciseId] || previousByExerciseName[currentEx.exerciseName];
      const improvement = getExerciseImprovementPercent(currentEx, previousEx || null);
      if (improvement !== null) {
        exerciseImprovements.push(improvement);
      }
    });

    if (exerciseImprovements.length === 0) return null;

    const avgImprovement = exerciseImprovements.reduce((sum, v) => sum + v, 0) / exerciseImprovements.length;
    return { isImproved: avgImprovement > 0, percent: avgImprovement };
  };

  // Mejora de una sesión respecto a la anterior del mismo día (independiente de la semana).
  const getLogImprovement = (currentLog: WorkoutLog) =>
    computeImprovementBetweenLogs(currentLog, getPreviousFilledLogForSameDay(currentLog));

  const getWeekImprovement = (groupedByBlock: Record<number, WorkoutLog[]>, blockNumber: number) => {
    if (blockNumber === 1) return null;

    const currentWeekLogs = groupedByBlock[blockNumber] || [];
    const previousWeekLogs = groupedByBlock[blockNumber - 1] || [];

    if (activeDays.length === 0) return null;

    // Obtener el último log por día para la semana actual y anterior
    const currentLatestByDayId: Record<string, WorkoutLog> = {};
    const previousLatestByDayId: Record<string, WorkoutLog> = {};

    currentWeekLogs.forEach(log => {
      if (!currentLatestByDayId[log.dayId] || getLogTimestamp(log) > getLogTimestamp(currentLatestByDayId[log.dayId])) {
        currentLatestByDayId[log.dayId] = log;
      }
    });

    previousWeekLogs.forEach(log => {
      if (!previousLatestByDayId[log.dayId] || getLogTimestamp(log) > getLogTimestamp(previousLatestByDayId[log.dayId])) {
        previousLatestByDayId[log.dayId] = log;
      }
    });

    // Calcular porcentaje de mejora para cada día que aparece en ambas semanas
    const dayImprovements: number[] = [];

    activeDays.forEach(day => {
      const currentDayLog = currentLatestByDayId[day.id];
      const previousDayLog = previousLatestByDayId[day.id];

      if (currentDayLog && previousDayLog) {
        // Ambas semanas tienen el día: comparar esta semana contra la anterior
        const improvement = computeImprovementBetweenLogs(currentDayLog, previousDayLog);
        dayImprovements.push(improvement ? improvement.percent : 0);
      } else if (currentDayLog && !previousDayLog) {
        // Solo la semana actual tiene el día: contar como mejora (primer vez)
        dayImprovements.push(0);
      } else if (!currentDayLog) {
        // La semana actual no tiene el día: contar como 0
        dayImprovements.push(0);
      }
    });

    // Si no hay valores, devolver null
    if (dayImprovements.length === 0) return null;

    // Media de mejoras
    const avgImprovement = dayImprovements.reduce((sum, v) => sum + v, 0) / dayImprovements.length;

    return {
      isImproved: avgImprovement > 0,
      percent: avgImprovement,
    };
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

  const filteredWeeklyProgress = useMemo(() => {
    if (!weeklyProgress || weeklyProgress.length === 0) return weeklyProgress;
    if (!currentWeekBlock || !groupedByBlock) return weeklyProgress;

    const lastWeekLogs = groupedByBlock[currentWeekBlock] || [];
    // Si la semana actual NO está completada, excluir el último punto del gráfico
    if (!isWeekCompleted(lastWeekLogs)) {
      return weeklyProgress.slice(0, Math.max(0, weeklyProgress.length - 1));
    }
    return weeklyProgress;
  }, [weeklyProgress, groupedByBlock, currentWeekBlock]);

  const latestPoint = filteredWeeklyProgress[filteredWeeklyProgress.length - 1];

  // Estado visual de la tarjeta principal según la situación de la rutina/día.
  const getHeroState = (): { variant: HeroVariant; icon: string; title: string } => {
    if (hasNoRoutines) {
      return { variant: 'add', icon: 'plus-thick', title: 'Añade una rutina' };
    }
    if (isRoutineOld && !isDisplayedRoutineActive) {
      return { variant: 'closed', icon: 'lock-outline', title: 'Rutina Cerrada' };
    }
    if (isTodayWorkoutCompleted()) {
      return { variant: 'completed', icon: 'check-bold', title: 'Entrenamiento completado' };
    }
    return { variant: 'start', icon: 'weight-lifter', title: 'Empezar entrenamiento' };
  };
  const hero = getHeroState();

  const handleSelectRoutine = (routineId: string) => {
    // Verificar si la rutina tiene logs (es vieja)
    const routineHasLogs = state.logs.some(log => log.routineId === routineId);
    
    // Siempre establecer como rutina visualizada
    setViewedRoutineId(routineId);
    
    // Si la rutina no es vieja, activarla
    if (!routineHasLogs) {
      dispatch({ type: 'SET_ACTIVE_ROUTINE', payload: routineId });
    }
    
    // Siempre cerrar el selector (permite ver rutinas viejas sin activarlas)
    setShowRoutineSelector(false);
    
    // Si la rutina seleccionada es la activa, volver a home
    if (routineId === state.activeRoutineId && onCloseRoutineSelector) {
      onCloseRoutineSelector();
    }
  };

  const handleDeleteRoutine = () => {
    if (!routineToDeleteId) return;
    
    const routine = state.routines.find(r => r.id === routineToDeleteId);
    if (!routine) return;
    
    dispatch({ type: 'DELETE_ROUTINE', payload: routineToDeleteId });
    
    // Si se borra la rutina visualizada, limpiar viewedRoutineId
    if (viewedRoutineId === routineToDeleteId) {
      setViewedRoutineId(undefined);
    }
    
    setRoutineToDeleteId(undefined);
    setShowRoutineSelector(false);
  };

  const getExecutionDateLabel = (log: WorkoutLog): string => {
    if (log.date) {
      return new Date(`${log.date}T00:00:00`).toLocaleDateString('es-ES');
    }

    return new Date(log.createdAt).toLocaleDateString('es-ES');
  };

  const isLogFromToday = (log: WorkoutLog): boolean => {
    const todayKey = new Date().toISOString().split('T')[0];
    return log.date ? log.date === todayKey : getExecutionDateLabel(log) === new Date().toLocaleDateString('es-ES');
  };

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
    const selectedRoutineInSelector = state.routines.find(r => r.id === viewedRoutineId);

    return (
      <View style={styles.container}>
        <StatusBar style="light" translucent backgroundColor="transparent" />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.routineListContainer,
            {
              paddingTop: topBarHeight + 12,
              paddingBottom: selectorScrollBottomPadding,
            },
          ]}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
        >
          {state.routines.map((routine: WorkoutRoutine) => {
            const routineHasLogs = state.logs.some(log => log.routineId === routine.id);
            const canDelete = !routineHasLogs;
            
            return (
            <RoutineCard
              key={routine.id}
              routine={routine}
              isViewed={routine.id === viewedRoutineId}
              isActive={routine.id === state.activeRoutineId}
              onPress={() => handleSelectRoutine(routine.id)}
              onLongPress={canDelete ? () => setRoutineToDeleteId(routine.id) : undefined}
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
              <Text style={styles.newRoutineCardText}>+ Nueva rutina</Text>
            </TouchableOpacity>
          )}

          {!!selectedRoutineInSelector && !!onOpenRoutineDetails && (
            <TouchableOpacity
              style={styles.selectorDetailsButton}
              onPress={() => onOpenRoutineDetails(selectedRoutineInSelector)}
            >
              <Text style={styles.selectorDetailsButtonText}>Consultar detalles de esta rutina</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <GlassTopBar
          title="Rutina"
          titleElement={(
            <View style={styles.selectorTitleRow}>
              <MaterialCommunityIcons name="book-open-variant" size={18} color={theme.colors.text} />
              <Text style={styles.selectorTitleText}>Rutinas</Text>
            </View>
          )}
          subtitle="Consulta la que desees o crea una nueva"
          topInset={insets.top}
        />

        <FloatingPrimaryNav
          bottom={selectorNavBottom}
          activeTab="routines"
          onPressHome={onNavigateHome || handleCloseRoutineSelector}
          onPressCalendar={onNavigateCalendar}
          onPressData={onNavigateData}
        />

        <Modal
          visible={!!routineToDeleteId}
          transparent
          animationType="fade"
          onRequestClose={() => setRoutineToDeleteId(undefined)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>¿Eliminar rutina?</Text>
              <Text style={styles.modalMessage}>
                Esta acción no se puede deshacer. ¿Estás seguro?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={() => setRoutineToDeleteId(undefined)}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonDelete}
                  onPress={handleDeleteRoutine}
                >
                  <Text style={styles.modalButtonDeleteText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={!!logToDeleteId}
          transparent
          animationType="fade"
          onRequestClose={() => setLogToDeleteId(undefined)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>¿Eliminar entrenamiento?</Text>
              <Text style={styles.modalMessage}>
                Esta acción no se puede deshacer. ¿Estás seguro?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={() => setLogToDeleteId(undefined)}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonDelete}
                  onPress={handleDeleteLog}
                >
                  <Text style={styles.modalButtonDeleteText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.homeScrollContent,
          {
            paddingTop: topBarHeight + 12,
            paddingBottom: homeScrollBottomPadding,
          },
        ]}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >

        <HeroCard
          variant={hero.variant}
          icon={hero.icon}
          title={hero.title}
          onPress={handleStartPress}
        />

        {filteredWeeklyProgress.length > 0 && (() => {
          const progressAccent = latestPoint
            ? latestPoint.improvement >= 0
              ? theme.colors.success
              : theme.colors.error
            : theme.colors.primary;
          return (
          <View style={[styles.progressCard, { borderColor: progressAccent }]}>
            <GradientFill accent={progressAccent} />
            <TouchableOpacity
              style={styles.progressToggleButton}
              onPress={() => setShowWeeklyProgressChart((prev: boolean) => !prev)}
              activeOpacity={0.85}
            >
              <View style={styles.progressHeaderRow}>
                <View style={styles.progressTitleRow}>
                  <MaterialCommunityIcons
                    name="chart-bar"
                    size={18}
                    style={styles.progressTitleIcon}
                  />
                  <Text style={styles.progressTitle}>Rutina {state.routines.findIndex((r: WorkoutRoutine) => r.id === displayedRoutineId) + 1} {showWeeklyProgressChart ? '▲' : '▼'}</Text>
                </View>
                <Text
                  style={[
                    styles.progressLatest,
                    latestPoint && latestPoint.improvement >= 0
                      ? styles.progressLatestUp
                      : styles.progressLatestDown,
                  ]}
                >
                  {latestPoint ? `${latestPoint.improvement >= 0 ? '↑' : '↓'} ${Math.abs(latestPoint.improvement).toFixed(1)}%` : '0%'}
                </Text>
              </View>
            </TouchableOpacity>

            {showWeeklyProgressChart && (
              <ProgressBarChart points={filteredWeeklyProgress} width={chartWidth} />
            )}
          </View>
          );
        })()}

        {displayedRoutineLogs.length > 0 && (
          <View style={[styles.weeksSection, { flex: 1 }]}>
            <ScrollView nestedScrollEnabled style={{ flex: 1 }}>
              {blocks.map((block: number) => {
                const weekLogs = groupedByBlock[block].slice().reverse();
                const weekLogsFull = groupedByBlock[block];
                const weekCompleted = isWeekCompleted(weekLogsFull);
                // Si la rutina no es activa, todas las semanas están colapsadas
                // Si es activa y la semana no está completada, la última semana está expandida por defecto
                // Las semanas completadas están colapsadas por defecto, pero se pueden expandir/colapsar manualmente
                const isExpanded = isDisplayedRoutineActive && !weekCompleted
                  ? (expandedWeekBlocks[block] ?? (block === currentWeekBlock))
                  : (expandedWeekBlocks[block] ?? false);
                const weekImprovement = getWeekImprovement(groupedByBlock, block);
                const weekAccent = weekImprovement
                  ? weekImprovement.isImproved
                    ? theme.colors.success
                    : theme.colors.error
                  : theme.colors.primary;

                return (
                  <View key={block}>
                    <Pressable
                      style={[styles.weekHeaderButton, { borderColor: weekAccent }]}
                      onPress={() => setExpandedWeekBlocks((prev: Record<number, boolean>) => ({ ...prev, [block]: !prev[block] }))}>
                      <GradientFill accent={weekAccent} />

                      <View style={styles.weekTitleRow}>
                        <Text style={styles.weekTitle}>Semana {block}</Text>
                        {!!weekImprovement && (
                          <Text
                            style={[
                              styles.weekImprovementText,
                              weekImprovement.isImproved ? styles.weekImprovementUp : styles.weekImprovementDown,
                            ]}
                          >
                            {weekImprovement.isImproved ? '↑' : '↓'} {weekImprovement.percent.toFixed(1)}%
                          </Text>
                        )}
                      </View>
                      <Text style={styles.weekHeaderMeta}>
                        {weekLogs.length} día{weekLogs.length === 1 ? '' : 's'} {isExpanded ? '▲' : '▼'}
                      </Text>
                    </Pressable>

                    {isExpanded && weekLogs.map((log: WorkoutLog) => {
                      const day = getDay(log.dayId);
                      const improvement = getLogImprovement(log);
                      const isToday = isLogFromToday(log);
                      if (!day) return null;

                      return (
                        <Pressable
                          key={log.id}
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
                          <View style={styles.historyLogHeader}>
                            <View style={styles.historyLogLeft}>
                              <View style={styles.historyLogAccent}>
                                <DayAccentIcon emoji={day.emoji} name={day.name} size={18} />
                              </View>
                              <View>
                                <View style={styles.historyLogNameRow}>
                                  <Text style={styles.historyLogDayName}>{getDisplayDayName(day.name)}</Text>
                                  {!!improvement && (
                                    (() => {
                                      const fmt = formatImprovementDisplay(improvement);
                                      return (
                                        <Text
                                          style={[
                                            styles.historyLogImprovementText,
                                            styles[fmt.styleKey as keyof typeof styles],
                                          ]}
                                        >
                                          {fmt.symbol} {fmt.display}%
                                        </Text>
                                      );
                                    })()
                                  )}
                                </View>
                                <Text style={styles.historyLogDate}>{getExecutionDateLabel(log)}</Text>
                              </View>
                            </View>
                            <Text style={styles.historyLogBadge}>Día {day.dayNumber}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>

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
            <Text style={styles.modalTitle}>¿Qué deseas hacer?</Text>
            <Text style={styles.modalMessage}>
              Puedes editar o eliminar el registro
            </Text>
            <View style={styles.modalButtonsContainer}>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButtonEdit}
                  onPress={() => {
                    const log = displayedRoutineLogs.find(l => l.id === logWithOptionsId);
                    if (log && selectedLogDayForOptions && onEditLog) {
                      onEditLog(log, selectedLogDayForOptions);
                    }
                    setLogWithOptionsId(undefined);
                    setSelectedLogDayForOptions(undefined);
                  }}
                >
                  <View style={styles.modalActionRow}>
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.darkGray} />
                    <Text style={styles.modalButtonEditText}>Editar</Text>
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
                    <MaterialCommunityIcons name="delete-outline" size={16} color={theme.colors.darkGray} />
                    <Text style={styles.modalButtonDeleteText}>Eliminar</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.modalButtonCancel, styles.modalButtonCancelFullWidth]}
                onPress={() => {
                  setLogWithOptionsId(undefined);
                  setSelectedLogDayForOptions(undefined);
                }}
              >
                <Text style={styles.modalButtonCancelText}>← Volver</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!logToDeleteId}
        transparent
        animationType="fade"
        onRequestClose={() => setLogToDeleteId(undefined)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>¿Eliminar entrenamiento?</Text>
            <Text style={styles.modalMessage}>
              Esta acción no se puede deshacer. ¿Estás seguro?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setLogToDeleteId(undefined)}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonDelete}
                onPress={handleDeleteLog}
              >
                <Text style={styles.modalButtonDeleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {!hasNoRoutines && (
        <FloatingPrimaryNav
          bottom={floatingNavBottom}
          activeTab="home"
          onPressHome={onNavigateHome}
          onPressRoutines={() => {
            if (onOpenRoutineSelector) {
              onOpenRoutineSelector();
            } else {
              setShowRoutineSelector(true);
            }
          }}
          onPressCalendar={onNavigateCalendar}
          onPressData={onNavigateData}
        />
      )}

      <GlassTopBar
        title="Inicio"
        titleElement={
          <Image
            source={require('../../assets/title.png')}
            style={styles.titleImage}
            resizeMode="contain"
          />
        }
        subtitle={`Versión ${appVersion}`}
        topInset={insets.top}
      />
    </View>
  );
}

interface RoutineCardProps {
  routine: WorkoutRoutine;
  isViewed: boolean;  // Para el borde grueso
  isActive: boolean;  // Para el check "Activa"
  onPress: () => void;
  onLongPress?: () => void;
}

function RoutineCard({ routine, isViewed, isActive, onPress, onLongPress }: RoutineCardProps) {
  return (
    <TouchableOpacity
      style={[styles.routineCard, isViewed && styles.routineCardActive]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={1000}
    >
      <View style={styles.routineCardContent}>
        <Text style={styles.routineCardName}>{routine.name}</Text>
        <Text style={styles.routineCardDesc}>{routine.description}</Text>
        <Text style={styles.routineCardDays}>
          {routine.days.length} días de entrenamiento
        </Text>
      </View>
      {isActive && <Text style={styles.routineCardActiveIndicator}>✓ Activa</Text>}
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.8,
  },
  titleImage: {
    width: 115,
    height: 24,
    alignSelf: 'flex-start',
  },
  progressCard: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 0,
    overflow: 'hidden',
    alignItems: 'center',
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
  progressTitleIcon: {
    color: theme.colors.text,
  },
  progressToggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: '100%',
  },
  progressTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 22,
  },
  progressLatest: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 20,
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
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.surface,
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
  routineButton: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.pill,
    maxWidth: 180,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  routineButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 18,
  },
  weeksSection: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  homeHistorySection: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  homeHistoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  homeActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  actionChip: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionChipText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  actionChipDanger: {
    borderColor: 'rgba(240, 106, 106, 0.4)',
    backgroundColor: 'rgba(240, 106, 106, 0.08)',
  },
  actionChipDangerText: {
    color: theme.colors.error,
    fontSize: 12,
    fontWeight: '700',
  },
  homeHistoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  homeHistoryCount: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primaryLight,
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.pill,
    lineHeight: 16,
  },
  homeHistoryScroll: {
    maxHeight: 300,
  },
  weekHeaderButton: {
    marginTop: 12,
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'transparent',
    borderLeftWidth: 4,
    borderColor: theme.colors.primary,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
    lineHeight: 22,
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
  weekImprovementNeutral: {
    color: theme.colors.warning,
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    minHeight: 72,
    justifyContent: 'center',
    ...theme.shadow.soft,
  },
  historyLogCardToday: {
    borderColor: theme.colors.warning,
    borderWidth: 2.5,
    borderLeftWidth: 2.5,
    borderLeftColor: theme.colors.warning,
    backgroundColor: 'rgba(255, 193, 7, 0.05)',
  },
  historyLogCardPressed: {
    opacity: 0.8,
  },
  historyLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  historyLogLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  historyLogAccent: {
    marginRight: 12,
    paddingTop: 2,
  },
  historyLogNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  historyLogDayName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 20,
  },
  historyLogImprovementText: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  historyLogDate: {
    fontSize: 14,
    color: theme.colors.primaryLight,
    marginTop: 4,
    lineHeight: 16,
    fontWeight: '500',
  },
  historyLogBadge: {
    color: theme.colors.primaryLight,
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    fontSize: 14,
    fontWeight: '700',
    overflow: 'hidden',
    lineHeight: 16,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyHistoryBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyHistoryText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  list: {
    paddingTop: 0,
    paddingBottom: theme.spacing.xl,
  },
  routineListContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 0,
  },
  routineCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    ...theme.shadow.soft,
  },
  routineCardActive: {
    borderColor: theme.colors.primary,
    borderWidth: 3,
    backgroundColor: theme.colors.surfaceAlt,
  },
  routineCardContent: {
    flex: 1,
  },
  routineCardName: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
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
    fontSize: 13,
    color: theme.colors.primaryLight,
    fontWeight: '800',
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
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
  selectorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  modalMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
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
    color: theme.colors.darkGray,
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
    color: theme.colors.darkGray,
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});



