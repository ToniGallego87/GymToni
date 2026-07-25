import { ParsedSet, WorkoutLog } from '../types';
import { getEstimatedOneRepMax } from './progress';
import { getLogTimestamp } from './utils';

/**
 * Historial y récords de UN ejercicio concreto ("¿cuánto hacía en banca hace un
 * mes?"). El resto de la app mira el rendimiento por sesión o por semana; aquí
 * el eje es el ejercicio, atravesando todas las rutinas y todas las semanas.
 *
 * Los ejercicios se agrupan por NOMBRE, no por `exerciseId`: el mismo press de
 * banca tiene un id distinto en cada rutina (y en cada día), así que agrupar por
 * id partiría el histórico justo al cambiar de rutina, que es cuando más
 * interesa comparar.
 */

/** Clave de agrupado: el nombre normalizado (sin mayúsculas ni espacios de más). */
export function exerciseKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface ExerciseSession {
  logId: string;
  date: string;
  timestamp: number;
  sets: ParsedSet[];
  /** Mejor 1RM estimado (Epley) de las series de la sesión. */
  bestOneRepMax: number;
  maxWeight: number;
  /** Repeticiones de la mejor serie por reps. */
  bestSetReps: number;
  /** Volumen de carga: suma de peso × reps. */
  volume: number;
  totalReps: number;
}

export interface ExerciseSummary {
  key: string;
  /** Nombre tal y como se escribió la última vez que se entrenó. */
  name: string;
  sessionCount: number;
  lastTimestamp: number;
  lastDate: string;
  bestOneRepMax: number;
  maxWeight: number;
}

export interface ExerciseRecords {
  oneRepMax: {
    value: number;
    weight: number;
    reps: number;
    date: string;
  } | null;
  maxWeight: { value: number; reps: number; date: string } | null;
  maxReps: { value: number; weight: number; date: string } | null;
  bestVolume: { value: number; date: string } | null;
}

function isValidSet(setItem: ParsedSet): boolean {
  return (
    Number.isFinite(setItem.weight) &&
    Number.isFinite(setItem.reps) &&
    setItem.weight >= 0 &&
    setItem.reps > 0
  );
}

/** Todas las series de un ejercicio dentro de un log (puede repetirse por id). */
function setsForKeyInLog(log: WorkoutLog, key: string): ParsedSet[] {
  return log.exercises
    .filter((exerciseLog) => exerciseKey(exerciseLog.exerciseName) === key)
    .flatMap((exerciseLog) => exerciseLog.parsedSets || [])
    .filter(isValidSet);
}

function buildSession(log: WorkoutLog, sets: ParsedSet[]): ExerciseSession {
  return {
    logId: log.id,
    date: log.date,
    timestamp: getLogTimestamp(log),
    sets,
    bestOneRepMax: sets.reduce(
      (best, s) => Math.max(best, getEstimatedOneRepMax(s.weight, s.reps)),
      0
    ),
    maxWeight: sets.reduce((best, s) => Math.max(best, s.weight), 0),
    bestSetReps: sets.reduce((best, s) => Math.max(best, s.reps), 0),
    volume: sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
    totalReps: sets.reduce((sum, s) => sum + s.reps, 0),
  };
}

/**
 * Sesiones en las que se hizo el ejercicio, de la más antigua a la más reciente
 * (el orden en el que se leen la gráfica y los récords).
 */
