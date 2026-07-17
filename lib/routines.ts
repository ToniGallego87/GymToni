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
