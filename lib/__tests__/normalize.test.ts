import {
  dedupeExerciseLogs,
  mergeDuplicateDayLogs,
  mergeSameDayCardio,
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

describe('mergeSameDayCardio', () => {
  it('mete el cardio suelto dentro del día de fuerza de esa fecha', () => {
    const logs = mergeSameDayCardio([
      makeLog('fuerza', '2026-07-16', 'Andar en cinta: 20min, 6kmh, 5%'),
      makeLog('suelto', '2026-07-16', 'Correr: 10min, 12kmh', {
        cardioOnly: true,
      }),
    ]);
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('fuerza');
    expect(logs[0].cardio!.rawInput).toBe(
      'Andar en cinta: 20min, 6kmh, 5% | Correr: 10min, 12kmh'
    );
  });

  it('respeta el solo cardio de un día sin fuerza', () => {
    const logs = mergeSameDayCardio([
      makeLog('fuerza', '2026-07-16', 'Correr: 10min, 12kmh'),
      makeLog('suelto', '2026-07-15', 'Bici: 30min, 20kmh', {
        cardioOnly: true,
      }),
    ]);
    expect(logs).toHaveLength(2);
    expect(logs[1].cardio!.rawInput).toBe('Bici: 30min, 20kmh');
  });

  it('no toca dos días de fuerza distintos de la misma fecha', () => {
    const a = makeLog('a', '2026-07-16', 'Correr: 10min, 12kmh');
    const b = {
      ...makeLog('b', '2026-07-16', 'Bici: 20min, 20kmh'),
      dayId: 'd2',
    };
    expect(mergeSameDayCardio([a, b])).toEqual([a, b]);
  });

  it('es idempotente: sin sueltos que fusionar devuelve los mismos logs', () => {
    const logs = [makeLog('fuerza', '2026-07-16', 'Correr: 10min, 12kmh')];
    expect(mergeSameDayCardio(logs)).toBe(logs);
  });

  it('absorbe el día de fuerza que aún no tenía cardio', () => {
    const logs = mergeSameDayCardio([
      makeLog('fuerza', '2026-07-16', ''),
      makeLog('suelto', '2026-07-16', 'Bici: 30min, 20kmh', {
        cardioOnly: true,
      }),
    ]);
    expect(logs).toHaveLength(1);
    expect(logs[0].cardio!.rawInput).toBe('Bici: 30min, 20kmh');
  });
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

  it('deja en paz las sesiones de solo cardio (las fusiona mergeSameDayCardio)', () => {
    const logs = [
      makeLog('cardio1', '2026-08-25', 'Correr: 10min', { cardioOnly: true }),
      makeLog('cardio2', '2026-08-25', 'Bici: 20min', { cardioOnly: true }),
    ];
    expect(mergeDuplicateDayLogs(logs)).toBe(logs);
  });
});
