# Backend, cuentas y sincronización — GymBro (propuesta)

> **Estado: propuesta de arquitectura. Nada de esto está implementado todavía.**
> Documento vivo. Última revisión: 2026-08-09.

Este documento define cómo GymBro pasaría de app **offline pura** a una app
**offline-first con nube**: base de datos centralizada, login y perfiles,
funciones sociales (seguir usuarios, tablón de rutinas populares) y copia de
seguridad en la nube — sin perder la velocidad de uso que es la prioridad del
proyecto.

Sustituye a las restricciones "no login / no backend / no cloud" que regían
antes (ver [AGENTS.md](../../AGENTS.md)). Esas restricciones se levantan **de
forma controlada y por fases**; este documento es el plan.

**Decisiones ya tomadas:**

- **Backend gestionado: Supabase** (Postgres + Auth + RLS + Storage + Realtime).
  No requiere New Architecture ni tocar el stack móvil.
- **Sincronización: motor artesanal (outbox) sobre la `expo-sqlite` ACTUAL**, en
  RN 0.74 / Expo SDK 51. **Sin subir SDK y sin New Architecture.** Escribimos
  nosotros el push/pull; a cambio, no tocamos la arquitectura de la app.
- **PowerSync queda DESCARTADO** (ver §14). Exigía op-sqlite ^17 → New
  Architecture → que rompía el manejo de toques de la UI de esta app en SDK 52.
  El intento quedó guardado en el tag git `sdk52-newarch-attempt`.

---

## 0. Estado de implementación (2026-08-11)

Rama de trabajo: `0.7-version`. Progreso del epic:

- **Fase 1 — Fundaciones locales — HECHO ✅** (verificado en dispositivo).
  `updated_at` en todas las tablas de dominio + tabla `sync_outbox`; cada
  escritura granular encola su operación en la misma transacción
  (`lib/db/schema.ts`, `lib/db/index.ts`). Ver §4.
- **Fase 2 — Cuentas + backup/restore — HECHO ✅** (verificado: round-trip de
  ~2800 series correcto). Auth email (`lib/cloud/auth.ts`), backup/restore contra
  las tablas espejo (`lib/cloud/backup.ts`), pantalla "Cuenta y nube"
  (`features/workout/CloudScreen.tsx`), cliente (`lib/supabase.ts`), schema de la
  nube (`supabase/schema.sql`). Cuenta opcional. Ver §5.
- **Fase 3 — Sync incremental — HECHO ✅** (verificado con dos dispositivos:
  A→B, B→A, borrado y rutina activa se propagan). Motor propio de push/pull sobre
  el `sync_outbox`
  (`lib/cloud/sync.ts`): el push vacía el outbox a las tablas espejo y el pull baja
  los deltas (`updated_at > cursor`, cursor por dispositivo en AsyncStorage) y los
  aplica al SQLite local sin re-encolarlos (`applyRemoteChanges` en
  `lib/db/index.ts`). Disparos: al iniciar sesión, al volver a primer plano
  (`hooks/useCloudSync.ts`, montado en `app/App.tsx`) y debounced tras cada
  escritura (`schedulePush` desde `lib/persistence.ts`). Reconciliación de hijos
  por parentesco (marcar `deleted` los que ya no están) porque las tablas espejo
  no tienen FKs. `last-write-wins` por `updated_at` (= hora del push). Los ids de
  `log_sets` se hicieron **deterministas** (`exerciseLogId:orden`) para que el
  mismo dato no se duplique en cada push/pull (`lib/db/mappers.ts`). La rutina
  activa/seleccionada se sincroniza vía `user_settings` (encolada en el outbox
  como entidad `settings`). Backup/restore de la Fase 2 se mantienen como
  "Avanzado" y fijan el cursor al terminar (`markSynced`). Ver §6.
- **Fase 4 — Social — PENDIENTE.** Es lo siguiente. Ver §7.

### Cabos sueltos antes de producción

- **Confirmación de email:** en desarrollo la cuenta se creó desde el panel de
  Supabase (atajo). Para producción hay que habilitar la confirmación de email en
  el registro real desde la app, lo que requiere **SMTP propio** (el correo
  integrado de Supabase tiene un límite fijo de ~2 emails/h) o un flujo
  equivalente. La UX de registro de `CloudScreen` asume que se puede entrar tras
  crear la cuenta; revisar al activar la confirmación.
