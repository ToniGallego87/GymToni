# Arquitectura — GymTrack

## Stack

| Capa          | Tecnología                                                       |
| ------------- | ---------------------------------------------------------------- |
| Framework     | React Native + Expo (SDK 51)                                     |
| Lenguaje      | TypeScript strict                                                |
| Estado global | Context API + useReducer                                         |
| Persistencia  | SQLite local (`expo-sqlite`) en nativo; JSON/localStorage en web |
| Navegación    | State-based (sin react-navigation)                               |
| UI            | Componentes custom + sistema glass                               |

## Flujo de datos

```
SQLite (nativo) / localStorage JSON (web)
       ↕ load/save (lib/storage.ts → lib/db/)
normalizeAppData() ← fuente única (lib/normalize.ts)
       ↕
WorkoutContext (Provider + useReducer)
       ↕ dispatch(action)
   useWorkout() hook
       ↕
   Pantallas / Componentes
```

### Ciclo completo

1. `App.tsx` monta `WorkoutProvider`
2. Provider carga datos desde storage (SQLite/web JSON) → `normalizeAppData()` → `SET_APP_DATA`
3. Pantallas consumen estado via `useWorkout()`
4. Acciones del usuario → `dispatch(action)` → reducer actualiza estado
5. El wrapper de `dispatch` (`WorkoutProvider`) persiste cada acción de forma granular via `persistAction()` (`lib/persistence.ts`)

### Principio clave: normalización una sola vez

La función `normalizeAppData()` en `lib/normalize.ts` es la **única fuente de verdad** para:

- Sincronizar flags `isActive` en rutinas (`syncActiveRoutine`)
- Rellenar `parsedSets` desde `rawInput` si faltan (`ensureParsedSets`)
- Resolver `activeRoutineId` con fallback (`resolveActiveRoutineId`)

Tanto `storage.ts` como `WorkoutContext.tsx` usan estas funciones compartidas.

## Tipos principales

```typescript
WorkoutRoutine        // Contiene días y metadata de rutina
  └─ WorkoutDay[]     // 5 días por rutina
       └─ WorkoutExercise[]  // Ejercicios del día

WorkoutLog            // Registro de una sesión completada
  ├─ ExerciseLog[]    // Resultado por ejercicio (series parseadas)
  │    └─ ParsedSet[] // { weight, reps }
  └─ CardioLog?       // Cardio opcional

WorkoutState          // Estado global del reducer
  ├─ routines[]
  ├─ activeRoutineId
  ├─ logs[]
  └─ currentDay?
```

## Acciones del reducer

| Acción               | Efecto                          |
| -------------------- | ------------------------------- |
| `SET_APP_DATA`       | Carga inicial desde storage     |
| `SET_ROUTINES`       | Reemplaza todas las rutinas     |
| `ADD_ROUTINE`        | Añade rutina nueva              |
| `DELETE_ROUTINE`     | Elimina rutina por id           |
| `UPDATE_ROUTINE`     | Actualiza rutina existente      |
| `SET_ACTIVE_ROUTINE` | Cambia rutina activa            |
| `ADD_WORKOUT_LOG`    | Guarda nuevo registro           |
| `UPDATE_WORKOUT_LOG` | Edita registro existente        |
| `DELETE_WORKOUT_LOG` | Elimina registro                |
| `SET_LOGS`           | Reemplaza todos los logs        |
| `UPDATE_DAY`         | Modifica un día de una rutina   |
| `CLEAR_DATA`         | Borra todo                      |
| `SET_CURRENT_DAY`    | Establece día de trabajo actual |

## Estructura de carpetas

