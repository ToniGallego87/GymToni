import {
  WorkoutAppData,
  WorkoutDay,
  WorkoutLog,
  WorkoutRoutine,
} from '../../types';
import {
  CardioLogRow,
  DbRows,
  ExerciseLogRow,
  ExerciseRow,
  LogSetRow,
  RoutineRow,
  SETTING_ACTIVE_ROUTINE_ID,
  SETTING_SELECTED_ROUTINE_ID,
  SETTING_INITIALIZED,
  SettingRow,
  WorkoutDayRow,
  WorkoutLogRow,
  appDataToRows,
  dayToRows,
  logToRows,
  routineToRows,
  rowsToAppData,
} from './mappers';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';

type SQLiteDatabase = import('expo-sqlite').SQLiteDatabase;
type SQLiteBindParams = import('expo-sqlite').SQLiteBindParams;
type SQLiteStatement = import('expo-sqlite').SQLiteStatement;

// Subconjunto async común a la BD y al objeto de transacción exclusiva.
interface SQLiteRunner {
  execAsync(source: string): Promise<unknown>;
  runAsync(source: string, params: SQLiteBindParams): Promise<unknown>;
}

// Para inserciones masivas: prepara el statement una vez y lo reutiliza.
interface SQLiteBulkRunner {
  prepareAsync(source: string): Promise<SQLiteStatement>;
}

// Inserta muchas filas reutilizando un ÚNICO prepared statement por tabla.
// La importación completa mueve ~3000 filas: con runAsync (que prepara y
// finaliza un statement por fila) el aluvión de finalize hacía fallar la
// transacción en nativo ("NativeStatement.finalizeAsync()"), abortando la
// importación entera. Un statement por tabla baja de miles de finalize a uno.
async function bulkInsert<T>(
  runner: SQLiteBulkRunner,
  sql: string,
  rows: readonly T[],
  toParams: (row: T) => SQLiteBindParams
): Promise<void> {
  if (!rows.length) {
    return;
  }
  const statement = await runner.prepareAsync(sql);
  try {
    for (const row of rows) {
      await statement.executeAsync(toParams(row));
    }
  } finally {
    await statement.finalizeAsync();
  }
}

const DB_NAME = 'gymbro.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

// require perezoso: en web este módulo puede importarse (storage.ts) pero
// nunca debe ejecutar expo-sqlite, que no está soportado en web en SDK 51.
function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(
        'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;'
      );
      const versionRow = await db.getFirstAsync<{ user_version: number }>(
        'PRAGMA user_version'
      );
      if ((versionRow?.user_version ?? 0) < SCHEMA_VERSION) {
        await db.execAsync(SCHEMA_SQL);
        // Migraciones incrementales para BD ya existentes: SCHEMA_SQL solo crea
        // tablas que faltan (CREATE IF NOT EXISTS), no altera las existentes.
        // ADD COLUMN falla si la columna ya existe (instalación nueva): se
        // ignora ese error para que sea idempotente.
        try {
          await db.execAsync(
            'ALTER TABLE workout_logs ADD COLUMN starts_new_week INTEGER NOT NULL DEFAULT 0'
          );
        } catch {}
        try {
          await db.execAsync(
            'ALTER TABLE workout_logs ADD COLUMN cardio_only INTEGER NOT NULL DEFAULT 0'
          );
        } catch {}
        try {
          await db.execAsync(
            'ALTER TABLE workout_logs ADD COLUMN is_deload INTEGER NOT NULL DEFAULT 0'
          );
        } catch {}
        try {
          await db.execAsync(
            'ALTER TABLE exercises ADD COLUMN catalog_id TEXT'
          );
        } catch {}
        await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      }
      return db;
    })();
  }
  return dbPromise;
}

// --- Inserciones por fila (orden de inserción = orden de dependencia FK) ---

function insertExercise(
  runner: SQLiteRunner,
  row: ExerciseRow
): Promise<unknown> {
  return runner.runAsync(
    'INSERT INTO exercises (id, workout_days_id, name, exercise_order, target_reps, target_sets, catalog_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      row.id,
      row.workout_days_id,
      row.name,
      row.exercise_order,
      row.target_reps,
      row.target_sets,
      row.catalog_id,
    ]
  );
}

function insertWorkoutLog(
  runner: SQLiteRunner,
  row: WorkoutLogRow
): Promise<unknown> {
  return runner.runAsync(
    'INSERT INTO workout_logs (id, routines_id, workout_days_id, date, created_at, updated_at, starts_new_week, cardio_only, is_deload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      row.id,
      row.routines_id,
      row.workout_days_id,
      row.date,
      row.created_at,
      row.updated_at,
      row.starts_new_week,
      row.cardio_only,
      row.is_deload,
    ]
  );
}

