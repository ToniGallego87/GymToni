---
description: Code review de GymToni — arquitectura y convenciones del proyecto, seguridad de los datos (cliente y Supabase), integridad del sync, código limpio, rendimiento y plataforma. Por defecto revisa los cambios pendientes; acepta rutas, un rango git o "todo", y "arreglar" para aplicar los hallazgos.
---

Haz un **code review** de **GymToni** (React Native + Expo, repo en `GymToni/`). Trabaja siempre
dentro de `GymToni/`. Esta rúbrica es la **fuente única** de cómo se revisa código en el proyecto:
la usa este comando y el agente `revisor-codigo` (`.claude/agents/revisor-codigo.agent.md`).

Argumento del usuario (puede estar vacío): $ARGUMENTS

## Alcance

Decide qué revisar a partir del argumento:

| Argumento                                         | Qué se revisa                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(vacío)_                                         | Lo pendiente: `git diff HEAD` + archivos sin seguimiento (`git status --porcelain`) + commits locales sin subir (`git log origin/main..HEAD`). Si no hay nada, dilo y ofrece `todo`.                                                                  |
| rutas o carpetas                                  | Esos archivos enteros (no solo un diff).                                                                                                                                                                                                              |
| rango git (`HEAD~3..HEAD`, un hash)               | Los cambios de ese rango.                                                                                                                                                                                                                             |
| `todo`                                            | Auditoría por capas, de más a menos riesgo: `supabase/` y `lib/cloud/` → `lib/db/`, `lib/persistence.ts`, `lib/storage.ts`, `lib/normalize.ts` → resto de `lib/` → `hooks/` → `features/workout/` y `app/` → `components/` → `modules/` y `android/`. |
| `arreglar` (junto a cualquiera de los anteriores) | Además del informe, aplica los arreglos (ver Fase 5).                                                                                                                                                                                                 |

Sin `arreglar` **no se edita nada**: el review informa.

## Fase 0 — Contexto antes de opinar

No juzgues código sin conocer las reglas del proyecto. Lee:

- `AGENTS.md` (restricciones, "Sincronización obligatoria", diseño UI, subida de versión).
- `.github/ARCHITECTURE.md` (capas, flujo de datos, persistencia, nube y modelo de seguridad).
- `.github/CONVENTIONS.md` (naming, patrones obligatorios, lo que NO se hace).
- Si el cambio toca UI: `.github/docs/frontend-design.md`. Si toca nube: `.github/docs/backend-design.md`
  y los `supabase/*.sql` afectados.

Después lee el **diff completo** y cada archivo tocado **entero** (un diff sin su archivo engaña), más
sus **consumidores**: busca con Grep quién importa o llama a lo que ha cambiado. Si el cambio toca un
lado de un par de "Sincronización obligatoria" (`AGENTS.md`), revisa el otro.

## Fase 1 — Comprobaciones automáticas

Ejecuta y apunta el resultado (un fallo es 🔴):

- `npm run type-check`
- `npm test`
- `npx prettier --check <archivos tocados>`

Barridos rápidos sobre los archivos tocados (cada coincidencia hay que mirarla; no todas son fallo):

- Hex sueltos fuera de `lib/theme.ts` / `components/glassTokens.ts`: `#[0-9A-Fa-f]{6}`.
- Fechas en UTC: `toISOString().slice` / `toISOString().split` (la clave de día va con
  `dateKey`/`logDateKey` de `lib/utils.ts`, en el huso del móvil).
- `any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error` nuevos.
- `console.log` nuevos, y `console.*` que saquen email, tokens o contenido del usuario.
- Textos de UI sin `t(...)` (cadenas literales dentro de `<Text>`).
- Claves nuevas de `t()` sin su traducción en `lib/i18n.ts`.

## Fase 2 — Revisión con la rúbrica

Recorre los seis bloques. Ignora un punto que no aplique al cambio; no lo rellenes por cumplir.

### A. Arquitectura y convenciones del proyecto

- **Capas y sentido de las dependencias** (solo hacia abajo):
  `app/App.tsx` (raíz y navegación) → `features/workout/` (pantallas) → `components/`
  (presentación) → `hooks/` → `lib/` → `types/`. `lib/` nunca importa de `components/`,
  `features/` ni `hooks/`; `components/` nunca de `features/`. Única excepción admitida:
  `hooks/useWorkout.ts` lee `WorkoutContext`.
- **Dominio puro en `lib/`**, sin React ni efectos, y con test. Las pantallas pintan, no
  recalculan (p. ej. `weeks.ts` ↔ `HomeScreen`). Lógica de negocio en un componente o pantalla
  → extraer a `lib/`.
