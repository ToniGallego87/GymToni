import { WorkoutAppData, WorkoutLog, WorkoutRoutine } from '../types';
import { parseSeriesString } from './parsers';

/**
 * Ensures the isActive flag on each routine matches the given activeRoutineId.
 * Single source of truth for routine activation sync.
 */
export function syncActiveRoutine(routines: WorkoutRoutine[], activeRoutineId?: string): WorkoutRoutine[] {
  return routines.map(routine => ({
    ...routine,
    isActive: routine.id === activeRoutineId,
  }));
}

/**
 * Ensures all exercise logs have parsedSets populated.
 * Parses rawInput only if parsedSets is missing or empty.
 */
export function ensureParsedSets(logs: WorkoutLog[]): WorkoutLog[] {
  return logs.map(log => ({
    ...log,
    exercises: (log.exercises || []).map(exercise => ({
      ...exercise,
      parsedSets: exercise.parsedSets?.length
        ? exercise.parsedSets
        : parseSeriesString(exercise.rawInput || ''),
    })),
  }));
}

/**
 * Resolves the activeRoutineId from available data.
 * Priority: explicit id → first routine with isActive → last routine → undefined
 */
export function resolveActiveRoutineId(
  routines: WorkoutRoutine[],
  explicitId?: string
): string | undefined {
  return explicitId
    || routines.find(r => r.isActive)?.id
    || routines[routines.length - 1]?.id
    || undefined;
}

/**
 * Normalizes raw/partial app data into a consistent WorkoutAppData shape.
 * Ensures parsedSets are populated and isActive flags are coherent.
 */
export function normalizeAppData(
  payload: Partial<WorkoutAppData> | null | undefined,
  fallback: WorkoutAppData
): WorkoutAppData {
  const routines = Array.isArray(payload?.routines) ? payload.routines : fallback.routines;
  const rawLogs = Array.isArray(payload?.logs) ? payload.logs : fallback.logs;
  const activeRoutineId = resolveActiveRoutineId(routines, payload?.activeRoutineId);

  return {
    routines: syncActiveRoutine(routines, activeRoutineId),
    activeRoutineId,
    logs: ensureParsedSets(rawLogs),
  };
}
