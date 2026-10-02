import {
  ExerciseLog,
  ParsedSet,
  WorkoutAppData,
  WorkoutLog,
  WorkoutRoutine,
} from '../types';
import { isCardioOnlyLog } from './cardio';
import { parseSeriesString } from './parsers';

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

// ─────────────── Reparación de duplicados venidos de la nube ───────────────
// El backup de la Fase 2 subía cada serie con un id ALEATORIO (los ids
// deterministas llegaron en la Fase 3), así que cada copia de seguridad creaba
// filas nuevas en la nube para las mismas series y restaurar bajaba el bloque
// repetido k veces (3 series → 6 → 9…). Lo mismo con los ejercicios de un
// entreno reguardado: sus `exercise_logs` viejos se quedaban vivos en la nube.
//
// `rawInput` es la referencia fiable del número real de series: se escribe de
// una sola vez al guardar el entreno y ninguna capa de sync lo toca. Si hay más
// series guardadas que apuntes en `rawInput`, el exceso es basura.

/** Apunte de una serie saltada en `rawInput` (peso/reps a -1 en las parseadas). */
const SKIPPED_SET_INPUT = '-';

/** Apuntes de series de un `rawInput` ("60x8, 65x6, -" → 3). */
function rawEntries(rawInput: string): string[] {
  return (rawInput || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function isSkippedSet(set: ParsedSet): boolean {
  return set.weight === -1 || set.reps === -1;
}

/**
 * Rehace la lista de series de un `rawInput`: un apunte, una serie. Los apuntes
 * que no son una serie válida ("80x", medio tecleados) se caen, como al parsear.
 * Las saltadas ("-") solo se conservan si el ejercicio ya las traía: el historial
 * viejo las descartaba y el nuevo las guarda como (-1, -1).
 */
function setsFromRawInput(rawInput: string, keepSkipped: boolean): ParsedSet[] {
  const sets: ParsedSet[] = [];
  for (const entry of rawEntries(rawInput)) {
    const [parsed] = parseSeriesString(entry);
    if (parsed) sets.push(parsed);
    else if (keepSkipped && entry === SKIPPED_SET_INPUT) {
      sets.push({ weight: -1, reps: -1 });
    }
  }
  return sets;
}

/**
 * Devuelve las series reales de un ejercicio. Solo actúa si hay MÁS series que
 * apuntes en `rawInput`, que es lo que guardar un entreno nunca produce.
 *
 * Las copias NO vienen una detrás de otra: cada restauración renumera las series
 * (1..9), así que al reconstruir el historial por orden de serie las copias
 * salen entrelazadas ("A A B A C B B C C" para un ejercicio de tres series).
 * Recortar el sobrante daría valores equivocados: hay que rehacer la lista desde
 * `rawInput`, que es el único apunte fiel de lo que se entrenó.
 */
function repairSets(exerciseLog: ExerciseLog): ParsedSet[] {
  const sets = exerciseLog.parsedSets ?? [];
  const entries = rawEntries(exerciseLog.rawInput).length;
  if (!entries || sets.length <= entries) return sets;

  const rebuilt = setsFromRawInput(
    exerciseLog.rawInput,
    sets.some(isSkippedSet)
  );
  return rebuilt.length ? rebuilt : sets;
}

/**
 * Quita los ejercicios repetidos dentro de un entreno (el mismo ejercicio no se
 * registra dos veces en una sesión: la pantalla de registro los saca del día de
 * la rutina, que no repite ejercicio). Se queda con el apunte más reciente, que
 * es el del último guardado.
 */
export function dedupeExerciseLogs(logs: WorkoutLog[]): WorkoutLog[] {
  let changed = false;
  const deduped = logs.map((log) => {
    const byExercise = new Map<string, ExerciseLog>();
    for (const exerciseLog of log.exercises || []) {
      const key =
        exerciseLog.exerciseId ||
        `${exerciseLog.exerciseName}|${exerciseLog.order}`;
      const previous = byExercise.get(key);
      if (!previous || exerciseLog.timestamp > previous.timestamp) {
        byExercise.set(key, exerciseLog);
      }
    }
    if (byExercise.size === (log.exercises || []).length) return log;
    changed = true;
    return { ...log, exercises: [...byExercise.values()] };
  });
  return changed ? deduped : logs;
}

/** Recorta las series duplicadas de todos los entrenos (ver `repairSets`). */
export function repairDuplicatedSets(logs: WorkoutLog[]): WorkoutLog[] {
  let changed = false;
  const repaired = logs.map((log) => {
    let logChanged = false;
    const exercises = (log.exercises || []).map((exerciseLog) => {
      const sets = repairSets(exerciseLog);
      if (sets === exerciseLog.parsedSets) return exerciseLog;
      logChanged = true;
      return { ...exerciseLog, parsedSets: sets };
    });
    if (!logChanged) return log;
    changed = true;
    return { ...log, exercises };
  });
  return changed ? repaired : logs;
}

/**
 * Un día de la rutina solo puede entrenarse una vez por fecha: la pantalla de
 * registro reabre el entreno de hoy en vez de crear otro. Si aun así aparecen
 * dos, es basura del autoguardado antiguo, que borraba el log y lo reinsertaba
 * con un id NUEVO en cada serie: un borrado que no llegaba (o una versión vieja
 * devuelta por el pull) dejaba un huérfano con lo insertado hasta ese momento.
 * Como el día repetido abre bloque nuevo en `weeks.ts`, el entreno salía clonado
 * "en la semana siguiente".
 *
 * Se fusionan en uno solo. Base: la copia más reciente (la que el registro
 * estaba escribiendo, y la que la pantalla vuelve a elegir al reabrir el día).
 * De cada ejercicio se conserva la versión con MÁS series, así que ninguna de
 * las dos pierde datos. Los `cardioOnly` no entran: son sesiones propias e
 * independientes del día de fuerza, y aquí no se tocan.
 */
export function mergeDuplicateDayLogs(logs: WorkoutLog[]): WorkoutLog[] {
  const byDay = new Map<string, WorkoutLog[]>();
  for (const log of logs) {
    if (isCardioOnlyLog(log)) continue;
    const key = `${log.routineId}|${log.dayId}|${log.date}`;
    const group = byDay.get(key);
    if (group) group.push(log);
    else byDay.set(key, [log]);
  }

  const mergedById = new Map<string, WorkoutLog>();
  const dropped = new Set<string>();

  for (const group of byDay.values()) {
    if (group.length < 2) continue;

    // Más reciente primero: mismo criterio que usa la pantalla de registro para
    // reabrir el entreno del día (el de `createdAt` más alto).
    const sorted = [...group].sort(
      (a, b) =>
        (b.createdAt ?? 0) - (a.createdAt ?? 0) ||
        (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    );
    const [base, ...rest] = sorted;

    const byExercise = new Map<string, ExerciseLog>();
    for (const log of sorted) {
      for (const exerciseLog of log.exercises || []) {
        const key =
          exerciseLog.exerciseId ||
          `${exerciseLog.exerciseName}|${exerciseLog.order}`;
        const previous = byExercise.get(key);
        // El primero en llegar es el de la copia más reciente; una copia vieja
        // solo lo sustituye si trae más series (datos que se habrían perdido).
        if (
          !previous ||
          (exerciseLog.parsedSets?.length ?? 0) >
            (previous.parsedSets?.length ?? 0)
        ) {
          byExercise.set(key, exerciseLog);
        }
      }
    }

    mergedById.set(base.id, {
      ...base,
      exercises: [...byExercise.values()].sort((a, b) => a.order - b.order),
      cardio: base.cardio ?? rest.find((log) => log.cardio)?.cardio,
      startsNewWeek:
        base.startsNewWeek ||
        rest.some((log) => log.startsNewWeek) ||
        undefined,
      isDeload: base.isDeload || rest.some((log) => log.isDeload) || undefined,
      updatedAt: Date.now(),
    });
    for (const log of rest) dropped.add(log.id);
  }

  if (!dropped.size) return logs;
  return logs
    .filter((log) => !dropped.has(log.id))
    .map((log) => mergedById.get(log.id) ?? log);
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
 * Ensures parsedSets are populated, isActive flags are coherent, un día de la
 * rutina no sale entrenado dos veces la misma fecha (ver mergeDuplicateDayLogs)
 * y el historial no arrastra duplicados del restore (ver repairDuplicatedSets).
 *
 * NO fusiona el cardio suelto en el día de fuerza. Hasta 0.8.1 lo hacía
 * (`mergeSameDayCardio`) y eso DESHACÍA la separación de cardio y fuerza en
 * cada arranque: `loadAppData` normaliza al hidratar, la autorreparación de
 * storage.ts reescribía la BD al ver que faltaban logs y el borrado subía a la
 * nube. Las sesiones de solo cardio son registros propios; no se tocan.
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
    // El orden importa: primero se limpia cada entreno (series y ejercicios) y
    // luego se fusionan los días repetidos. El cardio suelto NO se toca: desde
    // 0.8.1 una sesión de solo cardio es un registro legítimo y propio, no un
    // resto que haya que meter en el día de fuerza (ver lib/cardio.ts).
    logs: mergeDuplicateDayLogs(
      repairDuplicatedSets(dedupeExerciseLogs(ensureParsedSets(rawLogs)))
    ),
  };
}
