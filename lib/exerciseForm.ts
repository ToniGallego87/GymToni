// Modelo de edición de ejercicios, compartido por "Nueva rutina" y por el
// editor de ejercicios de un día ya guardado (RoutineDetailScreen).
//
// La fila (`ExerciseForm`) es lo que se edita: nombre + series + reps/segundos.
// `buildWorkoutExercises` la convierte al ejercicio que guarda la app,
// CONSERVANDO el id: el historial referencia `exerciseId`, así que reasignarlo
// (como hacía el editor por texto, que los repartía por posición) cruzaba las
// comparaciones de progreso entre ejercicios distintos.
import { WorkoutExercise } from '../types';
import { generateId } from './utils';

export type RepUnit = 'reps' | 'seg';

export interface ExerciseForm {
  id: string;
  name: string;
  sets: number;
  // Reps/segundos como texto corto: admite rangos ("6-8") y matices ("10-12/lado").
  reps: string;
  unit: RepUnit;
  // Id del catálogo si el ejercicio se eligió del catálogo (para su GIF).
  catalogId?: string;
}

export const MIN_SETS = 1;
export const MAX_SETS = 12;

// Formato con corchetes ("Press banca [4x6-8]").
const EXERCISE_LINE_REGEX = /^(.*?)\s*\[(\d+)\s*x\s*([^\]]+)\]\s*$/i;
// Formato plano: nombre + separador (raya o espacios) + [series x] reps. La reps
// admite rango ("6-8") y una "s" final opcional para segundos ("30s", "20-30s").
const EXERCISE_PLAIN_REGEX =
  /^(.+?)\s*(?:[—–]\s*|\s+)(?:(\d+)\s*[x×]\s*)?(\d+(?:-\d+)?\s*(?:s|seg|sec)?)\s*$/i;
// Unidad de tiempo al final de las reps ("30s", "20-30 seg").
const SECONDS_SUFFIX_REGEX = /\s*(s|seg|sec)\s*$/i;
// Etiqueta de GIF asignado al final de la línea ("Press banca [4x6-8] {#0025}").
// Fija el ejercicio del catálogo para que su GIF viaje al compartir/importar.
const CATALOG_TAG_REGEX = /\s*\{#([0-9A-Za-z_-]+)\}\s*$/;

function clampSets(sets: number): number {
  return Math.min(MAX_SETS, Math.max(MIN_SETS, sets));
}

export function createEmptyExercise(): ExerciseForm {
  return { id: generateId(), name: '', sets: 3, reps: '10-12', unit: 'reps' };
}

// Construye una fila a partir de nombre + series + reps (string), detectando segundos.
export function makeExercise(
  name: string,
  setsRaw: string,
  repsRaw: string,
  catalogId?: string
): ExerciseForm {
  const sets = clampSets(parseInt(setsRaw, 10) || 3);
  let reps = repsRaw.trim();
  let unit: RepUnit = 'reps';

  if (/(s|seg|sec)\b/i.test(reps)) {
    unit = 'seg';
    reps = reps.replace(/\s*(s|seg|sec)\b/i, '').trim();
  }

  return {
    id: generateId(),
    name: name.trim(),
    sets,
    reps: reps || '10',
    unit,
    catalogId,
  };
}

// Convierte una línea importada en una fila estructurada. Acepta "Nombre [4x6-8]",
// "Nombre 4x6-8" o solo "Nombre", con una etiqueta opcional de GIF asignado
// ("… {#0025}") que sobrevive al round-trip de compartir/importar.
export function parseImportedExercise(line: string): ExerciseForm {
  const tag = line.match(CATALOG_TAG_REGEX);
  const catalogId = tag?.[1];
  const trimmed = line.replace(CATALOG_TAG_REGEX, '').trim();

  const bracket = trimmed.match(EXERCISE_LINE_REGEX);
  if (bracket)
    return makeExercise(bracket[1], bracket[2], bracket[3], catalogId);

  const plain = trimmed.match(EXERCISE_PLAIN_REGEX);
  if (plain && plain[3]) {
    const name = plain[1].replace(/[—–]\s*$/, '').trim();
    return makeExercise(name, plain[2] ?? '3', plain[3], catalogId);
  }

  return {
    id: generateId(),
    name: trimmed,
    sets: 3,
    reps: '10-12',
    unit: 'reps',
    catalogId,
  };
}

export function buildExercisesFromText(exercisesText: string): ExerciseForm[] {
  const exercises = exercisesText
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseImportedExercise);

  return exercises.length ? exercises : [createEmptyExercise()];
}

// targetReps que entiende el resto de la app: añade la unidad de segundos.
export function buildTargetReps(exercise: ExerciseForm): string {
  const reps = exercise.reps.trim() || (exercise.unit === 'seg' ? '30' : '10');
  return exercise.unit === 'seg' ? `${reps}s` : reps;
}

/**
 * Ejercicio guardado → fila editable. Conserva el id (ver cabecera del módulo)
 * y separa la unidad del texto de reps ("30s" → 30 + segundos).
 */
export function exerciseFormFromExercise(
  exercise: WorkoutExercise
): ExerciseForm {
  const rawReps = (exercise.targetReps ?? '').trim();
  const isSeconds = SECONDS_SUFFIX_REGEX.test(rawReps);
  const reps = isSeconds ? rawReps.replace(SECONDS_SUFFIX_REGEX, '') : rawReps;

  return {
    id: exercise.id,
    name: exercise.name,
    sets: clampSets(exercise.targetSets ?? 3),
    reps: reps || (isSeconds ? '30' : '10'),
    unit: isSeconds ? 'seg' : 'reps',
    catalogId: exercise.catalogId,
  };
}

/**
 * Filas → ejercicios guardables. Descarta las que no tienen nombre y renumera
 * el orden; el id de cada fila viaja intacto.
 */
export function buildWorkoutExercises(
  forms: ExerciseForm[]
): WorkoutExercise[] {
  return forms
    .filter((form) => form.name.trim())
    .map((form, index) => ({
      id: form.id,
      name: form.name.trim(),
      order: index + 1,
      targetSets: form.sets,
      targetReps: buildTargetReps(form),
      catalogId: form.catalogId,
    }));
}
