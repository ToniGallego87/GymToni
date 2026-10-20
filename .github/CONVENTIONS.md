# Convenciones — GymBro

## Naming

| Elemento         | Convención            | Ejemplo                    |
| ---------------- | --------------------- | -------------------------- |
| Componentes      | PascalCase            | `ExerciseInputField.tsx`   |
| Hooks            | camelCase con `use`   | `useWorkout.ts`            |
| Archivos lib     | camelCase             | `parsers.ts`, `storage.ts` |
| Tipos/Interfaces | PascalCase            | `WorkoutLog`, `ParsedSet`  |
| Acciones reducer | UPPER_SNAKE_CASE      | `ADD_WORKOUT_LOG`          |
| Props interfaces | PascalCase + Props    | `HeroCardProps`            |
| IDs de filas     | `generateId()` (UUID) | `lib/utils.ts`             |

- Los ids con prefijo (`day1-ex3`, `routine1`) solo quedan en los datos de fábrica
  (`data/seedData.ts`); todo lo nuevo usa `generateId()`, y al editar se conservan los
  ids existentes (el historial los referencia).
- **Idioma**: identificadores en inglés; comentarios en español, explicando el
  porqué; textos de UI siempre por `t()` (ver "Fechas, números y textos").

## Estructura de archivos nuevos

- **Componente UI** → `components/NombreComponente.tsx`
- **Pantalla** → `features/workout/NombreScreen.tsx`
- **Utilidad** → `lib/nombre.ts`
- **Tipo nuevo** → añadir a `types/index.ts` (centralizado)
- **Datos semilla** → `data/nombre.ts`

## Patrones obligatorios

### Estado global

- **Dominio** (rutinas, logs, rutina activa/seleccionada): siempre el `useReducer` de
  `WorkoutContext`. Nuevo estado → nueva acción en la unión `WorkoutAction`
  (`types/index.ts`) y su escritura granular en `lib/persistence.ts`. Una pantalla
  nunca escribe en SQLite directamente.
- **Estado transversal que no es dominio** (tema, idioma, sesión, descanso en
  curso, premios por avisar, peso corporal…): store de módulo con
  `useSyncExternalStore` y una sola suscripción (`lib/themeStore.ts`,
  `lib/cloud/auth.ts`, `lib/restTimerStore.ts`, `lib/awards.ts`). Para un aviso de
  una sola vez entre piezas lejanas basta un canal mínimo (`lib/levelPulse.ts`,
  `lib/themeTransition.ts`).
- Nunca Redux ni librerías externas de estado.

### Capas

