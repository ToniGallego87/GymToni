import { WorkoutLog } from '../types';
import {
  buildImprovementFromStrengthScores,
  getTotalSetsStrengthScore,
} from './progress';
import { getWeekStrengthScore } from './weeks';
import { getLogTimestamp } from './utils';

/** Ejercicio con mayor mejora respecto a la misma semana anterior. */
export interface TopImprovement {
  exerciseName: string;
  percent: number;
}

/** Mayor peso movido en una serie válida de la semana. */
export interface MaxLift {
  exerciseName: string;
  weight: number;
  reps: number;
}

/** Punto de la serie de progreso semanal (para la mini-gráfica del póster). */
export interface WeekProgressDatum {
  week: number;
  improvement: number;
}

export interface WeekAchievements {
  weekNumber: number;
  daysTrained: number;
  /** Días entrenados consecutivos sin saltarse ningún entreno de la rutina. */
  streakDays: number;
  /** La racha cubre toda la rutina: nunca se ha faltado un solo día. */
  streakIsPerfect: boolean;
  /** Mejora global de la semana respecto a la anterior (signo incluido), o null. */
  weekImprovementPercent: number | null;
  topImprovement: TopImprovement | null;
  maxLift: MaxLift | null;
  /** Mejora por semana hasta esta (para pintar la gráfica). */
  progressSeries: WeekProgressDatum[];
}

interface ExerciseAggregate {
  name: string;
  score: number;
}

// Quedarse con el log más reciente de cada día (una semana entrena cada día una vez).
function latestLogsByDay(weekLogs: WorkoutLog[]): WorkoutLog[] {
  const byDay: Record<string, WorkoutLog> = {};
  [...weekLogs]
    .sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a))
    .forEach((log) => {
      if (!log.dayId) return;
      if (!byDay[log.dayId]) byDay[log.dayId] = log;
    });
  return Object.values(byDay);
}

// Puntuación de fuerza acumulada por ejercicio (clave: exerciseId).
function aggregateExerciseScores(
  logs: WorkoutLog[]
): Map<string, ExerciseAggregate> {
  const scores = new Map<string, ExerciseAggregate>();
  logs.forEach((log) => {
    log.exercises.forEach((exercise) => {
      const score = getTotalSetsStrengthScore(exercise.parsedSets || []);
      const previous = scores.get(exercise.exerciseId);
      scores.set(exercise.exerciseId, {
        name: exercise.exerciseName,
        score: (previous?.score || 0) + score,
      });
    });
  });
  return scores;
}

// Ejercicio con mayor mejora porcentual respecto a la semana anterior.
function findTopImprovement(
  currentLogs: WorkoutLog[],
  previousLogs: WorkoutLog[]
): TopImprovement | null {
  const current = aggregateExerciseScores(currentLogs);
  const previous = aggregateExerciseScores(previousLogs);

  let best: TopImprovement | null = null;
  current.forEach((aggregate, exerciseId) => {
    const previousScore = previous.get(exerciseId)?.score || 0;
    if (previousScore <= 0) return; // Sin referencia anterior no es una "mejora".

    const improvement = buildImprovementFromStrengthScores(
      aggregate.score,
      previousScore
    );
    if (!improvement || !improvement.isImproved) return;

    if (!best || improvement.percent > best.percent) {
      best = { exerciseName: aggregate.name, percent: improvement.percent };
    }
  });

  return best;
}

// Mayor peso movido en una serie válida de la semana (desempate por más reps).
function findMaxLift(logs: WorkoutLog[]): MaxLift | null {
  let best: MaxLift | null = null;

  logs.forEach((log) => {
    log.exercises.forEach((exercise) => {
      (exercise.parsedSets || []).forEach((set) => {
        if (set.weight <= 0 || set.reps <= 0) return; // Ignora vacíos (-1) y peso corporal (0).
        if (
          !best ||
          set.weight > best.weight ||
          (set.weight === best.weight && set.reps > best.reps)
        ) {
          best = {
            exerciseName: exercise.exerciseName,
            weight: set.weight,
            reps: set.reps,
          };
        }
      });
    });
  });

  return best;
}

export interface WeekAchievementsInput {
  weekLogs: WorkoutLog[];
  previousWeekLogs: WorkoutLog[];
  weekNumber: number;
  streakDays: number;
  streakIsPerfect: boolean;
  progressSeries?: WeekProgressDatum[];
}

/**
 * Construye el resumen de logros de una semana completada, listo para pintar la
 * imagen para redes sociales. Lógica pura y testeable.
 */
export function computeWeekAchievements({
  weekLogs,
  previousWeekLogs,
  weekNumber,
  streakDays,
  streakIsPerfect,
  progressSeries = [],
}: WeekAchievementsInput): WeekAchievements {
  const currentLatest = latestLogsByDay(weekLogs);
  const previousLatest = latestLogsByDay(previousWeekLogs);

  const currentDayIds = Array.from(
    new Set(currentLatest.map((log) => log.dayId).filter(Boolean))
  );

  let weekImprovementPercent: number | null = null;
  if (previousLatest.length > 0 && currentDayIds.length > 0) {
    const scoreOptions = {
      activeDaysCount: currentDayIds.length,
      restrictToDayIds: currentDayIds,
      applyMissingPenalty: false,
    };
    const currentStrength = getWeekStrengthScore(currentLatest, scoreOptions);
    const previousStrength = getWeekStrengthScore(previousLatest, scoreOptions);
    const improvement = buildImprovementFromStrengthScores(
      currentStrength,
      previousStrength
    );
    if (improvement) {
      weekImprovementPercent = improvement.isImproved
        ? improvement.percent
        : -improvement.percent;
    }
  }

  return {
    weekNumber,
    daysTrained: currentLatest.length,
    streakDays,
    streakIsPerfect,
    weekImprovementPercent,
    topImprovement: findTopImprovement(currentLatest, previousLatest),
    maxLift: findMaxLift(currentLatest),
    progressSeries,
  };
}
