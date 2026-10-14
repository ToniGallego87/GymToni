import { ExerciseLog, ParsedSet, WorkoutLog } from '../types';
import { canonicalCatalogId, slugExerciseName } from './exerciseIdentity';

export interface ImprovementResult {
  isImproved: boolean;
  percent: number;
}

/**
 * Porcentaje de mejora que se asigna la primera vez que se registra un
 * ejercicio/sesión (no hay sesión anterior con la que comparar).
 * Se centraliza aquí para que todas las pantallas muestren el mismo valor.
 */
export const FIRST_TIME_IMPROVEMENT_PERCENT = 30;

/**
 * ¿Una serie puntúa? Descarta las que no son números y las omitidas (el "—" que
 * deja "Saltar resto" se guarda como -1). Fuente única: la usan tanto los
 * porcentajes por sesión/semana de aquí como el histórico por ejercicio
 * (`lib/exerciseProgress.ts`), que la tenían duplicada con el mismo cuerpo.
 */
export function isValidSet(setItem: ParsedSet): boolean {
  return (
    Number.isFinite(setItem.weight) &&
    Number.isFinite(setItem.reps) &&
    setItem.weight >= 0 &&
    setItem.reps > 0
  );
}

/**
 * Carga virtual (kg) que se suma SIEMPRE al peso antes de puntuar.
 * Representa que "el cuerpo también pesa": una serie sin lastre no vale 0.
 * Sin ella la puntuación usaba dos escalas incompatibles (reps a pelo cuando
 * peso 0, e1RM cuando peso > 0), y añadir poco lastre a un ejercicio de peso
 * corporal HUNDÍA la nota —salías en rojo tras mejorar—.
 * Valor 10 elegido para que una serie sin peso siga puntuando como sus reps
 * (10 × (1 + reps/30) = reps cuando reps = 15), sin romper el histórico.
 */
export const BODYWEIGHT_VIRTUAL_LOAD = 10;

/**
 * Puntuación de un set como 1RM ESTIMADO (fórmula de Epley) sobre la carga
 * virtual (peso + BODYWEIGHT_VIRTUAL_LOAD): normaliza peso y reps en un único
 * valor de fuerza. Es la unidad sobre la que se construyen todos los
 * porcentajes de la app.
 * Se eligió frente al volumen de carga (peso × reps) porque trata "subir peso
 * bajando alguna repetición" como progreso —que es lo que se espera al entrenar
 * fuerza—, no como retroceso. Sumar los e1RM de las series sigue premiando hacer
 * más series y más repeticiones.
 * La carga virtual hace la escala CONTINUA: pasar de 0 a 0,5 kg siempre sube la
 * nota, nunca la hunde.
 */
export function getSetPerformanceScore(setItem: ParsedSet): number {
  if (!isValidSet(setItem)) return 0;

  return getEstimatedOneRepMax(
    setItem.weight + BODYWEIGHT_VIRTUAL_LOAD,
    setItem.reps
  );
}

/**
 * 1RM estimado (fórmula de Epley): peso × (1 + reps/30).
 */
export function getEstimatedOneRepMax(weight: number, reps: number): number {
  if (
    !Number.isFinite(weight) ||
    !Number.isFinite(reps) ||
    reps <= 0 ||
    weight < 0
  ) {
    return 0;
  }
  return weight * (1 + reps / 30);
}

export function getTotalSetsStrengthScore(
  parsedSets: ParsedSet[] = []
): number {
  if (!parsedSets || parsedSets.length === 0) return 0;

  return parsedSets.reduce((sumScore, setItem) => {
    return sumScore + getSetPerformanceScore(setItem);
  }, 0);
}

export function getExerciseStrengthScore(
  exerciseLog: ExerciseLog | null
): number {
  if (!exerciseLog) return 0;
  return getTotalSetsStrengthScore(exerciseLog.parsedSets || []);
}

/** Ejercicio del catálogo de un apunte (una copia del catálogo → su principal). */
function catalogKey(exerciseLog: ExerciseLog): string {
  return exerciseLog.catalogId ? canonicalCatalogId(exerciseLog.catalogId) : '';
}

/**
 * ¿Se hizo realmente este ejercicio? Un ejercicio saltado puede existir en el
 * log con series vacías o a guiones: sin ninguna serie válida no puntúa.
 */
export function hasScoringSets(exerciseLog: ExerciseLog | null): boolean {
  return !!exerciseLog?.parsedSets?.some(isValidSet);
}

/**
 * Puntuaciones de dos sesiones contando SOLO los ejercicios registrados en
 * AMBAS. Un ejercicio que hoy no se hizo NO vale cero (salía un −100% que además
 * hundía el % de la sesión y el de la semana), y uno que se estrena tampoco
 * cuenta como mejora infinita: los dos casos quedan fuera de los dos lados.
 * El emparejado es por `exerciseId`; si no cuadra, por el ejercicio del
 * catálogo (el mismo ejercicio cambia de id entre rutinas, y de nombre si se
 * reescribe); y si tampoco, por nombre normalizado (apuntes sin catálogo).
 */