Las dependencias van solo hacia abajo: `app/` → `features/workout/` →
`components/` → `hooks/` → `lib/` → `types/`. `lib/` no importa de `components/`,
`features/` ni `hooks/`; `components/` no importa de `features/`. Única excepción:
`hooks/useWorkout.ts` lee `WorkoutContext` (`features/workout/`). Detalle en
[ARCHITECTURE.md](ARCHITECTURE.md#capas-y-dependencias).

### Componentes

- Props tipadas con interface explícita
- Sin lógica de negocio en componentes UI (solo presentación)
- Lógica compleja → extraer a hook o lib

### Imports

- Componentes desde el barrel `@components` (`components/index.ts`); pantallas
  desde `features/workout/index.ts`
- Paths relativos dentro del mismo directorio
- Alias para imports cruzados: `@lib/*`, `@hooks/*`, `@data/*`, `@types/*`,
  `@features/*` y `@components/*` (este último solo para lo que no está en el
  barrel, como `glassTokens`)

### Estilos

- Estilos al final del archivo con el patrón de tema en caliente: una fábrica
  `makeStyles()` que llama a `StyleSheet.create()` leyendo el `theme` vivo, más
  `let styles = makeStyles(); subscribeTheme(() => { styles = makeStyles(); })`
  para recalcularlos al cambiar de tema/idioma sin reiniciar (ver
  `.github/docs/frontend-design.md`)
- Tokens glass compartidos desde `components/glassTokens.ts`
- Colores SIEMPRE desde `theme.colors`; nada de hex sueltos en pantallas/componentes
  (los únicos hex viven en `lib/theme.ts` y `components/glassTokens.ts`)
- Degradados desde `theme.gradients` (`primary`, `success`, `danger`, `warning`, `amber`, `sheen`);
  no duplicar los tríos de color
- Texto/iconos sobre fondo dorado (`primaryFill`/gradientes de oro): siempre `theme.colors.onGold`;
  sobre rellenos sólidos rojo/verde, `theme.colors.onDanger` (ver frontend-design.md)

### Patrones UI compartidos

- Confirmaciones destructivas o de reemplazo → `components/ConfirmModal.tsx`
  (overlay, tarjeta y botones unificados); no montar `Modal` a mano para un confirm
- Título de pantalla → prop `icon` de `GlassTopBar` (icono 18px + texto 20/800);
  `titleElement` solo para casos especiales (logo de Inicio, `DayAccentIcon` del día)
- Botones de acción → `components/Button.tsx` (variants `primary`/`secondary`/`danger`)
- Foto de perfil de un usuario → `components/Avatar.tsx` (solo se le pasa `uri` y
  `size`); no volver a pintar `Image` + marcador a mano en cada pantalla social

## Formato de entrada (parsers)

- Series: `{peso}x{reps}` — ej: `60x8`; la serie extra lleva `*` al final
  (`55x10*`) y `+` suma cargas combinadas. Inverso: `formatSeriesString`
- Cardio: una entrada por disciplina, `{tipo}: {duración}mins, {pace}` — ej:
  `Cinta: 22.5mins, 11.5kmh`; varias entradas se unen con `' | '` en
  `cardio_logs.raw_input`, que convive con `cardio_entries` (una fila por entrada)
  hasta retirarlo (ver ROADMAP)
- Soporta decimales en peso y duración

## Fechas, números y textos

- Clave de día **siempre** con `dateKey` / `getToday` / `logDateKey`
  (`lib/utils.ts`), en el huso del móvil. Nunca `toISOString().slice(0, 10)`: va
  en UTC y un entreno de madrugada cae en el día anterior
- Fecha pintada: `weekdayDayMonth` (la de un entreno), `shortDayMonth`, `longDate`
- Números pintados: `fmtNum` / `localizeDecimals` (`lib/i18n.ts`), con el
  separador decimal del idioma
- Todo texto visible por `t()`, con su traducción en `lib/i18n.ts`

## Nube y seguridad

- Toda tabla nueva en Supabase: RLS activada y una policy por operación; las
  escrituras, `with check (user_id = auth.uid())`
- Lectura pública de una tabla hija: solo filas **del dueño del padre** (no hay FKs
  entre tablas espejo, así que cualquiera puede crear una fila suya colgando de
  algo ajeno). Lectura por relación: solo con consentimiento del dueño; desde
  quien mira, "él me sigue" sí, "yo le sigo" nunca (seguir no pide permiso)
- Lo borrado (tombstones) solo lo lee su dueño
- Texto que ven otros: `CHECK` de longitud; lo que otros descargan entero: tope de
  filas; imágenes: solo del bucket propio, con nombre aleatorio y sin listado
  público
- La app limita antes que la nube: límites del formulario e importación en
  `lib/exerciseForm.ts`, recorte al subir en `lib/cloud/cloudRows.ts` (mismos
  topes que los `CHECK`)
- Lo que calcula el cliente (nivel, XP, récords) es autodeclarado: no da nada con
  valor
- Migraciones idempotentes en `supabase/*.sql`, con nota "SQL pendiente" en
  UPDATES.md hasta ejecutarlas; si la app sube la columna antes de que exista →
  `OPTIONAL_COLUMNS`
- Nunca `service_role` ni secretos en la app o en git; la anon key es pública
- Contenido de terceros solo como `<Text>`; entradas externas (deep link, QR,
  JSON) validadas y nunca guardadas sin confirmación
- Modelo completo en [ARCHITECTURE.md](ARCHITECTURE.md#nube-supabase)

## Módulos nativos

- Locales en `modules/` (autolinked por Expo). Desde JS se cargan **perezosos**
  con `try/catch` y caída si el binario no los trae (`components/GlassBlur.tsx`,
  `lib/pipTimer.ts`, `lib/videoExport.ts`)
- Si solo existen en Android, la rama iOS tiene que hacer algo razonable, no
  romper

## Reglas de código

- TypeScript strict (no `any`, no `as` innecesarios)
- Null checks explícitos (strict null checks habilitado)
- Lógica pura y testeable en `lib/` (`parsers.ts`, `progress.ts`, `weeks.ts`, `cardio.ts`, `achievements.ts`, `utils.ts`); la persistencia (`storage.ts`, `persistence.ts`, `db/`) es la excepción con side effects
- Side effects de UI solo en hooks o Context

## Navegación y pager de pestañas

- Navegación **por estado** en `app/App.tsx` (`setScreen`), no react-navigation.
- Las 5 pestañas principales (`TAB_ORDER`) van en un **`PagerView` nativo**
  (`react-native-pager-view`). **No** reintroducir un pager casero con
  gesture-handler/reanimated: se probó y en MIUI el gesto se colgaba dejando la
  vista a medias (detalle y sync estado↔pager en
  [ARCHITECTURE.md](ARCHITECTURE.md#pager-de-pestañas-nativo)).
- Un scroll vertical dentro de una pestaña debe **ceder el gesto horizontal** al
  pager (patrón de `StretchScrollView`: `activeOffsetY` + `failOffsetX`).

## Lo que NO se hace

- No Redux ni librerías externas de estado
- **UI custom por defecto**: nada de librerías de componentes/estilo externas. Las
  dependencias no-custom que hay, todas justificadas:

  - Comportamiento nativo: `react-native-gesture-handler`,
    `react-native-reanimated`, `react-native-pager-view` (pager de pestañas),
    `react-native-screens`, `react-native-safe-area-context` y
    `react-native-view-shot` (captura para el revelado del tema y el póster/vídeo
    de logros; no pinta nada).
  - Dibujo de bajo nivel: `react-native-svg` (iconos), `react-native-qrcode-svg`
    (QR de compartir rutina) y `expo-linear-gradient` (degradados del tema).
  - Capacidades del sistema: los módulos `expo-*` (SQLite, archivos, imágenes,
    notificaciones, compartir, enlaces…).
  - Almacenamiento clave/valor: `@react-native-async-storage/async-storage`.
  - Web: `react-native-web` y `react-dom` (la versión de navegador, `npm run web`).
  - Nube: `@supabase/supabase-js` y `react-native-url-polyfill` (lo exige
    supabase-js).

  Añadir otra requiere justificarla en UPDATES.md. `expo-blur` se retiró: su
  `BlurView` redibujaba la pantalla entera por instancia y por frame; el cristal
  esmerilado de las barras lo hace `modules/glass-blur` (propio) con UNA captura
  compartida.

- No sobre-abstracciones (si solo se usa una vez, no crear helper)
- Backend/cuentas/sync/social **ya NO están prohibidos**: son el epic de Supabase,
  entregado por fases (offline-first, cuenta opcional). Fuente única del plan:
  [docs/backend-design.md](docs/backend-design.md). No improvisar nube/login fuera
  de ese plan.

## Tests

- Jest (ts-jest) sobre la lógica pura de `lib/`: suites en `lib/__tests__/`
- `npm test` debe pasar antes de cerrar cualquier cambio en `lib/`
- Cambio de esquema o de mappers → su test en `dbMappers`/`dbGranularMappers`;
  cambio en el sync → `syncDropPendingLocal` y compañía
- No se testean componentes UI ni pantallas

## Revisión de código

- `/revisar-codigo` (`.claude/commands/revisar-codigo.md`) es la rúbrica única de
  code review: arquitectura y convenciones, seguridad de los datos, integridad del
  sync, código limpio, rendimiento y plataforma. Sin argumento revisa lo
  pendiente; `arreglar` aplica lo encontrado
- El agente `revisor-codigo` aplica la misma rúbrica en solo lectura y con
  contexto limpio: para revisar un cambio antes de commit sin sesgo del autor
