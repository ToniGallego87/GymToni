// Catálogo de ejercicios con nombres bilingües (ES/EN), taxonomía y GIF de
// referencia. Datos derivados del dataset público hasaneyldrm/exercises-dataset.
//
// - Nombres: `en` viene del dataset; `es` está traducido (550 a mano, el resto
//   por reglas). Ver `exerciseCatalog.json`.
// - Taxonomía (`target`/`equipment`/`category`) se guarda con la CLAVE inglesa
//   del dataset; las etiquetas visibles salen de los diccionarios de abajo según
//   el idioma activo.
// - Los GIF NO se empaquetan: se cargan bajo demanda desde el CDN (jsDelivr).
//   La media es © Gym Visual; mostrar SIEMPRE la atribución al enseñar un GIF.
import { language } from '@lib/i18n';

export interface CatalogExercise {
  id: string;
  mediaId: string;
  en: string;
  es: string;
  target: string; // clave inglesa (músculo principal)
  equipment: string; // clave inglesa
  category: string; // clave inglesa (zona corporal)
  /**
   * Copia de otro ejercicio del catálogo (otra cámara, otro modelo, "v. 2").
   * Para el historial es EL MISMO ejercicio (ver lib/exerciseIdentity.ts).
   */
  variantOf?: string;
  /** Copia que no aporta nada al elegir (solo cambia la cámara o el modelo). */
  hidden?: boolean;
  /** Cómo se llama en el gimnasio ("press banca", "jalón al pecho"). */
  aliases?: string[];
}
// Los datos se limpian con scripts/clean-exercise-catalog.js (nombres únicos,
// variantes, sinónimos); lib/__tests__/exerciseCatalog.test.ts lo vigila.

// El catálogo (1300 ejercicios, 288 KB de JSON) se carga la PRIMERA VEZ que
// alguien lo pide, no al evaluar el bundle. Antes era un `import` de módulo, y
// como este fichero cuelga del barril de `components` (el buscador de ejercicios,
// el visor de GIF), el arranque pagaba siempre el JSON entero más el Map por id
// aunque nadie fuera a abrir el buscador. Quien lo necesita es el registro y el
// alta de ejercicios, nunca la primera pantalla.
let catalog: CatalogExercise[] | null = null;
let byId: Map<string, CatalogExercise> | null = null;

/** Catálogo completo. La primera llamada lo carga; las demás lo reutilizan. */
export function getExerciseCatalog(): CatalogExercise[] {
  if (!catalog) {
    catalog = require('./exerciseCatalog.json') as unknown as CatalogExercise[];
  }
  return catalog;
}

/** Registro del catálogo por su id ("0001"). undefined si no existe o sin id. */
export const getCatalogExercise = (
  id?: string
): CatalogExercise | undefined => {
  if (!id) return undefined;
  if (!byId) {
    byId = new Map(getExerciseCatalog().map((e) => [e.id, e]));
  }
  return byId.get(id);
};

// --- GIF / imagen bajo demanda (no empaquetados) ---
const CDN = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main';
export const ATTRIBUTION = '© Gym Visual — https://gymvisual.com/';
export const gifUrl = (e: CatalogExercise) =>
  `${CDN}/videos/${e.id}-${e.mediaId}.gif`;
export const thumbUrl = (e: CatalogExercise) =>
  `${CDN}/images/${e.id}-${e.mediaId}.jpg`;

// --- Nombre visible según idioma ---
export const exerciseName = (e: CatalogExercise) =>
  language === 'en' ? e.en : e.es;

// --- Búsqueda tolerante (tildes, plural/singular, varias palabras) ---
// Quita acentos y baja a minúsculas: buscar sin importar tildes ni idioma.
const searchNorm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Reduce una palabra a su raíz quitando el plural español (-es / -s). Así
// "extensiones" y "extensión" caen en la misma raíz "extension". El prefijo se
// mantiene por si el usuario aún está tecleando ("exten").
const stem = (w: string) => {
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
};

// Palabras de relleno: "press DE banca" debe encontrar el sinónimo "press
// banca". Si la búsqueda es solo relleno, se usa tal cual.
const STOPWORDS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'con',
  'en',
  'a',
  'al',
  'y',
  'sobre',
]);

