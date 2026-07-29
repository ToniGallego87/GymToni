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
import raw from './exerciseCatalog.json';

export interface CatalogExercise {
  id: string;
  mediaId: string;
  en: string;
  es: string;
  target: string; // clave inglesa (músculo principal)
  equipment: string; // clave inglesa
  category: string; // clave inglesa (zona corporal)
}

export const EXERCISE_CATALOG = raw as unknown as CatalogExercise[];

const BY_ID = new Map(EXERCISE_CATALOG.map((e) => [e.id, e]));

/** Registro del catálogo por su id ("0001"). undefined si no existe o sin id. */
export const getCatalogExercise = (id?: string): CatalogExercise | undefined =>
  id ? BY_ID.get(id) : undefined;

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
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Reduce una palabra a su raíz quitando el plural español (-es / -s). Así
// "extensiones" y "extensión" caen en la misma raíz "extension". El prefijo se
// mantiene por si el usuario aún está tecleando ("exten").
const stem = (w: string) => {
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
};

/**
 * ¿Coincide el ejercicio con la búsqueda? Parte la consulta en palabras y exige
 * que TODAS aparezcan en el nombre (ES o EN), comparando por raíz para que
 * plural y singular encuentren lo mismo ("extensiones" ↔ "extensión").
 */
export const matchesExercise = (e: CatalogExercise, query: string): boolean => {
  const tokens = searchNorm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const words = searchNorm(`${e.es} ${e.en}`).split(/\s+/).filter(Boolean);
  const stems = words.map(stem);
  return tokens.every((token) => {
    const ts = stem(token);
    return stems.some((w) => w.startsWith(ts)) || words.some((w) => w.includes(token));
  });
};

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
