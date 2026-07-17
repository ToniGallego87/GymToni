import { WorkoutDay, WorkoutLog } from '../types';
import {
  buildImprovementFromStrengthScores,
  getWorkoutStrengthScore,
  ImprovementResult,
} from './progress';
import { getLogTimestamp } from './utils';

/** Mapa { numeroDeBloque (empezando en 1) -> logs ordenados por fecha ascendente }. */
export type WeekBlocks = Record<number, WorkoutLog[]>;

/**
 * Agrupa los logs en "bloques" (semanas de entrenamiento).
 * Un bloque se cierra cuando vuelve a aparecer un día ya entrenado dentro de él,
 * de modo que cada bloque contiene como mucho una vez cada día de la rutina.
 *
 * @param logs Logs a agrupar (de una sola rutina, normalmente).
 * @param getDayKey Identifica el día de un log (undefined si no se conoce). Se
 *   pasa el `dayNumber` cuando se puede resolver el día en la rutina, o el
 *   `dayId` directamente (que no depende de ese mapeo y sobrevive a que la
 *   rutina cambie).
 */
export function groupLogsIntoWeekBlocks(
  logs: WorkoutLog[],
  getDayKey: (log: WorkoutLog) => string | number | undefined
): WeekBlocks {
  const sortedByDateAsc = [...logs].sort(
    (a, b) => getLogTimestamp(a) - getLogTimestamp(b)
  );
  const groupedByBlock: WeekBlocks = {};

  let block = 1;
  let currentBlockLogs: WorkoutLog[] = [];
  let seenDays = new Set<string | number>();

  sortedByDateAsc.forEach((log) => {
    const dayKey = getDayKey(log);

    // Se cierra el bloque y empieza otro cuando: (a) el usuario forzó una nueva
    // semana con este entreno (startsNewWeek), o (b) reaparece un día ya
    // entrenado dentro del bloque.
    const forcesNewWeek = !!log.startsNewWeek;
    const repeatsDay = !!dayKey && seenDays.has(dayKey);
    if ((forcesNewWeek || repeatsDay) && currentBlockLogs.length > 0) {
      groupedByBlock[block] = currentBlockLogs;
      block += 1;
      currentBlockLogs = [];
      seenDays = new Set();
    }

    currentBlockLogs.push(log);
    if (dayKey) {
      seenDays.add(dayKey);
    }
  });

  if (currentBlockLogs.length > 0) {
    groupedByBlock[block] = currentBlockLogs;
  }

  return groupedByBlock;
}

/** Números de bloque presentes, de la semana más antigua a la más reciente. */
export function orderedBlockNumbers(blocks: WeekBlocks): number[] {
  return Object.keys(blocks)
    .map(Number)
    .sort((a, b) => a - b);
}

/** Una semana está completa cuando tiene entrenados todos los días de la rutina. */
export function isWeekCompleted(
  weekLogs: WorkoutLog[],
  activeDays: WorkoutDay[]
): boolean {
  if (weekLogs.length === 0 || activeDays.length === 0) return false;

  const daysWithLogs = new Set(weekLogs.map((log) => log.dayId));
  return activeDays.every((day) => daysWithLogs.has(day.id));
}

interface WeekScoreOptions {
  /** Número de días esperados en la semana, usado para penalizar días no entrenados. */
  activeDaysCount: number;
  /** Si se indica, solo se cuentan los días incluidos en esta lista. */
  restrictToDayIds?: string[];
  /** Resta un 10% de puntuación por cada día esperado que falte (por defecto, true). */
  applyMissingPenalty?: boolean;
}

/**
 * Suma la puntuación de fuerza de una semana usando el último log de cada día.
 * Penaliza (10% por día) los días esperados que no se hayan entrenado.
 */
