# Arquitectura — GymBro

## Stack

| Capa          | Tecnología                                                       |
| ------------- | ---------------------------------------------------------------- |
| Framework     | React Native + Expo (SDK 51)                                     |
| Lenguaje      | TypeScript strict                                                |
| Estado global | Context API + useReducer                                         |
| Persistencia  | SQLite local (`expo-sqlite`) en nativo; JSON/localStorage en web |
| Navegación    | State-based (sin react-navigation); pager de pestañas nativo (`react-native-pager-view`) |
| Backend        | Supabase (cuentas, sync incremental, social) — opcional, offline-first |
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
  └─ WorkoutDay[]     // 1–7 días por rutina
       └─ WorkoutExercise[]  // Ejercicios del día

WorkoutLog            // Registro de una sesión completada
  ├─ ExerciseLog[]    // Resultado por ejercicio (series parseadas)
  │    └─ ParsedSet[] // { weight, reps }
  └─ CardioLog?       // Cardio opcional

WorkoutState          // Estado global del reducer (= WorkoutAppData)
  ├─ routines[]
  ├─ activeRoutineId
  ├─ selectedRoutineId  // rutina mostrada en Inicio; independiente de la activa
  └─ logs[]
```

## Acciones del reducer

| Acción                 | Efecto                                       |
| ---------------------- | -------------------------------------------- |
| `SET_APP_DATA`         | Carga inicial desde storage                  |
| `ADD_ROUTINE`          | Añade rutina nueva (queda "preparada")       |
| `DELETE_ROUTINE`       | Elimina rutina por id                        |
| `UPDATE_ROUTINE`       | Actualiza rutina existente                   |
| `SET_ACTIVE_ROUTINE`   | Cambia rutina activa                         |
| `SET_SELECTED_ROUTINE` | Cambia la rutina seleccionada (vista Inicio) |
| `ADD_WORKOUT_LOG`      | Guarda nuevo registro                        |
| `UPDATE_WORKOUT_LOG`   | Edita registro existente                     |
| `DELETE_WORKOUT_LOG`   | Elimina registro                             |
| `UPDATE_DAY`           | Modifica un día de una rutina                |
| `CLEAR_DATA`           | Borra todo                                   |

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
  ├── progress.ts       → Cálculos de progreso y 1RM estimado (Epley)
  ├── weeks.ts          → Semanas de entrenamiento: agrupación en bloques, puntuación,
  │                       rachas (computeStreak) y serie de progreso (buildWeekProgress)
  ├── exerciseForm.ts   → Modelo de edición de ejercicios (fila ↔ WorkoutExercise,
  │                       parseo de texto importado). Conserva ids: el historial los referencia
  ├── exerciseProgress.ts → Historial y récords de UN ejercicio (agrupa por NOMBRE:
  │                       el mismo ejercicio tiene otro id en cada rutina)
  ├── routines.ts       → Duplicar una rutina (ids nuevos en rutina/días/ejercicios)
  ├── cardio.ts         → Cardio como experiencia propia: sesiones, semanas ISO, kcal
  ├── achievements.ts   → Logros semanales (récords, rachas)
  ├── routineShare.ts   → Compartir rutina (QR / texto plano)
  ├── imageShare.ts     → Compartir imagen de logros
  ├── videoExport.ts    → Vídeo de logros (módulo nativo video-encoder)
  ├── layoutAnimation.ts→ animateLayout compartido (habilita LayoutAnimation en Android)
  ├── utils.ts          → Utilidades genéricas (generateId, formatDate, getToday)
  └── theme.ts          → Colores, degradados (gradients), tipografía, spacing
lib/__tests__/          → Tests Jest de la lógica pura (npm test)
types/                  → Definiciones TypeScript centralizadas
data/                   → Seed data (rutinas iniciales + logs demo) y changelog.ts
                          (novedades por versión para el popup WhatsNewModal)
```

## Pantallas y navegación

La navegación es **por estado**, no por rutas: `app/App.tsx` mantiene un
`screen: Screen` (unión discriminada) y hace `setScreen(...)`. `TAB_ORDER` define
las 5 pestañas principales; el resto son **subpantallas** que se pintan encima.

```
Pestañas principales (TAB_ORDER, en un pager nativo — ver abajo)
  HomeScreen · CardioScreen · CalendarScreen · CommunityScreen · ProfileScreen

Subpantallas (setScreen; se renderizan opacas encima del pager)
  HomeScreen
    ├─→ DaySelectorScreen → WorkoutLogScreen (registrar)
    ├─→ RoutineSelectorScreen → RoutineDetailScreen (ver/editar, compartir QR)
    ├─→ NewRoutineScreen → QRScannerScreen (importar por QR/texto)
    ├─→ WeekAchievementScreen (imagen/vídeo de logros)
    └─→ DetailScreen (ver log; recuerda origen home/calendar/cardio para volver)
  ProfileScreen
    ├─→ RoutineSelectorScreen · ExerciseProgressScreen
    ├─→ SettingsScreen (tema, idioma, novedades)
    └─→ DataScreen ("Datos y nube": cuenta + sync, copias, importar/restaurar/borrar)
  CommunityScreen (tablón de rutinas públicas)
    ├─→ PublicRoutineScreen (rutina ajena en SOLO lectura + "Añadir a mis rutinas")
    ├─→ UserProfileScreen (perfil ajeno + sus rutinas públicas) →  PublicRoutineScreen
    ├─→ ProfileEditScreen (perfil público propio: foto, bio, público/privado)
    └─→ FollowingScreen (a quién sigo / quién me sigue)

FloatingPrimaryNav = barra inferior fija (las 5 pestañas); cardio se oculta si no
hay ningún cardio registrado. FloatingBackButton = volver en subpantallas.
```

