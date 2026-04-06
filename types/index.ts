export interface WorkoutExercise {
  id: string;
  name: string;
  order: number;
  targetReps?: string;
  targetSets?: number;
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
  isCustom?: boolean;
  days: WorkoutDay[];
  createdAt: number;
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
}

export interface WorkoutAppData {
  routines: WorkoutRoutine[];
  activeRoutineId?: string;
  logs: WorkoutLog[];
}

export interface WorkoutState extends WorkoutAppData {
  currentDay?: WorkoutDay;
}

export type WorkoutAction =
  | { type: 'SET_APP_DATA'; payload: WorkoutAppData }
  | { type: 'SET_ROUTINES'; payload: WorkoutRoutine[] }
  | { type: 'ADD_ROUTINE'; payload: WorkoutRoutine }
  | { type: 'DELETE_ROUTINE'; payload: string }
  | { type: 'SET_ACTIVE_ROUTINE'; payload: string }
  | { type: 'ADD_WORKOUT_LOG'; payload: WorkoutLog }
  | { type: 'UPDATE_WORKOUT_LOG'; payload: WorkoutLog }
  | { type: 'DELETE_WORKOUT_LOG'; payload: string }
  | { type: 'SET_LOGS'; payload: WorkoutLog[] }
  | { type: 'UPDATE_DAY'; payload: { routineId: string; dayId: string; day: WorkoutDay } }
  | { type: 'CLEAR_DATA' }
  | { type: 'SET_CURRENT_DAY'; payload: WorkoutDay | undefined };
