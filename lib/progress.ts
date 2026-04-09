import { ExerciseLog, ParsedSet, WorkoutLog } from '../types';

interface ImprovementResult {
  isImproved: boolean;
  percent: number;
}

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
    return { isImproved: true, percent: 30 };
  }

  if (previousScore <= 0 && currentScore <= 0) {
    return null;
  }

  const deltaPct = ((currentScore - previousScore) / previousScore) * 100;
  return { isImproved: deltaPct > 0, percent: Math.abs(deltaPct) };
}
