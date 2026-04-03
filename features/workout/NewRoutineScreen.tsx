import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
} from 'react-native';
import { Button, Toast } from '@components';
import { generateId } from '@lib/storage';
import { theme } from '@lib/theme';
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

function parseExerciseLine(
  line: string,
  routineId: string,
  dayNumber: number,
  order: number
): WorkoutExercise {
  const parsed = line.match(/^(.*?)\s*\[(\d+)\s*x\s*([^\]]+)\]\s*$/i);

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

export function NewRoutineScreen({
  existingRoutineCount,
  onCreateRoutine,
  onBack,
}: NewRoutineScreenProps) {
  const [days, setDays] = useState<NewRoutineDayForm[]>([
    { id: generateId(), title: '', exercisesText: '' },
  ]);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const canAddNewDay = useMemo(
    () => days.every((day: NewRoutineDayForm) => day.title.trim() && day.exercisesText.trim()),
    [days]
  );

  const handleUpdateDay = (dayId: string, key: keyof NewRoutineDayForm, value: string) => {
    setDays((previous: NewRoutineDayForm[]) => previous.map((day: NewRoutineDayForm) => (
      day.id === dayId ? { ...day, [key]: value } : day
    )));
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

      setToast({ message: '✅ Nueva rutina creada', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear la rutina';
      setToast({ message: `❌ ${message}`, type: 'error' });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>➕ Nueva rutina</Text>
        <Text style={styles.subtitle}>Define los ejercicios que realizarás cada día</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {days.map((day: NewRoutineDayForm, index: number) => (
          <View key={day.id} style={styles.dayCard}>
            <Text style={styles.dayTitle}>Día {index + 1}</Text>
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
          </View>
        ))}

        <View style={styles.rowButtons}>
          <Button
            title="➕ Añadir día"
            onPress={() => {
              if (days.length >= 7) {
                setToast({ message: '⚠️ Máximo 7 días', type: 'error' });
                return;
              }

              setDays((previous: NewRoutineDayForm[]) => ([
                ...previous,
                { id: generateId(), title: '', exercisesText: '' },
              ]));
            }}
            variant="secondary"
            disabled={!canAddNewDay || days.length >= 7}
            size="medium"
            style={styles.growButton}
          />

          <Button
            title="➖ Quitar día"
            onPress={() => setDays((previous: NewRoutineDayForm[]) => previous.slice(0, -1))}
            variant="secondary"
            disabled={days.length <= 1}
            size="medium"
            style={styles.growButton}
          />
        </View>

        <Button
          title="Crear rutina"
          onPress={handleCreate}
          size="large"
        />
      </ScrollView>

      <View style={styles.footerButtons}>
        <Button
          title="← Volver"
          onPress={onBack}
          variant="secondary"
          size="large"
        />
      </View>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
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
    gap: 12,
  },
  dayCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 10,
    ...theme.shadow.soft,
  },
  dayTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.primary,
    lineHeight: 22,
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
  rowButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  growButton: {
    flex: 1,
  },
  footerButtons: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
});
