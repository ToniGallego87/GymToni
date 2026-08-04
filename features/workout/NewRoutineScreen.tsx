import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppModal,
  Button,
  ExerciseFormRow,
  ExerciseSummaryRow,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GradientCtaButton,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  GymIcon,
  GymIconGrid,
  GYM_ICON_LABELS,
  detectGymIcon,
  Toast,
  StretchScrollView,
} from '../../components';
import type { GymIconName } from '../../components';
import { generateId } from '@lib/utils';
import {
  buildExercisesFromText,
  buildWorkoutExercises,
  createEmptyExercise,
  ExerciseForm,
  parseImportedExercise,
} from '@lib/exerciseForm';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { stripIconTag } from '@lib/routineShare';
import { WorkoutDay, WorkoutRoutine } from '../../types';

interface NewRoutineScreenProps {
  existingRoutineCount: number;
  onCreateRoutine: (routine: WorkoutRoutine) => void;
  onBack: () => void;
  // Abre el escáner de QR para importar una rutina compartida.
  onScanRoutineQR?: () => void;
  // Días con los que arrancar el formulario (importación por QR/deep link).
  initialDays?: { title: string; exercisesText: string; icon?: GymIconName }[];
}

interface NewRoutineDayForm {
  id: string;
  title: string;
  exercises: ExerciseForm[];
  // Icono elegido a mano. Si es undefined, se autodetecta por el título; si no
  // se puede detectar, la creación obliga a elegirlo.
  icon?: GymIconName;
}

// Icono efectivo de un día en el formulario: el elegido a mano o, si no, el
// autodetectado por el título. null si aún no se puede determinar.
function effectiveDayIcon(day: NewRoutineDayForm): GymIconName | null {
  return day.icon ?? detectGymIcon(day.title);
}

// Parsea una rutina completa en texto: cada día es un bloque separado por línea en
// blanco; la primera línea del bloque es el nombre del día y el resto, ejercicios.
function buildDaysFromRoutineText(text: string): NewRoutineDayForm[] {
  return text
    .replace(/\r/g, '')
    .split(/\n\s*\n+/)
    .map((block) =>
      block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    )
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const [titleLine, ...rest] = lines;
      const { title, icon } = stripIconTag(titleLine);
      const exercises = rest.map(parseImportedExercise);
      return {
        id: generateId(),
        title,
        icon,
        exercises: exercises.length ? exercises : [createEmptyExercise()],
      };
    });
}

