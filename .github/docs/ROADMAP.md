# Roadmap — GymBro

Trabajo pendiente, ordenado por impacto para el usuario dentro de cada sección.
Solo contiene lo que queda por hacer: lo terminado se borra de aquí (el
historial vive en [UPDATES.md](UPDATES.md)). Marcar `[x]` al completar una
tarea y eliminarla al cerrar la versión que la incluya.

Las restricciones de [AGENTS.md](../../AGENTS.md) mandan: **no** login,
**no** backend/cloud, **no** Redux, **no** librerías UI externas.

Última revisión completa: 2026-07-28.

## Mejoras visuales y de UX

- [ ] **Transición de tema que revele el contenido real, no un disco opaco** — el
      cambio claro/oscuro anima un círculo de color sólido que tapa la pantalla;
      se pide que ese círculo no sea opaco sino que muestre ya el contenido de la
      vista en el tema de destino, para que sea una transición visual entre las
      dos pieles y no un barrido de color plano.
      **Por qué:** el disco de color maciza la transición; ver la UI de destino
      crecer desde el punto pulsado haría el cambio de tema mucho más pulido.
      **Archivos:** `components/ThemeRevealOverlay.tsx:38-151` (hoy pinta un
      `Animated.View` con `backgroundColor: discColor`; para revelar contenido
      real haría falta una captura/snapshot de la vista en el tema de destino
      recortada por el círculo, sin librerías UI externas). Requiere validar
      rendimiento a 60 fps.
      **Esfuerzo:** alto.
- [ ] **Confirmar al mover un día que reorganiza una semana ya completada** — la
      acción "Mover a la semana anterior/siguiente/nueva" del menú ⋯ de cada día
      se aplica en el acto y recalcula en silencio racha, progreso y logros de las
      semanas afectadas. Cuando el movimiento toca una semana ya completada (o
      hace desaparecer una), pedir confirmación con `ConfirmModal` explicando qué
      cambiará; para semanas incompletas, seguir aplicándolo directo.
      **Por qué:** hoy un toque puede alterar el histórico y romper una racha sin
      aviso ni deshacer visible; una confirmación solo en el caso destructivo
      evita sustos sin estorbar el uso normal.
      **Archivos:** `features/workout/HomeScreen.tsx:798` (`handleMoveWeek`, hoy
      despacha sin confirmar) y `:791-796` (`optionsMovePrev`/`optionsMoveNext`,
      el plan ya expone `removesSourceWeek`; falta distinguir si la semana afectada
      está completa con `isWeekCompleted`), `components/ConfirmModal.tsx` (patrón a
      reutilizar).
      **Esfuerzo:** bajo.

## Funcionalidades a simplificar

Sin entradas pendientes.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

- [x] **Subir target/compile SDK a 36 (Android 16) antes del 31-08-2026** —
      cambiar `compileSdkVersion` y `targetSdkVersion` de 35 a 36 en
      `android/build.gradle`. Google Play exige API 36 para publicar
      actualizaciones a partir de esa fecha; con 35 la app sigue disponible para
      los usuarios actuales, pero no se puede subir ninguna versión nueva. Ya se
      hizo el salto 34→35 y `gradle.properties` ya suprime el warning de
      compileSdk 36. Tras el bump, probar: pantalla completa/edge-to-edge (ya
      resuelto en `MainActivity.kt`), notificaciones y el requisito de páginas de
      16 KB en librerías nativas.
      **Por qué:** sin esto queda bloqueada cualquier actualización futura en la
      tienda tras el 31-08-2026; es el único punto que puede congelar el
      desarrollo entero, así que va antes que cualquier mejora.
      **Archivos:** `android/build.gradle:7-8`
      (`compileSdkVersion`/`targetSdkVersion`), `android/gradle.properties:62`
      (ya suprime el warning de compileSdk 36),
      `android/app/src/main/java/com/tonigallego/gymbro/MainActivity.kt:33`
      (edge-to-edge a verificar).
      **Esfuerzo:** bajo.
- [x] **Registrar y editar la fecha de un entreno** — un entreno olvidado de
      ayer no se puede meter (el log siempre nace con `getToday()`), y una vez
      guardado tampoco se puede cambiar de día. Añadir un selector de fecha en el
      registro, tanto al crear un log como para reasignar uno existente a un día
      pasado.
      **Por qué:** olvidarse de registrar un día pasa, y hoy ese entreno se
      pierde para las semanas, rachas y comparativas; corregir la fecha a mano es
      imposible.
      **Caso límite (fecha que duplica un día en una semana existente):** como las
      semanas son bloques derivados que se cortan al reaparecer un día ya entrenado
      (`lib/weeks.ts:23`), asignar una fecha que caiga en una semana que ya tiene
      ese mismo día **parte esa semana en dos** por el punto de inserción (la de
      origen puede quedar incompleta y romper racha/progreso/logros, que se
      recalculan). Permitirlo, pero **avisar antes con `ConfirmModal`** explicando
      que dividirá la semana; detectar el choque con el mismo chequeo de "día igual
      dentro del bloque" (por `dayNumber`) que usa `planWeekMove` en `lib/weeks.ts`.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:663-677`
      (`buildWorkoutLog` → `date`), `features/workout/DaySelectorScreen.tsx`,
      `features/workout/DetailScreen.tsx` (editar la fecha de un log ya guardado),
      `components/ConfirmModal.tsx` (aviso), `lib/weeks.ts` (chequeo de día
      duplicado en el bloque destino, reutilizando la clave del agrupado).
      **Esfuerzo:** medio.
