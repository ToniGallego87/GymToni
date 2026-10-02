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

Última revisión completa: 2026-10-01.

## Mejoras visuales y de UX

- [ ] **Media app no se puede usar con el lector de pantalla** — el patrón
      correcto está escrito (`accessibilityRole="button"` + `accessibilityLabel`
      en los botones que solo son un icono) pero se aplicó pantalla a pantalla y
      hay vistas enteras que se quedaron fuera. "Nueva rutina" tiene 7 zonas
      pulsables y UNA etiquetada; el Calendario, 4 y ninguna; el campo de
      cardio, 5 y una; Configuración, 2 y ninguna; el calendario de "Fecha del
      entreno", 3 y ninguna. En el registro, las flechas ▲▼ de peso y
      repeticiones son solo un icono y no dicen nada. La barra inferior no dice qué pestaña está
      activa (`accessibilityState={{ selected }}`). En Inicio, la cabecera plegable de la
      tarjeta de progreso no dice si está abierta (`accessibilityState={{ expanded }}`).
      Un botón de solo icono sin etiqueta se anuncia como "botón" a secas.
      Pasar la rúbrica por las que faltan y etiquetarlas con el mismo criterio
      que las ya hechas.
      De paso: las flechas de mes del Calendario (`paddingHorizontal: 10` /
      `paddingVertical: 6` sobre un icono de 22) dan una zona de toque de unos
      42×34 px, por debajo de los 48 dp recomendados y sin `hitSlop`, y son los
      dos únicos controles de navegación de la pantalla. Lo mismo la barra de
      plegar de cada ejercicio del registro (26 px de alto).
      **Por qué:** no es una mejora estética: sin etiqueta esos botones
      simplemente no se pueden usar con TalkBack, y son los de registrar una
      serie, crear una rutina y moverse por el calendario, no rincones. Y es
      barato: el patrón ya está decidido, solo falta aplicarlo.
      **Archivos:** `components/ExerciseInputField.tsx:935` (`StepButton`, las
      flechas ▲▼) y `:1267` (`collapseBar`,
      26 de alto), `features/workout/NewRoutineScreen.tsx:419`, `:507`, `:573`,
      `:589`, `:606`, `:680`, `features/workout/CalendarScreen.tsx:335`, `:354`
      (flechas de mes; estilo `monthNavButton` en `:686`), `:414`, `:515`,
      `components/CardioInputField.tsx:199`, `:257`, `:277`, `:389`,
      `features/workout/SettingsScreen.tsx:185`, `:210`,
      `components/DatePickerModal.tsx:143`, `:157`, `:195`,
      `features/workout/DaySelectorScreen.tsx:188` ("Solo cardio"),
      `components/FloatingPrimaryNav.tsx:104` (sin rol ni estado de pestaña),
      `components/ChartCard.tsx:71` (la cabecera plegable).
      **Esfuerzo:** medio.
