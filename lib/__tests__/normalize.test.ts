import {
  dedupeExerciseLogs,
  mergeDuplicateDayLogs,
  normalizeAppData,
  repairDuplicatedSets,
} from '../normalize';
import { CARDIO_ONLY_DAY_ID } from '../cardio';
import { ExerciseLog, ParsedSet, WorkoutLog } from '../../types';

const makeLog = (
  id: string,
  date: string,
  rawInput: string,
  opts: { cardioOnly?: boolean } = {}
): WorkoutLog => ({
  id,
  routineId: 'r1',
  dayId: opts.cardioOnly ? CARDIO_ONLY_DAY_ID : 'd1',
  date,
  exercises: [],
  cardio: rawInput ? { id: `c-${id}`, type: 'Cardio', rawInput } : undefined,
  createdAt: new Date(`${date}T00:00:00`).valueOf(),
  updatedAt: 0,
  ...(opts.cardioOnly ? { cardioOnly: true } : {}),
});

// Duplicados heredados del restore de la nube (bug 0.7.0).

const makeExerciseLog = (
  rawInput: string,
  parsedSets: ParsedSet[],
  opts: { id?: string; exerciseId?: string; timestamp?: number } = {}
): ExerciseLog => ({
  id: opts.id ?? 'el1',
  exerciseId: opts.exerciseId ?? 'ex1',
  exerciseName: 'Press banca',
  order: 1,
  rawInput,
  parsedSets,
  timestamp: opts.timestamp ?? 1,
});

const withExercises = (exercises: ExerciseLog[]): WorkoutLog[] => [
  {
    id: 'log1',
    routineId: 'r1',
    dayId: 'd1',
    date: '2026-08-13',
    exercises,
    createdAt: 1,
    updatedAt: 1,
  },
];

const sets = (...pairs: [number, number][]): ParsedSet[] =>
  pairs.map(([weight, reps]) => ({ weight, reps }));

describe('repairDuplicatedSets', () => {
  it('rehace las series aunque las copias vengan entrelazadas', () => {
    // Caso real: cada restauración renumera las series, así que al ordenarlas
    // las tres copias de "20x15, 22x14, 22x10" salen mezcladas.
    const logs = repairDuplicatedSets(
      withExercises([
        makeExerciseLog(
          '20x15, 22x14, 22x10',
          sets(
            [20, 15],
            [20, 15],
            [22, 14],
            [20, 15],
            [22, 10],
            [22, 14],
            [22, 14],
            [22, 10],
            [22, 10]
          )
        ),
      ])
    );
    expect(logs[0].exercises[0].parsedSets).toEqual(
      sets([20, 15], [22, 14], [22, 10])
    );
  });

  it('recorta el bloque repetido: 3 series restauradas 3 veces vuelven a 3', () => {
    const original = sets([60, 8], [65, 6], [65, 4]);
    const logs = repairDuplicatedSets(
      withExercises([
        makeExerciseLog('60x8, 65x6, 65x4', [
          ...original,
          ...original,
          ...original,
        ]),
      ])
    );
    expect(logs[0].exercises[0].parsedSets).toEqual(original);
  });

  it('no toca un ejercicio sano aunque sus series sean idénticas', () => {
    const logs = withExercises([
      makeExerciseLog(
        '20x15, 20x15, 20x15',
        sets([20, 15], [20, 15], [20, 15])
      ),
    ]);
    expect(repairDuplicatedSets(logs)).toBe(logs);
  });

  it('con series idénticas duplicadas se queda con las que dice rawInput', () => {
    const logs = repairDuplicatedSets(
      withExercises([
        makeExerciseLog(
          '20x15, 20x15, 20x15',
          sets([20, 15], [20, 15], [20, 15], [20, 15], [20, 15], [20, 15])
        ),
      ])
    );
    expect(logs[0].exercises[0].parsedSets).toHaveLength(3);
  });

  it('respeta las series saltadas ("-") al contar el bloque real', () => {
    const original = sets([10, 12], [10, 11], [-1, -1]);
    const logs = repairDuplicatedSets(
      withExercises([
        makeExerciseLog('10x12, 10x11, -', [...original, ...original]),
      ])
    );
    expect(logs[0].exercises[0].parsedSets).toEqual(original);
  });

  it('sin rawInput no adivina: deja las series como están', () => {
    const logs = withExercises([
      makeExerciseLog('', sets([60, 8], [60, 8], [60, 8])),
    ]);
    expect(repairDuplicatedSets(logs)).toBe(logs);
  });

  it('es idempotente: reparar lo ya reparado no cambia nada', () => {
    const original = sets([60, 8], [65, 6], [65, 4]);
    const once = repairDuplicatedSets(
      withExercises([
        makeExerciseLog('60x8, 65x6, 65x4', [...original, ...original]),
      ])
    );
    expect(repairDuplicatedSets(once)).toBe(once);
  });
});

describe('dedupeExerciseLogs', () => {
  it('deja un solo apunte por ejercicio y se queda con el más reciente', () => {
    const logs = dedupeExerciseLogs(
      withExercises([
        makeExerciseLog('60x8', sets([60, 8]), { id: 'viejo', timestamp: 100 }),
        makeExerciseLog('60x8, 65x6', sets([60, 8], [65, 6]), {
          id: 'nuevo',
          timestamp: 200,
        }),
      ])
    );
    expect(logs[0].exercises).toHaveLength(1);
    expect(logs[0].exercises[0].id).toBe('nuevo');
  });

  it('no toca un entreno con ejercicios distintos', () => {
    const logs = withExercises([
      makeExerciseLog('60x8', sets([60, 8]), { exerciseId: 'ex1' }),
      makeExerciseLog('30x10', sets([30, 10]), {
        id: 'el2',
        exerciseId: 'ex2',
      }),
    ]);
    expect(dedupeExerciseLogs(logs)).toBe(logs);
  });
});

