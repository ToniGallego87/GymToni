import {
  buildExerciseSessions,
  exerciseKey,
  ExerciseSummary,
  getExerciseRecords,
  listExercises,
  sortExercises,
} from '../exerciseProgress';
import { ParsedSet, WorkoutLog } from '../../types';

interface ExerciseSeed {
  name: string;
  sets: ParsedSet[];
  id?: string;
}

function makeLog(
  id: string,
  daysFromBase: number,
  exercises: ExerciseSeed[]
): WorkoutLog {
  const createdAt = 1_700_000_000_000 + daysFromBase * 24 * 3600 * 1000;
  return {
    id,
    routineId: 'r1',
    dayId: 'd1',
    date: new Date(createdAt).toISOString().slice(0, 10),
    exercises: exercises.map((exercise, index) => ({
      id: `${id}-e${index}`,
      exerciseId: exercise.id ?? `${id}-x${index}`,
      exerciseName: exercise.name,
      order: index,
      rawInput: '',
      parsedSets: exercise.sets,
      timestamp: createdAt,
    })),
    createdAt,
    updatedAt: createdAt,
  };
}

describe('exerciseKey', () => {
  it('agrupa el mismo ejercicio escrito distinto', () => {
    expect(exerciseKey('  Press   Banca ')).toBe('press banca');
    expect(exerciseKey('press banca')).toBe(exerciseKey('Press Banca'));
  });
});

describe('buildExerciseSessions', () => {
  it('ordena de la sesión más antigua a la más reciente', () => {
    const logs = [
      makeLog('l2', 7, [
        { name: 'Press banca', sets: [{ weight: 62, reps: 8 }] },
      ]),
      makeLog('l1', 0, [
        { name: 'Press banca', sets: [{ weight: 60, reps: 8 }] },
      ]),
    ];

    const sessions = buildExerciseSessions(logs, 'press banca');

    expect(sessions.map((s) => s.logId)).toEqual(['l1', 'l2']);
  });

  it('calcula las métricas de la sesión a partir de sus series', () => {
    const logs = [
      makeLog('l1', 0, [
        {
          name: 'Press banca',
          sets: [
            { weight: 60, reps: 8 },
            { weight: 70, reps: 5 },
          ],
        },
      ]),
    ];

    const [session] = buildExerciseSessions(logs, 'press banca');

    // Epley: 70 × (1 + 5/30) = 81,67 gana a 60 × (1 + 8/30) = 76.
    expect(session.bestOneRepMax).toBeCloseTo(81.67, 1);
    expect(session.maxWeight).toBe(70);
    expect(session.bestSetReps).toBe(8);
    expect(session.volume).toBe(60 * 8 + 70 * 5);
    expect(session.totalReps).toBe(13);
  });

  it('cruza el historial entre rutinas distintas (mismo nombre, otro id)', () => {
    const logs = [
      makeLog('l1', 0, [
        {
          name: 'Press banca',
          sets: [{ weight: 60, reps: 8 }],
          id: 'rutina-a',
        },
      ]),
      makeLog('l2', 30, [
        {
          name: 'Press banca',
          sets: [{ weight: 70, reps: 8 }],
          id: 'rutina-b',
        },
      ]),
    ];

    expect(buildExerciseSessions(logs, 'press banca')).toHaveLength(2);
  });

  it('junta en una sesión el ejercicio repetido dentro del mismo log', () => {
    const logs = [
      makeLog('l1', 0, [
        { name: 'Press banca', sets: [{ weight: 60, reps: 8 }], id: 'x1' },
        { name: 'Press banca', sets: [{ weight: 65, reps: 6 }], id: 'x2' },
      ]),
    ];

    const sessions = buildExerciseSessions(logs, 'press banca');

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sets).toHaveLength(2);
    expect(sessions[0].maxWeight).toBe(65);
  });

  it('ignora las sesiones sin series válidas del ejercicio', () => {
    const logs = [
      makeLog('l1', 0, [{ name: 'Press banca', sets: [] }]),
      makeLog('l2', 1, [
        { name: 'Press banca', sets: [{ weight: 60, reps: 0 }] },
      ]),
      makeLog('l3', 2, [
        { name: 'Sentadilla', sets: [{ weight: 80, reps: 5 }] },
      ]),
    ];

    expect(buildExerciseSessions(logs, 'press banca')).toEqual([]);
  });
});

describe('listExercises', () => {
  it('lista del entrenado más recientemente al más antiguo', () => {
    const logs = [
      makeLog('l1', 0, [
        { name: 'Sentadilla', sets: [{ weight: 80, reps: 5 }] },
      ]),
      makeLog('l2', 5, [
        { name: 'Press banca', sets: [{ weight: 60, reps: 8 }] },
      ]),
    ];

    expect(listExercises(logs).map((e) => e.name)).toEqual([
      'Press banca',
      'Sentadilla',
    ]);
  });

  it('cuenta sesiones y acumula los mejores registros por nombre', () => {
    const logs = [
      makeLog('l1', 0, [
        { name: 'Press banca', sets: [{ weight: 60, reps: 8 }] },
      ]),
      makeLog('l2', 7, [
        { name: 'press BANCA', sets: [{ weight: 70, reps: 5 }] },
      ]),
    ];

    const [exercise] = listExercises(logs);

    expect(exercise.key).toBe('press banca');
    // El nombre mostrado es el de la última vez que se escribió.
    expect(exercise.name).toBe('press BANCA');
    expect(exercise.sessionCount).toBe(2);
    expect(exercise.maxWeight).toBe(70);
    expect(exercise.bestOneRepMax).toBeCloseTo(81.67, 1);
  });

  it('el ejercicio repetido en un mismo log cuenta como una sesión', () => {
    const logs = [
      makeLog('l1', 0, [
        { name: 'Press banca', sets: [{ weight: 60, reps: 8 }], id: 'x1' },
        { name: 'Press banca', sets: [{ weight: 65, reps: 6 }], id: 'x2' },
      ]),
    ];

    expect(listExercises(logs)[0].sessionCount).toBe(1);
  });

  it('deja fuera los ejercicios sin ninguna serie registrada', () => {
    const logs = [
      makeLog('l1', 0, [
        { name: 'Press banca', sets: [{ weight: 60, reps: 8 }] },
        { name: 'Aperturas', sets: [] },
      ]),
    ];

    expect(listExercises(logs).map((e) => e.name)).toEqual(['Press banca']);
  });
});

