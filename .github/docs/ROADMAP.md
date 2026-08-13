# Roadmap — GymBro

Trabajo pendiente, ordenado por impacto para el usuario dentro de cada sección.
Solo contiene lo que queda por hacer: lo terminado se borra de aquí (el
historial vive en [UPDATES.md](UPDATES.md)). Marcar `[x]` al completar una
tarea y eliminarla al cerrar la versión que la incluya.

Las restricciones de [AGENTS.md](../../AGENTS.md) mandan: **no** Redux,
**no** librerías de estado o UI externas, **no** arquitecturas complejas.
Backend, cuentas y sincronización cloud ya **no** están prohibidos: son una
dirección planificada por fases (plan en [backend-design.md](backend-design.md)).

Última revisión completa: 2026-08-13.

## Mejoras visuales y de UX

- [ ] **Estado de la nube visible desde Perfil** — hoy el estado de la cuenta
      (sesión iniciada, última sincronización, si hay cambios sin subir) solo se
      ve entrando en "Cuenta y nube". Mostrar un subtítulo dinámico en la fila del
      menú (o un punto de estado) daría confianza de "mis datos están a salvo" sin
      abrir la pantalla.
      **Por qué:** el valor de la 0.7.0 es no perder datos; que se note de un
      vistazo que la copia está al día refuerza justo eso.
      **Archivos:** `features/workout/ProfileScreen.tsx:81-86` (la entrada "Cuenta
      y nube" hoy tiene un `hint` fijo), `features/workout/CloudScreen.tsx`
      (`getLastSync`), `lib/cloud/sync.ts` (`getLastSync`, cola pendiente).
      **Esfuerzo:** bajo.
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

- [ ] **Unificar el discurso de "proteger mis datos" (Datos ↔ Cuenta y nube)** —
      tras la 0.7.0 hay tres mecanismos de respaldo conviviendo sin relación
      visible: exportar/importar JSON y copia automática a archivo local
      (`DataScreen`), y copia/restauración + sincronización en la nube
      (`CloudScreen`), en dos entradas separadas de Perfil ("Datos" y "Cuenta y
      nube"). El usuario no sabe cuál le protege de verdad ni si se pisan. Aclarar
      la jerarquía: la nube como copia principal y el JSON local como exportación
      puntual; revisar si "Copia de seguridad ahora" (nube) debe seguir en
      "Avanzado" ahora que el sync es automático.
      **Por qué:** tres caminos para lo mismo generan dudas ("¿ya está guardado?")
      justo en lo más sensible; una sola narrativa clara da tranquilidad.
      **Archivos:** `features/workout/ProfileScreen.tsx:74-92` (entradas "Datos" y
      "Cuenta y nube"), `features/workout/DataScreen.tsx:23-36`,
      `features/workout/CloudScreen.tsx` (bloque "Avanzado").
      **Esfuerzo:** medio.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

El salto a la nube fue un **epic de cuatro fases** sobre **Supabase + un motor de
sync artesanal** en la `expo-sqlite` actual (plan en
[backend-design.md](backend-design.md)). Las fases 1-3 (fundaciones de sync,
cuentas + backup, y sincronización incremental) se entregaron en la 0.7.0; queda
la fase social.

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
      migración) y `lib/db/mappers.ts` (mapear la columna). **Ojo sync:** una
      columna nueva de dominio hay que reflejarla también en la tabla espejo de la
      nube (`supabase/schema.sql`) y en el mapeo de `lib/cloud/sync.ts` /
      `applyRemoteChanges`.
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
