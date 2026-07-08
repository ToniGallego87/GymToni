import {
  parseSeriesString,
  parseCardioString,
  formatParsedSet,
} from '../parsers';

describe('parseSeriesString', () => {
  it('parsea series separadas por comas', () => {
    expect(parseSeriesString('60x8, 65x6, 65x4')).toEqual([
      { weight: 60, reps: 8 },
      { weight: 65, reps: 6 },
      { weight: 65, reps: 4 },
    ]);
  });

  it('soporta decimales', () => {
    expect(parseSeriesString('12.5x15')).toEqual([{ weight: 12.5, reps: 15 }]);
  });

  it('suma pesos combinados (mancuernas)', () => {
    expect(parseSeriesString('8+8x11')).toEqual([{ weight: 16, reps: 11 }]);
  });

  it('ignora entradas sin reps', () => {
    expect(parseSeriesString('80x')).toEqual([]);
  });

  it('devuelve array vacío para entrada vacía', () => {
    expect(parseSeriesString('')).toEqual([]);
    expect(parseSeriesString('   ')).toEqual([]);
  });

  it('ignora tramos no parseables pero conserva los válidos', () => {
    expect(parseSeriesString('60x8, descanso, 65x6')).toEqual([
      { weight: 60, reps: 8 },
      { weight: 65, reps: 6 },
    ]);
  });
});

describe('parseCardioString', () => {
  it('extrae tipo, duración y ritmo', () => {
    const parsed = parseCardioString('Cinta: 22.5mins, 11.5kmh');
    expect(parsed.type).toBe('Cinta');
    expect(parsed.duration).toBe(22.5);
    expect(parsed.pace).toContain('11.5');
  });

  it('usa tipo por defecto cuando no hay etiqueta', () => {
    expect(parseCardioString('20 mins').type).toBe('Cardio');
  });
});

describe('formatParsedSet', () => {
  it('formatea un set normal', () => {
    expect(formatParsedSet({ weight: 60, reps: 8 })).toBe('60x8');
  });

  it('muestra guion para sets centinela', () => {
    expect(formatParsedSet({ weight: -1, reps: -1 })).toBe('—');
  });
});
