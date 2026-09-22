import { computeBadges, computeBadgeStats } from '../badges';
import { ParsedSet, WorkoutDay, WorkoutLog, WorkoutRoutine } from '../../types';

const DAY = 24 * 3600 * 1000;

function makeLog(
  id: string,
  dayNumber: number,
  daysFromBase: number,
  sets: ParsedSet[] = [{ weight: 60, reps: 8 }],
  extra: Partial<WorkoutLog> = {}
): WorkoutLog {
  const createdAt = 1_700_000_000_000 + daysFromBase * DAY;
  return {
    id,
    routineId: 'r1',
    dayId: `d${dayNumber}`,
    date: new Date(createdAt).toISOString().slice(0, 10),
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

function makeRoutine(dayCount: number): WorkoutRoutine {
  const days: WorkoutDay[] = Array.from({ length: dayCount }, (_, i) => ({
    id: `d${i + 1}`,
    dayNumber: i + 1,
    name: `Día ${i + 1}`,
    emoji: 'dumbbell',
    exercises: [],
  }));
  return { id: 'r1', name: 'Rutina', isActive: true, days, createdAt: 0 };
}

describe('computeBadgeStats', () => {
  it('sin logs todo a cero', () => {
    expect(computeBadgeStats([], [makeRoutine(2)])).toEqual({
      workouts: 0,
      cardioSessions: 0,
      fullWeeks: 0,
      bestStreak: 0,
      improvedWeeks: 0,
    });
  });

  it('las sesiones solo cardio no cuentan como entreno pero sí como cardio', () => {
    const logs = [
      makeLog('a', 1, 0),
      makeLog('c', 1, 1, [], {
        cardioOnly: true,
        cardio: { id: 'c1', type: 'run', rawInput: '30min 5km' },
      }),
    ];
    const s = computeBadgeStats(logs, [makeRoutine(2)]);
    expect(s.workouts).toBe(1);
    expect(s.cardioSessions).toBe(1);
  });

  it('cuenta semanas completas, la mejor racha y las semanas que mejoran', () => {
    const routine = makeRoutine(2);
    // Semana 1 completa (60x8), semana 2 completa y mejor (70x8), semana 3 a
    // medias (solo día 1).
    const logs = [
      makeLog('a1', 1, 0),
      makeLog('a2', 2, 1),
      makeLog('b1', 1, 7, [{ weight: 70, reps: 8 }]),
      makeLog('b2', 2, 8, [{ weight: 70, reps: 8 }]),
      makeLog('c1', 1, 14, [{ weight: 70, reps: 8 }]),
    ];
    const s = computeBadgeStats(logs, [routine]);
    expect(s.workouts).toBe(5);
    expect(s.fullWeeks).toBe(2);
    expect(s.bestStreak).toBe(2);
    expect(s.improvedWeeks).toBe(1);
  });
});

describe('computeBadges', () => {
  it('desbloquea por umbral y recorta el progreso al objetivo', () => {
    const logs = Array.from({ length: 12 }, (_, i) =>
      makeLog(`l${i}`, (i % 2) + 1, i)
    );
    const badges = computeBadges(logs, [makeRoutine(2)]);
    const byId = Object.fromEntries(badges.map((b) => [b.id, b]));
    expect(byId['first-workout'].unlocked).toBe(true);
    expect(byId['first-workout'].current).toBe(1);
    expect(byId['workouts-10'].unlocked).toBe(true);
    expect(byId['workouts-50']).toMatchObject({
      unlocked: false,
      current: 12,
      target: 50,
    });
    expect(byId['first-cardio'].unlocked).toBe(false);
    expect(byId['cardio-10']).toMatchObject({ current: 0, target: 10 });
    expect(byId['workouts-500']).toMatchObject({ current: 12, target: 500 });
  });

  it('la escalera de Progreso cuenta semanas mejoradas, no récords de peso', () => {
    const routine = makeRoutine(1);
    // Cinco semanas seguidas, cada una con más peso que la anterior: cuatro
    // mejoradas (la primera no tiene con qué compararse).
    const logs = Array.from({ length: 5 }, (_, i) =>
      makeLog(`w${i}`, 1, i * 7, [{ weight: 60 + i * 5, reps: 8 }])
    );
    const byId = Object.fromEntries(
      computeBadges(logs, [routine]).map((b) => [b.id, b])
    );
    expect(byId['improved-1'].unlocked).toBe(true);
    expect(byId['improved-1'].unlockedAt).toBe(logs[1].date);
    expect(byId['improved-5']).toMatchObject({
      unlocked: false,
      current: 4,
      target: 5,
    });
    expect(byId['improved-20']).toMatchObject({ current: 4, target: 20 });
    expect(byId['streak-4'].unlocked).toBe(true);
    expect(byId['streak-8']).toMatchObject({ current: 5, target: 8 });
  });

  it('fecha la consecución con el entreno que cruzó el objetivo', () => {
    const logs = Array.from({ length: 12 }, (_, i) =>
      makeLog(`l${i}`, (i % 2) + 1, i)
    );
    const badges = computeBadges(logs, [makeRoutine(2)]);
    const byId = Object.fromEntries(badges.map((b) => [b.id, b]));
    expect(byId['first-workout'].unlockedAt).toBe(logs[0].date);
    expect(byId['workouts-10'].unlockedAt).toBe(logs[9].date);
    // La primera semana completa se cierra con el segundo entreno.
    expect(byId['full-week'].unlockedAt).toBe(logs[1].date);
    expect(byId['workouts-50'].unlockedAt).toBeUndefined();
  });

  it('agrupa por tipo en el orden fuerza, cardio, semanas, progreso', () => {
    const cats = computeBadges([], []).map((b) => b.category);
    const firstIndex = (c: (typeof cats)[number]) => cats.indexOf(c);
    expect(firstIndex('strength')).toBeLessThan(firstIndex('cardio'));
    expect(firstIndex('cardio')).toBeLessThan(firstIndex('weeks'));
    expect(firstIndex('weeks')).toBeLessThan(firstIndex('progress'));
  });

  it('devuelve el catálogo entero aunque no haya nada', () => {
    const badges = computeBadges([], []);
    expect(badges).toHaveLength(16);
    expect(badges.every((b) => !b.unlocked && b.current === 0)).toBe(true);
  });
});
