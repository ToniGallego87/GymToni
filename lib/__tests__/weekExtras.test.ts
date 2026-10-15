import { computeWeekExtras } from '../weekExtras';
import { Badge } from '../badges';
import { levelForXp, totalXp } from '../level';
import { WorkoutLog, WorkoutRoutine } from '../../types';

const routine = {
  id: 'r1',
  name: 'Rutina',
  isActive: true,
  createdAt: 0,
  days: [
    { id: 'd1', dayNumber: 1, name: 'A', emoji: '', exercises: [] },
    { id: 'd2', dayNumber: 2, name: 'B', emoji: '', exercises: [] },
  ],
} as WorkoutRoutine;

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
      routines: [routine],
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
});