describe('sortExercises', () => {
  const make = (
    name: string,
    sessionCount: number,
    lastTimestamp: number,
    bestOneRepMax: number
  ): ExerciseSummary => ({
    key: exerciseKey(name),
    name,
    sessionCount,
    lastTimestamp,
    lastDate: new Date(lastTimestamp).toISOString().slice(0, 10),
    bestOneRepMax,
    maxWeight: bestOneRepMax,
  });

  const banca = make('Press banca', 5, 300, 90);
  const sentadilla = make('Sentadilla', 9, 100, 120);
  const curl = make('Curl bíceps', 5, 200, 40);
  const exercises = [banca, sentadilla, curl];

  it('ordena por más reciente', () => {
    expect(sortExercises(exercises, 'recent').map((e) => e.name)).toEqual([
      'Press banca',
      'Curl bíceps',
      'Sentadilla',
    ]);
  });

  it('ordena por nombre con acentos en su sitio', () => {
    expect(sortExercises(exercises, 'name').map((e) => e.name)).toEqual([
      'Curl bíceps',
      'Press banca',
      'Sentadilla',
    ]);
  });

  it('ordena por número de sesiones y desempata por el más reciente', () => {
    expect(sortExercises(exercises, 'sessions').map((e) => e.name)).toEqual([
      'Sentadilla',
      'Press banca',
      'Curl bíceps',
    ]);
  });

  it('ordena por mejor 1RM', () => {
    expect(sortExercises(exercises, 'best').map((e) => e.name)).toEqual([
      'Sentadilla',
      'Press banca',
      'Curl bíceps',
    ]);
  });

  it('no toca la lista original', () => {
    sortExercises(exercises, 'name');

    expect(exercises.map((e) => e.name)).toEqual([
      'Press banca',
      'Sentadilla',
      'Curl bíceps',
    ]);
  });
});

describe('getExerciseRecords', () => {
  const logs = [
    makeLog('l1', 0, [
      {
        name: 'Press banca',
        sets: [
          { weight: 60, reps: 8 },
          { weight: 60, reps: 8 },
        ],
      },
    ]),
    makeLog('l2', 7, [
      {
        name: 'Press banca',
        sets: [
          { weight: 80, reps: 3 },
          { weight: 50, reps: 15 },
        ],
      },
    ]),
  ];

  it('saca cada récord con la fecha en la que se logró', () => {
    const sessions = buildExerciseSessions(logs, 'press banca');
    const records = getExerciseRecords(sessions);

    // 80 × (1 + 3/30) = 88 es el mejor 1RM estimado.
    expect(records.oneRepMax).toMatchObject({ weight: 80, reps: 3 });
    expect(records.oneRepMax?.value).toBeCloseTo(88, 5);
    expect(records.oneRepMax?.date).toBe(sessions[1].date);
    expect(records.maxWeight).toMatchObject({ value: 80, reps: 3 });
    expect(records.maxReps).toMatchObject({ value: 15, weight: 50 });
    // Volumen por sesión: 960 en la primera, 990 en la segunda.
    expect(records.bestVolume).toMatchObject({ value: 990 });
  });

  it('ante un empate se queda con la primera vez que se consiguió', () => {
    const repeated = [
      makeLog('l1', 0, [
        { name: 'Press banca', sets: [{ weight: 60, reps: 8 }] },
      ]),
      makeLog('l2', 7, [
        { name: 'Press banca', sets: [{ weight: 60, reps: 8 }] },
      ]),
    ];
    const sessions = buildExerciseSessions(repeated, 'press banca');

    expect(getExerciseRecords(sessions).maxWeight?.date).toBe(sessions[0].date);
  });

  it('un ejercicio sin carga externa no tiene récord de peso', () => {
    const bodyweight = [
      makeLog('l1', 0, [
        { name: 'Dominadas', sets: [{ weight: 0, reps: 10 }] },
      ]),
    ];
    const records = getExerciseRecords(
      buildExerciseSessions(bodyweight, 'dominadas')
    );

    expect(records.maxWeight).toBeNull();
    expect(records.oneRepMax).toBeNull();
    expect(records.maxReps).toMatchObject({ value: 10 });
  });

  it('sin sesiones no hay récords', () => {
    expect(getExerciseRecords([])).toEqual({
      oneRepMax: null,
      maxWeight: null,
      maxReps: null,
      bestVolume: null,
    });
  });
});
