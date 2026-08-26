import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppModal,
  Button,
  ConfirmModal,
  DayAccentIcon,
  ExerciseFormRow,
  ExerciseSummaryRow,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  GymIconGrid,
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
import { useSession } from '@lib/cloud/auth';
import { setRoutinePublic, getPublicRoutineIds } from '@lib/cloud/social';

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
  // Modo lectura por defecto: la pantalla es de CONSULTA. El andamiaje de
  // edición (reordenar, borrar, cambiar icono, editar ejercicios) solo aparece
  // al pulsar "Editar" en la barra. Nada se esconde tras gestos: entrar en
  // edición es un botón visible y en edición todas las acciones se ven.
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [dayToDeleteId, setDayToDeleteId] = useState<string | null>(null);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  // Día cuyos ejercicios se están editando INLINE (mismo modelo que "Nueva
  // rutina": filas estructuradas en la propia tarjeta, no un modal aparte).
  const [editingExercisesDayId, setEditingExercisesDayId] = useState<
    string | null
  >(null);
  const [exercisesDraft, setExercisesDraft] = useState<ExerciseForm[]>([]);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null
  );
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerInput, setTimerInput] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  // Estado de "rutina pública en la comunidad" (Fase 4). is_public vive solo en
  // la nube; se consulta al abrir si hay sesión.
  const { user } = useSession();
  const [isPublic, setIsPublic] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  // Obtener la rutina actualizada del estado
  const currentRoutine =
    state.routines.find((r) => r.id === routine.id) || routine;

  // Rutina cerrada: tiene entrenamientos y ya no es la activa (misma regla que
  // la tarjeta "Rutina Cerrada" de Inicio). No se permite editar su información.
  const isClosed =
    state.logs.some((log) => log.routineId === currentRoutine.id) &&
    currentRoutine.id !== state.activeRoutineId;

  const closeExercisesEditor = () => {
    setEditingExercisesDayId(null);
    setExercisesDraft([]);
    setEditingExerciseId(null);
  };

  // Al salir de edición, cerrar cualquier editor de ejercicios abierto (su
  // borrador se descarta: para conservar cambios está el botón "Guardar").
  const toggleEditing = () => {
    setIsEditing((prev) => {
      if (prev) closeExercisesEditor();
      return !prev;
    });
  };

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

  // Una rutina grande (muchos días/ejercicios) genera un enlace que no cabe en
  // un QR: `react-native-qrcode-svg` LANZA al renderizar (rompía la pantalla).
  // Con ecl "L" (máxima capacidad) el límite práctico ronda los 2900 chars; por
  // encima se ofrece solo el texto plano, que no tiene tope.
  const QR_MAX_CHARS = 2900;
  const qrTooBig = shareLink.length > QR_MAX_CHARS;

  // Consulta si esta rutina ya está publicada (solo con sesión).
  useEffect(() => {
    if (!user) {
      setIsPublic(false);
      return;
    }
    let active = true;
    getPublicRoutineIds(user.id)
      .then((ids) => {
        if (active) setIsPublic(ids.includes(routine.id));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id, routine.id]);

  // Publica/retira la rutina de la comunidad. is_public es un atributo de la nube
  // (el sync no lo pisa). Optimista: refleja al instante y revierte si falla.
  const handleTogglePublic = async () => {
    if (!user) {
      setToast({
        message: t('Inicia sesión en «Cuenta y nube» para compartir'),
        type: 'error',
      });
      return;
    }
    const next = !isPublic;
    setPublishing(true);
    setIsPublic(next);
    try {
      await setRoutinePublic(routine.id, next);
      setToast({
        message: next
          ? t('Rutina publicada en la comunidad')
          : t('Rutina retirada de la comunidad'),
        type: 'success',
      });
    } catch (e) {
      setIsPublic(!next);
      setToast({ message: (e as Error).message, type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

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
    if (!isEditing) return;
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
    setEditingExercisesDayId(dayId);
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

  // Reordena un ejercicio dentro del día. El id de cada fila viaja intacto (ver
  // buildWorkoutExercises), así que el historial sigue apuntando a su ejercicio:
  // los resultados pasados se muestran en la nueva posición, no se recalculan.
  const moveDraftExercise = (exerciseId: string, direction: -1 | 1) => {
    setExercisesDraft((previous) => {
      const index = previous.findIndex((ex) => ex.id === exerciseId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= previous.length) {
        return previous;
      }
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSaveExercises = () => {
    if (!editingExercisesDayId) return;

    const day = currentRoutine.days.find((d) => d.id === editingExercisesDayId);
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
        dayId: editingExercisesDayId,
        day: { ...day, exercises },
      },
    });

    closeExercisesEditor();
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

  // Renumera los días tras reordenar o borrar: `dayNumber` y el prefijo "Día N"
  // del nombre embeben el número (ver getDisplayDayName). El id de cada día no
  // cambia, así que los logs (que apuntan por `dayId`) siguen a su día.
  const renumberDays = (days: typeof currentRoutine.days) =>
    days.map((day, index) => {
      const title = getDisplayDayName(day.name);
      const number = index + 1;
      return {
        ...day,
        dayNumber: number,
        name: title
          ? `${t('Día')} ${number} - ${title}`
          : `${t('Día')} ${number}`,
      };
    });

  const handleMoveDay = (dayId: string, direction: -1 | 1) => {
    const index = currentRoutine.days.findIndex((d) => d.id === dayId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= currentRoutine.days.length) {
      return;
    }
    const next = [...currentRoutine.days];
    [next[index], next[target]] = [next[target], next[index]];
    dispatch({
      type: 'UPDATE_ROUTINE',
      payload: { ...currentRoutine, days: renumberDays(next) },
    });
  };

  const dayToDelete = currentRoutine.days.find((d) => d.id === dayToDeleteId);
  // ¿El día por borrar tiene entrenamientos? Su historial quedaría huérfano (los
  // logs apuntan por `dayId`), así que se avisa en la confirmación.
  const dayToDeleteHasLogs =
    !!dayToDeleteId && state.logs.some((log) => log.dayId === dayToDeleteId);

  const handleDeleteDay = () => {
    if (!dayToDeleteId || currentRoutine.days.length <= 1) {
      setDayToDeleteId(null);
      return;
    }
    const next = currentRoutine.days.filter((d) => d.id !== dayToDeleteId);
    dispatch({
      type: 'UPDATE_ROUTINE',
      payload: { ...currentRoutine, days: renumberDays(next) },
    });
    setDayToDeleteId(null);
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
        {/* Cabecera de la rutina. Solo es pulsable (editar nombre/descripción)
            en modo edición; en lectura es un banner de identidad. */}
        <Pressable
          style={styles.infoBlock}
          onPress={handleOpenInfoModal}
          disabled={!isEditing || isClosed}
        >
          <View style={styles.infoTopRow}>
            <View style={styles.infoBadge}>
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={22}
                color={theme.colors.onGold}
              />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoEyebrow}>{t('Rutina')}</Text>
              <Text style={styles.infoName}>{currentRoutine.name}</Text>
            </View>
            {isEditing && (
              <View
                style={[
                  styles.infoEditChip,
                  !isClosed && styles.infoEditChipEditable,
                ]}
              >
                <MaterialCommunityIcons
                  name={isClosed ? 'lock-outline' : 'pencil'}
                  size={16}
                  color={
                    isClosed ? theme.colors.textSecondary : theme.colors.onGold
                  }
                />
              </View>
            )}
          </View>
          {!!currentRoutine.description && (
            <Text style={styles.infoDescription}>
              {currentRoutine.description}
            </Text>
          )}
        </Pressable>

        {currentRoutine.days.map((day, index) => {
          const accent = getTrainingAccent(day);
          const isFirst = index === 0;
          const isLast = index === currentRoutine.days.length - 1;
          const canDeleteDay = currentRoutine.days.length > 1;
          const isEditingThisDay = editingExercisesDayId === day.id;

          return (
            <View
              key={day.id}
              style={[styles.dayBlock, { borderColor: accent }]}
            >
              <GradientFill accent={accent} />
              <View style={styles.dayHeader}>
                <View style={styles.dayHeaderLeft}>
                  {/* En edición el icono es su propio botón (se toca para
                      cambiarlo, con micro-badge de lápiz). En lectura es solo
                      la marca del día. */}
                  {isEditing ? (
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
                  ) : (
                    <View style={styles.dayIconButton}>
                      <DayAccentIcon
                        emoji={day.emoji}
                        name={day.name}
                        size={32}
                      />
                    </View>
                  )}
                  <Text style={styles.dayName}>
                    {getDisplayDayName(day.name)}
                  </Text>
                </View>
                <Text style={styles.dayBadge}>
                  {t('Día')} {day.dayNumber}
                </Text>
              </View>

              {/* Controles de reordenar/borrar el día: solo en edición, con su
                  propio botón visible cada uno. */}
              {isEditing && (
                <View style={styles.dayControlsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.dayControlButton,
                      isFirst && styles.dayControlButtonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => handleMoveDay(day.id, -1)}
                    disabled={isFirst}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('Subir día')}
                  >
                    <MaterialCommunityIcons
                      name="chevron-up"
                      size={20}
                      color={
                        isFirst ? theme.colors.textSecondary : theme.colors.text
                      }
                    />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.dayControlButton,
                      isLast && styles.dayControlButtonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => handleMoveDay(day.id, 1)}
                    disabled={isLast}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('Bajar día')}
                  >
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={
                        isLast ? theme.colors.textSecondary : theme.colors.text
                      }
                    />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.dayControlButton,
                      !canDeleteDay && styles.dayControlButtonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => setDayToDeleteId(day.id)}
                    disabled={!canDeleteDay}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('Quitar día')}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={18}
                      color={
                        canDeleteDay
                          ? theme.colors.error
                          : theme.colors.textSecondary
                      }
                    />
                  </Pressable>
                </View>
              )}

              {isEditingThisDay ? (
                // Editor de ejercicios INLINE: mismas filas que "Nueva rutina",
                // sin modal ni scroll dentro de scroll.
                <View style={styles.exercisesEditor}>
                  {exercisesDraft.map((exercise, exIndex) => {
                    const expanded =
                      editingExerciseId === exercise.id ||
                      !exercise.name.trim();

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
                        onMoveUp={() => moveDraftExercise(exercise.id, -1)}
                        onMoveDown={() => moveDraftExercise(exercise.id, 1)}
                        canMoveUp={exIndex > 0}
                        canMoveDown={exIndex < exercisesDraft.length - 1}
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
                      color={theme.colors.onGold}
                    />
                    <Text style={styles.addExerciseText}>
                      {t('Añadir ejercicio')}
                    </Text>
                  </Pressable>

                  <View style={styles.modalButtonRow}>
                    <Button
                      title={t('Cancelar')}
                      onPress={closeExercisesEditor}
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
                </View>
              ) : (
                <>
                  <View style={styles.exerciseList}>
                    {day.exercises.map((exercise) => (
                      <View key={exercise.id} style={styles.exerciseRow}>
                        <View
                          style={[
                            styles.exerciseDot,
                            { backgroundColor: accent },
                          ]}
                        />
                        <Text style={styles.exerciseText}>
                          {exercise.name} — {exercise.targetSets || '-'}x
                          {exercise.targetReps || '-'}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {isEditing && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.editExercisesButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => handleEditExercises(day.id)}
                    >
                      <MaterialCommunityIcons
                        name="pencil"
                        size={16}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.editExercisesText}>
                        {t('Editar ejercicios')}
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          );
        })}

        {/* Temporizador de descanso: un ajuste, no un héroe. Compacto y
            editable solo en modo edición. */}
        <Pressable
          style={styles.settingRow}
          onPress={handleOpenTimerModal}
          disabled={!isEditing}
        >
          <MaterialCommunityIcons
            name="timer-sand"
            size={20}
            color={theme.colors.text}
          />
          <View style={styles.settingRowTextWrap}>
            <Text style={styles.settingRowLabel}>
              {t('Temporizador de descanso')}
            </Text>
            <Text style={styles.settingRowHint}>
              {formatTime(getTimerDurationSeconds())}
            </Text>
          </View>
          {isEditing && (
            <MaterialCommunityIcons
              name="pencil"
              size={18}
              color={theme.colors.textSecondary}
            />
          )}
        </Pressable>

        {/* Una sola acción de compartir: la hoja de dentro ofrece QR y texto. */}
        <Pressable
          style={({ pressed }) => [
            styles.settingRow,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setShowShareModal(true)}
        >
          <MaterialCommunityIcons
            name="share-variant"
            size={20}
            color={theme.colors.text}
          />
          <View style={styles.settingRowTextWrap}>
            <Text style={styles.settingRowLabel}>{t('Compartir rutina')}</Text>
            <Text style={styles.settingRowHint}>
              {t('Por QR o copiando el texto')}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={theme.colors.textSecondary}
          />
        </Pressable>

        {/* Publicar en la comunidad (tablón). is_public vive en la nube; requiere
            sesión. Es un interruptor visible, no un gesto oculto. */}
        <Pressable
          style={({ pressed }) => [
            styles.settingRow,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleTogglePublic}
          disabled={publishing}
        >
          <MaterialCommunityIcons
            name={isPublic ? 'earth' : 'earth-off'}
            size={20}
            color={isPublic ? theme.colors.success : theme.colors.text}
          />
          <View style={styles.settingRowTextWrap}>
            <Text style={styles.settingRowLabel}>
              {t('Compartir en la comunidad')}
            </Text>
            <Text style={styles.settingRowHint}>
              {!user
                ? t('Inicia sesión para compartir')
                : isPublic
                ? t('Pública · aparece en el tablón')
                : t('Privada · solo tú la ves')}
            </Text>
          </View>
          <Text style={[styles.publicPill, isPublic && styles.publicPillOn]}>
            {isPublic ? t('Pública') : t('Privada')}
          </Text>
        </Pressable>
      </StretchScrollView>

      <GlassTopBar
        title={t('Rutina')}
        icon="file-document-edit-outline"
        subtitle={currentRoutine.name}
        topInset={insets.top}
        rightElement={
          <Pressable
            style={({ pressed }) => [
              styles.editToggle,
              isEditing && styles.editToggleActive,
              pressed && styles.buttonPressed,
            ]}
            onPress={toggleEditing}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? t('Hecho') : t('Editar')}
          >
            <MaterialCommunityIcons
              name={isEditing ? 'check' : 'pencil'}
              size={16}
              color={isEditing ? theme.colors.onGold : theme.colors.primary}
            />
            <Text
              style={[
                styles.editToggleText,
                isEditing && styles.editToggleTextActive,
              ]}
            >
              {isEditing ? t('Hecho') : t('Editar')}
            </Text>
          </Pressable>
        }
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
        <GymIconGrid
          style={styles.iconGrid}
          activeIcon={(() => {
            const selectedDay = currentRoutine.days.find(
              (d) => d.id === selectedDayId
            );
            return selectedDay
              ? resolveDayIcon(selectedDay.emoji, selectedDay.name)
              : null;
          })()}
          onSelect={handleSelectEmoji}
        />
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
        visible={showShareModal}
        onRequestClose={() => setShowShareModal(false)}
        title={t('Compartir rutina')}
        icon="share-variant"
        message={
          qrTooBig
            ? t(
                'Esta rutina es demasiado grande para un código QR. Cópiala como texto para pegarla en «Crear a partir de texto plano».'
              )
            : t(
                'Escanea el QR con la cámara de otro móvil o copia la rutina como texto para pegarla en «Crear a partir de texto plano».'
              )
        }
        footer={
          <View style={styles.shareModalFooter}>
            <Button
              title={t('Copiar en texto plano')}
              onPress={handleCopyPlainText}
              variant="primary"
              size="medium"
            />
            <Button
              title={t('Cerrar')}
              onPress={() => setShowShareModal(false)}
              variant="secondary"
              size="medium"
            />
          </View>
        }
      >
        {qrTooBig ? (
          <View style={styles.qrTooBig}>
            <MaterialCommunityIcons
              name="qrcode-remove"
              size={40}
              color={theme.colors.textSecondary}
            />
          </View>
        ) : (
          <View style={styles.qrCanvas}>
            <QRCode
              value={shareLink}
              size={232}
              ecl="L"
              backgroundColor={theme.colors.qrLight}
              color={theme.colors.qrDark}
            />
          </View>
        )}
      </AppModal>

      <ConfirmModal
        visible={!!dayToDeleteId}
        icon="trash-can-outline"
        title={t('¿Eliminar el día?')}
        message={
          dayToDeleteHasLogs
            ? t(
                'Este día tiene entrenamientos registrados; su historial dejará de verse.'
              )
            : t('Se elimina «{name}» de la rutina y los días se renumeran.', {
                name: dayToDelete ? getDisplayDayName(dayToDelete.name) : '',
              })
        }
        confirmLabel={t('Eliminar')}
        onConfirm={handleDeleteDay}
        onCancel={() => setDayToDeleteId(null)}
      />

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

const makeStyles = () =>
  StyleSheet.create({
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
    // Toggle lectura/edición en la barra superior. Editable = oro vivo con
    // tinta oscura (activo); lectura = superficie con borde y tinta dorada.
    editToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      height: 34,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
    },
    editToggleActive: {
      backgroundColor: theme.colors.primaryFill,
      borderColor: theme.colors.primaryFillDark,
    },
    editToggleText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.primary,
      lineHeight: 16,
    },
    editToggleTextActive: {
      color: theme.colors.onGold,
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
    // Insignia y eyebrow de la rutina en oro vivo con tinta oscura (como el
    // selector Fuerza/Cardio): el amarillo brillante solo lee como relleno.
    infoBadge: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryFill,
      borderWidth: 1,
      borderColor: theme.colors.primaryFillDark,
    },
    infoTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    infoEyebrow: {
      alignSelf: 'flex-start',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.onGold,
      backgroundColor: theme.colors.primaryFill,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.sm,
      overflow: 'hidden',
      marginBottom: 4,
    },
    infoName: {
      fontSize: 22,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 31,
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
    // Editable = oro vivo con tinta oscura; bloqueada se queda neutra (candado).
    infoEditChipEditable: {
      backgroundColor: theme.colors.primaryFill,
      borderColor: theme.colors.primaryFillDark,
    },
    infoDescription: {
      fontSize: 14,
      lineHeight: 19,
      color: theme.colors.textSecondary,
    },
    dayControlsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    dayControlButton: {
      width: 34,
      height: 34,
      borderRadius: theme.borderRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dayControlButtonDisabled: {
      opacity: 0.4,
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
      lineHeight: 28,
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
    // Botón de entrar al editor inline de ejercicios de un día (solo edición).
    editExercisesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.surfaceAlt,
    },
    editExercisesText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
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
    // Editor de ejercicios inline dentro de la tarjeta del día.
    exercisesEditor: {
      gap: 10,
      marginTop: 4,
    },
    addExerciseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primaryFillDark,
      backgroundColor: theme.colors.primaryFill,
    },
    addExerciseText: {
      color: theme.colors.onGold,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
    },
    iconGrid: {
      marginBottom: theme.spacing.sm,
    },
    buttonPressed: {
      opacity: 0.8,
    },
    // Fila de ajuste (temporizador, compartir): superficie con borde, discreta.
    settingRow: {
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
    settingRowTextWrap: {
      flex: 1,
    },
    settingRowLabel: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 20,
    },
    settingRowHint: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 17,
    },
    // Pastilla de estado público/privado a la derecha de la fila de comunidad.
    publicPill: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.borderRadius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
      overflow: 'hidden',
      lineHeight: 16,
    },
    publicPillOn: {
      color: theme.colors.onGold,
      backgroundColor: theme.colors.success,
    },
    shareModalFooter: {
      gap: 10,
    },
    qrCanvas: {
      alignSelf: 'center',
      backgroundColor: theme.colors.qrLight,
      padding: 16,
      borderRadius: theme.borderRadius.md,
      marginTop: theme.spacing.md,
    },
    qrTooBig: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.lg,
      marginTop: theme.spacing.sm,
    },
    timerModalFormat: {
      marginTop: 8,
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
