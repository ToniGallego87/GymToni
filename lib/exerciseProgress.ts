import { ExerciseLog, ParsedSet, WorkoutLog } from '../types';
import {
  catalogIdOfKey,
  ExerciseKeyResolver,
  exerciseKeyOf,
} from './exerciseIdentity';
import { isExtraExerciseLog } from './extraExercises';
import { getEstimatedOneRepMax, isValidSet } from './progress';
import { getLogTimestamp } from './utils';

/**
 * Historial y récords de UN ejercicio concreto ("¿cuánto hacía en banca hace un
 * mes?"). El resto de la app mira el rendimiento por sesión o por semana; aquí
 * el eje es el ejercicio, atravesando todas las rutinas y todas las semanas.
 *
 * Los ejercicios se agrupan por su IDENTIDAD (lib/exerciseIdentity.ts): el
 * ejercicio del catálogo si lo tienen, y si no el nombre normalizado. Nunca por
 * `exerciseId`: el mismo press de banca tiene un id distinto en cada rutina (y
 * en cada día), así que agrupar por id partiría el histórico justo al cambiar de
 * rutina, que es cuando más interesa comparar.
 *
 * Las funciones reciben el resolutor de claves (`buildExerciseKeyResolver`, con
 * las rutinas y el historial de la persona). Sin él agrupan sin contexto
 * (`exerciseKeyOf`): catálogo si lo hay, nombre si no.
 */

/** Clave de un apunte del historial. */
export function exerciseLogKey(
  exerciseLog: ExerciseLog,
  resolve: ExerciseKeyResolver = exerciseKeyOf
): string {
  return resolve({
    name: exerciseLog.exerciseName,
    catalogId: exerciseLog.catalogId,
  });
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
  /**
   * Sesión de una semana de DESCARGA: se baja la carga a propósito, así que no
   * es un retroceso. La gráfica la omite (dibujaría un bache que no dice nada
   * del progreso); los récords y el listado la siguen contando, porque ahí sí
   * es una sesión realmente entrenada.
   */
  isDeload?: boolean;
}

export interface ExerciseSummary {
  key: string;
  /** Nombre tal y como se escribió la última vez que se entrenó. */
  name: string;
  /**
   * GIF del ejercicio: el del catálogo con el que se entrenó la última vez (o,
   * si ningún apunte lo guardaba, el que da su clave). undefined si es propio.
   */
  catalogId?: string;
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

/** Todas las series de un ejercicio dentro de un log (puede repetirse por id). */
function setsForKeyInLog(
  log: WorkoutLog,
  key: string,
  resolve: ExerciseKeyResolver
): ParsedSet[] {
  return log.exercises
    .filter(
      (exerciseLog) =>
        !isExtraExerciseLog(exerciseLog) &&
        exerciseLogKey(exerciseLog, resolve) === key
    )
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
    isDeload: log.isDeload || undefined,
  };
}

/**
 * Sesiones en las que se hizo el ejercicio, de la más antigua a la más reciente
 * (el orden en el que se leen la gráfica y los récords).
 */
