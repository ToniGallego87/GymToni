import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  Toast,
  StretchScrollView,
} from '../../components';
import { generateId } from '@lib/storage';
import { theme, getTrainingAccent } from '@lib/theme';
import { WorkoutDay, WorkoutExercise, WorkoutRoutine } from '../../types';

interface NewRoutineScreenProps {
  existingRoutineCount: number;
  onCreateRoutine: (routine: WorkoutRoutine) => void;
  onBack: () => void;
  // Abre el escáner de QR para importar una rutina compartida.
  onScanRoutineQR?: () => void;
  // Días con los que arrancar el formulario (importación por QR/deep link).
  initialDays?: { title: string; exercisesText: string }[];
}

type RepUnit = 'reps' | 'seg';

interface ExerciseForm {
  id: string;
  name: string;
  sets: number;
  // Reps/segundos como texto corto: admite rangos ("6-8") y matices ("10-12/lado").
  reps: string;
  unit: RepUnit;
}

interface NewRoutineDayForm {
  id: string;
  title: string;
  exercises: ExerciseForm[];
}

const EXTRA_EMOJIS = ['🟡', '🟣', '🟠', '⚪'];
const MIN_SETS = 1;
const MAX_SETS = 12;

// Acento por tipo de día, coherente con getTrainingAccent (Inicio).
const TYPE_ACCENT: Record<string, string> = {
  push: theme.colors.emoji_blue,
  pull: theme.colors.error,
  legs: theme.colors.emoji_green,
  mixed: theme.colors.primary,
};

function getNormalizedDayType(value: string) {
  const normalized = value.trim().toLowerCase();

  if (/push|pecho|hombro|tr[ií]ceps/.test(normalized)) return 'push';
  if (/pull|espalda|b[ií]ceps/.test(normalized)) return 'pull';
  if (/pierna|legs?|cu[aá]driceps|femoral|gl[uú]teo/.test(normalized))
    return 'legs';
  if (/torso|upper/.test(normalized)) return 'mixed';

  return normalized;
}

function getEmojiForDayType(type: string, fallbackIndex: number) {
  if (type === 'push') return '🔵';
  if (type === 'pull') return '🔴';
  if (type === 'legs') return '🟢';
  if (type === 'mixed') return '🔵🔴';
  return EXTRA_EMOJIS[fallbackIndex % EXTRA_EMOJIS.length];
}

// Color y emoji en vivo para pintar la card mientras se escribe el título.
function getDayAccent(
  title: string,
  index: number
): { accent: string; emoji: string | null } {
  const trimmed = title.trim();
  if (!trimmed) return { accent: theme.colors.border, emoji: null };

  const type = getNormalizedDayType(trimmed);
  const emoji = getEmojiForDayType(type, index);
  const accent = TYPE_ACCENT[type] ?? getTrainingAccent({ emoji });
  return { accent, emoji };
}

// Formato con corchetes ("Press banca [4x6-8]").
const EXERCISE_LINE_REGEX = /^(.*?)\s*\[(\d+)\s*x\s*([^\]]+)\]\s*$/i;
// Formato plano: nombre + separador (raya o espacios) + [series x] reps. La reps
// admite rango ("6-8") y una "s" final opcional para segundos ("30s", "20-30s").
const EXERCISE_PLAIN_REGEX =
  /^(.+?)\s*(?:[—–]\s*|\s+)(?:(\d+)\s*[x×]\s*)?(\d+(?:-\d+)?\s*(?:s|seg|sec)?)\s*$/i;

function createEmptyExercise(): ExerciseForm {
  return { id: generateId(), name: '', sets: 3, reps: '10-12', unit: 'reps' };
}

// Construye una fila a partir de nombre + series + reps (string), detectando segundos.
function makeExercise(
  name: string,
  setsRaw: string,
  repsRaw: string
): ExerciseForm {
  const sets = Math.min(
    MAX_SETS,
    Math.max(MIN_SETS, parseInt(setsRaw, 10) || 3)
  );
  let reps = repsRaw.trim();
  let unit: RepUnit = 'reps';

  if (/(s|seg|sec)\b/i.test(reps)) {
    unit = 'seg';
    reps = reps.replace(/\s*(s|seg|sec)\b/i, '').trim();
  }

  return {
    id: generateId(),
    name: name.trim(),
    sets,
    reps: reps || '10',
    unit,
  };
}

