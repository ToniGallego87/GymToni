import { buildLocalActivity, groupActivityByMonth } from '../activity';
import { WorkoutLog } from '../../types';

const log = (
  id: string,
  date: string,
  weights: Record<string, number>,
  extra: Partial<WorkoutLog> = {}
): WorkoutLog => {
  const ts = new Date(`${date}T10:00:00`).getTime();
  return {
    id,
    routineId: 'r',
    dayId: 'd',
    date,
    createdAt: ts,
    updatedAt: ts,
    exercises: Object.entries(weights).map(([name, weight], i) => ({
      id: `${id}-${i}`,
      exerciseId: `e${i}`,
      exerciseName: name,
      order: i,
      rawInput: `${weight}x8`,
      parsedSets: [{ weight, reps: 8 }],
      timestamp: ts,
    })),
    ...extra,
  };
};

const records = (logs: WorkoutLog[]) =>
  buildLocalActivity({ logs, routines: [], badges: [], challenges: [], wins: [] })
    .filter((item) => item.kind === 'record');

describe('récords de la Actividad', () => {
  it('la primera vez no es récord; más peso que nunca sí', () => {
    const result = records([
      log('a', '2026-09-01', { Banca: 80 }),
      log('b', '2026-09-08', { Banca: 80 }),
      log('c', '2026-09-15', { Banca: 82.5 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'Banca',
      happenedOn: '2026-09-15',
    });
    expect(result[0].detail).toMatch(/82[.,]5 kg/);
  });

  it('una descarga sube el listón pero no sale como hito', () => {
    const result = records([
      log('a', '2026-09-01', { Banca: 80 }),
      log('b', '2026-09-08', { Banca: 85 }, { isDeload: true }),
      log('c', '2026-09-15', { Banca: 82.5 }),
    ]);
    expect(result).toHaveLength(0);
  });
});

describe('groupActivityByMonth', () => {
  it('agrupa por mes conservando el orden', () => {
    const items = buildLocalActivity({
      logs: [
        log('a', '2026-08-30', { Banca: 80 }),
        log('b', '2026-09-02', { Banca: 80 }),
        log('c', '2026-09-20', { Banca: 80 }),
      ],
      routines: [],
      badges: [],
      challenges: [],
      wins: [],
    });
    const months = groupActivityByMonth(items);
    expect(months.map((m) => m.month)).toEqual(['2026-09', '2026-08']);
    expect(months[0].items.map((i) => i.ref)).toEqual(['c', 'b']);
  });
});
