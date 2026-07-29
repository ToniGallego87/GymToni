export interface WorkoutExercise {
  id: string;
  name: string;
  order: number;
  targetReps?: string;
  targetSets?: number;
  // Id del ejercicio en el catálogo (data/exerciseCatalog) si se eligió de ahí.
  // Permite mostrar su GIF de referencia. Opcional: los ejercicios tecleados a
  // mano no lo tienen.
  catalogId?: string;
}

export interface WorkoutDay {
  id: string;
  dayNumber: number;
  name: string;
  emoji: string;
  description?: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  days: WorkoutDay[];
  createdAt: number;
  timerDuration?: number;
}

export interface ParsedSet {
  weight: number;
  reps: number;
}

export interface ExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  rawInput: string;
  parsedSets: ParsedSet[];
  notes?: string;
  timestamp: number;
}

export interface CardioLog {
  id: string;
  type: string;
  rawInput: string;
  duration?: number;
  distance?: number;
  pace?: string;
  notes?: string;
}

export interface WorkoutLog {
  id: string;
  routineId: string;
  dayId: string;
  date: string;
  exercises: ExerciseLog[];
  cardio?: CardioLog;
  createdAt: number;
  updatedAt: number;
  // Fuerza el inicio de una nueva semana con este entrenamiento aunque el
  // agrupado automático por día repetido no lo haría (ver lib/weeks.ts).
  startsNewWeek?: boolean;
  // Sesión "solo cardio": no cuenta como entrenamiento de fuerza (no aparece
  // en Inicio ni en las semanas), pero sí en la vista de Cardio.
  cardioOnly?: boolean;
  // Semana de descarga (deload): la semana a la que pertenece este log baja las
  // cargas a propósito. Las semanas se derivan (no se guardan), así que la marca
  // vive en el/los log(s) del bloque. A efectos de estadística la semana queda
  // al margen: barra en blanco en la gráfica y no sirve de base al comparar.
  isDeload?: boolean;
}

export interface WorkoutAppData {
  routines: WorkoutRoutine[];
  activeRoutineId?: string;
  // Rutina marcada como seleccionada en la vista de Rutinas. Es independiente
  // de la activa: seleccionar una rutina no la activa (ver WorkoutContext).
  selectedRoutineId?: string;
  logs: WorkoutLog[];
}

export type WorkoutState = WorkoutAppData;

export type WorkoutAction =
  | { type: 'SET_APP_DATA'; payload: WorkoutAppData }
  | { type: 'ADD_ROUTINE'; payload: WorkoutRoutine }
  | { type: 'DELETE_ROUTINE'; payload: string }
  | { type: 'UPDATE_ROUTINE'; payload: WorkoutRoutine }
  | { type: 'SET_ACTIVE_ROUTINE'; payload: string }
  | { type: 'SET_SELECTED_ROUTINE'; payload: string | undefined }
  | { type: 'ADD_WORKOUT_LOG'; payload: WorkoutLog }
  | { type: 'UPDATE_WORKOUT_LOG'; payload: WorkoutLog }
  | { type: 'DELETE_WORKOUT_LOG'; payload: string }
  | {
      type: 'UPDATE_DAY';
      payload: { routineId: string; dayId: string; day: WorkoutDay };
    }
  | { type: 'CLEAR_DATA' };
