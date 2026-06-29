import {
  CardioLog,
  ExerciseLog,
  WorkoutAppData,
  WorkoutDay,
  WorkoutExercise,
  WorkoutLog,
  WorkoutRoutine,
} from '../../types';
import { generateId } from '../utils';

// Marca que distingue "datos guardados (aunque vacíos)" de "BD virgen".
// Sin ella, borrar todas las rutinas resucitaría las de fábrica al reiniciar.
export const SETTING_INITIALIZED = 'initialized';
export const SETTING_ACTIVE_ROUTINE_ID = 'active_routine_id';

export interface SettingRow {
  key: string;
  value: string;
}

export interface RoutineRow {
  id: string;
  name: string;
  description: string | null;
  timer_duration: number | null;
  created_at: number;
}

export interface WorkoutDayRow {
  id: string;
  routines_id: string;
  day_number: number;
  name: string;
  emoji: string;
  description: string | null;
}

export interface ExerciseRow {
  id: string;
  workout_days_id: string;
  name: string;
  exercise_order: number;
  target_reps: string | null;
  target_sets: number | null;
}

export interface WorkoutLogRow {
  id: string;
  routines_id: string | null;
  workout_days_id: string | null;
  date: string;
  created_at: number;
  updated_at: number;
}

export interface ExerciseLogRow {
  id: string;
  workout_logs_id: string;
  exercises_id: string | null;
  exercise_name: string;
  exercise_order: number;
  raw_input: string;
  notes: string | null;
  created_at: number;
}

export interface LogSetRow {
  id: string;
  exercise_logs_id: string;
  set_order: number;
  weight: number;
  reps: number;
}

export interface CardioLogRow {
  id: string;
  workout_logs_id: string;
  type: string;
  raw_input: string;
  duration: number | null;
  distance: number | null;
  pace: string | null;
  notes: string | null;
}

export interface DbRows {
  settings: SettingRow[];
  routines: RoutineRow[];
  workoutDays: WorkoutDayRow[];
  exercises: ExerciseRow[];
  workoutLogs: WorkoutLogRow[];
  exerciseLogs: ExerciseLogRow[];
  logSets: LogSetRow[];
  cardioLogs: CardioLogRow[];
}

export interface RoutineRows {
  routine: RoutineRow;
  days: WorkoutDayRow[];
  exercises: ExerciseRow[];
}

export interface DayRows {
  day: WorkoutDayRow;
  exercises: ExerciseRow[];
}

export interface LogRows {
  log: WorkoutLogRow;
  exerciseLogs: ExerciseLogRow[];
  logSets: LogSetRow[];
  cardio: CardioLogRow | null;
}

function exerciseToRow(exercise: WorkoutExercise, dayId: string): ExerciseRow {
  return {
    id: exercise.id,
    workout_days_id: dayId,
    name: exercise.name,
    exercise_order: exercise.order,
    target_reps: exercise.targetReps ?? null,
    target_sets: exercise.targetSets ?? null,
  };
}

export function dayToRows(routineId: string, day: WorkoutDay): DayRows {
  return {
    day: {
      id: day.id,
      routines_id: routineId,
      day_number: day.dayNumber,
      name: day.name,
      emoji: day.emoji ?? '',
      description: day.description ?? null,
    },
    exercises: day.exercises.map((exercise) => exerciseToRow(exercise, day.id)),
  };
}

export function routineToRows(routine: WorkoutRoutine): RoutineRows {
  const days: WorkoutDayRow[] = [];
  const exercises: ExerciseRow[] = [];

  for (const day of routine.days) {
    const mapped = dayToRows(routine.id, day);
    days.push(mapped.day);
    exercises.push(...mapped.exercises);
  }

  return {
    routine: {
      id: routine.id,
      name: routine.name,
      description: routine.description ?? null,
      timer_duration: routine.timerDuration ?? null,
      created_at: routine.createdAt,
    },
    days,
    exercises,
  };
}

