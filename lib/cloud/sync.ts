import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutDay, WorkoutLog, WorkoutRoutine } from '../../types';
import { supabase } from '../supabase';
import {
  applyRemoteChanges,
  deleteOutboxEntries,
  getOutboxBatch,
  getPendingOutboxIds,
  incrementOutboxAttempts,
  type OutboxRow,
  type PendingLocalIds,
  type RemoteChanges,
  type RemoteTableChange,
} from '../db';
import { dayToRows, logToRows, routineToRows } from '../db/mappers';

// Motor de sincronización incremental (Fase 3). Push + pull artesanales sobre el
// `sync_outbox` y las tablas espejo de Supabase.
//
//  · PUSH: vacía el outbox → upsert/delete en la nube. Cada fila subida lleva
//    `updated_at = ahora` (hora del PUSH, no de la edición): así cualquier cambio
//    queda por encima del cursor de todos los dispositivos y siempre se propaga.
//    El last-write-wins es, por tanto, "gana el último en subir" (suficiente para
//    datos de gimnasio de un mismo usuario en varios dispositivos).
//  · PULL: baja las filas del usuario con `updated_at > cursor` (incluidos los
//    tombstones `deleted`) y las aplica al SQLite local sin re-encolarlas.
//  · CURSOR: por usuario y dispositivo (AsyncStorage). Avanza al mayor
//    `updated_at` visto.
//
// La integridad relacional no depende de FKs (las tablas espejo no las tienen):
// se reconcilia por parentesco (marcar borrados los hijos que ya no están).

const isWeb = Platform.OS === 'web';
const UPSERT_CHUNK = 500;
// Los ids viajan en la URL (filtro `in`): con uuid (36 caracteres) y los de las
// series (`uuid:orden`), 100 por lote deja la petición lejos del límite de URL.
const DELETE_CHUNK = 100;
const PULL_PAGE = 1000;

type Row = Record<string, unknown>;

export interface SyncResult {
  pushed: number;
  pulled: number;
}

// Un único sync a la vez: el disparo por foreground, por login y el debounced
// tras escribir pueden solaparse. El resto se ignora (ya hay uno en curso).
let running = false;

// ─────────────────────────── Cursor / metadatos ───────────────────────────

const cursorKey = (userId: string) => `gymbro_sync_cursor_${userId}`;
const lastSyncKey = (userId: string) => `gymbro_sync_last_${userId}`;

async function getCursor(userId: string): Promise<number> {
  const raw = await AsyncStorage.getItem(cursorKey(userId));
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

async function setCursor(userId: string, value: number): Promise<void> {
  await AsyncStorage.setItem(cursorKey(userId), String(value));
}

// Tras un backup/restore completo (Fase 2) el cliente ya está al día: se fija el
// cursor a ese instante para que el primer pull incremental no rebaje todo otra vez.
export async function markSynced(userId: string, at: number): Promise<void> {
  await setCursor(userId, at);
  await AsyncStorage.setItem(lastSyncKey(userId), String(at));
}

export async function getLastSync(userId: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(lastSyncKey(userId));
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────── PUSH (local → nube) ───────────────────────────

function own<T extends object>(row: T, userId: string, now: number): Row {
  return { ...row, user_id: userId, updated_at: now, deleted: false };
}

async function cloudUpsert(table: string, rows: Row[]): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + UPSERT_CHUNK));
    if (error) throw new Error(`${table} upsert: ${error.message}`);
  }
}

async function cloudMarkDeleted(
  table: string,
  ids: string[],
  userId: string,
  now: number
): Promise<void> {
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const slice = ids.slice(i, i + DELETE_CHUNK);
    const { error } = await supabase
      .from(table)
      .update({ deleted: true, updated_at: now })
      .eq('user_id', userId)
      .in('id', slice);
    if (error) throw new Error(`${table} delete: ${error.message}`);
  }
}

async function fetchChildIds(
  table: string,
  parentCol: string,
  parentIds: string[],
  userId: string
): Promise<string[]> {
  if (!parentIds.length) return [];
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .eq('deleted', false)
    .in(parentCol, parentIds);
  if (error) throw new Error(`${table} scan: ${error.message}`);
  return (data ?? []).map((r) => (r as { id: string }).id);
}

