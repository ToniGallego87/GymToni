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

Última revisión completa: 2026-09-10.

## Mejoras visuales y de UX

- [ ] **Dos entrenos el mismo día: el Calendario solo enseña uno, y al otro no
      se llega** — la celda del día se queda con el **primer** log de fuerza que
      encuentra (`dayLogs.find(...)`) y pinta su icono, su color y su semana. El
      segundo —una sesión doble, o el día que se registró dos veces porque se
      partió el entreno— no aparece por ninguna parte de esta pantalla: no hay
      marca de "hay más", la celda no lo insinúa y tocarla abre siempre el
      mismo. Inicio sí los lista los dos, así que el Calendario contradice al
      histórico. Como mínimo, marcar la celda con varios entrenos (un punto, un
      "2") y que el toque ofrezca elegir; lo ideal, apilar los iconos.
      **Por qué:** es la única pantalla que responde "¿qué hice el día 14?", y
      hoy miente por omisión sobre los días que más se entrenó. Y el dato ya
      está cargado: `logsByDate` guarda el array entero y solo se usa el [0].
      **Archivos:** `features/workout/CalendarScreen.tsx:452-460` (`dayLogs`
      completo y `primaryLog` quedándose con el primero), `:461-482` (color,
      borde, chip de rutina y semana, todos derivados de ese único log),
      `:487-496` (el `onPress` que abre solo ese), `:151-163` (`logsByDate`, que
      ya agrupa TODOS los logs por fecha),
      `features/workout/HomeScreen.tsx:1027` y `:1212-1222` (el histórico de
      Inicio, que sí los pinta los dos).
      **Esfuerzo:** medio.
- [ ] **Fuera de Inicio y Cardio, el porcentaje de mejora se pinta de tres
      formas más** — `TrendDelta` nació como "único componente para el indicador
      de subida/bajada" (lo dice su propia documentación) y se usa **solo** en
      Inicio y Cardio. El mismo dato aparece además: en el registro, como una
      píldora con fondo tintado y un `↑` de texto en 13/800; en el Detalle de la
      sesión, como un número suelto en la tarjeta de resumen con el estilo de
      los otros totales; y en cada ejercicio del Detalle, como una cadena
      `improvementText` que arma el llamante y el componente pinta en verde o
      rojo. Tres tipografías, tres tamaños, ninguna animación y el "igual" (el
      `=` ámbar que `TrendDelta` sí distingue) reducido a un símbolo de texto.
      Pasar los tres a `TrendDelta`.
      **Por qué:** es el número que dice si vas mejor, y se lee varias veces en
      cada sesión: si cambia de forma entre la pantalla donde lo registras y la
      pantalla donde lo consultas, nadie puede saber que mide lo mismo. Inicio
      ya hizo esta migración; estos tres son las copias que quedaron.
      **Archivos:** `components/TrendDelta.tsx:31-42` (la documentación de
      fuente única), `components/ExerciseInputField.tsx:376-405` (el badge y
      `:1199-1212` sus estilos), `features/workout/DetailScreen.tsx:409-416`
      (`formatImprovementDisplay`), `:317-345` (la celda "Progreso" de la
      tira-resumen, que arma el símbolo a mano) y `:526-547` (lo que se le pasa
      a `ExerciseResultDisplay`),
      `components/ExerciseResultDisplay.tsx:152-167` (`improvementText` como
      texto plano) y `:279-283` (su estilo).
      **Ojo:** `TrendDelta` anima el número desde 0 (`AnimatedCounter`). En la
      fila por serie de `ExerciseResultDisplay` (`STATUS_GLYPH`, `:55-60`) NO
      procede: ahí la flecha es una comparación por serie sin porcentaje, no el
      indicador de mejora; esa se queda como está.
      **Esfuerzo:** bajo.
- [ ] **Transición de tema que revele el contenido real, no un disco opaco** — el
      cambio claro/oscuro anima un círculo de color sólido que tapa la pantalla;
      se pide que ese círculo no sea opaco sino que muestre ya el contenido de la
      vista en el tema de destino, para que sea una transición visual entre las
      dos pieles y no un barrido de color plano.
      **Por qué:** el disco de color maciza la transición; ver la UI de destino
      crecer desde el punto pulsado haría el cambio de tema mucho más pulido.
      **Archivos:** `components/ThemeRevealOverlay.tsx:132-148` (hoy pinta un
      `Animated.View` con `backgroundColor: request.discColor`; para revelar
      contenido real haría falta una captura/snapshot de la vista en el tema de
      destino recortada por el círculo, sin librerías UI externas). Requiere
      validar rendimiento a 60 fps.
      **Esfuerzo:** alto.

