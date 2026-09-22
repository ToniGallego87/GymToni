import {
  challengeProgressLabel,
  computeChallenges,
  daysLeftInWeek,
} from '../challenges';
import { ParsedSet, WorkoutDay, WorkoutLog, WorkoutRoutine } from '../../types';

// Semana natural fija: lunes 2026-09-14 … domingo 2026-09-20.
const TODAY = '2026-09-18'; // viernes

function ts(date: string): number {
  return new Date(`${date}T10:00:00`).valueOf();
}

function makeLog(
  id: string,
  dayNumber: number,
  date: string,
  sets: ParsedSet[] = [{ weight: 60, reps: 8 }],
  extra: Partial<WorkoutLog> = {}
): WorkoutLog {
  const createdAt = ts(date);
  return {
    id,
    routineId: 'r1',
    dayId: `d${dayNumber}`,
    date,
    exercises: [
      {
        id: `${id}-ex`,
        exerciseId: `e${dayNumber}`,
        exerciseName: 'Press banca',
        order: 1,
        rawInput: '',
        parsedSets: sets,
        timestamp: createdAt,
      },
    ],
    createdAt,
    updatedAt: createdAt,
    ...extra,
  };
}

// Cada día prevé UN ejercicio (`e{n}`, el mismo id que registran los logs),
// salvo que se pida otro número: los retos "+3 %" y "Récord" miden contra lo
// previsto por la rutina, no contra lo hecho.
function makeRoutine(dayCount: number, exercisesPerDay = 1): WorkoutRoutine {
  const days: WorkoutDay[] = Array.from({ length: dayCount }, (_, i) => ({
    id: `d${i + 1}`,
    dayNumber: i + 1,
    name: `Día ${i + 1}`,
    emoji: 'dumbbell',
    exercises: Array.from({ length: exercisesPerDay }, (_, j) => ({
      id: j === 0 ? `e${i + 1}` : `e${i + 1}-${j}`,
      name: 'Press banca',
      order: j + 1,
    })),
  }));
  return { id: 'r1', name: 'Rutina', isActive: true, days, createdAt: 0 };
}

const cardio = (id: string, date: string, rawInput: string): WorkoutLog =>
  makeLog(id, 1, date, [], {
    cardioOnly: true,
    exercises: [],
    cardio: { id: `c-${id}`, type: 'Correr', rawInput },
  });

function byId(logs: WorkoutLog[], routines: WorkoutRoutine[]) {
  const list = computeChallenges({
    logs,
    routines,
    activeRoutineId: 'r1',
    weight: 70,
    today: TODAY,
  });
  return Object.fromEntries(list.map((c) => [c.id, c]));
}

