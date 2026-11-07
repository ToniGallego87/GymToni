import { dayLogProgress, isStrengthLogComplete } from '../openWorkout';
import { WorkoutDay, WorkoutLog, WorkoutRoutine } from '../../types';

const day: WorkoutDay = {
  id: 'd1',
  dayNumber: 1,
  name: 'Día 1 - Empuje',
  emoji: 'push',
  exercises: [
    { id: 'e1', name: 'Press banca', targetSets: 3 },
    { id: 'e2', name: 'Fondos', targetSets: 2 },
    // Sin objetivo: no se mide.
    { id: 'e3', name: 'Estiramientos' },
  ],
} as WorkoutDay;

const routine = { id: 'r1', days: [day] } as WorkoutRoutine;

const set = (extra = false) => ({
  weight: 60,
  reps: 8,
  ...(extra && { extra }),
});

function log(
  sets: Record<string, number | { plan: number; extra: number }>,
  isDeload = false
): WorkoutLog {
  return {
    id: 'l1',
    routineId: 'r1',
    dayId: 'd1',
    isDeload,
    exercises: Object.entries(sets).map(([exerciseId, n]) => {
      const plan = typeof n === 'number' ? n : n.plan;
      const extra = typeof n === 'number' ? 0 : n.extra;
      return {
        exerciseId,
        parsedSets: [
          ...Array.from({ length: plan }, () => set()),
          ...Array.from({ length: extra }, () => set(true)),
        ],
      };
    }),
  } as unknown as WorkoutLog;
}

describe('dayLogProgress', () => {
  it('cuenta los ejercicios con objetivo alcanzado', () => {
    expect(dayLogProgress(log({ e1: 3 }), day)).toBe(0.5);
    expect(dayLogProgress(log({ e1: 3, e2: 2 }), day)).toBe(1);
    expect(dayLogProgress(log({}), day)).toBe(0);
  });

  it('en descarga el objetivo baja una serie', () => {
    expect(dayLogProgress(log({ e1: 2, e2: 1 }, true), day)).toBe(1);
    expect(dayLogProgress(log({ e1: 2, e2: 1 }), day)).toBe(0);
  });

  it('las series extra no cierran el objetivo', () => {
    expect(dayLogProgress(log({ e1: { plan: 2, extra: 2 }, e2: 2 }), day)).toBe(
      0.5
    );
  });

  it('sin día o sin nada que medir, completo', () => {
    expect(dayLogProgress(log({}), undefined)).toBe(1);
    expect(
      dayLogProgress(log({}), { ...day, exercises: [day.exercises[2]] })
    ).toBe(1);
  });

  it('isStrengthLogComplete usa la misma regla', () => {
    expect(isStrengthLogComplete(log({ e1: 3, e2: 2 }), [routine])).toBe(true);
    expect(
      isStrengthLogComplete(log({ e1: { plan: 2, extra: 1 }, e2: 2 }), [
        routine,
      ])
    ).toBe(false);
    expect(isStrengthLogComplete(log({}), [])).toBe(true);
  });
});
