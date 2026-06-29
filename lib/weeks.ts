import { WorkoutLog } from '../types';
import { getWorkoutStrengthScore } from './progress';
import { getLogTimestamp } from './utils';

/**
 * Agrupa los logs en "bloques" (semanas de entrenamiento).
 * Un bloque se cierra cuando vuelve a aparecer un día ya entrenado dentro de él,
 * de modo que cada bloque contiene como mucho una vez cada día de la rutina.
 *
 * @param logs Logs a agrupar (de una sola rutina, normalmente).
 * @param getDayNumber Resuelve el número de día de un log (undefined si no se conoce).
 * @returns Mapa { numeroDeBloque (empezando en 1) -> logs ordenados por fecha ascendente }.
 */
export function groupLogsIntoWeekBlocks(
  logs: WorkoutLog[],
  getDayNumber: (log: WorkoutLog) => number | undefined
): Record<number, WorkoutLog[]> {
  const sortedByDateAsc = [...logs].sort(
    (a, b) => getLogTimestamp(a) - getLogTimestamp(b)
  );
  const groupedByBlock: Record<number, WorkoutLog[]> = {};

  let block = 1;
  let currentBlockLogs: WorkoutLog[] = [];
  let seenDays: Record<number, boolean> = {};

  sortedByDateAsc.forEach((log) => {
    const dayNumber = getDayNumber(log);

    if (dayNumber && seenDays[dayNumber] && currentBlockLogs.length > 0) {
      groupedByBlock[block] = currentBlockLogs;
      block += 1;
      currentBlockLogs = [];
      seenDays = {};
    }

    currentBlockLogs.push(log);
    if (dayNumber) {
      seenDays[dayNumber] = true;
    }
  });

  if (currentBlockLogs.length > 0) {
    groupedByBlock[block] = currentBlockLogs;
  }

  return groupedByBlock;
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
