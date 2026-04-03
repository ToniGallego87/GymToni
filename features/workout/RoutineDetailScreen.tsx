import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { WorkoutRoutine } from '../../types';
import { getDisplayDayName, getTrainingAccent, theme } from '@lib/theme';

interface RoutineDetailScreenProps {
  routine: WorkoutRoutine;
  onBack: () => void;
}

export function RoutineDetailScreen({
  routine,
  onBack,
}: RoutineDetailScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{routine.name}</Text>
        <Text style={styles.subtitle}>{routine.description}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {routine.days.map(day => {
          const accent = getTrainingAccent(day);

          return (
            <View key={day.id} style={styles.dayBlock}>
              <View style={styles.dayHeader}>
                <View style={styles.dayHeaderLeft}>
                  <Text style={styles.dayEmoji}>{day.emoji}</Text>
                  <Text style={styles.dayName}>{getDisplayDayName(day.name)}</Text>
                </View>
                <Text style={styles.dayBadge}>Día {day.dayNumber}</Text>
              </View>

              <View style={styles.exerciseList}>
                {day.exercises.map(exercise => (
                  <View key={exercise.id} style={styles.exerciseRow}>
                    <View style={[styles.exerciseDot, { backgroundColor: accent }]} />
                    <Text style={styles.exerciseText}>
                      {exercise.name} — {exercise.targetSets || '-'}x{exercise.targetReps || '-'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  dayBlock: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: 12,
    ...theme.shadow.soft,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dayEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    flexShrink: 1,
    lineHeight: 22,
  },
  dayBadge: {
    color: theme.colors.primaryLight,
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    lineHeight: 16,
  },
  exerciseList: {
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  exerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  exerciseText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  backButton: {
    marginHorizontal: theme.spacing.md,
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
});