// Días duplicados: el autoguardado antiguo borraba el log y lo recreaba con un
// id nuevo en cada serie, así que un borrado perdido dejaba dos entrenos del
// mismo día y la misma fecha (y el día repetido abría semana nueva).

const makeDayLog = (
  id: string,
  exercises: ExerciseLog[],
  opts: { createdAt?: number; dayId?: string } = {}
): WorkoutLog => ({
  id,
  routineId: 'r1',
  dayId: opts.dayId ?? 'd1',
  date: '2026-08-25',
  exercises,
  createdAt: opts.createdAt ?? 1,
  updatedAt: opts.createdAt ?? 1,
});

describe('mergeDuplicateDayLogs', () => {
  it('fusiona dos entrenos del mismo día y fecha en el más reciente', () => {
    const logs = mergeDuplicateDayLogs([
      makeDayLog('huerfano', [makeExerciseLog('60x8', sets([60, 8]))], {
        createdAt: 100,
      }),
      makeDayLog(
        'vivo',
        [makeExerciseLog('60x8, 65x6', sets([60, 8], [65, 6]))],
        { createdAt: 200 }
      ),
    ]);

    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('vivo');
    expect(logs[0].exercises[0].parsedSets).toEqual(sets([60, 8], [65, 6]));
  });

  it('conserva de cada ejercicio la copia con más series', () => {
    const logs = mergeDuplicateDayLogs([
      makeDayLog(
        'huerfano',
        [
          makeExerciseLog('60x8, 65x6, 65x4', sets([60, 8], [65, 6], [65, 4]), {
            exerciseId: 'ex1',
          }),
        ],
        { createdAt: 100 }
      ),
      makeDayLog(
        'vivo',
        [
          makeExerciseLog('60x8', sets([60, 8]), { exerciseId: 'ex1' }),
          makeExerciseLog('30x10', sets([30, 10]), {
            id: 'el2',
            exerciseId: 'ex2',
          }),
        ],
        { createdAt: 200 }
      ),
    ]);

    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('vivo');
    expect(logs[0].exercises).toHaveLength(2);
    expect(logs[0].exercises[0].parsedSets).toEqual(
      sets([60, 8], [65, 6], [65, 4])
    );
    expect(logs[0].exercises[1].parsedSets).toEqual(sets([30, 10]));
  });

  it('no toca días distintos ni fechas distintas', () => {
    const logs = [
      makeDayLog('a', [makeExerciseLog('60x8', sets([60, 8]))]),
      makeDayLog('b', [makeExerciseLog('60x8', sets([60, 8]))], {
        dayId: 'd2',
      }),
    ];
    expect(mergeDuplicateDayLogs(logs)).toBe(logs);
  });

  it('deja en paz las sesiones de solo cardio (son registros propios)', () => {
    const logs = [
      makeLog('cardio1', '2026-08-25', 'Correr: 10min', { cardioOnly: true }),
      makeLog('cardio2', '2026-08-25', 'Bici: 20min', { cardioOnly: true }),
    ];
    expect(mergeDuplicateDayLogs(logs)).toBe(logs);
  });
});

// Regresión de 0.8.1: la normalización NO puede deshacer la separación de
// cardio y fuerza. Hasta aquí `mergeSameDayCardio` absorbía el log de solo
// cardio en el de fuerza del mismo día y lo descartaba; como `loadAppData`
// normaliza en CADA arranque y storage.ts reescribe la BD al ver que faltan
// logs, el borrado acababa subiendo a la nube y la sesión se perdía.
describe('normalizeAppData y el cardio suelto', () => {
  const base = { routines: [], activeRoutineId: undefined, logs: [] };

  it('conserva la sesión de solo cardio del mismo día que un entreno de fuerza', () => {
    const fuerza = makeLog('log1', '2026-10-02', '');
    const cardio = makeLog(
      'log1-cardio',
      '2026-10-02',
      'Cinta: 15mins 11.5kmh',
      {
        cardioOnly: true,
      }
    );

    const { logs } = normalizeAppData(
      { ...base, logs: [fuerza, cardio] },
      base
    );

    expect(logs.map((l) => l.id).sort()).toEqual(['log1', 'log1-cardio']);
    expect(logs.find((l) => l.id === 'log1-cardio')?.cardio?.rawInput).toBe(
      'Cinta: 15mins 11.5kmh'
    );
    // Y el de fuerza no se queda con el cardio del otro.
    expect(logs.find((l) => l.id === 'log1')?.cardio).toBeUndefined();
  });

  it('no fusiona varias sesiones de solo cardio del mismo día', () => {
    const logs = [
      makeLog('c1', '2026-10-02', 'Correr: 10min', { cardioOnly: true }),
      makeLog('c2', '2026-10-02', 'Bici: 20min', { cardioOnly: true }),
    ];

    expect(normalizeAppData({ ...base, logs }, base).logs).toHaveLength(2);
  });
});
