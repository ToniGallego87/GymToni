import type { WorkoutAppData } from '../../types';
import { supabase } from '../supabase';
import {
  appDataToRows,
  rowsToAppData,
  DbRows,
  RoutineRow,
  WorkoutDayRow,
  ExerciseRow,
  WorkoutLogRow,
  ExerciseLogRow,
  LogSetRow,
  CardioLogRow,
  SETTING_ACTIVE_ROUTINE_ID,
  SETTING_SELECTED_ROUTINE_ID,
  SETTING_INITIALIZED,
} from '../db/mappers';

// Backup/restore completo contra las tablas espejo de Supabase (Fase 2).
// Reutiliza los mappers locales (AppData ↔ filas). A cada fila se le añade
// user_id (propietario, exigido por RLS), updated_at (epoch ms) y deleted=false.

const CHUNK = 500; // upsert por lotes para no pasarse del límite de payload

async function upsertAll(
  table: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// Sube TODO el estado local a la nube (adopción del estado anónimo tras crear
// cuenta, o backup manual). Idempotente: upsert por id, así reejecutar no duplica.
export async function backupToCloud(
  data: WorkoutAppData,
  userId: string
): Promise<void> {
  const rows = appDataToRows(data);
  const now = Date.now();
  const own = <T extends object>(r: T): Record<string, unknown> => ({
    ...r,
    user_id: userId,
    updated_at: now,
    deleted: false,
  });

  await upsertAll('routines', rows.routines.map(own));
  await upsertAll('workout_days', rows.workoutDays.map(own));
  await upsertAll('exercises', rows.exercises.map(own));
  await upsertAll('workout_logs', rows.workoutLogs.map(own));
  await upsertAll('exercise_logs', rows.exerciseLogs.map(own));
  await upsertAll('log_sets', rows.logSets.map(own));
  await upsertAll('cardio_logs', rows.cardioLogs.map(own));

  const active =
    rows.settings.find((s) => s.key === SETTING_ACTIVE_ROUTINE_ID)?.value ??
    null;
  const selected =
    rows.settings.find((s) => s.key === SETTING_SELECTED_ROUTINE_ID)?.value ??
    null;
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    active_routine_id: active,
    selected_routine_id: selected,
    updated_at: now,
  });
  if (error) throw new Error(`user_settings: ${error.message}`);
}

// Descarga todo lo del usuario y lo reconstruye como AppData (para reemplazar el
// estado local al restaurar en un dispositivo nuevo). Ignora los tombstones.
export async function restoreFromCloud(
  userId: string
): Promise<WorkoutAppData> {
  const fetchTable = async (table: string): Promise<Record<string, unknown>[]> => {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('deleted', false);
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ?? [];
  };

  const [
    routines,
    workoutDays,
    exercises,
    workoutLogs,
    exerciseLogs,
    logSets,
    cardioLogs,
  ] = await Promise.all([
    fetchTable('routines'),
    fetchTable('workout_days'),
    fetchTable('exercises'),
    fetchTable('workout_logs'),
    fetchTable('exercise_logs'),
    fetchTable('log_sets'),
    fetchTable('cardio_logs'),
  ]);

  const { data: us } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const settings: { key: string; value: string }[] = [
    { key: SETTING_INITIALIZED, value: '1' },
  ];
  if (us?.active_routine_id)
    settings.push({ key: SETTING_ACTIVE_ROUTINE_ID, value: us.active_routine_id });
  if (us?.selected_routine_id)
    settings.push({
      key: SETTING_SELECTED_ROUTINE_ID,
      value: us.selected_routine_id,
    });

  const rows: DbRows = {
    settings,
    routines: routines as unknown as RoutineRow[],
    workoutDays: workoutDays as unknown as WorkoutDayRow[],
    exercises: exercises as unknown as ExerciseRow[],
    workoutLogs: workoutLogs as unknown as WorkoutLogRow[],
    exerciseLogs: exerciseLogs as unknown as ExerciseLogRow[],
    logSets: logSets as unknown as LogSetRow[],
    cardioLogs: cardioLogs as unknown as CardioLogRow[],
  };
  return rowsToAppData(rows);
}
