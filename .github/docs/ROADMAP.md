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

Última revisión completa: 2026-09-21.

## Mejoras visuales y de UX

- [x] **La insignia "Récord personal" no mide récords y choca con el reto del
      mismo nombre** — el logro `personal-record` de Logros se desbloquea al
      "mejorar una semana respecto a la anterior", pero el reto semanal
      "Récord personal" es superar tu mejor peso en la mitad de los ejercicios
      y el póster de hitos tiene otro "récord" (mayor peso movido). Tres cosas
      distintas con el mismo rótulo. Renombrar la insignia a lo que mide
      ("Semana mejorada") y, ya que la categoría "Progreso" tiene una sola
      insignia y "Semanas" dos, darle escalera como a Fuerza y Cardio: 1 / 5 /
      20 semanas mejoradas y 8 semanas seguidas ("Dos meses") junto a las 4.
      Las cifras (`improvedWeeks`, `bestStreak`) ya se calculan con fechas.
      **Por qué:** el que supera un récord de peso en el gym y ve "Récord
      personal" bloqueado en Logros no entiende qué le falta; y dos categorías
      con una y dos insignias se agotan la primera semana buena, cuando lo que
      sostiene es tener siempre el siguiente escalón a la vista.
      **Archivos:** `lib/badges.ts:322-333` (la insignia `personal-record`:
      id, nombre, descripción), `:26-39` (`BadgeId`), `:157-172`
      (`improvedWeekDates` y `streakDates`, las cifras ya listas),
      `lib/i18n.ts` (traducciones), `lib/__tests__/badges.test.ts`.
      **Esfuerzo:** bajo.
- [x] **Logros: las casillas bloqueadas no dicen cuánto falta y se leen mal** —
      la cuadrícula pinta icono + nombre, en gris si no está; el "37 / 50" y la
      barra solo salen en el popup al tocar, así que para saber por dónde vas
      hay que abrir 13 popups. Poner bajo el nombre de cada casilla bloqueada
      el progreso en pequeño ("37/50") o un anillo fino alrededor del icono
      (el `RestTimerRing` ya dibuja ese anillo), y dejar el popup para la
      condición completa y la fecha. Además: con **cuatro** casillas por fila,
      nombres de 11 pt y `adjustsFontSizeToFit`, "Corazón en marcha" o
      "Medio centenar" se encogen hasta lo ilegible: pasar a **tres** por fila
      (la misma retícula que el menú de Perfil y las casillas de ejercicio).
      Las bloqueadas van a `opacity: 0.6` sobre `surface`: en tema claro
      (blanco sobre casi blanco con texto secundario al 60 %) rozan el mínimo
      de contraste; bajar la opacidad solo del icono y dejar el texto entero.
      Y la categoría "Progreso" es una casilla sola con tres huecos vacíos
      (ver la ficha de la insignia "Récord personal", que le da escalera).
      **Por qué:** una pantalla de logros vive de "me falta poco"; escondido
      tras un toque por insignia, el progreso no empuja, y un nombre que no se
      lee no se recuerda.
      **Archivos:** `features/workout/AchievementsScreen.tsx:140-180` (la
      casilla), `:36` (`TILES_PER_ROW = 4`), `:214-232` (la barra que hoy
      solo vive en el popup), `:331-372` (`tile`, `tileLocked`,
      `tileLabel`: opacidad y cuerpo del nombre),
      `components/RestTimerRing.tsx` (anillo reutilizable).
      **Esfuerzo:** bajo.
- [x] **Nadie explica de dónde salen los puntos ni cuántos retos llevas, y
      desde Logros no se llega a los retos** — la cabecera de Logros dice
      "Nivel 3 · 120 / 225 puntos · 5 / 13 logros" y el popup de premio suelta
      "+10 puntos" o "+25 puntos", pero en ningún sitio se lee la regla (reto
      superado +10, logro +25) ni el total de retos superados, que es la mitad
      del nivel y hoy es invisible. Y los retos, la otra mitad, no tienen
      entrada desde la pantalla que explica el nivel: solo desde la hero de
      Inicio (fuerza) y la de Cardio (cardio), cada una con su mitad. Añadir a
      la cabecera "N retos superados" (ya está en `useChallengeWins`) y la
      regla ("Reto +10 · Logro +25"); debajo, una fila "Retos de la semana
      2/6 →" que abra `ChallengesModal` con **todos** (fuerza + cardio, único
      sitio donde se verían juntos); en `ChallengesModal`, el "+10" junto a
      cada reto. Detalle: la barra superior de Logros pinta la píldora de nivel
      que lleva… a Logros (`showMenu` por defecto); ocultarla ahí.
      **Por qué:** un sistema de puntos que no se puede predecir no motiva; ver
      "23 retos superados" da valor a las semanas pasadas, que hoy se esfuman
      al cambiar de bloque; y la pantalla del nivel debería enseñar las dos
      cosas que lo forman.
      **Archivos:** `features/workout/AchievementsScreen.tsx:116-134` (la
      `summaryCard`) y `:183-188` (el `GlassTopBar` sin `showMenu={false}`),
      `lib/level.ts:18-21` (`XP_PER_CHALLENGE`, `XP_PER_BADGE`) y `:77-80`
      (`useChallengeWins`), `hooks/useAccountLevel.ts` (ya devuelve los siete
      retos), `components/ChallengesModal.tsx:66-107` (la fila de cada reto),
      `components/GlassTopBar.tsx:212-217` (la píldora).
      **Esfuerzo:** bajo.
