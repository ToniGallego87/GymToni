# Roadmap — GymBro

Trabajo pendiente, ordenado por impacto para el usuario dentro de cada sección.
Solo contiene lo que queda por hacer: lo terminado se borra de aquí (el
historial vive en [UPDATES.md](UPDATES.md)). Marcar `[x]` al completar una
tarea y eliminarla al cerrar la versión que la incluya.

Las restricciones de [AGENTS.md](../../AGENTS.md) mandan: **no** Redux,
**no** librerías de estado o UI externas, **no** arquitecturas complejas.
Backend, cuentas y sincronización cloud ya **no** están prohibidos: son una
dirección planificada por fases (plan en [backend-design.md](backend-design.md)).

Última revisión completa: 2026-08-07.

## Mejoras visuales y de UX

- [ ] **Transición de tema que revele el contenido real, no un disco opaco** — el
      cambio claro/oscuro anima un círculo de color sólido que tapa la pantalla;
      se pide que ese círculo no sea opaco sino que muestre ya el contenido de la
      vista en el tema de destino, para que sea una transición visual entre las
      dos pieles y no un barrido de color plano.
      **Por qué:** el disco de color maciza la transición; ver la UI de destino
      crecer desde el punto pulsado haría el cambio de tema mucho más pulido.
      **Archivos:** `components/ThemeRevealOverlay.tsx:130-146` (hoy pinta un
      `Animated.View` con `backgroundColor: request.discColor`; para revelar
      contenido real haría falta una captura/snapshot de la vista en el tema de
      destino recortada por el círculo, sin librerías UI externas). Requiere
      validar rendimiento a 60 fps.
      **Esfuerzo:** alto.

## Funcionalidades a simplificar

Nada pendiente ahora mismo.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

El salto a la nube es un **epic secuencial** de cuatro fases (cada una entregable
por sí sola), sobre **Supabase + un motor de sync artesanal** en la `expo-sqlite`
ACTUAL — sin subir SDK ni New Architecture (PowerSync descartado, ver
[backend-design.md](backend-design.md) §14). El plan completo (modelo de datos,
sync, seguridad, coste) vive en ese doc; aquí solo el resumen.

- [x] **Backend Fase 1 — Fundaciones locales de sync** — preparar `expo-sqlite`
      para sincronizar sin tocar aún la nube: `updated_at` en las tablas de
      dominio, tombstones (borrado registrado) y una tabla `sync_outbox` que
      acumule cada cambio pendiente. Sin subir SDK, sobre RN 0.74.
      **Por qué:** es el cimiento del sync; al ser refactor local es de bajo
      riesgo y no cambia nada de cara al usuario.
      **Archivos:** `lib/db/schema.ts` (columnas + `sync_outbox` + migración
      `SCHEMA_VERSION` 3→4), `lib/db/index.ts`, `lib/db/mappers.ts`,
      `lib/persistence.ts`. Pasos en `backend-fase1-runbook.md`; diseño en
      `backend-design.md` §4.
      **Esfuerzo:** medio.
- [x] **Backend Fase 2 — Cuentas y backup en la nube** — login con Supabase Auth
      (email + Google + Apple), tabla `profiles`, y backup/restore completo del
      historial a la nube. Cuenta **opcional**; adopta el estado local anónimo al
      registrarse.
      **Por qué:** primer valor real: no perder los datos al cambiar de móvil y
      verlos en varios dispositivos.
      **Archivos:** cliente `@supabase/supabase-js` nuevo, `lib/persistence.ts`,
      tabla `profiles` en la nube. Detalle en `backend-design.md` §5.
      **Esfuerzo:** alto.
- [ ] **Backend Fase 3 — Sincronización incremental** — motor de push/pull propio
      sobre `sync_outbox`: subir cambios y bajar deltas (`updated_at > cursor`)
      con resolución *last-write-wins*.
      **Por qué:** convierte el backup manual en sync continuo y transparente.
      **Archivos:** motor de sync nuevo en `lib/`, `lib/persistence.ts`. Detalle
      en `backend-design.md` §6.
      **Esfuerzo:** alto.
