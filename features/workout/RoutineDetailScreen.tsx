import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppModal,
  Button,
  DayAccentIcon,
  ExerciseFormRow,
  ExerciseSummaryRow,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  GymIcon,
  GYM_ICON_NAMES,
  GYM_ICON_LABELS,
  resolveDayIcon,
  StretchScrollView,
  Toast,
} from '../../components';
import { WorkoutRoutine } from '../../types';
import { getDisplayDayName, getTrainingAccent, theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  buildWorkoutExercises,
  createEmptyExercise,
  ExerciseForm,
  exerciseFormFromExercise,
} from '@lib/exerciseForm';
import {
  buildRoutineShareLink,
  buildRoutineShareText,
} from '@lib/routineShare';
import { useWorkout } from '@hooks/useWorkout';

interface RoutineDetailScreenProps {
  routine: WorkoutRoutine;
  onBack: () => void;
}

export function RoutineDetailScreen({
  routine,
  onBack,
}: RoutineDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [showEditExercisesModal, setShowEditExercisesModal] = useState(false);
  // Borrador del editor de ejercicios: filas estructuradas (mismo modelo que
  // "Nueva rutina"), no un textarea que hubiera que volver a parsear.
  const [exercisesDraft, setExercisesDraft] = useState<ExerciseForm[]>([]);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null
  );
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerInput, setTimerInput] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding =
    floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  // Obtener la rutina actualizada del estado
  const currentRoutine =
    state.routines.find((r) => r.id === routine.id) || routine;

  // Rutina cerrada: tiene entrenamientos y ya no es la activa (misma regla que
  // la tarjeta "Rutina Cerrada" de Inicio). No se permite editar su información.
  const isClosed =
    state.logs.some((log) => log.routineId === currentRoutine.id) &&
    currentRoutine.id !== state.activeRoutineId;

  const handleOpenInfoModal = () => {
    if (isClosed) return;
    setNameInput(currentRoutine.name);
    setDescriptionInput(currentRoutine.description ?? '');
    setShowInfoModal(true);
  };

  const handleSaveInfo = () => {
    const name = nameInput.trim();
    if (name) {
      dispatch({
        type: 'UPDATE_ROUTINE',
        payload: {
          ...currentRoutine,
          name,
          description: descriptionInput.trim() || undefined,
        },
      });
    }
    setShowInfoModal(false);
  };

  // Enlace que codifica la rutina para compartir por QR (deep link).
  const shareLink = useMemo(
    () => buildRoutineShareLink(currentRoutine),
    [currentRoutine]
  );

  // Rutina en texto plano, lista para pegar en "Crear a partir de texto plano".
  const shareText = useMemo(
    () => buildRoutineShareText(currentRoutine),
    [currentRoutine]
  );

  const handleCopyPlainText = async () => {
    try {
      await Clipboard.setStringAsync(shareText);
      setToast({
        message: t('Rutina copiada al portapapeles'),
        type: 'success',
      });
    } catch {
      setToast({ message: t('No se pudo copiar la rutina'), type: 'error' });
    }
  };

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

  const handleEditExercises = (dayId: string) => {
    const day = currentRoutine.days.find((d) => d.id === dayId);
    if (!day) return;

    setExercisesDraft(day.exercises.map(exerciseFormFromExercise));
    setEditingExerciseId(null);
    setSelectedDayId(dayId);
    setShowEditExercisesModal(true);
  };

  const closeExercisesModal = () => {
    setShowEditExercisesModal(false);
    setSelectedDayId(null);
    setExercisesDraft([]);
    setEditingExerciseId(null);
  };

  const updateDraftExercise = (
    exerciseId: string,
    changes: Partial<ExerciseForm>
  ) => {
    setExercisesDraft((previous) =>
      previous.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, ...changes } : exercise
      )
    );
  };

  const addDraftExercise = () => {
    const exercise = createEmptyExercise();
    setExercisesDraft((previous) => [...previous, exercise]);
    setEditingExerciseId(exercise.id);
  };

  const removeDraftExercise = (exerciseId: string) => {
    setExercisesDraft((previous) =>
      previous.length <= 1
        ? previous
        : previous.filter((exercise) => exercise.id !== exerciseId)
    );
  };

  const handleSaveExercises = () => {
    if (!selectedDayId) return;

    const day = currentRoutine.days.find((d) => d.id === selectedDayId);
    if (!day) return;

    // Los ids de las filas son los de los ejercicios originales (ver
    // lib/exerciseForm): el historial sigue apuntando a su ejercicio aunque
    // se reordenen o se inserte uno en medio.
    const exercises = buildWorkoutExercises(exercisesDraft);
    if (!exercises.length) {
      setToast({ message: t('Añade al menos un ejercicio'), type: 'error' });
      return;
    }

    dispatch({
      type: 'UPDATE_DAY',
      payload: {
        routineId: currentRoutine.id,
        dayId: selectedDayId,
        day: { ...day, exercises },
      },
    });

    closeExercisesModal();
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
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

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
        <Pressable
          style={styles.infoBlock}
          onPress={handleOpenInfoModal}
          disabled={isClosed}
        >
          <View style={styles.infoTopRow}>
            <View style={styles.infoBadge}>
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={22}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoEyebrow}>{t('Rutina')}</Text>
              <Text style={styles.infoName}>{currentRoutine.name}</Text>
            </View>
            <View style={styles.infoEditChip}>
              <MaterialCommunityIcons
                name={isClosed ? 'lock-outline' : 'pencil'}
                size={16}
                color={
                  isClosed ? theme.colors.textSecondary : theme.colors.primary
                }
              />
            </View>
          </View>
          {!!currentRoutine.description && (
            <Text style={styles.infoDescription}>
              {currentRoutine.description}
            </Text>
          )}
        </Pressable>

        {currentRoutine.days.map((day) => {
          const accent = getTrainingAccent(day);

          return (
            // Pulsar la tarjeta edita sus ejercicios (la acción principal, y la
            // misma regla que el bloque de información de arriba: se pulsa y se
            // abre su editor). Cambiar el icono es su propio botón: se toca el
            // icono. Antes ambas cosas eran gestos a ciegas (pulsar abría el
            // selector de icono; mantener 1s, el editor).
            <Pressable
              key={day.id}
              style={[styles.dayBlock, { borderColor: accent }]}
              onPress={() => handleEditExercises(day.id)}
            >
              <GradientFill accent={accent} />
              <View style={styles.dayHeader}>
                <View style={styles.dayHeaderLeft}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.dayIconButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => handleSelectDay(day.id)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('Selecciona un icono')}
                  >
                    <DayAccentIcon
                      emoji={day.emoji}
                      name={day.name}
                      size={32}
                    />
                    <View style={styles.dayIconEditBadge}>
                      <MaterialCommunityIcons
                        name="pencil"
                        size={9}
                        color={theme.colors.onGold}
                      />
                    </View>
                  </Pressable>
                  <Text style={styles.dayName}>
                    {getDisplayDayName(day.name)}
                  </Text>
                </View>
                <Text style={styles.dayBadge}>
                  {t('Día')} {day.dayNumber}
                </Text>
                <View style={styles.infoEditChip}>
                  <MaterialCommunityIcons
                    name="pencil"
                    size={16}
                    color={theme.colors.primary}
                  />
                </View>
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
              color={theme.colors.onGold}
            />
            <Text style={styles.timerBlockLabel}>
              {t('Temporizador de descanso')}
            </Text>
          </View>
          <Text style={styles.timerBlockValue}>
            {formatTime(getTimerDurationSeconds())}
          </Text>
          <Text style={styles.timerBlockHint}>{t('Toca para editar')}</Text>
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
            <Text style={styles.shareBlockLabel}>{t('Compartir por QR')}</Text>
            <Text style={styles.shareBlockHint}>
              {t('Otro móvil escanea y carga la rutina')}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={theme.colors.textSecondary}
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.shareBlock,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleCopyPlainText}
        >
          <MaterialCommunityIcons
            name="clipboard-text-outline"
            size={20}
            color={theme.colors.text}
          />
          <View style={styles.shareBlockTextWrap}>
            <Text style={styles.shareBlockLabel}>
              {t('Compartir en texto plano')}
            </Text>
            <Text style={styles.shareBlockHint}>
              {t(
                'Copia la rutina para pegarla en «Crear a partir de texto plano»'
              )}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="content-copy"
            size={20}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </StretchScrollView>

      <GlassTopBar
        title={t('Rutina')}
        icon="file-document-edit-outline"
        subtitle={currentRoutine.name}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      <AppModal
        visible={showEmojiModal}
        onRequestClose={() => setShowEmojiModal(false)}
        title={t('Selecciona un icono')}
        icon="shape-outline"
        footer={
          <Button
            title={t('Cancelar')}
            onPress={() => setShowEmojiModal(false)}
            variant="secondary"
            size="medium"
          />
        }
      >
        <View style={styles.iconGrid}>
          {GYM_ICON_NAMES.map((iconName) => {
            const selectedDay = currentRoutine.days.find(
              (d) => d.id === selectedDayId
            );
            const current = selectedDay
              ? resolveDayIcon(selectedDay.emoji, selectedDay.name)
              : null;
            const active = current === iconName;
            return (
              <Pressable
                key={iconName}
                style={({ pressed }) => [
                  styles.iconButton,
                  active && styles.iconButtonActive,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handleSelectEmoji(iconName)}
              >
                <GymIcon
                  name={iconName}
                  size={30}
                  color={active ? theme.colors.primary : theme.colors.white}
                />
                <Text
                  style={[
                    styles.iconButtonLabel,
                    active && { color: theme.colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  {t(GYM_ICON_LABELS[iconName])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </AppModal>

      <AppModal
        visible={showEditExercisesModal}
        onRequestClose={closeExercisesModal}
        title={t('Editar Ejercicios')}
        icon="pencil"
        align="left"
        footer={
          <View style={styles.modalButtonRow}>
            <Button
              title={t('Volver')}
              onPress={closeExercisesModal}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            <Button
              title={t('Guardar')}
              onPress={handleSaveExercises}
              variant="primary"
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
        {/* La lista puede ser larga: scrollea dentro de la tarjeta en vez de
            desbordarla. */}
        <ScrollView
          style={styles.exercisesEditorScroll}
          contentContainerStyle={styles.exercisesEditor}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {exercisesDraft.map((exercise) => {
            const expanded =
              editingExerciseId === exercise.id || !exercise.name.trim();

            return expanded ? (
              <ExerciseFormRow
                key={exercise.id}
                exercise={exercise}
                accent={theme.colors.primaryLine}
                canRemove={exercisesDraft.length > 1}
                onChange={(changes) =>
                  updateDraftExercise(exercise.id, changes)
                }
                onRemove={() => removeDraftExercise(exercise.id)}
                onCollapse={() => setEditingExerciseId(null)}
              />
            ) : (
              <ExerciseSummaryRow
                key={exercise.id}
                exercise={exercise}
                canRemove={exercisesDraft.length > 1}
                onEdit={() => setEditingExerciseId(exercise.id)}
                onRemove={() => removeDraftExercise(exercise.id)}
              />
            );
          })}

          <Pressable
            style={({ pressed }) => [
              styles.addExerciseButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={addDraftExercise}
          >
            <MaterialCommunityIcons
              name="plus-circle-outline"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.addExerciseText}>{t('Añadir ejercicio')}</Text>
          </Pressable>
        </ScrollView>
      </AppModal>

      <AppModal
        visible={showInfoModal}
        onRequestClose={() => setShowInfoModal(false)}
        title={t('Editar rutina')}
        icon="pencil"
        align="left"
        footer={
          <View style={styles.modalButtonRow}>
            <Button
              title={t('Cancelar')}
              onPress={() => setShowInfoModal(false)}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            <Button
              title={t('Guardar')}
              onPress={handleSaveInfo}
              variant="primary"
              disabled={!nameInput.trim()}
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
        <Text style={styles.fieldLabel}>{t('Nombre:')}</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={t('Nombre de la rutina')}
          placeholderTextColor={theme.colors.textSecondary}
          value={nameInput}
          onChangeText={setNameInput}
          maxLength={40}
        />
        <Text style={styles.fieldLabel}>{t('Descripción:')}</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={t('Descripción (opcional)')}
          placeholderTextColor={theme.colors.textSecondary}
          value={descriptionInput}
          onChangeText={setDescriptionInput}
          maxLength={80}
        />
      </AppModal>

      <AppModal
        visible={showTimerModal}
        onRequestClose={() => setShowTimerModal(false)}
        title={t('Editar Temporizador')}
        icon="timer-sand"
        align="left"
        footer={
          <View style={styles.modalButtonRow}>
            <Button
              title={t('Cancelar')}
              onPress={() => setShowTimerModal(false)}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            <Button
              title={t('Guardar')}
              onPress={handleSaveTimer}
              variant="primary"
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
        <Text style={styles.fieldLabel}>{t('Duración en segundos:')}</Text>
        <TextInput
          style={styles.fieldInput}
          keyboardType="number-pad"
          placeholder="150"
          placeholderTextColor={theme.colors.textSecondary}
          value={timerInput}
          onChangeText={setTimerInput}
        />
        <Text style={styles.timerModalFormat}>
          {t('Equivalente:')} {formatTime(parseInt(timerInput, 10) || 0)}
        </Text>
      </AppModal>

      <AppModal
        visible={showQrModal}
        onRequestClose={() => setShowQrModal(false)}
        title={t('Compartir rutina')}
        icon="qrcode"
        message={t(
          'Escanea este código con la cámara de otro móvil para cargar «{name}».',
          {
            name: getDisplayDayName(currentRoutine.name) || currentRoutine.name,
          }
        )}
        footer={
          <Button
            title={t('Cerrar')}
            onPress={() => setShowQrModal(false)}
            variant="secondary"
            size="medium"
          />
        }
      >
        <View style={styles.qrCanvas}>
          <QRCode
            value={shareLink}
            size={232}
            backgroundColor="#FFFFFF"
            color="#000000"
          />
        </View>
      </AppModal>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
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
  // Cabecera de la rutina: banner con fondo dorado tenue, insignia e "eyebrow".
  // Deliberadamente distinto de las tarjetas de día (que son transparentes con
  // borde izquierdo de acento) para que no se lea como un día más.
  infoBlock: {
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
    padding: theme.spacing.md,
    marginBottom: 16,
    gap: 10,
  },
  infoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoBadge: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
  },
  infoTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  infoEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.primary,
    marginBottom: 2,
  },
  infoName: {
    fontSize: 22,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.3,
    color: theme.colors.text,
    lineHeight: 27,
  },
  infoEditChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.textSecondary,
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
  // El icono del día es su propio botón (se toca el icono para cambiarlo), con
  // un micro-badge de lápiz que lo delata como editable.
  dayIconButton: {
    marginRight: 10,
    paddingTop: 2,
  },
  dayIconEditBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryFill,
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
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
  },
  fieldLabel: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.inputBg,
  },
  // Editor de ejercicios: la lista scrollea dentro de la tarjeta del modal.
  exercisesEditorScroll: {
    marginTop: 12,
    maxHeight: 380,
  },
  exercisesEditor: {
    gap: 10,
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.primaryLine,
    backgroundColor: theme.colors.surfaceAlt,
  },
  addExerciseText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  iconButton: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputBg,
    alignItems: 'center',
    gap: 6,
  },
  iconButtonActive: {
    borderColor: theme.colors.primaryLine,
    backgroundColor: theme.colors.primary + '1A',
  },
  iconButtonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  timerBlock: {
    // Relleno dorado (lleva tinta onGold): va con el oro de superficie.
    backgroundColor: theme.colors.primaryFillDark,
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
    color: theme.colors.onGold,
  },
  timerBlockValue: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.onGold,
    marginBottom: 4,
  },
  timerBlockHint: {
    fontSize: 12,
    color: theme.colors.onGold,
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
  qrCanvas: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
  },
  timerModalFormat: {
    marginTop: 8,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
