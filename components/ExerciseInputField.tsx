import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  GestureResponderEvent,
  ScrollView,
} from 'react-native';
import { ParsedSet, ExerciseLog } from '@types/index';
import { theme } from '@lib/theme';
import { parseSeriesString } from '@lib/parsers';

interface ExerciseInputFieldProps {
  order: number;
  exerciseName: string;
  target?: {
    sets?: number;
    reps?: string;
  };
  addedSets: ParsedSet[];
  onAddSet: (set: ParsedSet) => void;
  onRemoveLastSet: () => void;
  onFinishExercise: () => void;
  onNotesPress: (event: GestureResponderEvent) => void;
  notes?: string;
  previousLog?: ExerciseLog | null;
}

export function ExerciseInputField({
  order,
  exerciseName,
  target,
  addedSets,
  onAddSet,
  onRemoveLastSet,
  onFinishExercise,
  onNotesPress,
  notes,
  previousLog,
}: ExerciseInputFieldProps) {
  const [weightValue, setWeightValue] = useState('');
  const [repsValue, setRepsValue] = useState('');

  const handleAddSet = () => {
    const weight = parseFloat(weightValue.trim());
    const reps = parseFloat(repsValue.trim());

    // Permitir peso 0 pero reps debe ser > 0
    if (!isNaN(weight) && !isNaN(reps) && weight >= 0 && reps > 0) {
      onAddSet({ weight, reps });
      setWeightValue('');
      setRepsValue('');
    }
  };

  const isMaxSetsReached = target?.sets ? addedSets.length >= target.sets : false;
  const hasAddedSets = addedSets.length > 0;

  const getPreviousSetsSummary = () => {
    if (!previousLog) return '';
    
    // Si tiene parsedSets poblados, usa eso
    if (previousLog.parsedSets && previousLog.parsedSets.length > 0) {
      return previousLog.parsedSets.map(s => {
        if (s.weight === -1 || s.reps === -1) return '—';
        return `${s.weight}x${s.reps}`;
      }).join(', ');
    }
    
    // Si no, intenta parsear rawInput
    if (previousLog.rawInput && previousLog.rawInput.trim() && previousLog.rawInput !== '-') {
      const parsed = parseSeriesString(previousLog.rawInput);
      if (parsed.length > 0) {
        return parsed.map(s => `${s.weight}x${s.reps}`).join(', ');
      }
      // Si no se puede parsear, retorna el rawInput tal como está
      return previousLog.rawInput;
    }
    
    return '';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <View style={styles.orderBadge}>
            <Text style={styles.order}>{order}</Text>
          </View>
          <Text style={styles.exerciseName}>{exerciseName}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.notesButton,
            pressed && styles.notesButtonPressed,
          ]}
          onPress={onNotesPress}
        >
          <Text style={styles.notesButtonText}>
            ✏️
          </Text>
        </Pressable>
      </View>

      {target?.sets && target?.reps && (
        <Text style={styles.targetRow}>
          Objetivo: {target.sets}x{target.reps}
        </Text>
      )}

      {previousLog && (
        <Text style={styles.previousRow}>
          Anterior {getPreviousSetsSummary() || '-'}
        </Text>
      )}

      {notes && (
        <Text style={styles.notesRow}>
          Nota: {notes}
        </Text>
      )}

      {hasAddedSets && (
        <View style={styles.seriesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seriesList}
          >
            {addedSets.map((set, idx) => (
              <View key={idx} style={styles.serieTag}>
                <Text style={styles.serieTagText}>
                  {set.weight === -1 || set.reps === -1 ? '—' : `${set.weight}x${set.reps}`}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {!isMaxSetsReached && (
        <View>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Peso (kg)</Text>
              <TextInput
                style={styles.splitInput}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                value={weightValue}
                onChangeText={setWeightValue}
                keyboardType="decimal-pad"
                maxLength={6}
              />
            </View>

            <Text style={styles.separator}>×</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Repeticiones</Text>
              <TextInput
                style={styles.splitInput}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                value={repsValue}
                onChangeText={setRepsValue}
                keyboardType="decimal-pad"
                maxLength={4}
              />
            </View>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleAddSet}
            >
              <Text style={styles.buttonText}>➕ Añadir</Text>
            </Pressable>

            {hasAddedSets && (
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onRemoveLastSet}
              >
                <Text style={styles.buttonText}>➖ Borrar</Text>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.finishButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={onFinishExercise}
            >
              <Text style={styles.buttonText}>✔️ Terminar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isMaxSetsReached && (
        <View style={styles.maxReachedContainer}>
          <Text style={styles.maxReachedText}>
            ✓ Completado ({addedSets.length}/{target?.sets})
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.deleteLastButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={onRemoveLastSet}
          >
            <Text style={styles.buttonText}>➖ Borrar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.soft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  orderBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  order: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primaryLight,
    textAlign: 'center',
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    flexShrink: 1,
  },
  targetRow: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFD400',
    marginBottom: 8,
  },
  previousRow: {
    fontSize: 13,
    color: '#FF8C00',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  notesRow: {
    fontSize: 13,
    color: '#FFD400',
    marginBottom: 8,
  },
  repetitions: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  serieCount: {
    fontSize: 12,
    color: theme.colors.primaryLight,
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 16,
  },
  notesButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.gray,
    borderRadius: theme.borderRadius.pill,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  notesButtonPressed: {
    backgroundColor: theme.colors.mediumGray,
  },
  notesButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  seriesContainer: {
    marginBottom: 12,
  },
  seriesList: {
    paddingRight: 12,
    gap: 8,
  },
  serieTag: {
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    minWidth: 50,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 212, 59, 0.22)',
  },
  serieTagText: {
    color: theme.colors.primaryLight,
    fontWeight: '700',
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  splitInput: {
    backgroundColor: theme.colors.darkGray,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    minHeight: 54,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: theme.colors.text,
    fontWeight: '600',
  },
  separator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  addButton: {
    flex: 1,
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    ...theme.shadow.soft,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: theme.colors.error,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  finishButton: {
    flex: 1,
    backgroundColor: theme.colors.warning,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  finishButtonSmall: {
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'stretch',
  },
  deleteLastButton: {
    backgroundColor: theme.colors.error,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'stretch',
  },
  buttonText: {
    color: theme.colors.darkGray,
    fontWeight: '800',
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  maxReachedContainer: {
    backgroundColor: theme.colors.darkGray,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  maxReachedText: {
    color: theme.colors.primaryLight,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 8,
  },
});