- **Estado**: rutinas y logs solo por `WorkoutContext` + reducer, con acción nueva en el
  `WorkoutAction` de `types/index.ts` y su escritura en `lib/persistence.ts`. Una pantalla nunca
  escribe en SQLite directamente. Estado transversal que no es dominio (tema, idioma, sesión,
  descanso, premios) → store de módulo con `useSyncExternalStore` (patrón de `lib/themeStore.ts`
  o `lib/cloud/auth.ts`). Nunca Redux ni librerías de estado.
- **Fuentes únicas**: normalización en `lib/normalize.ts`; fechas con `dateKey`/`getToday`/
  `logDateKey` (`lib/utils.ts`) y su pintado con `weekdayDayMonth`/`shortDayMonth`/`longDate`;
  identidad de ejercicio con `lib/exerciseIdentity.ts` (nunca por id); números con
  `fmtNum`/`localizeDecimals` (`lib/i18n.ts`); textos con `t()`.
- **UI**: lo de `AGENTS.md` → "Diseño UI" y `CONVENTIONS.md` → "Patrones UI compartidos":
  `theme.colors`/`theme.gradients` y `glassTokens`, `makeStyles()` + `subscribeTheme`,
  `AppModal`/`ConfirmModal`/`Button`/`Avatar`/`BarChart`/`SegmentedFilter`/`OptionToggle`/
  `ValueStepper`, título por la prop `icon` de `GlassTopBar`, separación con
  `useGlassTopBarHeight` + `GLASS_TOP_BAR_CONTENT_GAP`, nada escondido tras un long-press, scroll
  vertical que cede el gesto horizontal al pager. Antes de dar por buena una pieza nueva, busca si
  ya existe en `components/`.
- **Navegación**: pantalla nueva = variante del `Screen` en `app/App.tsx` + su caso en el
  `BackHandler`, con el mismo destino que su "Volver" en pantalla. Nada de react-navigation ni de
  pager casero.
- **Módulos nativos**: carga perezosa con `try/catch` y caída visual si el binario no los trae
  (patrón de `components/GlassBlur.tsx` y `lib/pipTimer.ts`).
- **Dependencias nuevas**: solo con justificación (lista y criterio en `CONVENTIONS.md`).
- **Docs**: cambio funcional apuntado en `UPDATES.md` → "Sin publicar"; `ARCHITECTURE.md` /
  `SETUP.md` / `CONVENTIONS.md` al día si cambian estructura, capas o patrones; tarea del
  ROADMAP marcada `[x]`. Si cambia la versión: los cinco sitios de `AGENTS.md`.

### B. Seguridad y privacidad de los datos

Piensa como un atacante con la **anon key** (es pública) y **una cuenta propia**, hablando con la
API REST de Supabase **directamente, sin la app**. La app no protege nada: protegen la RLS, los
`CHECK` y los triggers.

**Nube (Supabase, `supabase/*.sql` y `lib/cloud/`)**

- Toda tabla nueva: `enable row level security` y una policy por operación. Escrituras con
  `with check (user_id = auth.uid())`.
- **Filas mías que cuelgan de algo ajeno.** El `with check` solo mira el `user_id`: puedo crear una
  fila mía con el `routines_id` (o cualquier `*_id`) de otro, porque no hay FKs entre tablas espejo.
  Toda lectura pública de una tabla hija exige que la fila sea **del dueño del padre** (como
  "read public days"), y el cliente filtra además por el autor (como `fetchPublicRoutine`).
- **Lecturas por relación**: solo con consentimiento del dueño. Seguir es unilateral, así que
  "yo le sigo" nunca abre nada privado; "él me sigue", sí.
- **Ids y datos expuestos**: lo que lee una sesión anónima (`user_id` en likes, guardados o
  comentarios) sirve para enumerar cuentas. No abrir más columnas de las que se pintan.
- **Tamaño y volumen**: toda columna de texto que ven otros lleva `CHECK` de longitud (`NOT VALID`
  si ya hay datos). Lo que otros descargan entero (el plan de una rutina pública, el tablón) lleva
  tope de filas (trigger). Los parámetros de límite de una RPC, acotados en el servidor.
- **URLs e imágenes de usuario**: solo del bucket propio (`CHECK` como `profiles_avatar_url_own`).
  Buckets con `file_size_limit` y `allowed_mime_types`.
- **Funciones**: `security invoker` por defecto. `security definer` solo con
  `set search_path = public` y comprobando `auth.uid()` dentro.
