import type { WorkoutAppData } from '../../types';
import { supabase } from '../supabase';
import { clearOutbox } from '../db';
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
// Los ids van en la URL del filtro `in`: con uuid (36 caracteres) y los de las
// series (`uuid:orden`), 100 por lote deja la petición muy por debajo del límite.
const DELETE_CHUNK = 100;
const PAGE = 1000; // PostgREST no devuelve más de 1000 filas por consulta

async function upsertAll(
  table: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// Ids vivos del usuario en una tabla. Ordenado por id: sin ORDER BY la paginación
// por rangos puede repetir y saltarse filas (el orden no está garantizado).
async function fetchLiveIds(table: string, userId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('user_id', userId)
      .eq('deleted', false)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = data ?? [];
    for (const row of page) ids.push((row as { id: string }).id);
    if (page.length < PAGE) break;
  }
  return ids;
}

// Marca borrado en la nube todo lo que este backup NO sube. Sin esto la copia
// solo crece: las filas que ya no existen en local (series de un entreno
// editado, y sobre todo las series subidas con id aleatorio antes de la Fase 3)
// se quedan vivas y cada restauración las vuelve a bajar, duplicando el
// historial. Tombstone (no DELETE) para que el borrado llegue a los demás
// dispositivos por el pull incremental.
async function tombstoneMissing(
  table: string,
  rows: Record<string, unknown>[],
  userId: string,
  now: number
): Promise<void> {
  const keep = new Set(rows.map((row) => String(row.id)));
  const stale = (await fetchLiveIds(table, userId)).filter(
    (id) => !keep.has(id)
  );
  for (let i = 0; i < stale.length; i += DELETE_CHUNK) {
    const { error } = await supabase
      .from(table)
      .update({ deleted: true, updated_at: now })
      .eq('user_id', userId)
      .in('id', stale.slice(i, i + DELETE_CHUNK));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// Sube TODO el estado local a la nube (adopción del estado anónimo tras crear
// cuenta, o backup manual) y deja la nube como ESPEJO EXACTO de local: upsert de
// lo que hay + tombstone de lo que sobra. Idempotente: reejecutar no duplica.
// Devuelve el instante estampado en las filas (updated_at), para fijar el cursor
// de sync sin volver a bajarse lo recién subido.
export async function backupToCloud(
  data: WorkoutAppData,
  userId: string
): Promise<number> {
  const rows = appDataToRows(data);
  const now = Date.now();
  const own = <T extends object>(r: T): Record<string, unknown> => ({
    ...r,
    user_id: userId,
    updated_at: now,
    deleted: false,
  });

  const tables: [string, Record<string, unknown>[]][] = [
    ['routines', rows.routines.map(own)],
    ['workout_days', rows.workoutDays.map(own)],
    ['exercises', rows.exercises.map(own)],
    ['workout_logs', rows.workoutLogs.map(own)],
    ['exercise_logs', rows.exerciseLogs.map(own)],
    ['log_sets', rows.logSets.map(own)],
    ['cardio_logs', rows.cardioLogs.map(own)],
  ];
  for (const [table, tableRows] of tables) {
    await upsertAll(table, tableRows);
    await tombstoneMissing(table, tableRows, userId, now);
  }

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

  // El snapshot completo ya está en la nube: los deltas pendientes del outbox
  // (historial acumulado, posibles formatos viejos) quedan obsoletos y se
  // descartan para que el sync incremental arranque limpio.
  await clearOutbox();
  return now;
}

// Descarga todo lo del usuario y lo reconstruye como AppData (para reemplazar el
// estado local al restaurar en un dispositivo nuevo). Ignora los tombstones.
export async function restoreFromCloud(
  userId: string
): Promise<WorkoutAppData> {
  // PostgREST limita cada consulta a 1000 filas → hay que PAGINAR o el restore
  // trunca (con semanas de historial, log_sets pasa de 1000 y se pierden series).
  // La paginación va ORDENADA POR ID: sin ORDER BY el orden entre consultas no
  // está garantizado y una misma fila puede caer en dos páginas (duplicando
  // series) mientras otra se pierde. Además, las columnas bigint
  // (created_at/updated_at) llegan como STRING (para no perder precisión); se
  // reconvierten a número o la lógica de semanas se rompe.
  const fetchTable = async (
    table: string
  ): Promise<Record<string, unknown>[]> => {
    const byId = new Map<string, Record<string, unknown>>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .eq('deleted', false)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      const page = data ?? [];
      for (const r of page) {
        byId.set(String(r.id), {
          ...r,
          ...(r.created_at != null ? { created_at: Number(r.created_at) } : {}),
          ...(r.updated_at != null ? { updated_at: Number(r.updated_at) } : {}),
        });
      }
      if (page.length < PAGE) break;
    }
    return [...byId.values()];
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
    settings.push({
      key: SETTING_ACTIVE_ROUTINE_ID,
      value: us.active_routine_id,
    });
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