// FK directas, sin saneado: en escrituras granulares el contexto garantiza que
// la rutina/día/ejercicio referenciados existen. El saneado de referencias
// colgando (datos legacy) lo aplica appDataToRows.
export function logToRows(
  log: WorkoutLog,
  newId: () => string = generateId
): LogRows {
  const exerciseLogs: ExerciseLogRow[] = [];
  const logSets: LogSetRow[] = [];

  for (const exerciseLog of log.exercises) {
    exerciseLogs.push({
      id: exerciseLog.id,
      workout_logs_id: log.id,
      exercises_id: exerciseLog.exerciseId || null,
      exercise_name: exerciseLog.exerciseName,
      exercise_order: exerciseLog.order,
      raw_input: exerciseLog.rawInput ?? '',
      notes: exerciseLog.notes ?? null,
      created_at: exerciseLog.timestamp,
    });

    exerciseLog.parsedSets.forEach((set, index) => {
      logSets.push({
        id: newId(),
        exercise_logs_id: exerciseLog.id,
        set_order: index + 1,
        weight: set.weight,
        reps: set.reps,
      });
    });
  }

  const cardio: CardioLogRow | null = log.cardio
    ? {
        id: log.cardio.id || newId(),
        workout_logs_id: log.id,
        type: log.cardio.type,
        raw_input: log.cardio.rawInput ?? '',
        duration: log.cardio.duration ?? null,
        distance: log.cardio.distance ?? null,
        pace: log.cardio.pace ?? null,
        notes: log.cardio.notes ?? null,
      }
    : null;

  return {
    log: {
      id: log.id,
      routines_id: log.routineId || null,
      workout_days_id: log.dayId || null,
      date: log.date,
      created_at: log.createdAt,
      updated_at: log.updatedAt,
    },
    exerciseLogs,
    logSets,
    cardio,
  };
}

export function appDataToRows(
  data: WorkoutAppData,
  newId: () => string = generateId
): DbRows {
  const rows: DbRows = {
    settings: [{ key: SETTING_INITIALIZED, value: '1' }],
    routines: [],
    workoutDays: [],
    exercises: [],
    workoutLogs: [],
    exerciseLogs: [],
    logSets: [],
    cardioLogs: [],
  };

  if (data.activeRoutineId) {
    rows.settings.push({
      key: SETTING_ACTIVE_ROUTINE_ID,
      value: data.activeRoutineId,
    });
  }

  const routineIds = new Set<string>();
  const dayIds = new Set<string>();
  const exerciseIds = new Set<string>();

  for (const routine of data.routines) {
    const mapped = routineToRows(routine);
    routineIds.add(mapped.routine.id);
    mapped.days.forEach((day) => dayIds.add(day.id));
    mapped.exercises.forEach((exercise) => exerciseIds.add(exercise.id));
    rows.routines.push(mapped.routine);
    rows.workoutDays.push(...mapped.days);
    rows.exercises.push(...mapped.exercises);
  }

  for (const log of data.logs) {
    const mapped = logToRows(log, newId);
    rows.workoutLogs.push(mapped.log);
    rows.exerciseLogs.push(...mapped.exerciseLogs);
    rows.logSets.push(...mapped.logSets);
    if (mapped.cardio) {
      rows.cardioLogs.push(mapped.cardio);
    }
  }

  // Saneado: referencias del historial a rutinas/días/ejercicios ya borrados
  // (datos legacy) → NULL, para no violar las FK al insertar.
  for (const log of rows.workoutLogs) {
    if (log.routines_id && !routineIds.has(log.routines_id)) {
      log.routines_id = null;
    }
    if (log.workout_days_id && !dayIds.has(log.workout_days_id)) {
      log.workout_days_id = null;
    }
  }
  for (const exerciseLog of rows.exerciseLogs) {
    if (
      exerciseLog.exercises_id &&
      !exerciseIds.has(exerciseLog.exercises_id)
    ) {
      exerciseLog.exercises_id = null;
    }
  }

  return rows;
}

