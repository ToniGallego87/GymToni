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

/**
 * ¿Es una semana de descarga (deload)? La marca vive en los logs del bloque
 * (ver `WorkoutLog.isDeload`): basta con que uno la lleve para tratar la semana
 * entera como descarga.
 */
export function isDeloadBlock(weekLogs: WorkoutLog[]): boolean {
  return weekLogs.some((log) => log.isDeload);
}

/**
 * Bloque de carga (no descarga) inmediatamente anterior a `block`, o `null` si
 * no hay ninguno. Al comparar, una semana de carga se mide contra la última de
 * carga, saltándose las de descarga (que quedan al margen de las estadísticas).
 */
export function previousLoadBlock(
  blocks: WeekBlocks,
  block: number
): number | null {
  const earlier = orderedBlockNumbers(blocks)
    .filter((candidate) => candidate < block)
    .reverse();
  for (const candidate of earlier) {
    if (!isDeloadBlock(blocks[candidate] || [])) return candidate;
  }
  return null;
}

/** Identifica el día de un log para agrupar/mover (undefined si no se conoce). */
export type DayKeyFn = (log: WorkoutLog) => string | number | undefined;

/** Dirección de un movimiento de día entre semanas. */
export type WeekMoveDirection = 'prev' | 'next';

export interface WeekMovePlan {
  /**
   * Logs cuyo `startsNewWeek` cambia, ya con el nuevo valor aplicado
   * (`true` para forzar frontera, `undefined` para quitarla). Se persisten con
   * `UPDATE_WORKOUT_LOG`. Nunca cambia la fecha del log.
   */
  changedLogs: WorkoutLog[];
  /** El destino no existía: el movimiento crea una semana nueva. */
  createsNewWeek: boolean;
  /** El origen se queda sin días: esa semana desaparece al recomputar. */
  removesSourceWeek: boolean;
}

/**
 * Asigna a cada log (ordenado por fecha ascendente) el número de bloque al que
 * pertenece, con las MISMAS reglas que `groupLogsIntoWeekBlocks`. Devuelve el
 * array ordenado y el bloque de cada posición, base para calcular movimientos.
 */
function assignBlocks(
  logs: WorkoutLog[],
  getDayKey: DayKeyFn
): { sorted: WorkoutLog[]; blockOf: number[] } {
  const sorted = [...logs].sort(
    (a, b) => getLogTimestamp(a) - getLogTimestamp(b)
  );
  const blockOf: number[] = new Array(sorted.length);

  let block = 1;
  let started = false;
  let seenDays = new Set<string | number>();

  sorted.forEach((log, i) => {
    const dayKey = getDayKey(log);
    const forcesNewWeek = !!log.startsNewWeek;
    const repeatsDay = dayKey != null && seenDays.has(dayKey);
    if ((forcesNewWeek || repeatsDay) && started) {
      block += 1;
      seenDays = new Set();
    }
    blockOf[i] = block;
    started = true;
    if (dayKey != null) seenDays.add(dayKey);
  });

  return { sorted, blockOf };
}

/**
 * Calcula el plan para mover un día a la semana contigua, o `null` si el
 * movimiento no es legal. Las semanas no se guardan: son bloques derivados por
 * `groupLogsIntoWeekBlocks`, así que mover un día es desplazar la frontera del
 * bloque poniendo/quitando el flag `startsNewWeek` (por eso solo el primer y el
 * último día de una semana pueden moverse). Reglas:
 *
 *  - `'next'`: solo el ÚLTIMO día (fecha más reciente) de su semana puede ir a
 *    la siguiente, y solo si esa no tiene ya ese mismo día. Si no hay siguiente,
 *    se crea una semana nueva.
 *  - `'prev'`: solo el PRIMER día (fecha más antigua) de su semana puede ir a la
 *    anterior, y solo si esa no tiene ya ese mismo día. La primera semana no
 *    tiene anterior.
 *  - Si el origen se queda sin días, esa semana desaparece (implícito al
 *    recomputar los bloques).
 *
 * `getDayKey` debe ser la MISMA función con la que se agrupan las semanas en la
 * pantalla que llama (Inicio agrupa por `dayNumber`), para que el chequeo de
 * "día igual" coincida con lo que ve el usuario.
 */
