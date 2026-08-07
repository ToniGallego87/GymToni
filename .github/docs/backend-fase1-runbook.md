# Fase 1 — Runbook de ejecución (Expo SDK upgrade + migración a PowerSync)

> **Estado: preparado, sin ejecutar.** Rama de trabajo: `0.7-version`.
> Complementa a [backend-design.md](backend-design.md) (el *qué/por qué*); este
> doc es el *cómo*, paso a paso. Última revisión: 2026-08-07.

## 0. Constraint y regla de oro

- **Verificar cada paso en un dispositivo/emulador Android.** Nada de esto es
  verificable solo con `type-check`: son módulos nativos y cambios de runtime.
- **No fusionar `0.7-version` a `main` sin verificación en dispositivo.** La rama
  aísla el riesgo; el merge es el punto de no retorno.
- **Punto de partida:** Expo SDK 51 · RN 0.74.5 · React 18 · arquitectura antigua.
- **Destino:** Expo SDK **57** · RN **0.86** · React **19.2** · **New Architecture**.
  Motivo: PowerSync actual exige `@op-engineering/op-sqlite ^17`, que requiere New
  Architecture (estándar desde RN 0.76). En RN 0.74 no encaja.

El trabajo son **dos partes secuenciales**: primero subir el SDK (Parte A),
luego migrar la persistencia (Parte B). La Parte A es entregable por sí sola (la
app en SDK 57, sin PowerSync, sin regresión) y podría ser su propia versión.

---

## Parte A — Subir Expo SDK 51 → 57 (incremental)

Expo recomienda subir **de SDK en SDK**, no de golpe, para localizar cada rotura.
Son 6 saltos: 51→52→53→54→55→56→57.

### Método por salto (repetir en cada uno)

1. `npx expo install expo@<sdk-destino> --fix` (ajusta todas las deps al SDK).
2. Leer el **changelog** del SDK destino, sección *"Deprecations, renamings, and
   removals"*.
3. `npx expo-doctor` y resolver lo que marque.
4. Revisar los parches de **`patch-package`** (`patches/`): tras cada bump pueden
   dejar de aplicar y hay que regenerarlos o retirarlos.
5. `npx expo prebuild --clean` + `expo run:android` → **arrancar en dispositivo**
   y pasar el checklist de no-regresión (abajo).
6. Commit del salto antes de pasar al siguiente (facilita bisecar si algo rompe).

### Puntos calientes específicos de GymBro

- **New Architecture** (por defecto desde SDK 52 / RN 0.76). Afecta a las libs con
  código nativo: `react-native-reanimated` (3.10 → versión con New Arch),
  `react-native-gesture-handler`, `react-native-screens`, `react-native-svg`,
  `react-native-qrcode-svg`.
- **Módulo nativo propio `video-encoder`** (`lib/videoExport.ts`, vídeo de logros):
  es código nativo **nuestro**; hay que portarlo a TurboModules/JSI o confirmar que
  compila bajo New Arch. **Riesgo alto** — es lo más probable que rompa.
- **React 18 → 19** (SDK 53+): revisar tipos, efectos y librerías que dependan de
  la versión de React.
- **`expo-file-system`** cambió de API en SDK 52+: revisar `lib/fileIO.ts`
  (export/import de backup) y `lib/imageShare.ts` / `lib/videoExport.ts`.
- **`expo-notifications`**: API y permisos han evolucionado; revisar el timer de
  descanso (`features/workout/WorkoutLogScreen.tsx`).
- **`expo-sqlite`**: la versión sube con el SDK. Se **mantiene** durante toda la
  Parte A (la capa `lib/db` sigue viva hasta el corte a PowerSync en la Parte B).
- **edge-to-edge / status bar / navigation bar** en Android (SDK 52+): puede
  afectar al diseño edge-to-edge y a `GlassTopBar` / `FloatingPrimaryNav`.
- **`resolutions` en `package.json`** (hoy fijan `react-native` y `react`):
  revisarlas/quitarlas en cada salto; obsoletas rompen el `--fix`.

### Checklist de no-regresión (en dispositivo, cada salto y al final)

Registrar una serie (`60x8`), ver historial y detalle, cardio, crear/editar/
duplicar rutina, compartir rutina por QR, borrar un log, cambiar rutina activa y
seleccionada, backup export/import JSON, vaciar datos, popup de novedades,
cambio de tema, notificación del timer. `npm test` verde, `npm run type-check`
limpio.

---

## Parte B — Migrar la persistencia a PowerSync (con el SDK ya en New Arch)

Solo empieza cuando la Parte A esté verificada. PowerSync trae **su propia SQLite
local** y su **cola de subida**; en la Fase 1 se usa **en local, sin backend
connector** (conectar a Supabase es la Fase 2).

### B.1 Instalación

```
npx expo install @powersync/react-native @op-engineering/op-sqlite @azure/core-asynciterator-polyfill
```
- Añadir el plugin de Babel para *async iterators* e importar el polyfill al
  inicio de la app (`app/App.tsx` o el entry).
