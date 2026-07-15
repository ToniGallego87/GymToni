import { groupLogsIntoWeekBlocks } from '../weeks';
import { WorkoutLog } from '../../types';

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
});
