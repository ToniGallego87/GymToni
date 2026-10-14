import {
  CatalogExercise,
  getExerciseCatalog,
  matchesTagFilter,
  searchCatalog,
  suggestCatalogExercises,
  tagFilterOptions,
  UNCLASSIFIED,
} from '../../data/exerciseCatalog';
import { EXERCISE_VARIANT_OF } from '../../data/exerciseVariants';

// Invariantes del catálogo que deja scripts/clean-exercise-catalog.js. Si un
// cambio en los datos las rompe, hay que arreglarlo en el script (no a mano en
// el JSON) y volver a ejecutarlo.

const catalog = getExerciseCatalog();
const byId = new Map(catalog.map((e) => [e.id, e]));
const visible = catalog.filter((e) => !e.hidden);

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function repeated(field: 'es' | 'en'): string[] {
  const seen = new Map<string, CatalogExercise[]>();
  for (const e of visible) {
    const key = norm(e[field]);
    seen.set(key, [...(seen.get(key) ?? []), e]);
  }
  return [...seen.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.map((e) => `${e.id} ${e[field]}`).join(' | '));
}

describe('catálogo de ejercicios', () => {
  it('los ids son únicos', () => {
    expect(byId.size).toBe(catalog.length);
  });

  it('ningún nombre visible se repite (ni en español ni en inglés)', () => {
    expect(repeated('es')).toEqual([]);
    expect(repeated('en')).toEqual([]);
  });

  it('cada variante cuelga de un ejercicio principal que existe', () => {
    for (const e of catalog.filter((x) => x.variantOf)) {
      const primary = byId.get(e.variantOf!);
      expect(primary).toBeDefined();
      expect(primary!.variantOf).toBeUndefined();
    }
  });

  it('solo se ocultan variantes', () => {
    expect(catalog.filter((e) => e.hidden && !e.variantOf)).toEqual([]);
  });

  it('el mapa de variantes generado está al día con el JSON', () => {
    const fromJson = Object.fromEntries(
      catalog.filter((e) => e.variantOf).map((e) => [e.id, e.variantOf])
    );
    expect(EXERCISE_VARIANT_OF).toEqual(fromJson);
  });

  it('los sinónimos van en el ejercicio principal', () => {
    expect(catalog.filter((e) => e.aliases && e.variantOf)).toEqual([]);
  });

  it('sin restos de la traducción automática ni codificación rota', () => {
    const broken = catalog.filter(
      (e) =>
        /в°/.test(e.en) ||
        /con barra Z con barra|en polea .*en polea|en multipower en máquina/i.test(
          e.es
        ) ||
        /\b(de \S+) \1\b/i.test(e.es)
    );
    expect(broken.map((e) => `${e.id} ${e.es}`)).toEqual([]);
  });
});

describe('searchCatalog', () => {
  const firstId = (query: string) => searchCatalog(query)[0]?.id;

  it('el nombre de gimnasio encuentra el ejercicio de verdad primero', () => {
    expect(firstId('press banca')).toBe('0025');
    expect(firstId('Press de banca')).toBe('0025');
    expect(firstId('jalón al pecho')).toBe('0150');
    expect(firstId('sentadilla')).toBe('0043');
    expect(firstId('peso muerto rumano')).toBe('0085');
  });

  it('sin tildes ni mayúsculas', () => {
    expect(firstId('JALON AL PECHO')).toBe('0150');
  });

  it('no enseña las copias que solo cambian la cámara o el modelo', () => {
    const hidden = new Set(catalog.filter((e) => e.hidden).map((e) => e.id));
    expect(searchCatalog('sentadilla').some((e) => hidden.has(e.id))).toBe(
      false
    );
  });

  it('filtra por zona, músculo y equipo', () => {
    const curls = searchCatalog('curl', {
      category: 'upper arms',
      target: 'biceps',
      equipment: 'dumbbell',
    });
    expect(curls.length).toBeGreaterThan(0);
    expect(
      curls.every(
        (e) =>
          e.category === 'upper arms' &&
          e.target === 'biceps' &&
          e.equipment === 'dumbbell'
      )
    ).toBe(true);
  });

  it('busca también por etiqueta, en los dos idiomas', () => {
    const results = searchCatalog('bíceps mancuerna');
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((e) => e.target === 'biceps' && e.equipment === 'dumbbell')
    ).toBe(true);
    expect(searchCatalog('biceps dumbbell').map((e) => e.id)).toEqual(
      results.map((e) => e.id)
    );
  });

  it('lo que coincide por nombre va antes que lo que solo coincide por etiqueta', () => {
    const results = searchCatalog('pecho');
    const firstTagOnly = results.findIndex(
      (e) => !/pecho/i.test(`${e.es} ${(e.aliases ?? []).join(' ')}`)
    );
    const lastByName = results
      .map((e) => /pecho/i.test(`${e.es} ${(e.aliases ?? []).join(' ')}`))
      .lastIndexOf(true);
    expect(firstTagOnly).toBeGreaterThan(0);
    expect(lastByName).toBeLessThan(firstTagOnly);
  });
});

describe('filtro por etiquetas', () => {
  const bench = byId.get('0025')!;

  it('sin filtro pasa todo, también lo propio', () => {
    expect(matchesTagFilter(bench, {})).toBe(true);
    expect(matchesTagFilter(undefined, {})).toBe(true);
  });

  it('"Sin clasificar" deja solo los ejercicios propios', () => {
    expect(matchesTagFilter(undefined, { category: UNCLASSIFIED })).toBe(true);
    expect(matchesTagFilter(bench, { category: UNCLASSIFIED })).toBe(false);
  });

  it('un ejercicio propio no pasa un filtro de zona', () => {
    expect(matchesTagFilter(undefined, { category: 'chest' })).toBe(false);
  });

  it('solo ofrece las etiquetas que hay dentro de lo elegido', () => {
    const items = [byId.get('0025')!, byId.get('0031')!, undefined];
    const all = tagFilterOptions(items, {});
    expect(all.category.sort()).toEqual(['chest', 'upper arms']);
    expect(all.unclassified).toBe(true);

    const chest = tagFilterOptions(items, { category: 'chest' });
    expect(chest.target).toEqual([bench.target]);
    expect(chest.equipment).toEqual([bench.equipment]);
  });
});

describe('suggestCatalogExercises', () => {
  it('no propone nada hasta tener unas letras', () => {
    expect(suggestCatalogExercises('pr')).toEqual([]);
  });

  it('propone principales, nunca variantes', () => {
    const suggestions = suggestCatalogExercises('press de hombro en máquina');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((e) => !e.variantOf)).toBe(true);
  });

  it('el primero es el que se llama así', () => {
    expect(suggestCatalogExercises('Press banca')[0]?.id).toBe('0025');
  });

  it('no propone por etiqueta: escribir una zona no sugiere cualquier ejercicio', () => {
    for (const e of suggestCatalogExercises('Espalda')) {
      expect(`${e.es} ${e.en} ${(e.aliases ?? []).join(' ')}`).toMatch(
        /espalda|back/i
      );
    }
  });
});
