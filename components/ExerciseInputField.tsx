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
import { LinearGradient } from 'expo-linear-gradient';
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
import { AppModal } from './AppModal';
import { Button } from './Button';

// Transiciones reutilizables para recolocar y mostrar/ocultar contenido
const layoutTransition = LinearTransition.duration(220).easing(
  Easing.inOut(Easing.ease)
);
const fadeIn = FadeIn.duration(180);
const fadeOut = FadeOut.duration(140);

// Sombreado del "peldaño" del pliegue al pie de la tarjeta: misma tinta y mismos
// cortes que las flechas laterales de la hero card (ver HeroCarousel), pero en
// vertical: intensa en el borde inferior y desvanecida a nada hacia el centro,
// para que la barra se lea como un escalón tallado en la tarjeta y no como un
// botón pegado encima.
const STEP_SHADE_STOPS = [0, 0.35, 0.72, 1];

// × de borrado de una serie: diámetro del aspa en la esquina de la burbuja.
const SERIE_REMOVE_SIZE = 16;

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
  // Borra la serie del índice dado (la × de su burbuja). Sustituye al antiguo
  // "Borrar última serie": cualquier serie mal metida se quita desde su propio
  // registro, sin arrastrar las de después.
  onRemoveSet: (index: number) => void;
  onFinishExercise: () => void;
  // El evento solo llega cuando lo dispara un toque directo (el bloque de nota);
  // desde el menú de acciones se invoca sin él.
  onNotesPress: (event?: GestureResponderEvent) => void;
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
  exerciseName,
  catalogId,
  onAssignGif,
  target,
  addedSets,
  onAddSet,
  onInvalidAdd,
  onRemoveSet,
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

  // Sube/baja el peso en kilos enteros desde el valor actual (o el sugerido si el
  // campo está vacío), sin bajar de 0. Si el valor tenía decimales, la flecha lo
  // lleva al entero contiguo en el sentido pulsado (61,5 → arriba 62 / abajo 61).
  const stepWeight = (dir: 1 | -1) => {
    const base = parseTypedNumber(
      weightValue.trim() || getWeightPlaceholder() || '0'
    );
    const safe = isNaN(base) ? 0 : base;
    const next = dir > 0 ? Math.floor(safe) + 1 : Math.ceil(safe) - 1;
    setWeightValue(localizeDecimals(String(Math.max(0, next))));
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

  // Acciones poco frecuentes del ejercicio (saltar, nota, cronómetro): viven en
  // el ⋯ de la cabecera en vez de en una fila de botones bajo "Añadir serie".
  // Es un botón VISIBLE con su icono, el mismo patrón del ⋯ de `GlassTopBar` y
  // del historial de Inicio; nada queda tras un gesto oculto.
  const [showActions, setShowActions] = useState(false);

  // Cronómetro para ejercicios medidos en tiempo
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  // El panel del cronómetro se despliega desde el ⋯. Una vez en marcha (o con
  // una medida sin usar) se queda a la vista solo, para no esconder la cuenta.
  const [showStopwatch, setShowStopwatch] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const isTimeBased = !!(
    target?.reps && /\d+\s*(s\b|seg|sec|min)/i.test(target.reps)
  );

  // El panel del cronómetro está a la vista si se ha abierto desde el ⋯, si está
  // corriendo o si dejó una medida aún sin volcar a las repeticiones.
  const stopwatchVisible = showStopwatch || timerRunning || timerSeconds > 0;

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
            style={styles.serieTagWrap}
          >
            <View
              style={[
                styles.serieTag,
                expanded && styles.serieTagEditable,
                { backgroundColor: cardAccent + '2E' },
              ]}
            >
              <Text style={[styles.serieTagText, { color: cardAccent }]}>
                {set.weight === -1 || set.reps === -1
                  ? '—'
                  : localizeDecimals(`${set.weight}×${set.reps}`)}
              </Text>
            </View>
            {/* Borrado por registro: la × quita ESA serie. Va DENTRO de la
                burbuja, en su esquina superior derecha (el dato se lee de
                izquierda a derecha, así que la acción cierra por el final y no
                tapa el número). Solo con la tarjeta desplegada: plegada las
                burbujas son resumen y no hay nada que editar. */}
            {expanded && (
              <Pressable
                style={({ pressed }) => [
                  styles.serieTagRemove,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => onRemoveSet(idx)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('Borrar serie {n}', { n: idx + 1 })}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={11}
                  color={theme.colors.white}
                />
              </Pressable>
            )}
          </Animated.View>
        ))}
        {/* Añadir serie, encogido al tamaño de una burbuja y a la derecha de la
            última: con series ya metidas el CTA no necesita explicarse, así que
            se queda en el "+". No aparece con la tarjeta plegada (no se puede
            teclear) ni con el ejercicio completado (no hay nada que añadir). */}
        {expanded && !isMaxSetsReached && (
          <Animated.View
            entering={fadeIn}
            exiting={fadeOut}
            layout={layoutTransition}
          >
            <Pressable
              style={({ pressed }) => [
                styles.addChip,
                { backgroundColor: theme.colors.primaryFill },
                pressed && styles.addButtonPressed,
              ]}
              onPress={handleAddSet}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('Añadir serie')}
            >
              <MaterialCommunityIcons
                name="plus"
                size={20}
                color={theme.colors.onGold}
              />
            </Pressable>
          </Animated.View>
        )}
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

      {/* Cabecera: GIF + título + ⋯. El GIF ocupa el sitio que tenía el número
          de orden, y grande: la miniatura en movimiento dice QUÉ ejercicio es,
          que es lo que se busca al mirar la tarjeta; el "3" solo decía cuántas
          van. Cada control es su propio Pressable (nada anidado) y el plegado
          vive en la barra del pie (styles.collapseBar). */}
      <View
        style={[
          styles.header,
          // Colapsada: sin margen inferior (el bloque de resultados aporta su
          // propia separación; evita doble hueco bajo la cabecera).
          !expanded && styles.headerCollapsedEmpty,
        ]}
      >
        <ExerciseGifButton
          name={exerciseName}
          catalogId={catalogId}
          onAssign={onAssignGif}
          size={26}
          style={styles.headerGif}
        />
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
        {/* Acciones del ejercicio (saltar, nota, cronómetro). En la cabecera y
            no bajo el CTA: son raras, y aquí siguen accesibles incluso con la
            tarjeta plegada (antes había que desplegarla para tocar la nota). */}
        <Pressable
          style={({ pressed }) => [
            styles.headerAction,
            { borderColor: cardAccent + '40' },
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setShowActions(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('Más acciones')}
        >
          <MaterialCommunityIcons
            name="dots-horizontal"
            size={20}
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

      {/* Sección inferior desplegable: inputs, series insertadas y estado.
          Wrapper persistente (igual que la superior) para que `exiting` se
          reproduzca al colapsar. */}
      <View
        style={[
          styles.bottomSection,
          !expanded && styles.bottomSectionCollapsed,
        ]}
      >
        {/* Estado: en progreso — las cajas de peso × reps */}
        {expanded && !isMaxSetsReached && (
          <Animated.View
            entering={fadeIn}
            exiting={fadeOut}
            layout={layoutTransition}
            style={styles.inputBlock}
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

            {/* Botón principal: añadir serie. Solo mientras la tarjeta está
                vacía, que es cuando hay que decir qué hace; en cuanto entra la
                primera serie se encoge al "+" que acompaña a las burbujas (ver
                renderSeriesRow), y así el CTA deja de comerse una fila entera. */}
            {!hasAddedSets && (
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
            )}
          </Animated.View>
        )}

        {/* Series insertadas (peso × reps), justo BAJO las cajas: lo que acabas
            de meter aparece donde ya estás mirando al teclear. Se pinta también
            con la tarjeta plegada o completada, que es cuando resume el
            ejercicio entero; con `layout` se desliza al desplegar y colapsar. */}
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

        {/* Cronómetro del ejercicio, bajo las series. Borrar ya no vive aquí:
            cada burbuja lleva su × y esta fila desaparece si no hay cronómetro. */}
        {expanded && !isMaxSetsReached && isTimeBased && stopwatchVisible && (
          <Animated.View
            entering={fadeIn}
            exiting={fadeOut}
            layout={layoutTransition}
            style={styles.afterSeriesBlock}
          >
            {/* Cronómetro (ejercicios basados en tiempo). Se despliega desde el
                ⋯, y se queda a la vista mientras corre o mientras haya una
                medida sin usar. */}
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

      {/* Pliegue de la tarjeta: barra ancha y baja al pie, con el mismo peldaño
          sombreado que las flechas laterales de la hero card. Antes era un aro de
          38 en la cabecera, que le comía el ancho al nombre del ejercicio (los
          títulos largos caían a tres líneas). Va la última, incluso bajo el
          descanso, porque es el borde inferior de la tarjeta. */}
      <Pressable
        style={({ pressed }) => [
          styles.collapseBar,
          pressed && styles.collapseBarPressed,
        ]}
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? t('Plegar ejercicio') : t('Desplegar ejercicio')
        }
      >
        <LinearGradient
          colors={theme.gradients.heroStep}
          locations={STEP_SHADE_STOPS}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={cardAccent}
        />
      </Pressable>

      {/* Acciones raras del ejercicio. Mismo formato que el selector de
          disciplina de "Añadir" en Cardio: las opciones van en el cuerpo, con
          su color y su borde propios, y el pie queda solo para "Volver" (gris,
          secundario). Antes las cuatro se pintaban como `Button` secundario y
          salir parecía una acción más de la lista. */}
      <AppModal
        visible={showActions}
        onRequestClose={() => setShowActions(false)}
        title={exerciseName}
        icon="dots-horizontal-circle-outline"
        footer={
          <Button
            title={t('Volver')}
            variant="secondary"
            size="medium"
            onPress={() => setShowActions(false)}
          />
        }
      >
        <View style={styles.actionsList}>
          <Pressable
            style={({ pressed }) => [
              styles.optionButton,
              pressed && styles.optionButtonPressed,
            ]}
            onPress={() => {
              setShowActions(false);
              onNotesPress();
            }}
          >
            <MaterialCommunityIcons
              name="note-text-outline"
              size={20}
              color={theme.colors.white}
            />
            <Text style={styles.optionButtonText}>
              {notes ? t('Editar nota') : t('Añadir nota')}
            </Text>
          </Pressable>

          {/* Cronómetro solo en ejercicios medidos en tiempo (plancha, etc.). */}
          {isTimeBased && (
            <Pressable
              style={({ pressed }) => [
                styles.optionButton,
                pressed && styles.optionButtonPressed,
              ]}
              onPress={() => {
                setShowActions(false);
                setShowStopwatch(true);
              }}
            >
              <MaterialCommunityIcons
                name="timer-outline"
                size={20}
                color={theme.colors.white}
              />
              <Text style={styles.optionButtonText}>
                {t('Cronómetro del ejercicio')}
              </Text>
            </Pressable>
          )}

          {/* Cierra el ejercicio rellenando con guiones (series omitidas) las
              que falten hasta el objetivo. Ya completado no hay nada que
              saltar, así que no se ofrece. */}
          {!isMaxSetsReached && (
            <Pressable
              style={({ pressed }) => [
                styles.optionButton,
                pressed && styles.optionButtonPressed,
              ]}
              onPress={() => {
                setShowActions(false);
                onFinishExercise();
              }}
            >
              <MaterialCommunityIcons
                name="skip-forward"
                size={20}
                color={theme.colors.white}
              />
              <Text style={styles.optionButtonText}>
                {hasAddedSets ? t('Saltar resto') : t('Saltar ejercicio')}
              </Text>
            </Pressable>
          )}
        </View>
      </AppModal>
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
      <MaterialCommunityIcons name={icon} size={22} color={accent} />
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
      paddingBottom: 0,
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
    // El GIF hereda el hueco del número de orden, pero más grande: a 34 px la
    // figura no se distinguía, y aquí es la señal principal de la cabecera.
    headerGif: {
      width: 52,
      height: 52,
      borderRadius: 14,
    },
    // ⋯ de acciones del ejercicio. Mismo tamaño que la lupa del GIF, con la
    // que comparte fila.
    headerAction: {
      width: 34,
      height: 34,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nameWrap: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 20,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 27,
    },

    // Resultados insertados (bloque único, bajo las cajas de peso × reps).
    // Solo margen superior: la separación con lo que venga debajo la pone ese
    // bloque (afterSeriesBlock / completedBlock), porque en React Native los
    // márgenes no se colapsan y si no se sumarían.
    resultsBlock: {
      marginTop: 16,
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
    // Envoltorio de cada burbuja: solo da el marco de posición a la ×, que va
    // absoluta DENTRO de sus límites (fuera, con offsets negativos, Android la
    // recorta). Sin padding propio, así la fila no se descuadra y el badge de
    // mejora se centra solo con las burbujas.
    serieTagWrap: {
      position: 'relative',
    },
    // × de borrar la serie: aro sin relleno en la esquina superior derecha de su
    // burbuja, con borde y aspa de la tinta de contraste. Sin fondo no compite
    // con el dato, que es lo que hay que leer. El área de toque real la agranda
    // su `hitSlop`.
    serieTagRemove: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: SERIE_REMOVE_SIZE,
      height: SERIE_REMOVE_SIZE,
      borderRadius: SERIE_REMOVE_SIZE / 2,
      borderWidth: 1,
      borderColor: theme.colors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serieTag: {
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 12,
      minWidth: 56,
      alignItems: 'center',
    },
    // Con la × dentro, el dato se aparta de ella por la derecha en vez de
    // quedar debajo.
    serieTagEditable: {
      paddingRight: 22,
    },
    serieTagText: {
      fontWeight: '800',
      fontSize: 15,
      letterSpacing: 0.2,
    },
    // "+" compacto que sustituye al CTA ancho en cuanto hay series: mismo alto
    // que una burbuja (padding vertical de `serieTag` + su línea de texto) para
    // que la fila quede pareja, pero cuadrado, porque solo lleva el icono.
    addChip: {
      width: 46,
      // Alto de una burbuja: su padding vertical (9+9) más la línea de su
      // texto de 15. Así la fila queda pareja aunque el chip no lleve texto.
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadow.soft,
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

    // Bloque de inputs. Encabeza siempre la mitad inferior de la tarjeta (las
    // series van ahora debajo), así que se separa él mismo del contexto.
    inputBlock: {
      gap: 16,
      marginTop: 16,
    },
    // Acciones bajo las series (deshacer, cronómetro).
    afterSeriesBlock: {
      gap: 16,
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
      // Separación mínima: el hueco que sobraba entre la caja y las flechas se
      // lo quedan las flechas, que son el objetivo táctil a agrandar.
      gap: 4,
    },
    bigInput: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      minHeight: 66,
      // Menos padding lateral para devolverle al número el ancho que se llevan
      // las flechas: siguen cabiendo los mismos dígitos que antes.
      paddingHorizontal: 8,
      fontSize: 30,
      textAlign: 'center',
      textAlignVertical: 'center',
      color: theme.colors.text,
      fontWeight: '800',
    },
    // Flechas +/-: 44 de ancho (objetivo táctil recomendado) y separación corta
    // entre ellas, así cada una queda alta y fácil de acertar con el pulgar sin
    // mirar.
    stepperCol: {
      width: 44,
      gap: 4,
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

    buttonPressed: {
      opacity: 0.75,
    },

    // Completado
    completedBlock: {
      gap: 8,
      // Separación con las series, que ahora quedan justo encima.
      marginTop: 16,
    },

    // Opciones del ⋯ dentro del modal. Copia del selector de disciplina de
    // Cardio (components/CardioInputField.tsx): si se toca uno, tocar el otro.
    actionsList: {
      marginTop: 12,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.primaryMuted,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    optionButtonPressed: {
      opacity: 0.8,
    },
    optionButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.white,
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

    // Barra de pliegue al pie: ancha y baja, a sangre (anula el padding de 16
    // de la tarjeta) y con las esquinas inferiores de la propia tarjeta, para
    // que se lea como su base y no como un botón apoyado encima.
    collapseBar: {
      // Pegada a lo que tiene encima: la flecha es el cierre de la tarjeta, y el
      // hueco que había antes hacía la tarjeta más alta sin decir nada.
      marginTop: 4,
      marginHorizontal: -16,
      marginBottom: -16,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderBottomLeftRadius: theme.borderRadius.md,
      borderBottomRightRadius: theme.borderRadius.md,
    },
    collapseBarPressed: {
      opacity: 0.7,
    },

    // Temporizador de descanso (al pie de la tarjeta). Bloque dorado; el contenido
    // (label + cuenta atrás + acciones) lo aporta el padre con sus propios estilos.
    restTimerInside: {
      marginTop: 12,
      backgroundColor: theme.colors.primaryFill,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 10,
      paddingHorizontal: 14,
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
