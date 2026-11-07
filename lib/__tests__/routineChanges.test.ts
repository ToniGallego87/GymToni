import {
  buildRoutineChangeComment,
  describeRoutineChanges,
} from '../routineChanges';
import { WorkoutDay, WorkoutRoutine } from '../../types';

const day = (
  id: string,
  dayNumber: number,
  title: string,
  exercises: [string, string, number, string][]
): WorkoutDay => ({
  id,
  dayNumber,
  name: `Día ${dayNumber} - ${title}`,
  emoji: 'chest',
  exercises: exercises.map(([exId, name, targetSets, targetReps], index) => ({
    id: exId,
    name,
    order: index + 1,
    targetSets,
    targetReps,
  })),
});

const routine: WorkoutRoutine = {
  id: 'r1',
  name: 'Fuerza',
  description: 'Tres días',
  isActive: true,
  createdAt: 1,
  days: [
    day('d1', 1, 'Pecho', [
      ['e1', 'Press banca', 4, '10'],
      ['e2', 'Aperturas', 3, '12'],
    ]),
    day('d2', 2, 'Pierna', [['e3', 'Sentadilla', 4, '8']]),
  ],
};

const withDay = (index: number, next: WorkoutDay): WorkoutRoutine => ({
  ...routine,
  days: routine.days.map((d, i) => (i === index ? next : d)),
});

describe('describeRoutineChanges', () => {
  it('sin cambios no dice nada, aunque cambie el icono de un día', () => {
    expect(describeRoutineChanges(routine, routine)).toEqual([]);
    expect(
      describeRoutineChanges(
        routine,
        withDay(0, { ...routine.days[0], emoji: 'back' })
      )
    ).toEqual([]);
  });

  it('cuenta el cambio de ejercicio y el de series y repeticiones', () => {
    const edited = withDay(
      0,
      day('d1', 1, 'Pecho', [
        ['e1', 'Press inclinado', 4, '10'],
        ['e2', 'Aperturas', 4, '15'],
      ])
    );
    expect(describeRoutineChanges(routine, edited)).toEqual([
      'Pecho: Press banca → Press inclinado',
      'Pecho: Aperturas 3×12 → 4×15',
    ]);
  });

  it('quitar uno y poner otro es cambiarlo; lo que sobra es quitado o añadido', () => {
    const swapped = withDay(
      1,
      day('d2', 2, 'Pierna', [['e9', 'Prensa', 4, '10']])
    );
    expect(describeRoutineChanges(routine, swapped)).toEqual([
      'Pierna: Sentadilla → Prensa',
    ]);

    const added = withDay(
      1,
      day('d2', 2, 'Pierna', [
        ['e3', 'Sentadilla', 4, '8'],
        ['e9', 'Prensa', 3, '12'],
      ])
    );
    expect(describeRoutineChanges(routine, added)).toEqual([
      'Pierna: añadido Prensa 3×12',
    ]);

    const removed = withDay(
      0,
      day('d1', 1, 'Pecho', [['e1', 'Press banca', 4, '10']])
    );
    expect(describeRoutineChanges(routine, removed)).toEqual([
      'Pecho: quitado Aperturas',
    ]);
  });

  it('reordenar se dice una vez y renumerar no es renombrar', () => {
    const reordered: WorkoutRoutine = {
      ...routine,
      days: [
        { ...routine.days[1], dayNumber: 1, name: 'Día 1 - Pierna' },
        { ...routine.days[0], dayNumber: 2, name: 'Día 2 - Pecho' },
      ],
    };
    expect(describeRoutineChanges(routine, reordered)).toEqual([
      'Días reordenados',
    ]);

    const exercisesMoved = withDay(0, {
      ...routine.days[0],
      exercises: [...routine.days[0].exercises].reverse(),
    });
    expect(describeRoutineChanges(routine, exercisesMoved)).toEqual([
      'Pecho: ejercicios reordenados',
    ]);
  });

  it('cuenta días añadidos, quitados y renombrados, y la ficha', () => {
    const edited: WorkoutRoutine = {
      ...routine,
      name: 'Fuerza 2',
      description: undefined,
      days: [
        { ...routine.days[0], name: 'Día 1 - Torso' },
        day('d3', 2, 'Brazo', [['e7', 'Curl', 3, '12']]),
      ],
    };
    expect(describeRoutineChanges(routine, edited)).toEqual([
      'Nombre: Fuerza → Fuerza 2',
      'Descripción quitada',
      'Día quitado: Pierna',
      'Día renombrado: Pecho → Torso',
      'Día añadido: Brazo',
    ]);
  });
});

describe('buildRoutineChangeComment', () => {
  it('sin cambios no hay comentario', () => {
    expect(buildRoutineChangeComment(routine, routine, 500)).toBeNull();
  });

  it('pone los cambios en lista bajo su encabezado', () => {
    const edited = { ...routine, name: 'Fuerza 2' };
    expect(buildRoutineChangeComment(routine, edited, 500)).toBe(
      'Cambios en la rutina:\n• Nombre: Fuerza → Fuerza 2'
    );
  });

  it('si no cabe todo, se queda en el límite y cuenta lo que falta', () => {
    const many = Array.from(
      { length: 40 },
      (_, i): [string, string, number, string] => [
        `n${i}`,
        `Ejercicio nuevo número ${i}`,
        3,
        '10',
      ]
    );
    const edited = withDay(1, {
      ...routine.days[1],
      exercises: [
        ...routine.days[1].exercises,
        ...day('x', 2, 'Pierna', many).exercises,
      ],
    });
    const comment = buildRoutineChangeComment(routine, edited, 500) as string;
    expect(comment.length).toBeLessThanOrEqual(500);
    const shown = comment.split('\n').filter((l) => l.startsWith('• ')).length;
    expect(comment.split('\n').pop()).toBe(`…y ${40 - shown} cambios más`);
  });
});
