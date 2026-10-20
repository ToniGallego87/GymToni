import { subscribeTheme } from '@lib/themeStore';
import React, { useState, useRef, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Keyboard,
  Vibration,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  ZoomIn,
} from 'react-native-reanimated';
import { ParsedSet, ExerciseLog } from '../types';
import { theme } from '@lib/theme';
import { language, localizeDecimals, parseTypedNumber, t } from '@lib/i18n';
import {
  MAX_SET_REPS,
  MAX_SET_WEIGHT_KG,
  parseSeriesString,
} from '@lib/parsers';
import { getImprovementColor } from '@lib/utils';
import { GradientFill } from './GradientFill';
import { TrendDelta } from './TrendDelta';
import { AnchorMenu, AnchorMenuItem } from './AnchorMenu';

// Transiciones reutilizables para recolocar y mostrar/ocultar contenido
const layoutTransition = LinearTransition.duration(220).easing(
  Easing.inOut(Easing.ease)
);
const fadeIn = FadeIn.duration(180);
const fadeOut = FadeOut.duration(140);
// La burbuja de la serie recién metida entra con un pequeño "pop" (crece y se
// pasa un poco antes de asentarse): se nota de reojo, un fundido no.
const bubblePop = ZoomIn.duration(260).easing(Easing.out(Easing.back(2.2)));

// Toque del vibrador al apuntar una serie: corto, de confirmación, nada que
// ver con el aviso largo del fin del descanso.
const ADD_SET_VIBRATION_MS = 18;
// Al borrar una serie, DOS toques cortos ("tac-tac", [espera, vibra, espera,
// vibra] en ms): se distingue sin mirar del toque único de añadir.
const REMOVE_SET_VIBRATION = [0, 22, 90, 22];
// Cada paso de − / + (también al mantener pulsado): un roce apenas
// perceptible, como el "clic" de una rueda con muescas.
const STEP_VIBRATION_MS = 6;
// Ritmo fijo de la repetición al mantener pulsado − / + (~8 pasos por
// segundo): rápido para recorrer, pero se sigue con la vista y con el dedo.
const HOLD_REPEAT_MS = 120;

// × de borrado de una serie: diámetro del aspa en la esquina de la burbuja.
const SERIE_REMOVE_SIZE = 16;

// Medidas de un campo (rótulo, hueco y la caja de la cifra): con ellas se centra
// el "×" a la altura de las cifras, no de las flechas de debajo.
const INPUT_LABEL_HEIGHT = 16;
const INPUT_FIELD_GAP = 7;
const INPUT_HEIGHT = 56;
const TIMES_GLYPH_LINE = 28;
// Línea de la nota del ejercicio: su alto mínimo (una línea).
const NOTE_LINE_HEIGHT = 18;

// Motivo por el que "Añadir serie" no se pudo completar, para que el padre
// muestre el aviso correcto en vez de un "rellena los datos" genérico.
export type InvalidAddReason = 'empty' | 'format' | 'negative' | 'too-large';

// Redondea a cuarto de kilo: el peso sugerido en descarga queda siempre en un
// valor entero o con decimales .25/.5/.75 (nada de 63,8 kg imposibles de poner).
const roundToQuarter = (n: number): number => Math.round(n * 4) / 4;

// Factor del peso recomendado en descarga: ~75% (punto medio del 70-80%) del
// peso de la semana anterior.
const DELOAD_WEIGHT_FACTOR = 0.75;

// La serie que entraría al pulsar "Añadir" (lo tecleado o, si no, lo sugerido),
// o por qué no se puede añadir.
type PendingSet =
  | { ok: true; set: ParsedSet }
  | { ok: false; reason: InvalidAddReason };

interface ExerciseInputFieldProps {
  target?: {
    sets?: number;
    reps?: string;
  };
  addedSets: ParsedSet[];
  // Índices de `addedSets` que baten el récord del ejercicio: burbuja en oro.
  recordSetIndexes?: Set<number>;
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
  // Nota del ejercicio: se escribe en la propia tarjeta y se autoguarda (como la
  // de la sesión); borrarla es vaciarla.
  onNotesChange: (text: string) => void;
  notes?: string;
  previousLog?: ExerciseLog | null;
  improvement?: { isImproved: boolean; percent: number } | null;
  accent?: string;
  // Entrada del CONTENIDO (no del marco) al montarse: el registro la usa al
  // cambiar de ejercicio. El marco (borde y fondo) no se anima: aparece en el
  // mismo frame en que se va el anterior y se lee como la misma tarjeta.
  contentEntering?: React.ComponentProps<typeof Animated.View>['entering'];
  // Ejercicio ADICIONAL (lib/extraExercises): anillo azul bajo el borde de oro,
  // como su casilla.
  extra?: boolean;
  // Semana de descarga: sin porcentaje ni comparación con la anterior, y el peso
  // por defecto en la casilla baja al ~75% del de la semana previa.
  deload?: boolean;
  // Salto de las flechas del peso (`weightStepFromHistory`); 1 kg por defecto.
  weightStep?: number;
}