- **Datos autodeclarados**: nivel, XP, récords y actividad los calcula el cliente. No pueden dar
  nada con valor (ranking, premio, Pro). Un derecho que dé un pago se decide en el servidor.
- **Secretos**: nunca `service_role` ni claves privadas en el cliente o en git (la anon key sí va).
  Keystore y `keystore.properties` fuera de git.
- **Migraciones**: idempotentes (`if not exists`, `drop policy if exists`, `create or replace`), en
  su `supabase/*.sql` y con nota "SQL pendiente" en `UPDATES.md`. Si la app sube una columna antes
  de que exista en la nube, la columna va en `OPTIONAL_COLUMNS` (`lib/cloud/optionalColumns.ts`).
  Avisa si un `UPDATE`/`DELETE` de la migración toca datos de usuarios.

**Cliente**

- Contenido de terceros (nombres, bios, comentarios, rutinas ajenas) solo como `<Text>`. Nunca
  WebView ni HTML.
- Entradas externas (deep link `gymbro://`, QR, JSON importado, portapapeles, texto pegado): se
  valida la forma y el tamaño, y nunca se guarda sin que el usuario lo confirme
  (`parseRoutineShareLink` → Nueva rutina).
- Logs sin email, tokens ni contenido del usuario.
- Permisos nuevos (manifest, `app.json`) justificados y reflejados en la política de privacidad y
  en Data Safety.
- Recursos remotos (CDN, GitHub) con versión fijada (commit o tag), nunca `@main`: lo que suba
  otro sale en la app.
- `AsyncStorage` solo para datos no sensibles. La sesión la gestiona `supabase-js`.

### C. Integridad de los datos y sync (perder entrenos es lo peor que puede pasar)

- **SQLite**: cambio de esquema = `SCHEMA_VERSION` + 1 y migración **aditiva** en
  `lib/db/schema.ts`; mapper en los dos sentidos (`lib/db/mappers.ts`) y su test.
- **Escrituras** granulares por `persistAction`. `saveAppDataToDb` (reemplazo completo) solo para
  importar, migrar o sembrar.
- **Ids**: filas nuevas con `generateId()` (UUID). Al editar se **conservan** los ids (el historial
  los referencia: `lib/exerciseForm.ts`, `UPDATE_ROUTINE`/`UPDATE_DAY` con upsert).
- **Sync**:
  - Toda escritura que deba subir encola su entrada en `sync_outbox` dentro de la misma
    transacción (`lib/db/index.ts`).
  - Borrar = tombstone (`deleted`), no `delete`.
  - Last-write-wins por `updated_at`.
  - El pull filtra por `user_id`.
  - Las rutinas enlazadas (`linkedOwnerId`) no se suben.
  - Un local vacío nunca vacía la nube (el backup es espejo exacto).
- **Compatibilidad entre versiones**: un móvil con la versión anterior que baja o sube la fila
  nueva no la estropea (precedente: `cardio_logs.raw_input` ↔ `cardio_entries`). Columna nueva sin
  default si NULL debe significar "no lo sé" (`log_sets.is_extra`).

### D. Código limpio y arquitectura limpia (dentro de las restricciones)

En este proyecto "clean architecture" significa: dependencias hacia dentro, dominio puro y
testeable, efectos en los bordes (`lib/db`, `lib/cloud`, hooks, raíz) y una fuente de verdad por
concepto. **No** significa más capas. Repositorios, inyección de dependencias, interfaces con una
sola implementación o helpers de un solo uso están prohibidos (`AGENTS.md`). Señala la
sobreingeniería con la misma dureza que el código enredado.

- Responsabilidad única. Una función o pantalla que crece mezclando cálculo, efectos y pintado se
  divide (el cálculo a `lib/`).
- Duplicación: antes de aceptar algo nuevo, busca si ya existe (`lib/utils.ts`, `lib/i18n.ts`,
  `components/`).
- Nombres: identificadores en inglés; comentarios en español que explican el **porqué**, con la
  densidad del código de alrededor.
- TypeScript estricto: sin `any`, sin `as` innecesarios, null checks explícitos, tipos compartidos
  en `types/index.ts`, uniones discriminadas para estados.
- Asíncrono: errores manejados (aviso al usuario, o fallo silencioso con su porqué comentado), sin
  promesas sueltas, efectos con limpieza (listeners, timers, suscripciones de `AppState`/`Linking`),
  sin `setState` tras desmontar.
- Sin código muerto, imports sin usar ni flags temporales olvidados. Números mágicos → constante con
  nombre y comentario.