- [x] **El carrusel de Inicio se lleva la acción principal y no dice qué
      tarjeta se puede tocar** — la hero rota entre "qué toca hoy" (con el CTA
      de empezar), "Esta semana" (volumen) y "Retos de la semana"; el pase
      automático se lleva el botón de entrenar dos de cada tres turnos. Y de
      las tres tarjetas, la primera es un botón entero, la segunda no responde
      al toque y la tercera abre el popup de retos sin ninguna señal de que sea
      pulsable: el mismo dorado, el mismo dibujo, tres comportamientos. Que el
      pase automático no abandone la primera tarjeta mientras el día de hoy
      esté sin entrenar (o vuelva a ella tras dar la vuelta) y rote libremente
      cuando ya se ha entrenado; y que las tarjetas pulsables lo digan (un
      chevron o "Ver retos ›" en el `kicker`), con la de estadísticas abriendo
      la gráfica de progreso de abajo. Mismo tratamiento en Cardio, que
      comparte carrusel y tarjetas.
      **Por qué:** la acción más frecuente de la app es empezar el entreno y
      no debería haber que esperar o pulsar una flecha para verla; y una
      tarjeta que se puede tocar sin parecerlo es una función que no existe
      para quien no la descubre.
      **Archivos:** `components/HeroCarousel.tsx:98-125` (el efecto del pase
      automático; haría falta una prop `autoAdvance` o `holdIndex`),
      `features/workout/HomeScreen.tsx:960-1020` (las tres tarjetas; la de
      retos con `onPress`, la de stats sin él) y `:274` (`todayWorkoutStatus`,
      que ya sabe si hoy está entrenado), `components/HeroStatsCard.tsx:24-38`
      (props: falta una señal visual cuando hay `onPress`),
      `features/workout/CardioScreen.tsx:379-445` (el carrusel gemelo).
      **Esfuerzo:** bajo.
- [ ] **Rendimiento: medir en el móvil y decidir sobre las cinco pestañas
      montadas** — de la revisión de rendimiento quedan dos cosas: (1) medir con
      el Profiler de React DevTools en el móvil redwood (MIUI) el efecto de lo
      ya hecho (cálculo único de retos/logros, miniaturas JPG en vez de GIF,
      mejora por semana memoizada, `value` del Provider estable) y (2) las cinco
      pestañas quedan montadas a la vez (`offscreenPageLimit={4}` +
      `warmTabs`), así que un cambio de logs repinta las cinco aunque se esté
      en una. Alternativas sin perder el cambio de pestaña instantáneo:
      `React.memo` en las pantallas de pestaña con props estables, o que las
      pestañas no activas reciban el estado con un frame de retraso
      (`useDeferredValue`).
      **Por qué:** "velocidad de uso" es la prioridad número uno; sin medir no
      se sabe si lo hecho basta ni si desmontar pestañas compensa el coste de
      volver a montarlas.
      **Archivos:** `app/App.tsx:886-892` y `:926-931` (montaje de pestañas),
      `features/workout/HomeScreen.tsx`, `features/workout/CardioScreen.tsx`,
      `features/workout/CalendarScreen.tsx`,
      `features/workout/CommunityScreen.tsx`,
      `features/workout/ProfileScreen.tsx` (las cinco pantallas de pestaña).
      **Esfuerzo:** medio.