- `npx expo prebuild --clean` + rebuild.
- Ojo: durante la migración de datos conviven **op-sqlite** y **expo-sqlite** (dos
  libs SQLite nativas). Verificar que el build no colisiona.

### B.2 AppSchema — espejo de `lib/db/schema.ts`

Definir el schema PowerSync con las mismas 8 tablas: `settings`, `routines`,
`workout_days`, `exercises`, `workout_logs`, `exercise_logs`, `log_sets`,
`cardio_logs`. Notas:
- Los ids siguen siendo **UUID v4** (`generateId`), que hacen de `id` (PK text)
  que PowerSync exige en cada tabla. Encaja sin cambios.
- PowerSync local **no aplica FKs estrictas** como SQLite. No es problema: la
  integridad del plan (CASCADE) **ya la hacemos a mano** en `lib/db/index.ts`
  (porque `withExclusiveTransactionAsync` abría una conexión sin
  `PRAGMA foreign_keys = ON`). Ese patrón de borrado explícito hijo→padre se
  reutiliza tal cual.

### B.3 Cliente PowerSync (local-only)

`PowerSyncDatabase` con el adaptador op-sqlite y el AppSchema. **Sin** backend
connector ni Sync Rules todavía. Sustituye a `getDb()` de `lib/db/index.ts`.

### B.4 Reescribir `lib/db/index.ts` sobre PowerSync

La API SQL de PowerSync es casi idéntica (`execute(sql, params)`, `getAll`,
`getOptional`, `writeTransaction`). Mapeo función a función:

| Hoy (expo-sqlite) | PowerSync |
| --- | --- |
| `getDb()` + migraciones `PRAGMA user_version` | schema/migraciones gestionadas por PowerSync (diff de AppSchema) |
| `loadAppDataFromDb` | `getAll` por tabla → `rowsToAppData` (mappers sin cambios) |
| `saveAppDataToDb` (reemplazo total) | `writeTransaction`: delete-all + insert (import/seed) |
| `clearAppDataInDb` | `writeTransaction`: delete-all + `settings.initialized` |
| `dbUpsertRoutine` / `dbUpdateDay` / `dbDeleteRoutine` | mismas queries SQL dentro de `writeTransaction` |
| `dbUpsertWorkoutLog` / `dbDeleteWorkoutLog` | ídem |
| `dbSetActiveRoutine` / `dbSetSelectedRoutine` | ídem (`settings` upsert/delete) |
| `withExclusiveTransactionAsync` | `db.writeTransaction(async tx => …)` |
| `bulkInsert` (prepared statement) | `execute` en bucle dentro de la transacción o `executeBatch`; vigilar rendimiento en la importación (~3000 filas) |

- **`lib/db/mappers.ts` se conserva** (las filas tienen la misma forma).

### B.5 `storage.ts` y `persistence.ts`

- `storage.ts`: la **rama nativa** (`loadAppDataFromDb` / `saveAppDataToDb` /
  `clearAppDataInDb`) pasa a las nuevas funciones PowerSync (mismas firmas). La
  **rama web** (localStorage) **no se toca** hasta decidir el alcance web
  (backend-design.md §9). `AsyncStorage` para peso de cardio y última versión
  vista **se mantiene** (no es dato de entreno).
- `persistence.ts`: **sin cambios estructurales**. Sigue llamando a
  `dbUpsert*`/`dbSet*` (ahora implementadas sobre PowerSync). Cada escritura queda
  **auto-registrada en la cola de subida** de PowerSync — justo lo que la Fase 2
  necesita para subir a la cuenta.

### B.6 Migración de datos `gymbro.db` → PowerSync

En el primer arranque tras el corte: si la BD de PowerSync está vacía y existe la
`gymbro.db` de expo-sqlite, leerla **una última vez** con expo-sqlite y
**reinsertar cada fila vía la API de escritura de PowerSync** (NO copiar el
fichero). Es imprescindible que entren por la API para que queden **en la cola de
subida** (si no, en la Fase 2 no se subirían a la cuenta). Marcar migrado. Tras
esto, expo-sqlite puede retirarse.

### B.7 Verificación (en dispositivo)

El mismo checklist de no-regresión de la Parte A, más: confirmar que la cola de
subida de PowerSync registra las escrituras (aunque no haya backend conectado).
`npm test` verde (la lógica pura de `lib/` no cambia).

---

## Resumen de riesgos (orden de probabilidad)

1. **Módulo nativo `video-encoder` bajo New Architecture** (Parte A).
2. **Convivencia op-sqlite + expo-sqlite** durante la migración de datos (Parte B.6).
3. **Parches `patch-package`** obsoletos tras los bumps de SDK.
4. **React 19** rompiendo componentes o tipos.
5. `expo-file-system` / `expo-notifications` con API nueva.

## Gating

1. Parte A completa y **verificada en dispositivo** → app en SDK 57 sin regresión
   (candidata a release propia).
2. Parte B sobre esa base, también verificada en dispositivo.
3. Solo entonces, merge de `0.7-version`.