function insertExerciseLog(
  runner: SQLiteRunner,
  row: ExerciseLogRow
): Promise<unknown> {
  return runner.runAsync(
    'INSERT INTO exercise_logs (id, workout_logs_id, exercises_id, exercise_name, exercise_order, raw_input, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      row.id,
      row.workout_logs_id,
      row.exercises_id,
      row.exercise_name,
      row.exercise_order,
      row.raw_input,
      row.notes,
      row.created_at,
    ]
  );
}

function insertLogSet(runner: SQLiteRunner, row: LogSetRow): Promise<unknown> {
  return runner.runAsync(
    'INSERT INTO log_sets (id, exercise_logs_id, set_order, weight, reps) VALUES (?, ?, ?, ?, ?)',
    [row.id, row.exercise_logs_id, row.set_order, row.weight, row.reps]
  );
}

function insertCardioLog(
  runner: SQLiteRunner,
  row: CardioLogRow
): Promise<unknown> {
  return runner.runAsync(
    'INSERT INTO cardio_logs (id, workout_logs_id, type, raw_input, duration, distance, pace, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      row.id,
      row.workout_logs_id,
      row.type,
      row.raw_input,
      row.duration,
      row.distance,
      row.pace,
      row.notes,
    ]
  );
}

async function insertLogRows(
  runner: SQLiteRunner,
  log: WorkoutLog
): Promise<void> {
  const rows = logToRows(log);
  await insertWorkoutLog(runner, rows.log);
  for (const exerciseLog of rows.exerciseLogs) {
    await insertExerciseLog(runner, exerciseLog);
  }
  for (const set of rows.logSets) {
    await insertLogSet(runner, set);
  }
  if (rows.cardio) {
    await insertCardioLog(runner, rows.cardio);
  }
}

// --- Lectura ---

export async function loadAppDataFromDb(): Promise<WorkoutAppData | null> {
  const db = await getDb();

  const settings = await db.getAllAsync<SettingRow>(
    'SELECT key, value FROM settings'
  );
  if (!settings.some((setting) => setting.key === SETTING_INITIALIZED)) {
    return null;
  }

  const rows: DbRows = {
    settings,
    routines: await db.getAllAsync<RoutineRow>('SELECT * FROM routines'),
    workoutDays: await db.getAllAsync<WorkoutDayRow>(
      'SELECT * FROM workout_days'
    ),
    exercises: await db.getAllAsync<ExerciseRow>('SELECT * FROM exercises'),
    workoutLogs: await db.getAllAsync<WorkoutLogRow>(
      'SELECT * FROM workout_logs'
    ),
    exerciseLogs: await db.getAllAsync<ExerciseLogRow>(
      'SELECT * FROM exercise_logs'
    ),
    logSets: await db.getAllAsync<LogSetRow>('SELECT * FROM log_sets'),
    cardioLogs: await db.getAllAsync<CardioLogRow>('SELECT * FROM cardio_logs'),
  };

  return rowsToAppData(rows);
}

// --- Escritura completa (importación, migración legacy, seed inicial) ---

