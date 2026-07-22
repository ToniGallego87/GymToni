# Roadmap — GymBro

Trabajo pendiente, ordenado por impacto para el usuario dentro de cada sección.
Solo contiene lo que queda por hacer: lo terminado se borra de aquí (el
historial vive en [UPDATES.md](UPDATES.md)). Marcar `[x]` al completar una
tarea y eliminarla al cerrar la versión que la incluya.

Las restricciones de [AGENTS.md](../../AGENTS.md) mandan: **no** login,
**no** backend/cloud, **no** Redux, **no** librerías UI externas.

Última revisión completa: 2026-07-22.

## Mejoras visuales y de UX

- [x] **Subir el contraste de las tarjetas/superficies en modo oscuro** — los
      elementos que pintan con el color de fondo de la tarjeta diaria
      (`theme.colors.surface`) apenas se despegan del fondo de pantalla en noche:
      la tarjeta del día en fuerza/cardio, las celdas del calendario, la opción
      fuerza/cardio del calendario y las opciones de Perfil.
      **Por qué:** en oscuro esas superficies se funden con el fondo y cuesta ver
      dónde empieza cada tarjeta; más contraste mejora legibilidad y el toque.
      **Archivos:** `lib/theme.ts:42-43` (`surface`/`surfaceAlt` de `darkColors`,
      raíz del problema), `features/workout/CalendarScreen.tsx:652,724`,
      `features/workout/ProfileScreen.tsx`, `features/workout/DetailScreen.tsx`.
      **Esfuerzo:** bajo.
- [x] **Subir el contraste de la barra de título y la de navegación en modo
      oscuro** — mismo problema que las tarjetas pero en las barras glass: en
      noche se despegan poco del fondo.
      **Por qué:** las barras son el marco permanente de la app; si no se separan
      del fondo, la jerarquía se pierde y cuesta ubicar los controles.
      **Archivos:** `components/glassTokens.ts:15-16` (`GLASS_TOP_BAR_BG` /
      `GLASS_TOP_BAR_OVERLAY`), `:28` (`GLASS_ACTIVE_ITEM_BG` de la barra de
      navegación), `components/GlassTopBar.tsx`, `components/FloatingPrimaryNav.tsx`.
      **Esfuerzo:** bajo.
- [x] **Menú de tres puntos en todas las vistas** — hoy el menú de la top bar
      (cambio de tema) solo existe en Inicio; llevarlo a un sitio compartido para
      que aparezca en todas las pantallas.
      **Por qué:** el usuario espera encontrar las opciones siempre en el mismo
      lugar; tener el menú solo en Inicio obliga a volver atrás para cambiar de
      modo o tocar cualquier ajuste global.
      **Archivos:** `features/workout/HomeScreen.tsx:1391-1451` (menú y botón
      actuales, a extraer), `components/GlassTopBar.tsx` (destino compartido con
      `rightElement`).
      **Esfuerzo:** medio.
- [x] **Recolorear la vista con la animación de tema, sin taparla** — al cambiar
      claro/oscuro el círculo de revelado crece pero mantiene la vista visible y
      la recolorea a la vez, en lugar de cubrirla con un círculo opaco mientras
      repinta por debajo.
      **Por qué:** el efecto actual esconde la pantalla durante la transición; que
      la vista se tiña junto al círculo hace el cambio más fluido y menos brusco.
      **Archivos:** `components/ThemeRevealOverlay.tsx` (todo el revelado del
      círculo opaco), `app/App.tsx` (montaje del overlay en la raíz).
      **Esfuerzo:** alto.

## Funcionalidades a simplificar

- [x] **Guardar el cardio automáticamente al insertarlo** — que un registro de
      cardio se confirme solo al completar los datos, sin pulsar "guardar", tanto
      en la inserción como ejercicio del día como en el cardio suelto.
      **Por qué:** es un toque de más en una acción muy repetida; quitar el botón
      de guardar acelera el registro, que es la prioridad de la app.
      **Archivos:** `components/CardioInputField.tsx:110-139` (`handleSaveCardio`)
      y `:239` (botón a eliminar), `features/workout/CardioScreen.tsx` (cardio
      suelto).
      **Esfuerzo:** medio.