export function NewRoutineScreen({
  existingRoutineCount,
  onCreateRoutine,
  onBack,
  onScanRoutineQR,
  initialDays,
}: NewRoutineScreenProps) {
  const insets = useSafeAreaInsets();
  // Nombre y descripción de la rutina. Si se dejan vacíos se generan como antes
  // ("Rutina N" / "Rutina personalizada (N días)").
  const [routineName, setRoutineName] = useState('');
  const [routineDescription, setRoutineDescription] = useState('');
  const [days, setDays] = useState<NewRoutineDayForm[]>(() =>
    initialDays && initialDays.length
      ? initialDays.map((day) => ({
          id: generateId(),
          title: day.title,
          icon: day.icon,
          exercises: buildExercisesFromText(day.exercisesText),
        }))
      : [{ id: generateId(), title: '', exercises: [createEmptyExercise()] }]
  );
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  // Ejercicio con el editor abierto; el resto se muestran colapsados si tienen nombre.
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null
  );
  // Día cuyo selector de icono está abierto.
  const [iconPickerDayId, setIconPickerDayId] = useState<string | null>(null);

  const handleImportText = () => {
    const parsed = buildDaysFromRoutineText(importText);
    if (!parsed.length) {
      setToast({
        message: t('No se reconoció ninguna rutina en el texto'),
        type: 'error',
      });
      return;
    }
    const limited = parsed.slice(0, 7);
    setDays(limited);
    setShowImport(false);
    setImportText('');
    setToast({
      message: t(
        limited.length > 1 ? 'Importados {n} días' : 'Importado 1 día',
        {
          n: limited.length,
        }
      ),
      type: 'success',
    });
  };
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding =
    floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  const isDayComplete = (day: NewRoutineDayForm) =>
    !!day.title.trim() && day.exercises.some((ex) => ex.name.trim());

  const canAddNewDay = useMemo(() => days.every(isDayComplete), [days]);
  const canRemoveDay = days.length > 1;
  const canAddMoreDays = canAddNewDay && days.length < 7;

  const updateDay = (
    dayId: string,
    updater: (day: NewRoutineDayForm) => NewRoutineDayForm
  ) => {
    setDays((previous) =>
      previous.map((day) => (day.id === dayId ? updater(day) : day))
    );
  };

  const handleUpdateTitle = (dayId: string, value: string) => {
    updateDay(dayId, (day) => ({ ...day, title: value }));
  };

  const handleSelectIcon = (dayId: string, icon: GymIconName) => {
    updateDay(dayId, (day) => ({ ...day, icon }));
    setIconPickerDayId(null);
  };

  const handleUpdateExercise = (
    dayId: string,
    exerciseId: string,
    changes: Partial<ExerciseForm>
  ) => {
    updateDay(dayId, (day) => ({
      ...day,
      exercises: day.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, ...changes } : ex
      ),
    }));
  };

  const handleAddExercise = (dayId: string) => {
    const exercise = createEmptyExercise();
    updateDay(dayId, (day) => ({
      ...day,
      exercises: [...day.exercises, exercise],
    }));
    setEditingExerciseId(exercise.id);
  };

  const handleRemoveExercise = (dayId: string, exerciseId: string) => {
    updateDay(dayId, (day) =>
      day.exercises.length <= 1
        ? day
        : {
            ...day,
            exercises: day.exercises.filter((ex) => ex.id !== exerciseId),
          }
    );
  };

  const handleAddDay = () => {
    if (days.length >= 7) {
      setToast({ message: t('Máximo 7 días'), type: 'error' });
      return;
    }

    setDays((previous) => [
      ...previous,
      { id: generateId(), title: '', exercises: [createEmptyExercise()] },
    ]);
  };

  const handleRemoveDay = (dayId: string) => {
    setDays((previous) =>
      previous.length <= 1
        ? previous
        : previous.filter((day) => day.id !== dayId)
    );
  };

  // Reordena un día dentro de la rutina. El número visible ("Día N") se deriva
  // del índice al construir la rutina (ver buildRoutineDays), así que basta con
  // mover la entrada de sitio.
  const handleMoveDay = (dayId: string, direction: -1 | 1) => {
    setDays((previous) => {
      const index = previous.findIndex((day) => day.id === dayId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= previous.length) {
        return previous;
      }
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const buildRoutineDays = (): WorkoutDay[] => {
    if (!days.length) {
      throw new Error(t('Añade al menos un día'));
    }

    return days.map((entry, index) => {
      const dayTitle = entry.title.trim();
      if (!dayTitle) {
        throw new Error(t('Falta el título del Día {n}', { n: index + 1 }));
      }

      const exercises = buildWorkoutExercises(entry.exercises);
      if (!exercises.length) {
        throw new Error(t('Faltan ejercicios en el Día {n}', { n: index + 1 }));
      }

      const icon = effectiveDayIcon(entry);
      if (!icon) {
        throw new Error(t('Elige un icono para el Día {n}', { n: index + 1 }));
      }

      return {
        id: generateId(),
        dayNumber: index + 1,
        name: `${t('Día')} ${index + 1} - ${dayTitle}`,
        // `emoji` guarda ahora el nombre del icono (ver GymIcon/DayAccentIcon).
        emoji: icon,
        exercises,
      };
    });
  };

  const handleCreate = () => {
    try {
      const builtDays = buildRoutineDays();

      onCreateRoutine({
        id: generateId(),
        name:
          routineName.trim() || `${t('Rutina')} ${existingRoutineCount + 1}`,
        description:
          routineDescription.trim() ||
          t('Rutina personalizada ({n} días)', { n: builtDays.length }),
        // La rutina nueva queda "preparada", no activa: el reducer (ADD_ROUTINE
        // + syncActiveRoutine) mantiene la activa actual hasta que se registre
        // el primer entrenamiento en esta.
        isActive: false,
        createdAt: Date.now(),
        days: builtDays,
      });

      setToast({ message: t('Nueva rutina creada'), type: 'success' });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('No se pudo crear la rutina');
      setToast({ message, type: 'error' });
    }
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
        {/* Vías de partida alternativas al formulario manual: se ofrecen ARRIBA
            (antes colgaban debajo del CTA "Crear rutina", como si fueran un paso
            posterior). Quien ya tiene la rutina en otro sitio la trae de una. */}
        <View style={styles.importGroup}>
          <Text style={styles.importGroupLabel}>
            {t('¿Ya tienes la rutina en otro sitio?')}
          </Text>
          {onScanRoutineQR && (
            <Pressable
              style={({ pressed }) => [
                styles.qrButton,
                pressed && styles.qrButtonPressed,
              ]}
              onPress={onScanRoutineQR}
            >
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.qrButtonText}>
                {t('Crear a partir de QR')}
              </Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.qrButton,
              pressed && styles.qrButtonPressed,
            ]}
            onPress={() => setShowImport(true)}
          >
            <MaterialCommunityIcons
              name="text-box-plus-outline"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.qrButtonText}>
              {t('Crear a partir de texto plano')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.manualDivider}>
          <View style={styles.manualDividerLine} />
          <Text style={styles.manualDividerText}>{t('o créala a mano')}</Text>
          <View style={styles.manualDividerLine} />
        </View>

        <View
          style={[styles.dayCard, { borderLeftColor: theme.colors.accentLine }]}
        >
          <GradientFill accent={theme.colors.accentLine} />
          <Text style={styles.dayTitleDisplay}>{t('Rutina')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('Nombre (ej: Rutina {n})', {
                n: existingRoutineCount + 1,
              })}
              placeholderTextColor={theme.colors.textSecondary}
              value={routineName}
              onChangeText={setRoutineName}
              maxLength={40}
            />
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('Descripción (opcional)')}
              placeholderTextColor={theme.colors.textSecondary}
              value={routineDescription}
              onChangeText={setRoutineDescription}
              maxLength={80}
            />
          </View>
        </View>

        {days.map((day, index) => {
          const accent = theme.colors.accentLine;
          const dayIcon = effectiveDayIcon(day);

          return (
            <View
              key={day.id}
              style={[styles.dayCard, { borderLeftColor: accent }]}
            >
              <GradientFill accent={accent} />

              {/* Línea 1: título del día + selector de icono, cada uno con su
                  espacio. Reordenar/borrar va en su propia fila debajo, para no
                  amontonar cuatro clusters de controles en una sola línea. */}
              <View style={styles.dayHeaderRow}>
                <Text style={styles.dayTitleDisplay}>
                  {t('Día')} {index + 1}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.dayIconPick,
                    !dayIcon && styles.dayIconPickEmpty,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setIconPickerDayId(day.id)}
                >
                  {dayIcon ? (
                    <>
                      <GymIcon
                        name={dayIcon}
                        size={18}
                        color={theme.colors.white}
                      />
                      <Text style={styles.dayIconPickText}>
                        {t(GYM_ICON_LABELS[dayIcon])}
                      </Text>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="help-circle-outline"
                        size={18}
                        color={theme.colors.primary}
                      />
                      <Text
                        style={[
                          styles.dayIconPickText,
                          { color: theme.colors.primary },
                        ]}
                      >
                        {t('Elegir icono')}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <View style={styles.dayReorderRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.dayReorderButton,
                    index === 0 && styles.dayReorderButtonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handleMoveDay(day.id, -1)}
                  disabled={index === 0}
                  hitSlop={6}
                  accessibilityLabel={t('Subir día')}
                >
                  <MaterialCommunityIcons
                    name="chevron-up"
                    size={18}
                    color={
                      index === 0
                        ? theme.colors.textSecondary
                        : theme.colors.text
                    }
                  />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.dayReorderButton,
                    index === days.length - 1 &&
                      styles.dayReorderButtonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handleMoveDay(day.id, 1)}
                  disabled={index === days.length - 1}
                  hitSlop={6}
                  accessibilityLabel={t('Bajar día')}
                >
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={18}
                    color={
                      index === days.length - 1
                        ? theme.colors.textSecondary
                        : theme.colors.text
                    }
                  />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.dayReorderButton,
                    !canRemoveDay && styles.dayReorderButtonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handleRemoveDay(day.id)}
                  disabled={!canRemoveDay}
                  hitSlop={6}
                  accessibilityLabel={t('Quitar día')}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={17}
                    color={
                      canRemoveDay
                        ? theme.colors.error
                        : theme.colors.textSecondary
                    }
                  />
                </Pressable>
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={t('Ej: Push pesado')}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={day.title}
                  onChangeText={(value) => handleUpdateTitle(day.id, value)}
                />
              </View>

              <Text style={styles.label}>{t('Ejercicios')}</Text>

              {day.exercises.map((exercise) => {
                const expanded =
                  editingExerciseId === exercise.id || !exercise.name.trim();

                return expanded ? (
                  <ExerciseFormRow
                    key={exercise.id}
                    exercise={exercise}
                    accent={accent}
                    canRemove={day.exercises.length > 1}
                    onChange={(changes) =>
                      handleUpdateExercise(day.id, exercise.id, changes)
                    }
                    onRemove={() => handleRemoveExercise(day.id, exercise.id)}
                    onCollapse={() => setEditingExerciseId(null)}
                  />
                ) : (
                  <ExerciseSummaryRow
                    key={exercise.id}
                    exercise={exercise}
                    canRemove={day.exercises.length > 1}
                    onEdit={() => setEditingExerciseId(exercise.id)}
                    onRemove={() => handleRemoveExercise(day.id, exercise.id)}
                  />
                );
              })}

              <Pressable
                style={({ pressed }) => [
                  styles.addExerciseButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handleAddExercise(day.id)}
              >
                <MaterialCommunityIcons
                  name="plus-circle-outline"
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={styles.addExerciseText}>
                  {t('Añadir ejercicio')}
                </Text>
              </Pressable>
            </View>
          );
        })}

        <View style={styles.rowButtons}>
          <Pressable
            style={[styles.dayChip, !canAddMoreDays && styles.dayChipDisabled]}
            onPress={handleAddDay}
            disabled={!canAddMoreDays}
          >
            <MaterialCommunityIcons
              name="plus-thick"
              size={16}
              color={
                canAddMoreDays
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              }
            />
            <Text
              style={[
                styles.dayChipText,
                !canAddMoreDays && styles.dayChipTextDisabled,
              ]}
            >
              {t('Añadir día')}
            </Text>
          </Pressable>
        </View>

        <GradientCtaButton
          icon="check-bold"
          title={t('Crear rutina')}
          onPress={handleCreate}
          style={styles.createButton}
        />
      </StretchScrollView>

      <GlassTopBar
        title={t('Nueva rutina')}
        icon="playlist-plus"
        subtitle={t('Define los ejercicios que realizarás cada día')}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      <AppModal
        visible={showImport}
        onRequestClose={() => setShowImport(false)}
        title={t('Crear a partir de texto plano')}
        icon="text-box-plus-outline"
        align="left"
        message={t(
          'Un día por bloque (sepáralos con una línea en blanco). La primera línea es el nombre del día; debajo, un ejercicio por línea. Añade una "s" tras las reps para marcar segundos (ej: Plancha 3x30s).'
        )}
        footer={
          <View style={styles.modalButtons}>
            <Button
              title={t('Cancelar')}
              onPress={() => setShowImport(false)}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            <Button
              title={t('Importar')}
              onPress={handleImportText}
              variant="primary"
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
        <TextInput
          style={styles.modalTextarea}
          multiline
          textAlignVertical="top"
          placeholder={
            'Push\nPress banca 4x6-8\nPress militar 3x8-10\n\nPull\nDominadas 4x8\nRemo 4x10-12'
          }
          placeholderTextColor={theme.colors.textSecondary}
          value={importText}
          onChangeText={setImportText}
        />
      </AppModal>

      <AppModal
        visible={iconPickerDayId !== null}
        onRequestClose={() => setIconPickerDayId(null)}
        title={t('Selecciona un icono para este día')}
        icon="shape-outline"
        footer={
          <Button
            title={t('Cerrar')}
            onPress={() => setIconPickerDayId(null)}
            variant="secondary"
            size="medium"
          />
        }
      >
        <GymIconGrid
          style={styles.iconGrid}
          activeIcon={(() => {
            const day = days.find((d) => d.id === iconPickerDayId);
            return day ? effectiveDayIcon(day) : null;
          })()}
          onSelect={(iconName) =>
            iconPickerDayId && handleSelectIcon(iconPickerDayId, iconName)
          }
        />
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
      gap: 12,
    },
    dayCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderTopColor: theme.colors.border,
      borderRightColor: theme.colors.border,
      borderBottomColor: theme.colors.border,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primaryLine,
      padding: theme.spacing.md,
      gap: 10,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    dayHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    dayReorderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
    dayReorderButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dayReorderButtonDisabled: {
      opacity: 0.4,
    },
    dayTitleDisplay: {
      fontSize: 21,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.5,
      color: theme.colors.text,
      lineHeight: 30,
    },
    dayIconPick: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBg,
    },
    dayIconPickEmpty: {
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.primary + '1A',
    },
    dayIconPickText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      lineHeight: 18,
    },
    inputRow: {
      flexDirection: 'row',
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: theme.colors.text,
      fontSize: 15,
      lineHeight: 20,
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
    buttonPressed: {
      opacity: 0.85,
    },
    rowButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    dayChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.surface,
    },
    dayChipDisabled: {
      borderColor: theme.colors.border,
      opacity: 0.5,
    },
    dayChipText: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.primary,
      lineHeight: 18,
    },
    dayChipTextDisabled: {
      color: theme.colors.textSecondary,
    },
    createButton: {
      marginTop: 4,
    },
    importGroup: {
      gap: 8,
    },
    importGroupLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    manualDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginVertical: 2,
    },
    manualDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    manualDividerText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    qrButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 4,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.surfaceAlt,
    },
    qrButtonPressed: {
      opacity: 0.9,
    },
    qrButtonText: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    modalTextarea: {
      marginTop: 12,
      minHeight: 180,
      maxHeight: 320,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    modalButton: {
      flex: 1,
      minWidth: 0,
    },
    iconGrid: {
      marginTop: 12,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
