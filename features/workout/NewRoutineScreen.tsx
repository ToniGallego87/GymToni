import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
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
}

interface NewRoutineDayForm {
  id: string;
  title: string;
  exercisesText: string;
}

const EXTRA_EMOJIS = ['🟡', '🟣', '🟠', '⚪'];

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
  if (/pierna|legs?|cu[aá]driceps|femoral|gl[uú]teo/.test(normalized)) return 'legs';
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
function getDayAccent(title: string, index: number): { accent: string; emoji: string | null } {
  const trimmed = title.trim();
  if (!trimmed) return { accent: theme.colors.border, emoji: null };

  const type = getNormalizedDayType(trimmed);
  const emoji = getEmojiForDayType(type, index);
  const accent = TYPE_ACCENT[type] ?? getTrainingAccent({ emoji });
  return { accent, emoji };
}

const EXERCISE_LINE_REGEX = /^(.*?)\s*\[(\d+)\s*x\s*([^\]]+)\]\s*$/i;

// Previsualización de ejercicios: confirma que la sintaxis [4x6-8] se entendió.
function parseExercisePreview(text: string): { name: string; scheme: string }[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean)
    .map((line: string) => {
      const parsed = line.match(EXERCISE_LINE_REGEX);
      if (parsed) {
        return { name: parsed[1].trim() || 'Ejercicio', scheme: `${parsed[2]}×${parsed[3].trim()}` };
      }
      return { name: line, scheme: '3×10-12' };
    });
}

function parseExerciseLine(
  line: string,
  routineId: string,
  dayNumber: number,
  order: number
): WorkoutExercise {
  const parsed = line.match(EXERCISE_LINE_REGEX);

  if (parsed) {
    return {
      id: `${routineId}-d${dayNumber}-ex${order}`,
      name: parsed[1].trim(),
      order,
      targetSets: parseInt(parsed[2], 10),
      targetReps: parsed[3].trim(),
    };
  }

  return {
    id: `${routineId}-d${dayNumber}-ex${order}`,
    name: line.trim(),
    order,
    targetSets: 3,
    targetReps: '10-12',
  };
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
        <MaterialCommunityIcons name="check-bold" size={22} color={theme.colors.darkGray} />
        <Text style={styles.createText}>Crear rutina</Text>
      </LinearGradient>
    </AnimatedPressable>
  );
}

