import {
  parseCardioEntries,
  cardioSessionFromLog,
  isoWeekKey,
  isoWeekRange,
  buildCardioDays,
  buildCardioWeeks,
  buildCardioMonths,
  mergeSessionEntries,
  formatMergedResults,
  estimateEntryKcal,
  topKcalDiscipline,
  weightForTimestamp,
} from '../cardio';
import { WorkoutLog } from '../../types';

const makeLog = (id: string, date: string, rawInput: string): WorkoutLog => ({
  id,
  routineId: 'r1',
  dayId: 'd1',
  date,
  exercises: [],
  cardio: { id: `c-${id}`, type: 'Cardio', rawInput },
  createdAt: new Date(`${date}T00:00:00`).valueOf(),
  updatedAt: 0,
});

describe('parseCardioEntries', () => {
  it('parsea varias entradas unidas por " | "', () => {
    const entries = parseCardioEntries('Cinta: 22min, 11.5kmh | Bici: 30min');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      type: 'Cinta',
      minutes: 22,
      speed: 11.5,
    });
    expect(entries[1]).toMatchObject({ type: 'Bici', minutes: 30 });
    expect(entries[1].speed).toBeNull();
  });

  it('ignora rpm/bpm como velocidad', () => {
    const [entry] = parseCardioEntries('Bici: 20min, 80rpm');
    expect(entry.speed).toBeNull();
  });

  it('devuelve vacío si no hay input', () => {
    expect(parseCardioEntries('')).toEqual([]);
  });
});

describe('cardioSessionFromLog', () => {
  it('agrega minutos y promedia velocidades de la sesión', () => {
    const session = cardioSessionFromLog(
      makeLog('l1', '2026-07-01', 'Cinta: 20min, 10kmh | Correr: 10min, 12kmh')
    );
    expect(session).not.toBeNull();
    expect(session!.totalMinutes).toBe(30);
    expect(session!.avgSpeed).toBe(11);
  });

  it('null cuando el log no tiene cardio', () => {
    const log = makeLog('l2', '2026-07-01', '');
    expect(cardioSessionFromLog(log)).toBeNull();
  });

  it('calcula la distancia total en km (velocidad × tiempo)', () => {
    const s = cardioSessionFromLog(
      makeLog('d', '2026-07-01', 'Cinta: 30min, 12kmh')
    );
    expect(s!.totalKm).toBeCloseTo(6); // 12 km/h × 0.5 h
  });
});

describe('isoWeekKey', () => {
  it('agrupa días de la misma semana ISO', () => {
    // 2026-06-29 (lunes) y 2026-07-05 (domingo) son la misma semana ISO.
    expect(isoWeekKey('2026-06-29')).toBe(isoWeekKey('2026-07-05'));
    // El lunes siguiente cambia de semana.
    expect(isoWeekKey('2026-07-06')).not.toBe(isoWeekKey('2026-07-05'));
  });
});

describe('buildCardioWeeks', () => {
  it('numera semanas y calcula mejora de velocidad media vs semana previa', () => {
    const logs = [
      makeLog('a', '2026-06-29', 'Cinta: 20min, 10kmh'),
      makeLog('b', '2026-07-06', 'Cinta: 20min, 11kmh'),
    ];
    const weeks = buildCardioWeeks(logs);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].weekNumber).toBe(1);
    expect(weeks[0].improvement).toBeNull();
    expect(weeks[0].avgSpeed).toBe(10);
    expect(weeks[1].weekNumber).toBe(2);
    expect(weeks[1].avgSpeed).toBe(11);
    expect(weeks[1].totalKcal).toBeGreaterThan(weeks[0].totalKcal);
    expect(weeks[1].improvement).toBeGreaterThan(0);
  });

  it('ignora logs sin cardio y devuelve vacío', () => {
    expect(buildCardioWeeks([makeLog('x', '2026-07-01', '')])).toEqual([]);
  });

  it('incluye el rango lunes-domingo de la semana', () => {
    const [week] = buildCardioWeeks([
      makeLog('a', '2026-07-01', 'Cinta: 20min, 10kmh'),
    ]);
    expect(week.weekStart).toBe('2026-06-29');
    expect(week.weekEnd).toBe('2026-07-05');
  });
});