export function getWeekStrengthScore(
  weekLogs: WorkoutLog[],
  {
    activeDaysCount,
    restrictToDayIds,
    applyMissingPenalty = true,
  }: WeekScoreOptions
): number {
  if (weekLogs.length === 0) return 0;

  // Quedarse solo con el log más reciente de cada día.
  const latestByDayId: Record<string, WorkoutLog> = {};
  [...weekLogs]
    .sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a))
    .forEach((log) => {
      if (!log.dayId) return;
      if (!latestByDayId[log.dayId]) {
        latestByDayId[log.dayId] = log;
      }
    });

  const selectedLogs = Object.values(latestByDayId).filter(
    (log) => !restrictToDayIds || restrictToDayIds.indexOf(log.dayId) !== -1
  );

  const rawStrength = selectedLogs.reduce(
    (sum, log) => sum + getWorkoutStrengthScore(log),
    0
  );

  if (!applyMissingPenalty) {
    return rawStrength;
  }

  const expectedCount = restrictToDayIds
    ? restrictToDayIds.length
    : Math.max(1, activeDaysCount || 5);
  const missingDays = Math.max(0, expectedCount - selectedLogs.length);
  const penaltyFactor = Math.max(0, 1 - missingDays * 0.1);

  return rawStrength * penaltyFactor;
}

/** Días distintos entrenados en una semana. */
function trainedDayIds(weekLogs: WorkoutLog[]): Set<string> {
  return new Set(weekLogs.map((log) => log.dayId).filter(Boolean));
}

/**
 * Mejora de una semana respecto a otra. Solo se comparan los días entrenados en
 * la semana actual, contra esos mismos días de la de referencia (sin penalizar
 * los que falten): pera con pera.
 */
export function getWeekImprovement(
  currentWeekLogs: WorkoutLog[],
  previousWeekLogs: WorkoutLog[],
  activeDays: WorkoutDay[]
): ImprovementResult | null {
  if (activeDays.length === 0) return null;

  const currentDayIds = Array.from(trainedDayIds(currentWeekLogs));
  if (currentDayIds.length === 0) return null;

  const scoreOptions = {
    activeDaysCount: activeDays.length,
    restrictToDayIds: currentDayIds,
    applyMissingPenalty: false,
  };

  return buildImprovementFromStrengthScores(
    getWeekStrengthScore(currentWeekLogs, scoreOptions),
    getWeekStrengthScore(previousWeekLogs, scoreOptions)
  );
}

export interface StreakSummary {
  /** Semanas completas consecutivas hasta la última. */
  weeks: number;
  /** Días entrenados en esas semanas (la métrica que muestra el póster). */
  days: number;
  /** Todas las semanas registradas están completas: nunca se faltó un día. */
  isPerfect: boolean;
}

/**
 * Racha de semanas completas hasta `upToBlock` (por defecto, la última).
 * Una semana en curso (la más reciente, aún incompleta) no rompe la racha: aún
 * está a tiempo de completarse.
 */
export function computeStreak(
  blocks: WeekBlocks,
  activeDays: WorkoutDay[],
  upToBlock?: number
): StreakSummary {
  const ordered = orderedBlockNumbers(blocks);
  const lastIndex =
    upToBlock == null ? ordered.length - 1 : ordered.indexOf(upToBlock);

  let weeks = 0;
  let days = 0;
  for (let i = lastIndex; i >= 0; i--) {
    const weekLogs = blocks[ordered[i]] || [];
    if (isWeekCompleted(weekLogs, activeDays)) {
      weeks++;
      days += trainedDayIds(weekLogs).size;
      continue;
    }
    // La última semana del tramo puede estar en curso: no cuenta, pero tampoco
    // corta la racha de las anteriores.
    if (i === lastIndex) continue;
    break;
  }

  const consideredBlocks = ordered.slice(0, lastIndex + 1);
  const isPerfect =
    consideredBlocks.length > 0 &&
    consideredBlocks.every((block) =>
      isWeekCompleted(blocks[block] || [], activeDays)
    );

  return { weeks, days, isPerfect };
}

/** Logs de todas las semanas anteriores a un bloque (histórico para récords). */
export function logsBeforeBlock(
  blocks: WeekBlocks,
  block: number
): WorkoutLog[] {
  return orderedBlockNumbers(blocks)
    .filter((candidate) => candidate < block)
    .flatMap((candidate) => blocks[candidate] || []);
}

