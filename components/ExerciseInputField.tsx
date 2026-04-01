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
import { ParsedSet } from '@types/index';
import { theme } from '@lib/theme';

interface ExerciseInputFieldProps {
  order: number;
  exerciseName: string;
  repetitions?: string;
  addedSets: ParsedSet[];
  targetSets?: number;
  onAddSet: (set: ParsedSet) => void;
  onRemoveLastSet: () => void;
  onFinishExercise: () => void;
  onNotesPress: (event: GestureResponderEvent) => void;
  notesCount?: number;
}

export function ExerciseInputField({
  order,
  exerciseName,
  repetitions,
  addedSets,
  targetSets,
  onAddSet,
  onRemoveLastSet,
  onFinishExercise,
  onNotesPress,
  notesCount = 0,
}: ExerciseInputFieldProps) {
  const [weightValue, setWeightValue] = useState('');
  const [repsValue, setRepsValue] = useState('');

  const handleAddSet = () => {
    const weight = parseFloat(weightValue.trim());
    const reps = parseFloat(repsValue.trim());

    if (!isNaN(weight) && !isNaN(reps) && weight > 0 && reps > 0) {
      onAddSet({ weight, reps });
      setWeightValue('');
      setRepsValue('');
    }
  };

  const isMaxSetsReached = targetSets ? addedSets.length >= targetSets : false;
  const hasAddedSets = addedSets.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <View style={styles.orderBadge}>
            <Text style={styles.order}>{order}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.exerciseName}>{exerciseName}</Text>
            {repetitions && (
              <Text style={styles.repetitions}>Objetivo: {repetitions}</Text>
            )}
            {targetSets && (
              <Text style={styles.serieCount}>
                Series: {addedSets.length}/{targetSets}
              </Text>
            )}
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.notesButton,
            pressed && styles.notesButtonPressed,
          ]}
          onPress={onNotesPress}
        >
          <Text style={styles.notesButtonText}>
            ✏️ {notesCount > 0 ? notesCount : ''}
          </Text>
        </Pressable>
      </View>

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
                  {set.weight}x{set.reps}
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
              <Text style={styles.inputLabel}>Reps</Text>
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
              <Text style={styles.buttonText}>✓ Fin</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isMaxSetsReached && (
        <View style={styles.maxReachedContainer}>
          <Text style={styles.maxReachedText}>
            ✓ Series completadas ({addedSets.length}/{targetSets})
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.finishButtonSmall,
              pressed && styles.buttonPressed,
            ]}
            onPress={onFinishExercise}
          >
            <Text style={styles.buttonText}>✓ Continuar</Text>
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
    marginVertical: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.soft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
  repetitions: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  serieCount: {
    fontSize: 11,
    color: theme.colors.primaryLight,
    fontWeight: '700',
    marginTop: 2,
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
    fontSize: 12,
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
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  splitInput: {
    backgroundColor: theme.colors.darkGray,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
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
    backgroundColor: theme.colors.primary,
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
    backgroundColor: theme.colors.success,
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
  buttonText: {
    color: theme.colors.darkGray,
    fontWeight: '800',
    fontSize: 12,
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
