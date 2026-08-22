import {
  buildWeekProgress,
  computeStreak,
  getWeekImprovement,
  groupLogsIntoWeekBlocks,
  isWeekCompleted,
  logsBeforeBlock,
  planWeekMove,
  weekMoveNeedsConfirm,
  workoutsUpToBlock,
  WeekMovePlan,
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

  it('un día que faltó la semana pasada se compara con la última vez que se hizo', () => {
    // d2 no se entrenó la semana pasada: su referencia es la de dos semanas
    // atrás, no un cero (que disparaba el % de la semana entera).
    const prior = [
      makeScoredLog('v2', 2, 0, [{ weight: 100, reps: 10 }]),
      makeScoredLog('v1', 1, 1, [{ weight: 100, reps: 10 }]),
      makeScoredLog('p1', 1, 7, [{ weight: 100, reps: 10 }]),
    ];
    const current = [
      makeScoredLog('c1', 1, 14, [{ weight: 110, reps: 10 }]),
      makeScoredLog('c2', 2, 15, [{ weight: 110, reps: 10 }]),
    ];

    const improvement = getWeekImprovement(current, prior, makeDays(2));
    expect(improvement?.isImproved).toBe(true);
    expect(improvement?.percent).toBeCloseTo(9.090909, 5);
  });

  it('un día estrenado esta semana queda fuera de la comparación', () => {
    const prior = [makeScoredLog('p1', 1, 0, [{ weight: 100, reps: 10 }])];
    const current = [
      makeScoredLog('c1', 1, 7, [{ weight: 110, reps: 10 }]),
      // Sin sesión previa: si contara, su puntuación entera pasaría por mejora.
      makeScoredLog('c2', 2, 8, [{ weight: 200, reps: 10 }]),
    ];

    const improvement = getWeekImprovement(current, prior, makeDays(2));
    expect(improvement?.percent).toBeCloseTo(9.090909, 5);
  });

  it('la referencia salta las sesiones de descarga', () => {
    const prior = [
      makeScoredLog('p1', 1, 0, [{ weight: 100, reps: 10 }]),
      { ...makeScoredLog('d1', 1, 7, [{ weight: 50, reps: 10 }]), isDeload: true },
    ];
    const current = [makeScoredLog('c1', 1, 14, [{ weight: 110, reps: 10 }])];

    const improvement = getWeekImprovement(current, prior, makeDays(1));
    expect(improvement?.percent).toBeCloseTo(9.090909, 5);
  });

  it('sin ninguna referencia previa no hay porcentaje', () => {
    const current = [makeScoredLog('c1', 1, 7, [{ weight: 110, reps: 10 }])];
    expect(getWeekImprovement(current, [], makeDays(1))).toBeNull();
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

  it('cada día se compara con su propia base, aunque debutara más tarde', () => {
    // La semana 1 solo tiene el día 1: el día 2 debuta en la semana 2 y su base
    // es él mismo (0%), no un cero que dispararía el % de la semana.
    const logs = [
      makeScoredLog('a', 1, 0, [{ weight: 100, reps: 10 }]),
      makeScoredLog('c', 1, 7, [{ weight: 110, reps: 10 }]),
      makeScoredLog('d', 2, 8, [{ weight: 100, reps: 10 }]),
    ];

    const points = buildWeekProgress(logs, 'r1', days);
    expect(points).toHaveLength(2);
    expect(points[0].improvement).toBe(0);
    // (120+110)/(110+110) − 1 = 4,5454%: solo sube lo que subió el día 1.
    expect(points[1].improvement).toBeCloseTo(4.5, 1);
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

describe('planWeekMove', () => {
  const key = (log: WorkoutLog) => log.dayId;
  // Bloques resultantes tras aplicar los cambios de un plan a los logs.
  const blocksAfter = (logs: WorkoutLog[], changed: WorkoutLog[]) => {
    const merged = logs.map(
      (log) => changed.find((c) => c.id === log.id) ?? log
    );
    const grouped = groupLogsIntoWeekBlocks(merged, key);
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map((b) => grouped[b].map((l) => l.id));
  };

  it('mueve el último día a la semana siguiente si esa no tiene ese día', () => {
    // Semana 1: d1,d2,d3 · Semana 2: d1,d2 (sin d3).
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 3, 2),
      makeLog('d', 1, 3),
      makeLog('e', 2, 4),
    ];
    const plan = planWeekMove(logs, 'c', 'next', key);
    expect(plan).not.toBeNull();
    expect(plan!.createsNewWeek).toBe(false);
    expect(blocksAfter(logs, plan!.changedLogs)).toEqual([
      ['a', 'b'],
      ['c', 'd', 'e'],
    ]);
  });

  it('no mueve el último día si la semana siguiente ya tiene ese día', () => {
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 3, 2),
      makeLog('d', 1, 3),
      makeLog('e', 2, 4),
      makeLog('f', 3, 5),
    ];
    expect(planWeekMove(logs, 'c', 'next', key)).toBeNull();
  });

  it('mover el último día sin semana siguiente crea una semana nueva', () => {
    const logs = [makeLog('a', 1, 0), makeLog('b', 2, 1), makeLog('c', 3, 2)];
    const plan = planWeekMove(logs, 'c', 'next', key);
    expect(plan).not.toBeNull();
    expect(plan!.createsNewWeek).toBe(true);
    expect(blocksAfter(logs, plan!.changedLogs)).toEqual([['a', 'b'], ['c']]);
  });

  it('no mueve adelante el único día de la última semana (sería un no-op)', () => {
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 1, 2), // semana 2 de un solo día (repite d1)
    ];
    expect(planWeekMove(logs, 'c', 'next', key)).toBeNull();
  });

  it('mover adelante cruzando una frontera manual la reubica en el día movido', () => {
    // Semana 1: d1 · Semana 2 (forzada): d3,d1.
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 3, 2, true),
      makeLog('d', 1, 3),
    ];
    const plan = planWeekMove(logs, 'b', 'next', key);
    expect(plan).not.toBeNull();
    // 'b' (último de semana 1) se lleva la frontera; 'c' deja de forzarla.
    expect(blocksAfter(logs, plan!.changedLogs)).toEqual([
      ['a'],
      ['b', 'c', 'd'],
    ]);
  });

  it('mueve el primer día a la semana anterior si esa no tiene ese día', () => {
    // Semana 1: d2,d3 · Semana 2 (forzada): d1,d2,d3.
    const logs = [
      makeLog('a', 2, 0),
      makeLog('b', 3, 1),
      makeLog('c', 1, 2, true),
      makeLog('d', 2, 3),
      makeLog('e', 3, 4),
    ];
    const plan = planWeekMove(logs, 'c', 'prev', key);
    expect(plan).not.toBeNull();
    expect(plan!.removesSourceWeek).toBe(false);
    expect(blocksAfter(logs, plan!.changedLogs)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
  });

  it('no mueve el primer día si la semana anterior ya tiene ese día', () => {
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 1, 2, true),
      makeLog('d', 2, 3),
    ];
    expect(planWeekMove(logs, 'c', 'prev', key)).toBeNull();
  });

  it('el primer día de la primera semana no puede ir atrás', () => {
    const logs = [makeLog('a', 1, 0), makeLog('b', 2, 1), makeLog('c', 3, 2)];
    expect(planWeekMove(logs, 'a', 'prev', key)).toBeNull();
  });

  it('mover atrás el único día de una semana la elimina', () => {
    // Semana 1: d1,d2 · Semana 2 (forzada): un solo día d3.
    const logs = [
      makeLog('a', 1, 0),
      makeLog('b', 2, 1),
      makeLog('c', 3, 2, true),
    ];
    const plan = planWeekMove(logs, 'c', 'prev', key);
    expect(plan).not.toBeNull();
    expect(plan!.removesSourceWeek).toBe(true);
    expect(blocksAfter(logs, plan!.changedLogs)).toEqual([['a', 'b', 'c']]);
  });

  it('un día intermedio no se puede mover en ninguna dirección', () => {
    const logs = [makeLog('a', 1, 0), makeLog('b', 2, 1), makeLog('c', 3, 2)];
    expect(planWeekMove(logs, 'b', 'next', key)).toBeNull();
    expect(planWeekMove(logs, 'b', 'prev', key)).toBeNull();
  });
});

