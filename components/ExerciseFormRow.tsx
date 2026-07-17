import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  buildTargetReps,
  ExerciseForm,
  MAX_SETS,
  MIN_SETS,
  RepUnit,
} from '@lib/exerciseForm';

interface ExerciseFormRowProps {
  exercise: ExerciseForm;
  accent: string;
  canRemove: boolean;
  onChange: (changes: Partial<ExerciseForm>) => void;
  onRemove: () => void;
  onCollapse: () => void;
}

/**
 * Editor estructurado de un ejercicio: nombre + stepper de series +
 * reps/segundos. Lo usan "Nueva rutina" y el editor de ejercicios de un día ya
 * guardado, para que crear y editar se hagan igual (antes editar era un
 * textarea con formato "Nombre — 4x8" parseado a mano).
 */
export function ExerciseFormRow({
  exercise,
  accent,
  canRemove,
  onChange,
  onRemove,
  onCollapse,
}: ExerciseFormRowProps) {
  const adjustSets = (delta: number) => {
    const next = Math.min(MAX_SETS, Math.max(MIN_SETS, exercise.sets + delta));
    onChange({ sets: next });
  };

  const hasName = !!exercise.name.trim();

  return (
    <View style={styles.exerciseRow}>
      <View style={styles.exerciseNameRow}>
        <TextInput
          style={styles.exerciseNameInput}
          placeholder={t('Ej: Press banca')}
          placeholderTextColor={theme.colors.textSecondary}
          value={exercise.name}
          onChangeText={(value) => onChange({ name: value })}
        />
        {hasName && (
          <Pressable
            style={({ pressed }) => [
              styles.collapseButton,
              { borderColor: accent },
              pressed && styles.buttonPressed,
            ]}
            onPress={onCollapse}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="check" size={18} color={accent} />
          </Pressable>
        )}
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
          <Text style={styles.controlLabel}>{t('Series')}</Text>
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
            {exercise.unit === 'seg' ? t('Segundos') : t('Repeticiones')}
          </Text>
          <View style={styles.repsRow}>
            <TextInput
              style={styles.repsInput}
              placeholder={
                exercise.unit === 'seg' ? t('Ej: 30-45') : t('Ej: 10-12')
              }
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
                      {unit === 'reps' ? t('reps') : t('seg')}
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

interface ExerciseSummaryRowProps {
  exercise: ExerciseForm;
  canRemove: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

/** Fila colapsada: el ejercicio ya definido, como una sola línea de texto. */
export function ExerciseSummaryRow({
  exercise,
  canRemove,
  onEdit,
  onRemove,
}: ExerciseSummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <Pressable
        style={({ pressed }) => [
          styles.summaryMain,
          pressed && styles.buttonPressed,
        ]}
        onPress={onEdit}
        hitSlop={6}
      >
        <Text style={styles.summaryText} numberOfLines={1}>
          {exercise.name.trim()}
        </Text>
        <View style={styles.summaryDivider} />
        <Text style={styles.summarySets}>
          {exercise.sets}x{buildTargetReps(exercise)}
        </Text>
        <MaterialCommunityIcons
          name="pencil"
          size={16}
          color={theme.colors.textSecondary}
        />
      </Pressable>
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
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: theme.colors.inputBg,
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
  collapseButton: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  summaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 6,
    backgroundColor: theme.colors.border,
  },
  summarySets: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
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
    backgroundColor: theme.colors.inputBg,
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
    backgroundColor: theme.colors.inputBg,
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
    backgroundColor: theme.colors.inputBg,
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
  buttonPressed: {
    opacity: 0.85,
  },
  controlDisabled: {
    opacity: 0.4,
  },
});
