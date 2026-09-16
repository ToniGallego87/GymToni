import { WorkoutDay, WorkoutLog, WorkoutRoutine } from '../types';
import { generateId, getLogTimestamp } from './utils';
import { t } from './i18n';

/**
 * Recuento de ejercicios de un día, con su caso singular ("1 ejercicio", no
 * "1 ejercicios"). Fuente única del rótulo que pintan el selector de sesión y
 * la ficha de la rutina con el día plegado.
 */
export function exerciseCountText(count: number): string {
  return count === 1 ? t('1 ejercicio') : t('{n} ejercicios', { n: count });
}

/**
 * Devuelve el día con el GIF del catálogo fijado en uno de sus ejercicios. El
 * `catalogId` se guarda en la RUTINA (no en el log), para que el play quede
 * directo la próxima vez y viaje al compartir. Fuente única del cálculo que el
 * registro y el detalle de una sesión hacían por su cuenta antes de despachar
 * `UPDATE_DAY`.
 */
export function withExerciseCatalogId(
  day: WorkoutDay,
  exerciseId: string,
  catalogId: string
): WorkoutDay {
  return {
    ...day,
    exercises: day.exercises.map((exercise) =>
      exercise.id === exerciseId ? { ...exercise, catalogId } : exercise
    ),
  };
}

/**
 * Nombre libre para la copia de una rutina: "Push Pull (copia)" y, si ya
 * existe, "(copia 2)", "(copia 3)"…
 */
export function buildCopyName(name: string, existingNames: string[]): string {
  const taken = new Set(existingNames.map((item) => item.trim().toLowerCase()));
  const base = name.trim();

  const candidate = (suffix: string) => `${base} ${suffix}`;
  const isFree = (value: string) => !taken.has(value.trim().toLowerCase());

  const first = candidate(t('(copia)'));
  if (isFree(first)) return first;

  for (let index = 2; index < 100; index += 1) {
    const next = candidate(t('(copia {n})', { n: index }));
    if (isFree(next)) return next;
  }

  return `${base} ${generateId().slice(0, 4)}`;
}

/**
 * Copia una rutina para partir de ella y ajustarla. Ids nuevos en la rutina, en
 * sus días y en sus ejercicios: compartirlos cruzaría el historial (los logs
 * apuntan a `routineId`/`dayId`/`exerciseId`).
 *
 * La copia nace SIN historial, así que el reducer la deja "preparada" (ver
 * `ADD_ROUTINE` en WorkoutContext): se activará al registrar en ella el primer
 * día, no al crearla.
 *
 * La copia es SIEMPRE tuya (`linkedOwnerId` se cae), pero arrastra la
 * procedencia: copiar una rutina enlazada apunta al original, y copiar una copia
 * mantiene el crédito de quien la hizo. El crédito incluye el ID del autor
 * (`sourceOwnerId`), no solo su nombre: es lo que permite abrir su perfil desde
 * la copia, igual que se hace desde la enlazada con `linkedOwnerId`.
 */
export function duplicateRoutine(
  routine: WorkoutRoutine,
  existingNames: string[]
): WorkoutRoutine {
  return {
    ...routine,
    id: generateId(),
    name: buildCopyName(routine.name, existingNames),
    isActive: false,
    createdAt: Date.now(),
    linkedOwnerId: undefined,
    sourceRoutineId: routine.linkedOwnerId
      ? routine.id
      : routine.sourceRoutineId,
    sourceAuthor: routine.sourceAuthor,
    sourceOwnerId: routine.linkedOwnerId ?? routine.sourceOwnerId,
    days: routine.days.map((day) => ({
      ...day,
      id: generateId(),
      exercises: day.exercises.map((exercise) => ({
        ...exercise,
        id: generateId(),
      })),
    })),
  };
}

/**
 * Adopta una rutina PÚBLICA de otra persona por referencia, no por copia: se
 * queda con los ids ORIGINALES (los que devuelve `fetchPublicRoutine`) y se
 * marca con el dueño, así que la app la trata como de solo lectura.
 *
 * Conservar los ids es lo que permite reconocerla como "la misma rutina" de la
 * comunidad, y hace que los entrenamientos registrados en ella apunten al plan
 * del autor. A cambio no se sube a la nube (ver `dbUpsertRoutine`).
 */
