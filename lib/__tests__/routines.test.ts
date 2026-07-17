import { buildCopyName, duplicateRoutine } from '../routines';
import { WorkoutRoutine } from '../../types';

const routine: WorkoutRoutine = {
  id: 'r1',
  name: 'Push Pull',
  description: 'Tres días',
  isActive: true,
  createdAt: 1_700_000_000_000,
  timerDuration: 120,
  days: [
    {
      id: 'd1',
      dayNumber: 1,
      name: 'Empuje',
      emoji: '💪',
      exercises: [
        { id: 'e1', name: 'Press banca', order: 0, targetSets: 4 },
        { id: 'e2', name: 'Fondos', order: 1 },
      ],
    },
    {
      id: 'd2',
      dayNumber: 2,
      name: 'Tirón',
      emoji: '🏋️',
      exercises: [{ id: 'e3', name: 'Remo', order: 0 }],
    },
  ],
};

describe('buildCopyName', () => {
  it('marca la copia', () => {
    expect(buildCopyName('Push Pull', [])).toBe('Push Pull (copia)');
  });

  it('numera a partir de la segunda copia', () => {
    expect(buildCopyName('Push Pull', ['Push Pull', 'Push Pull (copia)'])).toBe(
      'Push Pull (copia 2)'
    );
    expect(
      buildCopyName('Push Pull', [
        'Push Pull (copia)',
        'Push Pull (copia 2)',
        'Push Pull (copia 3)',
      ])
    ).toBe('Push Pull (copia 4)');
  });

  it('no distingue mayúsculas ni espacios al comparar', () => {
    expect(buildCopyName('  Push Pull  ', ['push pull (COPIA)'])).toBe(
      'Push Pull (copia 2)'
    );
  });
});

describe('duplicateRoutine', () => {
  it('copia el contenido con ids nuevos en rutina, días y ejercicios', () => {
    const copy = duplicateRoutine(routine, [routine.name]);

    expect(copy.id).not.toBe(routine.id);
    expect(copy.days.map((day) => day.id)).not.toEqual(['d1', 'd2']);
    expect(
      copy.days.flatMap((day) => day.exercises.map((e) => e.id))
    ).not.toEqual(['e1', 'e2', 'e3']);

    // El contenido sí es el mismo.
    expect(copy.days.map((day) => day.name)).toEqual(['Empuje', 'Tirón']);
    expect(copy.days[0].exercises.map((e) => e.name)).toEqual([
      'Press banca',
      'Fondos',
    ]);
    expect(copy.days[0].exercises[0].targetSets).toBe(4);
    expect(copy.description).toBe(routine.description);
    expect(copy.timerDuration).toBe(120);
  });

  it('todos los ids nuevos son distintos entre sí', () => {
    const copy = duplicateRoutine(routine, []);
    const ids = [
      copy.id,
      ...copy.days.map((day) => day.id),
      ...copy.days.flatMap((day) => day.exercises.map((e) => e.id)),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('la copia nace sin activar y con su propio nombre', () => {
    const copy = duplicateRoutine(routine, [routine.name]);

    expect(copy.isActive).toBe(false);
    expect(copy.name).toBe('Push Pull (copia)');
    expect(copy.createdAt).toBeGreaterThan(routine.createdAt);
  });

  it('no toca la rutina original', () => {
    const snapshot = JSON.parse(JSON.stringify(routine));
    duplicateRoutine(routine, []);

    expect(routine).toEqual(snapshot);
  });
});
