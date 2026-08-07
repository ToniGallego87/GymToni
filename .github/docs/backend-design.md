# Backend, cuentas y sincronización — GymBro (propuesta)

> **Estado: propuesta de arquitectura. Nada de esto está implementado todavía.**
> Documento vivo. Última revisión: 2026-08-07.

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
- **Capa de sincronización offline-first: PowerSync**, que trae su propia SQLite
  local y su motor de sync bidireccional contra Supabase. Esto **reemplaza** la
  actual capa `lib/db` (expo-sqlite) y nos ahorra escribir el motor de sync a
  mano (ver §2 y §4).

---

## 1. Principios

1. **Offline-first innegociable.** La UI nunca espera a la red. La SQLite local
   (la de PowerSync) es la fuente de verdad para leer y escribir; la nube es una
   **réplica** que se reconcilia en segundo plano. Sin conexión, la app funciona
   igual que hoy.
2. **Velocidad de uso > todo** (principio del proyecto). La nube no puede añadir
   spinners en el camino crítico de registrar una serie. PowerSync lee y escribe
   local justo por esto.
3. **Cuenta opcional.** La app debe poder usarse sin registrarse, como hoy. El
   login desbloquea backup, multi-dispositivo y lo social; no es un muro.
4. **No reinventar el motor de sync.** Escribir sincronización bidireccional con
   resolución de conflictos a mano, en solitario, es la trampa clásica. PowerSync
   la resuelve; a cambio, adoptamos su capa local (coste asumido en la Fase 1).

---

## 2. Stack: Supabase + PowerSync

Dos piezas con roles distintos:

- **Supabase** = el backend en la nube (la base de datos centralizada y las
  cuentas).

  | Pieza | Para qué |
  | --- | --- |
  | **Postgres** | Base de datos central. El modelo de GymBro es muy relacional (rutina → días → ejercicios → series; follows, likes), encaja de forma natural. |
  | **Auth** | Login email + Google + Apple. Perfiles. |
  | **Row Level Security (RLS)** | Reglas SQL de quién ve/escribe qué. Base de toda la parte social **sin servidor propio**. |
  | **Storage** | Avatares e imágenes. |
  | **Realtime** | Tablón de populares, notificaciones de seguidores. |

- **PowerSync** = la capa de sincronización offline-first entre el móvil y
  Supabase. Mantiene una **SQLite embebida en el cliente** que se sincroniza
  automáticamente con Postgres; las escrituras se guardan local **y** en una
  **cola de subida** que se procesa vía el cliente de Supabase cuando hay red.
  Las **Sync Rules** definen qué subconjunto de datos (los del usuario, las
  rutinas públicas…) se replica a cada cliente.

### Por qué PowerSync y no un outbox artesanal

Se evaluó construir la sincronización a mano sobre la `expo-sqlite` actual
(añadir `updated_at`, tombstones y una tabla `sync_outbox`, y escribir push/pull
+ resolución de conflictos). Se descartó: el motor de sync bidireccional es la
parte más difícil y arriesgada del proyecto y PowerSync la da hecha. El coste de
PowerSync —adoptar su capa local en vez de `lib/db`, una dependencia con build
nativo (ya lo tenemos: `android/` + `expo run:android`, no Expo Go) y su modelo
de precios— se consideró menor que mantener un motor propio en solitario.

Alternativas descartadas: **WatermelonDB** (buena DB local, pero el push/pull lo
escribes tú), **Firebase** (NoSQL, peor encaje relacional), **backend propio**
(sobrecoste enorme para un dev solo).

### Qué vive en este repo

El "backend" versionado en el repo son **migraciones SQL de Supabase + políticas
RLS + las Sync Rules de PowerSync** (carpeta `supabase/` y config de PowerSync).
No es un segundo proyecto que arrancar cada día.

---

## 3. Arquitectura de datos