## Funcionalidades a simplificar

- [ ] **Progreso por ejercicio saca el buscador y el raíl de orden con dos
      ejercicios en la lista** — las dos piezas de chrome se montan con la misma
      condición, `exercises.length > 1`. Así que en las primeras semanas de uso,
      con dos o tres ejercicios registrados, la pantalla es una caja de búsqueda
      de 46 px más un raíl de cuatro chips (Reciente / Nombre / Sesiones / 1RM)
      encima de **dos filas** que caben enteras sin scroll: más control que
      contenido, para ordenar y buscar en algo que ya se ve de un vistazo.
      Subir los umbrales a partir de los cuales aparece cada uno (ordenar cuando
      la lista deja de verse entera, buscar cuando deja de caber en una
      pantalla).
      **Por qué:** el primer contacto con la pantalla es justo cuando menos
      datos hay, y hoy es cuando más recargada se ve. No se pierde nada: los dos
      controles vuelven en cuanto la lista es lo bastante larga para que sirvan,
      que es la única situación en la que hacen algo por el usuario.
      **Archivos:** `features/workout/ExerciseProgressScreen.tsx:332-362` (el
      buscador y su condición), `:364-377` (el raíl de orden con la misma
      condición), `:65` (`PAGE_SIZE`, la otra constante que gobierna la lista) y
      `:70-75` (`SORT_OPTIONS`).
      **Esfuerzo:** bajo.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

- [ ] **Recordatorio de entrenamiento** — notificación local programable por
      día de la semana (la infraestructura de notificaciones ya existe para el
      timer de descanso).
      **Por qué:** la constancia es el producto; un recordatorio a la hora de
      entrenar es la palanca más barata para sostener la racha.
      **Archivos:** `features/workout/SettingsScreen.tsx:107-145` (los bloques
      de ajuste, donde ahora viven tema e idioma),
      `features/workout/WorkoutLogScreen.tsx:418-459` (`configureNotifications`:
      canal y permisos a reutilizar) y `lib/restTimerStore.ts:114-147`
      (`scheduleNotification`, el patrón de programado y cancelado ya montado
      para el descanso).
      **Esfuerzo:** medio.
