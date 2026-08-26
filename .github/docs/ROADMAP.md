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

Última revisión completa: 2026-08-24.

## Mejoras visuales y de UX

- [x] **El atrás del sistema cierra la app en vez de volver a la pantalla
      anterior** — el botón/gesto de atrás de Android sale de la app desde
      cualquier pantalla; debería hacer exactamente lo mismo que el "Volver" de
      la barra superior (y solo cerrar desde Inicio). La lógica ya está escrita
      y mapea pantalla a pantalla, pero no llega a ejecutarse: con
      `targetSdkVersion = 36` el atrás predictivo de Android es obligatorio y
      React Native 0.74.5 sigue escuchando por el `onBackPressed` clásico, así
      que `BackHandler` no recibe el evento y el sistema cierra la Activity.
      Las salidas posibles son bajar el `targetSdk` a 35 (donde
      `android:enableOnBackInvokedCallback="false"` todavía se respeta) o
      registrar el callback nuevo desde `MainActivity`.
      **Por qué:** es la peor pérdida posible: un atrás por reflejo en mitad de
      un entrenamiento te saca de la app, y el usuario no tiene forma de saber
      que ese gesto no es "volver".
      **Archivos:** `app/App.tsx:376-444` (el `BackHandler` que ya resuelve el
      destino de cada pantalla, correcto pero inerte),
      `android/build.gradle:8` (`targetSdkVersion`),
      `android/app/src/main/AndroidManifest.xml:17` (el `<application>` no
      declara `enableOnBackInvokedCallback`),
      `android/app/src/main/java/com/tonigallego/gymbro/MainActivity.kt`,
      `package.json:42` (React Native 0.74.5).
      **Esfuerzo:** medio.
