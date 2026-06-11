import * as Linking from 'expo-linking';
import { WorkoutExercise, WorkoutRoutine } from '../types';
import { getDisplayDayName } from './theme';

// Ruta del deep link de importación: gymtrack://import-routine?data=...
// El esquema (gymtrack) está declarado en app.json → expo.scheme.
export const ROUTINE_IMPORT_PATH = 'import-routine';
const SHARE_SCHEME = 'gymtrack';

// Forma que consume NewRoutineScreen para prerrellenar el formulario.
export interface SharedRoutineDay {
  title: string;
  exercisesText: string;
}

export interface SharedRoutine {
  name?: string;
  timerDuration?: number;
  days: SharedRoutineDay[];
}

// Payload minificado que viaja dentro del QR. Sin IDs: NewRoutineScreen los
// regenera al crear, así que solo cargamos lo imprescindible para achicar el
// código. Claves de una letra por el mismo motivo.
interface RoutinePayload {
  v: 1;
  n?: string;
  t?: number;
  d: { t: string; e: string[] }[];
}

// Línea de ejercicio en el formato que entiende NewRoutineScreen: "Nombre [SxR]".
function exerciseToLine(exercise: WorkoutExercise): string {
  if (exercise.targetSets && exercise.targetReps) {
    return `${exercise.name} [${exercise.targetSets}x${exercise.targetReps}]`;
  }
  return exercise.name;
}

export function buildRoutineShareLink(routine: WorkoutRoutine): string {
  const payload: RoutinePayload = {
    v: 1,
    n: routine.name,
    t: routine.timerDuration,
    d: routine.days.map((day) => ({
      t: getDisplayDayName(day.name) || day.name,
      e: day.exercises.map(exerciseToLine),
    })),
  };

  const data = encodeURIComponent(JSON.stringify(payload));
  return `${SHARE_SCHEME}://${ROUTINE_IMPORT_PATH}?data=${data}`;
}

export function parseRoutineShareLink(url: string): SharedRoutine | null {
  try {
    const parsed = Linking.parse(url);
    const target = parsed.hostname ?? parsed.path;
    if (target !== ROUTINE_IMPORT_PATH) return null;

    const data = parsed.queryParams?.data;
    if (typeof data !== 'string') return null;

    // expo-linking ya decodifica los query params; JSON.parse directo.
    const payload = JSON.parse(data) as RoutinePayload;
    if (!payload || !Array.isArray(payload.d)) return null;

    const days: SharedRoutineDay[] = payload.d
      .filter((day) => day && typeof day.t === 'string' && Array.isArray(day.e))
      .map((day) => ({
        title: day.t,
        exercisesText: day.e
          .filter((line) => typeof line === 'string')
          .join('\n'),
      }));

    if (!days.length) return null;

    return {
      name: typeof payload.n === 'string' ? payload.n : undefined,
      timerDuration: typeof payload.t === 'number' ? payload.t : undefined,
      days,
    };
  } catch {
    return null;
  }
}