function byNumber<T>(select: (item: T) => number): (a: T, b: T) => number {
  return (a, b) => select(a) - select(b);
}

export function rowsToAppData(rows: DbRows): WorkoutAppData {
  const activeRoutineId = rows.settings.find(
    (setting) => setting.key === SETTING_ACTIVE_ROUTINE_ID
  )?.value;

  const exercisesByDay = new Map<string, WorkoutExercise[]>();
  for (const row of [...rows.exercises].sort(
    byNumber((r) => r.exercise_order)
  )) {
    const exercise: WorkoutExercise = {
      id: row.id,
      name: row.name,
      order: row.exercise_order,
      targetReps: row.target_reps ?? undefined,
      targetSets: row.target_sets ?? undefined,
    };
    const list = exercisesByDay.get(row.workout_days_id) ?? [];
    list.push(exercise);
    exercisesByDay.set(row.workout_days_id, list);
  }

  const daysByRoutine = new Map<string, WorkoutDay[]>();
  for (const row of [...rows.workoutDays].sort(byNumber((r) => r.day_number))) {
    const day: WorkoutDay = {
      id: row.id,
      dayNumber: row.day_number,
      name: row.name,
      emoji: row.emoji,
      description: row.description ?? undefined,
      exercises: exercisesByDay.get(row.id) ?? [],
    };
    const list = daysByRoutine.get(row.routines_id) ?? [];
    list.push(day);
    daysByRoutine.set(row.routines_id, list);
  }

  const routines: WorkoutRoutine[] = [...rows.routines]
    .sort(byNumber((r) => r.created_at))
    .map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      isActive: row.id === activeRoutineId,
      days: daysByRoutine.get(row.id) ?? [],
      createdAt: row.created_at,
      timerDuration: row.timer_duration ?? undefined,
    }));

  const setsByExerciseLog = new Map<string, LogSetRow[]>();
  for (const row of [...rows.logSets].sort(byNumber((r) => r.set_order))) {
    const list = setsByExerciseLog.get(row.exercise_logs_id) ?? [];
    list.push(row);
    setsByExerciseLog.set(row.exercise_logs_id, list);
  }

  const exerciseLogsByLog = new Map<string, ExerciseLog[]>();
  for (const row of [...rows.exerciseLogs].sort(
    byNumber((r) => r.exercise_order)
  )) {
    const exerciseLog: ExerciseLog = {
      id: row.id,
      exerciseId: row.exercises_id ?? '',
      exerciseName: row.exercise_name,
      order: row.exercise_order,
      rawInput: row.raw_input,
      parsedSets: (setsByExerciseLog.get(row.id) ?? []).map((set) => ({
        weight: set.weight,
        reps: set.reps,
      })),
      notes: row.notes ?? undefined,
      timestamp: row.created_at,
    };
    const list = exerciseLogsByLog.get(row.workout_logs_id) ?? [];
    list.push(exerciseLog);
    exerciseLogsByLog.set(row.workout_logs_id, list);
  }

  const cardioByLog = new Map<string, CardioLog>();
  for (const row of rows.cardioLogs) {
    cardioByLog.set(row.workout_logs_id, {
      id: row.id,
      type: row.type,
      rawInput: row.raw_input,
      duration: row.duration ?? undefined,
      distance: row.distance ?? undefined,
      pace: row.pace ?? undefined,
      notes: row.notes ?? undefined,
    });
  }

  const logs: WorkoutLog[] = [...rows.workoutLogs]
    .sort(byNumber((r) => r.created_at))
    .map((row) => ({
      id: row.id,
      routineId: row.routines_id ?? '',
      dayId: row.workout_days_id ?? '',
      date: row.date,
      exercises: exerciseLogsByLog.get(row.id) ?? [],
      cardio: cardioByLog.get(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

  return { routines, activeRoutineId, logs };
}
