// Ejercicios ADICIONALES: los que se añaden a un entreno desde el registro sin
// pertenecer al día de la rutina ("hoy además he hecho curl").
//
// No tocan la rutina ni el esquema de datos: se reconocen por su `exerciseId`,
// que lleva un prefijo propio y el objetivo con el que se crearon (series y
// reps, que el apunte no guarda en ningún otro sitio):
//
//   extra|<series>|<reps codificadas>|<id aleatorio>
//
// Así viajan tal cual por SQLite, la nube y las copias, y una versión anterior
// de la app los ve como un apunte más de un ejercicio que ya no está en el día.
//
// Quedan FUERA de toda comparación con la rutina: la mejora de la sesión y de
// la semana, "la vez anterior" y los récords del registro, y la evolución de
// Progreso por ejercicio. Sí se ven en el Detalle del día, marcados.
import { ExerciseLog, WorkoutExercise } from '../types';
import { generateId } from './utils';

const EXTRA_PREFIX = 'extra|';

/** Id nuevo de ejercicio adicional, con su objetivo dentro. */
export function makeExtraExerciseId(
  targetSets: number,
  targetReps: string
): string {
  return `${EXTRA_PREFIX}${targetSets}|${encodeURIComponent(
    targetReps
  )}|${generateId()}`;
}

export function isExtraExerciseId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(EXTRA_PREFIX);
}

/** ¿El apunte es de un ejercicio adicional? */
export const isExtraExerciseLog = (exerciseLog: ExerciseLog): boolean =>
  isExtraExerciseId(exerciseLog.exerciseId);

/** Objetivo guardado en el id (series y reps), o null si no es adicional. */
export function parseExtraExerciseId(
  id: string
): { targetSets: number; targetReps: string } | null {
  if (!isExtraExerciseId(id)) return null;
  const [, sets, reps] = id.split('|');
  const targetSets = parseInt(sets, 10);
  let targetReps = '';
  try {
    targetReps = decodeURIComponent(reps ?? '');
  } catch {
    targetReps = reps ?? '';
  }
  return {
    targetSets: Number.isFinite(targetSets) && targetSets > 0 ? targetSets : 0,
    targetReps,
  };
}

/**
 * Los ejercicios adicionales de un entreno guardado, como ejercicios del
 * registro (para reabrirlo y seguir metiendo series), en su orden.
 */
export function extraExercisesFromLog(
  exercises: ExerciseLog[] | undefined
): WorkoutExercise[] {
  return (exercises ?? [])
    .filter(isExtraExerciseLog)
    .sort((a, b) => a.order - b.order)
    .map((exerciseLog) => {
      const target = parseExtraExerciseId(exerciseLog.exerciseId);
      return {
        id: exerciseLog.exerciseId,
        name: exerciseLog.exerciseName,
        order: exerciseLog.order,
        catalogId: exerciseLog.catalogId,
        targetSets: target?.targetSets || undefined,
        targetReps: target?.targetReps || undefined,
      };
    });
}