- [x] **Editar el descanso por defecto sin abrir la rutina** — poder cambiar el
      `timerDuration` de la rutina en curso desde donde ya estás: un botón dentro
      del propio temporizador de descanso y una opción "modificar temporizador" en
      el menú de tres puntos. Hoy ese ajuste solo se alcanza entrando a
      RoutineDetailScreen.
      **Por qué:** el descanso por defecto se suele querer ajustar justo cuando
      suena y se queda corto o largo; obligar a salir del entreno a editar la
      rutina rompe el ritmo.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:798-840` (fila de
      acciones del temporizador donde añadir el botón), `features/workout/`
      `RoutineDetailScreen.tsx:141-169` (modal de edición de `timerDuration` a
      reutilizar), `features/workout/HomeScreen.tsx:1433-1451` (menú de tres
      puntos donde añadir la opción).
      **Esfuerzo:** medio.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

- [ ] **Registrar y editar la fecha de un entreno** — un entreno olvidado de
      ayer no se puede meter (el log siempre nace con `getToday()`), y una vez
      guardado tampoco se puede cambiar de día. Añadir un selector de fecha en el
      registro, tanto al crear un log como para reasignar uno existente a un día
      pasado.
      **Por qué:** olvidarse de registrar un día pasa, y hoy ese entreno se
      pierde para las semanas, rachas y comparativas; corregir la fecha a mano es
      imposible.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:603-616`
      (`buildWorkoutLog` → `date`), `features/workout/DaySelectorScreen.tsx`,
      `features/workout/DetailScreen.tsx` (editar la fecha de un log ya guardado).
      **Esfuerzo:** medio.
- [ ] **Reordenar los ejercicios de una rutina** — poder cambiar la posición de
      los ejercicios desde la consulta/edición de la rutina. El cambio no debe
      alterar los registros de días pasados: los resultados ya insertados se
      muestran en la nueva posición junto a su ejercicio (se reordenan con él, no
      se recalculan).
      **Por qué:** el orden en que entrenas cambia con el tiempo, y hoy queda
      congelado como se creó la rutina; reordenar sin romper el histórico deja la
      lista fiel a cómo entrenas de verdad.
      **Archivos:** `features/workout/RoutineDetailScreen.tsx` (UI de reordenado),
      `types/index.ts:4` (`WorkoutExercise.order`) y `:37` (`ExerciseLog.order`),
      `features/workout/DetailScreen.tsx` (mostrar los logs por el `order` actual,
      manteniendo el vínculo por `exerciseId` para que los registros pasados sigan
      al ejercicio).
      **Esfuerzo:** medio.
- [ ] **Recordatorio de entrenamiento** — notificación local programable por
      día de la semana (la infraestructura de notificaciones ya existe para el
      timer de descanso).
      **Por qué:** la constancia es el producto; un recordatorio a la hora de
      entrenar es la palanca más barata para sostener la racha.
      **Archivos:** `features/workout/SettingsScreen.tsx`,
      `features/workout/WorkoutLogScreen.tsx:322-367` (patrón de canal/permisos
      a reutilizar).
      **Esfuerzo:** medio.
- [ ] **Backup automático local** — exportación silenciosa periódica al
      almacenamiento del dispositivo, reutilizando `lib/fileIO.ts` (sin cloud).
      **Por qué:** la app es local-only: hoy un móvil perdido = historial
      perdido salvo export manual, y nadie exporta a mano con regularidad.
      **Archivos:** `lib/fileIO.ts`, `app/App.tsx` (disparo al hidratar),
      `features/workout/DataScreen.tsx` (ajuste/estado del último backup).
      **Esfuerzo:** medio.
- [ ] **Nota de sesión** — además de las notas por ejercicio: "gym lleno,
      cambié banca por mancuernas".
      **Por qué:** el contexto del día explica los datos raros al revisar el
      histórico, y hoy no hay dónde apuntarlo.
      **Archivos:** `types/index.ts` (`WorkoutLog.notes`),
      `features/workout/WorkoutLogScreen.tsx`,
      `features/workout/DetailScreen.tsx`, `lib/db/schema.ts` (columna nueva).
      **Esfuerzo:** medio.
- [ ] **Exportar CSV además de JSON** — para abrir el historial en Excel.
      **Por qué:** el JSON del backup no se puede analizar sin herramientas; un
      CSV por series abre el análisis libre a cualquiera.
      **Archivos:** `lib/fileIO.ts`, `features/workout/DataScreen.tsx`.
      **Esfuerzo:** bajo.
- [ ] **Widget Android** — estado de la semana en curso en la pantalla de
      inicio del móvil.
      **Por qué:** ver la semana a medias sin abrir la app empuja a completarla.
      **Archivos:** `android/` (módulo nativo nuevo), `lib/weeks.ts` (datos).
      **Esfuerzo:** alto.

## Descartado por restricciones del proyecto

Autenticación, sincronización cloud, modo coach/atleta, dashboard web e IA:
requieren backend/usuarios, explícitamente fuera del alcance del MVP.
Si algún día se replantea, revisar primero AGENTS.md.
