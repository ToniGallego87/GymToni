import { mergeSameDayCardio } from '../normalize';
import { CARDIO_ONLY_DAY_ID } from '../cardio';
import { WorkoutLog } from '../../types';

const makeLog = (
  id: string,
  date: string,
  rawInput: string,
  opts: { cardioOnly?: boolean } = {}
): WorkoutLog => ({
  id,
  routineId: 'r1',
  dayId: opts.cardioOnly ? CARDIO_ONLY_DAY_ID : 'd1',
  date,
  exercises: [],
  cardio: rawInput ? { id: `c-${id}`, type: 'Cardio', rawInput } : undefined,
  createdAt: new Date(`${date}T00:00:00`).valueOf(),
  updatedAt: 0,
  ...(opts.cardioOnly ? { cardioOnly: true } : {}),
});

describe('mergeSameDayCardio', () => {
  it('mete el cardio suelto dentro del día de fuerza de esa fecha', () => {
    const logs = mergeSameDayCardio([
      makeLog('fuerza', '2026-07-16', 'Andar en cinta: 20min, 6kmh, 5%'),
      makeLog('suelto', '2026-07-16', 'Correr: 10min, 12kmh', {
        cardioOnly: true,
      }),
    ]);
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('fuerza');
    expect(logs[0].cardio!.rawInput).toBe(
      'Andar en cinta: 20min, 6kmh, 5% | Correr: 10min, 12kmh'
    );
  });

  it('respeta el solo cardio de un día sin fuerza', () => {
    const logs = mergeSameDayCardio([
      makeLog('fuerza', '2026-07-16', 'Correr: 10min, 12kmh'),
      makeLog('suelto', '2026-07-15', 'Bici: 30min, 20kmh', {
        cardioOnly: true,
      }),
    ]);
    expect(logs).toHaveLength(2);
    expect(logs[1].cardio!.rawInput).toBe('Bici: 30min, 20kmh');
  });

  it('no toca dos días de fuerza distintos de la misma fecha', () => {
    const a = makeLog('a', '2026-07-16', 'Correr: 10min, 12kmh');
    const b = {
      ...makeLog('b', '2026-07-16', 'Bici: 20min, 20kmh'),
      dayId: 'd2',
    };
    expect(mergeSameDayCardio([a, b])).toEqual([a, b]);
  });

  it('es idempotente: sin sueltos que fusionar devuelve los mismos logs', () => {
    const logs = [makeLog('fuerza', '2026-07-16', 'Correr: 10min, 12kmh')];
    expect(mergeSameDayCardio(logs)).toBe(logs);
  });

  it('absorbe el día de fuerza que aún no tenía cardio', () => {
    const logs = mergeSameDayCardio([
      makeLog('fuerza', '2026-07-16', ''),
      makeLog('suelto', '2026-07-16', 'Bici: 30min, 20kmh', {
        cardioOnly: true,
      }),
    ]);
    expect(logs).toHaveLength(1);
    expect(logs[0].cardio!.rawInput).toBe('Bici: 30min, 20kmh');
  });
});