- [x] **Dos "⋯" en el registro que abren cosas distintas** — el ⋯ de la barra
      superior despliega un menú de opciones (Ir a la rutina, temporizador,
      descarga, tema) y el ⋯ de cada tarjeta de ejercicio abre un `AppModal`
      centrado con dos o tres opciones y un pie "Volver". Mismo icono, mismo
      significado ("más acciones"), dos superficies. Pasar las acciones del
      ejercicio (nota, cronómetro, saltar) a un menú desplegable anclado al
      ⋯ de la tarjeta, con el mismo dibujo que el de `GlassTopBar`
      (`themeMenu`: lista de icono + texto, cierre al tocar fuera).
      **Por qué:** el modal exige un toque más ("Volver") para no hacer nada y
      tapa la tarjeta desde la que se abrió; el menú anclado deja ver el
      ejercicio al que pertenece y se cierra solo. Y un ⋯ que se comporta
      distinto según dónde esté es una regla menos que el usuario puede
      aprender.
      **Archivos:** `components/ExerciseInputField.tsx:553-572` (el ⋯ de la
      tarjeta) y `:944-1027` (el `AppModal` de acciones),
      `components/GlassTopBar.tsx:235-265` (el menú desplegable a replicar,
      `themeMenu` y `themeMenuItem`).
      **Esfuerzo:** medio.
- [x] **Transición de tema que revele el contenido real, no un disco opaco** — el
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

- [ ] **Inicio enseña el progreso de la semana en dos sitios** — la segunda
      tarjeta del carrusel ("Esta semana": kg levantados, entrenos · series, y
      semana pasada / media / mejor) y, justo debajo, la tarjeta de progreso
      de la rutina (nombre, % de mejora y, desplegada, la gráfica por semanas
      con filtro por día). Dos cabeceras doradas seguidas para "cómo va la
      semana", y la del carrusel además desaparece sola a los 5 s. Fundirlas:
      la fila de volumen (kg, entrenos, series y sus tres referencias) pasa a
      la tarjeta de progreso como segunda línea de su cabecera o como primer
      bloque al desplegarla, y el carrusel queda con dos tarjetas (qué toca
      hoy y retos), que es también la manera más limpia de que el CTA no se
      pierda. Cardio tiene el mismo par (tarjeta "Esta semana" de kcal +
      gráfica semanal): decidirlo para las dos a la vez.
      **Por qué:** menos scroll y menos dorado compitiendo en la primera
      pantalla; el dato de volumen gana contexto junto a la gráfica y deja de
      rotar; y el carrusel de dos tarjetas reduce a la mitad las veces que el
      botón de entrenar no está a la vista.
      **Archivos:** `features/workout/HomeScreen.tsx:980-1002` (la tarjeta
      "Esta semana"), `:665-770` (`strengthStats` y `strengthHeroStats`,
      los datos a mover), `:1060-1150` (la tarjeta de progreso y su
      cabecera), `features/workout/CardioScreen.tsx:379-445` (el par gemelo
      de Cardio).
      **Esfuerzo:** medio.
- [ ] **El reto "Tres días" da puntos pero no se ve en ningún sitio** — se
      calcula, se apunta como superado (+10) y sube el nivel, pero la hero de
      Inicio lo filtra (`c.id !== 'three-days'`) y el popup de retos recibe esa
      misma lista, así que el usuario recibe "¡Reto superado! Tres días" de un
      reto que nunca ha visto. Además solapa con "Semana completa" en rutinas
      de tres días. Quitarlo del catálogo (las victorias ya apuntadas siguen
      contando para el nivel: son claves guardadas) o, si se quiere conservar,
      dejar de filtrarlo.
      **Por qué:** un premio por algo que no se ve no motiva, desconcierta; y
      cuatro retos de fuerza en una tarjeta de tres huecos es el motivo de que
      se esté filtrando.
      **Archivos:** `lib/challenges.ts:176-187` (la ficha `three-days`) y
      `:36-44` (`ChallengeId`), `features/workout/HomeScreen.tsx:182-184`
      (el filtro), `lib/__tests__/challenges.test.ts` (lo comprueba).
      **Esfuerzo:** bajo.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

