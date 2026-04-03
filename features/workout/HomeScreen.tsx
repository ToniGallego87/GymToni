import React, { useMemo, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Modal,
  Alert,
} from 'react-native';
import { useWorkout } from '@hooks/useWorkout';
import { DayCard } from '@components/DayCard';
import { WorkoutDay, WorkoutRoutine, WorkoutLog } from '@types/index';
import { getDisplayDayName, theme } from '@lib/theme';

interface HomeScreenProps {
  onSelectDay: (day: WorkoutDay) => void;
  onSelectLog?: (log: WorkoutLog, day: WorkoutDay) => void;
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

interface ImprovementResult {
  isImproved: boolean;
  percent: number;
}

function getWorkoutVolumeScore(log: WorkoutLog): number {
  return log.exercises.reduce((exerciseAcc, exercise) => {
    const exerciseVolume = exercise.parsedSets.reduce(
      (setAcc, setItem) => setAcc + setItem.weight * setItem.reps,
      0
    );
    return exerciseAcc + exerciseVolume;
  }, 0);
}

function getWorkoutRepsScore(log: WorkoutLog): number {
  return log.exercises.reduce((exerciseAcc, exercise) => {
    const repsScore = exercise.parsedSets.reduce(
      (setAcc, setItem) => setAcc + setItem.reps,
      0
    );
    return exerciseAcc + repsScore;
  }, 0);
}

function buildImprovementFromScores(
  currentScore: number,
  previousScore: number,
  currentRepsScore = 0,
  previousRepsScore = 0
): ImprovementResult | null {
  if (!isFinite(currentScore) || !isFinite(previousScore)) return null;

  if (previousScore <= 0 && currentScore > 0) {
    return { isImproved: true, percent: 30 };
  }

  if (previousScore <= 0 && currentScore <= 0) {
    if (!isFinite(currentRepsScore) || !isFinite(previousRepsScore)) return null;
    if (previousRepsScore <= 0 && currentRepsScore > 0) {
      return { isImproved: true, percent: 30 };
    }
    if (previousRepsScore <= 0 && currentRepsScore <= 0) return null;

    const repsDeltaPct = ((currentRepsScore - previousRepsScore) / previousRepsScore) * 100;
    return { isImproved: repsDeltaPct > 0, percent: Math.abs(repsDeltaPct) };
  }

  const deltaPct = ((currentScore - previousScore) / previousScore) * 100;
  return { isImproved: deltaPct > 0, percent: Math.abs(deltaPct) };
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
  const sortedByDateAsc = [...routineLogs].sort((a, b) => a.createdAt - b.createdAt);
  const groupedByBlock: Record<number, WorkoutLog[]> = {};

  let block = 1;
  let currentWeekLogs: WorkoutLog[] = [];
  let seenDays: Record<number, boolean> = {};

  sortedByDateAsc.forEach(log => {
    const dayNumber = dayIdToDayNumber[log.dayId];

    if (dayNumber && seenDays[dayNumber] && currentWeekLogs.length > 0) {
      groupedByBlock[block] = currentWeekLogs;
      block += 1;
      currentWeekLogs = [];
      seenDays = {};
    }

    currentWeekLogs.push(log);
    if (dayNumber) {
      seenDays[dayNumber] = true;
    }
  });

  if (currentWeekLogs.length > 0) {
    groupedByBlock[block] = currentWeekLogs;
  }

  const orderedBlocks = Object.keys(groupedByBlock)
    .map(Number)
    .sort((a, b) => a - b);

  const getWeekScores = (
    weekLogs: WorkoutLog[],
    options: { restrictToDayIds?: string[]; applyMissingPenalty?: boolean } = {}
  ) => {
    const { restrictToDayIds, applyMissingPenalty = true } = options;
    if (weekLogs.length === 0) {
      return { volume: 0, reps: 0 };
    }

    const latestByDayId: Record<string, WorkoutLog> = {};
    [...weekLogs]
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach(log => {
        if (!log.dayId) return;
        if (!latestByDayId[log.dayId]) {
          latestByDayId[log.dayId] = log;
        }
      });

    const selectedLogs: WorkoutLog[] = [];
    Object.keys(latestByDayId).forEach(dayId => {
      const log = latestByDayId[dayId];
      if (!restrictToDayIds || restrictToDayIds.indexOf(log.dayId) !== -1) {
        selectedLogs.push(log);
      }
    });

    const rawVolume = selectedLogs.reduce((sum: number, log: WorkoutLog) => sum + getWorkoutVolumeScore(log), 0);
    const rawReps = selectedLogs.reduce((sum: number, log: WorkoutLog) => sum + getWorkoutRepsScore(log), 0);

    if (!applyMissingPenalty) {
      return { volume: rawVolume, reps: rawReps };
    }

    const expectedCount = restrictToDayIds ? restrictToDayIds.length : Math.max(1, activeDays.length || 5);
    const missingDays = Math.max(0, expectedCount - selectedLogs.length);
    const penaltyFactor = Math.max(0, 1 - (missingDays * 0.2));

    return {
      volume: rawVolume * penaltyFactor,
      reps: rawReps * penaltyFactor,
    };
  };

  const latestBlockNumber = orderedBlocks[orderedBlocks.length - 1];
  let cumulativeFactor = 1;

  return orderedBlocks.map((blockNumber, index) => {
    if (index === 0) {
      return { week: 1, improvement: 0 };
    }

    const previousBlockNumber = blockNumber - 1;
    const currentWeekLogsForBlock = groupedByBlock[blockNumber] || [];
    const previousWeekLogsForBlock = groupedByBlock[previousBlockNumber] || [];

    if (!currentWeekLogsForBlock.length || !previousWeekLogsForBlock.length) {
      return { week: index + 1, improvement: Math.round((cumulativeFactor - 1) * 1000) / 10 };
    }

    let improvement: ImprovementResult | null;

    if (blockNumber === latestBlockNumber) {
      const completedDayIds = currentWeekLogsForBlock
        .map(log => log.dayId)
        .filter((dayId, index, array) => !!dayId && array.indexOf(dayId) === index);
      const currentScores = getWeekScores(currentWeekLogsForBlock, {
        restrictToDayIds: completedDayIds,
        applyMissingPenalty: false,
      });
      const previousScores = getWeekScores(previousWeekLogsForBlock, {
        restrictToDayIds: completedDayIds,
        applyMissingPenalty: true,
      });
      improvement = buildImprovementFromScores(
        currentScores.volume,
        previousScores.volume,
        currentScores.reps,
        previousScores.reps
      );
    } else {
      const currentScores = getWeekScores(currentWeekLogsForBlock, { applyMissingPenalty: true });
      const previousScores = getWeekScores(previousWeekLogsForBlock, { applyMissingPenalty: true });
      improvement = buildImprovementFromScores(
        currentScores.volume,
        previousScores.volume,
        currentScores.reps,
        previousScores.reps
      );
    }

    if (improvement) {
      const signedDelta = improvement.isImproved ? improvement.percent : -improvement.percent;
      cumulativeFactor = Math.max(0, cumulativeFactor * (1 + signedDelta / 100));
    }

    return {
      week: index + 1,
      improvement: Math.round(((cumulativeFactor - 1) * 100) * 10) / 10,
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
  onOpenDaySelector,
  onOpenRoutineSelector,
  onOpenRoutineDetails,
  onCreateRoutine,
  onDeleteCurrentRoutine,
  canDeleteCurrentRoutine = false,
  initialShowRoutineSelector = false,
  onCloseRoutineSelector,
}: HomeScreenProps) {
  const { state, dispatch } = useWorkout();
  const [showRoutineSelector, setShowRoutineSelector] = useState(initialShowRoutineSelector);
  const [showWeeklyProgressChart, setShowWeeklyProgressChart] = useState(false);
  const [expandedWeekBlocks, setExpandedWeekBlocks] = useState<Record<number, boolean>>({});
  const [viewedRoutineId, setViewedRoutineId] = useState<string | undefined>(undefined);
  const [routineToDeleteId, setRoutineToDeleteId] = useState<string | undefined>(undefined);
  const [logToDeleteId, setLogToDeleteId] = useState<string | undefined>(undefined);
  const { width: windowWidth } = useWindowDimensions();

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
  const latestPoint = weeklyProgress[weeklyProgress.length - 1];
  const chartWidth = Math.max(
    250,
    Math.min(windowWidth - theme.spacing.md * 2 - 20, 420)
  );
  const hasNoRoutines = activeDays.length === 0;

  const handleStartPress = () => {
    if (hasNoRoutines) {
      onCreateRoutine?.();
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

  const getLogTimestamp = (log: WorkoutLog) => {
    if (typeof log.createdAt === 'number') return log.createdAt;
    if (log.date) return new Date(`${log.date}T00:00:00`).getTime();
    return 0;
  };

  const buildWeekDataForLogs = (sourceLogs: WorkoutLog[]) => {
    const sortedByDateAsc = [...sourceLogs].sort((a, b) => getLogTimestamp(a) - getLogTimestamp(b));
    const groupedByBlock: Record<number, WorkoutLog[]> = {};

    let block = 1;
    let currentWeekLogs: WorkoutLog[] = [];
    let seenDays: Record<number, boolean> = {};

    sortedByDateAsc.forEach(log => {
      const dayNumber = getDay(log.dayId)?.dayNumber;

      if (dayNumber && seenDays[dayNumber] && currentWeekLogs.length > 0) {
        groupedByBlock[block] = currentWeekLogs;
        block += 1;
        currentWeekLogs = [];
        seenDays = {};
      }

      currentWeekLogs.push(log);
      if (dayNumber) {
        seenDays[dayNumber] = true;
      }
    });

    if (currentWeekLogs.length > 0) {
      groupedByBlock[block] = currentWeekLogs;
    }

    return { groupedByBlock };
  };

  const getPreviousFilledLogForSameDay = (currentLog: WorkoutLog) => {
    const currentTs = getLogTimestamp(currentLog);
    return displayedRoutineLogs
      .filter((log: WorkoutLog) => log.dayId === currentLog.dayId && log.id !== currentLog.id)
      .filter((log: WorkoutLog) => getLogTimestamp(log) < currentTs)
      .sort((a: WorkoutLog, b: WorkoutLog) => getLogTimestamp(b) - getLogTimestamp(a))[0] || null;
  };

  const getLogImprovement = (currentLog: WorkoutLog) => {
    const previousLog = getPreviousFilledLogForSameDay(currentLog);
    if (!previousLog) return null;

    return buildImprovementFromScores(
      getWorkoutVolumeScore(currentLog),
      getWorkoutVolumeScore(previousLog),
      getWorkoutRepsScore(currentLog),
      getWorkoutRepsScore(previousLog)
    );
  };

  const getWeekScores = (
    weekLogs: WorkoutLog[],
    options: { restrictToDayIds?: string[]; applyMissingPenalty?: boolean } = {}
  ) => {
    const { restrictToDayIds, applyMissingPenalty = true } = options;
    if (weekLogs.length === 0) {
      return { volume: 0, reps: 0 };
    }

    const latestByDayId: Record<string, WorkoutLog> = {};
    [...weekLogs]
      .sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a))
      .forEach(log => {
        if (!latestByDayId[log.dayId]) {
          latestByDayId[log.dayId] = log;
        }
      });

    const selectedLogs: WorkoutLog[] = [];
    Object.keys(latestByDayId).forEach(dayId => {
      const log = latestByDayId[dayId];
      if (!restrictToDayIds || restrictToDayIds.indexOf(log.dayId) !== -1) {
        selectedLogs.push(log);
      }
    });

    const rawVolume = selectedLogs.reduce((sum, log) => sum + getWorkoutVolumeScore(log), 0);
    const rawReps = selectedLogs.reduce((sum, log) => sum + getWorkoutRepsScore(log), 0);

    if (!applyMissingPenalty) {
      return { volume: rawVolume, reps: rawReps };
    }

    const expectedCount = restrictToDayIds ? restrictToDayIds.length : Math.max(1, activeDays.length || 5);
    const missingDays = Math.max(0, expectedCount - selectedLogs.length);
    const penaltyFactor = Math.max(0, 1 - (missingDays * 0.2));

    return {
      volume: rawVolume * penaltyFactor,
      reps: rawReps * penaltyFactor,
    };
  };

  const getWeekImprovement = (groupedByBlock: Record<number, WorkoutLog[]>, blockNumber: number, latestBlockNumber: number) => {
    const previousBlockNumber = blockNumber - 1;
    const currentWeekLogs = groupedByBlock[blockNumber] || [];
    const previousWeekLogs = groupedByBlock[previousBlockNumber] || [];

    if (!currentWeekLogs.length || !previousWeekLogs.length) return null;

    if (blockNumber === latestBlockNumber) {
      const completedDayIds = currentWeekLogs
        .map(log => log.dayId)
        .filter((dayId, index, array) => !!dayId && array.indexOf(dayId) === index);

      const currentScores = getWeekScores(currentWeekLogs, {
        restrictToDayIds: completedDayIds,
        applyMissingPenalty: false,
      });
      const previousScores = getWeekScores(previousWeekLogs, {
        restrictToDayIds: completedDayIds,
        applyMissingPenalty: true,
      });

      return buildImprovementFromScores(
        currentScores.volume,
        previousScores.volume,
        currentScores.reps,
        previousScores.reps
      );
    }

    const currentScores = getWeekScores(currentWeekLogs, { applyMissingPenalty: true });
    const previousScores = getWeekScores(previousWeekLogs, { applyMissingPenalty: true });

    return buildImprovementFromScores(
      currentScores.volume,
      previousScores.volume,
      currentScores.reps,
      previousScores.reps
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

  if (showRoutineSelector) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📚 Selecciona una rutina</Text>
          <Text style={styles.subtitle}>Elige cuál deseas trabajar hoy</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.routineListContainer}
          scrollEnabled={true}
        >
          {state.routines.map((routine: WorkoutRoutine) => {
            const routineHasLogs = state.logs.some(log => log.routineId === routine.id);
            const canDelete = !routineHasLogs;
            
            return (
            <RoutineCard
              key={routine.id}
              routine={routine}
              isActive={routine.id === (viewedRoutineId || state.activeRoutineId)}
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
        </ScrollView>

        <Pressable style={styles.backButton} onPress={() => {
          if (onCloseRoutineSelector) {
            onCloseRoutineSelector();
          } else {
            setShowRoutineSelector(false);
          }
        }}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>

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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} nestedScrollEnabled>
        <View style={styles.header}>
          <Text style={styles.title}>💪 GymToni</Text>
          <Text style={styles.subtitle}>Tu rutina optimizada</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            hasNoRoutines ? styles.heroCardWarning : (isRoutineOld && !isDisplayedRoutineActive ? styles.heroCardClosed : styles.heroCard),
            pressed && styles.heroCardPressed
          ]}
          onPress={handleStartPress}
        >
          <View style={styles.heroGlow} />
          <View style={styles.heroIconWrap}>
            <Text style={styles.heroIcon}>{hasNoRoutines ? '➕' : isRoutineOld && !isDisplayedRoutineActive ? '🔒' : '🏋️'}</Text>
          </View>
          <Text style={styles.heroTitle}>
            {hasNoRoutines ? 'Añade una rutina' : isRoutineOld && !isDisplayedRoutineActive ? 'Rutina Cerrada' : 'Empezar entrenamiento'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {hasNoRoutines
              ? 'Crea una rutina personalizada para comenzar'
              : ''}
          </Text>
        </Pressable>

        {!hasNoRoutines && (
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={styles.buttonRowItem}
            onPress={() => {
              if (onOpenRoutineSelector) {
                onOpenRoutineSelector();
              } else {
                setShowRoutineSelector(true);
              }
            }}
          >
            <Text style={styles.buttonRowLabel}>
              {displayedRoutine ? `Rutina ${state.routines.findIndex((r: WorkoutRoutine) => r.id === displayedRoutineId) + 1}` : 'Rutinas'} ▼
            </Text>
          </TouchableOpacity>

          {!!activeRoutine && !!onOpenRoutineDetails && (
            <TouchableOpacity
              style={styles.buttonRowItem}
              onPress={() => onOpenRoutineDetails(activeRoutine)}
            >
              <Text style={styles.buttonRowLabel}>Consultar ejercicios</Text>
            </TouchableOpacity>
          )}
        </View>
        )}

        {weeklyProgress.length > 0 && (
          <View style={styles.progressCard}>
            <TouchableOpacity
              style={styles.progressToggleButton}
              onPress={() => setShowWeeklyProgressChart((prev: boolean) => !prev)}
              activeOpacity={0.85}
            >
              <View style={styles.progressHeaderRow}>
                <Text style={styles.progressTitle}>Progreso de la rutina {showWeeklyProgressChart ? '▲' : '▼'}</Text>
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
              <ProgressBarChart points={weeklyProgress} width={chartWidth} />
            )}
          </View>
        )}

        {displayedRoutineLogs.length > 0 && (
          <View style={[styles.weeksSection, { flex: 1 }]}>
            <ScrollView nestedScrollEnabled style={{ flex: 1 }}>
              {blocks.map((block: number) => {
                const weekLogs = groupedByBlock[block].slice().reverse();
                const isExpanded = expandedWeekBlocks[block] ?? (block === currentWeekBlock);
                const weekImprovement = getWeekImprovement(groupedByBlock, block, currentWeekBlock);

                return (
                  <View key={block}>
                    <Pressable
                      style={styles.weekHeaderButton}
                      onPress={() => setExpandedWeekBlocks((prev: Record<number, boolean>) => ({ ...prev, [block]: !prev[block] }))}
                    >
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
                      if (!day) return null;

                      return (
                        <Pressable
                          key={log.id}
                          style={({ pressed }: { pressed: boolean }) => [
                            styles.historyLogCard,
                            pressed && styles.historyLogCardPressed,
                          ]}
                          onPress={() => {
                            // Si el log es de hoy (último insertado), ir a edición en lugar de detalle
                            if (isLogFromToday(log)) {
                              onSelectDay?.(day);
                            } else {
                              onSelectLog?.(log, day);
                            }
                          }}
                          onLongPress={() => {
                            if (isLogFromToday(log)) {
                              setLogToDeleteId(log.id);
                            }
                          }}
                          delayLongPress={2000}
                        >
                          <View style={styles.historyLogHeader}>
                            <View style={styles.historyLogLeft}>
                              <Text style={styles.historyLogEmoji}>{day.emoji}</Text>
                              <View>
                                <View style={styles.historyLogNameRow}>
                                  <Text style={styles.historyLogDayName}>{getDisplayDayName(day.name)}</Text>
                                  {!!improvement && (
                                    <Text
                                      style={[
                                        styles.historyLogImprovementText,
                                        improvement.isImproved ? styles.weekImprovementUp : styles.weekImprovementDown,
                                      ]}
                                    >
                                      {improvement.isImproved ? '↑' : '↓'} {improvement.percent.toFixed(1)}%
                                    </Text>
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
    </SafeAreaView>
  );
}

interface RoutineCardProps {
  routine: WorkoutRoutine;
  isActive: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

function RoutineCard({ routine, isActive, onPress, onLongPress }: RoutineCardProps) {
  return (
    <TouchableOpacity
      style={[styles.routineCard, isActive && styles.routineCardActive]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={2000}
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
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
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
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  progressCard: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  heroCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  heroCardClosed: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  heroCardWarning: {
    backgroundColor: theme.colors.warning,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  heroGlow: {
    position: 'absolute',
    top: -30,
    right: -8,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 19, 24, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroIcon: {
    fontSize: 36,
  },
  heroTitle: {
    color: theme.colors.darkGray,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  heroSubtitle: {
    color: theme.colors.darkGray,
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.78,
    textAlign: 'center',
    lineHeight: 21,
  },
  buttonsRow: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 12,
  },
  buttonRowItem: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRowLabel: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
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
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    minHeight: 72,
    justifyContent: 'center',
    ...theme.shadow.soft,
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
  historyLogEmoji: {
    fontSize: 22,
    marginRight: 12,
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
    paddingVertical: theme.spacing.md,
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
    borderColor: theme.colors.border,
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
  backButton: {
    marginHorizontal: theme.spacing.md,
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
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
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
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
    color: '#fff',
  },
});