// Marca borrados en la nube los hijos que ya no existen en local. Devuelve los
// ids realmente eliminados (para propagar el borrado a sus propios hijos).
async function reconcileChildren(
  table: string,
  parentCol: string,
  parentIds: string[],
  keepIds: string[],
  userId: string,
  now: number
): Promise<string[]> {
  const existing = await fetchChildIds(table, parentCol, parentIds, userId);
  const keep = new Set(keepIds);
  const toDelete = existing.filter((id) => !keep.has(id));
  if (toDelete.length) await cloudMarkDeleted(table, toDelete, userId, now);
  return toDelete;
}

async function pushRoutineUpsert(
  routine: WorkoutRoutine,
  userId: string,
  now: number
): Promise<void> {
  const { routine: routineRow, days, exercises } = routineToRows(routine);
  await cloudUpsert('routines', [own(routineRow, userId, now)]);

  const dayIds = days.map((d) => d.id);
  const removedDays = await reconcileChildren(
    'workout_days',
    'routines_id',
    [routine.id],
    dayIds,
    userId,
    now
  );
  if (days.length)
    await cloudUpsert(
      'workout_days',
      days.map((d) => own(d, userId, now))
    );

  // Reconciliar ejercicios: alcance = días vivos + días eliminados (para arrastrar
  // los ejercicios de un día que se borró entero).
  const exerciseScope = [...dayIds, ...removedDays];
  await reconcileChildren(
    'exercises',
    'workout_days_id',
    exerciseScope,
    exercises.map((e) => e.id),
    userId,
    now
  );
  if (exercises.length)
    await cloudUpsert(
      'exercises',
      exercises.map((e) => own(e, userId, now))
    );
}

async function pushRoutineDelete(
  routineId: string,
  userId: string,
  now: number
): Promise<void> {
  // Borrar una rutina arrastra su plan y su historial (igual que en local).
  const dayIds = await fetchChildIds(
    'workout_days',
    'routines_id',
    [routineId],
    userId
  );
  if (dayIds.length) {
    await cloudMarkDeleted('workout_days', dayIds, userId, now);
    const exIds = await fetchChildIds(
      'exercises',
      'workout_days_id',
      dayIds,
      userId
    );
    if (exIds.length) await cloudMarkDeleted('exercises', exIds, userId, now);
  }

  const logIds = await fetchChildIds(
    'workout_logs',
    'routines_id',
    [routineId],
    userId
  );
  if (logIds.length) await markLogsDeleted(logIds, userId, now);

  await cloudMarkDeleted('routines', [routineId], userId, now);
}

async function pushDayUpsert(
  routineId: string,
  day: WorkoutDay,
  userId: string,
  now: number
): Promise<void> {
  const { day: dayRow, exercises } = dayToRows(routineId, day);
  await cloudUpsert('workout_days', [own(dayRow, userId, now)]);
  await reconcileChildren(
    'exercises',
    'workout_days_id',
    [day.id],
    exercises.map((e) => e.id),
    userId,
    now
  );
  if (exercises.length)
    await cloudUpsert(
      'exercises',
      exercises.map((e) => own(e, userId, now))
    );
}

async function pushLogUpsert(
  log: WorkoutLog,
  userId: string,
  now: number
): Promise<void> {
  const { log: logRow, exerciseLogs, logSets, cardio } = logToRows(log);
  await cloudUpsert('workout_logs', [own(logRow, userId, now)]);

  const exLogIds = exerciseLogs.map((e) => e.id);
  const removedExLogs = await reconcileChildren(
    'exercise_logs',
    'workout_logs_id',
    [log.id],
    exLogIds,
    userId,
    now
  );
  if (exerciseLogs.length)
    await cloudUpsert(
      'exercise_logs',
      exerciseLogs.map((e) => own(e, userId, now))
    );

  const setScope = [...exLogIds, ...removedExLogs];
  await reconcileChildren(
    'log_sets',
    'exercise_logs_id',
    setScope,
    logSets.map((s) => s.id),
    userId,
    now
  );
  if (logSets.length)
    await cloudUpsert(
      'log_sets',
      logSets.map((s) => own(s, userId, now))
    );

  await reconcileChildren(
    'cardio_logs',
    'workout_logs_id',
    [log.id],
    cardio ? [cardio.id] : [],
    userId,
    now
  );
  if (cardio) await cloudUpsert('cardio_logs', [own(cardio, userId, now)]);
}

