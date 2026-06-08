import { ExerciseLog, ParsedSet, WorkoutLog } from '../types';

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

function isValidSet(setItem: ParsedSet): boolean {
  return Number.isFinite(setItem.weight)
    && Number.isFinite(setItem.reps)
    && setItem.weight >= 0
    && setItem.reps > 0;
}

function getSetPerformanceScore(setItem: ParsedSet): number {
  if (!isValidSet(setItem)) return 0;

  // Para ejercicios sin carga externa, usar reps como métrica de rendimiento.
  if (setItem.weight === 0) {
    return setItem.reps;
  }

  return getEstimatedOneRepMax(setItem.weight, setItem.reps);
}

export function getEstimatedOneRepMax(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0 || weight < 0) {
    return 0;
  }
  return weight * (1 + reps / 30);
}

export function getBestSetStrengthScore(parsedSets: ParsedSet[] = []): number {
  if (!parsedSets || parsedSets.length === 0) return 0;

  return parsedSets.reduce((bestScore, setItem) => {
    const setScore = getSetPerformanceScore(setItem);
    return Math.max(bestScore, setScore);
  }, 0);
}

export function getTotalSetsStrengthScore(parsedSets: ParsedSet[] = []): number {
  if (!parsedSets || parsedSets.length === 0) return 0;

  return parsedSets.reduce((sumScore, setItem) => {
    return sumScore + getSetPerformanceScore(setItem);
  }, 0);
}

export function getExerciseStrengthScore(exerciseLog: ExerciseLog | null): number {
  if (!exerciseLog) return 0;
  return getTotalSetsStrengthScore(exerciseLog.parsedSets || []);
}

export function getWorkoutStrengthScore(workoutLog: WorkoutLog | null): number {
  if (!workoutLog) return 0;
  return workoutLog.exercises.reduce((sum, exerciseLog) => {
    return sum + getTotalSetsStrengthScore(exerciseLog.parsedSets || []);
  }, 0);
}

export function buildImprovementFromStrengthScores(
  currentScore: number,
  previousScore: number
): ImprovementResult | null {
  if (!Number.isFinite(currentScore) || !Number.isFinite(previousScore)) return null;

  if (previousScore <= 0 && currentScore > 0) {
    return { isImproved: true, percent: FIRST_TIME_IMPROVEMENT_PERCENT };
  }

  if (previousScore <= 0 && currentScore <= 0) {
    return null;
  }

  const deltaPct = ((currentScore - previousScore) / previousScore) * 100;
  return { isImproved: deltaPct > 0, percent: Math.abs(deltaPct) };
}

/**
 * Calcula el porcentaje de mejora de un ejercicio comparándolo con su versión anterior.
 * Si el porcentaje es negativo, se devuelve 0 (no se cuenta la pérdida).
 * Si no hay sesión anterior, devuelve null.
 */
export function getExerciseImprovementPercent(
  currentExercise: ExerciseLog | null,
  previousExercise: ExerciseLog | null
): number | null {
  if (!currentExercise || !previousExercise) return null;

  const currentScore = getExerciseStrengthScore(currentExercise);
  const previousScore = getExerciseStrengthScore(previousExercise);

  // Si ambos son 0, no hay mejora
  if (currentScore === 0 && previousScore === 0) return null;

  // Si el anterior era 0 pero el actual > 0, primera vez (sin baseline real)
  if (previousScore === 0 && currentScore > 0) {
    return FIRST_TIME_IMPROVEMENT_PERCENT;
  }

  // Si el anterior era > 0 y el actual es 0, pérdida (cuenta como 0)
  if (previousScore > 0 && currentScore === 0) {
    return 0;
  }

  const deltaPct = ((currentScore - previousScore) / previousScore) * 100;
  
  // Los porcentajes negativos se cuentan como 0
  return Math.max(0, deltaPct);
}
