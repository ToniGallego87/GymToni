import {
  buildCopyName,
  countRoutineSets,
  duplicateRoutine,
  findSavedRoutine,
  intensityLabel,
  isLinkedRoutine,
  linkPublicRoutine,
  routineAuthorId,
  routineClosedAt,
  routineIntensity,
  routineStatus,
  sortRoutinesForList,
  INTENSITY_MEDIUM_MAX,
  INTENSITY_SOFT_MAX,
} from '../routines';
import { WorkoutLog, WorkoutRoutine } from '../../types';

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

describe('rutinas traídas de la comunidad', () => {
  it('enlazar conserva los ids del autor y marca de quién es', () => {
    const linked = linkPublicRoutine(routine, 'user-9', 'Toni');

    expect(linked.id).toBe(routine.id);
    expect(linked.days.map((day) => day.id)).toEqual(['d1', 'd2']);
    expect(linked.linkedOwnerId).toBe('user-9');
    expect(linked.sourceRoutineId).toBe(routine.id);
    expect(linked.sourceAuthor).toBe('Toni');
    expect(linked.isActive).toBe(false);
    expect(isLinkedRoutine(linked)).toBe(true);
  });

  it('copiar una enlazada la hace tuya pero guarda el origen', () => {
    const linked = linkPublicRoutine(routine, 'user-9', 'Toni');
    const copy = duplicateRoutine(linked, [linked.name]);

    expect(isLinkedRoutine(copy)).toBe(false);
    expect(copy.id).not.toBe(linked.id);
    expect(copy.sourceRoutineId).toBe(routine.id);
    expect(copy.sourceAuthor).toBe('Toni');
  });

  it('copiar una copia mantiene el crédito del original', () => {
    const linked = linkPublicRoutine(routine, 'user-9', 'Toni');
    const copy = duplicateRoutine(linked, []);
    const copyOfCopy = duplicateRoutine(copy, [copy.name]);

    expect(copyOfCopy.sourceRoutineId).toBe(routine.id);
    expect(copyOfCopy.sourceAuthor).toBe('Toni');
  });

  it('una rutina propia no arrastra procedencia al duplicarse', () => {
    const copy = duplicateRoutine(routine, []);

    expect(copy.linkedOwnerId).toBeUndefined();
    expect(copy.sourceRoutineId).toBeUndefined();
    expect(copy.sourceAuthor).toBeUndefined();
    expect(copy.sourceOwnerId).toBeUndefined();
    expect(routineAuthorId(copy)).toBeUndefined();
  });

  it('la copia conserva el ID del autor, no solo su nombre', () => {
    const linked = linkPublicRoutine(routine, 'user-9', 'Toni');
    const copy = duplicateRoutine(linked, []);
    const copyOfCopy = duplicateRoutine(copy, [copy.name]);

    // La enlazada sabe quién es el dueño; la copia ya no (es tuya), pero
    // arrastra el autor para poder abrir su perfil desde la marca de origen.
    expect(copy.linkedOwnerId).toBeUndefined();
    expect(copy.sourceOwnerId).toBe('user-9');
    expect(copyOfCopy.sourceOwnerId).toBe('user-9');
    expect(routineAuthorId(linked)).toBe('user-9');
    expect(routineAuthorId(copy)).toBe('user-9');
  });

  it('findSavedRoutine reconoce la enlazada y también la copia', () => {
    const linked = linkPublicRoutine(routine, 'user-9', 'Toni');
    const copy = duplicateRoutine(linked, []);

    expect(findSavedRoutine([linked], routine.id)).toBe(linked);
    expect(findSavedRoutine([copy], routine.id)).toBe(copy);
    expect(findSavedRoutine([], routine.id)).toBeUndefined();
  });
});