- [x] **Las series insertadas, debajo de los campos; y "Añadir serie" reducido a
      un "+"** — hoy las burbujas de peso × reps se pintan **encima** de las
      cajas de texto y el CTA "Añadir serie" ocupa una fila entera debajo. Se
      invierte: las burbujas pasan al hueco de debajo de los inputs (donde está
      hoy el botón) y el botón se encoge al tamaño de una burbuja, con solo el
      icono `+`, colocado a la derecha de la última serie. Mientras no haya
      ninguna serie el botón se mantiene como está (ancho, con texto), y
      desaparece del todo cuando el ejercicio está completado.
      **Por qué:** es la tarjeta que más se toca de toda la app. Lo que acabas
      de meter aparece justo donde miras al escribir, y el CTA deja de comerse
      una fila entera cuando ya sabes cómo funciona.
      **Archivos:** `components/ExerciseInputField.tsx:577-591` (bloque
      `resultsBlock` + `renderSeriesRow()`, hoy antes de `bottomSection`),
      `components/ExerciseInputField.tsx:679-695` (el `Pressable` de "Añadir
      serie"), estilos `resultsBlock` (`:1038`) y `addButton` (`:1209-1225`).
      Ojo a la transición `layout` que ya anima el bloque al plegar/desplegar.
      **Esfuerzo:** medio.
- [ ] **El subtítulo de Inicio gasta el mejor hueco de la app en el número de
      versión** — la barra superior de la pantalla que más se abre rotula
      "Versión 0.7.2". El resto de pantallas usan ese mismo hueco para orientar
      ("Consulta tus resultados", "Repasa tus ejercicios mes por mes"). La
      versión ya se muestra al pie de Perfil, así que aquí solo queda **quitarla
      de Inicio** y poner en su lugar algo que oriente (rutina en curso, día que
      toca, estado de la semana).
      **Por qué:** es dato de desarrollador en el sitio con más ojos, y encima
      duplicado desde que los ajustes viven en Perfil.
      **Archivos:** `features/workout/HomeScreen.tsx:1466`
      (`subtitle={Versión …}`), `features/workout/ProfileScreen.tsx` (bloque
      "Ajustes", donde ya se pinta la versión).
      **Esfuerzo:** bajo.
- [x] **El menú ⋯ del ejercicio no distingue acciones de "Volver"** — el modal
      de acciones de la tarjeta de ejercicio pinta todo (nota, cronómetro,
      saltar, Volver) como `Button variant="secondary"`: cuatro botones grises
      idénticos. Adoptar el formato del selector de disciplina de "Añadir" en
      Cardio, donde las opciones van en el cuerpo del modal con fondo
      `primaryMuted` y borde `primaryLine`, y solo el cierre queda como
      secundario en el pie.
      **Por qué:** consistencia entre los dos modales de la app que hacen lo
      mismo, y así se ve de un vistazo qué es una acción y qué es salir.
      **Archivos:** `components/ExerciseInputField.tsx:866-917` (el `AppModal`
      de acciones), `components/CardioInputField.tsx:303-322` (patrón a copiar:
      opciones en el cuerpo) y `components/CardioInputField.tsx:509-527`
      (estilos `optionButton` / `optionButtonText`).
      **Esfuerzo:** bajo.
- [ ] **Transición de tema que revele el contenido real, no un disco opaco** — el
      cambio claro/oscuro anima un círculo de color sólido que tapa la pantalla;
      se pide que ese círculo no sea opaco sino que muestre ya el contenido de la
      vista en el tema de destino, para que sea una transición visual entre las
      dos pieles y no un barrido de color plano.
      **Por qué:** el disco de color maciza la transición; ver la UI de destino
      crecer desde el punto pulsado haría el cambio de tema mucho más pulido.
      **Archivos:** `components/ThemeRevealOverlay.tsx:131-146` (hoy pinta un
      `Animated.View` con `backgroundColor: request.discColor`; para revelar
      contenido real haría falta una captura/snapshot de la vista en el tema de
      destino recortada por el círculo, sin librerías UI externas). Requiere
      validar rendimiento a 60 fps.
      **Esfuerzo:** alto.

## Funcionalidades a simplificar

Sin entradas pendientes: la tarjeta de ejercicio del registro ya se escalonó
(acciones raras al ⋯ de la cabecera, cronómetro plegado) y los estados de rutina
se leen en una sola línea. Ver [UPDATES.md](UPDATES.md).

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

- [x] **Avisar al arrancar de que hay una versión nueva en Google Play** — al
      abrir la app, comprobar si la versión publicada es mayor que la instalada
      y, si lo es, mostrar un popup con un botón que abra la ficha de Play. La
      app se distribuye por Play con `expo-updates` deshabilitado, así que la
      versión publicada tiene que venir de fuera: lo natural es una fila en
      Supabase (backend ya montado y en uso) que el cierre de versión actualice.
      El aviso debe recordarse por versión para no repetirse en cada arranque, y
      no puede pisar al popup de novedades: si tocan a la vez, primero
      novedades.
      **Por qué:** hoy no hay forma de enterarse de que hay una versión nueva; la
      gente se queda meses sin correcciones ya publicadas y reporta bugs
      arreglados.
      **Archivos:** `app/App.tsx:230-259` (efecto de arranque de `WhatsNewModal`,
      mismo patrón de "una vez por versión"), `components/WhatsNewModal.tsx`
      (modal a reutilizar), `lib/supabase.ts` + `supabase/schema.sql` (dónde
      publicar la versión disponible), `app.json:6` (`expo.version`, la
      instalada) y `app.json:15` (`com.tonigallego.gymbro`, para el enlace
      `market://details?id=` con `expo-linking`, ya presente),
      `lib/appSettings.ts` (recordar la última versión avisada),
      `android/app/src/main/AndroidManifest.xml:22` (`expo.modules.updates`
      deshabilitado: confirma que no hay atajo por OTA).
      **Esfuerzo:** medio.
- [ ] **Recordatorio de entrenamiento** — notificación local programable por
      día de la semana (la infraestructura de notificaciones ya existe para el
      timer de descanso).
      **Por qué:** la constancia es el producto; un recordatorio a la hora de
      entrenar es la palanca más barata para sostener la racha.
      **Archivos:** `features/workout/ProfileScreen.tsx` (bloque "Ajustes",
      donde ahora viven tema e idioma), `features/workout/WorkoutLogScreen.tsx`
      (patrón de canal/permisos a reutilizar en `configureNotifications`, y
      `scheduleNotificationAsync` para programarlo).
      **Esfuerzo:** medio.
- [ ] **Nota de sesión** — además de las notas por ejercicio: "gym lleno,
      cambié banca por mancuernas".
      **Por qué:** el contexto del día explica los datos raros al revisar el
      histórico, y hoy no hay dónde apuntarlo.
      **Archivos:** `types/index.ts:57-77` (`WorkoutLog`, campo nuevo),
      `features/workout/WorkoutLogScreen.tsx`,
      `features/workout/DetailScreen.tsx`, `lib/db/schema.ts` (columna nueva +
      migración) y `lib/db/mappers.ts:229` (mapear la columna). **Ojo sync:** una
      columna nueva de dominio hay que reflejarla también en la tabla espejo de la
      nube (`supabase/schema.sql`) y en el mapeo de `lib/cloud/sync.ts` /
      `applyRemoteChanges`.
      **Esfuerzo:** medio.
- [ ] **Buscar en "Progreso por ejercicio"** — la lista se pagina de 20 en 20 y
      solo se puede reordenar (Reciente / Nombre / Sesiones / 1RM). Con una
      rutina de 5 días son 30-40 ejercicios: encontrar uno concreto es scroll.
      Un campo de búsqueda arriba, igual que el del buscador del catálogo.
      **Por qué:** la pregunta real es "¿cómo voy en press banca?", y hoy se
      responde recorriendo la lista. El patrón ya existe y solo hay que traerlo.
      **Archivos:** `features/workout/ExerciseProgressScreen.tsx:289-325` (lista + filtro de orden), `components/ExercisePickerModal.tsx` (input de búsqueda + `FlatList` filtrada, patrón a copiar), `lib/exerciseProgress.ts`
      (`listExercises` / `sortExercises`).
      **Esfuerzo:** bajo.
- [ ] **Exportar CSV además de JSON** — para abrir el historial en Excel.
      **Por qué:** el JSON del backup no se puede analizar sin herramientas; un
      CSV por series abre el análisis libre a cualquiera.
      **Archivos:** `lib/fileIO.ts:60-109` (`downloadJsonFile` como patrón; nueva
      salida CSV), `app/App.tsx` (`handleExportData`),
      `features/workout/DataScreen.tsx:473-494` (botón nuevo junto a Exportar,
      en el bloque "Copias de seguridad").
      **Esfuerzo:** bajo.
- [ ] **Registrar un ejercicio no planificado durante la sesión** — hoy el
      registro solo pinta los ejercicios que trae el día de la rutina; si en el
      gym improvisas (máquina ocupada, ejercicio extra) no hay dónde meterlo.
      Permitir añadir un ejercicio suelto a la sesión en curso, guardándolo con
      su propio id para que el detalle y el histórico lo muestren igual que los
      demás.
      **Por qué:** entrenar de verdad no siempre sigue la plantilla; poder
      apuntar lo que hiciste evita que el registro mienta o se quede corto.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx` (el registro itera
      solo `selectedDay.exercises`), `types/index.ts:37-46`
      (`ExerciseLog.exerciseId` apunta al ejercicio de la rutina: un extra
      necesita un id propio que Detalle resuelva por nombre/orden, como ya hace
      `getExerciseFromLog` en `features/workout/DetailScreen.tsx:318-341`).
      Alternativa ligera: la ficha "Nota de sesión" cubre el "cambié banca por
      mancuernas" sin tocar el modelo.
      **Esfuerzo:** alto.
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
- **Arrastrar el héroe de Inicio/Cardio para cambiar de tarjeta**: el gesto
  horizontal lo gobierna el `PagerView` nativo de las pestañas, y hacérselo
  ceder a un hijo exige el patrón `NestedScrollableHost` de Android (código
  nativo) o volver a un pan casero con `react-native-gesture-handler`, que ya se
  descartó por colgarse en MIUI (ver [CONVENTIONS.md](../CONVENTIONS.md)). En su
  lugar el carrusel usa controles explícitos: flechas anchas y puntos pulsables.
- Siguen fuera por restricción de código: Redux / librerías de estado externas,
  librerías UI externas y arquitecturas complejas. Revisar AGENTS.md antes de
  introducir cualquiera.