- **Notas técnicas del backup/restore (ya resueltas, no repetir):** PostgREST
  devuelve máx. 1000 filas/consulta → el restore **pagina** con `.range()`; y las
  columnas `bigint` (`created_at`/`updated_at`) llegan como **string** → se
  reconvierten a número. (Ver `lib/cloud/backup.ts`.)
- **Login social (Google/Apple):** se dejó para después (se arrancó con email).
- **Alcance web del sync:** el sync incremental está **desactivado en web** (no
  hay `expo-sqlite` en SDK 51); en web sigue el almacenamiento JSON local. Queda
  por decidir si se lleva el sync a web con otra ruta (§10).

---

## 1. Principios

1. **Offline-first innegociable.** La UI nunca espera a la red. La `expo-sqlite`
   local es la fuente de verdad para leer y escribir; la nube es una **réplica**
   que se reconcilia en segundo plano. Sin conexión, la app funciona igual que hoy.
2. **Velocidad de uso > todo** (principio del proyecto). La nube no puede añadir
   spinners en el camino crítico de registrar una serie.
3. **Cuenta opcional.** La app debe poder usarse sin registrarse, como hoy. El
   login desbloquea backup, multi-dispositivo y lo social; no es un muro.
4. **No tocar la arquitectura de la app.** El sync se construye ALREDEDOR de
   `lib/db` (expo-sqlite), sin cambiar tipos, reducer, pantallas ni el stack
   nativo. Aprovecha dos cosas que ya existen: ids **UUID v4** (`generateId`) y
   **escrituras granulares por acción** (`lib/persistence.ts`).

---

## 2. Stack: Supabase + expo-sqlite + sync artesanal

Tres piezas con roles distintos:

- **Supabase** = el backend en la nube (base de datos central y cuentas).

  | Pieza | Para qué |
  | --- | --- |
  | **Postgres** | Base de datos central. El modelo de GymBro es muy relacional (rutina → días → ejercicios → series; follows, likes), encaja de forma natural. |
  | **Auth** | Login email + Google + Apple. Perfiles. |
  | **Row Level Security (RLS)** | Reglas SQL de quién ve/escribe qué. Base de toda la parte social **sin servidor propio**. |
  | **Storage** | Avatares e imágenes. |
  | **Realtime** | Tablón de populares, notificaciones de seguidores. |

- **expo-sqlite** = la base local que YA usa la app (`lib/db`). No se sustituye.
  Se le añaden metadatos de sincronización (Fase 1).

- **Motor de sync artesanal** = una cola de cambios (`sync_outbox`) + un proceso
  de push/pull que escribimos nosotros contra el cliente `@supabase/supabase-js`.
  Es la pieza con más enjundia (Fase 3), pero es JS puro sobre el stack actual.

### Por qué artesanal y no PowerSync (revisado)

PowerSync habría dado el motor de sync hecho, pero traía **su propia SQLite
nativa** (op-sqlite ^17) que **exige New Architecture**. Migrar esta app a New
Architecture (SDK 51→57) rompió el manejo de toques de su UI (ver §14). El coste
de pelear eso por todo el stack superó con creces el de escribir un motor de sync
modesto. Para datos de gimnasio (poco volumen, un usuario por dispositivo, sin
edición colaborativa) un outbox con *last-write-wins* es más que suficiente.

Alternativas también descartadas: **WatermelonDB** (misma pega: DB propia + New
Arch), **Firebase** (NoSQL, peor encaje relacional), **backend propio**
(sobrecoste enorme para un dev solo).

### Qué vive en este repo

El "backend" versionado en el repo son **migraciones SQL de Supabase + políticas
RLS** (carpeta `supabase/`). El motor de sync vive en `lib/` como el resto de la
lógica. No es un segundo proyecto que arrancar cada día.

---

## 3. Arquitectura de datos

