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
