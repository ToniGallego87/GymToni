# Roadmap — GymBro

Trabajo pendiente, ordenado por impacto para el usuario dentro de cada sección.
Solo contiene lo que queda por hacer: lo terminado se borra de aquí (el
historial vive en [UPDATES.md](UPDATES.md)). Marcar `[x]` al completar una
tarea y eliminarla al cerrar la versión que la incluya.

Las restricciones de [AGENTS.md](../../AGENTS.md) mandan: **no** Redux,
**no** librerías de estado o UI externas, **no** arquitecturas complejas.
Backend, cuentas y sincronización cloud ya **no** están prohibidos: el epic de
Supabase (cuentas, sync y social) está entregado; plan en
[backend-design.md](backend-design.md).

Última revisión completa: 2026-08-15.

## Mejoras visuales y de UX

- [ ] **Barra de navegación de 5 pestañas: aliviar densidad** — con Cardio visible
      la barra tiene 5 pestañas (Fuerza, Cardio, Calendario, Comunidad, Perfil) con
      etiqueta a 11px; "Calendario" y "Comunidad" son largas y en pantallas
      estrechas quedan justas.
      **Por qué:** es la navegación de uso constante; apretada resta legibilidad y
      aciertos de toque.
      **Archivos:** `components/FloatingPrimaryNav.tsx:40-70` (items) y `:150-165`
      (label 11px). Opciones sin librerías: etiquetas más cortas, o icono-only por
      debajo de cierto ancho (`useWindowDimensions`).
      **Esfuerzo:** bajo.
- [ ] **"Cuenta y nube" no reacciona al cambio de tema en caliente** — `CloudScreen`
      define sus estilos con `StyleSheet.create` a nivel de módulo, no con
      `makeStyles()` + `subscribeTheme` como el resto de pantallas; al cambiar
      claro/oscuro en caliente no recolorea hasta reabrirla.
      **Por qué:** incoherencia con el sistema de tema en caliente
      ([frontend-design.md](frontend-design.md)); tras la 0.7.0 esta pantalla es
      prominente (perfil público, contadores, backup).
      **Archivos:** `features/workout/CloudScreen.tsx:551` (envolver en `makeStyles`
      + `subscribeTheme`, patrón de `HomeScreen`/`CommunityScreen`).
      **Esfuerzo:** bajo.
- [ ] **Comunidad: refresco manual (pull-to-refresh) y like en el feed** — el
      tablón refresca al abrir la pestaña y desde caché, pero no hay "tirar para
      refrescar"; y el corazón de like solo aparece en "Populares", no en el feed
      "Siguiendo".
      **Por qué:** el gesto de tirar para refrescar es esperable en una lista
      social; y una rutina pública debería poder gustarte esté en el tablón o en el
      feed (coherencia).
      **Archivos:** `features/workout/CommunityScreen.tsx` (`FlatList` admite
      `refreshing`/`onRefresh`; el like se pinta solo si `item.likes !== undefined`),
      `lib/cloud/social.ts` (`getFollowingFeed` no trae `likes`/`liked_by_me`).
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

Nada pendiente ahora mismo.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

- [ ] **Avatares en Supabase Storage en vez de base64** — hoy la foto de perfil se
      guarda como data URI base64 en `profiles.avatar_url` y se baja y pinta así en
      el tablón, la búsqueda y los perfiles. Migrar a un bucket de Storage y guardar
      la URL: payloads ligeros, caché de imagen nativa y el tablón deja de arrastrar
      la foto de cada autor en base64.
      **Por qué:** el base64 infla la fila `profiles` y cada consulta de perfiles;
      con muchos usuarios/rutinas el tablón pesa y decodificar tantas imágenes
      recarga el render.
      **Archivos:** `lib/cloud/social.ts` (`updateProfile`, `getProfilesByIds`),
      `features/workout/CloudScreen.tsx` (`handlePickAvatar`), `supabase/` (bucket
      `avatars` + políticas de Storage).
      **Esfuerzo:** medio.
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

- **Autenticación, sincronización cloud y social** ya **no** están descartados:
  fueron el epic de backend (Supabase, por fases), **ya entregado** (cuentas +
  backup, sync incremental y social: perfiles, seguir, tablón). Ver
  [backend-design.md](backend-design.md).
- **Dashboard web e IA**: sin planificar por ahora — no por restricción, sino
  por prioridad; se replantearán cuando el backend esté asentado.
- Siguen fuera por restricción de código: Redux / librerías de estado externas,
  librerías UI externas y arquitecturas complejas. Revisar AGENTS.md antes de
  introducir cualquiera.
