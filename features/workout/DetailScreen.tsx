import React from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { ExerciseResultDisplay } from '@components/ExerciseResultDisplay';
import { formatDate } from '@lib/storage';
import { WorkoutLog, WorkoutDay, ExerciseLog } from '@types/index';
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
  const { state } = useWorkout();

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {day.emoji} {day.name}
        </Text>
        <Text style={styles.headerSubtitle}>{displayedDate}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
              improvementText={exerciseImprovement ? `${exerciseImprovement.isImproved ? '↑' : '↓'} ${exerciseImprovement.percent.toFixed(1)}%` : undefined}
              improvementPositive={exerciseImprovement ? exerciseImprovement.isImproved : true}
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
                  <Text style={styles.cardioDetail}>
                    ⏱️ {log.cardio.duration} min
                  </Text>
                )}
                {log.cardio.pace && (
                  <Text style={styles.cardioDetail}>
                    📍 {extractPaceNumber(log.cardio.pace)} km/h
                  </Text>
                )}
                {log.cardio.rawInput && extractIncline(log.cardio.rawInput) && (
                  <Text style={styles.cardioDetail}>
                    📈 {extractIncline(log.cardio.rawInput)}
                  </Text>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Volver</Text>
      </Pressable>
    </SafeAreaView>
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
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerSubtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  backButton: {
    marginHorizontal: theme.spacing.md,
    marginTop: 16,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
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
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
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
