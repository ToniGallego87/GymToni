import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
} from '@components';
import { ExerciseResultDisplay } from '@components/ExerciseResultDisplay';
import { formatDate } from '@lib/storage';
import { WorkoutLog, WorkoutDay, ExerciseLog } from '../../types';
import { useWorkout } from '@hooks/useWorkout';
import { theme } from '@lib/theme';
import {
  buildImprovementFromStrengthScores,
  getExerciseStrengthScore,
  getWorkoutStrengthScore,
} from '@lib/progress';

interface DetailScreenProps {
  log: WorkoutLog;
  day: WorkoutDay;
  onBack: () => void;
}

interface ImprovementResult {
  isImproved: boolean;
  percent: number;
}

function getLogTimestamp(log: WorkoutLog | null): number {
  if (!log) return 0;
  if (typeof log.createdAt === 'number') return log.createdAt;
  if (log.date) return new Date(`${log.date}T00:00:00`).getTime();
  return 0;
}


function extractIncline(rawInput: string): string | null {
  if (!rawInput) return null;
  // Buscar patrón "10p", "5.5p", etc.
  const match = rawInput.match(/(\d+(?:\.\d+)?)\s*p(?:\s|,|$)/i);
  return match ? `${match[1]}%` : null;
}

function extractPaceNumber(pace: string): string {
  if (!pace) return '';
  // Extraer solo el número (ej: "11.5kmh" -> "11.5")
  const match = pace.match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : pace;
}

export function DetailScreen({
  log,
  day,
  onBack,
}: DetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom = Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding = floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  const displayedDate = log.date
    ? new Date(`${log.date}T00:00:00`).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(/^[a-z]/, c => c.toUpperCase())
    : formatDate(log.createdAt);

  const previousLog = [...state.logs]
    .filter(l => l.dayId === log.dayId && getLogTimestamp(l) < getLogTimestamp(log))
    .sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a))[0] || null;

  const detailImprovement = previousLog
    ? buildImprovementFromStrengthScores(
        getWorkoutStrengthScore(log),
        getWorkoutStrengthScore(previousLog)
      )
    : null;

  const getExerciseFromLog = (
    sourceLog: WorkoutLog | null,
    exerciseId: string,
    exerciseName: string,
    order?: number
  ): ExerciseLog | null => {
    if (!sourceLog || !sourceLog.exercises) return null;
    
    // Buscar por ID de ejercicio
    let found = sourceLog.exercises.find(e => e.exerciseId === exerciseId);
    if (found) return found;
    
    // Buscar por nombre
    found = sourceLog.exercises.find(e => e.exerciseName === exerciseName);
    if (found) return found;
    
    // Buscar por orden si todo lo demás falla
    if (order !== undefined) {
      found = sourceLog.exercises.find(e => e.order === order);
      if (found) return found;
    }
    
    return null;
  };

  const formatImprovementDisplay = (imp: { isImproved: boolean; percent: number }) => {
    const roundedPercent = imp.percent % 1 === 0 ? Math.round(imp.percent) : imp.percent.toFixed(1);
    
    if (imp.percent === 0) {
      return { symbol: '=', color: theme.colors.warning, display: roundedPercent };
    }
    
    return {
      symbol: imp.isImproved ? '↑' : '↓', 
      color: imp.isImproved ? theme.colors.success : theme.colors.error,
      display: roundedPercent
    };
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topBarHeight + 12,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {day.exercises.length > 0 && (
          <Text style={styles.sectionTitle}>
            Ejercicios
          </Text>
        )}

        {day.exercises.map((exercise, exerciseIndex) => {
          const currentExercise = getExerciseFromLog(log, exercise.id, exercise.name, exercise.order);
          
          // Si no encuentra el ejercicio por ID/nombre/order, intenta por índice
          const fallbackExercise = !currentExercise && log.exercises && log.exercises[exerciseIndex] ? log.exercises[exerciseIndex] : currentExercise;
          
          const prevExercise = getExerciseFromLog(previousLog, exercise.id, exercise.name, exercise.order);
          const exerciseImprovement = (fallbackExercise || currentExercise) && prevExercise
            ? buildImprovementFromStrengthScores(
                getExerciseStrengthScore(fallbackExercise || currentExercise),
                getExerciseStrengthScore(prevExercise)
              )
            : null;

          const selectedExercise = fallbackExercise || currentExercise;

          return (
            <ExerciseResultDisplay
              key={exercise.id}
              exerciseName={exercise.name}
              targetSets={exercise.targetSets}
              targetReps={exercise.targetReps as string | number | undefined}
              rawInput={selectedExercise?.rawInput || '-'}
              parsedSets={selectedExercise?.parsedSets || []}
              notes={selectedExercise?.notes}
              previousSets={prevExercise?.parsedSets}
              improvementText={exerciseImprovement ? (() => { const fmt = formatImprovementDisplay(exerciseImprovement); return `${fmt.symbol} ${fmt.display}%`; })() : undefined}
              improvementPositive={exerciseImprovement ? exerciseImprovement.isImproved : true}
              improvementColor={exerciseImprovement ? (() => { const fmt = formatImprovementDisplay(exerciseImprovement); return fmt.color; })() : undefined}
              isDetail={true}
            />
          );
        })}

        {log.cardio && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: theme.spacing.xl, color: theme.colors.primary }]}>
              Cardio
            </Text>
            <View style={styles.cardioBox}>
              <Text style={styles.cardioLabel}>{log.cardio.type?.toUpperCase()}</Text>
              <View style={styles.cardioDetails}>
                {log.cardio.duration && (
                  <View style={styles.cardioDetailRow}>
                    <MaterialCommunityIcons name="timer-sand" size={14} color={theme.colors.primary} />
                    <Text style={styles.cardioDetail}>{log.cardio.duration} min</Text>
                  </View>
                )}
                {log.cardio.pace && (
                  <View style={styles.cardioDetailRow}>
                    <MaterialCommunityIcons name="map-marker-path" size={14} color={theme.colors.primary} />
                    <Text style={styles.cardioDetail}>{extractPaceNumber(log.cardio.pace)} km/h</Text>
                  </View>
                )}
                {log.cardio.rawInput && extractIncline(log.cardio.rawInput) && (
                  <View style={styles.cardioDetailRow}>
                    <MaterialCommunityIcons name="chart-line" size={14} color={theme.colors.primary} />
                    <Text style={styles.cardioDetail}>{extractIncline(log.cardio.rawInput)}</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <GlassTopBar
        title={`${day.emoji} ${day.name}`}
        subtitle={displayedDate}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailImprovementText: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  detailImprovementUp: {
    color: theme.colors.success,
  },
  detailImprovementDown: {
    color: theme.colors.error,
  },
  date: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: theme.colors.current,
    marginBottom: theme.spacing.xs,
    lineHeight: 22,
  },
  cardioBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  cardioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    lineHeight: 16,
  },
  cardioRaw: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: 'monospace',
    backgroundColor: theme.colors.darkGray,
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
    lineHeight: 20,
  },
  cardioDetails: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cardioDetail: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
    lineHeight: 18,
  },
  cardioDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footer: {
    marginTop: 32,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
});
