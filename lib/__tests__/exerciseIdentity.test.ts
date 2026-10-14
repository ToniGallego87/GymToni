import {
  buildExerciseKeyResolver,
  canonicalCatalogId,
  catalogIdOfKey,
  collectExerciseNames,
  exerciseKeyOf,
  formatExerciseNames,
  otherExerciseNames,
  slugExerciseName,
} from '../exerciseIdentity';
import { listExercises } from '../exerciseProgress';
import { ExerciseLog, WorkoutLog, WorkoutRoutine } from '../../types';
import { EXERCISE_VARIANT_OF } from '../../data/exerciseVariants';

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
  exercises: { name: string; catalogId?: string }[],
  extra: Partial<WorkoutRoutine> = {}
): WorkoutRoutine {
  return {
    id: extra.id ?? 'r1',
    name: 'Rutina',
    isActive: true,
    createdAt: 0,
    days: [
      {
        id: 'd1',
        dayNumber: 1,
        name: 'Día 1',
        emoji: '',
        exercises: exercises.map((exercise, index) => ({
          id: `x${index}`,
          order: index,
          ...exercise,
        })),
      },
    ],
    ...extra,
  };
}

describe('slugExerciseName', () => {
  it('ignora tildes, mayúsculas, puntuación y espacios de más', () => {
    expect(slugExerciseName('  Press  BÁNCA, (barra) ')).toBe(
      'press banca barra'
    );
    expect(slugExerciseName('Jalón al pecho')).toBe(
      slugExerciseName('jalon al pecho')
    );
  });
});

describe('exerciseKeyOf', () => {
  it('manda el catálogo; sin catálogo, el nombre normalizado', () => {
    expect(exerciseKeyOf({ name: 'Banca', catalogId: '0025' })).toBe(
      'cat:0025'
    );
    expect(exerciseKeyOf({ name: 'Press Banca' })).toBe('name:press banca');
  });

  it('una copia del catálogo cuenta como su principal', () => {
    const [variant, primary] = Object.entries(EXERCISE_VARIANT_OF)[0];
    expect(canonicalCatalogId(variant)).toBe(primary);
    expect(exerciseKeyOf({ name: 'x', catalogId: variant })).toBe(
      `cat:${primary}`
    );
  });

  it('catalogIdOfKey solo responde a las claves del catálogo', () => {
    expect(catalogIdOfKey('cat:0025')).toBe('0025');
    expect(catalogIdOfKey('name:banca')).toBeUndefined();
  });
});

describe('buildExerciseKeyResolver', () => {
  it('corregir el nombre no parte el historial (manda el catálogo)', () => {
    const logs = [
      log(1, [{ name: 'Press bnca', catalogId: '0025' }]),
      log(2, [{ name: 'Press banca', catalogId: '0025' }]),
    ];
    const resolve = buildExerciseKeyResolver([], logs);
    expect(listExercises(logs, resolve)).toHaveLength(1);
  });

  it('el historial antiguo sin catálogo se une por el nombre vinculado en la rutina', () => {
    const logs = [
      log(1, [{ name: 'Press banca' }]), // anterior a guardar el catalogId
      log(2, [{ name: 'Press banca', catalogId: '0025' }]),
    ];
    const resolve = buildExerciseKeyResolver(
      [routine([{ name: 'Press banca', catalogId: '0025' }])],
      logs
    );
    const [only, ...rest] = listExercises(logs, resolve);
    expect(rest).toEqual([]);
    expect(only.key).toBe('cat:0025');
    expect(only.sessionCount).toBe(2);
  });

  it('el vínculo también se aprende del propio historial', () => {
    const logs = [
      log(1, [{ name: 'Remo' }]),
      log(2, [{ name: 'Remo', catalogId: '0027' }]),
    ];
    const resolve = buildExerciseKeyResolver([], logs);
    expect(resolve({ name: 'remo' })).toBe('cat:0027');
  });

  it('un nombre vinculado a dos ejercicios distintos no se adivina', () => {
    const resolve = buildExerciseKeyResolver(
      [
        routine([{ name: 'Press', catalogId: '0025' }]),
        routine([{ name: 'Press', catalogId: '0091' }], { id: 'r2' }),
      ],
      []
    );
    expect(resolve({ name: 'Press' })).toBe('name:press');
  });

  it('nunca vincula por parecido con el catálogo: solo con tus datos', () => {
    const resolve = buildExerciseKeyResolver([], []);
    expect(resolve({ name: 'Press de banca con barra' })).toBe(
      'name:press de banca con barra'
    );
  });

  it('el catalogId propio del apunte manda sobre lo aprendido por nombre', () => {
    const resolve = buildExerciseKeyResolver(
      [routine([{ name: 'Banca', catalogId: '0025' }])],
      []
    );
    expect(resolve({ name: 'Banca', catalogId: '0289' })).toBe('cat:0289');
  });
});

describe('nombres de un ejercicio (también lo llamas)', () => {
  it('reúne los nombres de un mismo ejercicio, el más reciente primero', () => {
    const logs = [
      log(1, [{ name: 'Banca', catalogId: '0025' }]),
      log(3, [{ name: 'Press banca', catalogId: '0025' }]),
      log(2, [{ name: 'banca', catalogId: '0025' }]), // mismo nombre
      log(4, [{ name: 'Sentadilla' }]),
    ];
    const routines = [routine([{ name: 'Plano', catalogId: '0025' }])];
    const resolve = buildExerciseKeyResolver(routines, logs);
    const names = collectExerciseNames(routines, logs, resolve);

    expect(names.get('cat:0025')).toEqual(['Press banca', 'banca', 'Plano']);
    expect(names.get('name:sentadilla')).toEqual(['Sentadilla']);
  });

  it('el historial antiguo sin catálogo cuenta como otro nombre del ejercicio', () => {
    const logs = [log(1, [{ name: 'Press banca' }])];
    const routines = [routine([{ name: 'Press banca', catalogId: '0025' }])];
    const resolve = buildExerciseKeyResolver(routines, logs);
    expect(
      collectExerciseNames(routines, logs, resolve).get('cat:0025')
    ).toEqual(['Press banca']);
  });

  it('otherExerciseNames quita los que ya se ven, sin mirar tildes', () => {
    expect(
      otherExerciseNames(
        ['Press banca', 'Banca', 'Jalón'],
        'press BANCA',
        'jalon'
      )
    ).toEqual(['Banca']);
    expect(otherExerciseNames(undefined, 'x')).toEqual([]);
  });

  it('formatExerciseNames corta con puntos suspensivos', () => {
    expect(formatExerciseNames(['A', 'B'])).toBe('A, B');
    expect(formatExerciseNames(['A', 'B', 'C', 'D'])).toBe('A, B, C…');
  });
});
