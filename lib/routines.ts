import { WorkoutRoutine } from '../types';
import { generateId } from './utils';
import { t } from './i18n';

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