// Convierte una línea importada en una fila estructurada. Acepta "Nombre [4x6-8]",
// "Nombre 4x6-8" o solo "Nombre".
function parseImportedExercise(line: string): ExerciseForm {
  const trimmed = line.trim();

  const bracket = trimmed.match(EXERCISE_LINE_REGEX);
  if (bracket) return makeExercise(bracket[1], bracket[2], bracket[3]);

  const plain = trimmed.match(EXERCISE_PLAIN_REGEX);
  if (plain && plain[3]) {
    const name = plain[1].replace(/[—–]\s*$/, '').trim();
    return makeExercise(name, plain[2] ?? '3', plain[3]);
  }

  return {
    id: generateId(),
    name: trimmed,
    sets: 3,
    reps: '10-12',
    unit: 'reps',
  };
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
      const [title, ...rest] = lines;
      const exercises = rest.map(parseImportedExercise);
      return {
        id: generateId(),
        title: title.trim(),
        exercises: exercises.length ? exercises : [createEmptyExercise()],
      };
    });
}

function buildExercisesFromText(exercisesText: string): ExerciseForm[] {
  const exercises = exercisesText
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseImportedExercise);

  return exercises.length ? exercises : [createEmptyExercise()];
}

// targetReps que entiende el resto de la app: añade la unidad de segundos.
function buildTargetReps(exercise: ExerciseForm): string {
  const reps = exercise.reps.trim() || (exercise.unit === 'seg' ? '30' : '10');
  return exercise.unit === 'seg' ? `${reps}s` : reps;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Botón principal estilo HeroCard (gradiente dorado), coherente con "Empezar entrenamiento".
function CreateRoutineButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.createWrapper, animatedStyle]}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
    >
      <LinearGradient
        colors={['#F9D85A', '#F7CC3D', '#E0B226']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.createGradient}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.createSheen}
          pointerEvents="none"
        />
        <MaterialCommunityIcons
          name="check-bold"
          size={22}
          color={theme.colors.darkGray}
        />
        <Text style={styles.createText}>Crear rutina</Text>
      </LinearGradient>
    </AnimatedPressable>
  );
}

