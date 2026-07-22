import {
  buildWeekProgress,
  computeStreak,
  getWeekImprovement,
  groupLogsIntoWeekBlocks,
  isWeekCompleted,
  logsBeforeBlock,
  workoutsUpToBlock,
} from '../weeks';
import { ParsedSet, WorkoutDay, WorkoutLog } from '../../types';

function makeLog(
  id: string,
  dayNumber: number,
  daysFromBase: number,
  startsNewWeek?: boolean
): WorkoutLog {
  const createdAt = 1_700_000_000_000 + daysFromBase * 24 * 3600 * 1000;
  return {
    id,
    routineId: 'r1',
    dayId: `d${dayNumber}`,
    date: new Date(createdAt).toISOString().slice(0, 10),
    exercises: [],
    createdAt,
    updatedAt: createdAt,
    ...(startsNewWeek ? { startsNewWeek: true } : {}),
  };
}

/** Log con una serie: sirve para que la semana puntúe (peso x reps). */
function makeScoredLog(
  id: string,
  dayNumber: number,
  daysFromBase: number,
  sets: ParsedSet[]
): WorkoutLog {
  const log = makeLog(id, dayNumber, daysFromBase);
  return {
    ...log,
    exercises: [
      {
        id: `${id}-ex`,
        exerciseId: `e${dayNumber}`,
        exerciseName: 'Press banca',
        order: 1,
        rawInput: '',
        parsedSets: sets,
        timestamp: log.createdAt,
      },
    ],
  };
}

function makeDays(count: number): WorkoutDay[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `d${index + 1}`,
    dayNumber: index + 1,
    name: `Día ${index + 1}`,
    emoji: 'dumbbell',
    exercises: [],
  }));
}

// El número de día se resuelve por el dayId ("d3" -> 3).
const dayNumberOf = (log: WorkoutLog) => Number(log.dayId.replace('d', ''));

describe('groupLogsIntoWeekBlocks', () => {
  it('cierra bloque al repetir un día ya entrenado', () => {
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 1, 7), // repite día 1 -> nueva semana
    ];
    const blocks = groupLogsIntoWeekBlocks(logs, dayNumberOf);
    expect(Object.keys(blocks)).toEqual(['1', '2']);
    expect(blocks[1].map((l) => l.id)).toEqual(['a', 'b']);
    expect(blocks[2].map((l) => l.id)).toEqual(['c']);
  });

  it('startsNewWeek fuerza una nueva semana aunque el día no se repita', () => {
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 3, 2, true), // fuerza nueva semana con un día nuevo
      makeLog('d', 4, 3),
    ];
    const blocks = groupLogsIntoWeekBlocks(logs, dayNumberOf);
    expect(Object.keys(blocks)).toEqual(['1', '2']);
    expect(blocks[1].map((l) => l.id)).toEqual(['a', 'b']);
    expect(blocks[2].map((l) => l.id)).toEqual(['c', 'd']);
  });

  it('startsNewWeek en el primer log no crea un bloque vacío', () => {
    const logs = [makeLog('a', 1, 0, true), makeLog('b', 2, 1)];
    const blocks = groupLogsIntoWeekBlocks(logs, dayNumberOf);
    expect(Object.keys(blocks)).toEqual(['1']);
    expect(blocks[1].map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('agrupa igual usando el dayId como clave del día', () => {
    const logs = [makeLog('a', 1, 0), makeLog('b', 2, 1), makeLog('c', 1, 7)];
    const blocks = groupLogsIntoWeekBlocks(logs, (log) => log.dayId);
    expect(blocks[1].map((l) => l.id)).toEqual(['a', 'b']);
    expect(blocks[2].map((l) => l.id)).toEqual(['c']);
  });
});

describe('isWeekCompleted', () => {
  const days = makeDays(2);

  it('está completa con todos los días de la rutina entrenados', () => {
    expect(
      isWeekCompleted([makeLog('a', 1, 0), makeLog('b', 2, 1)], days)
    ).toBe(true);
  });

  it('no está completa si falta algún día', () => {
    expect(isWeekCompleted([makeLog('a', 1, 0)], days)).toBe(false);
  });

  it('sin días o sin logs no está completa', () => {
    expect(isWeekCompleted([], days)).toBe(false);
    expect(isWeekCompleted([makeLog('a', 1, 0)], [])).toBe(false);
  });
});

describe('computeStreak', () => {
  const days = makeDays(2);

  it('cuenta las semanas completas consecutivas y sus días', () => {
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 1, 7),
      makeLog('d', 2, 8),
    ];
    const blocks = groupLogsIntoWeekBlocks(logs, dayNumberOf);

    expect(computeStreak(blocks, days)).toEqual({
      weeks: 2,
      days: 4,
      isPerfect: true,
    });
  });

  it('la semana en curso (incompleta) no rompe la racha ni suma', () => {
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 1, 7), // semana 2 en curso: solo un día
    ];
    const blocks = groupLogsIntoWeekBlocks(logs, dayNumberOf);

    expect(computeStreak(blocks, days)).toMatchObject({ weeks: 1, days: 2 });
  });

  it('una semana pasada incompleta corta la racha y deja de ser perfecta', () => {
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 1, 7), // semana 2: incompleta y ya cerrada
      makeLog('d', 1, 14),
      makeLog('e', 2, 15),
    ];
    const blocks = groupLogsIntoWeekBlocks(logs, dayNumberOf);

    expect(computeStreak(blocks, days)).toEqual({
      weeks: 1,
      days: 2,
      isPerfect: false,
    });
  });

  it('se puede reconstruir la racha tal como estaba en una semana pasada', () => {
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 1, 7),
      makeLog('d', 2, 8),
    ];
    const blocks = groupLogsIntoWeekBlocks(logs, dayNumberOf);

    expect(computeStreak(blocks, days, 1)).toEqual({
      weeks: 1,
      days: 2,
      isPerfect: true,
    });
  });
});

