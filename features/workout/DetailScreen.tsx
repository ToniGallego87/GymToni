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

function getWorkoutVolumeScore(sourceLog: WorkoutLog | null): number {
  if (!sourceLog) return 0;
  return sourceLog.exercises.reduce((exerciseAcc, exercise) => {
    const exerciseVolume = exercise.parsedSets.reduce(
      (setAcc, setItem) => setAcc + setItem.weight * setItem.reps,
      0
    );
    return exerciseAcc + exerciseVolume;
  }, 0);
}

function getWorkoutRepsScore(sourceLog: WorkoutLog | null): number {
  if (!sourceLog) return 0;
  return sourceLog.exercises.reduce((exerciseAcc, exercise) => {
    const repsScore = exercise.parsedSets.reduce(
      (setAcc, setItem) => setAcc + setItem.reps,
      0
    );
    return exerciseAcc + repsScore;
  }, 0);
}

function getExerciseVolumeScore(exerciseLog: ExerciseLog | null): number {
  if (!exerciseLog) return 0;
  return exerciseLog.parsedSets.reduce(
    (setAcc, setItem) => setAcc + setItem.weight * setItem.reps,
    0
  );
}

function getExerciseRepsScore(exerciseLog: ExerciseLog | null): number {
  if (!exerciseLog) return 0;
  return exerciseLog.parsedSets.reduce((setAcc, setItem) => setAcc + setItem.reps, 0);
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
    ? buildImprovementFromScores(
        getWorkoutVolumeScore(log),
        getWorkoutVolumeScore(previousLog),
        getWorkoutRepsScore(log),
        getWorkoutRepsScore(previousLog)
      )
    : null;

  const getExerciseFromLog = (
    sourceLog: WorkoutLog | null,
    exerciseId: string,
    exerciseName: string
  ): ExerciseLog | null => {
    if (!sourceLog) return null;
    return sourceLog.exercises.find(
      e => e.exerciseId === exerciseId || e.exerciseName === exerciseName
    ) || null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.backButton}>← Volver</Text>
        </Pressable>
        <View style={styles.detailTitleRow}>
          <Text style={styles.headerTitle}>
            {day.emoji} {day.name}
          </Text>
          {!!detailImprovement && (
            <Text
              style={[
                styles.detailImprovementText,
                detailImprovement.isImproved
                  ? styles.detailImprovementUp
                  : styles.detailImprovementDown,
              ]}
            >
              {detailImprovement.isImproved ? '↑' : '↓'} {detailImprovement.percent.toFixed(1)}%
            </Text>
          )}
        </View>
        <Text style={styles.date}>{displayedDate}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionTitle}>Fuerza</Text>

        {day.exercises.map(exercise => {
          const currentExercise = getExerciseFromLog(log, exercise.id, exercise.name);
          const prevExercise = getExerciseFromLog(previousLog, exercise.id, exercise.name);
          const exerciseImprovement = currentExercise && prevExercise
            ? buildImprovementFromScores(
                getExerciseVolumeScore(currentExercise),
                getExerciseVolumeScore(prevExercise),
                getExerciseRepsScore(currentExercise),
                getExerciseRepsScore(prevExercise)
              )
            : null;

          return (
            <ExerciseResultDisplay
              key={exercise.id}
              exerciseName={`${exercise.name} - ${exercise.targetSets || '-'}x${exercise.targetReps || '-'}`}
              rawInput={currentExercise?.rawInput || '-'}
              parsedSets={currentExercise?.parsedSets || []}
              notes={currentExercise?.notes}
              previousSets={prevExercise?.parsedSets}
              improvementText={exerciseImprovement ? `${exerciseImprovement.isImproved ? '↑' : '↓'} ${exerciseImprovement.percent.toFixed(1)}%` : undefined}
              improvementPositive={exerciseImprovement ? exerciseImprovement.isImproved : true}
            />
          );
        })}

        {log.cardio && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              Cardio
            </Text>
            <View style={styles.cardioBox}>
              <Text style={styles.cardioLabel}>{log.cardio.type}</Text>
              <Text style={styles.cardioRaw}>{log.cardio.rawInput}</Text>
              <View style={styles.cardioDetails}>
                {log.cardio.duration && (
                  <Text style={styles.cardioDetail}>
                    ⏱️ {log.cardio.duration} min
                  </Text>
                )}
                {log.cardio.pace && (
                  <Text style={styles.cardioDetail}>
                    📍 {log.cardio.pace}
                  </Text>
                )}
              </View>
            </View>
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Guardado: {new Date(log.createdAt).toLocaleTimeString('es-ES')}
          </Text>
        </View>
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
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 1,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailImprovementText: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailImprovementUp: {
    color: theme.colors.success,
  },
  detailImprovementDown: {
    color: theme.colors.error,
  },
  date: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginVertical: 12,
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
    color: theme.colors.primary,
    marginBottom: 6,
  },
  cardioRaw: {
    fontSize: 13,
    color: theme.colors.text,
    fontFamily: 'monospace',
    backgroundColor: theme.colors.darkGray,
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  cardioDetails: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  cardioDetail: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  footer: {
    marginTop: 32,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});
