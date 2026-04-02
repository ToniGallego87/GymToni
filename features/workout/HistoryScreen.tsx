import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
} from 'react-native';
import { useWorkout } from '@hooks/useWorkout';
import { formatDate } from '@lib/storage';
import { WorkoutLog } from '@types/index';
import { theme } from '@lib/theme';

interface HistoryScreenProps {
  onSelectLog: (log: WorkoutLog) => void;
}

interface ImprovementResult {
  isImproved: boolean;
  percent: number;
}

function getLogTimestamp(log: WorkoutLog): number {
  if (typeof log.createdAt === 'number') return log.createdAt;
  if (log.date) return new Date(`${log.date}T00:00:00`).getTime();
  return 0;
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

export function HistoryScreen({ onSelectLog }: HistoryScreenProps) {
  const { state } = useWorkout();
  const [expandedWeekBlocks, setExpandedWeekBlocks] = useState<Record<number, boolean>>({});

  const activeRoutine = state.routines.find(routine => routine.id === state.activeRoutineId);
  const routineLogs = useMemo(
    () => state.logs
      .filter(log => !state.activeRoutineId || log.routineId === state.activeRoutineId)
      .sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a)),
    [state.activeRoutineId, state.logs]
  );

  const getDay = (dayId: string) => {
    for (const routine of state.routines) {
      const day = routine.days.find(d => d.id === dayId);
      if (day) return day;
    }
    return undefined;
  };

  const buildWeekDataForLogs = (sourceLogs: WorkoutLog[]) => {
    const sortedByDateAsc = [...sourceLogs].sort((a, b) => getLogTimestamp(a) - getLogTimestamp(b));
    const groupedByBlock: Record<number, WorkoutLog[]> = {};

    let block = 1;
    let currentWeekLogs: WorkoutLog[] = [];
    let seenDays: Record<number, boolean> = {};

    sortedByDateAsc.forEach(log => {
      const day = getDay(log.dayId);
      const dayNumber = day?.dayNumber;

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
    const previousLogs = routineLogs
      .filter(log => log.dayId === currentLog.dayId && log.id !== currentLog.id)
      .filter(log => getLogTimestamp(log) < currentTs)
      .sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a));

    return previousLogs[0] || null;
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
    if (weekLogs.length === 0) return { volume: 0, reps: 0 };

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

    const expectedCount = restrictToDayIds ? restrictToDayIds.length : Math.max(1, activeRoutine?.days.length || 5);
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

  const toggleWeekBlock = (blockId: number) => {
    setExpandedWeekBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));
  };

  if (routineLogs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📊 Historial</Text>
          <Text style={styles.subtitle}>Tus entrenamientos</Text>
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>Sin entrenamientos</Text>
          <Text style={styles.emptyText}>
            Comienza a registrar tus sesiones de entrenamiento
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { groupedByBlock } = buildWeekDataForLogs(routineLogs);
  const blocks = Object.keys(groupedByBlock)
    .map(Number)
    .sort((a, b) => b - a);
  const currentWeekBlock = blocks[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Historial</Text>
        <Text style={styles.subtitle}>{activeRoutine?.name || 'Tus entrenamientos'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {blocks.map(block => {
          const weekLogs = groupedByBlock[block].slice().reverse();
          const isExpanded = expandedWeekBlocks[block] ?? (block === currentWeekBlock);
          const weekImprovement = getWeekImprovement(groupedByBlock, block, currentWeekBlock);

          return (
            <View key={block}>
              <Pressable style={styles.weekHeaderButton} onPress={() => toggleWeekBlock(block)}>
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

              {isExpanded && weekLogs.map(log => {
                const day = getDay(log.dayId);
                const improvement = getLogImprovement(log);
                if (!day) return null;

                return (
                  <Pressable
                    key={log.id}
                    style={({ pressed }) => [styles.logCard, pressed && styles.logCardPressed]}
                    onPress={() => onSelectLog(log)}
                  >
                    <View style={styles.logHeader}>
                      <View style={styles.logLeft}>
                        <Text style={styles.logEmoji}>{day.emoji}</Text>
                        <View>
                          <View style={styles.dayNameRow}>
                            <Text style={styles.dayName}>{day.name}</Text>
                            {!!improvement && (
                              <Text
                                style={[
                                  styles.logImprovementText,
                                  improvement.isImproved ? styles.weekImprovementUp : styles.weekImprovementDown,
                                ]}
                              >
                                {improvement.isImproved ? '↑' : '↓'} {improvement.percent.toFixed(1)}%
                              </Text>
                            )}
                          </View>
                          <Text style={styles.date}>{formatDate(log.createdAt)}</Text>
                        </View>
                      </View>
                      <Text style={styles.exerciseCount}>{item.exercises.length} ejercicios</Text>
                    </View>

                    <View style={styles.logPreview}>
                      {log.exercises.slice(0, 2).map((ex, idx) => (
                        <Text key={idx} style={styles.previewText} numberOfLines={1}>
                          • {ex.exerciseName}
                        </Text>
                      ))}
                      {log.exercises.length > 2 && (
                        <Text style={styles.moreText}>+{log.exercises.length - 2} más</Text>
                      )}
                    </View>

                    {log.cardio && (
                      <View style={styles.cardioIndicator}>
                        <Text style={styles.cardioText}>🏃 Cardio</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  weekHeaderButton: {
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
    gap: 8,
  },
  weekTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  weekImprovementText: {
    fontSize: 12,
    fontWeight: '800',
  },
  weekImprovementUp: {
    color: theme.colors.success,
  },
  weekImprovementDown: {
    color: theme.colors.error,
  },
  weekHeaderMeta: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  logCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.soft,
  },
  logCardPressed: {
    opacity: 0.7,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  dayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  logImprovementText: {
    fontSize: 12,
    fontWeight: '800',
  },
  date: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  exerciseCount: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.darkGray,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  logPreview: {
    marginBottom: 8,
  },
  previewText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginVertical: 2,
  },
  moreText: {
    fontSize: 11,
    color: theme.colors.lightGray,
    fontStyle: 'italic',
    marginTop: 4,
  },
  cardioIndicator: {
    backgroundColor: theme.colors.darkGray,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  cardioText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