export function linkPublicRoutine(
  routine: WorkoutRoutine,
  ownerId: string,
  authorName?: string
): WorkoutRoutine {
  return {
    ...routine,
    isActive: false,
    createdAt: Date.now(),
    linkedOwnerId: ownerId,
    sourceRoutineId: routine.id,
    sourceAuthor: authorName,
    sourceOwnerId: ownerId,
  };
}

/**
 * Huella del PLAN de una rutina (cabecera + días + ejercicios), en orden
 * estable, para saber si la versión pública del autor ha cambiado respecto a
 * la copia local enlazada. Fuera lo que es de este dispositivo: `isActive`,
 * `createdAt` y la procedencia.
 */
export function routinePlanFingerprint(routine: WorkoutRoutine): string {
  const days = [...routine.days]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      name: day.name,
      emoji: day.emoji,
      description: day.description ?? '',
      exercises: [...day.exercises]
        .sort((a, b) => a.order - b.order)
        .map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          order: exercise.order,
          targetReps: exercise.targetReps ?? '',
          targetSets: exercise.targetSets ?? null,
          catalogId: exercise.catalogId ?? '',
        })),
    }));
  return JSON.stringify({
    name: routine.name,
    description: routine.description ?? '',
    days,
  });
}

/**
 * Aplica a la copia local de una rutina ENLAZADA la versión pública actual de
 * su autor. Devuelve la rutina refrescada, o `null` si no hay nada nuevo.
 *
 * Enlazar promete seguir al original: sin esto, la enlazada era una foto del
 * día en que se añadió y el autor podía corregir series o añadir un día sin
 * que nadie se enterase. Se conserva todo lo local (activa, fecha de alta,
 * procedencia) y los GIF que el usuario asignó a mano a ejercicios a los que
 * el autor no ha puesto ninguno.
 */
export function refreshLinkedRoutine(
  local: WorkoutRoutine,
  fresh: WorkoutRoutine
): WorkoutRoutine | null {
  if (!local.linkedOwnerId) return null;

  const localCatalogIds = new Map<string, string>();
  for (const day of local.days) {
    for (const exercise of day.exercises) {
      if (exercise.catalogId)
        localCatalogIds.set(exercise.id, exercise.catalogId);
    }
  }

  const merged: WorkoutRoutine = {
    ...local,
    name: fresh.name,
    description: fresh.description,
    days: fresh.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) =>
        exercise.catalogId || !localCatalogIds.has(exercise.id)
          ? exercise
          : { ...exercise, catalogId: localCatalogIds.get(exercise.id) }
      ),
    })),
  };

  return routinePlanFingerprint(merged) === routinePlanFingerprint(local)
    ? null
    : merged;
}

/** Autor de una rutina ajena, si se sabe quién es (enlazada o copiada). */
export function routineAuthorId(routine: WorkoutRoutine): string | undefined {
  return routine.linkedOwnerId ?? routine.sourceOwnerId;
}

/** Rutina de otra persona: se entrena, no se edita. */
export function isLinkedRoutine(routine: WorkoutRoutine): boolean {
  return !!routine.linkedOwnerId;
}

/**
 * ¿Está ya en tus rutinas esta rutina pública? Cubre las dos formas de tenerla:
 * enlazada (mismo id) o copiada de ella (`sourceRoutineId`).
 */
export function findSavedRoutine(
  routines: WorkoutRoutine[],
  publicRoutineId: string
): WorkoutRoutine | undefined {
  return routines.find(
    (routine) =>
      routine.id === publicRoutineId ||
      routine.sourceRoutineId === publicRoutineId
  );
}

// ─────────────────────── Intensidad de una rutina ───────────────────────
//
// Se deriva del nº TOTAL de series planificadas por semana: la suma de
// `targetSets` de todos los ejercicios de todos los días. El dato ya vive en el
// plan (no hay que pedir nada nuevo al usuario) y es lo que de verdad decide si
// una rutina cabe en tu semana, así que sirve tanto de distintivo en el tablón
// de Comunidad como de filtro.

export type RoutineIntensity = 'soft' | 'medium' | 'hard';

// Cortes en series/semana. Referencia de volumen habitual: por debajo de ~40 la
// semana es de mantenimiento, entre 40 y 70 está la mayoría de rutinas de
// hipertrofia, y por encima de 70 es alto volumen.
export const INTENSITY_SOFT_MAX = 40;
export const INTENSITY_MEDIUM_MAX = 70;

