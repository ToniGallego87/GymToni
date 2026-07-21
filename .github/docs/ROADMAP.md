# Roadmap — GymBro

Trabajo pendiente, ordenado por impacto para el usuario dentro de cada sección.
Solo contiene lo que queda por hacer: lo terminado se borra de aquí (el
historial vive en [UPDATES.md](UPDATES.md)). Marcar `[x]` al completar una
tarea y eliminarla al cerrar la versión que la incluya.

Las restricciones de [AGENTS.md](../../AGENTS.md) mandan: **no** login,
**no** backend/cloud, **no** Redux, **no** librerías UI externas.

Última revisión completa: 2026-07-17.

## Mejoras visuales y de UX

Sin pendientes: la última pasada (día ya registrado hoy, día a medias fuera del
%/gráfica, botón atrás físico, avisos de valor inválido, topes de peso/reps y
tintes de color sueltos) se cerró y se retiró de aquí.

## Funcionalidades a simplificar

- [x] **Pulsar la tarjeta de hoy en Inicio debería continuar el entreno, no
      abrir un modal** — hoy abre "¿Qué deseas hacer?" (Continuar / Eliminar /
      Volver), pero la tarjeta ya tiene un botón `⋯` exactamente para esas
      opciones. El toque directo puede hacer lo que el 95% de las veces se
      quiere: abrir el registro.
      **Por qué:** quita un toque y un modal del flujo más frecuente de la app
      (retomar la sesión de hoy), y elimina la duplicidad tarjeta/`⋯` que hoy
      llevan al mismo sitio.
      **Archivos:** `features/workout/HomeScreen.tsx:1127-1135` (onPress de la
      tarjeta), `1226-1273` (modal de opciones).
      **Esfuerzo:** bajo.
- [x] **Poder importar datos con la base de datos vacía** — al abrir la app por
      primera vez, sin rutinas, se oculta la navegación inferior, así que no hay
      forma de llegar a Datos → Importar hasta crear una rutina a mano. Con un
      JSON listo para importar, esto obliga a un paso absurdo. Debe poder
      importarse desde el primer arranque.
      **Por qué:** quien viene de otro móvil o reinstala solo quiere restaurar su
      backup, y la app se lo impide justo cuando no tiene nada que perder.
      **Archivos:** `features/workout/HomeScreen.tsx:1289` (oculta
      `FloatingPrimaryNav` cuando `hasNoRoutines`), `features/workout/DataScreen.tsx:50`
      (`hasNoData`; la tarjeta de importar ya se muestra, falta el acceso).
      **Esfuerzo:** bajo.
- [ ] **Tema/idioma sin reiniciar la app** — el reinicio está bien documentado
      (los `StyleSheet.create` se evalúan a nivel de módulo y capturan la
      paleta), pero es la fricción más visible de Configuración.
      **Por qué:** cambiar un ajuste no debería cortar la sesión; hoy el cambio
      relanza el bundle entero.
      **Archivos:** `lib/theme.ts`, `lib/i18n.ts`,
      `features/workout/SettingsScreen.tsx` y TODOS los `StyleSheet.create` de
      módulo de la app (refactor grande: theming dinámico). Deuda anotada, no
      abordar hasta que duela más.
      **Esfuerzo:** alto.

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
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:630`
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
      `features/workout/WorkoutLogScreen.tsx:364-409` (patrón de canal/permisos
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
