import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  SafeAreaView,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { useWorkout } from '@hooks/useWorkout';
import { ExerciseInputField, CardioInputField, Button, Toast } from '@components';
import { parseCardioString } from '@lib/parsers';
import { generateId, getToday } from '@lib/storage';
import { WorkoutDay, WorkoutLog, ExerciseLog, CardioLog, ParsedSet, WorkoutRoutine } from '@types/index';
import { theme } from '@lib/theme';

interface WorkoutLogScreenProps {
  day: WorkoutDay;
  onSave: () => void;
  onBack: () => void;
}

export function WorkoutLogScreen({
  day,
  onSave,
  onBack,
}: WorkoutLogScreenProps) {
  const { state, dispatch } = useWorkout();
  const [selectedDay, setSelectedDay] = useState(day);
  const [showDaySelector, setShowDaySelector] = useState(false);
  
  // Estado para almacenar las series agregadas por cada ejercicio
  const [exerciseSets, setExerciseSets] = useState<Record<string, ParsedSet[]>>(
    selectedDay.exercises.reduce((acc, ex) => ({ ...acc, [ex.id]: [] }), {})
  );
  
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [finishedExercises, setFinishedExercises] = useState<Set<string>>(new Set());
  const [cardioInput, setCardioInput] = useState('');
  const [showNotesModal, setShowNotesModal] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const getRoutineIdForDay = () => {
    for (const routine of state.routines) {
      if (routine.days.find((d: any) => d.id === selectedDay.id)) {
        return routine.id;
      }
    }
    return state.activeRoutineId || 'routine3';
  };

  const getActiveDays = (): WorkoutDay[] => {
    const activeRoutine = state.routines.find(
      (r: WorkoutRoutine) => r.id === state.activeRoutineId
    );
    return activeRoutine?.days || [];
  };

  const handleAddSet = (exerciseId: string, set: ParsedSet) => {
    setExerciseSets((prev) => ({
      ...prev,
      [exerciseId]: [...prev[exerciseId], set],
    }));
  };

  const handleRemoveLastSet = (exerciseId: string) => {
    setExerciseSets((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId].slice(0, -1),
    }));
  };

  const handleFinishExercise = (exerciseId: string) => {
    setFinishedExercises((prev) => new Set([...prev, exerciseId]));
  };

  const handleSaveWorkout = () => {
    try {
      const exerciseLogs: ExerciseLog[] = selectedDay.exercises.map((ex) => {
        const sets = exerciseSets[ex.id] || [];
        const rawInput = sets.map(s => `${s.weight}x${s.reps}`).join(', ');
        
        return {
          id: generateId(),
          exerciseId: ex.id,
          exerciseName: ex.name,
          order: ex.order,
          rawInput,
          parsedSets: sets,
          notes: exerciseNotes[ex.id],
          timestamp: Date.now(),
        };
      });

      const cardioLog: CardioLog | undefined = cardioInput.trim()
        ? {
            id: generateId(),
            ...(parseCardioString(cardioInput) as Omit<CardioLog, 'id'>),
          }
        : undefined;

      const workoutLog: WorkoutLog = {
        id: generateId(),
        routineId: getRoutineIdForDay(),
        dayId: selectedDay.id,
        date: getToday(),
        exercises: exerciseLogs,
        cardio: cardioLog,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      dispatch({ type: 'ADD_WORKOUT_LOG', payload: workoutLog });

      setToast({
        message: '✅ Entrenamiento guardado, ¡excelente!',
        type: 'success',
      });

      setTimeout(() => {
        onSave();
        onBack();
      }, 1500);
    } catch (error) {
      setToast({
        message: '❌ Error al guardar',
        type: 'error',
      });
    }
  };

  const handleExerciseNotesPress = (exerciseId: string) => {
    setShowNotesModal(exerciseId);
    setNotesText(exerciseNotes[exerciseId] || '');
  };

  const handleSaveNotes = () => {
    if (showNotesModal) {
      setExerciseNotes((prev: any) => ({
        ...prev,
        [showNotesModal]: notesText,
      }));
    }
    setShowNotesModal(null);
    setNotesText('');
  };

  const hasExerciseInput = selectedDay.exercises.some(
    ex => exerciseSets[ex.id]?.length > 0
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={onBack}>
            <Text style={styles.backButton}>← Volver</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {selectedDay.emoji} {selectedDay.name}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.changeButton,
              pressed && styles.changeButtonPressed,
            ]}
            onPress={() => setShowDaySelector(true)}
          >
            <Text style={styles.changeButtonText}>⇆</Text>
          </Pressable>
        </View>
        <Text style={styles.date}>{new Date().toLocaleDateString('es-ES')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionTitle}>Ejercicios</Text>

        {selectedDay.exercises.map((exercise: any) => (
          <ExerciseInputField
            key={exercise.id}
            order={exercise.order}
            exerciseName={exercise.name}
            repetitions={exercise.targetReps}
            addedSets={exerciseSets[exercise.id] || []}
            targetSets={exercise.targetSets}
            onAddSet={(set) => handleAddSet(exercise.id, set)}
            onRemoveLastSet={() => handleRemoveLastSet(exercise.id)}
            onFinishExercise={() => handleFinishExercise(exercise.id)}
            onNotesPress={() => handleExerciseNotesPress(exercise.id)}
            notesCount={exerciseNotes[exercise.id] ? 1 : 0}
          />
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
          Cardio
        </Text>

        <CardioInputField
          value={cardioInput}
          onChangeText={setCardioInput}
          expanded={true}
        />

        <View style={styles.buttonContainer}>
          <Button
            title={hasExerciseInput ? '💾 Guardar' : '⏭️  Saltar'}
            onPress={handleSaveWorkout}
            variant="primary"
            size="large"
            style={styles.saveButton}
          />
          <Button
            title="Cancelar"
            onPress={onBack}
            variant="secondary"
            size="large"
          />
        </View>
      </ScrollView>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Modal de notas */}
      <Modal
        visible={showNotesModal !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setShowNotesModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Notas del ejercicio</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Añade una nota (ej: muy cansado, fallo en última serie)"
              value={notesText}
              onChangeText={setNotesText}
              multiline
              placeholderTextColor={theme.colors.textSecondary}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Guardar"
                onPress={handleSaveNotes}
                variant="primary"
                size="medium"
              />
              <Button
                title="Cancelar"
                onPress={() => setShowNotesModal(null)}
                variant="secondary"
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de cambio de día */}
      <Modal
        visible={showDaySelector}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDaySelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.daySelectorContent}>
            <Text style={styles.modalTitle}>Cambiar ejercicio</Text>
            <ScrollView style={styles.daysList}>
              {getActiveDays().map((d) => (
                <Pressable
                  key={d.id}
                  style={({ pressed }) => [
                    styles.dayOption,
                    selectedDay.id === d.id && styles.dayOptionSelected,
                    pressed && styles.dayOptionPressed,
                  ]}
                  onPress={() => {
                    setSelectedDay(d);
                    setExerciseSets(d.exercises.reduce((acc, ex) => ({ ...acc, [ex.id]: [] }), {}));
                    setShowDaySelector(false);
                  }}
                >
                  <Text style={styles.dayOptionText}>
                    {d.emoji} {d.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button
              title="Cancelar"
              onPress={() => setShowDaySelector(false)}
              variant="secondary"
              size="medium"
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
  },
  changeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  changeButtonPressed: {
    opacity: 0.7,
  },
  changeButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginVertical: 12,
  },
  buttonContainer: {
    gap: 8,
    marginVertical: 20,
    marginBottom: 40,
  },
  saveButton: {
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  daySelectorContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    color: theme.colors.text,
    backgroundColor: theme.colors.darkGray,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  daysList: {
    marginVertical: 12,
  },
  dayOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dayOptionSelected: {
    backgroundColor: theme.colors.darkGray,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  dayOptionPressed: {
    opacity: 0.7,
  },
  dayOptionText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
});