export function planWeekMove(
  logs: WorkoutLog[],
  logId: string,
  direction: WeekMoveDirection,
  getDayKey: DayKeyFn
): WeekMovePlan | null {
  const { sorted, blockOf } = assignBlocks(logs, getDayKey);
  const idx = sorted.findIndex((log) => log.id === logId);
  if (idx === -1) return null;

  const moved = sorted[idx];
  const movedKey = getDayKey(moved);
  const currentBlock = blockOf[idx];

  const keysOfBlock = (block: number): Set<string | number> => {
    const keys = new Set<string | number>();
    sorted.forEach((log, i) => {
      if (blockOf[i] !== block) return;
      const key = getDayKey(log);
      if (key != null) keys.add(key);
    });
    return keys;
  };
  const setFlag = (log: WorkoutLog): WorkoutLog => ({
    ...log,
    startsNewWeek: true,
  });
  const clearFlag = (log: WorkoutLog): WorkoutLog => ({
    ...log,
    startsNewWeek: undefined,
  });
  const blockSize = blockOf.filter((b) => b === currentBlock).length;

  if (direction === 'next') {
    // Debe ser el último día de su semana (fecha más reciente del bloque).
    const isLastOfBlock = blockOf.lastIndexOf(currentBlock) === idx;
    if (!isLastOfBlock) return null;

    const changedLogs: WorkoutLog[] = [];
    const hasNext = idx + 1 < sorted.length;

    if (!hasNext) {
      // No hay semana siguiente: mover el único día de la última semana no crea
      // nada (ya es su propia semana), así que solo tiene sentido si hay más
      // días detrás que se quedan formando la semana anterior.
      if (blockSize <= 1) return null;
      changedLogs.push(setFlag(moved));
      return { changedLogs, createsNewWeek: true, removesSourceWeek: false };
    }

    const nextFirst = sorted[idx + 1];
    // La semana siguiente no puede tener ya ese mismo día.
    if (movedKey != null && keysOfBlock(blockOf[idx + 1]).has(movedKey)) {
      return null;
    }
    // El día movido pasa a encabezar la semana siguiente; se limpia la frontera
    // manual del que era su primer día para no dejar el movido solo en un bloque.
    if (!moved.startsNewWeek) changedLogs.push(setFlag(moved));
    if (nextFirst.startsNewWeek) changedLogs.push(clearFlag(nextFirst));
    if (changedLogs.length === 0) return null;
    return {
      changedLogs,
      createsNewWeek: false,
      removesSourceWeek: blockSize <= 1,
    };
  }

  // direction === 'prev'
  // Debe ser el primer día de su semana (fecha más antigua del bloque)...
  const isFirstOfBlock = blockOf.indexOf(currentBlock) === idx;
  if (!isFirstOfBlock) return null;
  // ...y tiene que existir una semana anterior.
  if (idx === 0) return null;

  const prevBlock = blockOf[idx - 1];
  // La semana anterior no puede tener ya ese mismo día.
  if (movedKey != null && keysOfBlock(prevBlock).has(movedKey)) return null;

  const changedLogs: WorkoutLog[] = [];
  // El día movido se une a la semana anterior: se quita su frontera.
  if (moved.startsNewWeek) changedLogs.push(clearFlag(moved));
  // El siguiente día (si lo hay en esta semana) pasa a encabezarla.
  const hasSecond =
    idx + 1 < sorted.length && blockOf[idx + 1] === currentBlock;
  if (hasSecond && !sorted[idx + 1].startsNewWeek) {
    changedLogs.push(setFlag(sorted[idx + 1]));
  }
  if (changedLogs.length === 0) return null;
  return {
    changedLogs,
    createsNewWeek: false,
    removesSourceWeek: !hasSecond,
  };
}

/**
 * ¿Reasignar un log a `newTimestamp` lo mete en una semana que YA tiene ese
 * mismo día? En ese caso el bloque se parte en dos por el punto de inserción
 * (el día repetido abre semana nueva; ver `groupLogsIntoWeekBlocks`), así que la
 * pantalla avisa antes con `ConfirmModal`. Se agrupa el resto de logs por su
 * semana natural y se busca aquel cuyo tramo temporal contiene la nueva fecha:
 * si ese tramo ya entrenó el mismo día (misma clave), habrá choque.
 */
export function assignmentDuplicatesDayInWeek(
  logs: WorkoutLog[],
  movedLog: WorkoutLog,
  newTimestamp: number,
  getDayKey: DayKeyFn
): boolean {
  const movedKey = getDayKey(movedLog);
  if (movedKey == null) return false;

  const others = logs.filter((log) => log.id !== movedLog.id);
  const blocks = groupLogsIntoWeekBlocks(others, getDayKey);

  for (const blockNumber of orderedBlockNumbers(blocks)) {
    const weekLogs = blocks[blockNumber];
    const times = weekLogs.map(getLogTimestamp);
    const min = Math.min(...times);
    const max = Math.max(...times);
    if (newTimestamp >= min && newTimestamp <= max) {
      return weekLogs.some((log) => getDayKey(log) === movedKey);
    }
  }
  return false;
}

/** ¿Se puede mover ese día a la semana contigua en esa dirección? */
export function canMoveDay(
  logs: WorkoutLog[],
  logId: string,
  direction: WeekMoveDirection,
  getDayKey: DayKeyFn
): boolean {
  return planWeekMove(logs, logId, direction, getDayKey) !== null;
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
  /** Semana de descarga: al margen de las estadísticas (barra en blanco, sin %). */
  isDeload?: boolean;
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

  // La base es la primera semana de CARGA: una descarga no sirve de referencia.
  const firstLoadBlock = ordered.find(
    (blockNumber) => !isDeloadBlock(blocks[blockNumber] || [])
  );
  const firstWeekLogs =
    firstLoadBlock != null ? blocks[firstLoadBlock] || [] : [];

  const points: WeekProgressPoint[] = ordered.map((blockNumber, index) => {
    const weekLogs = blocks[blockNumber] || [];
    const week = index + 1;

    // Con filtro por día, una semana está "incompleta" si NO entrenó ese día;
    // sin filtro, si le faltan días de la rutina.
    const isIncomplete = dayFilter
      ? !blockHasDay(weekLogs, dayFilter)
      : !isWeekCompleted(weekLogs, activeDays);

    // Semana de descarga: al margen de las estadísticas (barra en blanco, sin %,
    // no compara ni sirve de base).
    if (isDeloadBlock(weekLogs)) {
      return { week, improvement: 0, isIncomplete, isDeload: true };
    }

    // La primera semana de carga es la base: 0% por definición.
    if (blockNumber === firstLoadBlock) {
      return { week, improvement: 0, isIncomplete };
    }

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
