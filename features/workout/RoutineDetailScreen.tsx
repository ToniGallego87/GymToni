import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { WorkoutRoutine, WorkoutDay } from '../../types';
import { getDisplayDayName, getTrainingAccent, theme } from '@lib/theme';
import { useWorkout } from '@hooks/useWorkout';

interface RoutineDetailScreenProps {
  routine: WorkoutRoutine;
  onBack: () => void;
}

const EMOJI_CHOICES = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣'];

export function RoutineDetailScreen({
  routine,
  onBack,
}: RoutineDetailScreenProps) {
  const { state, dispatch } = useWorkout();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [showEmojiModal, setShowEmojiModal] = useState(false);

  // Obtener la rutina actualizada del estado
  const currentRoutine = state.routines.find(r => r.id === routine.id) || routine;

  const handleSelectDay = (dayId: string) => {
    setSelectedDayId(dayId);
    setShowEmojiModal(true);
  };

  const handleSelectEmoji = (emoji: string) => {
    if (selectedDayId) {
      const day = currentRoutine.days.find(d => d.id === selectedDayId);
      if (day) {
        const updatedDay = { ...day, emoji };
        dispatch({
          type: 'UPDATE_DAY',
          payload: { routineId: currentRoutine.id, dayId: selectedDayId, day: updatedDay },
        });
      }
    }
    setShowEmojiModal(false);
    setSelectedDayId(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{currentRoutine.name}</Text>
        <Text style={styles.subtitle}>{currentRoutine.description}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {currentRoutine.days.map(day => {
          const accent = getTrainingAccent(day);

          return (
            <Pressable
              key={day.id}
              style={styles.dayBlock}
              onPress={() => handleSelectDay(day.id)}
            >
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
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Volver</Text>
      </Pressable>

      <Modal
        visible={showEmojiModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmojiModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Elige un emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_CHOICES.map(emoji => (
                <Pressable
                  key={emoji}
                  style={({ pressed }) => [styles.emojiButton, pressed && styles.emojiButtonPressed]}
                  onPress={() => handleSelectEmoji(emoji)}
                >
                  <Text style={styles.emojiButtonText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
              onPress={() => setShowEmojiModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    fontSize: 19,
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
    fontSize: 15,
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
    fontSize: 16,
    lineHeight: 18,
    color: theme.colors.textSecondary,
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
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    justifyContent: 'center',
  },
  emojiButton: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiButtonPressed: {
    opacity: 0.7,
    backgroundColor: theme.colors.primary,
  },
  emojiButtonText: {
    fontSize: 32,
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