async function markLogsDeleted(
  logIds: string[],
  userId: string,
  now: number
): Promise<void> {
  await cloudMarkDeleted('workout_logs', logIds, userId, now);
  const exLogIds = await fetchChildIds(
    'exercise_logs',
    'workout_logs_id',
    logIds,
    userId
  );
  if (exLogIds.length) {
    await cloudMarkDeleted('exercise_logs', exLogIds, userId, now);
    const setIds = await fetchChildIds(
      'log_sets',
      'exercise_logs_id',
      exLogIds,
      userId
    );
    if (setIds.length) await cloudMarkDeleted('log_sets', setIds, userId, now);
  }
  const cardioIds = await fetchChildIds(
    'cardio_logs',
    'workout_logs_id',
    logIds,
    userId
  );
  if (cardioIds.length)
    await cloudMarkDeleted('cardio_logs', cardioIds, userId, now);
}

async function pushSettings(
  payload: string | null,
  userId: string,
  now: number
): Promise<void> {
  const parsed = payload
    ? (JSON.parse(payload) as {
        active: string | null;
        selected: string | null;
      })
    : { active: null, selected: null };
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    active_routine_id: parsed.active,
    selected_routine_id: parsed.selected,
    updated_at: now,
  });
  if (error) throw new Error(`user_settings: ${error.message}`);
}

async function applyOutboxEntry(
  entry: OutboxRow,
  userId: string,
  now: number
): Promise<void> {
  switch (entry.entity) {
    case 'routine':
      if (entry.op === 'delete')
        return pushRoutineDelete(entry.entity_id, userId, now);
      return pushRoutineUpsert(
        JSON.parse(entry.payload ?? '{}') as WorkoutRoutine,
        userId,
        now
      );
    case 'workout_day': {
      if (entry.op === 'delete') return; // los días se borran vía la rutina
      const { routineId, day } = JSON.parse(entry.payload ?? '{}') as {
        routineId: string;
        day: WorkoutDay;
      };
      return pushDayUpsert(routineId, day, userId, now);
    }
    case 'workout_log':
      if (entry.op === 'delete')
        return markLogsDeleted([entry.entity_id], userId, now);
      return pushLogUpsert(
        JSON.parse(entry.payload ?? '{}') as WorkoutLog,
        userId,
        now
      );
    case 'settings':
      return pushSettings(entry.payload, userId, now);
    default:
      return;
  }
}

const MAX_OUTBOX_ATTEMPTS = 5;

// Un fallo de red no es culpa de la entrada: no debe contar como intento (o
// estar sin cobertura un rato acabaría descartando cambios válidos).
function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /network request failed|fetch failed|timeout|failed to fetch/i.test(
    msg
  );
}

async function pushOutbox(userId: string): Promise<number> {
  const batch = await getOutboxBatch();
  if (!batch.length) return 0;

  const now = Date.now();
  const done: string[] = []; // subidas OK o descartadas (envenenadas)
  const failed: string[] = []; // fallaron por entrada mala → +1 intento
  for (const entry of batch) {
    // Una entrada que agota los reintentos se descarta para no bloquear la cola
    // detrás de ella (un cambio corrupto no debe congelar todo el sync).
    if (entry.attempts >= MAX_OUTBOX_ATTEMPTS) {
      done.push(entry.id);
      continue;
    }
    try {
      await applyOutboxEntry(entry, userId, now);
      done.push(entry.id);
    } catch (e) {
      // Sin red: abortar el push dejando todo pendiente (se reintenta al volver
      // la cobertura), sin penalizar intentos. Entrada mala: contar el intento y
      // seguir con las demás en vez de abortar el push entero.
      if (isNetworkError(e)) break;
      failed.push(entry.id);
    }
  }
  await deleteOutboxEntries(done);
  await incrementOutboxAttempts(failed);
  return done.length;
}

// ─────────────────────────── PULL (nube → local) ───────────────────────────

function coerceRow(r: Row): Row {
  // Las columnas bigint (created_at/updated_at) llegan como STRING para no perder
  // precisión; en local son INTEGER y la lógica de semanas las trata como número.
  const out: Row = { ...r };
  if (r.created_at != null) out.created_at = Number(r.created_at);
  if (r.updated_at != null) out.updated_at = Number(r.updated_at);
  return out;
}

interface PulledTable {
  change: RemoteTableChange;
  maxUpdated: number;
}

