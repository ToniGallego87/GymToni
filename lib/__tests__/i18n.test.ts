import fs from 'fs';
import path from 'path';
import {
  canonicalDecimals,
  dateLocale,
  decimalSeparator,
  hasEnglish,
  language,
  localizeDecimals,
  parseTypedNumber,
  setLanguage,
  t,
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

// Verifica el NÚCLEO del cambio de idioma en caliente: los bindings vivos
// (t()/decimalSeparator/dateLocale) reflejan el idioma tras setLanguage sin
// reiniciar. El re-render del árbol (useLanguageVersion) es responsabilidad de
// React y no se cubre aquí.
describe('cambio de idioma en caliente (setLanguage)', () => {
  afterEach(() => setLanguage('es'));

  it('t() y los locales reflejan el idioma sin reiniciar', () => {
    expect(language).toBe('es');
    expect(t('Guardar')).toBe('Guardar');
    expect(decimalSeparator).toBe(',');
    expect(dateLocale).toBe('es-ES');

    setLanguage('en');
    expect(language).toBe('en');
    expect(t('Guardar')).toBe('Save');
    expect(decimalSeparator).toBe('.');
    expect(dateLocale).toBe('en-GB');

    setLanguage('es');
    expect(t('Guardar')).toBe('Guardar');
    expect(decimalSeparator).toBe(',');
    expect(dateLocale).toBe('es-ES');
  });
});

// Red contra el inglés a medias. `t()` cae al español cuando falta la entrada,
// así que una tanda de funciones nuevas puede dejar pantallas enteras sin
// traducir sin romper nada ni avisar (pasó con Comunidad, el perfil público y
// la semana de descarga: 75 textos). Este test recorre los `t('…')` del código
// y falla si alguno no tiene su entrada en el diccionario.
describe('cobertura del diccionario inglés', () => {
  const ROOT = path.resolve(__dirname, '..', '..');
  const SOURCE_DIRS = ['app', 'components', 'data', 'features', 'hooks', 'lib'];

  const sourceFiles = (dir: string): string[] => {
    const out: string[] = [];
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          // Los propios tests no cuentan: escriben claves de ejemplo.
          if (entry.name === '__tests__') continue;
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          out.push(full);
        }
      }
    };
    const start = path.join(ROOT, dir);
    if (fs.existsSync(start)) walk(start);
    return out;
  };

  // Fuera los comentarios antes de buscar: en este repo se documentan mucho las
  // decisiones y una llamada de ejemplo escrita en un comentario contaría como
  // texto sin traducir. El guardia del `//` evita comerse las URL (`https://`).
  const stripComments = (source: string): string =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  // Solo claves LITERALES: `t(variable)` no se puede comprobar en estático y no
  // se usa en el código (si algún día se usa, este test no la verá).
  const keysIn = (source: string): string[] => {
    const found: string[] = [];
    for (const pattern of [
      /\bt\(\s*'((?:[^'\\]|\\.)*)'/g,
      /\bt\(\s*"((?:[^"\\]|\\.)*)"/g,
    ]) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        found.push(match[1].replace(/\\'/g, "'").replace(/\\"/g, '"'));
      }
    }
    return found;
  };

  it('todo texto que pasa por t() tiene traducción al inglés', () => {
    const keys = new Set<string>();
    for (const dir of SOURCE_DIRS) {
      for (const file of sourceFiles(dir)) {
        const source = stripComments(fs.readFileSync(file, 'utf8'));
        for (const key of keysIn(source)) {
          keys.add(key);
        }
      }
    }

    // Si esto falla de golpe con cero claves, es el barrido lo que se ha roto
    // (una carpeta movida), no el diccionario.
    expect(keys.size).toBeGreaterThan(100);

    const missing = [...keys].filter((key) => !hasEnglish(key)).sort();
    expect(missing).toEqual([]);
  });
});