export function buildExerciseSessions(
  logs: WorkoutLog[],
  key: string
): ExerciseSession[] {
  return logs
    .map((log) => ({ log, sets: setsForKeyInLog(log, key) }))
    .filter(({ sets }) => sets.length > 0)
    .map(({ log, sets }) => buildSession(log, sets))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Ejercicios con historial, del entrenado más recientemente al más antiguo (el
 * que se busca casi siempre es el de la última sesión).
 */
export function listExercises(logs: WorkoutLog[]): ExerciseSummary[] {
  const byKey = new Map<string, ExerciseSummary>();

  for (const log of logs) {
    const timestamp = getLogTimestamp(log);

    for (const exerciseLog of log.exercises) {
      const sets = (exerciseLog.parsedSets || []).filter(isValidSet);
      if (sets.length === 0) continue;

      const key = exerciseKey(exerciseLog.exerciseName);
      const bestOneRepMax = sets.reduce(
        (best, s) => Math.max(best, getEstimatedOneRepMax(s.weight, s.reps)),
        0
      );
      const maxWeight = sets.reduce((best, s) => Math.max(best, s.weight), 0);
      const current = byKey.get(key);

      if (!current) {
        byKey.set(key, {
          key,
          name: exerciseLog.exerciseName.trim(),
          sessionCount: 1,
          lastTimestamp: timestamp,
          lastDate: log.date,
          bestOneRepMax,
          maxWeight,
        });
        continue;
      }

      // Un mismo log puede traer el ejercicio repetido (dos ids, mismo nombre):
      // es UNA sesión, no dos.
      const isSameSession = current.lastTimestamp === timestamp;
      const isNewer = timestamp > current.lastTimestamp;

      byKey.set(key, {
        ...current,
        // El nombre que se muestra es el de la última vez que se escribió.
        name: isNewer ? exerciseLog.exerciseName.trim() : current.name,
        sessionCount: isSameSession
          ? current.sessionCount
          : current.sessionCount + 1,
        lastTimestamp: Math.max(current.lastTimestamp, timestamp),
        lastDate: isNewer ? log.date : current.lastDate,
        bestOneRepMax: Math.max(current.bestOneRepMax, bestOneRepMax),
        maxWeight: Math.max(current.maxWeight, maxWeight),
      });
    }
  }

  return [...byKey.values()].sort((a, b) => b.lastTimestamp - a.lastTimestamp);
}

/** Criterios de orden de la lista de ejercicios. */
export type ExerciseSort = 'recent' | 'name' | 'sessions' | 'best';

/**
 * Ordena los ejercicios sin mutar la lista. Todos los criterios salvo el nombre
 * desempatan por el más reciente: con dos ejercicios de 5 sesiones, el de esta
 * semana va antes que el de hace un año.
 */
export function sortExercises(
  exercises: ExerciseSummary[],
  sort: ExerciseSort
): ExerciseSummary[] {
  const byRecent = (a: ExerciseSummary, b: ExerciseSummary) =>
    b.lastTimestamp - a.lastTimestamp;

  return [...exercises].sort((a, b) => {
    switch (sort) {
      case 'name':
        // localeCompare: "Ángulo" va con la A, no al final del alfabeto.
        return a.name.localeCompare(b.name);
      case 'sessions':
        return b.sessionCount - a.sessionCount || byRecent(a, b);
      case 'best':
        return b.bestOneRepMax - a.bestOneRepMax || byRecent(a, b);
      default:
        return byRecent(a, b);
    }
  });
}

/**
 * Récords personales del ejercicio. En caso de empate gana la fecha en la que
 * se consiguió POR PRIMERA VEZ (el récord es de ese día), de ahí el `>` estricto
 * recorriendo las sesiones de la más antigua a la más reciente.
 */
export function getExerciseRecords(
  sessions: ExerciseSession[]
): ExerciseRecords {
  const records: ExerciseRecords = {
    oneRepMax: null,
    maxWeight: null,
    maxReps: null,
    bestVolume: null,
  };

  for (const session of sessions) {
    for (const set of session.sets) {
      const oneRepMax = getEstimatedOneRepMax(set.weight, set.reps);
      if (oneRepMax > 0 && oneRepMax > (records.oneRepMax?.value ?? 0)) {
        records.oneRepMax = {
          value: oneRepMax,
          weight: set.weight,
          reps: set.reps,
          date: session.date,
        };
      }
      if (set.weight > 0 && set.weight > (records.maxWeight?.value ?? 0)) {
        records.maxWeight = {
          value: set.weight,
          reps: set.reps,
          date: session.date,
        };
      }
      if (set.reps > (records.maxReps?.value ?? 0)) {
        records.maxReps = {
          value: set.reps,
          weight: set.weight,
          date: session.date,
        };
      }
    }

    if (
      session.volume > 0 &&
      session.volume > (records.bestVolume?.value ?? 0)
    ) {
      records.bestVolume = { value: session.volume, date: session.date };
    }
  }

  return records;
}
