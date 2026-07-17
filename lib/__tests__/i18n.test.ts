import {
  canonicalDecimals,
  decimalSeparator,
  localizeDecimals,
  parseTypedNumber,
} from '../i18n';
import { formatParsedSet, parseSeriesString } from '../parsers';

// Sin idioma guardado, jest cae al de la app: español (ver appSettings).
describe('decimales en español', () => {
  it('el separador es la coma', () => {
    expect(decimalSeparator).toBe(',');
  });

  it('localizeDecimals solo toca el decimal, no el resto del texto', () => {
    expect(localizeDecimals('44 min, 12-12.6 km/h')).toBe(
      '44 min, 12-12,6 km/h'
    );
    expect(localizeDecimals('22.5x10')).toBe('22,5x10');
    // Sin decimales no cambia nada.
    expect(localizeDecimals('60x8, 60x8')).toBe('60x8, 60x8');
  });

  it('parseTypedNumber lee lo tecleado con coma y con punto', () => {
    expect(parseTypedNumber('22,5')).toBe(22.5);
    expect(parseTypedNumber('22.5')).toBe(22.5);
    expect(parseTypedNumber('22')).toBe(22);
    expect(parseTypedNumber('')).toBeNaN();
  });

  it('lo tecleado se guarda con punto, que es lo que parsea la app', () => {
    // El dato guardado NO puede llevar coma: en las series es el separador.
    const raw = `${canonicalDecimals('22,5')}x10, 20x10`;
    expect(raw).toBe('22.5x10, 20x10');
    expect(parseSeriesString(raw)).toEqual([
      { weight: 22.5, reps: 10 },
      { weight: 20, reps: 10 },
    ]);
    // Y al volver a pintarse, con coma.
    expect(formatParsedSet({ weight: 22.5, reps: 10 })).toBe('22,5x10');
  });
});
