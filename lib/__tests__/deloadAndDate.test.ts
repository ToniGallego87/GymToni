import {
  assignmentDuplicatesDayInWeek,
  assignmentOpensLoneWeek,
  dateAssignmentConflict,
  buildWeekProgress,
  isDeloadBlock,
} from '../weeks';
import { combineDateWithTime, weekdayDayMonth } from '../utils';
import { parseImportedExercise, buildWorkoutExercises } from '../exerciseForm';
import { ParsedSet, WorkoutDay, WorkoutLog } from '../../types';

function makeLog(
  id: string,
  dayNumber: number,
  daysFromBase: number,
  extra: Partial<WorkoutLog> = {}
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
    ...extra,
  };
}

function makeScoredLog(
  id: string,
  dayNumber: number,
  daysFromBase: number,
  sets: ParsedSet[],
  extra: Partial<WorkoutLog> = {}
): WorkoutLog {
  const base = makeLog(id, dayNumber, daysFromBase, extra);
  return {
    ...base,
    exercises: [
      {
        id: `${id}-ex`,
        exerciseId: `e${dayNumber}`,
        exerciseName: 'Press banca',
        order: 1,
        rawInput: '',
        parsedSets: sets,
        timestamp: base.createdAt,
      },
    ],
  };
}

const days = (n: number): WorkoutDay[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `d${i + 1}`,
    dayNumber: i + 1,
    name: `Día ${i + 1}`,
    emoji: 'dumbbell',
    exercises: [],
  }));

const dayNumberOf = (log: WorkoutLog) => Number(log.dayId.replace('d', ''));

describe('combineDateWithTime', () => {
  it('conserva la hora y cambia solo el día', () => {
    const base = new Date(2024, 4, 10, 18, 30, 15, 0).getTime();
    const moved = combineDateWithTime('2024-05-08', base);
    const d = new Date(moved);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(30);
  });
});

describe('isDeloadBlock', () => {
  it('marca el bloque si algún log lleva isDeload', () => {
    expect(isDeloadBlock([makeLog('a', 1, 0)])).toBe(false);
    expect(isDeloadBlock([makeLog('a', 1, 0, { isDeload: true })])).toBe(true);
  });
});

describe('buildWeekProgress con descarga', () => {
  it('la semana de descarga sale sin % y no sirve de base', () => {
    const logs = [
      makeScoredLog('a', 1, 0, [{ weight: 100, reps: 5 }]),
      // Semana 2: descarga con cargas bajas.
      makeScoredLog('b', 1, 7, [{ weight: 50, reps: 5 }], { isDeload: true }),
      // Semana 3: carga otra vez, mejora respecto a la semana 1 (base de carga).
      makeScoredLog('c', 1, 14, [{ weight: 110, reps: 5 }]),
    ];
    const points = buildWeekProgress(logs, 'r1', days(1));
    expect(points).toHaveLength(3);
    // Semana 2 marcada como descarga y con 0% (no compara).
    expect(points[1].isDeload).toBe(true);
    expect(points[1].improvement).toBe(0);
    // Semana 3 compara contra la 1 (base de carga), no contra la descarga.
    expect(points[2].isDeload).toBeUndefined();
    expect(points[2].improvement).toBeGreaterThan(0);
  });
});

describe('assignmentDuplicatesDayInWeek', () => {
  it('detecta el choque cuando la nueva fecha cae en una semana con el mismo día', () => {
    // Semana con día 1 y día 2. Movemos otro log de día 1 a esa fecha.
    const logs = [makeLog('a', 1, 0), makeLog('b', 2, 2)];
    const moved = makeLog('m', 1, 30); // día 1, en otra semana
    // Fecha dentro del tramo de la primera semana (día base +1).
    const ts = combineDateWithTime(
      new Date(1_700_000_000_000 + 1 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10),
      moved.createdAt
    );
    expect(assignmentDuplicatesDayInWeek(logs, moved, ts, dayNumberOf)).toBe(
      true
    );
  });

  it('no avisa si la fecha cae en un hueco entre semanas', () => {
    const logs = [makeLog('a', 1, 0), makeLog('b', 1, 30)];
    const moved = makeLog('m', 2, 60);
    const ts = combineDateWithTime(
      new Date(1_700_000_000_000 + 15 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10),
      moved.createdAt
    );
    expect(assignmentDuplicatesDayInWeek(logs, moved, ts, dayNumberOf)).toBe(
      false
    );
  });
});

