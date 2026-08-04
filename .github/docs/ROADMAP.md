# Roadmap — GymBro

Trabajo pendiente, ordenado por impacto para el usuario dentro de cada sección.
Solo contiene lo que queda por hacer: lo terminado se borra de aquí (el
historial vive en [UPDATES.md](UPDATES.md)). Marcar `[x]` al completar una
tarea y eliminarla al cerrar la versión que la incluya.

Las restricciones de [AGENTS.md](../../AGENTS.md) mandan: **no** login,
**no** backend/cloud, **no** Redux, **no** librerías UI externas.

Última revisión completa: 2026-08-04.

## Mejoras visuales y de UX

- [x] **Pintar el cardio del registro como en la vista de consulta** — en la
      inserción de ejercicios, la sección de cardio muestra cada entrada como
      texto crudo (`Correr en cinta: 30min, 10kmh, 5%`) sin icono, bajo una
      cabecera "Disciplinas ejecutadas:" con un icono genérico `run`. Rehacerla
      con el patrón que ya usa la consulta: cabecera "Cardio" con `run-fast`, y
      cada entrada como fila con su icono de disciplina real (cuesta incluida),
      el nombre y los resultados formateados (`30 min, 10 km/h, 5%`) sobre
      superficie de resultado, conservando la X de borrar visible.
      **Por qué:** registrar cardio es acción frecuente y hoy el resultado se lee
      como dato crudo, incoherente con Cardio (consulta) que ya lo pinta con
      icono por disciplina y datos legibles; es la queja directa del usuario.
      **Archivos:** `components/CardioInputField.tsx:183-214` (cabecera + lista
      que hoy pinta `localizeDecimals(entry)` crudo sin icono), reutilizando de
      `lib/cardio.ts` los helpers que la consulta ya usa: `disciplineIconName`
      (`:261`), `parseCardioEntry` (`:188`) y `formatMergedResults` (`:590`) —
      patrón vivo en `features/workout/CardioScreen.tsx:645-680`. Alinear de paso
      el icono de la top bar en solo-cardio (`features/workout/WorkoutLogScreen.tsx:1220`,
      `run`→`run-fast`).
      **Esfuerzo:** medio.
- [x] **Fuente única de icono por disciplina de cardio** — el picker del modal de
      inserción y la vista de consulta usan iconos distintos para la misma
      disciplina (bici: `bicycle` vs `bike`; correr en exterior y la cuesta
      también divergen). Unificar tomando `disciplineIconName` como única fuente
      del icono de cada disciplina real (la opción "Otro" del picker puede
      conservar su icono de affordance).
      **Por qué:** al elegir "Bici estática" se ve un icono en el picker y otro
      luego en la lista/consulta: dos señales para lo mismo desorientan.
      **Archivos:** `components/CardioInputField.tsx:36-43` (`CARDIO_OPTIONS` con
      iconos propios) contra `lib/cardio.ts:261-275` (`disciplineIconName`,
      fuente única a adoptar).
      **Esfuerzo:** bajo.
- [ ] **Transición de tema que revele el contenido real, no un disco opaco** — el
      cambio claro/oscuro anima un círculo de color sólido que tapa la pantalla;
      se pide que ese círculo no sea opaco sino que muestre ya el contenido de la
      vista en el tema de destino, para que sea una transición visual entre las
      dos pieles y no un barrido de color plano.
      **Por qué:** el disco de color maciza la transición; ver la UI de destino
      crecer desde el punto pulsado haría el cambio de tema mucho más pulido.
      **Archivos:** `components/ThemeRevealOverlay.tsx:56,130-151` (hoy pinta un
      `Animated.View` con `backgroundColor: request.discColor`; para revelar
      contenido real haría falta una captura/snapshot de la vista en el tema de
      destino recortada por el círculo, sin librerías UI externas). Requiere
      validar rendimiento a 60 fps.
      **Esfuerzo:** alto.

## Funcionalidades a simplificar

Nada pendiente ahora mismo en esta sección.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

- [ ] **Recordatorio de entrenamiento** — notificación local programable por
      día de la semana (la infraestructura de notificaciones ya existe para el
      timer de descanso).
      **Por qué:** la constancia es el producto; un recordatorio a la hora de
      entrenar es la palanca más barata para sostener la racha.
      **Archivos:** `features/workout/SettingsScreen.tsx` (ajuste nuevo),
      `features/workout/WorkoutLogScreen.tsx:448-493` (patrón de canal/permisos
      a reutilizar) y `:373-411` (`scheduleNotificationAsync`).
      **Esfuerzo:** medio.
- [ ] **Registrar un ejercicio no planificado durante la sesión** — hoy el
      registro solo pinta los ejercicios que trae el día de la rutina; si en el
      gym improvisas (máquina ocupada, ejercicio extra) no hay dónde meterlo.
      Permitir añadir un ejercicio suelto a la sesión en curso, guardándolo con
      su propio id para que el detalle y el histórico lo muestren igual que los
      demás.
      **Por qué:** entrenar de verdad no siempre sigue la plantilla; poder
      apuntar lo que hiciste evita que el registro mienta o se quede corto.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1108` (el registro
      itera solo `selectedDay.exercises`), `types/index.ts` (`ExerciseLog.exerciseId`
      apunta al ejercicio de la rutina: un extra necesita un id propio que
      Detalle resuelva por nombre/orden, como ya hace `getExerciseFromLog` en
      `features/workout/DetailScreen.tsx:328-351`). Alternativa ligera: la ficha
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

Autenticación, sincronización cloud, modo coach/atleta, dashboard web e IA:
requieren backend/usuarios, explícitamente fuera del alcance del MVP.
Si algún día se replantea, revisar primero AGENTS.md.