export function getComparableWorkoutScores(
  currentLog: WorkoutLog | null,
  previousLog: WorkoutLog | null
): { current: number; previous: number } {
  if (!currentLog || !previousLog) return { current: 0, previous: 0 };

  const previousById = new Map<string, ExerciseLog>();
  const previousByCatalog = new Map<string, ExerciseLog>();
  const previousByName = new Map<string, ExerciseLog>();
  const remember = (
    map: Map<string, ExerciseLog>,
    key: string,
    log: ExerciseLog
  ) => {
    if (key && !map.has(key)) map.set(key, log);
  };
  (previousLog.exercises || [])
    .filter(hasScoringSets)
    .forEach((exerciseLog) => {
      remember(previousById, exerciseLog.exerciseId, exerciseLog);
      remember(previousByCatalog, catalogKey(exerciseLog), exerciseLog);
      remember(
        previousByName,
        slugExerciseName(exerciseLog.exerciseName),
        exerciseLog
      );
    });

  const matched = new Set<ExerciseLog>();
  let current = 0;
  let previous = 0;

  (currentLog.exercises || []).filter(hasScoringSets).forEach((exerciseLog) => {
    const catalog = catalogKey(exerciseLog);
    const match =
      (exerciseLog.exerciseId
        ? previousById.get(exerciseLog.exerciseId)
        : undefined) ||
      (catalog ? previousByCatalog.get(catalog) : undefined) ||
      previousByName.get(slugExerciseName(exerciseLog.exerciseName));
    if (!match || matched.has(match)) return;

    matched.add(match);
    current += getExerciseStrengthScore(exerciseLog);
    previous += getExerciseStrengthScore(match);
  });

  return { current, previous };
}

/**
 * Mejora de una sesión respecto a otra, comparando solo los ejercicios que
 * tienen las dos (ver `getComparableWorkoutScores`). `null` si no hay ninguno
 * en común: no hay nada que comparar.
 */
export function buildWorkoutImprovement(
  currentLog: WorkoutLog | null,
  previousLog: WorkoutLog | null
): ImprovementResult | null {
  const { current, previous } = getComparableWorkoutScores(
    currentLog,
    previousLog
  );
  if (current <= 0 && previous <= 0) return null;
  return buildImprovementFromStrengthScores(current, previous);
}

export function buildImprovementFromStrengthScores(
  currentScore: number,
  previousScore: number
): ImprovementResult | null {
  if (!Number.isFinite(currentScore) || !Number.isFinite(previousScore))
    return null;

  if (previousScore <= 0 && currentScore > 0) {
    return { isImproved: true, percent: FIRST_TIME_IMPROVEMENT_PERCENT };
  }

  if (previousScore <= 0 && currentScore <= 0) {
    return null;
  }

  const deltaPct = ((currentScore - previousScore) / previousScore) * 100;
  return { isImproved: deltaPct > 0, percent: Math.abs(deltaPct) };
}

/** Tope de duración creíble: por encima, el dato no es un entreno seguido. */
export const MAX_WORKOUT_MINUTES = 240;
/**
 * Hueco máximo entre un ejercicio y el siguiente dentro de una sesión. Uno
 * apuntado más tarde es una corrección o un olvido metido después, no parte
 * del entreno.
 */
export const MAX_WORKOUT_GAP_MINUTES = 60;

/**
 * Duración de un entreno en minutos: del inicio de la sesión (`createdAt`, la
 * primera serie) a la última serie apuntada (el mayor `timestamp` de sus
 * ejercicios). Mide cuándo se registró, no el tiempo real bajo la barra: si
 * todo se mete al acabar sale 0.
 *
 * Las horas se recorren en orden y la sesión se corta en el primer hueco de
 * más de MAX_WORKOUT_GAP_MINUTES: un ejercicio apuntado horas después (el
 * último que se olvidó y se metió por la tarde) ya no tira toda la duración.
 * Antes la estiraba hasta pasar el tope y no se enseñaba nada. Fuera de
 * 1..MAX_WORKOUT_MINUTES devuelve 0 (no se enseña).
 */
export function workoutDurationMinutes(log: WorkoutLog): number {
  return sessionDurationMinutes(
    log.createdAt,
    (log.exercises ?? []).map((e) => e.timestamp)
  );
}

/**
 * La misma medida que `workoutDurationMinutes`, a partir del inicio y de las
 * horas de cada ejercicio sueltas: el registro la calcula en vivo, antes de
 * que exista el log guardado.
 */
export function sessionDurationMinutes(
  createdAt: number | undefined,
  timestamps: (number | undefined)[]
): number {
  if (typeof createdAt !== 'number') return 0;
  const stamps = timestamps
    .filter((ts): ts is number => typeof ts === 'number' && ts > 0)
    .sort((a, b) => a - b);
  const maxGap = MAX_WORKOUT_GAP_MINUTES * 60000;
  let end = createdAt;
  for (const ts of stamps) {
    if (ts - end > maxGap) break;
    end = Math.max(end, ts);
  }
  const minutes = Math.round((end - createdAt) / 60000);
  return minutes >= 1 && minutes <= MAX_WORKOUT_MINUTES ? minutes : 0;
}