- [ ] **Qué retos han avanzado al terminar el entreno** — la tarjeta "Entreno
      completado · N ejercicios" cierra la sesión sin decir qué ha cambiado.
      Debajo, una línea por reto de fuerza que haya avanzado con esta sesión
      (comparando los retos de antes y después de guardar: "+3 % · 2/2 ✓",
      "Récord personal · 5/16"), enlazando a `ChallengesModal`.
      **Por qué:** es el momento de máxima motivación y hoy se desaprovecha;
      el aviso de "reto superado" ya existe, pero el progreso parcial (que es
      lo habitual) no se enseña en ningún sitio hasta volver a Inicio.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1230-1245` (la
      tarjeta de completado), `hooks/useAccountLevel.ts` (los retos ya están
      disponibles en cualquier pantalla), `components/ChallengesModal.tsx`.
      **Esfuerzo:** medio.
- [ ] **Los retos superados de cada semana, en su tarjeta de Inicio** — las
      victorias se guardan por semana de rutina (`id@rutina:bloque`), así que
      cada tarjeta de semana del historial de Inicio puede llevar sus retos
      conseguidos (tres iconos pequeños junto al %, en oro los superados). Hoy
      al cambiar de bloque los retos de la semana anterior desaparecen sin
      rastro.
      **Por qué:** convierte el nivel en algo que se ve crecer semana a semana
      en el sitio donde ya se mira la semana; y da un motivo para revisar el
      historial.
      **Archivos:** `lib/level.ts:77-89` (`useChallengeWins`, claves
      `challengeWinKey`), `lib/challenges.ts:118-122` (la `periodKey`
      `rutina:bloque`), `features/workout/HomeScreen.tsx:1225-1260` (la
      cabecera de cada semana).
      **Esfuerzo:** medio.
- [ ] **Recordatorio de entrenamiento** — notificación local programable por
      día de la semana (la infraestructura de notificaciones ya existe para el
      timer de descanso).
      **Por qué:** la constancia es el producto; un recordatorio a la hora de
      entrenar es la palanca más barata para sostener la racha.
      **Archivos:** `features/workout/SettingsScreen.tsx:108-140` (los bloques
      de ajuste, donde ahora viven tema e idioma),
      `features/workout/WorkoutLogScreen.tsx:438-474` (`configureNotifications`:
      canal y permisos a reutilizar) y `lib/restTimerStore.ts:172-190`
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
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1107` (el registro
      itera solo `selectedDay.exercises`) y `:730` (el guardado hace lo mismo),
      `types/index.ts:52-61` (`ExerciseLog.exerciseId` apunta al ejercicio de la
      rutina: un extra necesita un id propio que Detalle resuelva por
      nombre/orden, como ya hace `getExerciseFromLog` en
      `features/workout/DetailScreen.tsx:392`).
      Alternativa ligera: la ficha "Nota de sesión", justo debajo, cubre el
      "cambié banca por mancuernas" sin tocar el modelo.
      **Esfuerzo:** alto.
- [ ] **Nota de sesión** — además de las notas por ejercicio: "gym lleno,
      cambié banca por mancuernas".
      **Por qué:** el contexto del día explica los datos raros al revisar el
      histórico, y hoy no hay dónde apuntarlo.
      **Archivos:** `types/index.ts:73-93` (`WorkoutLog`, campo nuevo: hoy
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
      **Archivos:** `lib/cloud/social.ts:79-91` (`searchProfiles`, patrón exacto
      a replicar con `routines`), `:335-341` (`getPopularRoutines`, el tope de
      50), `:362-375` (`getFollowingFeed`, el otro tope),
      `supabase/social-schema.sql:54-58` (la política "read public routines" que
      ya permite la consulta),
      `features/workout/CommunityScreen.tsx:831` (el campo de búsqueda) y
      `:858` (la sección "Personas", junto a la que iría la de rutinas).
      **Esfuerzo:** medio.
- [ ] **Exportar CSV además de JSON** — para abrir el historial en Excel.
      **Por qué:** el JSON del backup no se puede analizar sin herramientas; un
      CSV por series abre el análisis libre a cualquiera.
      **Archivos:** `lib/fileIO.ts:60-104` (`downloadJsonFile` como patrón; nueva
      salida CSV), `app/App.tsx:789` (`handleExportData`),
      `features/workout/DataScreen.tsx:598-604` (botón nuevo junto a Exportar, en
      el bloque "Copias de seguridad").
      **Esfuerzo:** bajo.

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
- **Arrastrar para reordenar días**: se descartó por la regla "nada escondido
  tras un gesto" y por el riesgo de cuelgue en MIUI; como el arrastre de
  **ejercicios** (`components/SortableList.tsx`) no falló, se hizo también
  para los días (solo con todos plegados). Si en MIUI cuelga, vuelve aquí y
  se retira.
- Siguen fuera por restricción de código: Redux / librerías de estado externas,
  librerías UI externas y arquitecturas complejas. Revisar AGENTS.md antes de
  introducir cualquiera.