describe('computeChallenges', () => {
  it('sin logs: todo a cero y nada superado', () => {
    const c = byId([], [makeRoutine(3)]);
    expect(c['full-week'].current).toBe(0);
    expect(c['full-week'].target).toBe(3);
    expect(Object.values(c).every((x) => !x.done)).toBe(true);
  });

  it('semana completa: cuenta los días distintos del bloque en curso', () => {
    const logs = [
      makeLog('a', 1, '2026-09-14'),
      makeLog('b', 2, '2026-09-16'),
      makeLog('c', 1, '2026-09-18'), // repite día 1: abre bloque nuevo
    ];
    const c = byId(logs, [makeRoutine(2)]);
    expect(c['full-week'].current).toBe(1);
    expect(c['full-week'].done).toBe(false);
  });

  it('+3 % y récord personal salen del bloque anterior', () => {
    const logs = [
      makeLog('a', 1, '2026-09-07', [{ weight: 60, reps: 8 }]),
      makeLog('b', 1, '2026-09-14', [{ weight: 70, reps: 8 }]),
    ];
    const c = byId(logs, [makeRoutine(1)]);
    expect(c['improve-3'].current).toBe(1);
    expect(c['improve-3'].target).toBe(1);
    expect(c['improve-3'].done).toBe(true);
    expect(c['personal-record'].current).toBe(1);
    expect(c['personal-record'].done).toBe(true);
    expect(c['full-week'].done).toBe(true);
  });

  it('+3 % y récord piden la mitad o más de lo previsto por la rutina', () => {
    // Semana anterior: dos días. Esta semana: el día 1 mejora, el 2 empeora.
    const logs = [
      makeLog('a1', 1, '2026-09-07', [{ weight: 60, reps: 8 }]),
      makeLog('a2', 2, '2026-09-09', [{ weight: 60, reps: 8 }]),
      makeLog('b1', 1, '2026-09-14', [{ weight: 70, reps: 8 }]),
      makeLog('b2', 2, '2026-09-16', [{ weight: 50, reps: 8 }]),
    ];
    const c = byId(logs, [makeRoutine(2)]);
    // 1 de los 2 días de la rutina: la mitad, así que cuenta.
    expect(c['improve-3'].current).toBe(1);
    expect(c['improve-3'].target).toBe(1);
    expect(c['improve-3'].done).toBe(true);
    // 1 de los 2 ejercicios previstos (e1 sube, e2 baja): la mitad.
    expect(c['personal-record'].current).toBe(1);
    expect(c['personal-record'].target).toBe(1);
    expect(c['personal-record'].done).toBe(true);

    // El objetivo sale de la rutina, no de lo hecho: con 4 días previstos y
    // solo dos entrenados, hacen falta 2 días mejorados aunque se lleve 1 de 2.
    const c4 = byId(logs, [makeRoutine(4)]);
    expect(c4['improve-3'].current).toBe(1);
    expect(c4['improve-3'].target).toBe(2);
    expect(c4['improve-3'].done).toBe(false);
    // Y con 3 ejercicios por día (12 previstos) el récord pide 6.
    const c12 = byId(logs, [makeRoutine(4, 3)]);
    expect(c12['personal-record'].target).toBe(6);
    expect(c12['personal-record'].done).toBe(false);

    // Con tres días y solo uno mejorado no llega a la mitad.
    const three = [
      ...logs,
      makeLog('a3', 3, '2026-09-11', [{ weight: 60, reps: 8 }]),
      makeLog('b3', 3, '2026-09-18', [{ weight: 60, reps: 8 }]),
    ];
    const c3 = byId(three, [makeRoutine(3)]);
    expect(c3['improve-3'].current).toBe(1);
    expect(c3['improve-3'].target).toBe(2);
    expect(c3['improve-3'].done).toBe(false);
    expect(c3['personal-record'].target).toBe(2);
    expect(c3['personal-record'].done).toBe(false);
  });

  it('récord personal mide la sesión del ejercicio, no solo el peso', () => {
    // Mismo peso pero una repetición más: la sesión es mejor, cuenta.
    const moreReps = [
      makeLog('a', 1, '2026-09-07', [{ weight: 60, reps: 8 }]),
      makeLog('b', 1, '2026-09-14', [{ weight: 60, reps: 9 }]),
    ];
    expect(byId(moreReps, [makeRoutine(1)])['personal-record'].done).toBe(true);
    // Más peso pero muchas menos reps: la sesión no supera a la anterior.
    const heavierWorse = [
      makeLog('a', 1, '2026-09-07', [{ weight: 60, reps: 12 }]),
      makeLog('b', 1, '2026-09-14', [{ weight: 62, reps: 4 }]),
    ];
    expect(byId(heavierWorse, [makeRoutine(1)])['personal-record'].done).toBe(
      false
    );
  });

  it('primera semana: retos de estreno en lugar de +3 % y récord', () => {
    const routine = makeRoutine(2, 2); // e1, e1-1 / e2, e2-1
    const empty = byId([], [routine]);
    expect(empty['improve-3']).toBeUndefined();
    expect(empty['personal-record']).toBeUndefined();
    expect(empty['full-days'].target).toBe(1);
    expect(empty['first-marks'].target).toBe(4);

    // Día 1 con sus dos ejercicios; día 2 solo con uno (el otro a guiones).
    const day1 = makeLog('a', 1, '2026-09-14');
    day1.exercises.push({
      ...day1.exercises[0],
      id: 'a-ex2',
      exerciseId: 'e1-1',
    });
    const day2 = makeLog('b', 2, '2026-09-16');
    day2.exercises.push({
      ...day2.exercises[0],
      id: 'b-ex2',
      exerciseId: 'e2-1',
      parsedSets: [{ weight: -1, reps: -1 }],
    });
    const c = byId([day1, day2], [routine]);
    expect(c['full-days'].current).toBe(1);
    expect(c['full-days'].done).toBe(true);
    expect(c['first-marks'].current).toBe(3);
    expect(c['first-marks'].done).toBe(false);

    // Con histórico vuelven los retos de mejora.
    const later = byId(
      [...[day1, day2], makeLog('c', 1, '2026-09-21')],
      [routine]
    );
    expect(later['improve-3']).toBeDefined();
    expect(later['full-days']).toBeUndefined();
  });

  it('kcal de hoy y de la semana natural, y días con cardio', () => {
    const logs = [
      cardio('x', '2026-09-13', 'Correr: 60min, 10kmh'), // domingo anterior: fuera
      cardio('y', '2026-09-15', 'Correr: 30min, 10kmh'),
      cardio('z', TODAY, 'Correr: 30min, 10kmh'),
    ];
    const c = byId(logs, [makeRoutine(1)]);
    expect(c['kcal-day-100'].current).toBe(100);
    expect(c['kcal-day-100'].done).toBe(true);
    expect(c['two-cardio'].current).toBe(2);
    expect(c['two-cardio'].done).toBe(true);
    expect(c['kcal-week-1000'].current).toBeLessThan(1000);
    expect(c['kcal-week-1000'].periodKey).toBe('2026-W38');
  });

  it('el progreso se recorta al objetivo', () => {
    const logs = [
      cardio('a', TODAY, 'Correr: 90min, 12kmh'),
      cardio('b', '2026-09-14', 'Correr: 90min, 12kmh'),
    ];
    const c = byId(logs, [makeRoutine(1)]);
    expect(c['kcal-day-100'].current).toBe(100);
  });
});

describe('etiquetas', () => {
  it('días que quedan cuenta hoy', () => {
    expect(daysLeftInWeek('2026-09-14')).toBe(7);
    expect(daysLeftInWeek('2026-09-20')).toBe(1);
  });

  it('progreso legible y compacto', () => {
    const c = byId([], [makeRoutine(4)]);
    expect(challengeProgressLabel(c['full-week'])).toBe('0 / 4 días');
    expect(challengeProgressLabel(c['full-week'], true)).toBe('0/4');
    // Sin histórico salen los retos de estreno, no "+3 %" ni "Récord".
    expect(challengeProgressLabel(c['first-marks'])).toBe('0 / 4 ejercicios');
    expect(challengeProgressLabel(c['full-days'], true)).toBe('0/2');
  });
});