```
┌───────────────────────── Dispositivo (móvil) ──────────────────────────┐
│                                                                          │
│  Pantallas / Componentes                                                 │
│        ↕ dispatch(action)                                                │
│  WorkoutContext (useReducer)          ← se mantiene igual                │
│        ↕                                                                  │
│  Capa de persistencia  ──►  PowerSync SDK (SQLite local + cola de subida)│
│        (lib/db reescrito sobre PowerSync; fuente de verdad local)        │
└───────────────────────┼──────────────────────────────────────────────────┘
                         ↕  PowerSync Service (sync bidireccional, solo con red)
┌───────────────────────┴──────────────────────────────────────────────────┐
│  Supabase:  Auth · Postgres (modelo + tablas sociales) · RLS · Storage    │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Local**: SQLite de PowerSync. El modelo de dominio (rutinas, días,
  ejercicios, logs…) se conserva; cambia la capa que lo persiste, no los tipos ni
  el reducer ni las pantallas.
- **Nube**: Postgres con las mismas tablas de dominio **más** un `user_id` de
  propietario en cada fila, **más** las tablas sociales.
- **Sync**: lo hace PowerSync. No escribimos motor de reconciliación.

---

## 4. Fase 1 — Migrar la capa local a PowerSync (sin nube)

> **Prerrequisito descubierto:** PowerSync actual exige
> `@op-engineering/op-sqlite ^17`, que requiere **New Architecture** (estándar
> desde RN 0.76). El proyecto está en **Expo SDK 51 / RN 0.74** (arquitectura
> antigua), así que la Fase 1 arranca **subiendo Expo SDK 51 → 57** (RN 0.86,
> React 19.2) antes de instalar PowerSync. Es una migración en sí misma (6 saltos
> incrementales + New Arch + React 19) y **exige verificar cada paso en un
> dispositivo/emulador**. Pasos detallados en
> [backend-fase1-runbook.md](backend-fase1-runbook.md).

Objetivo (tras el upgrade de SDK): sustituir `lib/db` (expo-sqlite) por la SQLite de PowerSync,
funcionando **100% local y sin backend conectado**. Es el mayor trozo de código
del epic, pero se hace **sin nube**: la app sigue siendo offline pura y se puede
verificar sin regresiones antes de añadir la complejidad de la red. Entregable
por sí solo (aunque de cara al usuario no cambia nada visible).

- Integrar el SDK de PowerSync (`@powersync/react-native`) y definir el **schema
  local** de PowerSync equivalente al actual (`lib/db/schema.ts`).
- Reapuntar las lecturas/escrituras a la API de PowerSync: `lib/db/index.ts`
  (repositorio), `lib/db/mappers.ts`, `lib/persistence.ts` y `lib/storage.ts`.
  El contrato hacia `WorkoutContext`/pantallas no cambia.
- **Migración de datos existentes**: importar el contenido de la `gymbro.db`
  actual a la SQLite de PowerSync en el primer arranque tras actualizar. Ojo: los
  datos deben quedar **en la cola de subida** de PowerSync para que en la Fase 2,
  al conectar, se suban a la cuenta (no basta con insertarlos "por debajo").
- Sin `updated_at`/tombstones/`sync_outbox` manuales: PowerSync gestiona su
  propio versionado y cola de cambios.
- **Esfuerzo:** alto (toca toda la persistencia). Riesgo controlado por ser local
  y verificable con los tests de `lib/` y pruebas manuales.

---

## 5. Fase 2 — Cuentas y conexión a la nube (backup + multi-dispositivo + sync)

Objetivo: conectar PowerSync a Supabase y añadir login. Al conectar, el **sync
bidireccional incremental viene incluido** — por eso esta fase absorbe lo que en
el plan artesanal habrían sido dos fases (backup y sync fino). Entregable por sí
solo.

### 5.1. Auth

- Supabase Auth con **email + Google + Apple**. *Apple es obligatorio en la App
  Store* si se ofrece cualquier otro login social.
- Tabla `profiles` (1:1 con el usuario de Auth): `display_name`, `avatar_url`,
  `bio`, `is_public`.
- **Cuenta opcional**: la app arranca en modo anónimo (como hoy) y ofrece "Crear
  cuenta / Iniciar sesión" desde Perfil.

### 5.2. Conexión PowerSync ↔ Supabase

- **Backend connector**: sube la cola de PowerSync a Supabase autenticado como el
  usuario, y aplica los datos que bajan.
- **Sync Rules**: definen qué filas se replican a cada cliente (las del usuario;
  más adelante, las rutinas públicas para el tablón).
- **Resolución de conflictos**: PowerSync es **servidor-autoritativo**; el
  conflicto se resuelve en el backend connector / Postgres. Por defecto
  *last-write-wins*, configurable. Para datos de gimnasio sobra.

### 5.3. Adopción del usuario anónimo

Al crear cuenta por primera vez, los datos locales (anónimos, ya en PowerSync
desde la Fase 1) se suben y se asocian a `user_id`. Debe ser idempotente y
reintentable: es el momento más delicado (no duplicar, no perder).

### 5.4. Impacto en la app

- Nuevos estados no bloqueantes: `sincronizando`, `sin conexión`, `error de
  sync` — siempre fuera del camino crítico.
- El flujo actual (sin cuenta) sigue intacto.
- **Esfuerzo:** alto.

---

## 6. Fase 3 — Social

Objetivo: perfiles públicos, seguir usuarios, rutinas públicas y tablón de
populares.

### 6.1. Modelo de datos (nube)

| Tabla | Contenido |
| --- | --- |
| `profiles` | Perfil público (ya creado en Fase 2). |
| `follows` | `follower_id` → `following_id`. |
| Visibilidad de rutina | Flag `is_public` + `owner_id` sobre la rutina. |
| `routine_likes` | Likes/guardados; alimentan el ranking. |
| `reports` | Moderación mínima (reportar contenido público). |

- **Tablón de populares** = consulta/vista ordenada por likes recientes. Las
  rutinas públicas se replican al cliente vía Sync Rules de PowerSync.
- **Clonar rutina pública**: copiar una rutina de otro a tu espacio. Reutiliza
  `lib/routines.ts` (duplicar con ids nuevos) — más útil que solo verla.
- **Feed de actividad** (opcional): nuevos seguidores, PRs de a quién sigues.
- **Esfuerzo:** alto.

### 6.2. RLS (esquema)

- Rutina: `SELECT` si `is_public = true` **o** `owner_id = auth.uid()`;
  escritura solo si `owner_id = auth.uid()`.
- `follows`: cada quien gestiona los suyos.
- Contenido público requiere, como mínimo, **botón de reportar** y borrado por
  moderación.

---

## 7. Seguridad, privacidad y tiendas

- **RGPD (España/UE)**: los datos de entrenamiento pueden considerarse datos de
  salud. Obligan a: política de privacidad, consentimiento y **borrado de cuenta
  y datos** desde la propia app (derecho al olvido).
- **Apple**: exige *Sign in with Apple* si hay login social, y **eliminación de
  cuenta in-app**. Sin esto, rechazo en revisión.
- **RLS** es el control de acceso primario; ninguna lógica de permisos vive solo
  en el cliente.

---

## 8. Coste

- **Supabase**: plan gratuito generoso para empezar; coste con volumen de datos,
  ancho de banda y storage.
- **PowerSync**: free tier (2 GB de datos sincronizados/mes, 50 conexiones
  concurrentes), luego planes de pago por datos sincronizados y conexiones;
  alternativa **self-host Open Edition gratuita** (motor de sync + Sync Rules +
  SDKs). Presupuestar antes de la Fase 3 (lo social multiplica lecturas).

---

## 9. Alcance web

Hoy la web usa JSON en `localStorage` (expo-sqlite no soporta web en SDK 51).
PowerSync **sí tiene SDK web**, así que a futuro podría unificar web y nativo
bajo el mismo motor — pero portar la web a PowerSync es trabajo extra. Decisión
abierta: portar la web a PowerSync o dejarla fuera del alcance de sync inicial
(ver §11).

---

## 10. Resumen por fases

| Fase | Entrega | Nube | Esfuerzo |
| --- | --- | --- | --- |
| **1 — Migrar a PowerSync (local)** | Persistencia sobre PowerSync, 100% offline, sin regresiones | No | Alto |
| **2 — Cuentas + conexión a la nube** | Login, backup, multi-dispositivo y sync incremental (todo junto vía PowerSync) | Sí | Alto |
| **3 — Social** | Perfiles públicos, follows, rutinas públicas, tablón, clonar | Sí | Alto |

PowerSync colapsa el antiguo "backup" + "sync fino" en una sola fase: al conectar
el cliente a Supabase, la sincronización bidireccional ya está.

---

## 11. Decisiones abiertas

- **Motor de sync** → ~~decidido: **PowerSync**~~ (cerrado).
- **Expo SDK** → ~~decidido: subir a **SDK 57** (RN 0.86 / React 19.2)~~ como
  prerrequisito de PowerSync (op-sqlite ^17 / New Architecture). Ver runbook.
- **Login opcional u obligatorio** → propuesta: opcional (principio 3). Cerrar
  antes de la Fase 2.
- **Web dentro o fuera** del alcance de sync inicial (PowerSync la soporta, pero
  es trabajo extra).
- **Branding social** (nombre de la parte comunitaria, si procede). Fase 3.

---

## 12. Otras ideas que abre este cambio

- **Backup automático** en la nube (resuelve el "perdí el móvil"; hoy depende del
  export JSON manual).
- **Perfil con stats públicas**: racha, PRs, volumen — gamificación social.
- **Retos y rankings entre amigos** (quién sostiene la racha).
- **Modo coach/atleta**: un entrenador asigna rutinas y ve el progreso de sus
  clientes. Encaja de lleno con este backend.
- **Comentarios/reacciones** en rutinas públicas.
