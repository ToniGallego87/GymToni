import { WorkoutDay, WorkoutLog, WorkoutRoutine } from '../types';
import { ExerciseKeyResolver } from './exerciseIdentity';

/**
 * "Son el mismo ejercicio": une dos ejercicios de Progreso en uno.
 *
 * No hay tabla de equivalencias: unir es VINCULAR. Los apuntes y los ejercicios
 * de rutina del que se une pasan a apuntar al mismo ejercicio que el otro, y la
 * identidad (lib/exerciseIdentity.ts) ya los agrupa juntos. Así viaja por la
 * sincronización y las copias sin nada nuevo, y los ejercicios que se registren
 * después con ese nombre caen en el mismo sitio.
 *
 * - Si alguno de los dos es del catálogo, manda el catálogo: el otro recibe su
 *   `catalogId` (y su GIF). Series, fechas y nombres no se tocan.
 * - Si los dos son propios (sin catálogo), su nombre ES su identidad: el que se
 *   une toma el nombre del otro.
 *
 * Las rutinas enlazadas de la comunidad no se tocan: son de solo lectura.
 */

export interface MergeSide {
  key: string;
  name: string;
  catalogId?: string;
}

export interface ExerciseMergePlan {
  /** Clave con la que queda el ejercicio unido. */
  key: string;
  logs: WorkoutLog[];
  days: { routineId: string; day: WorkoutDay }[];
}

/**
 * Qué cambia al unir `source` con `target` (el que se elige como destino). No
 * modifica nada: devuelve los logs y días a guardar.
 */
export function planExerciseMerge(
  routines: WorkoutRoutine[],
  logs: WorkoutLog[],
  resolve: ExerciseKeyResolver,
  source: MergeSide,
  target: MergeSide,
  now: number = Date.now()
): ExerciseMergePlan {
  // Manda el catálogo; con los dos del catálogo (o ninguno), el destino.
  const catalogId = target.catalogId ?? source.catalogId;
  const winner = target.catalogId || !source.catalogId ? target : source;
  const loser = winner === target ? source : target;
  const rename = !catalogId; // dos propios: el nombre es la identidad

  const changedLogs: WorkoutLog[] = [];
  for (const log of logs) {
    let changed = false;
    const exercises = log.exercises.map((exerciseLog) => {
      const key = resolve({
        name: exerciseLog.exerciseName,
        catalogId: exerciseLog.catalogId,
      });
      if (key !== loser.key) return exerciseLog;
      changed = true;
      return rename
        ? { ...exerciseLog, exerciseName: winner.name }
        : { ...exerciseLog, catalogId };
    });
    if (changed) changedLogs.push({ ...log, exercises, updatedAt: now });
  }

  const changedDays: ExerciseMergePlan['days'] = [];
  for (const routine of routines) {
    if (routine.linkedOwnerId) continue;
    for (const day of routine.days) {
      let changed = false;
      const exercises = day.exercises.map((exercise) => {
        if (resolve(exercise) !== loser.key) return exercise;
        changed = true;
        return rename
          ? { ...exercise, name: winner.name }
          : { ...exercise, catalogId };
      });
      if (changed) {
        changedDays.push({ routineId: routine.id, day: { ...day, exercises } });
      }
    }
  }

  return { key: winner.key, logs: changedLogs, days: changedDays };
}
