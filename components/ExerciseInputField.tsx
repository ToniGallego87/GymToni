import { subscribeTheme } from '@lib/themeStore';
import React, { useState, useRef, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  GestureResponderEvent,
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
import { localizeDecimals, parseTypedNumber, t } from '@lib/i18n';
import {
  MAX_SET_REPS,
  MAX_SET_WEIGHT_KG,
  parseSeriesString,
} from '@lib/parsers';
import { getImprovementDisplay } from '@lib/utils';
import { GradientFill } from './GradientFill';
import { ExerciseGifButton } from './ExerciseGifButton';

// Transiciones reutilizables para recolocar y mostrar/ocultar contenido
const layoutTransition = LinearTransition.duration(220).easing(
  Easing.inOut(Easing.ease)
);
const fadeIn = FadeIn.duration(180);
const fadeOut = FadeOut.duration(140);

// Motivo por el que "Añadir serie" no se pudo completar, para que el padre
// muestre el aviso correcto en vez de un "rellena los datos" genérico.
export type InvalidAddReason = 'empty' | 'format' | 'negative' | 'too-large';

// Redondea a cuarto de kilo: el peso sugerido en descarga queda siempre en un
// valor entero o con decimales .25/.5/.75 (nada de 63,8 kg imposibles de poner).
const roundToQuarter = (n: number): number => Math.round(n * 4) / 4;

// Factor del peso recomendado en descarga: ~75% (punto medio del 70-80%) del
// peso de la semana anterior.
const DELOAD_WEIGHT_FACTOR = 0.75;

interface ExerciseInputFieldProps {
  order: number;
  exerciseName: string;
  // Id del catálogo del ejercicio (si viene de ahí), para la lupa de consulta.
  catalogId?: string;
  // Fija un GIF al ejercicio de la rutina desde el buscador (botón Asignar).
  onAssignGif?: (catalogId: string) => void;
  target?: {
    sets?: number;
    reps?: string;
  };
  addedSets: ParsedSet[];
  onAddSet: (set: ParsedSet) => void;
  // Se invoca al pulsar "Añadir serie" sin datos válidos (p. ej. 0×0 sin caso
  // anterior que rellene los placeholders, un valor negativo o uno disparatado).
  // El padre muestra el aviso según el motivo.
  onInvalidAdd?: (reason: InvalidAddReason) => void;
  onRemoveLastSet: () => void;
  onFinishExercise: () => void;
  onNotesPress: (event: GestureResponderEvent) => void;
  notes?: string;
  previousLog?: ExerciseLog | null;
  improvement?: { isImproved: boolean; percent: number } | null;
  accent?: string;
  // Temporizador de descanso, renderizado DENTRO de la tarjeta (al pie) mientras
  // queden series. El padre decide su contenido; aquí solo se enmarca y anima la
  // altura de la tarjeta al aparecer/desaparecer.
  restTimer?: React.ReactNode;
  // El padre marca cuál es el ejercicio "en curso" (el primer incompleto del
  // día): esa tarjeta nace desplegada y se abre sola al pasar a serlo, para no
  // obligar a desplegar cada ejercicio antes de poder registrar una serie.
  isCurrent?: boolean;
  // Semana de descarga: sin porcentaje ni comparación con la anterior, y el peso
  // por defecto en la casilla baja al ~75% del de la semana previa.
  deload?: boolean;
}

export function ExerciseInputField({
  order,
  exerciseName,
  catalogId,
  onAssignGif,
  target,
  addedSets,
  onAddSet,
  onInvalidAdd,
  onRemoveLastSet,
  onFinishExercise,
  onNotesPress,
  notes,
  previousLog,
  improvement,
  accent = theme.colors.primary,
  restTimer,
  isCurrent,
  deload = false,
}: ExerciseInputFieldProps) {
  const [weightValue, setWeightValue] = useState('');
  const [repsValue, setRepsValue] = useState('');

  // Repetición acelerada de los steppers +/- mientras se mantiene pulsado.
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };
  // Primer paso inmediato; luego cada vez más rápido (mín. 45 ms entre pasos).
  const startHold = (fn: () => void) => {
    stopHold();
    fn();
    let delay = 320;
    const tick = () => {
      fn();
      delay = Math.max(45, delay * 0.82);
      holdTimerRef.current = setTimeout(tick, delay);
    };
    holdTimerRef.current = setTimeout(tick, delay);
  };
  useEffect(() => () => stopHold(), []);

  // Filtros de entrada: peso admite un solo separador decimal; reps/segundos
  // solo enteros. Bloquea cualquier carácter no numérico.
  const sanitizeWeightInput = (txt: string): string => {
    let out = txt.replace(/[^0-9.,]/g, '');
    const firstSep = out.search(/[.,]/);
    if (firstSep !== -1) {
      out =
        out.slice(0, firstSep + 1) +
        out.slice(firstSep + 1).replace(/[.,]/g, '');
    }
    return out;
  };
  const sanitizeIntInput = (txt: string): string => txt.replace(/[^0-9]/g, '');

  // Sube/baja el peso en cuartos de kilo desde el valor actual (o el sugerido si
  // el campo está vacío), sin bajar de 0.
  const stepWeight = (dir: 1 | -1) => {
    const base = parseTypedNumber(
      weightValue.trim() || getWeightPlaceholder() || '0'
    );
    const safe = isNaN(base) ? 0 : base;
    const next = Math.max(0, roundToQuarter(safe + dir * 0.25));
    setWeightValue(localizeDecimals(String(next)));
  };
  // Sube/baja reps o segundos en unidades enteras, sin bajar de 0.
  const stepReps = (dir: 1 | -1) => {
    const base = parseTypedNumber(
      repsValue.trim() || getRepPlaceholder() || '0'
    );
    const safe = isNaN(base) ? 0 : Math.round(base);
    setRepsValue(String(Math.max(0, safe + dir)));
  };

  // Secciones desplegables (contexto arriba, inputs abajo). Se renderizan de
  // forma condicional y la tarjeta reajusta su altura con `LinearTransition`
  // de Reanimated: medir la altura a mano (onLayout) para animarla fallaba en
  // el build de release (devolvía 0 y dejaba el cuerpo recortado).
  const [expanded, setExpanded] = useState(!!isCurrent);

  const toggleExpanded = () => setExpanded((prev) => !prev);

  // Al convertirse en el ejercicio en curso (el padre lo marca al completarse el
  // anterior), abrir la tarjeta si estaba colapsada. Solo en la transición
  // false→true: no pelea con el usuario si luego la cierra a mano.
  const wasCurrentRef = useRef(!!isCurrent);
  useEffect(() => {
    if (isCurrent && !wasCurrentRef.current) setExpanded(true);
    wasCurrentRef.current = !!isCurrent;
  }, [isCurrent]);

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
    setTimerSeconds(0);
  };

  const formatTimerDisplay = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleAddSet = () => {
    const weightStr = (weightValue.trim() || getWeightPlaceholder()).trim();
    const repsStr = (repsValue.trim() || getRepPlaceholder()).trim();
    // El teclado español escribe coma: "22,5" es un peso válido.
    const weight = parseTypedNumber(weightStr);
    const reps = parseTypedNumber(repsStr);

    if (isNaN(weight) || isNaN(reps)) {
      onInvalidAdd?.('format');
      return;
    }
    if (weight < 0 || reps < 0) {
      onInvalidAdd?.('negative');
      return;
    }
    if (weight > MAX_SET_WEIGHT_KG || reps > MAX_SET_REPS) {
      onInvalidAdd?.('too-large');
      return;
    }
    if (reps === 0) {
      // Campo vacío y sin serie anterior ni objetivo del que tirar como
      // placeholder: no hay nada que añadir, no es un valor "negativo".
      onInvalidAdd?.('empty');
      return;
    }

    onAddSet({ weight, reps });
    setWeightValue('');
    setRepsValue('');
    Keyboard.dismiss();
  };

  const isMaxSetsReached = target?.sets
    ? addedSets.length >= target.sets
    : false;
  const hasAddedSets = addedSets.length > 0;

  // Al completarse (todas las series hechas) la tarjeta se tiñe de verde para
  // marcarla como terminada, esté colapsada o desplegada.
  const cardAccent = isMaxSetsReached ? theme.colors.success : accent;

  const wasMaxReachedRef = useRef(isMaxSetsReached);
  useEffect(() => {
    if (isMaxSetsReached && !wasMaxReachedRef.current) {
      setExpanded(false);
    }
    wasMaxReachedRef.current = isMaxSetsReached;
  }, [isMaxSetsReached]);

  // Peso de la primera serie de la semana anterior (null si no hay historial).
  const previousFirstWeight = (): number | null => {
    if (previousLog?.parsedSets?.length) {
      const w = previousLog.parsedSets[0].weight;
      return w === -1 ? null : w;
    }
    if (
      previousLog?.rawInput &&
      previousLog.rawInput.trim() &&
      previousLog.rawInput !== '-'
    ) {
      const parsed = parseSeriesString(previousLog.rawInput);
      if (parsed.length > 0) return parsed[0].weight;
    }
    return null;
  };

  const getWeightPlaceholder = () => {
    if (addedSets.length > 0)
      return String(addedSets[addedSets.length - 1].weight);
    const prev = previousFirstWeight();
    // En descarga se sugiere ~75% del peso previo, redondeado a cuarto de kilo.
    if (deload && prev != null && prev > 0) {
      return String(roundToQuarter(prev * DELOAD_WEIGHT_FACTOR));
    }
    if (prev != null) return String(prev);
    return '0';
  };

  // Máximo del rango objetivo (p. ej. '6-8' → 8, '30-45s' → 45, '10-12/lado'
  // → 12). Se usa como sugerencia cuando no hay historial que rellenar.
  const getTargetMaxRep = () => {
    const nums = target?.reps?.match(/\d+/g);
    if (!nums?.length) return null;
    return String(Math.max(...nums.map(Number)));
  };

  const getRepPlaceholder = () => {
    if (addedSets.length > 0)
      return String(addedSets[addedSets.length - 1].reps);
    if (previousLog?.parsedSets?.length)
      return String(previousLog.parsedSets[0].reps);
    if (
      previousLog?.rawInput &&
      previousLog.rawInput.trim() &&
      previousLog.rawInput !== '-'
    ) {
      const parsed = parseSeriesString(previousLog.rawInput);
      if (parsed.length > 0) return String(parsed[0].reps);
    }
    // Sin historial: sugerir el tope del rango objetivo del ejercicio.
    return getTargetMaxRep() ?? '0';
  };

  const getPreviousSetsSummary = () => {
    if (!previousLog) return '';
    if (previousLog.parsedSets?.length) {
      return previousLog.parsedSets
        .map((s) =>
          s.weight === -1 || s.reps === -1 ? '—' : `${s.weight}×${s.reps}`
        )
        .join(' · ');
    }
    if (previousLog.rawInput?.trim() && previousLog.rawInput !== '-') {
      const parsed = parseSeriesString(previousLog.rawInput);
      if (parsed.length > 0)
        return parsed.map((s) => `${s.weight}×${s.reps}`).join(' · ');
      return previousLog.rawInput;
    }
    return '';
  };

  const renderImprovementBadge = () => {
    // En descarga no hay porcentaje ni comparación con la semana anterior.
    if (deload) return null;
    if (!improvement || !isMaxSetsReached || addedSets.length === 0)
      return null;
    const { symbol, display, kind } = getImprovementDisplay(improvement);
    const badgeBg =
      kind === 'up'
        ? styles.improvementBadgeUp
        : kind === 'down'
        ? styles.improvementBadgeDown
        : styles.improvementBadgeNeutral;
    const textStyle =
      kind === 'up'
        ? styles.improvementUp
        : kind === 'down'
        ? styles.improvementDown
        : styles.improvementNeutral;
    return (
      <Animated.View
        entering={fadeIn}
        exiting={fadeOut}
        layout={layoutTransition}
        style={[styles.improvementBadge, badgeBg]}
      >
        <Text style={[styles.improvementText, textStyle]}>
          {symbol} {display}%
        </Text>
      </Animated.View>
    );
  };

  const renderSeriesRow = () => {
    if (!hasAddedSets) return null;
    return (
      <View style={styles.seriesRow}>
        {addedSets.map((set, idx) => (
          <Animated.View
            key={idx}
            entering={fadeIn}
            exiting={fadeOut}
            layout={layoutTransition}
            style={[styles.serieTag, { backgroundColor: cardAccent + '2E' }]}
          >
            <Text style={[styles.serieTagText, { color: cardAccent }]}>
              {set.weight === -1 || set.reps === -1
                ? '—'
                : localizeDecimals(`${set.weight}×${set.reps}`)}
            </Text>
          </Animated.View>
        ))}
        {renderImprovementBadge()}
      </View>
    );
  };

  return (
    <Animated.View
      layout={layoutTransition}
      style={[styles.container, { borderColor: cardAccent }]}
    >
      <GradientFill accent={cardAccent} />

      {/* Cabecera: título + lupa de consulta + flecha. El título y la flecha
          despliegan; la lupa va aparte para no anidar Pressables. */}
      <View
        style={[
          styles.header,
          // Colapsada: sin margen inferior (el bloque de resultados aporta su
          // propia separación; evita doble hueco bajo la cabecera).
          !expanded && styles.headerCollapsedEmpty,
        ]}
      >
        <Pressable style={styles.titleSection} onPress={toggleExpanded}>
          <View style={[styles.orderBadge, { backgroundColor: cardAccent }]}>
            <Text style={styles.orderBadgeText}>{order}</Text>
          </View>
          {/* Nombre pulsable: despliega/colapsa la tarjeta. Colapsado se corta a
              dos líneas; al desplegar se ve entero (sin límite de líneas), así el
              mismo gesto hace siempre lo mismo y el nombre largo sigue accesible. */}
          <Pressable style={styles.nameWrap} onPress={toggleExpanded}>
            <Text
              style={styles.exerciseName}
              numberOfLines={expanded ? undefined : 2}
            >
              {exerciseName}
            </Text>
          </Pressable>
        </Pressable>
        <ExerciseGifButton
          name={exerciseName}
          catalogId={catalogId}
          onAssign={onAssignGif}
        />
        <Pressable
          style={[styles.headerRight, { borderColor: cardAccent + '40' }]}
          onPress={toggleExpanded}
        >
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={cardAccent}
          />
        </Pressable>
      </View>

      {/* Sección superior desplegable: contexto + nota. El wrapper se mantiene
          montado siempre (solo se alterna el contenido) para que `exiting` se
          reproduzca al colapsar con un padre estable. */}
      <View style={styles.topSection}>
        {/* Bloque de contexto: objetivo + anterior (o aviso de descarga) */}
        {expanded && (target?.sets || previousLog || deload) && (
          <Animated.View
            entering={fadeIn}
            exiting={fadeOut}
            layout={layoutTransition}
            style={styles.contextBlock}
          >
            {target?.sets && target?.reps && (
              <View style={styles.contextItem}>
                <MaterialCommunityIcons
                  name="target"
                  size={13}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.contextLabel}>{t('Objetivo')}</Text>
                <Text style={styles.contextValue}>
                  {target.sets}×{target.reps}
                </Text>
              </View>
            )}
            {/* En descarga se sustituye el "Anterior" (comparación) por el aviso
                de que el peso propuesto es una bajada respecto a la semana previa. */}
            {deload ? (
              <View style={styles.contextItem}>
                <MaterialCommunityIcons
                  name="sleep"
                  size={13}
                  color={theme.colors.emoji_blue}
                />
                <Text style={[styles.contextLabel, styles.contextLabelDeload]}>
                  {t('Descarga')}
                </Text>
                <Text style={styles.contextValue} numberOfLines={1}>
                  {t('Peso sugerido más ligero')}
                </Text>
              </View>
            ) : previousLog && getPreviousSetsSummary() ? (
              <View style={styles.contextItem}>
                <MaterialCommunityIcons
                  name="history"
                  size={13}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.contextLabel}>{t('Anterior')}</Text>
                <Text style={styles.contextValue} numberOfLines={1}>
                  {getPreviousSetsSummary()}
                </Text>
              </View>
            ) : null}
            {!deload && previousLog?.notes ? (
              <Text style={styles.previousNoteText}>"{previousLog.notes}"</Text>
            ) : null}
          </Animated.View>
        )}

        {/* Nota actual (pulsable: abre el editor de nota) */}
        {expanded && notes && (
          <Animated.View
            entering={fadeIn}
            exiting={fadeOut}
            layout={layoutTransition}
          >
            <Pressable
              style={({ pressed }) => [
                styles.noteOwnBlock,
                pressed && styles.buttonPressed,
              ]}
              onPress={onNotesPress}
            >
              <MaterialCommunityIcons
                name="note-text-outline"
                size={13}
                color={cardAccent}
              />
              <Text style={[styles.noteOwnText, { color: cardAccent }]}>
                {notes}
              </Text>
            </Pressable>
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
          style={[
            styles.resultsBlock,
            !expanded && styles.resultsBlockCollapsed,
          ]}
        >
          {renderSeriesRow()}
        </Animated.View>
      )}

      {/* Sección inferior desplegable: inputs / completado. Wrapper persistente
          (igual que la superior) para que `exiting` se reproduzca al colapsar. */}
      <View
        style={[
          styles.bottomSection,
          !expanded && styles.bottomSectionCollapsed,
        ]}
      >
        {/* Estado: en progreso */}
        {expanded && !isMaxSetsReached && (
          <Animated.View
            entering={fadeIn}
            exiting={fadeOut}
            layout={layoutTransition}
            style={[
              styles.inputBlock,
              !hasAddedSets && styles.inputBlockSpaced,
            ]}
          >
            {/* Inputs peso / reps: dos campos grandes con flechas +/- al lado */}
            <View style={styles.inputRow}>
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>{t('Peso · kg')}</Text>
                <View style={styles.inputWithStepper}>
                  <TextInput
                    style={styles.bigInput}
                    placeholder={localizeDecimals(getWeightPlaceholder())}
                    placeholderTextColor={theme.colors.textMuted}
                    value={weightValue}
                    onChangeText={(txt) =>
                      setWeightValue(sanitizeWeightInput(txt))
                    }
                    keyboardType="decimal-pad"
                    maxLength={6}
                  />
                  <View style={styles.stepperCol}>
                    <StepButton
                      icon="chevron-up"
                      accent={accent}
                      onHoldStart={() => startHold(() => stepWeight(1))}
                      onHoldStop={stopHold}
                    />
                    <StepButton
                      icon="chevron-down"
                      accent={accent}
                      onHoldStart={() => startHold(() => stepWeight(-1))}
                      onHoldStop={stopHold}
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.timesGlyph}>×</Text>

              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>
                  {isTimeBased ? t('Segundos') : t('Repeticiones')}
                </Text>
                <View style={styles.inputWithStepper}>
                  <TextInput
                    style={styles.bigInput}
                    placeholder={localizeDecimals(getRepPlaceholder())}
                    placeholderTextColor={theme.colors.textMuted}
                    value={repsValue}
                    onChangeText={(txt) => setRepsValue(sanitizeIntInput(txt))}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <View style={styles.stepperCol}>
                    <StepButton
                      icon="chevron-up"
                      accent={accent}
                      onHoldStart={() => startHold(() => stepReps(1))}
                      onHoldStop={stopHold}
                    />
                    <StepButton
                      icon="chevron-down"
                      accent={accent}
                      onHoldStart={() => startHold(() => stepReps(-1))}
                      onHoldStop={stopHold}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Botón principal: añadir serie */}
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: theme.colors.primaryFill },
                pressed && styles.addButtonPressed,
              ]}
              onPress={handleAddSet}
            >
              <MaterialCommunityIcons
                name="plus-circle"
                size={22}
                color={theme.colors.onGold}
              />
              <Text style={styles.addButtonText}>{t('Añadir serie')}</Text>
            </Pressable>

            {/* Acciones secundarias */}
            <View style={styles.secondaryRow}>
              {hasAddedSets && (
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    styles.deleteButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={onRemoveLastSet}
                >
                  <MaterialCommunityIcons
                    name="minus"
                    size={15}
                    color={theme.colors.error}
                  />
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: theme.colors.error },
                    ]}
                  >
                    {t('Borrar')}
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  styles.finishButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onFinishExercise}
              >
                <MaterialCommunityIcons
                  name="skip-forward"
                  size={15}
                  color={theme.colors.accent}
                />
                {/* Cierra el ejercicio rellenando con guiones (series omitidas)
                    las que falten hasta el objetivo. Si aún no se ha metido
                    ninguna serie no hay "resto" que saltar: es el ejercicio
                    entero, y la etiqueta lo dice. */}
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.colors.accent },
                  ]}
                  numberOfLines={1}
                >
                  {hasAddedSets ? t('Saltar resto') : t('Saltar ejercicio')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  styles.notesButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onNotesPress}
              >
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={15}
                  color={theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {t('Nota')}
                </Text>
              </Pressable>
            </View>

            {/* Cronómetro (ejercicios basados en tiempo) */}
            {isTimeBased && (
              <View style={styles.stopwatchContainer}>
                {/* Título propio: distingue este cronómetro (cuenta hacia
                    ARRIBA, mide el ejercicio) del temporizador de descanso
                    (dorado, cuenta hacia ABAJO) que aparece al pie tras
                    completar una serie. */}
                <View style={styles.stopwatchLabelRow}>
                  <MaterialCommunityIcons
                    name="timer-outline"
                    size={14}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.stopwatchLabel}>
                    {t('Cronómetro del ejercicio')}
                  </Text>
                </View>
                <Text style={styles.stopwatchDisplay}>
                  {formatTimerDisplay(timerSeconds)}
                </Text>
                <View style={styles.stopwatchButtons}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.stopwatchBtn,
                      timerRunning
                        ? styles.stopwatchBtnStop
                        : styles.stopwatchBtnStart,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={timerRunning ? stopTimer : startTimer}
                  >
                    <MaterialCommunityIcons
                      name={timerRunning ? 'stop' : 'play'}
                      size={16}
                      color={theme.colors.onDanger}
                    />
                    {/* Iniciar/Parar van sobre verde/rojo, no sobre el oro: su
                        tinta es la de estado, no la del oro (ver theme.ts). */}
                    <Text
                      style={[
                        styles.stopwatchButtonText,
                        { color: theme.colors.onDanger },
                      ]}
                    >
                      {timerRunning ? t('Parar') : t('Iniciar')}
                    </Text>
                  </Pressable>
                  {timerSeconds > 0 && !timerRunning && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.stopwatchBtn,
                        styles.stopwatchBtnUse,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={useTimerAsReps}
                    >
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color={theme.colors.onGold}
                      />
                      <Text style={styles.stopwatchButtonText}>
                        {t('Usar {n}s', { n: timerSeconds })}
                      </Text>
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
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color={theme.colors.success}
              />
              <Text style={styles.completedText}>
                {t('Completado · {a}/{b} series', {
                  a: addedSets.length,
                  b: target?.sets ?? addedSets.length,
                })}
              </Text>
            </View>
            {/* Acciones del ejercicio ya completado: deshacer la última serie y
                editar la nota. La nota debe seguir accesible aquí (antes solo
                salía su botón mientras el ejercicio estaba en progreso). */}
            <View style={styles.secondaryRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  styles.deleteButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onRemoveLastSet}
              >
                <MaterialCommunityIcons
                  name="minus"
                  size={15}
                  color={theme.colors.error}
                />
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.colors.error },
                  ]}
                >
                  {t('Borrar')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  styles.notesButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onNotesPress}
              >
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={15}
                  color={theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {t('Nota')}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Temporizador de descanso dentro de la tarjeta: aparece al pie y, al
          montarse/desmontarse, la `LinearTransition` del contenedor estira o
          encoge la tarjeta para que el descanso quede atado a su ejercicio. */}
      {restTimer && (
        <Animated.View
          entering={fadeIn}
          exiting={fadeOut}
          layout={layoutTransition}
          style={styles.restTimerInside}
        >
          {restTimer}
        </Animated.View>
      )}

    </Animated.View>
  );
}