/**
 * Panel del ejercicio elegido en la ruleta del registro: siempre abierto y sin
 * GIF ni nombre (los lleva la casilla elegida, justo encima y con el mismo
 * borde de oro). Arriba la vez anterior y el ⋯; debajo las casillas de peso ×
 * reps con sus flechas, el botón de añadir y las series metidas.
 */
export function ExerciseInputField({
  target,
  addedSets,
  recordSetIndexes,
  onAddSet,
  onInvalidAdd,
  onRemoveSet,
  onFinishExercise,
  onNotesChange,
  notes,
  previousLog,
  improvement,
  accent = theme.colors.primary,
  contentEntering,
  extra = false,
  deload = false,
  weightStep = 1,
}: ExerciseInputFieldProps) {
  // Lo TECLEADO en cada casilla; null = sin tocar, y entonces la casilla enseña
  // el valor sugerido como texto de verdad (no como pista gris): lo que se ve es
  // lo que se guarda. Vaciarla a mano ('') es distinto de no tocarla.
  const [weightValue, setWeightValue] = useState<string | null>(null);
  const [repsValue, setRepsValue] = useState<string | null>(null);
  // "Siguiente" en el teclado del peso salta a las reps.
  const repsInputRef = useRef<TextInput>(null);

  // Repetición de los steppers +/- mientras se mantiene pulsado.
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };
  // Arranca con el pulsado largo (el toque suelto da su paso en `onPress`):
  // primer paso inmediato y luego a RITMO FIJO, con su roce del vibrador en
  // cada paso: la cifra y el dedo van al mismo compás. Antes aceleraba (hasta
  // 45 ms entre pasos) y no se podía seguir ni parar donde se quería.
  const startHold = (fn: () => void) => {
    stopHold();
    fn();
    const tick = () => {
      fn();
      holdTimerRef.current = setTimeout(tick, HOLD_REPEAT_MS);
    };
    holdTimerRef.current = setTimeout(tick, HOLD_REPEAT_MS);
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

  // Sube/baja el peso a saltos de `weightStep` (lo que sueles subir en este
  // ejercicio: 2,5 en barra, 2 en mancuernas…) desde el valor actual (o el
  // sugerido si el campo está vacío), sin bajar de 0. Un valor fuera de la
  // rejilla va al escalón contiguo en el sentido pulsado (61 con saltos de 2,5
  // → arriba 62,5 / abajo 60).
  // Con actualización FUNCIONAL (sobre el valor vigente, no el de este render):
  // al mantener pulsado, el temporizador repite siempre la misma función, y
  // leyendo el valor del render en que empezó la pulsación cada paso volvía a
  // escribir el mismo número y la cifra no avanzaba.
  const stepWeight = (dir: 1 | -1) => {
    const suggested = localizeDecimals(getWeightPlaceholder());
    setWeightValue((prev) => {
      const base = parseTypedNumber((prev ?? suggested).trim() || '0');
      const safe = isNaN(base) ? 0 : base;
      const steps = safe / weightStep;
      const next =
        dir > 0
          ? (Math.floor(steps + 1e-9) + 1) * weightStep
          : (Math.ceil(steps - 1e-9) - 1) * weightStep;
      const rounded = Math.round(Math.max(0, next) * 100) / 100;
      return localizeDecimals(String(rounded));
    });
  };
  // Sube/baja reps o segundos en unidades enteras, sin bajar de 0.
  const stepReps = (dir: 1 | -1) => {
    const suggested = getRepPlaceholder();
    setRepsValue((prev) => {
      const base = parseTypedNumber((prev ?? suggested).trim() || '0');
      const safe = isNaN(base) ? 0 : Math.round(base);
      return String(Math.max(0, safe + dir));
    });
  };

  // Campo de la nota, en la tarjeta. Se ve si hay nota o si se ha abierto desde
  // el ⋯; vacío y sin foco, se recoge.
  const hasNote = !!notes?.trim();
  const [noteOpen, setNoteOpen] = useState(false);
  const noteInputRef = useRef<TextInput>(null);
  const [noteFocusRequest, setNoteFocusRequest] = useState(0);
  const openNote = () => {
    setNoteOpen(true);
    setNoteFocusRequest((n) => n + 1);
  };
  useEffect(() => {
    if (!noteFocusRequest) return;
    // Tras el render que monta el campo.
    const id = setTimeout(() => noteInputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [noteFocusRequest]);
  const showNoteField = noteOpen || hasNote;
  // Escribiendo: el ✓ cierra el teclado (el campo es multilínea, así que
  // "Intro" salta de línea en vez de terminar).
  const [noteFocused, setNoteFocused] = useState(false);
  const deleteNote = () => {
    onNotesChange('');
    setNoteOpen(false);
    noteInputRef.current?.blur();
  };
  // Alto del campo = el de su texto. Sin fijarlo, el multiline de Android se
  // queda en su alto mínimo nativo (~48dp) y deja hueco bajo una sola línea.
  const [noteHeight, setNoteHeight] = useState(NOTE_LINE_HEIGHT);

  // Acciones poco frecuentes del ejercicio (saltar, nota, cronómetro): viven en
  // el ⋯ de la cabecera en vez de en una fila de botones bajo "Añadir serie".
  // Es un botón VISIBLE con su icono, el mismo patrón del ⋯ de `GlassTopBar` y
  // del historial de Inicio; nada queda tras un gesto oculto.
  const [showActions, setShowActions] = useState(false);
  const actionsButtonRef = useRef<View>(null);

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

  // Heurística SOLO para rotular la casilla ("Segundos" en vez de
  // "Repeticiones") cuando el objetivo se escribió en tiempo ("3x30s"). Ya NO
  // decide si hay cronómetro: eso hacía que una plancha escrita "3x30" (sin la
  // "s") no pudiera cronometrarse y no hubiera forma de pedirlo, con una regla
  // invisible sobre un texto tecleado meses atrás.
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

  // Series del PLAN (las extra no cuentan para completar): si se borra una del
  // plan con una extra ya metida, el ejercicio vuelve a estar en curso.
  const planSetCount = addedSets.filter((s) => !s.extra).length;
  const isMaxSetsReached = target?.sets ? planSetCount >= target.sets : false;
  const hasAddedSets = addedSets.length > 0;
  // Serie de MÁS con el objetivo ya cumplido (una de descarga, una porque iba
  // bien): las casillas vuelven a salir solo si se piden desde "Serie extra".
  const [extraSetOpen, setExtraSetOpen] = useState(false);
  const showInputs = !isMaxSetsReached || extraSetOpen;
  // Rótulo del botón de añadir: la serie que ENTRA, en ordinal ("Añadir 3.ª
  // serie") y "última" al llegar al objetivo. Lo hecho lo cuenta la casilla de
  // la ruleta ("2/3"). Sin objetivo, o por encima de él, la acción a secas. Con
  // objetivo de UNA serie, "última" desde el principio.
  const nextSet = planSetCount + 1;
  const addSetLabel =
    !target?.sets || isMaxSetsReached
      ? t('Añadir serie')
      : nextSet >= target.sets
      ? t('Añadir última serie')
      : t('Añadir {ord} serie', { ord: ordinal(nextSet) });

  // Al completarse (todas las series hechas) la tarjeta se tiñe de verde para
  // marcarla como terminada.
  const cardAccent = isMaxSetsReached ? theme.colors.success : accent;

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

  // Rango objetivo para el rótulo de la casilla ("REPETICIONES · 8-10").
  const targetReps = target?.reps?.trim() || null;

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
    // Sin historial: sugerir el tope del rango objetivo del ejercicio. Sin
    // rango tampoco, nada: la casilla queda vacía y pide el dato.
    return getTargetMaxRep() ?? '';
  };

  // Lo que enseña cada casilla: lo tecleado o, sin tocar, lo sugerido.
  const shownWeight = () =>
    weightValue ?? localizeDecimals(getWeightPlaceholder());
  const shownReps = () => repsValue ?? getRepPlaceholder();

  // La serie que entraría ahora: exactamente lo que enseñan las casillas.
  const readPendingSet = (): PendingSet => {
    const weightStr = shownWeight().trim();
    const repsStr = shownReps().trim();
    if (!weightStr || !repsStr) return { ok: false, reason: 'empty' };
    // El teclado español escribe coma: "22,5" es un peso válido.
    const weight = parseTypedNumber(weightStr);
    const reps = parseTypedNumber(repsStr);

    if (isNaN(weight) || isNaN(reps)) return { ok: false, reason: 'format' };
    if (weight < 0 || reps < 0) return { ok: false, reason: 'negative' };
    if (weight > MAX_SET_WEIGHT_KG || reps > MAX_SET_REPS) {
      return { ok: false, reason: 'too-large' };
    }
    // Campo vacío y sin serie anterior ni objetivo del que tirar como
    // placeholder: no hay nada que añadir, no es un valor "negativo".
    if (reps === 0) return { ok: false, reason: 'empty' };
    return { ok: true, set: { weight, reps } };
  };

  const handleAddSet = () => {
    const pending = readPendingSet();
    if (!pending.ok) {
      onInvalidAdd?.(pending.reason);
      return;
    }

    // Con el objetivo ya cumplido, la serie es de MÁS: se marca para que no
    // puntúe en la mejora.
    onAddSet(
      isMaxSetsReached ? { ...pending.set, extra: true } : pending.set
    );
    // Confirmación que se nota sin mirar: un toque corto del vibrador.
    Vibration.vibrate(ADD_SET_VIBRATION_MS);
    // Las casillas vuelven a lo sugerido, que ahora es la serie recién metida.
    setWeightValue(null);
    setRepsValue(null);
    // La serie extra es una: para otra, otra vez "Serie extra".
    if (isMaxSetsReached) setExtraSetOpen(false);
    Keyboard.dismiss();
  };

  const getPreviousSetsSummary = () => {
    if (!previousLog) return '';
    if (previousLog.parsedSets?.length) {
      return previousLog.parsedSets
        .map((s) =>
          s.weight === -1 || s.reps === -1
            ? '—'
            : `${s.extra ? '+' : ''}${s.weight}×${s.reps}`
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
    // El indicador es `TrendDelta` (el mismo que Inicio y Cardio); la píldora
    // solo aporta el fondo tintado y la animación de entrada/salida.
    const tint = getImprovementColor(
      improvement.percent === 0
        ? 'neutral'
        : improvement.isImproved
        ? 'up'
        : 'down'
    );
    return (
      <Animated.View
        entering={fadeIn}
        exiting={fadeOut}
        layout={layoutTransition}
        style={[styles.improvementBadge, { backgroundColor: tint + '22' }]}
      >
        <TrendDelta
          value={improvement.percent}
          improved={improvement.isImproved}
        />
      </Animated.View>
    );
  };

  // Las burbujas de las series metidas, cada una con su × de borrar. El
  // recuento (●●○) que iba detrás ya no está: lo dice la casilla de la ruleta.
  // La extra, con contorno discontinuo y "+": está apuntada pero no puntúa.
  const renderSeriesRow = () => {
    if (!hasAddedSets) return null;
    return (
      <View style={styles.seriesRow}>
        {addedSets.map((set, idx) => {
          const isRecord = !!recordSetIndexes?.has(idx);
          const isExtraSet = !!set.extra && !isRecord;
          return (
            <Animated.View
              key={idx}
              entering={bubblePop}
              exiting={fadeOut}
              layout={layoutTransition}
              style={styles.serieTagWrap}
            >
              <View
                style={[
                  styles.serieTag,
                  isRecord && styles.serieTagRecord,
                  // Récord en blanco (tinta invertida), no en dorado: el
                  // dorado de la app marca lo pulsable y la burbuja no lo es.
                  isExtraSet
                    ? [styles.serieTagExtra, { borderColor: cardAccent }]
                    : {
                        backgroundColor: isRecord
                          ? theme.colors.white
                          : cardAccent + '2E',
                      },
                ]}
                accessible
                accessibilityLabel={
                  isRecord
                    ? `${localizeDecimals(`${set.weight}×${set.reps}`)}. ${t(
                        'Récord personal'
                      )}`
                    : isExtraSet
                    ? `${localizeDecimals(`${set.weight}×${set.reps}`)}. ${t(
                        'Serie extra'
                      )}`
                    : undefined
                }
              >
                {isRecord && (
                  <MaterialCommunityIcons
                    name="trophy"
                    size={13}
                    color={theme.colors.background}
                  />
                )}
                <Text
                  style={[
                    styles.serieTagText,
                    { color: isRecord ? theme.colors.background : cardAccent },
                  ]}
                >
                  {set.weight === -1 || set.reps === -1
                    ? '—'
                    : `${isExtraSet ? '+' : ''}${localizeDecimals(
                        `${set.weight}×${set.reps}`
                      )}`}
                </Text>
              </View>
              {/* Borrado por registro: la × quita ESA serie. Va DENTRO de la
                burbuja, en su esquina superior derecha (el dato se lee de
                izquierda a derecha, así que la acción cierra por el final y no
                tapa el número). */}
              <Pressable
                style={({ pressed }) => [
                  styles.serieTagRemove,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  Vibration.vibrate(REMOVE_SET_VIBRATION);
                  onRemoveSet(idx);
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('Borrar serie {n}', { n: idx + 1 })}
              >
                {/* Disco lleno con la × recortada (transparente), no un aro con
                  la × dibujada: sobre la burbuja de color la marca se lee de
                  lejos y no compite con el número. */}
                <MaterialCommunityIcons
                  name="close-circle"
                  size={SERIE_REMOVE_SIZE}
                  color={
                    isRecord
                      ? theme.colors.background
                      : isExtraSet
                      ? cardAccent
                      : theme.colors.white
                  }
                />
              </Pressable>
            </Animated.View>
          );
        })}
        {renderImprovementBadge()}
      </View>
    );
  };

  // Acciones del ejercicio (saltar, nota, cronómetro). En la cabecera y no
  // bajo el CTA: son raras.
  const actionsButton = (
    <Pressable
      ref={actionsButtonRef}
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
  );

  // Contexto: la vez anterior (o el aviso de descarga), como una línea de texto
  // junto al ⋯, sin caja propia: es contexto, no una pieza que se toca. El
  // objetivo no va aquí: las series las dicen la casilla y el botón, y el rango
  // de repeticiones va en el rótulo de su campo.
  const previousSummary = getPreviousSetsSummary();
  const contextBlock = (
    <Animated.View
      entering={fadeIn}
      exiting={fadeOut}
      layout={layoutTransition}
      style={styles.contextBlock}
    >
      {/* En descarga se sustituye el "Anterior" (comparación) por el aviso
          de que el peso propuesto es una bajada respecto a la semana previa. */}
      {deload ? (
        <View style={styles.contextItem}>
          <MaterialCommunityIcons
            name="sleep"
            size={15}
            color={theme.colors.emoji_blue}
          />
          <Text style={[styles.contextLabel, styles.contextLabelDeload]}>
            {t('Descarga')}
          </Text>
          <Text style={styles.contextValue} numberOfLines={1}>
            {t('Peso sugerido más ligero')}
          </Text>
        </View>
      ) : previousSummary ? (
        <View style={styles.contextItem}>
          <MaterialCommunityIcons
            name="history"
            size={15}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.contextLabel}>{t('Anterior')}</Text>
          <Text style={styles.contextValue} numberOfLines={1}>
            {previousSummary}
          </Text>
        </View>
      ) : (
        // Primera vez con este ejercicio: se dice como lo que es, el día que
        // se marca la referencia, y no como un hueco ("Sin datos").
        <View style={styles.contextItem}>
          <MaterialCommunityIcons
            name="flag-variant-outline"
            size={15}
            color={theme.colors.primary}
          />
          <Text style={styles.contextFirstTime} numberOfLines={2}>
            {t('Primera vez: hoy marcas la referencia')}
          </Text>
        </View>
      )}
      {!deload && previousLog?.notes ? (
        <Text style={styles.previousNoteText}>"{previousLog.notes}"</Text>
      ) : null}
    </Animated.View>
  );

  // El pie de un campo: − | +, dentro de su mismo contorno. Un toque da un
  // paso y mantener lo repite.
  const stepper = (
    onStep: (dir: 1 | -1) => void,
    downLabel: string,
    upLabel: string
  ) => (
    <View style={styles.stepperRow}>
      <StepButton
        icon="minus"
        label={downLabel}
        accent={accent}
        onStep={() => onStep(-1)}
        onHoldStart={startHold}
        onHoldStop={stopHold}
      />
      <View style={styles.stepperDivider} />
      <StepButton
        icon="plus"
        label={upLabel}
        accent={accent}
        onStep={() => onStep(1)}
        onHoldStart={startHold}
        onHoldStop={stopHold}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <GradientFill accent={cardAccent} />

      {/* Todo el contenido en una pieza, para animar su entrada de una vez
          (`contentEntering`); sus bloques no hacen su propio fundido al
          montarse (`skipEntering`), solo al aparecer después. */}
      <Animated.View entering={contentEntering}>
        <LayoutAnimationConfig skipEntering>
          {/* Ni GIF ni título: los dice ya su casilla elegida (justo encima,
              con el mismo borde de oro), que es además donde se reproduce el
              GIF. La cabecera se queda en la vez anterior y el ⋯. */}
          <View style={styles.header}>
            <View style={styles.headerContext}>{contextBlock}</View>
            {actionsButton}
          </View>

          {/* Nota del ejercicio: se escribe aquí mismo y se autoguarda, como la
              de la sesión. Borrarla es vaciarla: vacía y sin foco, el campo se
              recoge. */}
          {showNoteField && (
            <Animated.View
              entering={fadeIn}
              exiting={fadeOut}
              layout={layoutTransition}
              style={styles.noteOwnBlock}
            >
              <MaterialCommunityIcons
                name="note-text-outline"
                size={15}
                color={cardAccent}
                style={styles.noteOwnIcon}
              />
              <TextInput
                ref={noteInputRef}
                style={[
                  styles.noteOwnInput,
                  { color: cardAccent, height: noteHeight },
                ]}
                value={notes ?? ''}
                onChangeText={onNotesChange}
                onContentSizeChange={(e) =>
                  setNoteHeight(
                    Math.max(
                      NOTE_LINE_HEIGHT,
                      Math.ceil(e.nativeEvent.contentSize.height)
                    )
                  )
                }
                onFocus={() => setNoteFocused(true)}
                onBlur={() => {
                  setNoteFocused(false);
                  if (!notes?.trim()) setNoteOpen(false);
                }}
                accessibilityLabel={t('Nota del ejercicio')}
                multiline
                textAlignVertical="top"
                maxLength={280}
              />
              {/* Borrar (con texto) y terminar (escribiendo), a la derecha. */}
              {hasNote && (
                <Pressable
                  onPress={deleteNote}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.noteAction,
                    pressed && styles.noteActionPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('Borrar nota')}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              )}
              {noteFocused && (
                <Pressable
                  onPress={() => noteInputRef.current?.blur()}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.noteAction,
                    styles.noteActionDone,
                    pressed && styles.noteActionPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('Terminar nota')}
                >
                  <MaterialCommunityIcons
                    name="check"
                    size={16}
                    color={theme.colors.onGold}
                  />
                </Pressable>
              )}
            </Animated.View>
          )}

          {/* En curso (o pidiendo una serie extra): las cajas de peso × reps */}
          {showInputs && (
            <Animated.View
              entering={fadeIn}
              exiting={fadeOut}
              layout={layoutTransition}
              style={styles.inputBlock}
            >
              {/* Peso y reps: cada campo es UNA pieza, la cifra arriba y − | +
                  en su pie, dentro del mismo contorno. La cifra llega rellena
                  con lo sugerido (en tinta normal: es lo que se guardará) y
                  tocarla la selecciona entera, así que teclear la sustituye. */}
              <View style={styles.inputRow}>
                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>{t('Peso · kg')}</Text>
                  <View style={styles.fieldBox}>
                    <TextInput
                      style={styles.bigInput}
                      value={shownWeight()}
                      placeholder="0"
                      placeholderTextColor={theme.colors.textMuted}
                      onChangeText={(txt) =>
                        setWeightValue(sanitizeWeightInput(txt))
                      }
                      selectTextOnFocus
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => repsInputRef.current?.focus()}
                      maxLength={6}
                      accessibilityLabel={t('Peso · kg')}
                    />
                    {stepper(stepWeight, t('Bajar peso'), t('Subir peso'))}
                  </View>
                </View>

                <Text style={styles.timesGlyph}>×</Text>

                <View style={styles.inputField}>
                  {/* El rango objetivo, junto al número que se teclea. Rótulo
                      corto ("REPS") para que quepa a la misma letra que el del
                      peso; si aun así no cabe (un rango largo), encoge. */}
                  <Text
                    style={styles.inputLabel}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {isTimeBased ? t('Segundos') : t('Reps')}
                    {targetReps ? ` · ${targetReps}` : ''}
                  </Text>
                  <View style={styles.fieldBox}>
                    <TextInput
                      ref={repsInputRef}
                      style={styles.bigInput}
                      value={shownReps()}
                      placeholder="0"
                      placeholderTextColor={theme.colors.textMuted}
                      onChangeText={(txt) => setRepsValue(sanitizeIntInput(txt))}
                      selectTextOnFocus
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={4}
                      accessibilityLabel={
                        isTimeBased ? t('Segundos') : t('Repeticiones')
                      }
                    />
                    {stepper(
                      stepReps,
                      isTimeBased
                        ? t('Bajar segundos')
                        : t('Bajar repeticiones'),
                      isTimeBased
                        ? t('Subir segundos')
                        : t('Subir repeticiones')
                    )}
                  </View>
                </View>
              </View>

              {/* Botón principal: añadir serie. Ancho, fijo bajo las casillas y
                  el MISMO en todas las series: es la acción más repetida de la
                  app y se pulsa sin mirar, con una mano. Dice la serie que entra
                  ("Añadir 3.ª serie"); el dato ya está en las casillas. */}
              <Pressable
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: theme.colors.primaryFill },
                  pressed && styles.addButtonPressed,
                ]}
                onPress={handleAddSet}
                accessibilityRole="button"
                accessibilityLabel={addSetLabel}
              >
                <MaterialCommunityIcons
                  name="plus-circle"
                  size={22}
                  color={theme.colors.onGold}
                />
                <Text style={styles.addButtonText}>{addSetLabel}</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Series insertadas (peso × reps), justo BAJO las cajas: lo que acabas
              de meter aparece donde ya estás mirando al teclear. */}
          {hasAddedSets && (
            <Animated.View
              entering={fadeIn}
              exiting={fadeOut}
              layout={layoutTransition}
              style={styles.resultsBlock}
            >
              {renderSeriesRow()}
            </Animated.View>
          )}

          {/* Objetivo cumplido: las casillas se van, y una serie de más se pide
              aquí. Enlace secundario: completar sigue pasando solo al
              siguiente ejercicio. */}
          {!showInputs && (
            <Animated.View
              entering={fadeIn}
              exiting={fadeOut}
              layout={layoutTransition}
              style={styles.extraSetBlock}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.extraSetButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setExtraSetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('Serie extra')}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.extraSetText}>{t('Serie extra')}</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Cronómetro del ejercicio, bajo las series. */}
          {showInputs && stopwatchVisible && (
            <Animated.View
              entering={fadeIn}
              exiting={fadeOut}
              layout={layoutTransition}
              style={styles.afterSeriesBlock}
            >
              {/* Sin caja ni rótulo: DÍGITOS sueltos bajo las casillas, con un
                  botón redondo de arrancar/parar. El descanso entre series es un
                  BLOQUE que se rellena de izquierda a derecha, flotando al pie;
                  este es texto liso dentro de la tarjeta, y cuenta hacia
                  arriba: se distinguen sin tener que leer. */}
              <View style={styles.stopwatchRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.stopwatchToggle,
                    timerRunning
                      ? styles.stopwatchToggleStop
                      : styles.stopwatchToggleStart,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={timerRunning ? stopTimer : startTimer}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    timerRunning ? t('Parar') : t('Cronometrar el ejercicio')
                  }
                >
                  <MaterialCommunityIcons
                    name={timerRunning ? 'stop' : 'play'}
                    size={18}
                    color={theme.colors.onDanger}
                  />
                </Pressable>
                <Text style={styles.stopwatchDisplay}>
                  {formatTimerDisplay(timerSeconds)}
                </Text>
                {timerSeconds > 0 && !timerRunning && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.stopwatchUse,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={useTimerAsReps}
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons
                      name="check"
                      size={16}
                      color={theme.colors.onGold}
                    />
                    <Text style={styles.stopwatchUseText}>
                      {t('Usar {n}s', { n: timerSeconds })}
                    </Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Acciones raras del ejercicio (nota, cronómetro, saltar): menú
              desplegable anclado al ⋯ de la cabecera, con el mismo dibujo que
              el de la barra superior. */}
          <AnchorMenu
            visible={showActions}
            onClose={() => setShowActions(false)}
            anchorRef={actionsButtonRef}
            items={[
              {
                icon: 'note-text-outline',
                label: hasNote ? t('Editar nota') : t('Añadir nota'),
                onPress: openNote,
              },
              // Cronómetro SIEMPRE: es una acción del ⋯, no estorba a nadie, y
              // antes solo existía si el objetivo llevaba escrita una unidad de
              // tiempo — justo en los isométricos donde más falta hace.
              {
                icon: 'timer-outline',
                label: t('Cronometrar el ejercicio'),
                onPress: () => setShowStopwatch(true),
              } as AnchorMenuItem,
              // Cierra el ejercicio rellenando con guiones (series omitidas) las
              // que falten hasta el objetivo. Ya completado no hay nada que
              // saltar, así que no se ofrece.
              ...(!isMaxSetsReached
                ? [
                    {
                      icon: 'skip-forward',
                      label: hasAddedSets
                        ? t('Saltar resto')
                        : t('Saltar ejercicio'),
                      onPress: onFinishExercise,
                    } as AnchorMenuItem,
                  ]
                : []),
            ]}
          />
        </LayoutAnimationConfig>
      </Animated.View>
      {extra && <View pointerEvents="none" style={styles.extraRing} />}
    </View>
  );
}