// Editor estructurado de un ejercicio: nombre + stepper de series + reps/segundos.
function ExerciseRow({
  exercise,
  accent,
  canRemove,
  onChange,
  onRemove,
}: {
  exercise: ExerciseForm;
  accent: string;
  canRemove: boolean;
  onChange: (changes: Partial<ExerciseForm>) => void;
  onRemove: () => void;
}) {
  const adjustSets = (delta: number) => {
    const next = Math.min(MAX_SETS, Math.max(MIN_SETS, exercise.sets + delta));
    onChange({ sets: next });
  };

  return (
    <View style={styles.exerciseRow}>
      <View style={styles.exerciseNameRow}>
        <TextInput
          style={styles.exerciseNameInput}
          placeholder="Ej: Press banca"
          placeholderTextColor={theme.colors.textSecondary}
          value={exercise.name}
          onChangeText={(value) => onChange({ name: value })}
        />
        <Pressable
          style={({ pressed }) => [
            styles.removeExerciseButton,
            !canRemove && styles.controlDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={onRemove}
          disabled={!canRemove}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="close"
            size={18}
            color={canRemove ? theme.colors.error : theme.colors.textSecondary}
          />
        </Pressable>
      </View>

      <View style={styles.exerciseControlsRow}>
        <View style={styles.controlBlock}>
          <Text style={styles.controlLabel}>Series</Text>
          <View style={styles.stepper}>
            <Pressable
              style={({ pressed }) => [
                styles.stepperButton,
                exercise.sets <= MIN_SETS && styles.controlDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => adjustSets(-1)}
              disabled={exercise.sets <= MIN_SETS}
              hitSlop={6}
            >
              <MaterialCommunityIcons
                name="minus"
                size={18}
                color={theme.colors.text}
              />
            </Pressable>
            <Text style={styles.stepperValue}>{exercise.sets}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.stepperButton,
                exercise.sets >= MAX_SETS && styles.controlDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => adjustSets(1)}
              disabled={exercise.sets >= MAX_SETS}
              hitSlop={6}
            >
              <MaterialCommunityIcons
                name="plus"
                size={18}
                color={theme.colors.text}
              />
            </Pressable>
          </View>
        </View>

        <View style={[styles.controlBlock, styles.controlBlockGrow]}>
          <Text style={styles.controlLabel}>
            {exercise.unit === 'seg' ? 'Segundos' : 'Repeticiones'}
          </Text>
          <View style={styles.repsRow}>
            <TextInput
              style={styles.repsInput}
              placeholder={exercise.unit === 'seg' ? 'Ej: 30-45' : 'Ej: 10-12'}
              placeholderTextColor={theme.colors.textSecondary}
              value={exercise.reps}
              onChangeText={(value) => onChange({ reps: value })}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <View style={styles.unitToggle}>
              {(['reps', 'seg'] as RepUnit[]).map((unit) => {
                const active = exercise.unit === unit;
                return (
                  <Pressable
                    key={unit}
                    style={[
                      styles.unitOption,
                      active && [
                        styles.unitOptionActive,
                        { borderColor: accent },
                      ],
                    ]}
                    onPress={() => onChange({ unit })}
                  >
                    <Text
                      style={[
                        styles.unitOptionText,
                        active && [
                          styles.unitOptionTextActive,
                          { color: accent },
                        ],
                      ]}
                    >
                      {unit === 'reps' ? 'reps' : 'seg'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function NewRoutineScreen({
  existingRoutineCount,
  onCreateRoutine,
  onBack,
  onScanRoutineQR,
  initialDays,
}: NewRoutineScreenProps) {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<NewRoutineDayForm[]>(() =>
    initialDays && initialDays.length
      ? initialDays.map((day) => ({
          id: generateId(),
          title: day.title,
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

  const handleImportText = () => {
    const parsed = buildDaysFromRoutineText(importText);
    if (!parsed.length) {
      setToast({
        message: 'No se reconoció ninguna rutina en el texto',
        type: 'error',
      });
      return;
    }
    const limited = parsed.slice(0, 7);
    setDays(limited);
    setShowImport(false);
    setImportText('');
    setToast({
      message: `Importados ${limited.length} día${
        limited.length > 1 ? 's' : ''
      }`,
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
    updateDay(dayId, (day) => ({
      ...day,
      exercises: [...day.exercises, createEmptyExercise()],
    }));
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
      setToast({ message: 'Máximo 7 días', type: 'error' });
      return;
    }

    setDays((previous) => [
      ...previous,
      { id: generateId(), title: '', exercises: [createEmptyExercise()] },
    ]);
  };

  const handleRemoveDay = () => {
    setDays((previous) => previous.slice(0, -1));
  };

  const buildRoutineDays = (): WorkoutDay[] => {
    if (!days.length) {
      throw new Error('Añade al menos un día');
    }

    const typeOrder: string[] = [];

    return days.map((entry, index) => {
      const dayTitle = entry.title.trim();
      if (!dayTitle) {
        throw new Error(`Falta el título del Día ${index + 1}`);
      }

      const namedExercises = entry.exercises.filter((ex) => ex.name.trim());
      if (!namedExercises.length) {
        throw new Error(`Faltan ejercicios en el Día ${index + 1}`);
      }

      const dayType = getNormalizedDayType(dayTitle);
      if (!typeOrder.includes(dayType)) {
        typeOrder.push(dayType);
      }

      const exercises: WorkoutExercise[] = namedExercises.map(
        (ex, exerciseIndex) => ({
          id: generateId(),
          name: ex.name.trim(),
          order: exerciseIndex + 1,
          targetSets: ex.sets,
          targetReps: buildTargetReps(ex),
        })
      );

      return {
        id: generateId(),
        dayNumber: index + 1,
        name: `Día ${index + 1} - ${dayTitle}`,
        emoji: getEmojiForDayType(dayType, typeOrder.indexOf(dayType)),
        exercises,
      };
    });
  };

  const handleCreate = () => {
    try {
      const builtDays = buildRoutineDays();

      onCreateRoutine({
        id: generateId(),
        name: `Rutina ${existingRoutineCount + 1}`,
        description: `Rutina personalizada (${builtDays.length} días)`,
        isActive: true,
        createdAt: Date.now(),
        days: builtDays,
      });

      setToast({ message: 'Nueva rutina creada', type: 'success' });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo crear la rutina';
      setToast({ message, type: 'error' });
    }
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
        {days.map((day, index) => {
          const { accent } = getDayAccent(day.title, index);

          return (
            <View
              key={day.id}
              style={[styles.dayCard, { borderLeftColor: accent }]}
            >
              <GradientFill accent={day.title.trim() ? accent : undefined} />

              <View style={styles.dayHeaderRow}>
                <MaterialCommunityIcons
                  name="circle"
                  size={15}
                  color={accent}
                />
                <Text style={styles.dayTitleDisplay}>Día {index + 1}</Text>
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Push pesado"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={day.title}
                  onChangeText={(value) => handleUpdateTitle(day.id, value)}
                />
              </View>

              <Text style={styles.label}>Ejercicios</Text>

              {day.exercises.map((exercise) => (
                <ExerciseRow
                  key={exercise.id}
                  exercise={exercise}
                  accent={
                    accent === theme.colors.border
                      ? theme.colors.primary
                      : accent
                  }
                  canRemove={day.exercises.length > 1}
                  onChange={(changes) =>
                    handleUpdateExercise(day.id, exercise.id, changes)
                  }
                  onRemove={() => handleRemoveExercise(day.id, exercise.id)}
                />
              ))}

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
                <Text style={styles.addExerciseText}>Añadir ejercicio</Text>
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
              Añadir día
            </Text>
          </Pressable>

          <Pressable
            style={[styles.dayChip, !canRemoveDay && styles.dayChipDisabled]}
            onPress={handleRemoveDay}
            disabled={!canRemoveDay}
          >
            <MaterialCommunityIcons
              name="minus-thick"
              size={16}
              color={
                canRemoveDay ? theme.colors.primary : theme.colors.textSecondary
              }
            />
            <Text
              style={[
                styles.dayChipText,
                !canRemoveDay && styles.dayChipTextDisabled,
              ]}
            >
              Quitar día
            </Text>
          </Pressable>
        </View>

        <CreateRoutineButton onPress={handleCreate} />

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
            <Text style={styles.qrButtonText}>Crear a partir de QR</Text>
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
          <Text style={styles.qrButtonText}>Crear a partir de texto plano</Text>
        </Pressable>
      </StretchScrollView>

      <GlassTopBar
        title="Nueva rutina"
        titleElement={
          <View style={styles.topBarTitleRow}>
            <MaterialCommunityIcons
              name="playlist-plus"
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.topBarTitleText}>Nueva rutina</Text>
          </View>
        }
        subtitle="Define los ejercicios que realizarás cada día"
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      <Modal
        visible={showImport}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImport(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Crear a partir de texto plano</Text>
            <Text style={styles.modalHint}>
              Un día por bloque (sepáralos con una línea en blanco). La primera
              línea es el nombre del día; debajo, un ejercicio por línea. Añade
              una "s" tras las reps para marcar segundos (ej: Plancha 3x30s).
            </Text>
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
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalCancel,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowImport(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalConfirm,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleImportText}
              >
                <Text style={styles.modalConfirmText}>Importar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
    gap: 12,
  },
  dayCard: {
    backgroundColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    padding: theme.spacing.md,
    gap: 10,
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayTitleDisplay: {
    fontSize: 21,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.5,
    color: theme.colors.text,
    lineHeight: 26,
  },
  dayTypeEmoji: {
    fontSize: 15,
    lineHeight: 20,
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
    backgroundColor: theme.colors.darkGray,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  exerciseRow: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 12,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseNameInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.darkGray,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  removeExerciseButton: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  exerciseControlsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  controlBlock: {
    gap: 6,
  },
  controlBlockGrow: {
    flex: 1,
    minWidth: 0,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.darkGray,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stepperButton: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  repsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repsInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.darkGray,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 44,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.darkGray,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  unitOption: {
    paddingHorizontal: 12,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  unitOptionActive: {
    backgroundColor: theme.colors.surface,
  },
  unitOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  unitOptionTextActive: {
    color: theme.colors.primary,
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
    borderColor: theme.colors.primary,
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
  controlDisabled: {
    opacity: 0.4,
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
    borderColor: theme.colors.primary,
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
  createWrapper: {
    borderRadius: theme.borderRadius.lg,
    marginTop: 4,
    ...theme.shadow.card,
  },
  createGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  createSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  createText: {
    color: theme.colors.darkGray,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    letterSpacing: 0.5,
    lineHeight: 26,
    includeFontPadding: false,
    textAlignVertical: 'center',
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
    borderColor: theme.colors.primary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  modalHint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  modalTextarea: {
    minHeight: 180,
    maxHeight: 320,
    backgroundColor: theme.colors.darkGray,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  modalCancel: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  modalCancelText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  modalConfirm: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  modalConfirmText: {
    color: theme.colors.darkGray,
    fontWeight: '800',
    fontSize: 14,
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
});
