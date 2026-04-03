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
    setExerciseSets((prev) => {
      let updatedSets = prev[exerciseId].slice(0, -1);
      // Borrar todos los vacíos (guiones) del final
      while (updatedSets.length > 0) {
        const lastSet = updatedSets[updatedSets.length - 1];
        if (lastSet.weight === -1 || lastSet.reps === -1) {
          updatedSets = updatedSets.slice(0, -1);
        } else {
          break;
        }
      }
      return {
        ...prev,
        [exerciseId]: updatedSets,
      };
    });
  };

  const getPreviousExerciseLog = (exerciseId: string) => {
    console.log(`[getPreviousExerciseLog] START - Looking for exerciseId: ${exerciseId}, dayId: ${selectedDay.id}`);
    console.log(`[getPreviousExerciseLog] Total logs in state: ${state.logs.length}`);
    
    // Obtener todos los logs del mismo día, sin filtrar por fecha
    const logsForDay = state.logs.filter((log) => log.dayId === selectedDay.id);
    console.log(`[getPreviousExerciseLog] Logs for this day: ${logsForDay.length}`);
    
    // Obtener todos los ejercicios de esos logs
    const allExercisesForDay = logsForDay.flatMap((log) =>
      log.exercises.map((ex) => ({ ...ex, logDate: log.createdAt, logId: log.id }))
    );
    console.log(`[getPreviousExerciseLog] All exercises for this day: ${allExercisesForDay.length}`);
    
    // Filtrar por exerciseId
    const matchingExercises = allExercisesForDay.filter((ex) => ex.exerciseId === exerciseId);
    console.log(`[getPreviousExerciseLog] Exercises matching ID ${exerciseId}: ${matchingExercises.length}`);
    
    if (matchingExercises.length === 0) {
      console.log(`[getPreviousExerciseLog] No exercises found - returning null`);
      return null;
    }
    
    // Ordenar por fecha descendente
    matchingExercises.sort((a, b) => b.logDate - a.logDate);
    
    // Retornar el más reciente que no sea de hoy
    const today = new Date().toLocaleDateString('es-ES');
    for (const exercise of matchingExercises) {
      const logDate = new Date(exercise.logDate).toLocaleDateString('es-ES');
      console.log(`[getPreviousExerciseLog] Checking exercise from ${logDate}`);
      if (logDate !== today) {
        console.log(`[getPreviousExerciseLog] FOUND - Returning exercise with rawInput: ${exercise.rawInput}`);
        return exercise;
      }
    }
    
    console.log(`[getPreviousExerciseLog] All exercises are from today - returning null`);
    return null;
  };

  const handleFinishExercise = (exerciseId: string) => {
    const targetSets = selectedDay.exercises.find(ex => ex.id === exerciseId)?.targetSets || 0;
    if (targetSets > 0) {
      // Llenar con guiones para cada serie faltante
      const currentSets = exerciseSets[exerciseId] || [];
      const setsToAdd = targetSets - currentSets.length;
      
      for (let i = 0; i < setsToAdd; i++) {
        setExerciseSets((prev) => ({
          ...prev,
          [exerciseId]: [...(prev[exerciseId] || []), { weight: -1, reps: -1 }],
        }));
      }
    }
  };

  const handleSaveWorkout = () => {
    try {
      const exerciseLogs: ExerciseLog[] = selectedDay.exercises.map((ex) => {
        const sets = exerciseSets[ex.id] || [];
        const rawInput = sets.map(s => s.weight === -1 || s.reps === -1 ? '-' : `${s.weight}x${s.reps}`).join(', ');
        
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
        <Text style={styles.headerTitle}>
          {selectedDay.emoji} {selectedDay.name}
        </Text>
        <Text style={styles.headerSubtitle}>Rellena los ejercicios</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {selectedDay.exercises.map((exercise: any) => (
          <ExerciseInputField
            key={exercise.id}
            order={exercise.order}
            exerciseName={exercise.name}
            target={{
              sets: exercise.targetSets,
              reps: exercise.targetReps,
            }}
            addedSets={exerciseSets[exercise.id] || []}
            onAddSet={(set) => handleAddSet(exercise.id, set)}
            onRemoveLastSet={() => handleRemoveLastSet(exercise.id)}
            onFinishExercise={() => handleFinishExercise(exercise.id)}
            onNotesPress={() => handleExerciseNotesPress(exercise.id)}
            notes={exerciseNotes[exercise.id]}
            previousLog={getPreviousExerciseLog(exercise.id)}
          />
        ))}

        <CardioInputField
          value={cardioInput}
          onChangeText={setCardioInput}
          expanded={true}
        />

        <View style={styles.buttonContainer}>
          <Button
            title="🎯 Guardar"
            onPress={handleSaveWorkout}
            variant="primary"
            size="large"
          />
        </View>
      </ScrollView>

      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Volver</Text>
      </Pressable>

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
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerSubtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: theme.spacing.md,
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginVertical: 12,
  },
  backButton: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 14,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
    lineHeight: 24,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    minHeight: 88,
    color: theme.colors.text,
    backgroundColor: theme.colors.darkGray,
    marginBottom: 16,
    lineHeight: 22,
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