describe('assignmentOpensLoneWeek', () => {
  const dayKeyAt = (days: number) =>
    new Date(1_700_000_000_000 + days * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
  // Semana A (días 0-2) y semana B (días 14-16), las dos completas.
  const twoFullWeeks = [
    makeLog('a1', 1, 0),
    makeLog('a2', 2, 1),
    makeLog('a3', 3, 2),
    makeLog('b1', 1, 14),
    makeLog('b2', 2, 15),
    makeLog('b3', 3, 16),
  ];

  it('avisa al meter un día entre dos semanas completas', () => {
    const moved = makeLog('new', 1, 0);
    const ts = combineDateWithTime(dayKeyAt(8), moved.createdAt);
    expect(
      assignmentOpensLoneWeek(twoFullWeeks, moved, ts, dayNumberOf, 3)
    ).toBe(true);
  });

  it('no avisa si el día completa la semana a la que le faltaba', () => {
    const logs = twoFullWeeks.filter((l) => l.id !== 'a3');
    const moved = makeLog('new', 3, 0);
    const ts = combineDateWithTime(dayKeyAt(3), moved.createdAt);
    expect(assignmentOpensLoneWeek(logs, moved, ts, dayNumberOf, 3)).toBe(
      false
    );
  });

  it('no avisa al abrir la semana en curso (no hay nada después)', () => {
    const moved = makeLog('new', 1, 0);
    const ts = combineDateWithTime(dayKeyAt(20), moved.createdAt);
    expect(
      assignmentOpensLoneWeek(twoFullWeeks, moved, ts, dayNumberOf, 3)
    ).toBe(false);
  });

  it('no avisa en una rutina de un solo día', () => {
    const logs = [makeLog('a', 1, 0), makeLog('b', 1, 14)];
    const moved = makeLog('new', 1, 0);
    const ts = combineDateWithTime(dayKeyAt(7), moved.createdAt);
    expect(assignmentOpensLoneWeek(logs, moved, ts, dayNumberOf, 1)).toBe(
      false
    );
  });
});

describe('round-trip del GIF asignado en texto', () => {
  it('conserva el catalogId al exportar e importar la línea', () => {
    const line = 'Press banca [4x6-8] {#0025}';
    const parsed = parseImportedExercise(line);
    expect(parsed.name).toBe('Press banca');
    expect(parsed.sets).toBe(4);
    expect(parsed.reps).toBe('6-8');
    expect(parsed.catalogId).toBe('0025');

    const built = buildWorkoutExercises([parsed]);
    expect(built[0].catalogId).toBe('0025');
  });

  it('sin etiqueta, no hay catalogId', () => {
    const parsed = parseImportedExercise('Sentadilla [5x5]');
    expect(parsed.catalogId).toBeUndefined();
  });
});

// Registro y Detalle dan el mismo aviso al cambiar la fecha.
describe('dateAssignmentConflict', () => {
  const dayKeyAt = (days: number) =>
    new Date(1_700_000_000_000 + days * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
  const twoFullWeeks = [
    makeLog('a1', 1, 0),
    makeLog('a2', 2, 1),
    makeLog('a3', 3, 2),
    makeLog('b1', 1, 14),
    makeLog('b2', 2, 15),
    makeLog('b3', 3, 16),
  ];

  it("'split' si la fecha cae en una semana que ya tiene ese día", () => {
    const moved = makeLog('new', 1, 0);
    const ts = combineDateWithTime(dayKeyAt(1), moved.createdAt);
    expect(
      dateAssignmentConflict(twoFullWeeks, moved, ts, dayNumberOf, 3)
    ).toBe('split');
  });

  it("'lone' si deja el entreno solo entre dos semanas", () => {
    const moved = makeLog('new', 1, 0);
    const ts = combineDateWithTime(dayKeyAt(8), moved.createdAt);
    expect(
      dateAssignmentConflict(twoFullWeeks, moved, ts, dayNumberOf, 3)
    ).toBe('lone');
  });

  it('null si la fecha no descoloca nada', () => {
    const moved = makeLog('new', 1, 0);
    const ts = combineDateWithTime(dayKeyAt(20), moved.createdAt);
    expect(
      dateAssignmentConflict(twoFullWeeks, moved, ts, dayNumberOf, 3)
    ).toBeNull();
  });

  it('el cardio suelto nunca abre "semana aparte"', () => {
    const moved = makeLog('new', 1, 0, { cardioOnly: true });
    const ts = combineDateWithTime(dayKeyAt(8), moved.createdAt);
    expect(
      dateAssignmentConflict(twoFullWeeks, moved, ts, dayNumberOf, 3)
    ).toBeNull();
  });
});

// Fecha de un entreno: una sola forma en toda la app, con año solo si no es
// el del año en curso.
describe('weekdayDayMonth', () => {
  it('sin año si es del año en curso', () => {
    expect(weekdayDayMonth('2026-10-09', 2026)).not.toMatch(/2026/);
  });
  it('con el año si es de otro', () => {
    expect(weekdayDayMonth('2025-10-09', 2026)).toMatch(/ 2025$/);
  });
});
