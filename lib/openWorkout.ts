import { useSyncExternalStore } from 'react';
import { WorkoutDay, WorkoutLog, WorkoutRoutine } from '../types';
import { isCardioOnlyLog } from './cardio';
import { getToday, logDateKey } from './utils';

/**
 * El entreno que se está registrando AHORA y aún no ha terminado. Retos e
 * insignias no lo cuentan hasta que se suelta: el registro se autoguarda serie
 * a serie, así que sin esto se recalculaban a mitad de sesión y un solo
 * ejercicio mejorado ya daba "¡Reto superado! +3 %" (la comparación de días
 * solo mira los ejercicios que están en las dos sesiones).
 *
 * Lo fija `WorkoutLogScreen` al abrirse y lo suelta con el día completo o al
 * salir; al soltarlo, `useAccountLevel` recalcula y avisa en ese momento. Store
 * de módulo con suscriptores, como `lib/awards.ts`.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let openLogId: string | null = null;

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getOpenWorkoutLog(): string | null {
  return openLogId;
}

export function setOpenWorkoutLog(id: string | null): void {
  if (openLogId === id) return;
  openLogId = id;
  for (const listener of Array.from(listeners)) listener();
}

/** Id del entreno en curso (sin terminar), reactivo. */
export function useOpenWorkoutLog(): string | null {
  return useSyncExternalStore(subscribe, getOpenWorkoutLog, getOpenWorkoutLog);
}

/**
 * ¿El entreno de fuerza tiene todos los ejercicios de su día con las series
 * objetivo? Mismo criterio que el registro (`countIncompleteExercises` en
 * WorkoutLogScreen), que es el que suelta el entreno al completarlo: en
 * descarga el objetivo baja una serie y los ejercicios sin objetivo no
 * bloquean. Si su día ya no existe en ninguna rutina, se da por completo (no
 * hay contra qué medirlo).
 */
export function isStrengthLogComplete(
  log: WorkoutLog,
  routines: WorkoutRoutine[]
): boolean {
  let day: WorkoutDay | undefined;
  for (const routine of routines) {
    day = routine.days.find((d) => d.id === log.dayId);
    if (day) break;
  }
  if (!day) return true;
  return day.exercises.every((ex) => {
    const base = ex.targetSets ?? 0;
    if (base <= 0) return true;
    const target = log.isDeload ? Math.max(1, base - 1) : base;
    const exLog = log.exercises.find((e) => e.exerciseId === ex.id);
    return (exLog?.parsedSets?.length ?? 0) >= target;
  });
}

// Caché de una entrada: el hook de nivel está montado en varios sitios a la vez
// y sus cachés comparan los logs por identidad; devolver siempre el mismo array
// para las mismas entradas evita recalcular retos e insignias en cada uno.
let cache: {
  logs: WorkoutLog[];
  id: string | null;
  routines: WorkoutRoutine[];
  today: string;
  result: WorkoutLog[];
} | null = null;

/**
 * Los logs que cuentan para retos e insignias: sin el entreno abierto en el
 * registro y sin el de HOY si está a medias. Salir del registro con un solo
 * ejercicio hecho soltaba el entreno y "Semana completa" saltaba por un día
 * empezado. Un día a medias cuenta al completarse o cuando deja de ser hoy
 * (la misma regla que Inicio aplica a la semana y la racha).
 */
export function logsForAwards(
  logs: WorkoutLog[],
  id: string | null,
  routines: WorkoutRoutine[],
  today: string = getToday()
): WorkoutLog[] {
  if (
    cache &&
    cache.logs === logs &&
    cache.id === id &&
    cache.routines === routines &&
    cache.today === today
  ) {
    return cache.result;
  }
  const excluded = (log: WorkoutLog) =>
    log.id === id ||
    (!isCardioOnlyLog(log) &&
      logDateKey(log) === today &&
      !isStrengthLogComplete(log, routines));
  const result = logs.some(excluded) ? logs.filter((l) => !excluded(l)) : logs;
  cache = { logs, id, routines, today, result };
  return result;
}