```
┌───────────────────────── Dispositivo (móvil) ──────────────────────────┐
│  Pantallas / Componentes                                                 │
│        ↕ dispatch(action)                                                │
│  WorkoutContext (useReducer)          ← se mantiene igual                │
│        ↕                                                                  │
│  lib/persistence.ts ──► lib/db (expo-sqlite, fuente de verdad local)     │
│        │                                                                  │
│        └──► sync_outbox (cola de cambios pendientes)  ◄── NUEVO          │
│                     │                                                     │
│            SyncEngine (lib/, background)  ◄── NUEVO                       │
│                     ↕ push/pull vía @supabase/supabase-js (solo con red) │
└─────────────────────┼──────────────────────────────────────────────────┘
                       ↕
┌─────────────────────┴──────────────────────────────────────────────────┐
│  Supabase:  Auth · Postgres (modelo + tablas sociales) · RLS · Storage   │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Local**: `expo-sqlite` sin cambios de modelo; solo metadatos de sync.
- **Nube**: Postgres con las mismas tablas de dominio **más** un `user_id` de
  propietario en cada fila, **más** las tablas sociales.
- **Sync**: lo escribimos nosotros (Fase 3), enganchado al `sync_outbox`.

---

## 4. Fase 1 — Fundaciones locales de sync (sin nube)

Objetivo: dejar `expo-sqlite` preparado para sincronizar. **No toca Supabase**;
es refactor local, de bajo riesgo, sobre RN 0.74 (nada de New Arch). Entregable
por sí solo (de cara al usuario no cambia nada visible). Detalle de ejecución en
[backend-fase1-runbook.md](backend-fase1-runbook.md).

- **Metadatos de sync.** Añadir `updated_at INTEGER` a las tablas de dominio que
  no lo tienen (`routines`, `workout_days`, `exercises`, `exercise_logs`,
  `log_sets`, `cardio_logs`); `workout_logs` ya lo tiene. Se actualiza en cada
  escritura granular.
- **Borrado lógico (tombstones).** Hoy el borrado es físico con `ON DELETE
  CASCADE`. Un borrado físico no se puede propagar. Registrar el borrado (en el
  outbox como operación `delete`) para poder replicarlo a la nube y a otros
  dispositivos.
- **Tabla `sync_outbox`**: `{ id, entity, entity_id, op ('upsert'|'delete'),
  payload, updated_at, attempts }`. `lib/persistence.ts` ya traduce cada acción a
  su escritura mínima → el mismo sitio encola en el outbox. **Cero cambios en
  pantallas y reducer.**
- **Migración**: `SCHEMA_VERSION` 3 → 4 en `lib/db/schema.ts` (por
  `PRAGMA user_version`), sin pérdida de datos.
- **Esfuerzo:** medio.

---

## 5. Fase 2 — Auth + copia de seguridad en la nube

Objetivo: cuentas y **backup/restore completo** contra Supabase. Todavía sin sync
incremental fino: subir/bajar el snapshot entero ya da multi-dispositivo y "no
perder los datos si cambio de móvil". Entregable por sí solo.

- **Auth** con Supabase (`@supabase/supabase-js`): email + Google + Apple (*Apple
  obligatorio en la App Store* si hay otro login social).
- Tabla `profiles` (1:1 con Auth): `display_name`, `avatar_url`, `bio`, `is_public`.
- **Cuenta opcional**: la app arranca anónima (como hoy) y ofrece "Crear cuenta /
  Iniciar sesión" desde Perfil.
- **Adopción del estado local anónimo** al crear cuenta: subir el `expo-sqlite`
  existente y asociarlo a `user_id`. Idempotente y reintentable (momento delicado:
  no duplicar, no perder).
- **Esfuerzo:** alto (la migración inicial es lo delicado).

---

## 6. Fase 3 — Sincronización incremental bidireccional (HECHO ✅)

Objetivo: sync fino y continuo. Es la fase con más enjundia técnica (el motor que
antes nos iba a dar PowerSync). Implementado en `lib/cloud/sync.ts`.

- **Push**: `pushOutbox` lee `sync_outbox` en orden de llegada y traduce cada
  entrada (snapshot de la entidad de dominio) a filas de las tablas espejo con los
  mappers; `upsert`/`delete` en Supabase vía `@supabase/supabase-js`. Al confirmar,
  se borran las entradas procesadas del outbox. Se detiene en el primer fallo para
  no perder el orden (reintento en el próximo sync).
- **Pull (delta)**: `pullTable` trae las filas del usuario con
  `updated_at > cursor` (incluidos los tombstones `deleted`), tabla a tabla y
  paginado; `applyRemoteChanges` (`lib/db/index.ts`) las vuelca al SQLite local en
  una transacción **sin re-encolarlas** en el outbox (o rebotarían). Cursor por
  usuario y dispositivo en AsyncStorage.
- **Reconciliación de hijos**: las tablas espejo no tienen FKs, así que un borrado
  de hijos (p. ej. quitar un día o una serie) no viaja como operación propia: al
  subir el padre se marcan `deleted` en la nube los hijos que ya no están
  (`reconcileChildren`). Para que esto funcione, los ids de `log_sets` se hicieron
  **deterministas** (`exerciseLogId:orden`, `lib/db/mappers.ts`): sin id estable,
  cada push generaría filas nuevas y duplicaría las series.
- **Conflictos**: **last-write-wins por `updated_at`**. Decisión explícita:
  `updated_at` en la nube = **hora del push**, no de la edición. Así todo cambio
  queda por encima del cursor de los demás dispositivos y se propaga siempre (a
  costa de que el desempate sea "gana el último en subir"; sobra para un usuario
  con varios dispositivos).
- **Rutina activa/seleccionada**: no es una escritura de dominio, así que se encola
  en el outbox como entidad `settings` y se sincroniza vía la tabla
  `user_settings`.
- **Disparos**: al iniciar sesión y al volver la app a primer plano
  (`hooks/useCloudSync.ts`, montado en `app/App.tsx`, que además refresca el estado
  en memoria si el pull trajo cambios), y debounced tras cada escritura local
  (`schedulePush` invocado desde `lib/persistence.ts`). Un mutex evita solapes.
- **Adopción inicial**: el backup/restore completo de la Fase 2 se mantiene como
  "Avanzado" en `CloudScreen` para sembrar la nube o reemplazar el dispositivo; al
  terminar **vacían el outbox** (`clearOutbox`) y fijan el cursor (`markSynced`),
  para que el incremental parta limpio de ahí. Sin esto, el outbox arrastra todo el
  historial de deltas (posibles formatos viejos) y una entrada corrupta podía
  bloquear la cola detrás de ella.
- **Resiliencia del push**: cada entrada del outbox se sube en su propio try/catch;
  un fallo de red aborta el push sin penalizar (se reintenta con cobertura), y una
  entrada corrupta suma un intento y tras `MAX_OUTBOX_ATTEMPTS` (5) se descarta, sin
  congelar el resto de la cola (`pushOutbox` en `lib/cloud/sync.ts`).
- **Identidad y seguridad**: cada fila lleva `user_id`; **RLS** garantiza que cada
  usuario solo lee/escribe lo suyo (las públicas, en Fase 4).
- **Nota de sync**: no es en tiempo real; el pull ocurre al abrir/volver a primer
  plano, al iniciar sesión o con "Sincronizar ahora". El sync está desactivado en
  web (sin `expo-sqlite`).
- **Esfuerzo:** alto.

---

## 7. Fase 4 — Social

Objetivo: perfiles públicos, seguir usuarios, rutinas públicas y tablón.

### 7.1. Modelo de datos (nube)

| Tabla | Contenido |
| --- | --- |
| `profiles` | Perfil público (ya creado en Fase 2). |
| `follows` | `follower_id` → `following_id`. |
| Visibilidad de rutina | Flag `is_public` + `owner_id` sobre la rutina. |
| `routine_likes` | Likes/guardados; alimentan el ranking. |
| `reports` | Moderación mínima (reportar contenido público). |

- **Tablón de populares** = consulta/vista ordenada por likes recientes.
- **Clonar rutina pública**: copiar una rutina de otro a tu espacio. Reutiliza
  `lib/routines.ts` (duplicar con ids nuevos) — más útil que solo verla.
- **Feed de actividad** (opcional): nuevos seguidores, PRs de a quién sigues.
- **Esfuerzo:** alto.

### 7.2. RLS (esquema)

- Rutina: `SELECT` si `is_public = true` **o** `owner_id = auth.uid()`; escritura
  solo si `owner_id = auth.uid()`.
- `follows`: cada quien gestiona los suyos.
- Contenido público requiere, como mínimo, **botón de reportar** y borrado por
  moderación.

---

## 8. Seguridad, privacidad y tiendas

- **RGPD (España/UE)**: los datos de entrenamiento pueden considerarse datos de
  salud. Obligan a: política de privacidad, consentimiento y **borrado de cuenta
  y datos** desde la propia app (derecho al olvido).
- **Apple**: exige *Sign in with Apple* si hay login social, y **eliminación de
  cuenta in-app**. Sin esto, rechazo en revisión.
- **RLS** es el control de acceso primario; ninguna lógica de permisos vive solo
  en el cliente.

---

## 9. Coste

- **Supabase**: plan gratuito generoso para empezar; coste con volumen de datos,
  ancho de banda y storage. Presupuestar antes de la Fase 4 (lo social multiplica
  lecturas).
- El motor de sync artesanal **no añade coste de terceros** (es código propio).

---

## 10. Alcance web

Hoy la web usa JSON en `localStorage` (expo-sqlite no soporta web en SDK 51). El
`sync_outbox` y el SyncEngine deben contemplar la rama web **o** declararla fuera
del alcance de la primera versión de sync. Decisión abierta (ver §12).

---

## 11. Resumen por fases

| Fase | Entrega | Nube | Esfuerzo |
| --- | --- | --- | --- |
| **1 — Fundaciones locales** | `updated_at` + tombstones + `sync_outbox` en expo-sqlite | No | Medio |
| **2 — Auth + backup** | Login, perfiles, backup/restore completo, multi-dispositivo básico | Sí | Alto |
| **3 — Sync incremental** | Push/pull delta + conflictos (motor propio) | Sí | Alto |
| **4 — Social** | Perfiles públicos, follows, rutinas públicas, tablón, clonar | Sí | Alto |

Cada fase es entregable por sí sola y aporta valor sin depender de la siguiente.

---

## 12. Decisiones abiertas

- **Motor de sync** → ~~decidido: **artesanal (outbox) sobre expo-sqlite**~~
  (cerrado; PowerSync descartado, ver §14).
- **Login opcional u obligatorio** → propuesta: opcional (principio 3). Cerrar
  antes de la Fase 2.
- **Web dentro o fuera** del alcance de sync inicial.
- **Branding social** (nombre de la parte comunitaria, si procede). Fase 4.

---

## 13. Otras ideas que abre este cambio

- **Backup automático** en la nube (resuelve el "perdí el móvil"; hoy depende del
  export JSON manual).
- **Perfil con stats públicas**: racha, PRs, volumen — gamificación social.
- **Retos y rankings entre amigos** (quién sostiene la racha).
- **Modo coach/atleta**: un entrenador asigna rutinas y ve el progreso de sus
  clientes. Encaja de lleno con este backend.
- **Comentarios/reacciones** en rutinas públicas.

---

## 14. Apéndice — Por qué se descartó PowerSync / New Architecture

Se intentó (agosto 2026) la vía PowerSync, que exigía subir Expo SDK 51 → 57 para
tener op-sqlite ^17 y New Architecture. Lo que se aprendió, para no repetirlo:

- El **build nativo** en New Arch se resolvió (ruta sin espacios, Hermes vía New
  Arch, `SoLoader.init` con `OpenSourceMergedSoMapping`, reanimated C++). La app
  **compilaba y arrancaba** en RN 0.76 / New Architecture.
- Pero en New Architecture la app quedaba **con los toques muertos** (todo el
  `dispatch` de toques por la ruta de interop de Fabric se quedaba pillado en
  DOWN). Se descartó gesture-handler, expo-blur y expo-linear-gradient como causa;
  un botón pelado sí respondía. El culpable era algún componente pervasivo del
  stack (probablemente reanimated) rompiendo el touch bajo el interop de New Arch.
- Conclusión: el stack de UI de esta app (glass + reanimated, muy cargado de
  vistas nativas via interop) es **profundamente incompatible con New Architecture
  en SDK 52**, y arreglarlo era un pozo sin fondo con 5 saltos de SDK más por
  delante. El intento quedó en el tag git **`sdk52-newarch-attempt`**.

Si algún día se replantea PowerSync/New Arch, empezar por reproducir el bug de
toques en un SDK más nuevo (RN 0.77+ arregló varios problemas de interop) antes de
volver a migrar.
