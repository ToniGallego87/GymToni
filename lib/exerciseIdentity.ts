import { WorkoutLog, WorkoutRoutine } from '../types';
import { EXERCISE_VARIANT_OF } from '../data/exerciseVariants';

/**
 * Identidad de un ejercicio: cuándo dos apuntes son "el mismo ejercicio" para
 * el historial, los récords y Progreso.
 *
 * Manda el ejercicio del CATÁLOGO, no el nombre escrito. El nombre es solo una
 * etiqueta: "Banca", "Press banca" y "Press de banca" vinculados al mismo
 * ejercicio del catálogo son uno solo, y corregir una falta en el nombre ya no
 * parte el historial en dos.
 *
 * Clave de agrupado, por orden:
 *   1. `cat:<id>` si el apunte lleva `catalogId` (las copias del catálogo —otra
 *      cámara, "v. 2"— cuentan como su principal).
 *   2. `cat:<id>` si no lo lleva pero ESE nombre está vinculado a un único
 *      ejercicio del catálogo en tus rutinas o en tu historial. Así el historial
 *      de antes de guardar el `catalogId` en cada apunte se une con el nuevo
 *      sin reescribir nada.
 *   3. `name:<nombre normalizado>` para los ejercicios propios (sin catálogo).
 *
 * El paso 2 solo mira TUS datos: nunca vincula un nombre a un ejercicio del
 * catálogo por parecido. Eso lo propone la app y lo confirmas tú.
 */

/** Nombre para comparar: sin tildes, mayúsculas, puntuación ni espacios de más. */
export function slugExerciseName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Id del catálogo que cuenta para el historial (una copia → su principal). */
export function canonicalCatalogId(id: string): string {
  return EXERCISE_VARIANT_OF[id] ?? id;
}

export interface ExerciseRef {
  name: string;
  catalogId?: string;
}

export type ExerciseKeyResolver = (ref: ExerciseRef) => string;

const CATALOG_PREFIX = 'cat:';
const NAME_PREFIX = 'name:';

/** Clave sin contexto: el `catalogId` si lo hay, si no el nombre normalizado. */
export function exerciseKeyOf(ref: ExerciseRef): string {
  return ref.catalogId
    ? CATALOG_PREFIX + canonicalCatalogId(ref.catalogId)
    : NAME_PREFIX + slugExerciseName(ref.name);
}

/** Id del catálogo de una clave `cat:`; undefined si es un ejercicio propio. */
export function catalogIdOfKey(key: string): string | undefined {
  return key.startsWith(CATALOG_PREFIX)
    ? key.slice(CATALOG_PREFIX.length)
    : undefined;
}

/**
 * Nombre normalizado → ejercicio del catálogo, sacado de las rutinas y del
 * historial. Un nombre vinculado a DOS ejercicios distintos es ambiguo y no se
 * resuelve (se queda como ejercicio propio, como hasta ahora).
 */
function linkedNames(
  routines: WorkoutRoutine[],
  logs: WorkoutLog[]
): Map<string, string> {
  const candidates = new Map<string, Set<string>>();
  const note = (name: string, catalogId?: string) => {
    if (!catalogId) return;
    const slug = slugExerciseName(name);
    if (!slug) return;
    const set = candidates.get(slug) ?? new Set<string>();
    set.add(canonicalCatalogId(catalogId));
    candidates.set(slug, set);
  };
  for (const routine of routines) {
    for (const day of routine.days) {
      for (const exercise of day.exercises) {
        note(exercise.name, exercise.catalogId);
      }
    }
  }
  for (const log of logs) {
    for (const exerciseLog of log.exercises || []) {
      note(exerciseLog.exerciseName, exerciseLog.catalogId);
    }
  }

  const resolved = new Map<string, string>();
  candidates.forEach((ids, slug) => {
    if (ids.size === 1) resolved.set(slug, [...ids][0]);
  });
  return resolved;
}

/**
 * Resolutor de claves con el contexto de la persona (ver el paso 2 arriba).
 * Construirlo recorre rutinas e historial: hacerlo una vez (useMemo) y
 * reutilizarlo para todos los ejercicios.
 */
export function buildExerciseKeyResolver(
  routines: WorkoutRoutine[],
  logs: WorkoutLog[]
): ExerciseKeyResolver {
  const byName = linkedNames(routines, logs);
  return (ref) => {
    if (ref.catalogId) return exerciseKeyOf(ref);
    const linked = byName.get(slugExerciseName(ref.name));
    return linked ? CATALOG_PREFIX + linked : exerciseKeyOf(ref);
  };
}

/**
 * Nombres con los que aparece cada ejercicio en tus rutinas y tu historial: un
 * ejercicio es UNO con varios nombres ("Banca", "Press banca"…), y esto es lo
 * que la app enseña como "también lo llamas". Por clave, sin repetir nombres
 * que solo cambian en tildes o mayúsculas, y el escrito más recientemente
 * primero (con la grafía de esa vez).
 */
export function collectExerciseNames(
  routines: WorkoutRoutine[],
  logs: WorkoutLog[],
  resolve: ExerciseKeyResolver
): Map<string, string[]> {
  const names = new Map<string, Map<string, string>>();
  const note = (ref: ExerciseRef) => {
    const name = ref.name.trim();
    const slug = slugExerciseName(name);
    if (!slug) return;
    const key = resolve(ref);
    const bySlug = names.get(key) ?? new Map<string, string>();
    if (!bySlug.has(slug)) bySlug.set(slug, name);
    names.set(key, bySlug);
  };

  const newestFirst = [...logs].sort((a, b) => b.createdAt - a.createdAt);
  for (const log of newestFirst) {
    for (const exerciseLog of log.exercises || []) {
      note({
        name: exerciseLog.exerciseName,
        catalogId: exerciseLog.catalogId,
      });
    }
  }
  // Lo que está en una rutina pero aún no se ha entrenado, detrás.
  for (const routine of routines) {
    for (const day of routine.days) {
      for (const exercise of day.exercises) note(exercise);
    }
  }

  const result = new Map<string, string[]>();
  names.forEach((bySlug, key) => result.set(key, [...bySlug.values()]));
  return result;
}

/**
 * Los OTROS nombres de un ejercicio: los de `collectExerciseNames` menos los
 * que se pasan (el que se está viendo, el del catálogo…), comparando sin
 * tildes ni mayúsculas.
 */
export function otherExerciseNames(
  names: string[] | undefined,
  ...exclude: (string | undefined)[]
): string[] {
  const skip = new Set(
    exclude.filter(Boolean).map((name) => slugExerciseName(name!))
  );
  return (names ?? []).filter((name) => !skip.has(slugExerciseName(name)));
}

/** "Banca, Press banca, Plano…": los primeros nombres y puntos si hay más. */
export function formatExerciseNames(names: string[], max = 3): string {
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown}…` : shown;
}