// Ordinal de la serie para el botón de añadir: "3.ª" / "3rd".
function ordinal(n: number): string {
  if (language !== 'en') return `${n}.ª`;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

// Flecha +/- de un stepper: un toque da un paso y mantener pulsado lo repite
// (acelerando). Nada se aplica al APOYAR el dedo: antes el primer paso iba en
// `onPressIn`, y arrastrar para hacer scroll empezando sobre la flecha subía
// el peso. `onPress` y `onLongPress` no llegan si el scroll se queda el gesto.
function StepButton({
  icon,
  label,
  accent,
  onStep,
  onHoldStart,
  onHoldStop,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  accent: string;
  onStep: () => void;
  onHoldStart: (fn: () => void) => void;
  onHoldStop: () => void;
}) {
  // Cada paso lleva su roce del vibrador, también los que repite el mantener.
  const step = () => {
    Vibration.vibrate(STEP_VIBRATION_MS);
    onStep();
  };
  return (
    <Pressable
      onPress={step}
      onLongPress={() => onHoldStart(step)}
      delayLongPress={320}
      onPressOut={onHoldStop}
      // Solo hacia abajo: hacia arriba está la cifra.
      hitSlop={{ bottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.stepBtn,
        pressed && styles.stepBtnPressed,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={24} color={accent} />
    </Pressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    // El mismo borde de oro que su casilla elegida, para que se lea que van
    // juntos.
    container: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      marginTop: 8,
      marginBottom: 8,
      padding: 13,
      borderWidth: 3,
      borderColor: theme.colors.primaryLine,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    // Anillo azul del adicional, por dentro del borde de oro.
    extraRing: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderWidth: 3,
      borderColor: theme.colors.emoji_blue,
      borderRadius: theme.borderRadius.md - 3,
    },

    // Cabecera: la vez anterior a la izquierda y el ⋯ a la derecha, arriba los
    // dos (la nota anterior puede alargar el contexto).
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 6,
    },
    headerContext: {
      flex: 1,
      minWidth: 0,
    },
    headerAction: {
      width: 34,
      height: 34,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Resultados insertados (bloque único, bajo las cajas de peso × reps).
    // Solo margen superior: la separación con lo que venga debajo la pone ese
    // bloque, porque en React Native los márgenes no se colapsan.
    resultsBlock: {
      marginTop: 16,
    },
    seriesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    // Envoltorio de cada burbuja: solo da el marco de posición a la ×, que va
    // absoluta DENTRO de sus límites (fuera, con offsets negativos, Android la
    // recorta).
    serieTagWrap: {
      position: 'relative',
    },
    // × de borrar la serie, en la esquina superior derecha de su burbuja. Sin
    // borde ni fondo propios: la forma la pone el icono `close-circle`. El área
    // de toque real la agranda su `hitSlop`.
    serieTagRemove: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: SERIE_REMOVE_SIZE,
      height: SERIE_REMOVE_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Con la × dentro, el dato se aparta de ella por la derecha.
    serieTag: {
      paddingLeft: 13,
      paddingRight: 22,
      paddingVertical: 9,
      borderRadius: 12,
      minWidth: 56,
      alignItems: 'center',
    },
    // Récord: trofeo delante del dato, en la misma burbuja.
    serieTagRecord: {
      flexDirection: 'row',
      gap: 4,
    },
    // Serie extra: sin relleno y con contorno discontinuo del acento (el
    // `borderColor` lo pone quien la pinta): apuntada, pero aparte del plan.
    // El padding cede lo que gana el borde para medir lo mismo que las demás.
    serieTagExtra: {
      borderWidth: 1.5,
      borderStyle: 'dashed',
      paddingLeft: 11.5,
      paddingRight: 20.5,
      paddingVertical: 7.5,
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

    // Contexto (anterior o aviso de descarga): texto suelto, sin caja. Alto
    // mínimo el del ⋯ para que la línea quede centrada con él.
    contextBlock: {
      minHeight: 34,
      justifyContent: 'center',
      gap: 3,
    },
    contextItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    contextLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    contextLabelDeload: {
      color: theme.colors.emoji_blue,
    },
    contextValue: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      flex: 1,
    },
    // Primera vez con el ejercicio: frase, no rótulo + dato.
    contextFirstTime: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    previousNoteText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
      paddingLeft: 21,
    },

    // Nota propia
    noteOwnBlock: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    noteOwnIcon: {
      marginTop: 2,
    },
    noteOwnInput: {
      flex: 1,
      padding: 0,
      fontSize: 13,
      lineHeight: NOTE_LINE_HEIGHT,
      fontStyle: 'italic',
    },
    // Borrar / terminar la nota: botones redondos pequeños a la derecha.
    noteAction: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -3,
    },
    noteActionDone: {
      backgroundColor: theme.colors.primaryFill,
    },
    noteActionPressed: {
      opacity: 0.6,
    },

    // Bloque de inputs: se separa él mismo del contexto (o de la nota).
    inputBlock: {
      gap: 12,
      marginTop: 12,
    },
    // Cronómetro, bajo las series.
    afterSeriesBlock: {
      gap: 16,
      marginTop: 16,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    inputField: {
      flex: 1,
      gap: INPUT_FIELD_GAP,
    },
    inputLabel: {
      fontSize: 12,
      // Alto fijo: si el rótulo encoge para caber, la casilla no sube.
      lineHeight: INPUT_LABEL_HEIGHT,
      height: INPUT_LABEL_HEIGHT,
      fontWeight: '800',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      textAlign: 'center',
    },
    // Un campo = una pieza: un solo contorno redondeado con la cifra arriba y
    // − | + en el pie. Antes eran tres cajas sueltas con su borde cada una.
    fieldBox: {
      borderRadius: theme.borderRadius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      overflow: 'hidden',
    },
    // La cifra en Anton, la letra de los números grandes de la app. Sin borde
    // propio (lo pone `fieldBox`) y sin el relleno de fuente de Android, que la
    // descentra en vertical.
    bigInput: {
      height: INPUT_HEIGHT,
      paddingVertical: 0,
      paddingHorizontal: 8,
      fontSize: 30,
      lineHeight: 42,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.5,
      includeFontPadding: false,
      textAlign: 'center',
      textAlignVertical: 'center',
      color: theme.colors.text,
    },
    // Pie del campo: − | + a partes iguales (~60 × 44, 50 de alto contando
    // el `hitSlop`), separados de la cifra y entre sí por un filete.
    stepperRow: {
      flexDirection: 'row',
      height: 44,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    stepperDivider: {
      width: 1,
      backgroundColor: theme.colors.border,
    },
    stepBtn: {
      flex: 1,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnPressed: {
      backgroundColor: theme.colors.border,
    },
    // Centrado en vertical con las cifras (no con las flechas); el 1,5 es el
    // borde de `fieldBox`.
    timesGlyph: {
      fontSize: 22,
      lineHeight: TIMES_GLYPH_LINE,
      fontWeight: '800',
      color: theme.colors.textMuted,
      marginTop:
        INPUT_LABEL_HEIGHT +
        INPUT_FIELD_GAP +
        1.5 +
        (INPUT_HEIGHT - TIMES_GLYPH_LINE) / 2,
    },

    // Botón principal añadir
    addButton: {
      minHeight: 52,
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

    // "Serie extra": enlace secundario (superficie y borde neutros, tinta de
    // oro), para que no compita con nada del ejercicio ya hecho.
    extraSetBlock: {
      marginTop: 12,
      alignItems: 'flex-start',
    },
    extraSetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBg,
    },
    extraSetText: {
      color: theme.colors.primary,
      fontWeight: '800',
      fontSize: 14,
    },

    // Cronómetro del ejercicio: una fila lisa, sin caja.
    stopwatchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    stopwatchToggle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stopwatchToggleStart: { backgroundColor: theme.colors.success },
    stopwatchToggleStop: { backgroundColor: theme.colors.error },
    // Tinta de texto, NO el oro: el oro es del descanso.
    stopwatchDisplay: {
      fontSize: 30,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: 2,
      fontVariant: ['tabular-nums'],
    },
    stopwatchUse: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 'auto',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.primaryFill,
    },
    stopwatchUseText: {
      color: theme.colors.onGold,
      fontWeight: '800',
      fontSize: 14,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