describe('buildCardioDays', () => {
  it('junta en un día el cardio de varios logs de la misma fecha', () => {
    const days = buildCardioDays([
      makeLog('fuerza', '2026-07-01', 'Cinta: 20min, 10kmh'),
      makeLog('suelto', '2026-07-01', 'Bici: 30min, 20kmh'),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0].sessions).toHaveLength(2);
    expect(days[0].totalMinutes).toBe(50);
    expect(days[0].disciplines.map((d) => d.type)).toEqual(['Cinta', 'Bici']);
  });

  it('fusiona la misma disciplina repetida sumando y ampliando rangos', () => {
    const [day] = buildCardioDays([
      makeLog('a', '2026-07-01', 'Cinta: 20min, 10kmh, 2%'),
      makeLog('b', '2026-07-01', 'Cinta: 10min, 12kmh, 5%'),
    ]);
    expect(day.disciplines).toHaveLength(1);
    expect(day.disciplines[0]).toMatchObject({
      totalMinutes: 30,
      minSpeed: 10,
      maxSpeed: 12,
      minPendiente: 2,
      maxPendiente: 5,
    });
  });

  it('la cuesta es otra disciplina: no fusiona andar llano con andar en cuesta', () => {
    const [day] = buildCardioDays([
      makeLog(
        'a',
        '2026-07-16',
        'Andar en cinta: 20min, 6kmh | Andar en cinta: 15min, 6kmh, 5%'
      ),
    ]);
    expect(day.disciplines).toHaveLength(2);
    expect(day.disciplines[0]).toMatchObject({
      totalMinutes: 20,
      maxPendiente: null,
    });
    expect(day.disciplines[1]).toMatchObject({
      totalMinutes: 15,
      maxPendiente: 5,
    });
    // La cuesta quema más aunque sean menos minutos: es otro esfuerzo.
    expect(day.disciplines[1].kcal).toBeGreaterThan(day.disciplines[0].kcal);
  });

  it('pendiente 0 es llano: se fusiona con las entradas sin pendiente', () => {
    const [day] = buildCardioDays([
      makeLog(
        'a',
        '2026-07-16',
        'Andar en cinta: 20min, 6kmh | Andar en cinta: 10min, 6kmh, 0%'
      ),
    ]);
    expect(day.disciplines).toHaveLength(1);
    expect(day.disciplines[0].totalMinutes).toBe(30);
  });

  it('separa fechas distintas y las ordena ascendente', () => {
    const days = buildCardioDays([
      makeLog('b', '2026-07-02', 'Cinta: 10min, 10kmh'),
      makeLog('a', '2026-07-01', 'Cinta: 10min, 10kmh'),
    ]);
    expect(days.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02']);
  });
});

describe('topKcalDiscipline', () => {
  it('elige la disciplina con más kcal, no la de más minutos', () => {
    // La bici son más minutos; correr en cinta quema bastante más.
    const [day] = buildCardioDays([
      makeLog('a', '2026-07-01', 'Bici: 40min, 20kmh | Correr: 20min, 12kmh'),
    ]);
    const top = topKcalDiscipline(day)!;
    expect(top.type).toBe('Correr');
    expect(top.kcal).toBeGreaterThan(day.disciplines[0].kcal);
  });

  it('null si no hay disciplinas', () => {
    expect(
      topKcalDiscipline({
        date: '2026-07-01',
        sessions: [],
        disciplines: [],
        totalMinutes: 0,
        totalKm: 0,
        totalKcal: 0,
        isToday: false,
      })
    ).toBeNull();
  });
});

describe('isoWeekRange', () => {
  it('devuelve lunes y domingo de la semana ISO', () => {
    expect(isoWeekRange('2026-07-01')).toEqual({
      start: '2026-06-29',
      end: '2026-07-05',
    });
  });
});

describe('mergeSessionEntries', () => {
  it('fusiona misma disciplina sumando minutos y con rango de velocidad', () => {
    const entries = parseCardioEntries(
      'Cinta: 20min, 12kmh | Cinta: 24min, 12.6kmh | Bici: 15min'
    );
    const merged = mergeSessionEntries(entries);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      type: 'Cinta',
      totalMinutes: 44,
      minSpeed: 12,
      maxSpeed: 12.6,
    });
    expect(merged[1]).toMatchObject({ type: 'Bici', totalMinutes: 15 });
  });
});

describe('formatMergedResults', () => {
  // El idioma por defecto (también en jest) es español: el decimal se pinta con
  // coma aunque el dato se guarde y se parsee con punto (ver i18n.ts).
  it('formatea con espacios y rango de velocidad, con coma decimal', () => {
    const [merged] = mergeSessionEntries(
      parseCardioEntries('Cinta: 20min, 12kmh | Cinta: 24min, 12.6kmh')
    );
    expect(formatMergedResults(merged)).toBe('44 min, 12-12,6 km/h');
  });

  it('velocidad única sin rango, y sin velocidad omite km/h', () => {
    const [cinta] = mergeSessionEntries(
      parseCardioEntries('Cinta: 20min, 10kmh')
    );
    expect(formatMergedResults(cinta)).toBe('20 min, 10 km/h');
    const [bici] = mergeSessionEntries(parseCardioEntries('Bici: 30min'));
    expect(formatMergedResults(bici)).toBe('30 min');
  });
});

