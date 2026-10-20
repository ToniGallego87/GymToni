import { computeWeekExtras } from '../weekExtras';
import { Badge } from '../badges';
import { levelForXp, totalXp } from '../level';
import { WorkoutLog } from '../../types';

const log = (id: string, dayId: string, date: string): WorkoutLog => ({
  id,
  routineId: 'r1',
  dayId,
  date,
  exercises: [],
  createdAt: new Date(`${date}T10:00:00`).valueOf(),
  updatedAt: 0,
});

const badge = (id: string, unlockedAt?: string): Badge =>
  ({
    id,
    category: 'strength',
    icon: 'trophy',
    name: id,
    description: '',
    current: 1,
    target: 1,
    unlocked: !!unlockedAt,
    unlockedAt,
  }) as Badge;

describe('computeWeekExtras', () => {
  // Semana 1: 5 y 6 de oct; semana 2: 8 y 9 de oct (el día 1 se repite).
  const logs = [
    log('a', 'd1', '2026-10-05'),
    log('b', 'd2', '2026-10-06'),
    log('c', 'd1', '2026-10-08'),
    log('d', 'd2', '2026-10-09'),
  ];

  it('retos y logros de la semana, y el nivel con que se cerró', () => {
    const extras = computeWeekExtras({
      routineId: 'r1',
      block: 1,
      weekLogs: logs.slice(0, 2),
      logs,
      wins: ['full-week@r1:1', 'full-week@r1:2', 'two-cardio@2026-W41'],
      badges: [
        badge('first-workout', '2026-10-05'),
        badge('workouts-10', '2026-10-09'),
        badge('workouts-50'),
      ],
    });
    // La semana 2 de la rutina aún no había pasado; el cardio es de la misma
    // semana ISO.
    expect(extras.challenges.map((c) => c.id)).toEqual([
      'full-week',
      'two-cardio',
    ]);
    expect(extras.badges.map((b) => b.id)).toEqual(['first-workout']);
    expect(extras.level).toBe(levelForXp(totalXp(2, 1)));
  });

  it('un reto de un bloque que ya no existe se data en el último', () => {
    // `r1:5` se apuntó cuando había más bloques (un día repetido que luego se
    // borró): se ganó como muy tarde en el último bloque, el 2. Un cardio
    // posterior hace que no sea la semana más reciente.
    const extras = computeWeekExtras({
      routineId: 'r1',
      block: 2,
      weekLogs: logs.slice(2),
      logs: [...logs, { ...log('e', 'd1', '2026-10-12'), cardioOnly: true }],
      wins: ['full-week@r1:1', 'improve-3@r1:5'],
      badges: [],
    });
    expect(extras.level).toBe(levelForXp(totalXp(2, 0)));
  });

  it('la semana más reciente lleva el nivel de ahora', () => {
    // Retos sin fecha posible (rutina sin entrenos) y logros sin fecha: todo lo
    // ganado ya había pasado, así que el nivel es el de la cuenta.
    const wins = Array.from({ length: 30 }, (_, i) => `full-week@gone:${i}`);
    const badges = [badge('a', '2026-10-05'), badge('b', '2026-10-09')];
    const extras = computeWeekExtras({
      routineId: 'r1',
      block: 2,
      weekLogs: logs.slice(2),
      logs,
      wins,
      badges,
    });
    expect(extras.level).toBe(levelForXp(totalXp(30, 2)));
  });
});