```
app/                    → Entry point (index.tsx, App.tsx)
components/             → UI reutilizable (Button, Cards, Inputs, Glass system)
features/workout/       → Pantallas y lógica de negocio
hooks/                  → useWorkout (consumer del context)
lib/                    → Lógica compartida
  ├── normalize.ts      → Fuente única: syncActiveRoutine, ensureParsedSets, normalizeAppData
  ├── storage.ts        → Persistencia (load/save/clear): SQLite en nativo, JSON en web
  ├── persistence.ts    → Mapea cada acción del reducer a su escritura granular (cola serie; debounce en web)
  ├── db/               → Capa SQLite: schema.ts (DDL+migraciones), mappers.ts (AppData↔filas + por entidad), index.ts (repositorio + escrituras granulares)
  ├── fileIO.ts         → Importar/exportar archivos JSON (platform-aware)
  ├── parsers.ts        → Parsers de series y cardio
  ├── progress.ts       → Cálculos de progreso y 1RM
  ├── utils.ts          → Utilidades genéricas (generateId, formatDate, getToday)
  └── theme.ts          → Colores, tipografía, spacing
types/                  → Definiciones TypeScript centralizadas
data/                   → Seed data (rutinas iniciales + logs demo)
```

## Pantallas y navegación

```
HomeScreen
  ├─→ DaySelectorScreen (elegir día)
  │     └─→ WorkoutLogScreen (registrar)
  ├─→ RoutineDetailScreen (ver rutina)
  ├─→ NewRoutineScreen (crear rutina)
  ├─→ CalendarScreen (vista calendario)
  ├─→ DataScreen (exportar/importar/limpiar)
  └─→ DetailScreen (ver log guardado)
```

## Sistema visual (Glass UI)

- Top bar fija con efecto blur (`GlassTopBar`)
- Barra flotante de navegación primaria (`FloatingPrimaryNav`)
- Botón flotante de volver (`FloatingBackButton`)
- Tokens compartidos en `glassTokens.ts` (blur, opacidad, bordes)
- Diseño edge-to-edge en todas las pantallas

## Parsers

```typescript
parseSeriesString('60x8')     → [{ weight: 60, reps: 8 }]
parseCardioString('Cinta: 22.5mins, 11.5kmh')
                              → { type: 'Cinta', duration: 22.5, pace: '11.5kmh' }
```

## Persistencia

- **Nativo**: SQLite (`expo-sqlite`, BD `gymtoni.db`) via `lib/db/`. Esquema relacional:
  - Plan: `routines` → `workout_days` → `exercises` (FK `NOT NULL` + `ON DELETE CASCADE`).
  - Historial: `workout_logs` → `exercise_logs` → `log_sets`, más `cardio_logs` (1:1 con log). Referencias al plan débiles (`ON DELETE SET NULL`) para que el historial sobreviva a cambios de rutina; `exercise_name` es snapshot intencionado.
  - `settings` (clave/valor): `active_routine_id` y la marca `initialized`.
  - Convención FK: nombre de la tabla referenciada + `_id` (p. ej. `workout_days_id`). Ids GUID.
- Migraciones por `PRAGMA user_version` (`lib/db/schema.ts`).
- **Escrituras granulares** (`lib/persistence.ts`): el wrapper de `dispatch` traduce cada acción a su escritura mínima (upsert/borrado de una rutina, día o log; cambio de rutina activa), serializadas en una cola. `UPDATE_ROUTINE`/`UPDATE_DAY` hacen upsert preservando la identidad de rutina y días para no romper (`SET NULL`) las referencias del historial. `saveAppDataToDb` (reemplazo completo en transacción) se reserva para importación, migración legacy y seed inicial.
- Migración legacy: al arrancar, si la BD está vacía y hay JSON del formato anterior en AsyncStorage, se importa y se borran las claves antiguas. En primer arranque sin datos se siembra con los datos de fábrica.
- Vaciar datos deja la BD vacía **e inicializada** (marca `initialized`): las rutinas de fábrica no reaparecen al reiniciar.
- **Web**: JSON en localStorage (expo-sqlite no soporta web en SDK 51), guardado completo con debounce; mismo `storage.ts`/`persistence.ts`, rama por plataforma.
- Importar/exportar: `lib/fileIO.ts` (plataforma web via DOM, nativa via DocumentPicker + Sharing)