describe('logsBeforeBlock / workoutsUpToBlock', () => {
  const blocks = groupLogsIntoWeekBlocks(
    [makeLog('a', 1, 0), makeLog('b', 2, 1), makeLog('c', 1, 7)],
    dayNumberOf
  );

  it('logsBeforeBlock devuelve solo el histórico previo', () => {
    expect(logsBeforeBlock(blocks, 2).map((l) => l.id)).toEqual(['a', 'b']);
    expect(logsBeforeBlock(blocks, 1)).toEqual([]);
  });

  it('workoutsUpToBlock cuenta los días distintos acumulados', () => {
    expect(workoutsUpToBlock(blocks, 1)).toBe(2);
    expect(workoutsUpToBlock(blocks, 2)).toBe(3);
  });
});

describe('getWeekImprovement', () => {
  const days = makeDays(1);

  it('compara solo los días entrenados esta semana', () => {
    const current = [makeScoredLog('b', 1, 7, [{ weight: 110, reps: 10 }])];
    const previous = [makeScoredLog('a', 1, 0, [{ weight: 100, reps: 10 }])];

    const improvement = getWeekImprovement(current, previous, days);
    expect(improvement?.isImproved).toBe(true);
    // Epley sobre la carga virtual (peso + BODYWEIGHT_VIRTUAL_LOAD=10): 100→110kg
    // ×10 reps da (120·4/3)/(110·4/3) − 1 = 9,0909%, no el 10% de la fórmula
    // previa (peso a pelo). Ver progress.ts y UPDATES 0.6.3.
    expect(improvement?.percent).toBeCloseTo(9.090909, 5);
  });

  it('sin días entrenados no hay nada que comparar', () => {
    expect(getWeekImprovement([], [makeLog('a', 1, 0)], days)).toBeNull();
    expect(getWeekImprovement([makeLog('a', 1, 0)], [], [])).toBeNull();
  });
});

describe('buildWeekProgress', () => {
  const days = makeDays(2);

  it('sin rutina o sin logs devuelve una serie vacía', () => {
    expect(buildWeekProgress([], undefined, days)).toEqual([]);
    expect(buildWeekProgress([], 'r1', days)).toEqual([]);
  });

  it('la primera semana es la base (0%) y las siguientes la comparan', () => {
    const logs = [
      makeScoredLog('a', 1, 0, [{ weight: 100, reps: 10 }]),
      makeScoredLog('b', 2, 1, [{ weight: 100, reps: 10 }]),
      makeScoredLog('c', 1, 7, [{ weight: 110, reps: 10 }]),
      makeScoredLog('d', 2, 8, [{ weight: 110, reps: 10 }]),
    ];

    const points = buildWeekProgress(logs, 'r1', days);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ week: 1, improvement: 0 });
    expect(points[1].week).toBe(2);
    // 9,0909% con la carga virtual de progress.ts (ver test de getWeekImprovement).
    expect(points[1].improvement).toBeCloseTo(9.1, 1);
  });

  it('marca en curso la última semana solo si le faltan días', () => {
    const complete = [
      makeScoredLog('a', 1, 0, [{ weight: 100, reps: 10 }]),
      makeScoredLog('b', 2, 1, [{ weight: 100, reps: 10 }]),
    ];
    expect(
      buildWeekProgress(complete, 'r1', days)[0].isCurrent
    ).toBeUndefined();

    const inProgress = [complete[0]];
    expect(buildWeekProgress(inProgress, 'r1', days)[0].isCurrent).toBe(true);
  });

  it('marca las semanas a las que les faltan días', () => {
    const logs = [
      makeScoredLog('a', 1, 0, [{ weight: 100, reps: 10 }]),
      makeScoredLog('b', 2, 1, [{ weight: 100, reps: 10 }]),
      makeScoredLog('c', 1, 7, [{ weight: 110, reps: 10 }]),
      makeScoredLog('d', 2, 8, [{ weight: 110, reps: 10 }]),
      makeScoredLog('e', 1, 14, [{ weight: 120, reps: 10 }]),
    ];

    const points = buildWeekProgress(logs, 'r1', days);
    expect(points.map((point) => point.isIncomplete)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('las sesiones de solo cardio no cuentan como fuerza', () => {
    const logs: WorkoutLog[] = [
      makeScoredLog('a', 1, 0, [{ weight: 100, reps: 10 }]),
      { ...makeLog('cardio', 2, 1), cardioOnly: true },
    ];

    const points = buildWeekProgress(logs, 'r1', days);
    expect(points).toHaveLength(1);
  });

  it('con filtro por día, las semanas sin ese día no puntúan', () => {
    const logs = [
      makeScoredLog('a', 1, 0, [{ weight: 100, reps: 10 }]),
      makeScoredLog('b', 2, 1, [{ weight: 100, reps: 10 }]),
      makeScoredLog('c', 2, 7, [{ weight: 200, reps: 10 }]), // semana 2 sin el día 1
    ];

    const points = buildWeekProgress(logs, 'r1', days, 'd1');
    expect(points[1]).toMatchObject({
      week: 2,
      improvement: 0,
      isIncomplete: true,
    });
  });
});