const queryTokens = (query: string): string[] => {
  const tokens = searchNorm(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const meaningful = tokens.filter((token) => !STOPWORDS.has(token));
  return meaningful.length ? meaningful : tokens;
};

// Texto comparable entero (sin tildes, puntuación ni relleno) para las
// coincidencias exactas y de comienzo: "Press de banca" = "press banca".
const plain = (s: string) => queryTokens(s).join(' ');

/** ¿Aparecen TODAS las palabras buscadas en el texto? Por raíz o por trozo. */
function tokensMatch(text: string, tokens: string[]): boolean {
  const words = searchNorm(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const stems = words.map(stem);
  return tokens.every((token) => {
    const ts = stem(token);
    return (
      stems.some((w) => w.startsWith(ts)) ||
      words.some((w) => w.includes(token))
    );
  });
}

const nameText = (e: CatalogExercise) =>
  [e.es, e.en, ...(e.aliases ?? [])].join(' ');

/**
 * Las etiquetas del ejercicio (zona, músculo, equipo) en los DOS idiomas: se
 * busca "bíceps" o "biceps", "mancuerna" o "dumbbell", con la app en el que sea.
 */
const tagText = (e: CatalogExercise) =>
  [
    CATEGORY_LABELS[e.category],
    TARGET_LABELS[e.target],
    EQUIPMENT_LABELS[e.equipment],
  ]
    .flatMap((l) => (l ? [l.es, l.en] : []))
    .join(' ');

/**
 * ¿Coincide el ejercicio con la búsqueda? Parte la consulta en palabras y exige
 * que TODAS aparezcan en el nombre (ES o EN), sus sinónimos o sus etiquetas
 * (zona, músculo, equipo), comparando por raíz para que plural y singular
 * encuentren lo mismo ("extensiones" ↔ "extensión"). Así "bíceps mancuerna"
 * encuentra los curls con mancuerna aunque su nombre no diga "bíceps".
 */
export const matchesExercise = (e: CatalogExercise, query: string): boolean => {
  const tokens = queryTokens(query);
  if (!tokens.length) return true;
  return tokensMatch(`${nameText(e)} ${tagText(e)}`, tokens);
};

/** Relevancia mínima de lo que coincide por el NOMBRE (no solo por etiqueta). */
const NAME_MATCH_SCORE = 50;

/**
 * Relevancia de un ejercicio para la búsqueda (0 = no encaja). Primero el que
 * se llama EXACTAMENTE así (nombre o sinónimo), luego el que empieza así, luego
 * el que lo lleva en el nombre y por último el que solo coincide por etiqueta:
 * "press banca" tiene que dar la banca con barra antes que "Press de banca
 * declinado agarre cerrado en multipower", y "pecho" los que se llaman
 * "Press de pecho…" antes que el resto de ejercicios de pecho.
 */
export function scoreExercise(e: CatalogExercise, query: string): number {
  const q = plain(query);
  if (!q) return 0;
  const names = [plain(e.es), plain(e.en)];
  const aliases = (e.aliases ?? []).map(plain);
  if (names.includes(q) || aliases.includes(q)) return 100;
  if (names.some((name) => name.startsWith(q))) return 80;
  if (aliases.some((alias) => alias.startsWith(q))) return 75;
  const tokens = queryTokens(query);
  if (tokensMatch(nameText(e), tokens)) return NAME_MATCH_SCORE;
  return matchesExercise(e, query) ? 30 : 0;
}

// --- Filtro por etiquetas (zona → músculo → equipo) ---

/**
 * Filtro por las etiquetas del catálogo. Cada campo es la CLAVE inglesa (como
 * en el JSON); sin campo, no filtra. `category: UNCLASSIFIED` deja solo lo que
 * no es del catálogo (ejercicios propios, en Progreso).
 */
export interface TagFilter {
  category?: string;
  target?: string;
  equipment?: string;
}

export const UNCLASSIFIED = '__unclassified';

/** ¿Pasa el filtro? `e` undefined = ejercicio propio, sin etiquetas. */
export function matchesTagFilter(
  e: CatalogExercise | undefined,
  filter: TagFilter
): boolean {
  if (filter.category === UNCLASSIFIED) return !e;
  if (!filter.category && !filter.target && !filter.equipment) return true;
  if (!e) return false;
  return (
    (!filter.category || e.category === filter.category) &&
    (!filter.target || e.target === filter.target) &&
    (!filter.equipment || e.equipment === filter.equipment)
  );
}

export interface TagFilterOptions {
  category: string[];
  target: string[];
  equipment: string[];
  /** Hay ejercicios sin catálogo (opción "Sin clasificar"). */
  unclassified: boolean;
}

/**
 * Opciones de cada fila del filtro SOLO con lo que hay: las zonas de todos los
 * ejercicios, los músculos de la zona elegida y los equipos de zona + músculo.
 * Ningún chip lleva a una lista vacía. Por nombre visible, en el idioma activo.
 */
export function tagFilterOptions(
  items: (CatalogExercise | undefined)[],
  filter: TagFilter
): TagFilterOptions {
  const catalogItems = items.filter((e): e is CatalogExercise => !!e);
  const inCategory = catalogItems.filter(
    (e) => !filter.category || e.category === filter.category
  );
  const inTarget = inCategory.filter(
    (e) => !filter.target || e.target === filter.target
  );
  const keys = (list: CatalogExercise[], field: keyof TagFilter) => [
    ...new Set(list.map((e) => e[field])),
  ];
  return {
    category: keys(catalogItems, 'category').sort((a, b) =>
      categoryLabel(a).localeCompare(categoryLabel(b))
    ),
    target: keys(inCategory, 'target').sort((a, b) =>
      targetLabel(a).localeCompare(targetLabel(b))
    ),
    equipment: keys(inTarget, 'equipment').sort((a, b) =>
      equipmentLabel(a).localeCompare(equipmentLabel(b))
    ),
    unclassified: items.some((e) => !e),
  };
}

/**
 * Búsqueda en el catálogo para elegir: sin las copias ocultas, con el filtro
 * de etiquetas y, si hay búsqueda, de más a menos relevante. A igualdad: el
 * principal antes que sus variantes, el que tiene sinónimos de gimnasio (los
 * ejercicios habituales) antes que el raro, y el nombre más corto —el
 * ejercicio "a secas"— primero.
 */
export function searchCatalog(
  query: string,
  filter: TagFilter = {}
): CatalogExercise[] {
  const visible = getExerciseCatalog().filter(
    (e) => !e.hidden && matchesTagFilter(e, filter)
  );
  if (!query.trim()) return visible;
  return rankByScore(visible, query, 1);
}

function rankByScore(
  list: CatalogExercise[],
  query: string,
  minScore: number
): CatalogExercise[] {
  return list
    .map((e) => ({ e, score: scoreExercise(e, query) }))
    .filter(({ score }) => score >= minScore)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(!!a.e.variantOf) - Number(!!b.e.variantOf) ||
        Number(!!b.e.aliases) - Number(!!a.e.aliases) ||
        exerciseName(a.e).length - exerciseName(b.e).length
    )
    .map(({ e }) => e);
}

/** Letras mínimas antes de proponer ejercicios del catálogo al escribir. */
const SUGGEST_MIN_LENGTH = 3;

/**
 * Ejercicios del catálogo que podrían ser el que se está escribiendo ("¿Es
 * Press de banca con barra?"). Solo principales (la variante se elige luego
 * desde el buscador si su GIF encaja mejor) y solo por NOMBRE: escribir
 * "Remo" no debe proponer cualquier ejercicio de espalda. Es una PROPUESTA:
 * elegir lo decide la persona.
 */
export function suggestCatalogExercises(
  name: string,
  limit = 3
): CatalogExercise[] {
  if (plain(name).length < SUGGEST_MIN_LENGTH) return [];
  const principals = getExerciseCatalog().filter(
    (e) => !e.hidden && !e.variantOf
  );
  return rankByScore(principals, name, NAME_MATCH_SCORE).slice(0, limit);
}

// --- Diccionarios de taxonomía (clave inglesa → etiqueta ES/EN) ---
type Label = { es: string; en: string };

export const CATEGORY_LABELS: Record<string, Label> = {
  back: { es: 'Espalda', en: 'Back' },
  cardio: { es: 'Cardio', en: 'Cardio' },
  chest: { es: 'Pecho', en: 'Chest' },
  'lower arms': { es: 'Antebrazos', en: 'Lower arms' },
  'lower legs': { es: 'Pantorrillas', en: 'Lower legs' },
  neck: { es: 'Cuello', en: 'Neck' },
  shoulders: { es: 'Hombros', en: 'Shoulders' },
  'upper arms': { es: 'Brazos', en: 'Upper arms' },
  'upper legs': { es: 'Piernas', en: 'Upper legs' },
  waist: { es: 'Core', en: 'Waist' },
};

export const TARGET_LABELS: Record<string, Label> = {
  abductors: { es: 'Abductores', en: 'Abductors' },
  abs: { es: 'Abdominales', en: 'Abs' },
  adductors: { es: 'Aductores', en: 'Adductors' },
  biceps: { es: 'Bíceps', en: 'Biceps' },
  calves: { es: 'Gemelos', en: 'Calves' },
  'cardiovascular system': { es: 'Cardiovascular', en: 'Cardio' },
  delts: { es: 'Deltoides', en: 'Delts' },
  forearms: { es: 'Antebrazos', en: 'Forearms' },
  glutes: { es: 'Glúteos', en: 'Glutes' },
  hamstrings: { es: 'Femoral', en: 'Hamstrings' },
  lats: { es: 'Dorsal', en: 'Lats' },
  'levator scapulae': { es: 'Elevador de la escápula', en: 'Levator scapulae' },
  pectorals: { es: 'Pectoral', en: 'Pectorals' },
  quads: { es: 'Cuádriceps', en: 'Quads' },
  'serratus anterior': { es: 'Serrato', en: 'Serratus anterior' },
  spine: { es: 'Espalda baja', en: 'Spine' },
  traps: { es: 'Trapecio', en: 'Traps' },
  triceps: { es: 'Tríceps', en: 'Triceps' },
  'upper back': { es: 'Espalda alta', en: 'Upper back' },
};

export const EQUIPMENT_LABELS: Record<string, Label> = {
  assisted: { es: 'Asistido', en: 'Assisted' },
  band: { es: 'Banda', en: 'Band' },
  barbell: { es: 'Barra', en: 'Barbell' },
  'body weight': { es: 'Peso corporal', en: 'Body weight' },
  'bosu ball': { es: 'Bosu', en: 'Bosu ball' },
  cable: { es: 'Polea', en: 'Cable' },
  dumbbell: { es: 'Mancuerna', en: 'Dumbbell' },
  'elliptical machine': { es: 'Elíptica', en: 'Elliptical' },
  'ez barbell': { es: 'Barra Z', en: 'EZ barbell' },
  hammer: { es: 'Hammer', en: 'Hammer' },
  kettlebell: { es: 'Kettlebell', en: 'Kettlebell' },
  'leverage machine': { es: 'Máquina', en: 'Machine' },
  'medicine ball': { es: 'Balón medicinal', en: 'Medicine ball' },
  'olympic barbell': { es: 'Barra olímpica', en: 'Olympic barbell' },
  'resistance band': { es: 'Banda elástica', en: 'Resistance band' },
  roller: { es: 'Rodillo', en: 'Roller' },
  rope: { es: 'Cuerda', en: 'Rope' },
  'skierg machine': { es: 'Skierg', en: 'Skierg' },
  'sled machine': { es: 'Trineo', en: 'Sled' },
  'smith machine': { es: 'Multipower', en: 'Smith machine' },
  'stability ball': { es: 'Fitball', en: 'Stability ball' },
  'stationary bike': { es: 'Bici estática', en: 'Stationary bike' },
  'stepmill machine': { es: 'Escaladora', en: 'Stepmill' },
  tire: { es: 'Neumático', en: 'Tire' },
  'trap bar': { es: 'Barra hexagonal', en: 'Trap bar' },
  'upper body ergometer': { es: 'Ergómetro', en: 'Upper body ergometer' },
  weighted: { es: 'Lastre', en: 'Weighted' },
  'wheel roller': { es: 'Rueda abdominal', en: 'Ab wheel' },
};

const label = (dict: Record<string, Label>, key: string) =>
  dict[key]?.[language] ?? key;

export const categoryLabel = (key: string) => label(CATEGORY_LABELS, key);
export const targetLabel = (key: string) => label(TARGET_LABELS, key);
export const equipmentLabel = (key: string) => label(EQUIPMENT_LABELS, key);