export async function saveAppDataToDb(data: WorkoutAppData): Promise<void> {
  const db = await getDb();
  const rows = appDataToRows(data);

  await db.withExclusiveTransactionAsync(async (txn) => {
    // Borrado explícito tabla a tabla (hijos antes que padres). NO depender de
    // ON DELETE CASCADE: withExclusiveTransactionAsync abre una conexión nueva
    // que NO tiene PRAGMA foreign_keys = ON (solo se aplica a la principal en
    // getDb), así que la cascada no se dispara. Si solo borrásemos
    // routines/workout_logs quedarían huérfanos en workout_days/exercises/...
    // y al reinsertar con los mismos IDs saltaría un UNIQUE/PK constraint
    // (que aflora enmascarado como "NativeStatement.finalizeAsync() rejected").
    await txn.execAsync(
      'DELETE FROM cardio_logs;' +
        'DELETE FROM log_sets;' +
        'DELETE FROM exercise_logs;' +
        'DELETE FROM workout_logs;' +
        'DELETE FROM exercises;' +
        'DELETE FROM workout_days;' +
        'DELETE FROM routines;' +
        'DELETE FROM settings;'
    );

    await bulkInsert(
      txn,
      'INSERT INTO settings (key, value) VALUES (?, ?)',
      rows.settings,
      (row) => [row.key, row.value]
    );
    await bulkInsert(
      txn,
      'INSERT INTO routines (id, name, description, timer_duration, created_at) VALUES (?, ?, ?, ?, ?)',
      rows.routines,
      (row) => [
        row.id,
        row.name,
        row.description,
        row.timer_duration,
        row.created_at,
      ]
    );
    await bulkInsert(
      txn,
      'INSERT INTO workout_days (id, routines_id, day_number, name, emoji, description) VALUES (?, ?, ?, ?, ?, ?)',
      rows.workoutDays,
      (row) => [
        row.id,
        row.routines_id,
        row.day_number,
        row.name,
        row.emoji,
        row.description,
      ]
    );
    await bulkInsert(
      txn,
      'INSERT INTO exercises (id, workout_days_id, name, exercise_order, target_reps, target_sets, catalog_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      rows.exercises,
      (row) => [
        row.id,
        row.workout_days_id,
        row.name,
        row.exercise_order,
        row.target_reps,
        row.target_sets,
        row.catalog_id,
      ]
    );
    await bulkInsert(
      txn,
      'INSERT INTO workout_logs (id, routines_id, workout_days_id, date, created_at, updated_at, starts_new_week, cardio_only, is_deload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      rows.workoutLogs,
      (row) => [
        row.id,
        row.routines_id,
        row.workout_days_id,
        row.date,
        row.created_at,
        row.updated_at,
        row.starts_new_week,
        row.cardio_only,
        row.is_deload,
      ]
    );
    await bulkInsert(
      txn,
      'INSERT INTO exercise_logs (id, workout_logs_id, exercises_id, exercise_name, exercise_order, raw_input, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      rows.exerciseLogs,
      (row) => [
        row.id,
        row.workout_logs_id,
        row.exercises_id,
        row.exercise_name,
        row.exercise_order,
        row.raw_input,
        row.notes,
        row.created_at,
      ]
    );
    await bulkInsert(
      txn,
      'INSERT INTO log_sets (id, exercise_logs_id, set_order, weight, reps) VALUES (?, ?, ?, ?, ?)',
      rows.logSets,
      (row) => [
        row.id,
        row.exercise_logs_id,
        row.set_order,
        row.weight,
        row.reps,
      ]
    );
    await bulkInsert(
      txn,
      'INSERT INTO cardio_logs (id, workout_logs_id, type, raw_input, duration, distance, pace, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      rows.cardioLogs,
      (row) => [
        row.id,
        row.workout_logs_id,
        row.type,
        row.raw_input,
        row.duration,
        row.distance,
        row.pace,
        row.notes,
      ]
    );
  });
}

// Deja la BD vacía pero inicializada: tras vaciar, una rutina creada antes de
// reiniciar persiste (la marca initialized impide resucitar la seed).
export async function clearAppDataInDb(): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Borrado explícito: la cascada no aplica en esta conexión (ver saveAppDataToDb).
    await txn.execAsync(
      'DELETE FROM cardio_logs;' +
        'DELETE FROM log_sets;' +
        'DELETE FROM exercise_logs;' +
        'DELETE FROM workout_logs;' +
        'DELETE FROM exercises;' +
        'DELETE FROM workout_days;' +
        'DELETE FROM routines;' +
        'DELETE FROM settings;'
    );
    await txn.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', [
      SETTING_INITIALIZED,
      '1',
    ]);
  });
}

// --- Escrituras granulares (fase 2) ---

