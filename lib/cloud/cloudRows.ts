import type { ExerciseRow, RoutineRow, WorkoutDayRow } from '../db/mappers';
import { truncateText } from '../utils';

// Filas del PLAN (rutina, días, ejercicios) tal como suben a la nube. Lo
// comparten el sync incremental (lib/cloud/sync.ts) y la copia completa
// (lib/cloud/backup.ts): antes cada uno armaba la suya y la copia subía las
// columnas que solo existen en el SQLite local, con lo que fallaba entera.
//
// Módulo PURO (sin supabase): se prueba en jest.

type Row = Record<string, unknown>;

/**
 * Topes de texto de la nube: los mismos `CHECK` de supabase/social-schema.sql
 * ("Blindaje"). La app ya limita lo que se escribe (ver lib/exerciseForm.ts),
 * pero un dato guardado antes de esos límites, o importado de otro sitio,
 * podría pasarse; recortado aquí, la fila sube igual en vez de rechazarse y
 * quedarse fuera de la nube para siempre (el outbox la descarta tras varios
 * intentos).
 */
export const CLOUD_TEXT_LIMITS = {
  routineName: 120,
  routineDescription: 1000,
  dayName: 120,
  dayEmoji: 64,
  dayDescription: 1000,
  exerciseName: 200,
  targetReps: 40,
  catalogId: 40,
  activityRef: 200,
  activityTitle: 300,
  activityIcon: 64,
  activityRoutineId: 100,
  activityRoutineName: 200,
} as const;

/**
 * Recorta un texto opcional a `max` caracteres (null/undefined pasan tal cual).
 * Por puntos de código (`truncateText`): partir un emoji dejaría un carácter
 * suelto que Postgres rechaza.
 */
export function clampText<T extends string | null | undefined>(
  value: T,
  max: number
): T {
  return (typeof value === 'string' ? truncateText(value, max) : value) as T;
}

/** Fila lista para la nube: dueño, hora de subida y viva. */
export function own<T extends object>(
  row: T,
  userId: string,
  now: number
): Row {
  return { ...row, user_id: userId, updated_at: now, deleted: false };
}

// La fila de rutina lleva columnas que solo existen en el SQLite local (la
// procedencia de una rutina traída del tablón): se quitan antes de subirla, o
// el upsert fallaría por columna desconocida.
export function cloudRoutineRow(
  row: RoutineRow,
  userId: string,
  now: number
): Row {
  const {
    linked_owner_id: _linked,
    source_routine_id: _source,
    source_author: _author,
    source_owner_id: _owner,
    ...rest
  } = row;
  return own(
    {
      ...rest,
      name: clampText(rest.name, CLOUD_TEXT_LIMITS.routineName),
      description: clampText(
        rest.description,
        CLOUD_TEXT_LIMITS.routineDescription
      ),
    },
    userId,
    now
  );
}

export function cloudDayRow(
  row: WorkoutDayRow,
  userId: string,
  now: number
): Row {
  return own(
    {
      ...row,
      name: clampText(row.name, CLOUD_TEXT_LIMITS.dayName),
      emoji: clampText(row.emoji, CLOUD_TEXT_LIMITS.dayEmoji),
      description: clampText(row.description, CLOUD_TEXT_LIMITS.dayDescription),
    },
    userId,
    now
  );
}

export function cloudExerciseRow(
  row: ExerciseRow,
  userId: string,
  now: number
): Row {
  return own(
    {
      ...row,
      name: clampText(row.name, CLOUD_TEXT_LIMITS.exerciseName),
      target_reps: clampText(row.target_reps, CLOUD_TEXT_LIMITS.targetReps),
      catalog_id: clampText(row.catalog_id, CLOUD_TEXT_LIMITS.catalogId),
    },
    userId,
    now
  );
}