// Flecha +/- de un stepper: mantener pulsado repite la acción (acelerando).
function StepButton({
  icon,
  accent,
  onHoldStart,
  onHoldStop,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  accent: string;
  onHoldStart: () => void;
  onHoldStop: () => void;
}) {
  return (
    <Pressable
      onPressIn={onHoldStart}
      onPressOut={onHoldStop}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.stepBtn,
        pressed && styles.stepBtnPressed,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={accent} />
    </Pressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
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
      // El fondo del badge es el acento (blanco en noche, tinta oscura en día);
      // el número usa el color de fondo del tema para contrastar en ambos: oscuro
      // sobre el badge claro de noche, claro sobre el badge oscuro de día.
      color: theme.colors.background,
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
    nameWrap: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 19,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 27,
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
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
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
      backgroundColor: theme.colors.inputBg,
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
    contextLabelDeload: {
      color: theme.colors.emoji_blue,
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
    inputWithStepper: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 6,
    },
    bigInput: {
      flex: 1,
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
    stepperCol: {
      width: 34,
      gap: 6,
    },
    stepBtn: {
      flex: 1,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnPressed: {
      backgroundColor: theme.colors.border,
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
      color: theme.colors.onGold,
      fontWeight: '800',
      fontSize: 17,
      letterSpacing: 0.3,
    },

    // Botones secundarios: acciones de bajo peso frente al héroe dorado
    // "Añadir serie". Sin relleno ni borde (nada de tarjetas que compitan);
    // solo icono + texto tintado, para que la jerarquía sea inequívoca sin
    // esconder ninguna acción (todas siguen visibles con su icono).
    secondaryRow: {
      flexDirection: 'row',
      gap: 4,
    },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: 'transparent',
    },
    // "Terminar" es la única secundaria con relieve (cierra el ejercicio):
    // un tinte muy leve de acento la diferencia de las otras dos.
    deleteButton: {},
    finishButton: {
      backgroundColor: theme.colors.accent + '12',
    },
    notesButton: {},
    secondaryButtonText: {
      fontWeight: '700',
      fontSize: 12,
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

    // Temporizador de descanso (al pie de la tarjeta). Bloque dorado; el contenido
    // (label + cuenta atrás + acciones) lo aporta el padre con sus propios estilos.
    restTimerInside: {
      marginTop: 12,
      backgroundColor: theme.colors.primaryFill,
      borderRadius: theme.borderRadius.md,
      padding: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Cronómetro
    stopwatchContainer: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      padding: 12,
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    stopwatchLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    stopwatchLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
    stopwatchBtnUse: { backgroundColor: theme.colors.primaryFill },
    stopwatchButtonText: {
      color: theme.colors.onGold,
      fontWeight: '800',
      fontSize: 14,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
