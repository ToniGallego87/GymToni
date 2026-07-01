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
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { ParsedSet, ExerciseLog } from '../types';
import { theme } from '@lib/theme';
import { parseSeriesString } from '@lib/parsers';
import { getImprovementDisplay } from '@lib/utils';
import { GradientFill } from './GradientFill';

// Transiciones reutilizables para recolocar y mostrar/ocultar contenido
const layoutTransition = LinearTransition.duration(220).easing(
  Easing.inOut(Easing.ease)
);
const fadeIn = FadeIn.duration(180);
const fadeOut = FadeOut.duration(140);

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

  // Secciones desplegables (contexto arriba, inputs abajo). Se renderizan de
  // forma condicional y la tarjeta reajusta su altura con `LinearTransition`
  // de Reanimated: medir la altura a mano (onLayout) para animarla fallaba en
  // el build de release (devolvía 0 y dejaba el cuerpo recortado).
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => setExpanded((prev) => !prev);

  // Cronómetro para ejercicios medidos en tiempo
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const isTimeBased = !!(
    target?.reps && /\d+\s*(s\b|seg|sec|min)/i.test(target.reps)
  );

  const startTimer = () => {
    setTimerSeconds(0);
    setTimerRunning(true);
    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    setTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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

  const formatImprovementDisplay = (imp: {
    isImproved: boolean;
    percent: number;
  }) => {
    const { symbol, display, kind } = getImprovementDisplay(imp);
    const styleKey =
      kind === 'up'
        ? 'improvementUp'
        : kind === 'down'
        ? 'improvementDown'
        : 'improvementNeutral';
    return { symbol, styleKey, display };
  };

  const handleAddSet = () => {
    const weightStr = (weightValue.trim() || getWeightPlaceholder()).trim();
    const repsStr = (repsValue.trim() || getRepPlaceholder()).trim();
    const weight = parseFloat(weightStr);
    const reps = parseFloat(repsStr);
    if (!isNaN(weight) && !isNaN(reps) && weight >= 0 && reps > 0) {
      onAddSet({ weight, reps });
      setWeightValue('');
      setRepsValue('');
      Keyboard.dismiss();
    }
  };

  const isMaxSetsReached = target?.sets
    ? addedSets.length >= target.sets
    : false;
  const hasAddedSets = addedSets.length > 0;

  const wasMaxReachedRef = useRef(isMaxSetsReached);
  useEffect(() => {
    if (isMaxSetsReached && !wasMaxReachedRef.current) {
      setExpanded(false);
    }
    wasMaxReachedRef.current = isMaxSetsReached;
  }, [isMaxSetsReached]);

  const getWeightPlaceholder = () => {
    if (addedSets.length > 0) return String(addedSets[addedSets.length - 1].weight);
    if (previousLog?.parsedSets?.length) return String(previousLog.parsedSets[0].weight);
    if (previousLog?.rawInput && previousLog.rawInput.trim() && previousLog.rawInput !== '-') {
      const parsed = parseSeriesString(previousLog.rawInput);
      if (parsed.length > 0) return String(parsed[0].weight);
    }
    return '0';
  };

  const getRepPlaceholder = () => {
    if (addedSets.length > 0) return String(addedSets[addedSets.length - 1].reps);
    if (previousLog?.parsedSets?.length) return String(previousLog.parsedSets[0].reps);
    if (previousLog?.rawInput && previousLog.rawInput.trim() && previousLog.rawInput !== '-') {
      const parsed = parseSeriesString(previousLog.rawInput);
      if (parsed.length > 0) return String(parsed[0].reps);
    }
    return '0';
  };

  const getPreviousSetsSummary = () => {
    if (!previousLog) return '';
    if (previousLog.parsedSets?.length) {
      return previousLog.parsedSets
        .map((s) => (s.weight === -1 || s.reps === -1 ? '—' : `${s.weight}×${s.reps}`))
        .join(' · ');
    }
    if (previousLog.rawInput?.trim() && previousLog.rawInput !== '-') {
      const parsed = parseSeriesString(previousLog.rawInput);
      if (parsed.length > 0) return parsed.map((s) => `${s.weight}×${s.reps}`).join(' · ');
      return previousLog.rawInput;
    }
    return '';
  };

  const renderImprovementBadge = () => {
    if (!improvement || !isMaxSetsReached || addedSets.length === 0) return null;
    const fmt = formatImprovementDisplay(improvement);
    const badgeBg =
      fmt.styleKey === 'improvementUp'
        ? styles.improvementBadgeUp
        : fmt.styleKey === 'improvementDown'
        ? styles.improvementBadgeDown
        : styles.improvementBadgeNeutral;
    return (
      <Animated.View
        entering={fadeIn}
        exiting={fadeOut}
        layout={layoutTransition}
        style={[styles.improvementBadge, badgeBg]}
      >
        <Text
          style={[
            styles.improvementText,
            styles[fmt.styleKey as keyof typeof styles],
          ]}
        >
          {fmt.symbol} {fmt.display}%
        </Text>
      </Animated.View>
    );
  };

  const renderSeriesRow = () => {
    if (!hasAddedSets) return null;
    return (
      <View style={styles.seriesRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.seriesList}
          style={styles.seriesScroll}
        >
          {addedSets.map((set, idx) => (
            <Animated.View
              key={idx}
              entering={fadeIn}
              exiting={fadeOut}
              layout={layoutTransition}
              style={[styles.serieTag, { backgroundColor: accent + '2E' }]}
            >
              <Text style={[styles.serieTagText, { color: accent }]}>
                {set.weight === -1 || set.reps === -1 ? '—' : `${set.weight}×${set.reps}`}
              </Text>
            </Animated.View>
          ))}
        </ScrollView>
        {renderImprovementBadge()}
      </View>
    );
  };

  return (
    <Animated.View
      layout={layoutTransition}
      style={[styles.container, { borderColor: accent }]}
    >
      <GradientFill accent={accent} />

      {/* Cabecera: título + flecha */}
      <Pressable
        style={[
          styles.header,
          // Colapsada: sin margen inferior (el bloque de resultados aporta su
          // propia separación; evita doble hueco bajo la cabecera).
          !expanded && styles.headerCollapsedEmpty,
        ]}
        onPress={toggleExpanded}
      >
        <View style={styles.titleSection}>
          <View style={[styles.orderBadge, { backgroundColor: accent }]}>
            <Text style={styles.orderBadgeText}>{order}</Text>
          </View>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {exerciseName}
          </Text>
        </View>
        <View style={[styles.headerRight, { borderColor: accent + '40' }]}>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={accent}
          />
        </View>
      </Pressable>

      {/* Sección superior desplegable: contexto + nota. El wrapper se mantiene
          montado siempre (solo se alterna el contenido) para que `exiting` se
          reproduzca al colapsar con un padre estable. */}
      <View style={styles.topSection}>

          {/* Bloque de contexto: objetivo + anterior */}
          {expanded && (target?.sets || previousLog) && (
            <Animated.View
              entering={fadeIn}
              exiting={fadeOut}
              layout={layoutTransition}
              style={styles.contextBlock}
            >
              {target?.sets && target?.reps && (
                <View style={styles.contextItem}>
                  <MaterialCommunityIcons name="target" size={13} color={theme.colors.textSecondary} />
                  <Text style={styles.contextLabel}>Objetivo</Text>
                  <Text style={styles.contextValue}>{target.sets}×{target.reps}</Text>
                </View>
              )}
              {previousLog && getPreviousSetsSummary() ? (
                <View style={styles.contextItem}>
                  <MaterialCommunityIcons name="history" size={13} color={theme.colors.textSecondary} />
                  <Text style={styles.contextLabel}>Anterior</Text>
                  <Text style={styles.contextValue} numberOfLines={1}>
                    {getPreviousSetsSummary()}
                  </Text>
                </View>
              ) : null}
              {previousLog?.notes ? (
                <Text style={styles.previousNoteText}>"{previousLog.notes}"</Text>
              ) : null}
            </Animated.View>
          )}

          {/* Nota actual */}
          {expanded && notes && (
            <Animated.View
              entering={fadeIn}
              exiting={fadeOut}
              layout={layoutTransition}
              style={styles.noteOwnBlock}
            >
              <MaterialCommunityIcons name="note-text-outline" size={13} color={accent} />
              <Text style={[styles.noteOwnText, { color: accent }]}>{notes}</Text>
            </Animated.View>
          )}

      </View>

      {/* Resultados insertados (peso × reps). Posición fija; con `layout` se
          desliza de forma transicional cuando las secciones de arriba y abajo
          se despliegan o colapsan. */}
      {hasAddedSets && (
        <Animated.View
          entering={fadeIn}
          exiting={fadeOut}
          layout={layoutTransition}
          style={[styles.resultsBlock, !expanded && styles.resultsBlockCollapsed]}
        >
          {renderSeriesRow()}
        </Animated.View>
      )}

      {/* Sección inferior desplegable: inputs / completado. Wrapper persistente
          (igual que la superior) para que `exiting` se reproduzca al colapsar. */}
      <View style={[styles.bottomSection, !expanded && styles.bottomSectionCollapsed]}>

          {/* Estado: en progreso */}
          {expanded && !isMaxSetsReached && (
            <Animated.View
              entering={fadeIn}
              exiting={fadeOut}
              layout={layoutTransition}
              style={[styles.inputBlock, !hasAddedSets && styles.inputBlockSpaced]}
            >
              {/* Inputs peso / reps: dos campos grandes y espaciados */}
              <View style={styles.inputRow}>
                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>Peso · kg</Text>
                  <TextInput
                    style={styles.bigInput}
                    placeholder={getWeightPlaceholder()}
                    placeholderTextColor={theme.colors.textMuted}
                    value={weightValue}
                    onChangeText={setWeightValue}
                    keyboardType="decimal-pad"
                    maxLength={6}
                  />
                </View>

                <Text style={styles.timesGlyph}>×</Text>

                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>Repeticiones</Text>
                  <TextInput
                    style={styles.bigInput}
                    placeholder={getRepPlaceholder()}
                    placeholderTextColor={theme.colors.textMuted}
                    value={repsValue}
                    onChangeText={setRepsValue}
                    keyboardType="decimal-pad"
                    maxLength={4}
                  />
                </View>
              </View>

              {/* Botón principal: añadir serie */}
              <Pressable
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: accent },
                  pressed && styles.addButtonPressed,
                ]}
                onPress={handleAddSet}
              >
                <MaterialCommunityIcons
                  name="plus-circle"
                  size={22}
                  color={theme.colors.darkGray}
                />
                <Text style={styles.addButtonText}>Añadir serie</Text>
              </Pressable>

              {/* Acciones secundarias */}
              <View style={styles.secondaryRow}>
                {hasAddedSets && (
                  <Pressable
                    style={({ pressed }) => [styles.secondaryButton, styles.deleteButton, pressed && styles.buttonPressed]}
                    onPress={onRemoveLastSet}
                  >
                    <MaterialCommunityIcons name="minus" size={15} color={theme.colors.error} />
                    <Text style={[styles.secondaryButtonText, { color: theme.colors.error }]}>Borrar</Text>
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, styles.finishButton, pressed && styles.buttonPressed]}
                  onPress={onFinishExercise}
                >
                  <MaterialCommunityIcons name="check" size={15} color={theme.colors.success} />
                  <Text style={[styles.secondaryButtonText, { color: theme.colors.success }]}>Terminar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, styles.notesButton, pressed && styles.buttonPressed]}
                  onPress={onNotesPress}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={15} color={theme.colors.textSecondary} />
                  <Text style={[styles.secondaryButtonText, { color: theme.colors.textSecondary }]}>Nota</Text>
                </Pressable>
              </View>

              {/* Cronómetro (ejercicios basados en tiempo) */}
              {isTimeBased && (
                <View style={styles.stopwatchContainer}>
                  <Text style={styles.stopwatchDisplay}>{formatTimerDisplay(timerSeconds)}</Text>
                  <View style={styles.stopwatchButtons}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.stopwatchBtn,
                        timerRunning ? styles.stopwatchBtnStop : styles.stopwatchBtnStart,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={timerRunning ? stopTimer : startTimer}
                    >
                      <MaterialCommunityIcons
                        name={timerRunning ? 'stop' : 'play'}
                        size={16}
                        color={theme.colors.darkGray}
                      />
                      <Text style={styles.stopwatchButtonText}>
                        {timerRunning ? 'Parar' : 'Iniciar'}
                      </Text>
                    </Pressable>
                    {timerSeconds > 0 && !timerRunning && (
                      <Pressable
                        style={({ pressed }) => [styles.stopwatchBtn, styles.stopwatchBtnUse, pressed && styles.buttonPressed]}
                        onPress={useTimerAsReps}
                      >
                        <MaterialCommunityIcons name="check" size={16} color={theme.colors.darkGray} />
                        <Text style={styles.stopwatchButtonText}>Usar {timerSeconds}s</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {/* Estado: completado */}
          {expanded && isMaxSetsReached && (
            <Animated.View
              entering={fadeIn}
              exiting={fadeOut}
              layout={layoutTransition}
              style={styles.completedBlock}
            >
              <View style={styles.completedRow}>
                <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.success} />
                <Text style={styles.completedText}>
                  Completado · {addedSets.length}/{target?.sets ?? addedSets.length} series
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, styles.deleteButton, styles.undoButton, pressed && styles.buttonPressed]}
                onPress={onRemoveLastSet}
              >
                <MaterialCommunityIcons name="minus" size={15} color={theme.colors.error} />
                <Text style={[styles.secondaryButtonText, { color: theme.colors.error }]}>Borrar</Text>
              </Pressable>
            </Animated.View>
          )}

      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    borderLeftWidth: 5,
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  topSection: {
    gap: 10,
  },
  bottomSection: {
    paddingBottom: 4,
  },
  bottomSectionCollapsed: {
    paddingBottom: 0,
  },

  // Cabecera
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerCollapsedEmpty: {
    marginBottom: 0,
  },
  titleSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: {
    fontSize: 19,
    fontFamily: theme.fonts.display,
    color: theme.colors.darkGray,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  headerRight: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseName: {
    flex: 1,
    fontSize: 19,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.3,
    color: theme.colors.text,
    lineHeight: 23,
  },

  // Resultados insertados (bloque único, posición fija)
  resultsBlock: {
    marginTop: 16,
    marginBottom: 16,
  },
  resultsBlockCollapsed: {
    marginTop: 12,
    marginBottom: 4,
  },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  seriesScroll: {
    flex: 1,
  },
  seriesList: {
    gap: 6,
    paddingRight: 4,
  },
  serieTag: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    minWidth: 56,
    alignItems: 'center',
  },
  serieTagText: {
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  improvementBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.pill,
    alignSelf: 'center',
  },
  improvementBadgeUp: { backgroundColor: theme.colors.success + '22' },
  improvementBadgeDown: { backgroundColor: theme.colors.error + '22' },
  improvementBadgeNeutral: { backgroundColor: theme.colors.warning + '22' },
  improvementText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  improvementUp: { color: theme.colors.success },
  improvementDown: { color: theme.colors.error },
  improvementNeutral: { color: theme.colors.warning },

  // Bloque de contexto (objetivo + anterior)
  contextBlock: {
    backgroundColor: theme.colors.darkGray,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  contextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contextLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 68,
  },
  contextValue: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '600',
    flex: 1,
  },
  previousNoteText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    paddingLeft: 19,
  },

  // Nota propia
  noteOwnBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  noteOwnText: {
    fontSize: 13,
    fontStyle: 'italic',
    flex: 1,
  },

  // Bloque de inputs
  inputBlock: {
    gap: 16,
  },
  // Cuando no hay series arriba, el bloque de inputs necesita su propia
  // separación respecto al contexto (con series la aporta resultsBlock).
  inputBlockSpaced: {
    marginTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  inputField: {
    flex: 1,
    gap: 7,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  bigInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    minHeight: 66,
    paddingHorizontal: 12,
    fontSize: 30,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: theme.colors.text,
    fontWeight: '800',
  },
  timesGlyph: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textMuted,
    marginBottom: 18,
  },

  // Botón principal añadir
  addButton: {
    minHeight: 58,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...theme.shadow.soft,
  },
  addButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  addButtonText: {
    color: theme.colors.darkGray,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.3,
  },

  // Botones secundarios
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  deleteButton: {
    borderColor: theme.colors.error + '50',
    backgroundColor: theme.colors.error + '15',
  },
  finishButton: {
    borderColor: theme.colors.success + '50',
    backgroundColor: theme.colors.success + '15',
  },
  notesButton: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.darkGray,
  },
  secondaryButtonText: {
    fontWeight: '700',
    fontSize: 13,
  },
  buttonPressed: {
    opacity: 0.75,
  },

  // Completado
  completedBlock: {
    gap: 8,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedText: {
    color: theme.colors.success,
    fontWeight: '700',
    fontSize: 14,
  },
  undoButton: {
    flex: 0,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
  },

  // Cronómetro
  stopwatchContainer: {
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
  stopwatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.sm,
  },
  stopwatchBtnStart: { backgroundColor: theme.colors.success },
  stopwatchBtnStop: { backgroundColor: theme.colors.error },
  stopwatchBtnUse: { backgroundColor: theme.colors.primary },
  stopwatchButtonText: {
    color: theme.colors.darkGray,
    fontWeight: '800',
    fontSize: 14,
  },
});
