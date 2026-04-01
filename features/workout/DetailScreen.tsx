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

  // Obtener el entrenamiento anterior del mismo dayId (bloque previo)
  const getPreviousWorkout = () => {
    const sameDayLogs = state.logs
      .filter(l => l.dayId === log.dayId && l.createdAt < log.createdAt)
      .sort((a, b) => b.createdAt - a.createdAt);
    return sameDayLogs[0] || null;
  };

  const previousLog = getPreviousWorkout();

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
        <Text style={styles.headerTitle}>
          {day.emoji} {day.name}
        </Text>
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

          return (
            <ExerciseResultDisplay
              key={exercise.id}
              exerciseName={`${exercise.name} - ${exercise.targetSets || '-'}x${exercise.targetReps || '-'}`}
              rawInput={currentExercise?.rawInput || '-'}
              parsedSets={currentExercise?.parsedSets || []}
              notes={currentExercise?.notes}
              previousSets={prevExercise?.parsedSets}
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