- [ ] **El día de cardio se lee distinto en la lista que al abrirlo** — la
      pestaña Cardio agrupa el día POR DISCIPLINA ("Andar en cinta, 69 min,
      3-12 km/h") y el detalle pinta una tarjeta por cada tramo tal como se
      tecleó, así que un día con tres tramos de andar sale como una línea en la
      lista y tres tarjetas casi idénticas al entrar. Pintar
      `cardioSession.disciplines` en vez de `.entries`: ya viene calculado, con
      `totalMinutes`, `kcal` y `minSpeed`/`maxSpeed` para enseñar el rango.
      **Por qué:** es el mismo día contado de dos maneras, y al usuario le parece
      que los números no cuadran. Además corta la repetición: una tarjeta por
      disciplina en vez de una por tramo, que es como el usuario piensa el día
      ("hoy anduve 69 minutos y corrí 8"), no como lo fue tecleando.
      **Archivos:** `features/workout/DetailScreen.tsx:555` (el `.entries.map`),
      `lib/cardio.ts:77` (`MergedCardioEntry`, lo que ya hay calculado),
      `lib/cardio.ts:40` (`CardioSession.disciplines`).
      **Esfuerzo:** bajo.
- [ ] **En el detalle de cardio, el total del día y cada disciplina pesan lo
      mismo** — la tarjeta de resumen y las de disciplina comparten tokens
      EXACTOS (fondo transparente, borde de 1, `GradientFill`, `shadow.soft`) y
      sus cifras también (`fontSize: 22` + `fonts.display`, unidad 12/700). Nada
      dice cuál es el total. Y dentro de cada tarjeta el nombre de la disciplina
      (14/600 en `textSecondary`, icono de 16 también apagado) pesa MENOS que sus
      propios números, así que no se ve de qué va la tarjeta. Dar al resumen
      relleno sólido (`colors.surface` + `shadow.card`) y cifra mayor, dejando
      las disciplinas en el estilo de contorno actual; y subir el titular de cada
      disciplina a `colors.text` con el icono en el acento.
      **Por qué:** el usuario mira esta pantalla para saber "cuánto hice hoy", y
      hoy tiene que deducirlo contando tarjetas. Relleno contra contorno es la
      distinción que la app ya usa en otros sitios, así que no inventa lenguaje.
      **Archivos:** `features/workout/DetailScreen.tsx:825` (`summaryCard`),
      `:869` (`cardioBox`, los mismos valores), `:889` (`cardioLabel`),
      `:845` y `:912` (las dos cifras, idénticas).
      **Esfuerzo:** bajo.
- [ ] **La cabecera del día de cardio no dice de qué fue el día** — el título
      sale de `CARDIO_ONLY_DAY.name` ("Solo cardio", que nombra una limitación en
      vez del contenido) y el icono es la constante `emoji: 'run-fast'`, el mismo
      aunque el día fuera entero en bici. Pasar a "Registro de cardio" con el
      icono de la disciplina que más kcal quemó (`topKcalDiscipline` +
      `disciplineIconName`, las dos ya existen). De paso, usar la prop `icon` de
      `GlassTopBar` en lugar del `titleElement` montado a mano, que es lo que
      mandan `AGENTS.md` y el checklist de `frontend-design.md`.
      **Por qué:** la cabecera es lo primero que se lee y hoy no distingue un día
      de bici de uno de cinta. Y el row icono+texto a mano es una desviación del
      sistema de diseño que ya está escrita como regla.
      **Archivos:** `features/workout/DetailScreen.tsx:664-673` (el
      `titleElement`), `lib/cardio.ts:237` (`CARDIO_ONLY_DAY.name` y `.emoji`),
      `lib/cardio.ts:347` (`topKcalDiscipline`), `components/GlassTopBar.tsx:99`
      (la prop `icon`).
      **Esfuerzo:** bajo.
- [ ] **El subtítulo de la barra superior dice algo vivo, no un eslogan** —
      Inicio, el Detalle y la ficha de rutina usan el hueco del subtítulo para
      orientar (la rutina, la fecha, el estado de la rutina), pero catorce vistas lo gastan en una frase fija que
      repite el título con otras palabras: "Ajusta la app a tu gusto"
      (Configuración), "Selecciona el día que vas a registrar" (Elige la
      sesión), "Tu rutina, tus datos y la configuración" (Perfil), "Consulta
      tus resultados" (Cardio)… Y en Elige la sesión el dato que sí orienta —el
      nombre de la rutina— va en una píldora dorada a la derecha de la barra que
      parece un botón y no lo es. Regla: el subtítulo lleva estado (la rutina
      en Elige la sesión, la versión en Configuración, las
      sesiones de la semana en Cardio…) o no lleva nada.
      **Por qué:** es el texto más visto de cada pantalla, debajo del título.
      Con un dato vivo orienta sin entrar en nada (como ya hace Inicio); con un
      eslogan es ruido que se aprende a no leer. Y quita una pista engañosa (la
      píldora que no se pulsa).
      **Archivos:** `features/workout/DaySelectorScreen.tsx:217` (subtítulo) y
      `:220-228` (la píldora `rightElement`),
      `features/workout/SettingsScreen.tsx:245`,
      `features/workout/ProfileScreen.tsx:295`,
      `features/workout/CardioScreen.tsx:666`,
      `features/workout/CalendarScreen.tsx:304` y `:636`,
      `features/workout/CommunityScreen.tsx:1017`,
      `features/workout/RoutineSelectorScreen.tsx:185`,
      `features/workout/HomeScreen.tsx:1671` (el patrón bueno: el nombre de la
      rutina) y `features/workout/FollowingScreen.tsx:181-186` (el otro patrón
      bueno, ya aplicado: el recuento de la lista).
      **Esfuerzo:** medio.
- [ ] **Perfil: casillas que cuentan qué hay detrás** — en Perfil las cinco
      casillas son un icono de 38 px y una etiqueta suelta, sin ninguna pista de
      qué hay detrás. Al entrar en Configuración, "Datos y nube" es una fila con
      **subtítulo vivo** ("Sincronizado · hace 2 h") y chevron: misma tarea
      (ir a otro sitio), dos lenguajes visuales, y el segundo es claramente el
      bueno porque dice el estado sin entrar. Llevar ese subtítulo a las
      casillas que tienen algo que contar (Rutinas → cuál está activa; Peso →
      el último anotado; Logros → cuántas insignias quedan), manteniendo la
      rejilla. Es la misma regla que la ficha de los subtítulos de la barra,
      aplicada a la rejilla.
      **Por qué:** la rejilla de Perfil es la primera pantalla de "mis cosas" y
      hoy son cinco iconos mudos: hay que entrar en cada uno para saber si hay
      algo que mirar. El patrón que lo arregla ya está escrito una pantalla más
      adentro.
      **Archivos:** `features/workout/ProfileScreen.tsx:121-131` (el array
      `menu`, hoy solo icono + etiqueta) y `:260-290` (el render de la
      casilla), `features/workout/SettingsScreen.tsx:185-206` (la fila con su
      `cloudHint`: el patrón a copiar) y `:72-76` (cómo se construye el hint).
      **Esfuerzo:** medio.
- [ ] **Ficha de rutina: un solo "Compartir" y la comunidad como
      interruptor** — al pie de la ficha hay dos filas casi iguales: "Compartir
      rutina" (QR o texto, para pasársela a alguien) y "Compartir en la
      comunidad" (publicarla en el tablón). Mismo verbo, dos cosas distintas. Y
      la segunda es una fila entera que cambia de estado al tocarla, con una
      etiqueta "Privada/Pública" a la derecha que parece un rótulo, no un
      interruptor. Renombrar la primera a lo que hace ("Enviar a alguien · QR o
      texto") y convertir la segunda en el `OptionToggle` Privada | Pública que
      ya usan Tema e Idioma (opciones excluyentes: es justo su caso). De paso,
      dos reglas de color sin cumplir en la misma ficha: la etiqueta "Pública"
      pinta la tinta `onGold` sobre el verde sólido de éxito (la regla pide
      `onDanger` sobre rellenos de estado) y la tarjeta de cabecera usa la tinta
      `primary` como borde (la regla pide `primaryLine`).
      **Por qué:** publicar expone la rutina y el perfil en el tablón; tiene que
      leerse como un ajuste con dos posiciones, no confundirse con "mandársela a
      un amigo". Y los dos colores fuera de regla son justo los que pierden
      contraste en tema día.
      **Archivos:** `features/workout/RoutineDetailScreen.tsx:911-932` (la fila
      "Compartir rutina"), `:939-972` (la fila de la comunidad y su etiqueta),
      `:1606-1609` (`publicPillOn`: `onGold` sobre `success`), `:1325`
      (`infoBlock`: `primary + '55'` como borde), `components/OptionToggle.tsx`
      (el control a reutilizar).
      **Esfuerzo:** bajo.
- [ ] **Fechas legibles en el historial de Inicio y Cardio** — las tarjetas de
      día del historial de Inicio y la lista de Cardio pintan la fecha en
      numérico ("1/10/2026") con `toLocaleDateString` a pelo, mientras el resto
      de la app habla en "12 jul" o "Lunes, 12/07/2025" con los formateadores
      de `lib/utils.ts`. Pasar las dos a una fecha con día de la semana
      ("lun 12 jul"), que es lo que de verdad se recuerda de un entreno.
      **Por qué:** "1/10/2026" obliga a hacer cuentas (¿eso fue el martes o el
      jueves?); "lun 12 jul" se lee de un vistazo y es más amable. Y cierra la
      última fecha formateada fuera de `utils`.
      **Archivos:** `features/workout/HomeScreen.tsx:768`
      (`getExecutionDateLabel`), `features/workout/CardioScreen.tsx:561-566`,
      `lib/utils.ts:71` (`shortDayMonth`, donde iría la variante con día).
      **Esfuerzo:** bajo.

## Funcionalidades a simplificar

- [ ] **Registrar un ejercicio que no estaba en el día** — el registro solo
      pinta los ejercicios que trae el día de la rutina: si en el gym improvisas
      (máquina ocupada, ejercicio extra), lo que hiciste no se puede apuntar y el
      registro acaba diciendo menos de lo que pasó. Permitir añadir un ejercicio
      suelto a la sesión en curso, guardado con su propio id para que el detalle
      y el histórico lo pinten igual que los demás.
      La **nota de sesión** ya está entregada y cubre el "explicar" lo que pasó
      («gym lleno, cambié banca por mancuernas»); esto es el paso caro que
      queda: que el registro no solo lo explique, sino que lo CONTENGA.
      **Por qué:** entrenar de verdad no sigue la plantilla. Con la nota, el
      histórico ya no miente por omisión silenciosa, pero las series de un
      ejercicio improvisado siguen sin contar para volumen, récords ni progreso.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1205` (el registro
      itera solo `selectedDay.exercises`) y `:803` (el guardado hace lo mismo),
      `types/index.ts:52` (`ExerciseLog.exerciseId` apunta al ejercicio de la
      rutina: un extra necesita id propio),
      `features/workout/DetailScreen.tsx:389` (`getExerciseFromLog` ya resuelve
      por nombre/orden, que es por donde entraría un extra).
      **Esfuerzo:** alto.
- [ ] **Ficha de rutina: editar sin perder el sitio, y cada control con un
      solo significado** — tres roces del modo edición de la ficha. (1) Pulsar
      "Editar" pliega TODOS los días: si estabas mirando el Día 2 para cambiar
      un ejercicio, se cierra y hay que volver a abrirlo. (2) La cabecera de
      cada día cambia de significado según el modo: en lectura pliega y
      despliega; en edición abre el popup "Editar día" (nombre + icono), así
      que en edición solo se pliega con la barra de 26 px del pie, y la única
      pista del cambio es una insignia de 9 px sobre el icono. (3) En una
      rutina cerrada la cabecera enseña un candado mientras sus días y
      ejercicios se editan sin restricción: el candado promete algo que no
      pasa. Propuesta: "Editar" respeta los días abiertos (ordenar los días
      sigue pidiendo tenerlos plegados, como ahora); la cabecera pliega SIEMPRE;
      en edición aparece en ella un botón lápiz rotulado "Editar día"; y el
      candado se quita o dice qué protege exactamente.
      **Por qué:** el caso común de editar es "cambiar un ejercicio del día que
      estoy viendo", y hoy cuesta un toque extra y perder el sitio. Un mismo
      toque que hace dos cosas según el modo obliga a recordar en qué modo
      estás.
      **Archivos:** `features/workout/RoutineDetailScreen.tsx:260-272`
      (`toggleEditing`; el pliegue al entrar, en `:268`), `:626-640` (la
      cabecera: plegar o "Editar día" según el modo), `:644-652` y `:1451` (la
      insignia de 9 px), `:184-187` (`isClosed`) y `:845-861` (el candado),
      `:196` (`canEdit`, que no mira si está cerrada).
      **Esfuerzo:** bajo.
- [ ] **La pestaña de Cardio se esconde de la barra, pero el deslizamiento
      sigue llegando a ella** — sin ningún cardio registrado, la barra inferior
      quita el botón de Cardio (`showCardio`), pero el pager conserva sus cinco
      páginas a propósito, así que deslizando a la derecha desde Inicio se llega
      igual. Y al llegar, la barra pinta cuatro botones con NINGUNO marcado: el
      usuario está en una pantalla que, según la barra, no existe. Quitar el
      ocultado y dejar las cinco pestañas siempre: la pantalla de Cardio vacía ya
      es útil —su hero es el botón "Insertar cardio" y debajo van los retos de
      cardio—, que es justo lo que le hace falta a quien aún no ha registrado
      ninguno.
      **Por qué:** esconder la puerta de entrada de una función a quien todavía
      no la usa es justo al revés: la esconde de quien más falta le hace
      descubrirla. Hoy la única vía visible a una sesión de solo cardio es
      Inicio → subtítulo de la hero → "Elige la sesión" → "Solo cardio", cuatro
      toques colgando del subtítulo de la hero. Y de paso arregla el estado de
      "barra sin pestaña activa", que no debería poder darse.
      El Calendario esconde su selector Fuerza/Cardio con el MISMO criterio
      (`cardioAvailable`), así que la decisión que se tome aquí vale para los
      dos sitios.
      **Archivos:** `app/App.tsx:309` (`showCardio = hasAnyCardio(state.logs)`)
      y `:1496` (donde se pasa a la barra),
      `components/FloatingPrimaryNav.tsx:94` (`visibleItems`, el filtro que
      quita el botón), `app/App.tsx:1038` (`tabLayer`, que mantiene los cinco
      índices del pager a propósito),
      `features/workout/CardioScreen.tsx:371` (la hero "Insertar cardio", que ya
      funciona sin datos), `features/workout/CalendarScreen.tsx:102` y `:374`
      (el mismo ocultado en el selector de modo).
      **Esfuerzo:** bajo.
- [ ] **Los tres números de Perfil no llevan a ninguna parte (y uno cuenta
      doble)** — Perfil remata su tarjeta de identidad con "Rutinas 4 ·
      Entrenamientos 120 · Sesiones cardio 30" en `View`s inertes. Comunidad ya
      resolvió exactamente esta pregunta al revés: allí los contadores **son**
      los caminos a sus listas, con su `Pressable`, su `hitSlop` y su etiqueta.
      Y en Perfil el destino de cada cifra existe ya: Rutinas → la lista de
      rutinas, Entrenamientos → el Calendario, Sesiones cardio → la pestaña de
      Cardio. Encima "Rutinas" aparece DOS veces a dos dedos de distancia —como
      cifra inerte y como casilla pulsable—, que es la peor versión de la
      ambigüedad. Y "Entrenamientos" es `state.logs.length`, que incluye las
      sesiones de solo cardio: una sesión de cinta suma a la vez en
      "Entrenamientos" y en "Sesiones cardio". Contar solo los logs de fuerza
      (`!log.cardioOnly`, el mismo filtro que Inicio).
      **Por qué:** son tres cifras que invitan a tocarlas y no responden, justo
      encima de una rejilla donde todo se toca, y una de ellas está inflada.
      Hacerlas camino cuesta poco, quita la duplicación del rótulo "Rutinas" y
      alinea Perfil con el patrón que Comunidad ya dejó decidido.
      **Archivos:** `features/workout/ProfileScreen.tsx:241-257` (los tres
      contadores, hoy `View`; `:248` el `state.logs.length`), `:121-131` (el
      menú, donde ya viven los destinos), `features/workout/CommunityScreen.tsx:647`
      (el patrón exacto a replicar: `Pressable` + `hitSlop` +
      `accessibilityLabel`), `features/workout/HomeScreen.tsx:271` (el filtro
      `!log.cardioOnly`).
      **Esfuerzo:** bajo.
- [ ] **El ⋯ de un día de cardio ofrece moverlo de semana** — el detalle calcula
      `planWeekMove` sobre `state.logs.filter(l => l.routineId === log.routineId)`,
      un filtro que NO excluye los `cardioOnly`. Pero las semanas sí los
      excluyen en todas partes (`!log.cardioOnly` y el `return` temprano de
      `weeks.ts`), así que el menú puede ofrecer "Mover a la semana anterior /
      siguiente" en una sesión que no pertenece a ninguna semana. Filtrar los
      cardio al armar `routineLogs`, con lo que los dos items desaparecen solos
      en esta vista.
      **Por qué:** una acción que no significa nada aquí, y encima con un
      `ConfirmModal` que avisa de "recalcular racha, progreso e hitos" —
      promete consecuencias sobre algo en lo que el cardio ni participa.
      **Archivos:** `features/workout/DetailScreen.tsx:176` (el filtro),
      `:178-179` (los dos planes), `lib/weeks.ts:364` y `:744` (donde las
      semanas sí excluyen el cardio).
      **Esfuerzo:** bajo.
- [ ] **"Un día = un registro de cardio" es un invariante del modelo que no
      garantiza nadie** — al insertar cardio, el registro REUTILIZA el log que ya
      existe ese día (`existingLog = log || getLatestTodayLog()`) y precarga su
      texto, así que por diseño una fecha tiene un único registro al que se le
      van sumando disciplinas unidas por `" | "`. Nada lo impone: basta un log suelto de
      la misma fecha —churn del autoguardado viejo, o una bajada de la nube— para
      que convivan dos. Consolidarlos en `normalizeAppData`, quedándose con el
      más reciente.
      **Por qué:** los días con registros repetidos **suman dos veces** en Inicio
      y en la pestaña Cardio, mientras el detalle enseña uno solo: un día llegó a
      marcar 325 minutos cuando el entreno real fueron 65. Es el fallo que el
      usuario ve, y el que hizo falta arreglar a mano en once fechas tras la
      pérdida de cardio de 0.8.1. Ojo: NO es la `mergeSameDayCardio` que se quitó
      —aquella mezclaba cardio con FUERZA y deshacía la separación—; esto
      consolida cardio con cardio, que sí es lo que el modelo espera.
      **Archivos:** `lib/normalize.ts` (donde iría), `features/workout/WorkoutLogScreen.tsx:172`
      (el `existingLog` que define el invariante),
      `features/workout/CardioScreen.tsx:277` (el `logs[0]` que hoy elige uno
      cualquiera cuando hay varios).
      **Esfuerzo:** bajo.
- [ ] **Cada guardado del cardio acuña una fila nueva y deja la anterior de
      lápida** — el registro construye el cardio con `generateId()` en cada
      guardado en vez de conservar el id del que el log ya tenía. Como autoguarda
      serie a serie, una misma sesión deja decenas de filas: al subir,
      `reconcileChildren` marca borrada la anterior. Reutilizar `log.cardio?.id`
      cuando exista y, aparte, purgar las lápidas viejas de la nube.
      **Por qué:** de las 681 filas de cardio marcadas que había en Supabase al
      diagnosticar la pérdida de 0.8.1, **531 eran exactamente esto** — hasta 42
      versiones superadas del mismo "Andar en cinta: 53min, 3kmh". Engordan cada
      pull y, sobre todo, fueron el ruido que tapó el daño real: obligaron a
      distinguir a mano qué lápida era una pérdida y cuál basura histórica.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:798-802` (el
      `generateId()` incondicional), `lib/db/mappers.ts:225`
      (`log.cardio.id || newId()`), `lib/cloud/sync.ts:305`
      (`reconcileChildren`, el que pone la lápida).
      **Esfuerzo:** bajo.
- [ ] **El sync tarda 8,5 s en un arranque en frío para no traer nada** — medido
      en garnet con sondas en release: `syncNow` tarda **8,1-8,6 s** y devuelve
      `pulled=0`. `pullDelta` ya lanza las siete tablas en paralelo, así que el
      tiempo es latencia de red: ocho peticiones (las siete tablas más
      `user_settings`, esta última secuencial y después de las otras) para
      descubrir que no hay novedades. Falta un atajo barato que responda "no hay
      nada nuevo" en UNA petición —un `max(updated_at)` por usuario, o una
      columna de reloj en `user_settings` que ya se consulta— y solo baje las
      tablas si ese sello supera el cursor local.
      **Por qué:** el caso normal (un solo dispositivo, nada que reconciliar) es
      el que más veces ocurre y el que más cuesta. Mientras dura, sus
      continuaciones compiten por el hilo JS con lo que el usuario está tocando:
      es lo que obligó a mover el sync a la fase 2 del arranque
      (`background` en `app/App.tsx`), que lo esconde pero no lo arregla.
      **Archivos:** `lib/cloud/sync.ts:750` (`syncNow`), `:667` (`pullDelta`,
      las siete tablas) y `:693` (el `user_settings` de después),
      `supabase/schema.sql` (haría falta el sello).
      **Esfuerzo:** medio.
- [ ] **Inicio sin rutinas: un solo "Crear rutina"** — la primera pantalla de
      todo usuario nuevo tiene la hero "Añade una rutina" (que crea una rutina)
      y, justo debajo, la tarjeta "Primeros pasos" con OTRO botón dorado "Crear
      rutina" que hace lo mismo, más "Ver la comunidad". Dejar la hero como el
      único "crear" y la tarjeta con sus tres pasos y el camino alternativo
      ("Traer una de la comunidad").
      **Por qué:** dos botones dorados con la misma acción en la primera
      pantalla hacen dudar ("¿son distintos?") justo cuando el usuario aún no
      sabe nada de la app. Quitar el repetido deja la elección real a la vista:
      crear o traer.
      **Archivos:** `features/workout/HomeScreen.tsx:871-877` (la hero del
      estado vacío) y `:908-925` (los botones de "Primeros pasos").
      **Esfuerzo:** bajo.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

- [ ] **Restaurar un backup automático desde la app** — la app ya escribe 7
      backups diarios rotativos en `documentDirectory/backups`, pero no hay
      ninguna forma de volver a uno: `listLocalBackups` solo la usa la rotación y
      Datos y nube ni los menciona. Listarlos (fecha y tamaño) con un "Restaurar"
      por entrada, reutilizando el importador que ya existe.
      **Por qué:** es la única red de seguridad que no depende de tener cuenta, y
      hoy es inalcanzable: viven en almacenamiento privado y el APK de release no
      es debuggable, así que ni siquiera se pueden sacar por USB. En la pérdida
      de cardio de 0.8.1 habrían sido la recuperación inmediata; en su lugar hubo
      que reconstruir las sesiones a mano desde las tablas espejo de Supabase.
      **Archivos:** `lib/backup.ts:21` (`AUTO_BACKUP_DIR`, `MAX_AUTO_BACKUPS`),
      `lib/fileIO.ts:140` (`listLocalBackups`), `features/workout/DataScreen.tsx:603`
      (donde están Exportar e Importar).
      **Esfuerzo:** bajo.
- [ ] **Recordatorio de entrenamiento** — notificación local programable por
      día de la semana (la infraestructura de notificaciones ya existe para el
      timer de descanso).
      **Por qué:** la constancia es el producto; un recordatorio a la hora de
      entrenar es la palanca más barata para sostener la racha, y es lo único
      de esta lista que actúa cuando la app está CERRADA (que es cuando se
      pierde la racha).
      **Archivos:** `features/workout/SettingsScreen.tsx:117-182` (los bloques
      de ajuste: tema, idioma y descanso), `features/workout/WorkoutLogScreen.tsx:511-547`
      (`configureNotifications`: canal y permisos a reutilizar) y
      `lib/restTimerStore.ts:195` (`scheduleNotification`, el patrón de
      programado y cancelado ya montado para el descanso).
      **Esfuerzo:** medio.
- [ ] **Actividad en el perfil PROPIO, sin depender de la nube** — la Actividad
      ya está entregada en el perfil de Comunidad (insignias, retos y días con su
      rutina, publicados en la tabla `activity`), pero solo se ve ahí: en Perfil,
      que es "mis cosas", no hay nada equivalente, y quien no tiene cuenta o lo
      tiene en "No compartir" no puede ver su propia trayectoria en ninguna
      parte. Pintarla desde los datos LOCALES, que ya están calculados:
      `buildLocalActivity` existe y devuelve exactamente lo que la lista necesita
      (lo usa la publicación), y `components/ActivityList.tsx` ya la pinta. Es
      enchufar las dos piezas en una pantalla nueva que cuelgue de Perfil, junto
      a Logros.
      **Por qué:** es la mitad barata de la función y la que no depende de nada:
      sin cuenta, sin red y sin haber publicado nada, uno debería poder ver sus
      insignias, sus retos y sus días en una línea de tiempo. Hoy el cálculo se
      hace para subirlo a la nube y no se le enseña a su dueño.
      **Archivos:** `lib/activity.ts` (`buildLocalActivity`, ya escrito),
      `components/ActivityList.tsx` (la lista, ya escrita),
      `features/workout/ProfileScreen.tsx:121-131` (el menú donde iría la
      casilla), `hooks/useAccountLevel.ts:200-225` (de donde salen `badges`,
      `challenges` y `wins` sin recalcular nada).
      **Esfuerzo:** bajo.
- [ ] **Apuntar un entreno olvidado desde el calendario** — en el Calendario,
      una celda de un día pasado SIN entreno está muerta (`disabled`): no se
      puede hacer nada con ella. Hoy rellenar un día olvidado exige adivinar el
      camino (Inicio → hero → el día → tocar la fecha del subtítulo → elegir
      otra), y nada en la app lo sugiere. Que tocar una celda vacía y pasada
      abra "Elige la sesión" con esa fecha ya fijada; la maquinaria está toda
      escrita (el registro ya reasigna fecha, ya avisa si parte una semana y ya
      bloquea las fechas ocupadas).
      **Por qué:** el calendario es exactamente el sitio donde uno SE DA CUENTA
      de que le falta un día; que sea la única pantalla donde no se puede hacer
      nada al respecto es la definición de fricción evitable. Y un histórico con
      huecos rompe racha, % semanal y retos.
      **Archivos:** `features/workout/CalendarScreen.tsx:515-517` (la celda de
      fuerza, hoy `disabled` sin log) y `:414-416` (la gemela de cardio),
      `features/workout/WorkoutLogScreen.tsx:1030` (`applyChosenDate`, que ya
      mueve la fecha y avisa de partir la semana), `app/App.tsx:118` (el
      `Screen` `workout-log`, que ya acepta `origin: 'calendar'`) y `:1265`
      (`DaySelectorScreen`, al que habría que pasarle la fecha).
      **Esfuerzo:** medio.
- [ ] **Récord personal en el momento de meter la serie** — cuando una serie
      supera el mejor registro de ese ejercicio (más peso a esas reps, o mejor
      1RM estimado), su burbuja se pinta en oro con un trofeo pequeño y sale un
      aviso breve "¡Récord!". Hoy los récords solo existen en Progreso por
      ejercicio, a tres pantallas del momento en que se consiguen.
      **Por qué:** es la recompensa más pura de entrenar y ocurre DENTRO del
      registro, que es donde el usuario pasa el rato. Celebrarlo en el instante
      hace la app más amable sin añadir un solo toque, y los datos ya están
      calculados.
      **Archivos:** `lib/exerciseProgress.ts:200` (`getExerciseRecords`, el
      cálculo de récords ya hecho), `components/ExerciseInputField.tsx:414-470`
      (`renderSeriesRow`, la burbuja que se pintaría en oro),
      `features/workout/WorkoutLogScreen.tsx:596` (`handleAddSet`, donde se
      sabe que entra la serie) y el `Toast` que ya monta esa pantalla.
      **Esfuerzo:** medio.
- [ ] **Qué retos han avanzado al terminar el entreno** — la tarjeta "Entreno
      completado · N ejercicios" cierra la sesión sin decir qué ha cambiado.
      Debajo, una línea por reto de fuerza que haya avanzado con esta sesión
      (comparando los retos de antes y después de guardar: "+3 % · 2/2 ✓",
      "Récord personal · 5/16"), enlazando a `ChallengesModal`.
      **Por qué:** es el momento de máxima motivación y hoy se desaprovecha;
      el aviso de "reto superado" ya existe, pero el progreso parcial (que es
      lo habitual) no se enseña en ningún sitio hasta volver a Inicio.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1338` (la tarjeta de
      completado), `hooks/useAccountLevel.ts` (los retos ya están disponibles en
      cualquier pantalla), `components/ChallengesModal.tsx`.
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
      **Archivos:** `lib/cloud/social.ts:79` (`searchProfiles`, patrón exacto
      a replicar con `routines`), `:335` (`getPopularRoutines`, el tope de 50),
      `:362` (`getFollowingFeed`, el otro tope),
      `supabase/social-schema.sql:65-66` (la política "read public routines"
      que ya permite la consulta),
      `features/workout/CommunityScreen.tsx:850` (el campo de búsqueda) y
      `:877` (la sección "Personas", junto a la que iría la de rutinas).
      **Esfuerzo:** medio.

## Descartado por restricciones del proyecto

- **Los retos superados de cada semana en su tarjeta de Inicio**: retirado en la
  revisión del 2026-10-01 tras dos pasadas sin que nadie la tocara. Añadía tres
  iconos más a cada cabecera de semana del historial, que ya lleva %, días y
  chevron, y va contra la línea de esta revisión (menos piezas a la vez en
  Inicio). Las victorias siguen guardadas por semana (`useChallengeWins`), así
  que si algún día se pide verlas, el dato está.
- **Enseñar el segundo entreno de un mismo día en el Calendario**: descartado el
  2026-09-25 por decisión de producto. No va a haber dos entrenos el mismo día:
  en vez de pintar el segundo, la app **impide** crearlo (`takenStrengthDates` en
  `lib/weeks.ts`, "Elige la sesión" y el calendario de "Fecha del entreno"). La
  celda del Calendario ya no oculta nada porque no hay nada que ocultar.
- **Recordar el filtro de la gráfica de Inicio**: descartado el 2026-09-25 por
  decisión de producto. No son la misma pieza: el selector de Cardio elige la
  MODALIDAD con la que se miran los datos (por eso se recuerda), mientras el de
  Inicio es un FILTRO por día, y un filtro no debe sobrevivir a la visita: se
  vuelve a la vista completa.
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
- **Exportar el historial a CSV**: retirado en la revisión del 2026-09-22 tras
  dos meses y medio en el ROADMAP sin que nadie lo pidiera ni lo tocara. El
  análisis que justificaba el CSV ya vive dentro de la app (progreso por semana,
  progreso por ejercicio con sus récords, logros e insignias), y el backup JSON
  de Datos y nube sigue garantizando que los datos no quedan secuestrados. Si
  alguna vez aparece una petición real, vuelve.
- Siguen fuera por restricción de código: Redux / librerías de estado externas,
  librerías UI externas y arquitecturas complejas. Revisar AGENTS.md antes de
  introducir cualquiera.
