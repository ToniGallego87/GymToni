import React, { useMemo, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useWorkout } from '@hooks/useWorkout';
import { DayCard } from '@components/DayCard';
import { WorkoutDay, WorkoutRoutine, WorkoutLog } from '@types/index';
import { theme } from '@lib/theme';
import { getWeekNumber } from '@lib/storage';

interface HomeScreenProps {
  onSelectDay: (day: WorkoutDay) => void;
}

interface WeekProgressPoint {
  week: number;
  improvement: number;
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

function buildWeekProgress(
  logs: WorkoutLog[],
  activeRoutineId?: string
): WeekProgressPoint[] {
  if (!activeRoutineId) return [];

  // El progreso solo se calcula con la rutina actualmente seleccionada en Inicio.
  const routineLogs = logs.filter(log => log.routineId === activeRoutineId);
  if (routineLogs.length === 0) return [];

  const weeklyScores = routineLogs.reduce((acc: Record<number, number>, log) => {
    const week = getWeekNumber(log.createdAt);
    const score = getWorkoutVolumeScore(log);
    acc[week] = (acc[week] || 0) + score;
    return acc;
  }, {});

  const orderedWeeks = Object.keys(weeklyScores)
    .map(Number)
    .sort((a, b) => a - b);

  return orderedWeeks.map((week, index) => {
    if (index === 0) {
      return { week, improvement: 0 };
    }

    const current = weeklyScores[week] || 0;
    const previous = weeklyScores[orderedWeeks[index - 1]] || 0;

    if (previous <= 0 && current <= 0) {
      return { week, improvement: 0 };
    }

    if (previous <= 0 && current > 0) {
      return { week, improvement: 30 };
    }

    const improvement = ((current - previous) / previous) * 100;
    return { week, improvement: Math.round(improvement * 10) / 10 };
  });
}

function ProgressLineChart({ points, width }: { points: WeekProgressPoint[]; width: number }) {
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

  const getX = (index: number) => {
    if (points.length <= 1) return chartPadding.left;
    return chartPadding.left + (index / (points.length - 1)) * plotWidth;
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
      <View style={styles.progressChart}>
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

        {points.slice(1).map((point, index) => {
          const prevPoint = points[index];
          const x1 = getX(index);
          const y1 = getY(prevPoint.improvement);
          const x2 = getX(index + 1);
          const y2 = getY(point.improvement);
          const lineLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
          const lineColor = point.improvement >= prevPoint.improvement
            ? theme.colors.success
            : theme.colors.error;

          return (
            <View
              key={`line-${index}`}
              style={[
                styles.chartLineSegment,
                {
                  width: lineLength,
                  backgroundColor: lineColor,
                  left: x1,
                  top: y1,
                  transform: [{ rotate: `${angleDeg}deg` }],
                },
              ]}
            />
          );
        })}

        {points.map((point, index) => {
          const x = getX(index);
          const y = getY(point.improvement);
          const isPositive = point.improvement >= 0;

          return (
            <React.Fragment key={`point-${point.week}-${index}`}>
              <View
                style={[
                  styles.chartDot,
                  {
                    left: x - 4,
                    top: y - 4,
                    backgroundColor: isPositive ? theme.colors.success : theme.colors.error,
                  },
                ]}
              />
              <Text style={[styles.chartXLabel, { left: x - 16, top: chartHeight - 20 }]}>S{point.week}</Text>
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

export function HomeScreen({ onSelectDay }: HomeScreenProps) {
  const { state, dispatch } = useWorkout();
  const [showRoutineSelector, setShowRoutineSelector] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  const activeRoutine = state.routines.find(
    (routine: WorkoutRoutine) => routine.id === state.activeRoutineId
  );
  const activeDays = activeRoutine?.days || [];
  const weeklyProgress = useMemo(
    () => buildWeekProgress(state.logs, state.activeRoutineId),
    [state.logs, state.activeRoutineId]
  );
  const latestPoint = weeklyProgress[weeklyProgress.length - 1];
  const chartWidth = Math.max(
    250,
    Math.min(windowWidth - theme.spacing.md * 2 - 20, 420)
  );

  const handleSelectRoutine = (routineId: string) => {
    dispatch({ type: 'SET_ACTIVE_ROUTINE', payload: routineId });
    setShowRoutineSelector(false);
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
          {state.routines.map((routine: WorkoutRoutine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              isActive={routine.id === state.activeRoutineId}
              onPress={() => handleSelectRoutine(routine.id)}
            />
          ))}
        </ScrollView>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setShowRoutineSelector(false)}
        >
          <Text style={styles.backButtonText}>← Volver a los días</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>💪 GymToni</Text>
          <TouchableOpacity
            style={styles.routineButton}
            onPress={() => setShowRoutineSelector(true)}
          >
            <Text style={styles.routineButtonText}>
              {activeRoutine?.name || 'Sin rutina'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          {activeRoutine?.description || 'Tu rutina semanal'}
        </Text>

        {weeklyProgress.length > 0 && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.progressTitle}>Progreso entre semanas</Text>
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
            <ProgressLineChart points={weeklyProgress} width={chartWidth} />
          </View>
        )}
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.heroIconWrap}>
          <Text style={styles.heroIcon}>🏋️</Text>
        </View>
        <Text style={styles.heroTitle}>Empezar entrenamiento</Text>
        <Text style={styles.heroSubtitle}>Elige una sesión y registra tu progreso de hoy</Text>
      </View>

      <FlatList
        data={activeDays}
        keyExtractor={(day: WorkoutDay) => day.id}
        renderItem={({ item }: { item: WorkoutDay }) => (
          <DayCard
            emoji={item.emoji}
            name={item.name}
            description={item.description}
            onPress={() => onSelectDay(item)}
          />
        )}
        contentContainerStyle={styles.list}
        scrollEnabled={true}
      />
    </SafeAreaView>
  );
}

interface RoutineCardProps {
  routine: WorkoutRoutine;
  isActive: boolean;
  onPress: () => void;
}

function RoutineCard({ routine, isActive, onPress }: RoutineCardProps) {
  return (
    <TouchableOpacity
      style={[styles.routineCard, isActive && styles.routineCardActive]}
      onPress={onPress}
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
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  progressCard: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  progressLatest: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressLatestUp: {
    color: theme.colors.success,
  },
  progressLatestDown: {
    color: theme.colors.error,
  },
  progressChartWrapper: {
    alignItems: 'center',
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
  chartLineSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
  },
  chartDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.surface,
  },
  chartXLabel: {
    position: 'absolute',
    width: 32,
    textAlign: 'center',
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  chartYLabel: {
    position: 'absolute',
    left: 0,
    width: 36,
    textAlign: 'right',
    fontSize: 10,
    color: theme.colors.textSecondary,
    paddingRight: 6,
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
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingVertical: 24,
    paddingHorizontal: 22,
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
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16, 19, 24, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroIcon: {
    fontSize: 30,
  },
  heroTitle: {
    color: theme.colors.darkGray,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: theme.colors.darkGray,
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.72,
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
    backgroundColor: theme.colors.surfaceAlt,
  },
  routineCardContent: {
    flex: 1,
  },
  routineCardName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  routineCardDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  routineCardDays: {
    fontSize: 12,
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
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});