describe('intensidad por nº total de series', () => {
  it('countRoutineSets suma los targetSets de todos los días', () => {
    // La rutina de arriba: 4 series en e1, y e2/e3 sin targetSets (no suman).
    expect(countRoutineSets(routine)).toBe(4);
  });

  it('los ejercicios sin targetSets no cuentan', () => {
    const sinSeries: WorkoutRoutine = {
      ...routine,
      days: [{ ...routine.days[1] }],
    };
    expect(countRoutineSets(sinSeries)).toBe(0);
  });

  it('los tramos parten en los cortes documentados', () => {
    expect(routineIntensity(0)).toBe('soft');
    expect(routineIntensity(INTENSITY_SOFT_MAX)).toBe('soft');
    expect(routineIntensity(INTENSITY_SOFT_MAX + 1)).toBe('medium');
    expect(routineIntensity(INTENSITY_MEDIUM_MAX)).toBe('medium');
    expect(routineIntensity(INTENSITY_MEDIUM_MAX + 1)).toBe('hard');
  });

  it('cada tramo tiene su etiqueta', () => {
    expect(intensityLabel('soft')).toBe('Suave');
    expect(intensityLabel('medium')).toBe('Medio');
    expect(intensityLabel('hard')).toBe('Intenso');
  });
});

describe('situación, cierre y orden de la lista', () => {
  const makeRoutine = (id: string, createdAt: number): WorkoutRoutine => ({
    ...routine,
    id,
    name: id,
    isActive: false,
    createdAt,
  });

  const makeLog = (id: string, routineId: string, createdAt: number) =>
    ({
      id,
      routineId,
      dayId: 'd1',
      date: '2025-03-12',
      exercises: [],
      createdAt,
      updatedAt: createdAt,
    }) as WorkoutLog;

  it('cada rutina cae en su situación', () => {
    const activa = makeRoutine('activa', 10);
    const cerrada = makeRoutine('cerrada', 20);
    const nueva = makeRoutine('nueva', 30);
    const logs = [makeLog('l1', 'activa', 100), makeLog('l2', 'cerrada', 200)];

    expect(routineStatus(activa, logs, 'activa')).toBe('active');
    expect(routineStatus(cerrada, logs, 'activa')).toBe('closed');
    expect(routineStatus(nueva, logs, 'activa')).toBe('prepared');
  });

  it('la fecha de cierre es la del último entrenamiento', () => {
    const cerrada = makeRoutine('cerrada', 20);
    const logs = [
      makeLog('l1', 'cerrada', 100),
      makeLog('l2', 'cerrada', 300),
      makeLog('l3', 'otra', 900),
    ];

    expect(routineClosedAt(cerrada, logs)).toBe(300);
  });

  it('una rutina sin entrenamientos no tiene fecha de cierre', () => {
    expect(routineClosedAt(makeRoutine('nueva', 20), [])).toBeUndefined();
  });

  it('sin createdAt la fecha de cierre cae en la del log', () => {
    const cerrada = makeRoutine('cerrada', 20);
    const log = { ...makeLog('l1', 'cerrada', 0), createdAt: undefined };

    expect(routineClosedAt(cerrada, [log as unknown as WorkoutLog])).toBe(
      new Date('2025-03-12T00:00:00').getTime()
    );
  });

  it('ordena: la que entrenas, las sin estrenar y al final las cerradas', () => {
    const activa = makeRoutine('activa', 10);
    const cerradaVieja = makeRoutine('cerrada-vieja', 20);
    const cerradaReciente = makeRoutine('cerrada-reciente', 30);
    const nuevaVieja = makeRoutine('nueva-vieja', 40);
    const nuevaReciente = makeRoutine('nueva-reciente', 50);
    const logs = [
      makeLog('l1', 'activa', 1_000),
      makeLog('l2', 'cerrada-vieja', 100),
      makeLog('l3', 'cerrada-reciente', 900),
    ];

    const sorted = sortRoutinesForList(
      [cerradaVieja, nuevaVieja, cerradaReciente, activa, nuevaReciente],
      logs,
      'activa'
    );

    expect(sorted.map((r) => r.id)).toEqual([
      'activa',
      'nueva-reciente',
      'nueva-vieja',
      'cerrada-reciente',
      'cerrada-vieja',
    ]);
  });

  it('no toca el array original', () => {
    const list = [makeRoutine('a', 10), makeRoutine('b', 20)];
    const snapshot = list.map((r) => r.id);
    sortRoutinesForList(list, [], undefined);

    expect(list.map((r) => r.id)).toEqual(snapshot);
  });
});
