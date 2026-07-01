import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DayAccentIcon,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  StretchScrollView,
} from '../../components';
import { WorkoutRoutine } from '../../types';
import { getDisplayDayName, getTrainingAccent, theme } from '@lib/theme';
import { generateId } from '@lib/storage';
import { buildRoutineShareLink } from '@lib/routineShare';
import { useWorkout } from '@hooks/useWorkout';

interface RoutineDetailScreenProps {
  routine: WorkoutRoutine;
  onBack: () => void;
}

const EMOJI_CHOICES = ['🔴', '🟠', '🟤', '🟢', '🔵', '🟣'];

export function RoutineDetailScreen({
  routine,
  onBack,
}: RoutineDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [showEditExercisesModal, setShowEditExercisesModal] = useState(false);
  const [exercisesEditText, setExercisesEditText] = useState('');
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerInput, setTimerInput] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding =
    floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  // Obtener la rutina actualizada del estado
  const currentRoutine =
    state.routines.find((r) => r.id === routine.id) || routine;

  // Enlace que codifica la rutina para compartir por QR (deep link).
  const shareLink = useMemo(
    () => buildRoutineShareLink(currentRoutine),
    [currentRoutine]
  );

  const getTimerDurationSeconds = () => {
    return currentRoutine.timerDuration || 150;
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

  const handleLongPressDay = (dayId: string) => {
    const day = currentRoutine.days.find((d) => d.id === dayId);
    if (day) {
      // Crear un texto con los ejercicios para poder editarlos
      const exercisesText = day.exercises
        .map(
          (ex) => `${ex.name} — ${ex.targetSets || '—'}x${ex.targetReps || '—'}`
        )
        .join('\n');
      setExercisesEditText(exercisesText);
      setSelectedDayId(dayId);
      setShowEditExercisesModal(true);
    }
  };

  const handleSaveExercises = () => {
    if (!selectedDayId) return;

    const day = currentRoutine.days.find((d) => d.id === selectedDayId);
    if (!day) return;

    // Parsear el texto para actualizar ejercicios
    const lines = exercisesEditText.trim().split('\n');
    const updatedExercises = lines
      .filter((line) => line.trim().length > 0)
      .map((line, index) => {
        // Parsear formato: "Nombre — Nx#"
        const match = line.match(
          /^(.+?)\s*—\s*(\d+|\d+\.?\d*|—|x)?\s*[xX×]?\s*(\d+(?:-\d+)?\s*[a-zA-Z]*|—)?/
        );

        const name = match ? match[1].trim() : line.trim();
        const targetSets =
          match && match[2] && match[2] !== '—'
            ? parseInt(match[2])
            : undefined;
        const targetReps =
          match && match[3] && match[3].trim() !== '—'
            ? match[3].trim()
            : undefined;

        // Mantener el ID del ejercicio original si es posible
        const originalExercise = day.exercises[index];

        return {
          id: originalExercise?.id || generateId(),
          name,
          order: index + 1,
          targetSets,
          targetReps: targetReps as string | undefined,
        };
      });

    const updatedDay = { ...day, exercises: updatedExercises };
    dispatch({
      type: 'UPDATE_DAY',
      payload: {
        routineId: currentRoutine.id,
        dayId: selectedDayId,
        day: updatedDay,
      },
    });

    setShowEditExercisesModal(false);
    setSelectedDayId(null);
    setExercisesEditText('');
  };

  const handleSelectEmoji = (emoji: string) => {
    if (selectedDayId) {
      const day = currentRoutine.days.find((d) => d.id === selectedDayId);
      if (day) {
        const updatedDay = { ...day, emoji };
        dispatch({
          type: 'UPDATE_DAY',
          payload: {
            routineId: currentRoutine.id,
            dayId: selectedDayId,
            day: updatedDay,
          },
        });
      }
    }
    setShowEmojiModal(false);
    setSelectedDayId(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <StretchScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + 28,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {currentRoutine.days.map((day) => {
          const accent = getTrainingAccent(day);

          return (
            <Pressable
              key={day.id}
              style={[styles.dayBlock, { borderColor: accent }]}
              onPress={() => handleSelectDay(day.id)}
              onLongPress={() => handleLongPressDay(day.id)}
              delayLongPress={1000}
            >
              <GradientFill accent={accent} />
              <View style={styles.dayHeader}>
                <View style={styles.dayHeaderLeft}>
                  <View style={styles.dayAccentWrap}>
                    <DayAccentIcon
                      emoji={day.emoji}
                      name={day.name}
                      size={16}
                    />
                  </View>
                  <Text style={styles.dayName}>
                    {getDisplayDayName(day.name)}
                  </Text>
                </View>
                <Text style={styles.dayBadge}>Día {day.dayNumber}</Text>
              </View>

              <View style={styles.exerciseList}>
                {day.exercises.map((exercise) => (
                  <View key={exercise.id} style={styles.exerciseRow}>
                    <View
                      style={[styles.exerciseDot, { backgroundColor: accent }]}
                    />
                    <Text style={styles.exerciseText}>
                      {exercise.name} — {exercise.targetSets || '-'}x
                      {exercise.targetReps || '-'}
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}

        <Pressable style={styles.timerBlock} onPress={handleOpenTimerModal}>
          <View style={styles.timerBlockLabelRow}>
            <MaterialCommunityIcons
              name="timer-sand"
              size={16}
              color={theme.colors.background}
            />
            <Text style={styles.timerBlockLabel}>Temporizador de descanso</Text>
          </View>
          <Text style={styles.timerBlockValue}>
            {formatTime(getTimerDurationSeconds())}
          </Text>
          <Text style={styles.timerBlockHint}>Toca para editar</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.shareBlock,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setShowQrModal(true)}
        >
          <MaterialCommunityIcons
            name="qrcode"
            size={20}
            color={theme.colors.text}
          />
          <View style={styles.shareBlockTextWrap}>
            <Text style={styles.shareBlockLabel}>Compartir por QR</Text>
            <Text style={styles.shareBlockHint}>
              Otro móvil escanea y carga la rutina
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </StretchScrollView>

      <GlassTopBar
        title="Rutina"
        titleElement={
          <View style={styles.topBarTitleRow}>
            <MaterialCommunityIcons
              name="file-document-edit-outline"
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.topBarTitleText}>Rutina</Text>
          </View>
        }
        subtitle={currentRoutine.name}
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
            <Text style={styles.modalTitle}>Selecciona un color</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_CHOICES.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={({ pressed }) => [
                    styles.emojiButton,
                    { backgroundColor: getTrainingAccent({ emoji }) },
                    pressed && styles.emojiButtonPressed,
                  ]}
                  onPress={() => handleSelectEmoji(emoji)}
                />
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setShowEmojiModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditExercisesModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowEditExercisesModal(false);
          setSelectedDayId(null);
          setExercisesEditText('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Ejercicios</Text>
            <Text style={styles.editExercisesLabel}>
              Formato: Nombre — SetsxReps
            </Text>
            <TextInput
              style={styles.editExercisesInput}
              placeholder="Ej: Sentadilla — 4x8&#10;Prensa — 3x10"
              placeholderTextColor={theme.colors.textSecondary}
              value={exercisesEditText}
              onChangeText={setExercisesEditText}
              multiline
              scrollEnabled={false}
            />
            <View style={styles.editExercisesButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.editButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleSaveExercises}
              >
                <Text style={styles.editButtonText}>Editar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  setShowEditExercisesModal(false);
                  setSelectedDayId(null);
                  setExercisesEditText('');
                }}
              >
                <Text style={styles.cancelButtonText}>Volver</Text>
              </Pressable>
            </View>
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
            <Text style={styles.timerModalFormat}>
              Equivalente: {formatTime(parseInt(timerInput, 10) || 0)}
            </Text>
            <View style={styles.timerModalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.timerModalButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleSaveTimer}
              >
                <Text style={styles.timerModalButtonText}>Guardar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.timerModalButton,
                  styles.timerModalButtonCancel,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowTimerModal(false)}
              >
                <Text style={styles.timerModalButtonTextCancel}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Compartir rutina</Text>
            <Text style={styles.qrModalHint}>
              Escanea este código con la cámara de otro móvil para cargar «
              {getDisplayDayName(currentRoutine.name) || currentRoutine.name}».
            </Text>
            <View style={styles.qrCanvas}>
              <QRCode
                value={shareLink}
                size={232}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setShowQrModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cerrar</Text>
            </Pressable>
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
  topBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 24,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    marginTop: 0,
  },
  dayBlock: {
    backgroundColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: 12,
    overflow: 'hidden',
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
  dayAccentWrap: {
    marginRight: 10,
    paddingTop: 2,
  },
  dayName: {
    fontSize: 20,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.3,
    color: theme.colors.text,
    flexShrink: 1,
    lineHeight: 25,
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
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  emojiButton: {
    width: '30%',
    height: 48,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emojiButtonPressed: {
    opacity: 0.85,
  },
  editExercisesLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  editExercisesInput: {
    backgroundColor: theme.colors.darkGray,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
    minHeight: 100,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  editExercisesButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.background,
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.xs,
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
    marginTop: 4,
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
  shareBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    ...theme.shadow.soft,
  },
  shareBlockTextWrap: {
    flex: 1,
  },
  shareBlockLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 20,
  },
  shareBlockHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  qrModalHint: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: 19,
  },
  qrCanvas: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
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