describe('buildCardioMonths', () => {
  it('agrupa por mes y calcula mejora de kcal vs mes previo', () => {
    // Mismos minutos y disciplina: las kcal son proporcionales a la velocidad,
    // así que 10→11 km/h da +10% de kcal.
    const months = buildCardioMonths([
      makeLog('a', '2026-06-10', 'Cinta: 20min, 10kmh'),
      makeLog('c', '2026-07-05', 'Cinta: 20min, 11kmh'),
    ]);
    expect(months).toHaveLength(2);
    expect(months[0].monthKey).toBe('2026-06');
    expect(months[0].improvement).toBeNull();
    expect(months[0].totalKcal).toBeGreaterThan(0);
    expect(months[1].monthKey).toBe('2026-07');
    expect(months[1].totalKcal).toBeGreaterThan(months[0].totalKcal);
    expect(months[1].improvement).toBeGreaterThan(0);
  });
});

describe('pendiente y kcal', () => {
  it('parsea la pendiente de la entrada', () => {
    const [e] = parseCardioEntries('Correr en cinta: 20min, 11kmh, 2%');
    expect(e.pendiente).toBe(2);
  });

  it('muestra la pendiente en el formato fusionado', () => {
    const [m] = mergeSessionEntries(
      parseCardioEntries('Andar en cinta: 20min, 5kmh, 3%')
    );
    expect(formatMergedResults(m)).toBe('20 min, 5 km/h, 3%');
  });

  it('estima kcal para correr y 0 si no hay velocidad', () => {
    const [conVel] = parseCardioEntries('Cinta: 60min, 10kmh');
    expect(estimateEntryKcal(conVel)).toBeGreaterThan(700);
    const [sinVel] = parseCardioEntries('Bici: 30min');
    expect(estimateEntryKcal(sinVel)).toBe(0);
  });

  it('la pendiente aumenta las kcal de andar en cinta', () => {
    const [llano] = parseCardioEntries('Andar en cinta: 20min, 5kmh');
    const [cuesta] = parseCardioEntries('Andar en cinta: 20min, 5kmh, 9%');
    expect(estimateEntryKcal(cuesta)).toBeGreaterThan(
      estimateEntryKcal(llano) * 1.5
    );
  });
});

describe('reclasificación retroactiva andar en cinta', () => {
  it('convierte entradas antiguas con pendiente en "Andar en cinta"', () => {
    const session = cardioSessionFromLog(
      makeLog('a', '2026-06-01', 'Correr en cinta: 30min, 6kmh, 4%')
    );
    expect(session!.entries[0].type).toBe('Andar en cinta');
  });

  it('no reclasifica sin pendiente', () => {
    const session = cardioSessionFromLog(
      makeLog('b', '2026-06-01', 'Correr en cinta: 30min, 12kmh')
    );
    expect(session!.entries[0].type).toBe('Correr en cinta');
  });
});

describe('pesos por tramos', () => {
  it('weightForTimestamp devuelve el peso vigente (o 70 sin tramos)', () => {
    const segs = [
      { weight: 60, appliesFrom: 0, setAt: 0 },
      { weight: 80, appliesFrom: 1000, setAt: 1000 },
    ];
    expect(weightForTimestamp([], 5)).toBe(70);
    expect(weightForTimestamp(segs, 500)).toBe(60);
    expect(weightForTimestamp(segs, 1000)).toBe(80);
    expect(weightForTimestamp(segs, 2000)).toBe(80);
  });

  it('cada log usa el peso vigente según su createdAt', () => {
    const logA = makeLog('a', '2026-06-01', 'Cinta: 60min, 10kmh');
    const logB = makeLog('b', '2026-06-15', 'Cinta: 60min, 10kmh');
    const segs = [
      { weight: 60, appliesFrom: 0, setAt: 0 },
      { weight: 80, appliesFrom: logB.createdAt, setAt: logB.createdAt },
    ];
    const weeks = buildCardioWeeks([logA, logB], segs);
    const wA = weeks.find((w) => w.sessions.some((s) => s.logId === 'a'))!;
    const wB = weeks.find((w) => w.sessions.some((s) => s.logId === 'b'))!;
    // Las kcal son lineales con el peso: la B (80kg) / la A (60kg) = 80/60.
    expect(wA.totalKcal).toBeGreaterThan(0);
    expect(wB.totalKcal / wA.totalKcal).toBeCloseTo(80 / 60, 2);
  });
});
