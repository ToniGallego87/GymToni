# Fase 1 — Runbook (fundaciones locales de sync sobre expo-sqlite)

> **Estado: entregada en 0.7.0.** Se conserva como referencia del *cómo* se
> montaron las fundaciones de sync. Complementa a
> [backend-design.md](backend-design.md) (el *qué/por qué*). Sin subir SDK, sin
> New Architecture, sobre RN 0.74.
> Última revisión: 2026-08-13.

Objetivo: dejar `expo-sqlite` preparado para sincronizar con la nube (Fases 2-3),
**sin tocar la nube todavía** y sin cambiar tipos, reducer ni pantallas. Es
refactor local de bajo riesgo, verificable con `npm test` y en dispositivo.

## Regla de oro

La UI no cambia. `WorkoutContext`, `useWorkout`, las pantallas y los tipos de
`types/index.ts` quedan **idénticos**. Todo el trabajo vive en `lib/db/` y
`lib/persistence.ts`.

## Pasos

### 1. Metadatos de sync en el schema (`lib/db/schema.ts`)

- Subir `SCHEMA_VERSION` 3 → 4.
- Añadir `updated_at INTEGER NOT NULL DEFAULT 0` a las tablas de dominio que no lo
  tienen: `routines`, `workout_days`, `exercises`, `exercise_logs`, `log_sets`,
  `cardio_logs`. (`workout_logs` ya lo tiene.)
- Nueva tabla:

  ```sql
  CREATE TABLE IF NOT EXISTS sync_outbox (
    id          TEXT PRIMARY KEY,        -- uuid de la entrada de outbox
    entity      TEXT NOT NULL,           -- 'routine' | 'workout_day' | 'exercise' | 'workout_log' | ...
    entity_id   TEXT NOT NULL,           -- id de la fila afectada
    op          TEXT NOT NULL,           -- 'upsert' | 'delete'
    payload     TEXT,                    -- snapshot JSON de la fila (null en delete)
    updated_at  INTEGER NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_outbox_entity ON sync_outbox(entity, entity_id);
  ```

- Migración incremental (BD existentes): `ALTER TABLE ... ADD COLUMN updated_at`
  envuelto en `try/catch` (idempotente, como los ADD COLUMN ya presentes en
  `lib/db/index.ts`), y `CREATE TABLE IF NOT EXISTS sync_outbox`.

### 2. `updated_at` en las escrituras (`lib/db/index.ts` + `lib/db/mappers.ts`)

- Cada upsert (rutina, día, ejercicio, log, sets, cardio) escribe `updated_at =
  Date.now()`.
- `mappers.ts`: mapear la columna nueva en las filas (`RoutineRow`, etc.).
- `loadAppDataFromDb` puede ignorar `updated_at` al construir `WorkoutAppData`
  (los tipos de dominio no lo exponen; es metadato de persistencia).

### 3. Borrado lógico → registrar en el outbox

- El borrado FÍSICO local se mantiene (la app sigue igual de simple). Lo que se
  añade es **registrar un tombstone en `sync_outbox`** (`op = 'delete'`) al borrar
  una rutina o un log, para poder propagar el borrado a la nube en la Fase 3.

### 4. Encolar en el outbox (`lib/persistence.ts`)

- `persistence.ts` ya traduce cada acción del reducer a su escritura granular
  (`dbUpsertRoutine`, `dbDeleteRoutine`, `dbUpsertWorkoutLog`, `dbDeleteWorkoutLog`,
  `dbUpdateDay`, `dbSetActiveRoutine`, `dbSetSelectedRoutine`). En el MISMO punto,
  tras la escritura, encolar la operación equivalente en `sync_outbox`.
- Función nueva en `lib/db/`: `enqueueOutbox(entity, entityId, op, payload)`.
- **Cero cambios** en el wrapper de `dispatch` fuera de esto.

### 5. Verificación

- `npm run type-check` limpio.
- `npm test` verde (la lógica pura de `lib/` no cambia; añadir un test del outbox
  si aplica).
- En dispositivo: crear/editar/borrar rutinas y logs, y comprobar (log temporal o
  una pantalla de debug) que `sync_outbox` acumula las operaciones correctas.
- La app se comporta EXACTAMENTE igual que 0.6.9 de cara al usuario.

## Fuera de alcance de la Fase 1

- Nada de red, Supabase, Auth ni push/pull (eso es Fase 2-3).
- Web: el `sync_outbox` es nativo (expo-sqlite). Decidir en Fase 3 si la web
  entra en el sync (ver backend-design.md §10).
