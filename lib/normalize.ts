import {
  CardioLog,
  WorkoutAppData,
  WorkoutLog,
  WorkoutRoutine,
} from '../types';
import { isCardioOnlyLog } from './cardio';
import { parseCardioString, parseSeriesString } from './parsers';

/**
 * Ensures the isActive flag on each routine matches the given activeRoutineId.
 * Single source of truth for routine activation sync.
 */
export function syncActiveRoutine(
  routines: WorkoutRoutine[],
  activeRoutineId?: string
): WorkoutRoutine[] {
  return routines.map((routine) => ({
    ...routine,
    isActive: routine.id === activeRoutineId,
  }));
}

/**
 * Ensures all exercise logs have parsedSets populated.
 * Parses rawInput only if parsedSets is missing or empty.
 */
export function ensureParsedSets(logs: WorkoutLog[]): WorkoutLog[] {
  return logs.map((log) => ({
    ...log,
    exercises: (log.exercises || []).map((exercise) => ({
      ...exercise,
      parsedSets: exercise.parsedSets?.length
        ? exercise.parsedSets
        : parseSeriesString(exercise.rawInput || ''),
    })),
  }));
}

/**
 * Un día = un cardio: el cardio de una fecha vive dentro del log de fuerza de
 * ese día, y las sesiones de "solo cardio" son para los días que no tienen
 * fuerza. Si una fecha tiene las dos cosas (se metió cardio en el día de fuerza
 * y luego más desde "Insertar cardio", que antes creaba un log suelto), el
 * cardio suelto se fusiona en el día de fuerza y el log suelto desaparece:
 * si no, el mismo día sale partido en dos sesiones.
 *
 * Solo fusiona `cardioOnly` → fuerza. Dos días de fuerza en la misma fecha se
 * quedan como están: cada uno es un entrenamiento con su propio cardio.
 */
export function mergeSameDayCardio(logs: WorkoutLog[]): WorkoutLog[] {
  // Primer log de fuerza de cada fecha: es el que absorbe.
  const strengthByDate = new Map<string, WorkoutLog>();
  for (const log of logs) {
    if (isCardioOnlyLog(log)) continue;
    if (!strengthByDate.has(log.date)) strengthByDate.set(log.date, log);
  }

  const absorbedInto = new Map<string, string[]>(); // id de fuerza → rawInputs
  const dropped = new Set<string>();
  for (const log of logs) {
    if (!isCardioOnlyLog(log)) continue;
    const host = strengthByDate.get(log.date);
    if (!host) continue;
    const raw = log.cardio?.rawInput?.trim();
    if (raw) {
      const list = absorbedInto.get(host.id);
      if (list) list.push(raw);
      else absorbedInto.set(host.id, [raw]);
    }
    // El suelto sobra: su cardio ya viaja en el día de fuerza (y si no tenía,
    // era un log vacío).
    dropped.add(log.id);
  }
  if (!dropped.size) return logs;

  return logs
    .filter((log) => !dropped.has(log.id))
    .map((log) => {
      const absorbed = absorbedInto.get(log.id);
      if (!absorbed) return log;
      // El cardio propio del día va delante: se metió antes.
      const rawInput = [log.cardio?.rawInput?.trim(), ...absorbed]
        .filter(Boolean)
        .join(' | ');
      return {
        ...log,
        cardio: {
          id: log.cardio?.id ?? `cardio-${log.id}`,
          ...(parseCardioString(rawInput) as Omit<CardioLog, 'id'>),
          notes: log.cardio?.notes,
        },
        updatedAt: Date.now(),
      };
    });
}

/**
 * Resolves the activeRoutineId from available data.
 * Priority: explicit id → first routine with isActive → last routine → undefined
 */
export function resolveActiveRoutineId(
  routines: WorkoutRoutine[],
  explicitId?: string
): string | undefined {
  return (
    explicitId ||
    routines.find((r) => r.isActive)?.id ||
    routines[routines.length - 1]?.id ||
    undefined
  );
}

/**
 * Normalizes raw/partial app data into a consistent WorkoutAppData shape.
 * Ensures parsedSets are populated, isActive flags are coherent and the cardio
 * de cada fecha vive en un único log (ver mergeSameDayCardio).
 */
export function normalizeAppData(
  payload: Partial<WorkoutAppData> | null | undefined,
  fallback: WorkoutAppData
): WorkoutAppData {
  const routines = Array.isArray(payload?.routines)
    ? payload.routines
    : fallback.routines;
  const rawLogs = Array.isArray(payload?.logs) ? payload.logs : fallback.logs;
  const activeRoutineId = resolveActiveRoutineId(
    routines,
    payload?.activeRoutineId
  );
  // La seleccionada se conserva solo si existe; si no, cae a la activa.
  const selectedRoutineId = routines.some(
    (routine) => routine.id === payload?.selectedRoutineId
  )
    ? payload?.selectedRoutineId
    : activeRoutineId;

  return {
    routines: syncActiveRoutine(routines, activeRoutineId),
    activeRoutineId,
    selectedRoutineId,
    logs: mergeSameDayCardio(ensureParsedSets(rawLogs)),
  };
}