- [ ] **Backend Fase 4 — Social (perfiles, follows, tablón)** — perfiles
      públicos, seguir usuarios, rutinas públicas (`is_public`), likes/guardados,
      tablón de rutinas populares y clonar una rutina pública a tu espacio;
      permisos por RLS.
      **Por qué:** cierra el salto de app personal a comunidad; descubrir rutinas
      y seguir a otros es el gancho de retención.
      **Archivos:** tablas nube `profiles` / `follows` / `routine_likes` + RLS,
      reutiliza `lib/routines.ts` (duplicar con ids nuevos) para clonar. Detalle
      en `backend-design.md` §7.
      **Esfuerzo:** alto.
- [ ] **Recordatorio de entrenamiento** — notificación local programable por
      día de la semana (la infraestructura de notificaciones ya existe para el
      timer de descanso).
      **Por qué:** la constancia es el producto; un recordatorio a la hora de
      entrenar es la palanca más barata para sostener la racha.
      **Archivos:** `features/workout/SettingsScreen.tsx` (ajuste nuevo),
      `features/workout/WorkoutLogScreen.tsx:446-491` (patrón de canal/permisos
      a reutilizar) y `:371-409` (`scheduleNotificationAsync`).
      **Esfuerzo:** medio.
- [ ] **Registrar un ejercicio no planificado durante la sesión** — hoy el
      registro solo pinta los ejercicios que trae el día de la rutina; si en el
      gym improvisas (máquina ocupada, ejercicio extra) no hay dónde meterlo.
      Permitir añadir un ejercicio suelto a la sesión en curso, guardándolo con
      su propio id para que el detalle y el histórico lo muestren igual que los
      demás.
      **Por qué:** entrenar de verdad no siempre sigue la plantilla; poder
      apuntar lo que hiciste evita que el registro mienta o se quede corto.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1140` (el registro
      itera solo `selectedDay.exercises`), `types/index.ts` (`ExerciseLog.exerciseId`
      apunta al ejercicio de la rutina: un extra necesita un id propio que
      Detalle resuelva por nombre/orden, como ya hace `getExerciseFromLog` en
      `features/workout/DetailScreen.tsx:326-349`). Alternativa ligera: la ficha
      "Nota de sesión" cubre el "cambié banca por mancuernas" sin tocar el modelo.
      **Esfuerzo:** alto.
- [ ] **Nota de sesión** — además de las notas por ejercicio: "gym lleno,
      cambié banca por mancuernas".
      **Por qué:** el contexto del día explica los datos raros al revisar el
      histórico, y hoy no hay dónde apuntarlo.
      **Archivos:** `types/index.ts` (`WorkoutLog`, campo/flag nuevo),
      `features/workout/WorkoutLogScreen.tsx`,
      `features/workout/DetailScreen.tsx`, `lib/db/schema.ts` (columna nueva +
      migración) y `lib/db/mappers.ts` (mapear la columna).
      **Esfuerzo:** medio.
- [ ] **Exportar CSV además de JSON** — para abrir el historial en Excel.
      **Por qué:** el JSON del backup no se puede analizar sin herramientas; un
      CSV por series abre el análisis libre a cualquiera.
      **Archivos:** `lib/fileIO.ts` (`downloadJsonFile` como patrón; nueva
      salida CSV), `app/App.tsx:462` (`handleExportData`),
      `features/workout/DataScreen.tsx` (botón nuevo).
      **Esfuerzo:** bajo.
- [ ] **Widget Android** — estado de la semana en curso en la pantalla de
      inicio del móvil.
      **Por qué:** ver la semana a medias sin abrir la app empuja a completarla.
      **Archivos:** `android/` (módulo nativo nuevo), `lib/weeks.ts` (datos de la
      semana en curso: `buildWeekProgress` / `computeStreak`).
      **Esfuerzo:** alto.

## Descartado por restricciones del proyecto

- **Autenticación, sincronización cloud y modo coach/atleta** ya **no** están
  descartados: pasan a ser el epic de backend por fases (ver "Nuevas
  funcionalidades" y [backend-design.md](backend-design.md)).
- **Dashboard web e IA**: sin planificar por ahora — no por restricción, sino
  por prioridad; se replantearán cuando el backend esté asentado.
- Siguen fuera por restricción de código: Redux / librerías de estado externas,
  librerías UI externas y arquitecturas complejas. Revisar AGENTS.md antes de
  introducir cualquiera.
