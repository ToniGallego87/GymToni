import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
} from '../../components';
import { WorkoutRoutine } from '../../types';
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
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerInput, setTimerInput] = useState('');

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom = Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding = floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  // Obtener la rutina actualizada del estado
  const currentRoutine = state.routines.find(r => r.id === routine.id) || routine;

  const getTimerDurationSeconds = () => {
    return (currentRoutine as any).timerDuration || 150;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOpenTimerModal = () => {
    setTimerInput(getTimerDurationSeconds().toString());
    setShowTimerModal(true);
  };

  const handleSaveTimer = () => {
    const newDuration = parseInt(timerInput, 10);
    if (!isNaN(newDuration) && newDuration > 0) {
      dispatch({
        type: 'UPDATE_ROUTINE',
        payload: {
          ...currentRoutine,
          timerDuration: newDuration,
        },
      });
    }
    setShowTimerModal(false);
    setTimerInput('');
  };

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
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + 12,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        
        {currentRoutine.days.map(day => {
          const accent = getTrainingAccent(day);

          return (
            <Pressable
              key={day.id}
              style={[styles.dayBlock, { borderColor: accent }]}
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

        <Pressable
          style={styles.timerBlock}
          onPress={handleOpenTimerModal}
        >
          <View style={styles.timerBlockLabelRow}>
            <MaterialCommunityIcons
              name="timer-sand"
              size={16}
              color={theme.colors.background}
            />
            <Text style={styles.timerBlockLabel}>Temporizador de descanso</Text>
          </View>
          <Text style={styles.timerBlockValue}>{formatTime(getTimerDurationSeconds())}</Text>
          <Text style={styles.timerBlockHint}>Toca para editar</Text>
        </Pressable>

      </ScrollView>

      <GlassTopBar
        title={currentRoutine.name}
        subtitle={currentRoutine.description}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

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

      <Modal
        visible={showTimerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Temporizador</Text>
            <Text style={styles.timerModalLabel}>Duración en segundos:</Text>
            <TextInput
              style={styles.timerModalInput}
              keyboardType="number-pad"
              placeholder="150"
              value={timerInput}
              onChangeText={setTimerInput}
            />
            <Text style={styles.timerModalFormat}>Equivalente: {formatTime(parseInt(timerInput, 10) || 0)}</Text>
            <View style={styles.timerModalButtons}>
              <Pressable
                style={({ pressed }) => [styles.timerModalButton, pressed && styles.buttonPressed]}
                onPress={handleSaveTimer}
              >
                <Text style={styles.timerModalButtonText}>Guardar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.timerModalButton, styles.timerModalButtonCancel, pressed && styles.buttonPressed]}
                onPress={() => setShowTimerModal(false)}
              >
                <Text style={styles.timerModalButtonTextCancel}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  content: {
    paddingHorizontal: theme.spacing.md,
    marginTop: 0,
  },
  dayBlock: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
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
  timerBlock: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadow.soft,
  },
  timerBlockLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  timerBlockLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.background,
  },
  timerBlockValue: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.background,
    marginBottom: 4,
  },
  timerBlockHint: {
    fontSize: 12,
    color: theme.colors.background,
    opacity: 0.8,
  },
  timerModalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  timerModalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 8,
    backgroundColor: theme.colors.surfaceAlt,
  },
  timerModalFormat: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  timerModalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: theme.spacing.sm,
  },
  timerModalButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timerModalButtonCancel: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timerModalButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.background,
  },
  timerModalButtonTextCancel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
});