/** Entrenos totales (días distintos) hasta un bloque inclusive. */
export function workoutsUpToBlock(blocks: WeekBlocks, block: number): number {
  return orderedBlockNumbers(blocks)
    .filter((candidate) => candidate <= block)
    .reduce(
      (total, candidate) => total + trainedDayIds(blocks[candidate] || []).size,
      0
    );
}

export interface WeekProgressPoint {
  week: number;
  improvement: number;
  /** La semana más reciente, si aún le faltan días por entrenar. */
  isCurrent?: boolean;
  /** La semana no tiene todos los días de la rutina entrenados. */
  isIncomplete?: boolean;
}

/**
 * Serie de progreso semanal de una rutina. Cada semana se compara contra la
 * PRIMERA (progreso acumulado), a diferencia del listado de Inicio, que compara
 * contra la semana anterior.
 *
 * @param dayFilter Si se indica, la serie mide solo ese día de la rutina.
 */
export function buildWeekProgress(
  logs: WorkoutLog[],
  routineId?: string,
  activeDays: WorkoutDay[] = [],
  dayFilter?: string
): WeekProgressPoint[] {
  if (!routineId) return [];

  // Las sesiones de solo cardio no cuentan como entrenamiento de fuerza.
  const routineLogs = logs.filter(
    (log) => log.routineId === routineId && !log.cardioOnly
  );
  if (routineLogs.length === 0) return [];

  // Se agrupa por dayId, sin depender del mapeo dayId→dayNumber: ese puede
  // fallar si la rutina se modificó y los ids de sus días cambiaron.
  const blocks = groupLogsIntoWeekBlocks(routineLogs, (log) => log.dayId);
  const ordered = orderedBlockNumbers(blocks);

  const blockHasDay = (weekLogs: WorkoutLog[], dayId: string) =>
    weekLogs.some((log) => log.dayId === dayId);

  const firstWeekLogs = blocks[ordered[0]] || [];

  const points: WeekProgressPoint[] = ordered.map((blockNumber, index) => {
    const weekLogs = blocks[blockNumber] || [];

    // Con filtro por día, una semana está "incompleta" si NO entrenó ese día;
    // sin filtro, si le faltan días de la rutina.
    const isIncomplete = dayFilter
      ? !blockHasDay(weekLogs, dayFilter)
      : !isWeekCompleted(weekLogs, activeDays);

    // La primera semana es la base: 0% por definición.
    if (index === 0) return { week: 1, improvement: 0, isIncomplete };

    const week = index + 1;
    if (!weekLogs.length || !firstWeekLogs.length) {
      return { week, improvement: 0, isIncomplete };
    }
    // Con filtro activo, las semanas que no entrenaron ese día no puntúan.
    if (dayFilter && !blockHasDay(weekLogs, dayFilter)) {
      return { week, improvement: 0, isIncomplete };
    }

    // Una semana incompleta NO se penaliza por los días que faltan: se comparan
    // solo los entrenados (o el día filtrado) contra esos mismos días de la
    // semana base, igual que el porcentaje del listado.
    const currentDayIds = dayFilter
      ? [dayFilter]
      : Array.from(trainedDayIds(weekLogs));
    const scoreOptions = {
      activeDaysCount: activeDays.length,
      restrictToDayIds: currentDayIds,
      applyMissingPenalty: false,
    };
    const improvement = buildImprovementFromStrengthScores(
      getWeekStrengthScore(weekLogs, scoreOptions),
      getWeekStrengthScore(firstWeekLogs, scoreOptions)
    );

    const signedDelta = improvement
      ? improvement.isImproved
        ? improvement.percent
        : -improvement.percent
      : 0;

    return {
      week,
      improvement: Math.round(signedDelta * 10) / 10,
      isIncomplete,
    };
  });

  // La última semana entrenada es la "semana en curso" SOLO si aún le faltan
  // días. Si está completa no hay semana abierta, y marcarla como en curso
  // pintaría una semana fantasma en rutinas cerradas o recién completadas.
  const lastWeekLogs = blocks[ordered[ordered.length - 1]] || [];
  if (!isWeekCompleted(lastWeekLogs, activeDays) && points.length > 0) {
    points[points.length - 1] = {
      ...points[points.length - 1],
      isCurrent: true,
    };
  }

  return points;
}