async function pullTable(
  table: string,
  userId: string,
  cursor: number
): Promise<PulledTable> {
  const upserts: Row[] = [];
  const deletes: string[] = [];
  let maxUpdated = cursor;

  for (let from = 0; ; from += PULL_PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', cursor)
      // Orden TOTAL (updated_at + id): un push sube muchas filas con el mismo
      // updated_at y, sin desempate, la misma fila podría repetirse entre
      // páginas y otra perderse.
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PULL_PAGE - 1);
    if (error) throw new Error(`${table} pull: ${error.message}`);
    const page = data ?? [];
    for (const raw of page) {
      const row = coerceRow(raw as Row);
      const u = row.updated_at as number;
      if (u > maxUpdated) maxUpdated = u;
      if (row.deleted) deletes.push(row.id as string);
      else upserts.push(row);
    }
    if (page.length < PULL_PAGE) break;
  }

  return { change: { upserts, deletes }, maxUpdated };
}

/**
 * Quita de lo bajado todo lo que tenga un cambio local pendiente de subir.
 *
 * El pull se baja de vuelta las filas que este mismo dispositivo acaba de subir
 * (llevan `updated_at = ahora`, por encima del cursor). Si entre el push y el
 * pull la sesión ha seguido escribiendo —el registro autoguarda serie a serie—,
 * la fila de la nube ya está obsoleta y aplicarla RESUCITA lo que en local ya
 * no está: era el origen de los entrenos duplicados (el día repetido abre semana
 * nueva, ver lib/weeks.ts). Lo mismo si el push corta a medias por falta de red.
 *
 * No se pierde nada: el cambio local sigue en el outbox y el siguiente push lo
 * sube, que es exactamente el last-write-wins de este motor ("gana el último en
 * subir"). Los hijos de un padre saltado se saltan también: si no, el pull
 * reinsertaría los ejercicios y series de la versión vieja del entreno.
 */
export function dropPendingLocal(
  changes: RemoteChanges,
  pending: PendingLocalIds
): RemoteChanges {
  const routineIds = new Set(pending.routines);
  const dayIds = new Set(pending.days);
  const logIds = new Set(pending.logs);
  if (!routineIds.size && !dayIds.size && !logIds.size) return changes;

  const idOf = (row: Row): string => String(row.id ?? '');
  const parentOf = (row: Row, col: string): string => String(row[col] ?? '');

  const skippedDays = new Set<string>();
  const skippedExerciseLogs = new Set<string>();

  const routines: RemoteTableChange = {
    upserts: changes.routines.upserts.filter((r) => !routineIds.has(idOf(r))),
    deletes: changes.routines.deletes.filter((id) => !routineIds.has(id)),
  };

  const workoutDays: RemoteTableChange = {
    upserts: changes.workoutDays.upserts.filter((r) => {
      const skip =
        dayIds.has(idOf(r)) || routineIds.has(parentOf(r, 'routines_id'));
      if (skip) skippedDays.add(idOf(r));
      return !skip;
    }),
    deletes: changes.workoutDays.deletes.filter((id) => !dayIds.has(id)),
  };

  const exercises: RemoteTableChange = {
    upserts: changes.exercises.upserts.filter((r) => {
      const day = parentOf(r, 'workout_days_id');
      return !dayIds.has(day) && !skippedDays.has(day);
    }),
    deletes: changes.exercises.deletes,
  };

  const workoutLogs: RemoteTableChange = {
    upserts: changes.workoutLogs.upserts.filter((r) => !logIds.has(idOf(r))),
    deletes: changes.workoutLogs.deletes.filter((id) => !logIds.has(id)),
  };

  const exerciseLogs: RemoteTableChange = {
    upserts: changes.exerciseLogs.upserts.filter((r) => {
      const skip = logIds.has(parentOf(r, 'workout_logs_id'));
      if (skip) skippedExerciseLogs.add(idOf(r));
      return !skip;
    }),
    deletes: changes.exerciseLogs.deletes,
  };

  const logSets: RemoteTableChange = {
    upserts: changes.logSets.upserts.filter(
      (r) => !skippedExerciseLogs.has(parentOf(r, 'exercise_logs_id'))
    ),
    deletes: changes.logSets.deletes,
  };

  const cardioLogs: RemoteTableChange = {
    upserts: changes.cardioLogs.upserts.filter(
      (r) => !logIds.has(parentOf(r, 'workout_logs_id'))
    ),
    deletes: changes.cardioLogs.deletes,
  };

  return {
    routines,
    workoutDays,
    exercises,
    workoutLogs,
    exerciseLogs,
    logSets,
    cardioLogs,
    settings: changes.settings,
  };
}