/** Series planificadas en toda la rutina (todos los días, todos los ejercicios). */
export function countRoutineSets(routine: WorkoutRoutine): number {
  return routine.days.reduce(
    (total, day) =>
      total +
      day.exercises.reduce(
        (sum, exercise) => sum + (exercise.targetSets ?? 0),
        0
      ),
    0
  );
}

/** Tramo de intensidad para un total de series semanales. */
export function routineIntensity(totalSets: number): RoutineIntensity {
  if (totalSets <= INTENSITY_SOFT_MAX) return 'soft';
  if (totalSets <= INTENSITY_MEDIUM_MAX) return 'medium';
  return 'hard';
}

/** Etiqueta traducida del tramo (la que se pinta en el distintivo y el filtro). */
export function intensityLabel(level: RoutineIntensity): string {
  if (level === 'soft') return t('Suave');
  if (level === 'medium') return t('Medio');
  return t('Intenso');
}

// ──────────────── Situación de una rutina y orden de la lista ────────────────

/** Situación de una rutina, dicha con una sola palabra. */
export type RoutineStatus = 'active' | 'prepared' | 'closed';

/**
 * Último entrenamiento registrado en cada rutina (epoch ms). Se recorre el
 * historial UNA vez: la lista de Rutinas necesita el dato de todas a la vez
 * (estado, fecha de cierre y orden), y hacerlo rutina a rutina era recorrer
 * `logs` entero tantas veces como rutinas hubiera.
 */
export function lastTrainedByRoutine(logs: WorkoutLog[]): Map<string, number> {
  const last = new Map<string, number>();
  for (const log of logs) {
    const at = getLogTimestamp(log);
    const previous = last.get(log.routineId);
    if (previous === undefined || at > previous) last.set(log.routineId, at);
  }
  return last;
}

/**
 * Cuándo se cerró una rutina: la fecha de su ÚLTIMO entrenamiento, que es el
 * día en que se dejó de usar. No hace falta guardar nada nuevo (no existe un
 * `closedAt`), el historial ya lo dice.
 *
 * Devuelve `undefined` si la rutina no tiene entrenamientos, es decir si nunca
 * llegó a cerrarse (está sin estrenar).
 */
export function routineClosedAt(
  routine: WorkoutRoutine,
  logs: WorkoutLog[]
): number | undefined {
  return lastTrainedByRoutine(logs).get(routine.id);
}

/**
 * Situación de una rutina, con la misma regla que Inicio:
 *  - 'active'   la que se entrena ahora mismo.
 *  - 'prepared' creada pero aún sin estrenar (se activará al registrar su
 *               primer día).
 *  - 'closed'   tiene historial pero ya no es la activa (lo que Inicio llama
 *               "Rutina cerrada").
 */
export function routineStatus(
  routine: WorkoutRoutine,
  logs: WorkoutLog[],
  activeRoutineId?: string
): RoutineStatus {
  if (routine.id === activeRoutineId) return 'active';
  return logs.some((log) => log.routineId === routine.id)
    ? 'closed'
    : 'prepared';
}

/**
 * Orden de la lista de Rutinas por relevancia: primero la que entrenas, luego
 * las que están sin estrenar (la más reciente arriba) y al final las cerradas,
 * de la última que dejaste a la más antigua.
 *
 * Es orden DERIVADO al pintar: no toca el estado ni el orden de creación con el
 * que se guardan. Antes la lista salía tal cual del array y una rutina cerrada
 * hace dos años podía quedar por encima de la activa.
 */
export function sortRoutinesForList(
  routines: WorkoutRoutine[],
  logs: WorkoutLog[],
  activeRoutineId?: string
): WorkoutRoutine[] {
  const lastLog = lastTrainedByRoutine(logs);
  const rank = (routine: WorkoutRoutine): number => {
    if (routine.id === activeRoutineId) return 0;
    return lastLog.has(routine.id) ? 2 : 1;
  };

  return [...routines].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    // Dentro del mismo grupo, lo más reciente arriba: las cerradas por su fecha
    // de cierre y las sin estrenar por cuándo se crearon.
    const aAt = lastLog.get(a.id) ?? a.createdAt;
    const bAt = lastLog.get(b.id) ?? b.createdAt;
    return bAt - aAt;
  });
}
