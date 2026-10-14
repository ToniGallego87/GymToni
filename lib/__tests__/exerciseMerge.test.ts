import { buildExerciseKeyResolver } from '../exerciseIdentity';
import { planExerciseMerge } from '../exerciseMerge';
import { listExercises } from '../exerciseProgress';
import { ExerciseLog, WorkoutLog, WorkoutRoutine } from '../../types';

let seq = 0;
function log(
  day: number,
  exercises: { name: string; catalogId?: string }[]
): WorkoutLog {
  const createdAt = 1_700_000_000_000 + day * 24 * 3600 * 1000;
  const id = `log${++seq}`;
  return {
    id,
    routineId: 'r1',
    dayId: 'd1',
    date: new Date(createdAt).toISOString().slice(0, 10),
    exercises: exercises.map(
      (exercise, index): ExerciseLog => ({
        id: `${id}-e${index}`,
        exerciseId: `${id}-x${index}`,
        exerciseName: exercise.name,
        catalogId: exercise.catalogId,
        order: index,
        rawInput: '60x8',
        parsedSets: [{ weight: 60, reps: 8 }],
        timestamp: createdAt,
      })
    ),
    createdAt,
    updatedAt: createdAt,
  };
}

function routine(
  id: string,
  exercises: { name: string; catalogId?: string }[],
  extra: Partial<WorkoutRoutine> = {}
): WorkoutRoutine {
  return {
    id,
    name: id,
    isActive: false,
    createdAt: 0,
    days: [
      {
        id: `${id}-d1`,
        dayNumber: 1,
        name: 'Día 1',
        emoji: '',
        exercises: exercises.map((exercise, index) => ({
          id: `${id}-x${index}`,
          order: index,
          ...exercise,
        })),
      },
    ],
    ...extra,
  };
}

/** Aplica el plan como lo haría la pantalla (UPDATE_DAY + UPDATE_WORKOUT_LOG). */
function apply(
  routines: WorkoutRoutine[],
  logs: WorkoutLog[],
  plan: ReturnType<typeof planExerciseMerge>
) {
  const nextRoutines = routines.map((r) => ({
    ...r,
    days: r.days.map(
      (d) =>
        plan.days.find((c) => c.routineId === r.id && c.day.id === d.id)?.day ??
        d
    ),
  }));
  const nextLogs = logs.map((l) => plan.logs.find((c) => c.id === l.id) ?? l);
  return { routines: nextRoutines, logs: nextLogs };
}

function summaries(routines: WorkoutRoutine[], logs: WorkoutLog[]) {
  const resolve = buildExerciseKeyResolver(routines, logs);
  return { resolve, list: listExercises(logs, resolve) };
}

describe('planExerciseMerge', () => {
  it('un ejercicio propio que se une a uno del catálogo recibe su vínculo', () => {
    const routines = [routine('r1', [{ name: 'Banca' }])];
    const logs = [
      log(1, [{ name: 'Banca' }]),
      log(2, [{ name: 'Press de banca', catalogId: '0025' }]),
    ];
    const { resolve, list } = summaries(routines, logs);
    const source = list.find((e) => e.name === 'Banca')!;
    const target = list.find((e) => e.name === 'Press de banca')!;

    const plan = planExerciseMerge(routines, logs, resolve, source, target, 99);
    expect(plan.key).toBe('cat:0025');
    // Vincula sin tocar el nombre ni las series.
    expect(plan.logs).toHaveLength(1);
    expect(plan.logs[0].exercises[0]).toMatchObject({
      exerciseName: 'Banca',
      catalogId: '0025',
      parsedSets: [{ weight: 60, reps: 8 }],
    });
    expect(plan.logs[0].updatedAt).toBe(99);
    expect(plan.days[0].day.exercises[0]).toMatchObject({
      name: 'Banca',
      catalogId: '0025',
    });

    const after = apply(routines, logs, plan);
    const merged = summaries(after.routines, after.logs).list;
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ key: 'cat:0025', sessionCount: 2 });
  });

  it('manda el catálogo aunque el destino elegido sea el propio', () => {
    const logs = [
      log(1, [{ name: 'Jalón', catalogId: '0150' }]),
      log(2, [{ name: 'Polea al pecho' }]),
    ];
    const { resolve, list } = summaries([], logs);
    const source = list.find((e) => e.name === 'Jalón')!;
    const target = list.find((e) => e.name === 'Polea al pecho')!;

    const plan = planExerciseMerge([], logs, resolve, source, target);
    expect(plan.key).toBe('cat:0150');
    expect(plan.logs[0].exercises[0]).toMatchObject({
      exerciseName: 'Polea al pecho',
      catalogId: '0150',
    });
    expect(summaries([], apply([], logs, plan).logs).list).toHaveLength(1);
  });

  it('dos ejercicios propios: el que se une toma el nombre del otro', () => {
    const routines = [routine('r1', [{ name: 'Remo maq' }])];
    const logs = [
      log(1, [{ name: 'Remo maq' }]),
      log(2, [{ name: 'Remo en máquina del gym' }]),
    ];
    const { resolve, list } = summaries(routines, logs);
    const source = list.find((e) => e.name === 'Remo maq')!;
    const target = list.find((e) => e.name === 'Remo en máquina del gym')!;

    const plan = planExerciseMerge(routines, logs, resolve, source, target);
    expect(plan.key).toBe(target.key);
    expect(plan.logs[0].exercises[0].exerciseName).toBe(
      'Remo en máquina del gym'
    );
    expect(plan.days[0].day.exercises[0].name).toBe('Remo en máquina del gym');

    const after = apply(routines, logs, plan);
    expect(summaries(after.routines, after.logs).list).toHaveLength(1);
  });

  it('no toca las rutinas enlazadas de la comunidad ni lo que no se une', () => {
    const routines = [
      routine('mine', [{ name: 'Banca' }, { name: 'Sentadilla' }]),
      routine('linked', [{ name: 'Banca' }], { linkedOwnerId: 'otro' }),
    ];
    const logs = [
      log(1, [{ name: 'Banca' }, { name: 'Sentadilla' }]),
      log(2, [{ name: 'Press de banca', catalogId: '0025' }]),
      log(3, [{ name: 'Sentadilla' }]),
    ];
    const { resolve, list } = summaries(routines, logs);
    const source = list.find((e) => e.name === 'Banca')!;
    const target = list.find((e) => e.name === 'Press de banca')!;

    const plan = planExerciseMerge(routines, logs, resolve, source, target);
    expect(plan.days.map((d) => d.routineId)).toEqual(['mine']);
    expect(plan.days[0].day.exercises[1]).toEqual(
      routines[0].days[0].exercises[1]
    );
    // Solo el log que tenía "Banca"; el de solo sentadilla no se reescribe.
    expect(plan.logs.map((l) => l.id)).toEqual([logs[0].id]);
    expect(plan.logs[0].exercises[1]).toEqual(logs[0].exercises[1]);
  });
});