- [x] **Reordenar los ejercicios de una rutina** — poder cambiar la posición de
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
- [x] **Asignar un GIF fijo a un ejercicio de la rutina** — hoy el botón de GIF
      abre el buscador cada vez para los ejercicios sin `catalogId` (los tecleados
      a mano). Permitir fijar un GIF concreto a un ejercicio: si tiene GIF
      asignado, el botón lo abre directo; si no, sigue abriendo el buscador, y
      desde el visor del GIF que eliges aparece un botón **Asignar** que lo fija.
      La asignación se guarda en la rutina y debe viajar con ella al copiar/pegar
      en texto plano y al compartir por QR/deep link.
      **Por qué:** cada consulta de un ejercicio tecleado a mano obliga a rebuscar
      su GIF; fijarlo una vez deja el play directo y hace que la rutina compartida
      llegue ya con sus GIFs.
      **Archivos:** `types/index.ts:10` (`WorkoutExercise.catalogId` ya existe y ya
      decide GIF directo vs buscador; la mitad del modelo está hecha),
      `components/ExerciseGifButton.tsx:34-37` (hoy sin callback para guardar:
      falta un `onAssign` para escribir el `catalogId`),
      `components/ExercisePickerModal.tsx` y `components/GifViewerModal.tsx` (botón
      **Asignar** en el visor cuando se abre en modo referencia),
      `lib/routineShare.ts:52-57` (`exerciseToLine`) y `:75-112` (payload QR y su
      parseo: incluir y volver a leer el `catalogId`),
      `lib/exerciseForm.ts:29-33` (regex de línea) y `:52` (round-trip del texto
      plano, para que la marca de GIF sobreviva al importar),
      `features/workout/RoutineDetailScreen.tsx` (persistir la asignación en la
      rutina). El botón de GIF también aparece en registro e historial: **ahí
      Asignar también debe salir**, porque el log pasado pertenece a una rutina
      concreta (`WorkoutLog.routineId`+`dayId` en `types/index.ts:60-61`) y su
      ejercicio se resuelve por id (`ExerciseLog.exerciseId` → el ejercicio de la
      rutina, `types/index.ts:39`); Asignar escribe el `catalogId` en ese
      ejercicio de la rutina, no en el log. **Esfuerzo:** medio.
- [x] **Marcar una semana como semana de descarga** — poder señalar una semana
      como descarga (deload): en la gráfica su barra sale en blanco, no cuenta
      para los porcentajes y en la cabecera de la tarjeta, donde va el %, aparece
      la palabra **Descarga** en azul en vez del delta. La siguiente semana de
      carga no se compara con la de descarga sino con la anterior de carga, y un
      día de esa semana, al abrir la vista de consulta, no se compara con nada:
      a efectos de estadística la semana queda al margen de los datos.
      **Por qué:** un deload baja las cargas a propósito; hoy ensucia
      porcentajes, racha y comparativas como si fuera un bajón, y marcarlo deja
      el histórico fiel al esfuerzo real sin tener que borrar la semana.
      **Archivos:** `types/index.ts:69` (flag nuevo tipo `isDeload?` en
      `WorkoutLog`, junto a `startsNewWeek`; las semanas no se guardan, se
      derivan, así que la marca vive en el/los log(s) del bloque),
      `lib/weeks.ts:326` (`getWeekImprovement` y :432 `buildWeekProgress` deben
      saltar los bloques de descarga al elegir la semana "anterior"/base),
      `features/workout/HomeScreen.tsx:99-129` (barra en blanco en la gráfica) y
      `:1071-1149` (cabecera: "Descarga" en azul en lugar del delta),
      `features/workout/DetailScreen.tsx:130-136` (`previousLog`: ignorar logs de
      semanas de descarga al comparar), `features/workout/WorkoutContext.tsx` y
      `lib/persistence.ts` (persistir el flag vía `UPDATE_WORKOUT_LOG`).
      **Esfuerzo:** alto.
- [ ] **Recordatorio de entrenamiento** — notificación local programable por
      día de la semana (la infraestructura de notificaciones ya existe para el
      timer de descanso).
      **Por qué:** la constancia es el producto; un recordatorio a la hora de
      entrenar es la palanca más barata para sostener la racha.
      **Archivos:** `features/workout/SettingsScreen.tsx`,
      `features/workout/WorkoutLogScreen.tsx:354-399` (patrón de canal/permisos
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