function countChanges(changes: RemoteChanges): number {
  const tables: RemoteTableChange[] = [
    changes.routines,
    changes.workoutDays,
    changes.exercises,
    changes.workoutLogs,
    changes.exerciseLogs,
    changes.logSets,
    changes.cardioLogs,
  ];
  return (
    tables.reduce((n, t) => n + t.upserts.length + t.deletes.length, 0) +
    (changes.settings ? 1 : 0)
  );
}

async function pullDelta(
  userId: string,
  cursor: number
): Promise<{ pulled: number; newCursor: number }> {
  const [
    routines,
    workoutDays,
    exercises,
    workoutLogs,
    exerciseLogs,
    logSets,
    cardioLogs,
  ] = await Promise.all([
    pullTable('routines', userId, cursor),
    pullTable('workout_days', userId, cursor),
    pullTable('exercises', userId, cursor),
    pullTable('workout_logs', userId, cursor),
    pullTable('exercise_logs', userId, cursor),
    pullTable('log_sets', userId, cursor),
    pullTable('cardio_logs', userId, cursor),
  ]);

  // Ajustes del usuario (rutina activa/seleccionada): fila única por usuario.
  let settings: RemoteChanges['settings'] = null;
  let settingsUpdated = cursor;
  const { data: us, error: usError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (usError) throw new Error(`user_settings pull: ${usError.message}`);
  if (us && Number(us.updated_at) > cursor) {
    settings = {
      active: (us.active_routine_id as string | null) ?? null,
      selected: (us.selected_routine_id as string | null) ?? null,
    };
    settingsUpdated = Number(us.updated_at);
  }

  const tables = [
    routines,
    workoutDays,
    exercises,
    workoutLogs,
    exerciseLogs,
    logSets,
    cardioLogs,
  ];

  // Lo que el outbox aún no ha subido manda sobre lo que baja la nube.
  const changes = dropPendingLocal(
    {
      routines: routines.change,
      workoutDays: workoutDays.change,
      exercises: exercises.change,
      workoutLogs: workoutLogs.change,
      exerciseLogs: exerciseLogs.change,
      logSets: logSets.change,
      cardioLogs: cardioLogs.change,
      settings,
    },
    await getPendingOutboxIds()
  );

  // Se cuenta DESPUÉS de filtrar: `pulled` decide si la app recarga el estado,
  // y las filas descartadas no cambian nada en local.
  const pulled = countChanges(changes);
  if (pulled > 0) {
    await applyRemoteChanges(changes);
  }

  const newCursor = Math.max(
    cursor,
    settingsUpdated,
    ...tables.map((t) => t.maxUpdated)
  );
  return { pulled, newCursor };
}

// ─────────────────────────── Orquestación ───────────────────────────

// Push + pull. Devuelve cuántos cambios subió y bajó. Si ya hay un sync en
// curso, o estamos en web (sin expo-sqlite), no hace nada.
export async function syncNow(userId: string): Promise<SyncResult> {
  if (isWeb || running) return { pushed: 0, pulled: 0 };
  running = true;
  try {
    const cursor = await getCursor(userId);
    const pushed = await pushOutbox(userId);
    const { pulled, newCursor } = await pullDelta(userId, cursor);
    await setCursor(userId, newCursor);
    await AsyncStorage.setItem(lastSyncKey(userId), String(Date.now()));
    return { pushed, pulled };
  } finally {
    running = false;
  }
}

// ─────────────── Disparo automático tras cada escritura local ───────────────
// persistence.ts no conoce la sesión: registramos el usuario aquí. Tras cada
// escritura se agenda un push (debounced) para no subir en cada pulsación.

let currentUserId: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function registerSyncUser(userId: string | null): void {
  currentUserId = userId;
}

// Solo push (no toca el estado en memoria, así que es seguro llamarlo desde la
// capa de persistencia sin refrescar la UI).
async function pushOnly(userId: string): Promise<void> {
  if (isWeb || running) return;
  running = true;
  try {
    await pushOutbox(userId);
    await AsyncStorage.setItem(lastSyncKey(userId), String(Date.now()));
  } finally {
    running = false;
  }
}

export function schedulePush(): void {
  if (isWeb || !currentUserId) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const uid = currentUserId;
    if (uid) pushOnly(uid).catch(() => {});
  }, 2000);
}
