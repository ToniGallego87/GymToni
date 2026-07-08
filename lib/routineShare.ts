import * as Linking from 'expo-linking';
import { WorkoutExercise, WorkoutRoutine } from '../types';
import { getDisplayDayName } from './theme';
import { GymIconName, isGymIconName, resolveDayIcon } from './gymIcons';

// Ruta del deep link de importación: gymtrack://import-routine?data=...
// El esquema (gymtrack) está declarado en app.json → expo.scheme.
export const ROUTINE_IMPORT_PATH = 'import-routine';
const SHARE_SCHEME = 'gymtrack';

// Forma que consume NewRoutineScreen para prerrellenar el formulario.
export interface SharedRoutineDay {
  title: string;
  exercisesText: string;
  icon?: GymIconName;
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
  d: { t: string; e: string[]; i?: string }[];
}

// Etiqueta de icono al final de la línea de título en el texto plano, p. ej.
// "Día de brazo [#biceps]". Se extrae al importar y se oculta del título.
const ICON_TAG_REGEX = /\s*\[#([a-z]+)\]\s*$/i;

// Separa la etiqueta de icono del título de un día en texto plano.
export function stripIconTag(titleLine: string): {
  title: string;
  icon?: GymIconName;
} {
  const match = titleLine.match(ICON_TAG_REGEX);
  const tag = match?.[1]?.toLowerCase();
  if (match && isGymIconName(tag)) {
    return { title: titleLine.replace(ICON_TAG_REGEX, '').trim(), icon: tag };
  }
  return { title: titleLine.trim() };
}

// Línea de ejercicio en el formato que entiende NewRoutineScreen: "Nombre [SxR]".
function exerciseToLine(exercise: WorkoutExercise): string {
  if (exercise.targetSets && exercise.targetReps) {
    return `${exercise.name} [${exercise.targetSets}x${exercise.targetReps}]`;
  }
  return exercise.name;
}

// Rutina en texto plano, en el mismo formato que entiende "Crear a partir de
// texto plano" (buildDaysFromRoutineText en NewRoutineScreen): un día por bloque
// separado por línea en blanco; la primera línea es el nombre del día y debajo,
// un ejercicio por línea ("Nombre [SxR]"). Round-trip exacto con la importación.
export function buildRoutineShareText(routine: WorkoutRoutine): string {
  return routine.days
    .map((day) => {
      const title = getDisplayDayName(day.name) || day.name;
      const icon = resolveDayIcon(day.emoji, day.name);
      return [`${title} [#${icon}]`, ...day.exercises.map(exerciseToLine)].join(
        '\n'
      );
    })
    .join('\n\n');
}

export function buildRoutineShareLink(routine: WorkoutRoutine): string {
  const payload: RoutinePayload = {
    v: 1,
    n: routine.name,
    t: routine.timerDuration,
    d: routine.days.map((day) => ({
      t: getDisplayDayName(day.name) || day.name,
      e: day.exercises.map(exerciseToLine),
      i: resolveDayIcon(day.emoji, day.name),
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
        icon: isGymIconName(day.i) ? day.i : undefined,
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