export function NewRoutineScreen({
  existingRoutineCount,
  onCreateRoutine,
  onBack,
}: NewRoutineScreenProps) {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<NewRoutineDayForm[]>([
    { id: generateId(), title: '', exercisesText: '' },
  ]);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom = Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding = floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  const canAddNewDay = useMemo(
    () => days.every((day: NewRoutineDayForm) => day.title.trim() && day.exercisesText.trim()),
    [days]
  );
  const canRemoveDay = days.length > 1;
  const canAddMoreDays = canAddNewDay && days.length < 7;

  const handleUpdateDay = (dayId: string, key: keyof NewRoutineDayForm, value: string) => {
    setDays((previous: NewRoutineDayForm[]) => previous.map((day: NewRoutineDayForm) => (
      day.id === dayId ? { ...day, [key]: value } : day
    )));
  };

  const handleAddDay = () => {
    if (days.length >= 7) {
      setToast({ message: 'Máximo 7 días', type: 'error' });
      return;
    }

    setDays((previous: NewRoutineDayForm[]) => ([
      ...previous,
      { id: generateId(), title: '', exercisesText: '' },
    ]));
  };

  const handleRemoveDay = () => {
    setDays((previous: NewRoutineDayForm[]) => previous.slice(0, -1));
  };

  const buildRoutineDays = (routineId: string): WorkoutDay[] => {
    if (!days.length) {
      throw new Error('Añade al menos un día');
    }

    const typeOrder: string[] = [];

    return days.map((entry: NewRoutineDayForm, index: number) => {
      const dayTitle = entry.title.trim();
      if (!dayTitle) {
        throw new Error(`Falta el título del Día ${index + 1}`);
      }

      const exerciseLines = entry.exercisesText
        .replace(/\r/g, '')
        .split('\n')
        .map((line: string) => line.trim())
        .filter(Boolean);

      if (!exerciseLines.length) {
        throw new Error(`Faltan ejercicios en el Día ${index + 1}`);
      }

      const dayType = getNormalizedDayType(dayTitle);
      if (!typeOrder.includes(dayType)) {
        typeOrder.push(dayType);
      }

      const exercises = exerciseLines.map((line: string, exerciseIndex: number) => (
        parseExerciseLine(line, routineId, index + 1, exerciseIndex + 1)
      ));

      return {
        id: `${routineId}-day${index + 1}`,
        dayNumber: index + 1,
        name: `Día ${index + 1} - ${dayTitle}`,
        emoji: getEmojiForDayType(dayType, typeOrder.indexOf(dayType)),
        exercises,
      };
    });
  };

  const handleCreate = () => {
    try {
      const routineId = `routine-${Date.now()}`;
      const builtDays = buildRoutineDays(routineId);

      onCreateRoutine({
        id: routineId,
        name: `Rutina ${existingRoutineCount + 1}`,
        description: `Rutina personalizada (${builtDays.length} días)`,
        isActive: true,
        isCustom: true,
        createdAt: Date.now(),
        days: builtDays,
      });

      setToast({ message: 'Nueva rutina creada', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear la rutina';
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
        {days.map((day: NewRoutineDayForm, index: number) => {
          const { accent, emoji } = getDayAccent(day.title, index);
          const preview = parseExercisePreview(day.exercisesText);

          return (
            <View key={day.id} style={[styles.dayCard, { borderLeftColor: accent }]}>
              <GradientFill accent={day.title.trim() ? accent : undefined} />

              <View style={styles.dayHeaderRow}>
                <MaterialCommunityIcons name="circle" size={15} color={accent} />
                <Text style={styles.dayTitleDisplay}>Día {index + 1}</Text>
                {!!emoji && <Text style={styles.dayTypeEmoji}>{emoji}</Text>}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Ej: Push pesado"
                placeholderTextColor={theme.colors.textSecondary}
                value={day.title}
                onChangeText={(value: string) => handleUpdateDay(day.id, 'title', value)}
              />

              <Text style={styles.label}>Ejercicios</Text>
              <TextInput
                style={styles.exercisesInput}
                placeholder={'Un ejercicio por línea\nOpcional: Press banca [4x6-8]'}
                placeholderTextColor={theme.colors.textSecondary}
                value={day.exercisesText}
                onChangeText={(value: string) => handleUpdateDay(day.id, 'exercisesText', value)}
                multiline
                textAlignVertical="top"
              />

              {preview.length > 0 && (
                <View style={styles.previewWrap}>
                  {preview.map((ex: { name: string; scheme: string }, exIndex: number) => (
                    <View key={exIndex} style={[styles.previewChip, { borderColor: accent }]}>
                      <Text style={styles.previewChipName} numberOfLines={1}>
                        {ex.name}
                      </Text>
                      <Text style={styles.previewChipScheme}>{ex.scheme}</Text>
                    </View>
                  ))}
                </View>
              )}
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
              color={canAddMoreDays ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.dayChipText, !canAddMoreDays && styles.dayChipTextDisabled]}>
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
              color={canRemoveDay ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.dayChipText, !canRemoveDay && styles.dayChipTextDisabled]}>
              Quitar día
            </Text>
          </Pressable>
        </View>

        <CreateRoutineButton onPress={handleCreate} />
      </StretchScrollView>

      <GlassTopBar
        title="Nueva rutina"
        titleElement={(
          <View style={styles.topBarTitleRow}>
            <MaterialCommunityIcons name="playlist-plus" size={18} color={theme.colors.text} />
            <Text style={styles.topBarTitleText}>Nueva rutina</Text>
          </View>
        )}
        subtitle="Define los ejercicios que realizarás cada día"
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

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
  input: {
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
  exercisesInput: {
    backgroundColor: theme.colors.darkGray,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: theme.colors.text,
    minHeight: 120,
    fontSize: 13,
    lineHeight: 18,
  },
  previewWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  previewChipName: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 18,
  },
  previewChipScheme: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primaryLight,
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
    lineHeight: 16,
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