describe('weekMoveNeedsConfirm', () => {
  const plan = (removesSourceWeek: boolean): WeekMovePlan => ({
    changedLogs: [],
    createsNewWeek: false,
    removesSourceWeek,
  });

  it('pide confirmar si el movimiento vacía la semana de origen', () => {
    expect(
      weekMoveNeedsConfirm({
        plan: plan(true),
        sourceBlock: 2,
        direction: 'prev',
        isBlockCompleted: () => false,
      })
    ).toBe(true);
  });

  it('pide confirmar si toca una semana ya completada (origen o destino)', () => {
    // 'next' desde el bloque 2 → destino 3, que está completado.
    expect(
      weekMoveNeedsConfirm({
        plan: plan(false),
        sourceBlock: 2,
        direction: 'next',
        isBlockCompleted: (b) => b === 3,
      })
    ).toBe(true);
    // 'prev' desde el bloque 2: el propio origen (2) está completado.
    expect(
      weekMoveNeedsConfirm({
        plan: plan(false),
        sourceBlock: 2,
        direction: 'prev',
        isBlockCompleted: (b) => b === 2,
      })
    ).toBe(true);
  });

  it('no pide confirmar en semanas incompletas que no se vacían', () => {
    expect(
      weekMoveNeedsConfirm({
        plan: plan(false),
        sourceBlock: 2,
        direction: 'next',
        isBlockCompleted: () => false,
      })
    ).toBe(false);
  });
});
