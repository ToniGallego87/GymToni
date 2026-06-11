export const SCHEMA_VERSION = 1;

// Convención: FK = nombre de la tabla referenciada + _id (p. ej. workout_days_id).
// Plan (routines/workout_days/exercises): integridad estricta, CASCADE.
// Historial (workout_logs/...): referencias débiles (SET NULL) para que
// sobreviva a cambios del plan; exercise_name es snapshot intencionado.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS routines (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  timer_duration INTEGER,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_days (
  id          TEXT PRIMARY KEY,
  routines_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  day_number  INTEGER NOT NULL,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '',
  description TEXT
);

CREATE TABLE IF NOT EXISTS exercises (
  id              TEXT PRIMARY KEY,
  workout_days_id TEXT NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  exercise_order  INTEGER NOT NULL,
  target_reps     TEXT,
  target_sets     INTEGER
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id              TEXT PRIMARY KEY,
  routines_id     TEXT REFERENCES routines(id)     ON DELETE SET NULL,
  workout_days_id TEXT REFERENCES workout_days(id) ON DELETE SET NULL,
  date            TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id              TEXT PRIMARY KEY,
  workout_logs_id TEXT NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercises_id    TEXT,
  exercise_name   TEXT NOT NULL,
  exercise_order  INTEGER NOT NULL,
  raw_input       TEXT NOT NULL DEFAULT '',
  notes           TEXT,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS log_sets (
  id               TEXT PRIMARY KEY,
  exercise_logs_id TEXT NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
  set_order        INTEGER NOT NULL,
  weight           REAL NOT NULL,
  reps             INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cardio_logs (
  id              TEXT PRIMARY KEY,
  workout_logs_id TEXT NOT NULL UNIQUE REFERENCES workout_logs(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  raw_input       TEXT NOT NULL DEFAULT '',
  duration        REAL,
  distance        REAL,
  pace            TEXT,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_days_routine     ON workout_days(routines_id);
CREATE INDEX IF NOT EXISTS idx_exercises_day    ON exercises(workout_days_id);
CREATE INDEX IF NOT EXISTS idx_logs_date        ON workout_logs(date);
CREATE INDEX IF NOT EXISTS idx_logs_routine_day ON workout_logs(routines_id, workout_days_id);
CREATE INDEX IF NOT EXISTS idx_exlogs_log       ON exercise_logs(workout_logs_id);
CREATE INDEX IF NOT EXISTS idx_exlogs_exercise  ON exercise_logs(exercises_id);
CREATE INDEX IF NOT EXISTS idx_sets_exlog       ON log_sets(exercise_logs_id);
`;
