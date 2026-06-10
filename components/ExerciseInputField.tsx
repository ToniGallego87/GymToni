import React, { useState, useRef, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  GestureResponderEvent,
  ScrollView,
  Keyboard,
} from 'react-native';
import { ParsedSet, ExerciseLog } from '../types';
import { theme } from '@lib/theme';
import { parseSeriesString } from '@lib/parsers';
import { getImprovementDisplay } from '@lib/utils';
import { GradientFill } from './GradientFill';

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
  improvement?: { isImproved: boolean; percent: number } | null;
  // Color de acento del día (push/pull/pierna). Tiñe borde, fondo y tags.
  accent?: string;
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
  improvement,
  accent = theme.colors.primary,
}: ExerciseInputFieldProps) {
  const [weightValue, setWeightValue] = useState('');
  const [repsValue, setRepsValue] = useState('');

  // Cronómetro para ejercicios medidos en tiempo
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const isTimeBased = !!(target?.reps && /\d+\s*(s\b|seg|sec|min)/i.test(target.reps));

  const startTimer = () => {
    setTimerRunning(true);
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    setTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetTimer = () => {
    stopTimer();
    setTimerSeconds(0);
  };

  const useTimerAsReps = () => {
    stopTimer();
    setRepsValue(String(timerSeconds));
  };

  const formatTimerDisplay = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatImprovementDisplay = (imp: { isImproved: boolean; percent: number }) => {
    const { symbol, display, kind } = getImprovementDisplay(imp);
    const styleKey =
      kind === 'up' ? 'improvementUp'
      : kind === 'down' ? 'improvementDown'
      : 'improvementNeutral';
    return { symbol, styleKey, display };
  };

  const handleAddSet = () => {
    // Usar placeholders si los campos están vacíos
    const weightStr = (weightValue.trim() || getWeightPlaceholder()).trim();
    const repsStr = (repsValue.trim() || getRepPlaceholder()).trim();

    const weight = parseFloat(weightStr);
    const reps = parseFloat(repsStr);

    // Permitir peso 0 pero reps debe ser > 0
    if (!isNaN(weight) && !isNaN(reps) && weight >= 0 && reps > 0) {
      onAddSet({ weight, reps });
      setWeightValue('');
      setRepsValue('');
      // Cerrar el teclado después de añadir
      Keyboard.dismiss();
    }
  };

  const isMaxSetsReached = target?.sets ? addedSets.length >= target.sets : false;
  const hasAddedSets = addedSets.length > 0;

  const getWeightPlaceholder = () => {
    if (addedSets.length > 0) {
      return String(addedSets[addedSets.length - 1].weight);
    }
    
    if (previousLog) {
      if (previousLog.parsedSets && previousLog.parsedSets.length > 0) {
        return String(previousLog.parsedSets[0].weight);
      }
      
      if (previousLog.rawInput && previousLog.rawInput.trim() && previousLog.rawInput !== '-') {
        const parsed = parseSeriesString(previousLog.rawInput);
        if (parsed.length > 0) {
          return String(parsed[0].weight);
        }
      }
    }
    
    return '0';
  };

  const getRepPlaceholder = () => {
    if (addedSets.length > 0) {
      return String(addedSets[addedSets.length - 1].reps);
    }
    
    if (previousLog) {
      if (previousLog.parsedSets && previousLog.parsedSets.length > 0) {
        return String(previousLog.parsedSets[0].reps);
      }
      
      if (previousLog.rawInput && previousLog.rawInput.trim() && previousLog.rawInput !== '-') {
        const parsed = parseSeriesString(previousLog.rawInput);
        if (parsed.length > 0) {
          return String(parsed[0].reps);
        }
      }
    }
    
    return '0';
  };

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
    <View style={[styles.container, { borderLeftColor: accent }]}>
      <GradientFill accent={accent} />
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <MaterialCommunityIcons
            name="circle"
            size={13}
            color={accent}
            style={styles.titleAccent}
          />
          <Text style={styles.exerciseName}>{order}.- {exerciseName}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.notesButton,
            pressed && styles.notesButtonPressed,
          ]}
          onPress={onNotesPress}
        >
          <MaterialCommunityIcons
            name="pencil-outline"
            size={16}
            color={theme.colors.text}
          />
        </Pressable>
      </View>

      {target?.sets && target?.reps && (
        <View style={styles.targetRowContainer}>
          <Text style={styles.targetRow}>
            Objetivo: {target.sets}x{target.reps}
          </Text>
          {improvement && addedSets.length > 0 && isMaxSetsReached && (
            (() => {
              const fmt = formatImprovementDisplay(improvement);
              return (
                <Text
                  style={[
                    styles.improvementText,
                    styles[fmt.styleKey as keyof typeof styles],
                  ]}
                >
                  {fmt.symbol} {fmt.display}%
                </Text>
              );
            })()
          )}
        </View>
      )}

      {previousLog && (
        <Text style={styles.previousRow}>
          Anterior: {getPreviousSetsSummary() || '-'}
          {'\n'}
          {previousLog?.notes && (
            <Text style={styles.previousNotesRow}>
               -{previousLog.notes}-
            </Text>
          )}
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
              <View key={idx} style={[styles.serieTag, { borderColor: accent }]}>
                <Text style={[styles.serieTagText, { color: accent }]}>
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
                placeholder={getWeightPlaceholder()}
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
                placeholder={getRepPlaceholder()}
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
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons name="plus" size={16} color={theme.colors.darkGray} />
                <Text style={styles.buttonText}>Añadir</Text>
              </View>
            </Pressable>

            {hasAddedSets && (
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onRemoveLastSet}
              >
                <View style={styles.buttonContent}>
                  <MaterialCommunityIcons name="minus" size={16} color={theme.colors.darkGray} />
                  <Text style={styles.buttonText}>Borrar</Text>
                </View>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.finishButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={onFinishExercise}
            >
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons name="check" size={16} color={theme.colors.darkGray} />
                <Text style={styles.buttonText}>Terminar</Text>
              </View>
            </Pressable>
          </View>

          {isTimeBased && (
            <View style={styles.stopwatchContainer}>
              <Text style={styles.stopwatchDisplay}>{formatTimerDisplay(timerSeconds)}</Text>
              <View style={styles.stopwatchButtons}>
                <Pressable
                  style={({ pressed }) => [
                    timerRunning ? styles.stopwatchStopButton : styles.stopwatchStartButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={timerRunning ? stopTimer : startTimer}
                >
                  <MaterialCommunityIcons
                    name={timerRunning ? 'stop' : 'play'}
                    size={18}
                    color={theme.colors.darkGray}
                  />
                  <Text style={styles.stopwatchButtonText}>
                    {timerRunning ? 'Parar' : 'Iniciar'}
                  </Text>
                </Pressable>

                {timerSeconds > 0 && !timerRunning && (
                  <Pressable
                    style={({ pressed }) => [styles.stopwatchUseButton, pressed && styles.buttonPressed]}
                    onPress={useTimerAsReps}
                  >
                    <MaterialCommunityIcons name="check" size={18} color={theme.colors.darkGray} />
                    <Text style={styles.stopwatchButtonText}>Usar {timerSeconds}s</Text>
                  </Pressable>
                )}

                {timerSeconds > 0 && (
                  <Pressable
                    style={({ pressed }) => [styles.stopwatchResetButton, pressed && styles.buttonPressed]}
                    onPress={resetTimer}
                  >
                    <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.darkGray} />
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {isMaxSetsReached && (
        <View style={styles.maxReachedContainer}>
          <View style={styles.maxReachedRow}>
            <MaterialCommunityIcons name="check-circle" size={18} color={theme.colors.success} />
            <Text style={styles.maxReachedText}>
              Completado ({addedSets.length}/{target?.sets})
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.deleteLastButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={onRemoveLastSet}
          >
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="minus" size={16} color={theme.colors.darkGray} />
              <Text style={styles.buttonText}>Borrar</Text>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    overflow: 'hidden',
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
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  titleAccent: {
    marginTop: 2,
  },
  exerciseName: {
    fontSize: 20,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.3,
    color: theme.colors.text,
    flexShrink: 1,
    lineHeight: 25,
  },
  targetRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  targetRow: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFD400',
  },
  improvementText: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  improvementUp: {
    color: theme.colors.success,
  },
  improvementDown: {
    color: theme.colors.error,
  },
  improvementNeutral: {
    color: theme.colors.warning,
  },
  previousRow: {
    fontSize: 13,
    color: '#FF8C00',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  previousNotesRow: {
    color: '#FFB347',
    fontStyle: 'italic',
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  maxReachedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  maxReachedText: {
    color: theme.colors.primaryLight,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 8,
  },
  stopwatchContainer: {
    marginTop: 12,
    backgroundColor: theme.colors.darkGray,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stopwatchDisplay: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  stopwatchButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  stopwatchStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.success,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.sm,
  },
  stopwatchStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.error,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.sm,
  },
  stopwatchUseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.sm,
  },
  stopwatchResetButton: {
    backgroundColor: theme.colors.surfaceAlt,
    padding: 10,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stopwatchButtonText: {
    color: theme.colors.darkGray,
    fontWeight: '800',
    fontSize: 14,
  },
});