- **Escalabilidad**:
  - Consultas a Supabase por lote (`.in(...)`), nunca una por fila, y paginadas (`range`/`limit`).
  - Listas largas virtualizadas.
  - Nada que recorra todo el historial en cada render sin memo o caché (patrón de
    `useExerciseKeyResolver`).
  - Piensa en un usuario con 5 años de entrenos.
- **Tests**: lógica nueva o cambiada en `lib/` → test en `lib/__tests__/`, con casos límite (vacío,
  cambio de semana, medianoche y huso, datos de versiones viejas).

### E. Rendimiento (Android de gama media, MIUI)

- Repintados: las pestañas leen el contexto a través de `TabStateBoundary`. Evitar objetos y
  funciones nuevos en cada render hacia hijos memoizados, y estilos creados en el render.
- Animaciones en el hilo nativo (`useNativeDriver`, reanimated), nunca `setState` por frame.
- GIF: miniatura estática y el GIF animado solo al abrirlo.
- Arranque: nada pesado antes del primer frame (`runWhenQuiet`, carga perezosa de `supabase-js`).
- Cuidado con lo que se pinta bajo las barras de cristal (`GlassBlur` captura la pantalla en cada
  frame).

### F. Plataforma, producto y tiendas

- i18n: textos en ES y EN, números y fechas con el formato del idioma.
- Accesibilidad: `accessibilityRole`/`accessibilityLabel` en lo pulsable que solo lleva icono,
  objetivo táctil ≥ 44 px, contraste en el tema de día y en el de noche.
- Uso con una mano y sin modales de más (`AGENTS.md` → "Diseño UI").
- Funciona sin cuenta y sin red (offline-first).
- **Lista para iOS**: nada exclusivo de Android sin alternativa. Vibraciones con patrón o duración
  (iOS las ignora), `BackHandler` como única salida, inputs que el teclado tapa sin
  `KeyboardAvoidingView`, módulos nativos solo Android.
- **Tiendas**: permisos mínimos; contenido de usuarios con reportar y bloquear; lo que se recoge,
  declarado.

## Fase 3 — Verificar cada hallazgo

Antes de apuntar nada, compruébalo en el código real. Abre el archivo, sigue la llamada y piensa la
entrada concreta que lo rompe. Un hallazgo sin escenario concreto se descarta, o va aparte como
**"a confirmar"** con lo que falta por saber. Nada genérico ("podría mejorarse la legibilidad"):
cada punto cita `ruta/archivo.ts:línea` y dice qué pasa.

## Fase 4 — Informe (en el chat, en español)

1. **Veredicto** en una línea: "Listo para commit", "Arreglar antes de commit" o "No mergear".
2. **Comprobaciones**: type-check, tests y Prettier (✅/❌), con la salida relevante si fallan.
3. **Hallazgos**, de más a menos grave. Gravedad:

   - 🔴 **Bloqueante**: pierde o expone datos, rompe la compilación o los tests, o viola una
     restricción dura de `AGENTS.md`.
   - 🟠 **Importante**: bug probable, convención clave rota o deuda que va a crecer.
   - 🟡 **Mejora**: legibilidad, naming, duplicación pequeña.

   Cada uno con esta forma:

   ```
   🔴 [Seguridad] lib/cloud/social.ts:599 — Título corto
      Qué pasa: entrada/estado concreto → resultado.
      Arreglo: el cambio concreto.
   ```

   Etiquetas: `[Arquitectura]`, `[Seguridad]`, `[Datos]`, `[Limpieza]`, `[Rendimiento]`,
   `[Plataforma]`.

4. **Lo que está bien**: dos o tres líneas, solo si hay algo que merezca la pena mantener como
   ejemplo.
5. **Fuera del alcance**: lo que no revisaste y por qué.
6. Si salen propuestas que no son defectos del cambio (mejoras de producto, deuda de otras zonas),
   no las mezcles: lístalas al final y ofrece integrarlas con `/roadmap`.

Si no hay hallazgos, dilo sin rellenar.

## Fase 5 — Solo con `arreglar`

- Aplica los arreglos 🔴 y 🟠 que sean locales y no tengan duda. Lo que sea decisión de producto o
  de diseño, o cambie el comportamiento visible, **pregúntalo** antes (AskUserQuestion).
- Los 🟡, solo si son triviales y están en archivos que ya tocas.
- SQL contra Supabase: **nunca se ejecuta**. Se escribe en su `supabase/*.sql` y se entrega para
  que el usuario lo lance, marcando si toca datos existentes.
- Después: `npm run type-check`, `npm test`, apuntar en `UPDATES.md` → "Sin publicar" y repetir el
  informe con el estado final de cada hallazgo (arreglado / pendiente / descartado).
