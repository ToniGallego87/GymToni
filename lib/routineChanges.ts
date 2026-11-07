import { WorkoutDay, WorkoutExercise, WorkoutRoutine } from '../types';
import { t } from './i18n';
import { getDisplayDayName } from './theme';

/**
 * Qué cambió en el plan de una rutina, en texto: al editar una rutina publicada
 * se deja como comentario en su hilo, para quien la sigue o la ha guardado.
 *
 * Días y ejercicios se emparejan por `id`, que sobrevive a editar y a reordenar
 * (ver lib/exerciseForm.ts). Solo cuenta lo que cambia el entreno o su ficha: el
 * icono de un día, no.
 */

const dayTitle = (day: WorkoutDay) => getDisplayDayName(day.name) || day.name;

const scheme = (exercise: WorkoutExercise) =>
  `${exercise.targetSets ?? '-'}×${exercise.targetReps?.trim() || '-'}`;

/** ¿Lo que sigue en las dos listas sigue en el mismo orden? */
function sameOrder(before: string[], after: string[]): boolean {
  const kept = before.filter((id) => after.includes(id));
  const keptAfter = after.filter((id) => before.includes(id));
  return kept.every((id, index) => id === keptAfter[index]);
}

function exerciseChanges(before: WorkoutDay, after: WorkoutDay): string[] {
  const day = dayTitle(after);
  const beforeIds = before.exercises.map((ex) => ex.id);
  const afterIds = after.exercises.map((ex) => ex.id);
  const removed = before.exercises.filter((ex) => !afterIds.includes(ex.id));
  const added = after.exercises.filter((ex) => !beforeIds.includes(ex.id));
  const changes: string[] = [];

  for (const exercise of after.exercises) {
    const previous = before.exercises.find((ex) => ex.id === exercise.id);
    if (!previous) continue;
    const renamed = previous.name !== exercise.name;
    const oldScheme = scheme(previous);
    const newScheme = scheme(exercise);
    if (renamed && oldScheme !== newScheme) {
      changes.push(
        `${day}: ${previous.name} ${oldScheme} → ${exercise.name} ${newScheme}`
      );
    } else if (renamed) {
      changes.push(`${day}: ${previous.name} → ${exercise.name}`);
    } else if (oldScheme !== newScheme) {
      changes.push(`${day}: ${exercise.name} ${oldScheme} → ${newScheme}`);
    }
  }

  // Quitar uno y poner otro es cambiarlo.
  const replaced = Math.min(removed.length, added.length);
  for (let i = 0; i < replaced; i++) {
    changes.push(`${day}: ${removed[i].name} → ${added[i].name}`);
  }
  for (const exercise of removed.slice(replaced)) {
    changes.push(t('{day}: quitado {name}', { day, name: exercise.name }));
  }
  for (const exercise of added.slice(replaced)) {
    changes.push(
      t('{day}: añadido {name} {scheme}', {
        day,
        name: exercise.name,
        scheme: scheme(exercise),
      })
    );
  }

  if (!sameOrder(beforeIds, afterIds)) {
    changes.push(t('{day}: ejercicios reordenados', { day }));
  }
  return changes;
}

/** Los cambios de `before` a `after`, uno por línea; vacío si no hay ninguno. */
export function describeRoutineChanges(
  before: WorkoutRoutine,
  after: WorkoutRoutine
): string[] {
  const changes: string[] = [];

  if (before.name !== after.name) {
    changes.push(t('Nombre: {a} → {b}', { a: before.name, b: after.name }));
  }
  if ((before.description ?? '') !== (after.description ?? '')) {
    changes.push(
      after.description
        ? t('Descripción: {text}', { text: after.description })
        : t('Descripción quitada')
    );
  }

  const afterDayIds = after.days.map((day) => day.id);
  for (const day of before.days) {
    if (!afterDayIds.includes(day.id)) {
      changes.push(t('Día quitado: {day}', { day: dayTitle(day) }));
    }
  }
  for (const day of after.days) {
    const previous = before.days.find((d) => d.id === day.id);
    if (!previous) {
      changes.push(t('Día añadido: {day}', { day: dayTitle(day) }));
      continue;
    }
    // Sin el prefijo "Día N": reordenar lo renumera y eso no es renombrar.
    if (getDisplayDayName(previous.name) !== getDisplayDayName(day.name)) {
      changes.push(
        t('Día renombrado: {a} → {b}', {
          a: dayTitle(previous),
          b: dayTitle(day),
        })
      );
    }
    changes.push(...exerciseChanges(previous, day));
  }

  if (
    !sameOrder(
      before.days.map((day) => day.id),
      afterDayIds
    )
  ) {
    changes.push(t('Días reordenados'));
  }
  return changes;
}

/**
 * El comentario con esos cambios, o `null` si no hay ninguno. Si no caben todos
 * en `maxLength` (el CHECK de la tabla), se cuenta lo que queda fuera.
 */
export function buildRoutineChangeComment(
  before: WorkoutRoutine,
  after: WorkoutRoutine,
  maxLength: number
): string | null {
  const changes = describeRoutineChanges(before, after);
  if (!changes.length) return null;

  const more = (n: number) =>
    n === 1 ? t('…y 1 cambio más') : t('…y {n} cambios más', { n });
  const lines = [t('Cambios en la rutina:')];
  for (const [index, change] of changes.entries()) {
    const line = `• ${change}`;
    const left = changes.length - index - 1;
    const tail = left ? [more(left)] : [];
    if ([...lines, line, ...tail].join('\n').length > maxLength) {
      lines.push(more(changes.length - index));
      break;
    }
    lines.push(line);
  }
  return lines.join('\n');
}