// Upsert que preserva la identidad de la rutina y de los días que perduran,
// para no romper (SET NULL) las referencias del historial a ellos. Solo los
// días realmente eliminados nulifican su referencia en los logs.
export async function dbUpsertRoutine(routine: WorkoutRoutine): Promise<void> {
  const db = await getDb();
  const { routine: routineRow, days } = routineToRows(routine);

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO routines (id, name, description, timer_duration, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         timer_duration = excluded.timer_duration,
         created_at = excluded.created_at`,
      [
        routineRow.id,
        routineRow.name,
        routineRow.description,
        routineRow.timer_duration,
        routineRow.created_at,
      ]
    );

    // Eliminar días que ya no existen en la rutina. Sus ejercicios se borran
    // explícitamente antes (sin FK on en esta conexión no hay cascada).
    const keepIds = days.map((day) => day.id);
    if (keepIds.length) {
      const placeholders = keepIds.map(() => '?').join(', ');
      await txn.runAsync(
        `DELETE FROM exercises WHERE workout_days_id IN (
           SELECT id FROM workout_days WHERE routines_id = ? AND id NOT IN (${placeholders}))`,
        [routine.id, ...keepIds]
      );
      await txn.runAsync(
        `DELETE FROM workout_days WHERE routines_id = ? AND id NOT IN (${placeholders})`,
        [routine.id, ...keepIds]
      );
    } else {
      await txn.runAsync(
        'DELETE FROM exercises WHERE workout_days_id IN (SELECT id FROM workout_days WHERE routines_id = ?)',
        [routine.id]
      );
      await txn.runAsync('DELETE FROM workout_days WHERE routines_id = ?', [
        routine.id,
      ]);
    }

    for (const day of routine.days) {
      await upsertDayWithExercises(txn, routine.id, day);
    }
  });
}

async function upsertDayWithExercises(
  runner: SQLiteRunner,
  routineId: string,
  day: WorkoutDay
): Promise<void> {
  const { day: dayRow, exercises } = dayToRows(routineId, day);

  await runner.runAsync(
    `INSERT INTO workout_days (id, routines_id, day_number, name, emoji, description)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       routines_id = excluded.routines_id,
       day_number = excluded.day_number,
       name = excluded.name,
       emoji = excluded.emoji,
       description = excluded.description`,
    [
      dayRow.id,
      dayRow.routines_id,
      dayRow.day_number,
      dayRow.name,
      dayRow.emoji,
      dayRow.description,
    ]
  );

  // Los ejercicios no tienen FK entrante (exercises_id del historial es ref
  // débil), así que se reemplazan en bloque sin efectos colaterales.
  await runner.runAsync('DELETE FROM exercises WHERE workout_days_id = ?', [
    day.id,
  ]);
  for (const exercise of exercises) {
    await insertExercise(runner, exercise);
  }
}

// Borra la rutina y su historial asociado (igual que el reducer).
export async function dbDeleteRoutine(routineId: string): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Borrado explícito de hijos (sin cascada en esta conexión): historial y
    // plan de la rutina, hijos antes que padres.
    await txn.runAsync(
      `DELETE FROM log_sets WHERE exercise_logs_id IN (
         SELECT el.id FROM exercise_logs el
         JOIN workout_logs wl ON el.workout_logs_id = wl.id
         WHERE wl.routines_id = ?)`,
      [routineId]
    );
    await txn.runAsync(
      'DELETE FROM exercise_logs WHERE workout_logs_id IN (SELECT id FROM workout_logs WHERE routines_id = ?)',
      [routineId]
    );
    await txn.runAsync(
      'DELETE FROM cardio_logs WHERE workout_logs_id IN (SELECT id FROM workout_logs WHERE routines_id = ?)',
      [routineId]
    );
    await txn.runAsync('DELETE FROM workout_logs WHERE routines_id = ?', [
      routineId,
    ]);
    await txn.runAsync(
      'DELETE FROM exercises WHERE workout_days_id IN (SELECT id FROM workout_days WHERE routines_id = ?)',
      [routineId]
    );
    await txn.runAsync('DELETE FROM workout_days WHERE routines_id = ?', [
      routineId,
    ]);
    await txn.runAsync('DELETE FROM routines WHERE id = ?', [routineId]);
  });
}

export async function dbUpdateDay(
  routineId: string,
  day: WorkoutDay
): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await upsertDayWithExercises(txn, routineId, day);
  });
}

// Reemplazo atómico de un log: borrar por id (cascade hijos) + reinsertar.
export async function dbUpsertWorkoutLog(log: WorkoutLog): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Borrado explícito de hijos: sin FK on en esta conexión no hay cascada,
    // y reinsertar el log con sus mismos exercise_logs/cardio chocaría en PK.
    await txn.runAsync(
      'DELETE FROM log_sets WHERE exercise_logs_id IN (SELECT id FROM exercise_logs WHERE workout_logs_id = ?)',
      [log.id]
    );
    await txn.runAsync('DELETE FROM exercise_logs WHERE workout_logs_id = ?', [
      log.id,
    ]);
    await txn.runAsync('DELETE FROM cardio_logs WHERE workout_logs_id = ?', [
      log.id,
    ]);
    await txn.runAsync('DELETE FROM workout_logs WHERE id = ?', [log.id]);
    await insertLogRows(txn, log);
  });
}

export async function dbDeleteWorkoutLog(logId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM workout_logs WHERE id = ?', [logId]);
}

export async function dbSetActiveRoutine(
  routineId: string | undefined
): Promise<void> {
  const db = await getDb();
  if (routineId) {
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [SETTING_ACTIVE_ROUTINE_ID, routineId]
    );
  } else {
    await db.runAsync('DELETE FROM settings WHERE key = ?', [
      SETTING_ACTIVE_ROUTINE_ID,
    ]);
  }
}

export async function dbSetSelectedRoutine(
  routineId: string | undefined
): Promise<void> {
  const db = await getDb();
  if (routineId) {
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [SETTING_SELECTED_ROUTINE_ID, routineId]
    );
  } else {
    await db.runAsync('DELETE FROM settings WHERE key = ?', [
      SETTING_SELECTED_ROUTINE_ID,
    ]);
  }
}