export function buildExerciseSessions(
  logs: WorkoutLog[],
  key: string,
  resolve: ExerciseKeyResolver = exerciseKeyOf
): ExerciseSession[] {
  return logs
    .map((log) => ({ log, sets: setsForKeyInLog(log, key, resolve) }))
    .filter(({ sets }) => sets.length > 0)
    .map(({ log, sets }) => buildSession(log, sets))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Ejercicios con historial, del entrenado más recientemente al más antiguo (el
 * que se busca casi siempre es el de la última sesión).
 */
export function listExercises(
  logs: WorkoutLog[],
  resolve: ExerciseKeyResolver = exerciseKeyOf
): ExerciseSummary[] {
  const byKey = new Map<string, ExerciseSummary>();

  for (const log of logs) {
    const timestamp = getLogTimestamp(log);

    for (const exerciseLog of log.exercises) {
      // Los adicionales quedan fuera de la evolución (lib/extraExercises).
      if (isExtraExerciseLog(exerciseLog)) continue;
      const sets = (exerciseLog.parsedSets || []).filter(isValidSet);
      if (sets.length === 0) continue;

      const key = exerciseLogKey(exerciseLog, resolve);
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
          catalogId: exerciseLog.catalogId ?? catalogIdOfKey(key),
          sessionCount: 1,
          lastTimestamp: timestamp,
          lastDate: log.date,
          bestOneRepMax,
          maxWeight,
        });
        continue;
      }

      // Un mismo log puede traer el ejercicio repetido (dos ids, misma clave):
      // es UNA sesión, no dos.
      const isSameSession = current.lastTimestamp === timestamp;
      const isNewer = timestamp > current.lastTimestamp;

      byKey.set(key, {
        ...current,
        // El nombre que se muestra es el de la última vez que se escribió.
        name: isNewer ? exerciseLog.exerciseName.trim() : current.name,
        // Y el GIF, el de la última vez que se entrenó con uno.
        catalogId:
          isNewer && exerciseLog.catalogId
            ? exerciseLog.catalogId
            : current.catalogId,
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
 * Serie de la sesión en curso que queda como récord del ejercicio: más peso
 * que nunca, o mejor 1RM estimado. Cada serie se mide también contra las
 * anteriores de la misma sesión, así que repetir el peso del récord no vuelve a
 * contar. Si varias lo baten, solo se marca la ÚLTIMA (la que superó a todas
 * las de antes, también a los récords previos de hoy): dos burbujas de oro en
 * el mismo ejercicio decían "récord" de una serie que ya no lo es.
 * Sin historial previo no hay récord que batir (la primera vez todo lo sería).
 * Devuelve un Set vacío o con un único índice.
 */
export function getRecordSetIndexes(
  previousSets: ParsedSet[],
  currentSets: ParsedSet[]
): Set<number> {
  const valid = previousSets.filter(isValidSet);
  if (valid.length === 0) return new Set();
  let lastRecord = -1;
  let bestOneRepMax = Math.max(
    ...valid.map((s) => getEstimatedOneRepMax(s.weight, s.reps))
  );
  let bestWeight = Math.max(...valid.map((s) => s.weight));
  currentSets.forEach((set, index) => {
    if (!isValidSet(set) || set.weight <= 0) return;
    const oneRepMax = getEstimatedOneRepMax(set.weight, set.reps);
    if (oneRepMax > bestOneRepMax || set.weight > bestWeight) {
      lastRecord = index;
    }
    bestOneRepMax = Math.max(bestOneRepMax, oneRepMax);
    bestWeight = Math.max(bestWeight, set.weight);
  });
  return new Set(lastRecord === -1 ? [] : [lastRecord]);
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

/** Saltos de disco/mancuerna que se reconocen al deducir el de un ejercicio. */
const WEIGHT_STEPS = [0.5, 1, 1.25, 2, 2.5, 5];

/**
 * Cuánto suben y bajan las flechas del peso de un ejercicio: el escalón más
 * pequeño entre los pesos distintos que ya se han usado en él (60 → 62,5 → 65
 * da 2,5; mancuernas de 20, 22 y 24 dan 2). Sin historial, o con un escalón que
 * no es de material de gimnasio (0,25, 7…), 1 kg, como antes.
 */
export function weightStepFromHistory(weights: number[]): number {
  const distinct = Array.from(new Set(weights.filter((w) => w > 0))).sort(
    (a, b) => a - b
  );
  let smallest = Infinity;
  for (let i = 1; i < distinct.length; i++) {
    smallest = Math.min(smallest, distinct[i] - distinct[i - 1]);
  }
  const step = WEIGHT_STEPS.find((s) => Math.abs(s - smallest) < 1e-6);
  return step ?? 1;
}