### Pager de pestañas (nativo)

Las 5 pestañas principales viven en un **`PagerView`** (react-native-pager-view /
ViewPager2 nativo) en `app/App.tsx`. Se pasa de una a otra **arrastrando** (sigue
el dedo, estilo Telegram) o tocando la barra.

- **Por qué nativo:** una implementación casera con `react-native-gesture-handler`
  + `reanimated` se descartó porque en MIUI/HyperOS el gesto Pan se quedaba
  "colgado" tras soltar, emitiendo eventos fantasma y dejando la vista a medias.
  El pager nativo gestiona arrastre y asentamiento fuera del hilo JS y es inmune.
- **Sincronización estado ↔ pager:** `onPageSelected` (swipe del usuario) →
  `setScreen`. Cambio de `screen` desde otra fuente (barra, volver de subpantalla)
  → `pagerRef.setPage(tabIndex)` en un efecto. Un guard (`navTargetRef` +
  `pagerPageRef`) ignora los `onPageSelected` de navegaciones programáticas para no
  entrar en bucle pager↔estado con toques rápidos.
- **Transición de barra de duración constante:** como `setPage` va a velocidad
  fija, en saltos de más de una pestaña se salta sin animación a la contigua y se
  anima solo el último tramo.
- **Convivencia con scroll:** `StretchScrollView` (el scroll con rubber-band de
  casi todas las vistas) declara su gesto **solo vertical** (`activeOffsetY` +
  `failOffsetX`) para ceder el arrastre horizontal al pager.
- **Subpantallas:** se renderizan después del pager (encima); opacas a pantalla
  completa, lo tapan. El swipe se desactiva fuera de pestañas (`scrollEnabled`).

## Sistema visual (Glass UI)

- Top bar fija con efecto blur (`GlassTopBar`); el título estándar se declara con
  el prop `icon` (icono 18px + texto 20/800), `titleElement` solo para casos
  especiales (logo de Inicio, icono del día)
- Barra flotante de navegación primaria (`FloatingPrimaryNav`)
- Botón flotante de volver (`FloatingBackButton`)
- Tokens compartidos en `glassTokens.ts` (blur, opacidad, bordes)
- Colores y degradados centralizados en `lib/theme.ts` (`theme.colors`,
  `theme.gradients`); ningún hex suelto en pantallas
- Modal único: `AppModal` (overlay, tarjeta, título con icono, mensaje y pie).
  El cuerpo y los botones los pone quien lo usa, siempre con `Button`.
  `ConfirmModal` es su especialización para confirmar/cancelar
- Gráfica de barras única: `BarChart` (progreso semanal de Inicio y métricas
  mensuales de Cardio); cada pantalla aporta sus barras ya coloreadas y su dominio
- Filtro segmentado único: `SegmentedFilter` (filtro por día de Inicio, métrica
  de Cardio y, en Comunidad, origen del tablón + intensidad de la rutina)
- Foto de perfil única: `Avatar` (tablón, perfil ajeno, perfil propio y listas de
  seguir); solo cambia el diámetro
- Popup de novedades tras actualizar: `WhatsNewModal` (lee `data/changelog.ts`,
  se controla desde `App.tsx` comparando con la última versión vista)
- Diseño edge-to-edge en todas las pantallas
- Guía completa: [docs/frontend-design.md](docs/frontend-design.md)

## Parsers

```typescript
parseSeriesString('60x8')     → [{ weight: 60, reps: 8 }]
parseCardioString('Cinta: 22.5mins, 11.5kmh')
                              → { type: 'Cinta', duration: 22.5, pace: '11.5kmh' }
```

## Persistencia

- **Nativo**: SQLite (`expo-sqlite`, BD `gymbro.db`) via `lib/db/`. Esquema relacional:
  - Plan: `routines` → `workout_days` → `exercises` (FK `NOT NULL` + `ON DELETE CASCADE`).
  - Historial: `workout_logs` → `exercise_logs` → `log_sets`, más `cardio_logs` (1:1 con log). Referencias al plan débiles (`ON DELETE SET NULL`) para que el historial sobreviva a cambios de rutina; `exercise_name` es snapshot intencionado.
  - `settings` (clave/valor): `active_routine_id`, `selected_routine_id` y la marca `initialized`.
  - Convención FK: nombre de la tabla referenciada + `_id` (p. ej. `workout_days_id`). Ids GUID.
- Migraciones por `PRAGMA user_version` (`lib/db/schema.ts`).
- **Escrituras granulares** (`lib/persistence.ts`): el wrapper de `dispatch` traduce cada acción a su escritura mínima (upsert/borrado de una rutina, día o log; cambio de rutina activa), serializadas en una cola. `UPDATE_ROUTINE`/`UPDATE_DAY` hacen upsert preservando la identidad de rutina y días para no romper (`SET NULL`) las referencias del historial. `saveAppDataToDb` (reemplazo completo en transacción) se reserva para importación, migración legacy y seed inicial.
- Migración legacy: al arrancar, si la BD está vacía y hay JSON del formato anterior en AsyncStorage, se importa y se borran las claves antiguas. En primer arranque sin datos se siembra con los datos de fábrica.
- Vaciar datos deja la BD vacía **e inicializada** (marca `initialized`): las rutinas de fábrica no reaparecen al reiniciar.
- **Web**: JSON en localStorage (expo-sqlite no soporta web en SDK 51), guardado completo con debounce; mismo `storage.ts`/`persistence.ts`, rama por plataforma.
- Importar/exportar: `lib/fileIO.ts` (plataforma web via DOM, nativa via DocumentPicker + Sharing)