- [ ] **Registrar un ejercicio no planificado durante la sesión** — hoy el
      registro solo pinta los ejercicios que trae el día de la rutina; si en el
      gym improvisas (máquina ocupada, ejercicio extra) no hay dónde meterlo.
      Permitir añadir un ejercicio suelto a la sesión en curso, guardándolo con
      su propio id para que el detalle y el histórico lo muestren igual que los
      demás.
      **Por qué:** entrenar de verdad no siempre sigue la plantilla; poder
      apuntar lo que hiciste evita que el registro mienta o se quede corto.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1075` (el registro
      itera solo `selectedDay.exercises`) y `:706` (el guardado hace lo mismo),
      `types/index.ts:51-59` (`ExerciseLog.exerciseId` apunta al ejercicio de la
      rutina: un extra necesita un id propio que Detalle resuelva por
      nombre/orden, como ya hace `getExerciseFromLog` en
      `features/workout/DetailScreen.tsx:315-337`).
      Alternativa ligera: la ficha "Nota de sesión", justo debajo, cubre el
      "cambié banca por mancuernas" sin tocar el modelo.
      **Esfuerzo:** alto.
- [ ] **Nota de sesión** — además de las notas por ejercicio: "gym lleno,
      cambié banca por mancuernas".
      **Por qué:** el contexto del día explica los datos raros al revisar el
      histórico, y hoy no hay dónde apuntarlo.
      **Archivos:** `types/index.ts:70-91` (`WorkoutLog`, campo nuevo: hoy
      `notes` solo existe en `ExerciseLog` y `CardioLog`),
      `features/workout/WorkoutLogScreen.tsx`,
      `features/workout/DetailScreen.tsx`, `lib/db/schema.ts` (columna nueva +
      migración) y `lib/db/mappers.ts` (mapear la columna). **Ojo sync:** una
      columna nueva de dominio hay que reflejarla también en la tabla espejo de la
      nube (`supabase/schema.sql`) y en el mapeo de `lib/cloud/sync.ts` /
      `applyRemoteChanges`.
      **Esfuerzo:** medio.
- [ ] **Buscar rutinas en el tablón, no solo personas** — el tablón de
      "Populares" trae **como mucho 50 rutinas** ordenadas por likes, sin
      paginación; el feed de "Siguiendo", otras 50. Una rutina que no entre en
      ese top es inalcanzable salvo que sepas quién la hizo y llegues por su
      perfil. Y la lupa de la pantalla, que es lo primero que uno tocaría para
      buscarla, solo busca personas. Añadir la búsqueda de rutinas públicas por
      nombre (y descripción) al mismo campo, como una segunda sección junto a la
      de "Personas" que ya existe.
      **Por qué:** es el techo del tablón: a partir de unas decenas de rutinas
      publicadas, descubrir deja de funcionar. La consulta es de una línea (la
      RLS de lectura pública ya está puesta) y la lupa ya está en pantalla.
      **Archivos:** `lib/cloud/social.ts:35-46` (`searchProfiles`, patrón exacto
      a replicar con `routines`), `:304-320` (`getPopularRoutines`, el tope de
      50), `:331-360` (`getFollowingFeed`, el otro tope),
      `supabase/social-schema.sql:54-58` (la política "read public routines" que
      ya permite la consulta),
      `features/workout/CommunityScreen.tsx:692-716` (el campo de búsqueda) y
      `:745-757` (la sección "Personas", junto a la que iría la de rutinas).
      **Esfuerzo:** medio.
- [ ] **Exportar CSV además de JSON** — para abrir el historial en Excel.
      **Por qué:** el JSON del backup no se puede analizar sin herramientas; un
      CSV por series abre el análisis libre a cualquiera.
      **Archivos:** `lib/fileIO.ts:60-104` (`downloadJsonFile` como patrón; nueva
      salida CSV), `app/App.tsx:687-692` (`handleExportData`),
      `features/workout/DataScreen.tsx:482-490` (botón nuevo junto a Exportar, en
      el bloque "Copias de seguridad").
      **Esfuerzo:** bajo.
- [ ] **Widget Android** — estado de la semana en curso en la pantalla de
      inicio del móvil.
      **Por qué:** ver la semana a medias sin abrir la app empuja a completarla.
      **Archivos:** `android/app/src/main/java/com/tonigallego/gymbro/` (módulo
      nativo nuevo; el patrón de módulo local ya existe en `modules/pip-timer`,
      recién estrenado), `lib/weeks.ts:433` (`computeStreak`) y `:517`
      (`buildWeekProgress`), de donde salen los datos de la semana.
      **Ojo:** lleva varias pasadas aquí sin que nadie la toque. Si en la próxima
      revisión sigue igual, bórrala: el recordatorio por notificación cubre más
      barato el mismo "empújame a completar la semana".
      **Esfuerzo:** alto.

## Descartado por restricciones del proyecto

- **Autenticación, sincronización cloud y social** ya **no** están descartados:
  fueron el epic de backend (Supabase, por fases), **ya entregado** (cuentas +
  backup, sync incremental y social: perfiles, seguir, tablón, comentarios y
  reportes). Ver [backend-design.md](backend-design.md).
- **Dashboard web e IA**: sin planificar por ahora — no por restricción, sino
  por prioridad; se replantearán cuando el backend esté asentado.
- **Arrastrar el héroe de Inicio/Cardio para cambiar de tarjeta**: el gesto
  horizontal lo gobierna el `PagerView` nativo de las pestañas, y hacérselo
  ceder a un hijo exige el patrón `NestedScrollableHost` de Android (código
  nativo) o volver a un pan casero con `react-native-gesture-handler`, que ya se
  descartó por colgarse en MIUI (ver [CONVENTIONS.md](../CONVENTIONS.md)). En su
  lugar el carrusel usa controles explícitos: flechas anchas y puntos pulsables.
- **Arrastrar para reordenar días o ejercicios** (drag & drop): exigiría
  `react-native-gesture-handler` con `Reanimated` sobre listas anidadas — el
  mismo pan casero que ya se colgó en MIUI— o una librería UI externa, las dos
  fuera por AGENTS.md. El reordenado se queda en botones visibles (flechas), que
  además cumplen la regla de "nada escondido tras un gesto".
- Siguen fuera por restricción de código: Redux / librerías de estado externas,
  librerías UI externas y arquitecturas complejas. Revisar AGENTS.md antes de
  introducir cualquiera.
