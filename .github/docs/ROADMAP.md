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

Última revisión completa: 2026-10-09.

## Mejoras visuales y de UX

- [x] **Una sola forma de escribir la fecha de un entreno** — el mismo entreno
      se fecha de tres maneras según la pantalla: "Jue 9 oct" en el historial
      de Inicio y de Cardio, "Jueves, 09/10/2026" en el Detalle, "09/10/2026" en
      el registro y "Entreno del 09/10/2026" en Elige la sesión. Usar en todas
      la de los historiales (`weekdayDayMonth`), con el año solo si no es el
      actual, y quitar los dos `split('-').reverse().join('/')` escritos a mano.
      **Por qué:** se pasa de Inicio al Detalle y de ahí al registro en dos
      toques, y la fecha cambia de cara en cada uno; con una sola forma se
      reconoce el día de un vistazo, sin leer números.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1033`
      (`getSubtitleDate`), `features/workout/DetailScreen.tsx:285`,
      `features/workout/DaySelectorScreen.tsx:404`, `lib/utils.ts:81`
      (`weekdayDayMonth`) y `:111` (`formatDateFromKey`).
      **Esfuerzo:** bajo.
- [x] **El popup de cardio dice qué disciplina es y cuánto vale** — al tocar
      una casilla, el popup se titula "Detalles del cardio" con el mismo icono
      de correr sea cual sea la disciplina: si tocaste la que no era, no lo
      ves hasta guardar. Y la velocidad es opcional, pero sin ella la entrada
      vale 0 kcal (`estimateEntryKcal`) sin que nada lo diga, y las kcal son
      lo que mueve la hero, la gráfica y los tres retos de cardio. Titular el
      popup con el nombre y el icono de la disciplina, enseñar las kcal
      estimadas mientras se teclea ("≈ 245 kcal") y, si falta la velocidad,
      decirlo ("Sin velocidad no se calculan kcal").
      **Por qué:** una sesión metida sin km/h cuenta como cero para los retos
      y nadie lo descubre hasta ver la pestaña de Cardio en blanco; verlo en
      el momento de apuntarla es lo único que lo evita.
      **Archivos:** `components/CardioInputField.tsx:96` (`modalTitle`) y
      `:289` (icono fijo), `lib/cardio.ts:182` (sin velocidad → 0 kcal),
      `lib/challenges.ts:291` (retos de cardio por kcal).
      **Esfuerzo:** bajo.
- [x] **Cambiar la fecha desde el Detalle avisa igual que desde el registro** —
      el registro avisa de dos conflictos al cambiar la fecha ("¿Dividir la
      semana?" y "¿Semana aparte?"), pero el Detalle solo del primero: mover un
      entreno a un hueco entre dos semanas cerradas lo deja solo en una semana
      nueva sin decir nada. Y el Detalle es justo adonde manda Inicio para
      rellenar un día que faltó. Sacar el `dateConflict` del registro a
      `lib/weeks.ts` y usarlo en las dos pantallas.
      **Por qué:** una semana aparte cambia la racha, el % de progreso y los
      hitos; la misma acción no puede avisar en una pantalla y callar en la
      otra.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1043`
      (`dateConflict`), `features/workout/DetailScreen.tsx:115`
      (`applyChosenDate`, solo `assignmentDuplicatesDayInWeek`),
      `lib/weeks.ts:339` y `:372`, `features/workout/HomeScreen.tsx:1536` (el
      aviso que manda al Detalle).
      **Esfuerzo:** bajo.
- [x] **La hero de Cardio enseña lo de hoy** — bajo "Insertar cardio" van tres
      referencias en kcal ("hace 7 días", "media diaria", "mejor día"), pero
      no la cifra con la que compararlas: lo que llevas hoy. Y la tarjeta dice
      lo mismo antes y después de entrenar, mientras la de Inicio cambia a
      "Continúa tu entrenamiento". Con cardio hoy, que la hero lo diga
      ("Seguir con el cardio de hoy") y que las kcal de hoy sean el número
      grande frente a esas tres referencias.
      **Por qué:** las referencias sin el dato de hoy no responden "¿voy bien?",
      que es a lo que se mira esa tarjeta; y es la misma pregunta que la hero
      de fuerza ya contesta.
      **Archivos:** `features/workout/CardioScreen.tsx:326` (`heroStats`) y
      `:396` (la hero), `components/HeroCard.tsx` (`stats`, `subtitle`),
      `features/workout/HomeScreen.tsx:695` (el estado "Continúa" de fuerza).
      **Esfuerzo:** bajo.
- [x] **Borrar una serie (o una entrada de cardio) se puede deshacer** — cada
      burbuja de serie lleva una × de 16 px (36 dp con su `hitSlop`, por
      debajo de los 48 recomendados) y las burbujas van a 6 px unas de otras:
      un toque torpe con el pulgar borra una serie al instante y sin vuelta
      atrás. Lo mismo la × de cada entrada del registro de cardio, que además
      se dibuja distinta (aspa roja en caja frente al disco con aspa de las
      series) para la misma acción. Al borrar, sacar un aviso "Serie borrada ·
      Deshacer" que la devuelva a su sitio (el `Toast` ya admite una acción),
      en vez de pedir confirmación, que encarecería el borrado bueno; y una
      sola marca de borrar en los dos registros.
      **Por qué:** se borra entre serie y serie, de pie y con prisa; deshacer
      quita el miedo al error sin añadir un paso a quien borra a propósito.
      **Archivos:** `components/ExerciseInputField.tsx:49`
      (`SERIE_REMOVE_SIZE`) y `:491` (la ×),
      `features/workout/WorkoutLogScreen.tsx:680` (`handleRemoveSet`),
      `components/CardioInputField.tsx:230` y `:457` (`clearButton`),
      `components/Toast.tsx:20` (`actionLabel` / `onAction`).
      **Esfuerzo:** bajo.
- [x] **Lo apuntado de cardio, debajo de las casillas y con su total** — al
      guardar la primera disciplina aparece la tarjeta "Cardio" ENCIMA de las
      casillas y las empuja hacia abajo: la casilla que ibas a tocar para la
      segunda ya no está donde estaba. Y esa tarjeta se titula "Cardio", lo
      mismo que la barra de arriba, sin decir cuánto llevas. Dejar las
      casillas fijas arriba y la lista debajo (el mismo criterio que las
      burbujas de serie, que crecen bajo el botón para no moverlo), rotulada
      con el total del día ("Hoy · 75 min · 540 kcal") y las kcal de cada fila.
      **Por qué:** con varias disciplinas por sesión, cada guardado mueve la
      rejilla que se usa a continuación; y el total es lo que se viene a ver
      al terminar.
      **Archivos:** `components/CardioInputField.tsx:186` (la tarjeta, antes
      de la rejilla), `:196` (el título "Cardio") y `:251` (la rejilla),
      `components/ExerciseInputField.tsx` (el patrón: series bajo el botón).
      **Esfuerzo:** bajo.
- [ ] **En edición, cada ejercicio enseña su plan** — en lectura, la ficha de
      una rutina pinta cada ejercicio con su GIF y sus series × reps; al pulsar
      "Editar" se convierte en una lista que solo dice el nombre, así que para
      comprobar cuántas series tenía algo hay que abrir su popup, uno a uno. Lo
      mismo en Nueva rutina, que usa la misma fila. Poner "3 × 8-10" bajo el
      nombre de cada fila del editor.
      **Por qué:** se entra a editar casi siempre para tocar series o reps; ver
      el plan de todo el día mientras se edita evita abrir y cerrar popups solo
      para leer.
      **Archivos:** `components/ExerciseFormRow.tsx:272` (la fila: solo el
      nombre), `components/ExerciseTileGrid.tsx:80` (el plan que sí sale en
      lectura), `features/workout/NewRoutineScreen.tsx:477`.
      **Esfuerzo:** bajo.
- [x] **La duración del entreno del Detalle no sale nunca** — la tira de
      resumen del Detalle pinta "min" con el hueco entre el primer y el último
      ejercicio (`timestamp` de cada uno), pero el registro reescribe TODOS los
      `timestamp` a `Date.now()` en cada autoguardado: todos valen lo mismo, la
      cuenta da 0 y la celda se oculta. Conservar el `timestamp` de un
      ejercicio desde su primera serie (o guardar inicio y fin de la sesión);
      si no se quiere el dato, quitar la celda.
      **Por qué:** es la única duración que enseña la app y hoy es código que
      nunca se ve; o se arregla o sobra.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:866`,
      `features/workout/DetailScreen.tsx:311` (`workoutMinutes`),
      `lib/db/mappers.ts` (`created_at` de `exercise_logs`).
      **Esfuerzo:** bajo.
- [x] **El bloque de descanso se arrastra sin que nada lo diga** — el descanso
      flota sobre el ejercicio que estás metiendo y se puede subir arrastrándolo
      (`PanResponder`), pero no lleva asa ni pista; el propio comentario del
      código habla de un "asa de arrastre" que no se dibuja. Pintar un asa
      visible arriba del bloque (el mismo icono de arrastre que `SortableList`).
      Con la bajada automática al ejercicio siguiente (ficha de "Funcionalidades
      a simplificar") el bloque tapará la tarjeta en curso muchas menos veces:
      el asa queda para los casos que aún lo hagan.
      **Por qué:** AGENTS: nada escondido tras un gesto. Hoy quien no lo
      descubre por accidente se queda con el bloque tapando la serie siguiente
      durante todo el descanso.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:436` (el gesto) y
      `:1199` (el contenido del bloque), `components/SortableList.tsx` (el asa
      a reutilizar).
      **Esfuerzo:** bajo.
- [ ] **La semana en curso se dibuja de dos maneras** — Inicio la pinta como
      una fila con el icono de cada día (verde hecho, aro dorado el que toca,
      anillo que se llena el de hoy) y Elige la sesión, un toque después, como
      una barra de segmentos sin iconos. Sacar la fila de Inicio a un
      componente y usarla también en la cabecera de Elige la sesión.
      **Por qué:** es el mismo dato en dos pantallas seguidas; con el mismo
      dibujo se reconoce sin volver a leerlo, y la barra no dice qué día
      falta.
      **Archivos:** `features/workout/HomeScreen.tsx:1120` (`weekDaysRow`),
      `features/workout/DaySelectorScreen.tsx:151` (`weekBar`).
      **Esfuerzo:** bajo.
- [x] **Rótulos que no cambian de idioma en caliente** — cuatro listas llaman a
      `t()` al cargar el módulo, contra la regla de `lib/i18n.ts`: el filtro de
      la gráfica de Cardio ("Minutos", "Distancia"…), el de Progreso por
      ejercicio, el selector Fuerza | Cardio del Calendario y las disciplinas
      del registro de cardio se quedan en el idioma de arranque hasta reiniciar.
      Moverlas al render, como ya hacen los meses del Calendario. (Las
      disciplinas se guardan con su rótulo, pero `disciplineIdFromLabel` ya
      reconoce los dos idiomas.)
      **Por qué:** cambiar el idioma deja la app a medio traducir justo en las
      pantallas de datos, sin pista de que reiniciar lo arregla.
      **Archivos:** `features/workout/CardioScreen.tsx:107`,
      `features/workout/ExerciseProgressScreen.tsx:104`,
      `features/workout/CalendarScreen.tsx:38` (frente a `:74`, que lo hace
      bien), `components/CardioInputField.tsx:51`, `lib/i18n.ts:9`.
      **Esfuerzo:** bajo.

## Funcionalidades a simplificar

- [x] **Al terminar un ejercicio, la pantalla baja sola al siguiente** — al
      meter la última serie, la tarjeta se pliega y se abre la del ejercicio
      siguiente, pero la lista no se mueve: la tarjeta nueva suele quedar
      abajo, a medias o detrás del bloque de descanso, que flota justo ahí, y
      hay que hacer scroll antes de cada ejercicio. Al cambiar el ejercicio en
      curso por haber completado el anterior, desplazar la lista hasta dejar su
      cabecera bajo la barra superior (y, con el día hecho, hasta la tarjeta
      "Entreno completado"). Solo en ese cambio, nunca mientras el usuario
      despliega otra tarjeta a mano.
      **Por qué:** pasa en cada ejercicio de cada entreno, durante el descanso
      y con el móvil en una mano; es el scroll que la app puede hacer por el
      usuario porque ya sabe adónde va.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1189`
      (`currentExerciseId`), `:1282` (la lista) y `:1414` (la tarjeta de
      completado), `components/ExerciseInputField.tsx:324` (la tarjeta que se
      abre sola), `components/StretchScrollView.tsx:53` (hoy ignora el `ref`
      que recibe: hay que pasárselo al scroll de dentro).
      **Esfuerzo:** medio.
- [x] **Cardio: recordar los datos de la última vez en cada disciplina** —
      registrar cardio pide teclear minutos, velocidad y pendiente desde cero en
      cada disciplina (los campos salen a "0"), mientras la fuerza sugiere lo de
      la última vez y basta con "Añadir serie". Rellenar los campos del popup
      con la última entrada de esa disciplina (como sugerencia, igual que el
      peso): repetir la sesión de siempre queda en casilla → "Guardar". Hoy
      "Guardar" sigue apagado hasta teclear los minutos: con sugerencia, debe
      aceptarla tal cual, como "Añadir serie" acepta el peso sugerido.
      **Por qué:** el cardio se repite casi idéntico de un día a otro (la misma
      cinta, la misma pendiente); hoy son tres campos tecleados por disciplina
      y día, la fricción que la fuerza ya no tiene.
      **Archivos:** `components/CardioInputField.tsx:340` (paso de datos) y
      `:146` (`handleSaveCardio`), `lib/cardio.ts:310` (`cardioEntriesOf`, de
      donde sale la última entrada), `components/ExerciseInputField.tsx:344`
      (el patrón de la fuerza).
      **Esfuerzo:** bajo.
- [x] **Las disciplinas propias se quedan como casilla** — remo, escaladora o
      cualquier máquina que no esté entre las cinco fijas se apunta con "Otro"
      tecleando su nombre, y la próxima vez hay que volver a teclearlo: el
      nombre se guarda en el entreno pero no vuelve a la rejilla. Añadir tras
      las fijas una casilla por cada disciplina propia usada (las tres más
      recientes), con su nombre, que abra directamente sus datos.
      **Por qué:** quien rema, rema siempre; teclear "Remo" en cada sesión es
      lo que la app ya sabe y debería recordar.
      **Archivos:** `components/CardioInputField.tsx:51` (`CARDIO_OPTIONS`,
      fijas) y `:151` (el nombre propio en `handleSaveCardio`),
      `lib/cardio.ts:310` (`cardioEntriesOf`: las entradas con `label` propio).
      **Esfuerzo:** bajo.
- [x] **Flechas de peso que saltan lo que sueles subir** — las flechas ▲▼ del
      peso suben y bajan de kilo en kilo, así que pasar de 60 a 62,5 en barra
      no se puede con ellas (hay que teclear) y de 20 a 25 en mancuerna son
      cinco toques. Que el salto salga del historial del ejercicio (el menor
      escalón entre pesos distintos que ya has usado, con 1 kg si no hay
      historial).
      **Por qué:** es el control que más se toca del registro, entre serie y
      serie y con una mano; que salte lo que de verdad se carga ahorra toques y
      teclado.
      **Archivos:** `components/ExerciseInputField.tsx:164` (`stepWeight`),
      `features/workout/WorkoutLogScreen.tsx` (`getPreviousExerciseRuns`, que
      ya junta el historial del ejercicio).
      **Esfuerzo:** bajo.
- [x] **Corregir una entrada de cardio sin borrarla** — una entrada ya
      apuntada solo tiene su ×: un minuto mal tecleado obliga a borrarla,
      volver a tocar su casilla y teclear otra vez minutos, velocidad y
      pendiente. Que tocar la fila abra el mismo popup con sus datos y
      "Guardar" la sustituya en su sitio (la × sigue para borrar).
      **Por qué:** corregir es más frecuente que borrar, y hoy cuesta lo mismo
      que meterla de nuevo.
      **Archivos:** `components/CardioInputField.tsx:186` (las filas) y
      `:146` (`handleSaveCardio`, hoy solo añade al final).
      **Esfuerzo:** bajo.
- [ ] **Registrar un ejercicio que no estaba en el día** — el registro solo
      pinta los ejercicios que trae el día de la rutina: si en el gym improvisas
      (máquina ocupada, ejercicio extra), lo que hiciste no se puede apuntar y el
      registro acaba diciendo menos de lo que pasó. Permitir añadir un ejercicio
      suelto a la sesión en curso, guardado con su propio id para que el detalle
      y el histórico lo pinten igual que los demás. La **nota de sesión** ya
      cubre el "explicar" lo que pasó («gym lleno, cambié banca por
      mancuernas»); esto es el paso caro que queda: que el registro no solo lo
      explique, sino que lo CONTENGA.
      **Por qué:** entrenar de verdad no sigue la plantilla. Con la nota, el
      histórico ya no miente por omisión silenciosa, pero las series de un
      ejercicio improvisado siguen sin contar para volumen, récords ni progreso.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1293` (el registro
      itera solo `selectedDay.exercises`) y `:850` (el guardado hace lo mismo),
      `types/index.ts:54` (`ExerciseLog.exerciseId` apunta al ejercicio de la
      rutina: un extra necesita id propio), `features/workout/DetailScreen.tsx:376`
      (`getExerciseFromLog` ya resuelve por nombre/orden, que es por donde
      entraría un extra).
      **Esfuerzo:** alto.
- [x] **La nota del ejercicio, en su tarjeta como la de la sesión** — en la
      misma pantalla conviven dos maneras de apuntar una nota: la de la sesión
      se escribe en el sitio y se guarda sola, y la de un ejercicio abre un
      popup con Cancelar, Borrar y Guardar. Escribir también la del ejercicio
      en su tarjeta (se abre desde el ⋯ como ahora, se autoguarda, y borrarla
      es vaciarla). Las tres puertas que hoy llevan al popup (el icono junto al
      nombre con la tarjeta plegada, el texto de la nota con la tarjeta abierta
      y el ⋯) pasan a llevar al mismo campo, ya en la tarjeta.
      **Por qué:** quita un modal y dos botones del flujo más usado (AGENTS:
      evitar modales innecesarios), y la misma tarea se hace igual en toda la
      pantalla.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1681` (el popup) y
      `:1359` (la nota de la sesión, el patrón a copiar),
      `components/ExerciseInputField.tsx` (bloque `noteOwnBlock`).
      **Esfuerzo:** medio.
- [x] **El objetivo de repeticiones, en su casilla** — la tarjeta del
      ejercicio en curso abre con una fila "Objetivo 3×8-10" encima de
      "Anterior", pero las series del objetivo ya las dicen el botón ("Añadir
      3.ª serie" / "última serie") y los puntos ●●○ de debajo. Llevar el rango
      de repeticiones al rótulo de su casilla ("REPETICIONES · 8-10") y quitar
      la fila: la tarjeta abierta, la más alta de la pantalla, pierde un
      renglón y el contexto se queda en lo que de verdad se consulta, la vez
      anterior. Con un objetivo de UNA serie (hoy sin puntos ni ordinal) el
      botón pasa a decir "Añadir última serie", para que ese dato tampoco se
      pierda.
      **Por qué:** la tarjeta en curso compite en alto con el bloque de
      descanso y el "Volver"; cada renglón que sobra es scroll entre series, y
      el rango leído junto al número que se teclea se entiende sin cruzar la
      mirada.
      **Archivos:** `components/ExerciseInputField.tsx:633` (la fila
      Objetivo), `:763` (rótulo de la casilla), `:295` (`addSetLabel`) y
      `:302` (`showSetDots`).
      **Esfuerzo:** bajo.
- [ ] **Ordenar los días de una rutina sin plegarlos uno a uno** — en la
      edición de una ficha, los días solo se arrastran con todos plegados, y
      con alguno abierto aparece el aviso "Pliega todos los días para
      ordenarlos arrastrando": hay que ir plegándolos a mano. Que ese aviso sea
      un botón ("Plegar todos para ordenar") que los pliegue de una vez y saque
      las asas.
      **Por qué:** la regla tiene sentido (con días abiertos las alturas
      bailan), pero cumplirla no tiene por qué costar un toque por día; el
      aviso ya ocupa el sitio del botón.
      **Archivos:** `features/workout/RoutineDetailScreen.tsx:573`
      (`canDragDays`) y `:912` (el aviso).
      **Esfuerzo:** bajo.
- [x] **Inicio: el subtítulo lleva a su rutina y fuera el ⋯ de una opción** —
      el subtítulo de Inicio nombra la rutina que se ENSEÑA (la seleccionada),
      pero "Ir a la rutina", la única opción de su ⋯, abre la ACTIVA: si no son
      la misma, el menú abre otra rutina que la que pone arriba. Hacer el
      subtítulo pulsable (como la fecha del registro y del Detalle) hacia la
      ficha de la rutina que se ve, y quitar el ⋯.
      **Por qué:** un menú con una sola opción es un toque de más, y que lleve
      a una rutina distinta de la que nombra la pantalla confunde.
      **Archivos:** `features/workout/HomeScreen.tsx:1604` (subtítulo) y
      `:1612` (el ⋯), `app/App.tsx:1281` (`onOpenActiveRoutine`),
      `components/GlassTopBar.tsx` (`onSubtitlePress`).
      **Esfuerzo:** bajo.
- [ ] **Cardio: retirar el texto `raw_input` cuando todos los móviles lo
      entiendan** — desde la 0.8.3 el cardio se guarda también en
      `cardio_entries` (una fila por entrada), pero el texto sigue siendo la
      verdad: si las filas no cuadran con él, manda el texto, porque un móvil
      sin actualizar solo edita el texto. Cuando no quede ninguno, invertir:
      las filas mandan, `CardioInputField` edita entradas en vez de texto y
      `raw_input` deja de escribirse. (El histórico ya se sube a
      `cardio_entries` en el primer sync de cada cuenta con la versión nueva;
      lo viejo no se borra.) A 2026-10-09 la 0.8.3 aún no está publicada: ningún
      móvil entiende las filas todavía, así que hacerlo ya dejaría el cardio
      vacío en cualquier móvil con la 0.8.2 que sincronice la misma cuenta.
      **Por qué:** es lo que quita de verdad el troceo de texto y la
      comprobación de que filas y texto cuadran; hasta entonces es una red de
      seguridad que se paga en cada lectura.
      **Archivos:** `lib/db/mappers.ts:495` (`entriesMatchRaw` en
      `rowsToAppData`), `lib/cardio.ts:310` (`cardioEntriesOf`) y
      `cardioEntriesFromRaw`, `components/CardioInputField.tsx:79` (el texto
      partido por `' | '`), `features/workout/WorkoutLogScreen.tsx:872` (donde
      se construye el cardio).
      **Esfuerzo:** medio.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

- [ ] **Añadir un día a una rutina ya creada** — en edición, la ficha de una
      rutina deja renombrar, cambiar el icono, reordenar y quitar días, y
      editar sus ejercicios, pero no añadir uno nuevo: Nueva rutina sí tiene
      "Añadir día". Para pasar de 4 a 5 días hoy hay que crear otra rutina y
      empezar su historial de cero. Llevar "Añadir día" a la edición de la
      ficha, con el mismo modelo de formulario que Nueva rutina: un botón al
      final de la lista de días, con la piel de "Añadir ejercicio", que crea
      el día ya abierto y con su primer ejercicio en el popup.
      **Por qué:** ajustar la rutina que ya entrenas es más común que estrenar
      una; y AGENTS pide que crear y editar usen el mismo modelo.
      **Archivos:** `features/workout/RoutineDetailScreen.tsx:592`
      (`renderDayBlock`, edición de días) y `:552` (`handleMoveDayTo`, el
      renumerado ya existe), `features/workout/NewRoutineScreen.tsx:290`
      (`handleAddDay`), `lib/exerciseForm.ts`.
      **Esfuerzo:** medio.
- [x] **Los retos de cardio que mueve la sesión, en el registro** — al
      terminar un entreno de fuerza, su tarjeta de cierre lista los retos que
      ha hecho avanzar; el registro de cardio no dice nada, aunque los tres
      retos de cardio (kcal de hoy, kcal de la semana, dos sesiones) se mueven
      justo al apuntar. Enseñarlos bajo lo apuntado, con el mismo cálculo
      (retos de antes contra retos de ahora, filtrando por `cardio`) y el mismo
      acceso a `ChallengesModal`.
      **Por qué:** es el momento de más motivación de la sesión, y la fuerza
      ya lo aprovecha; hoy para ver "¡reto de kcal superado!" hay que salir a
      la pestaña.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1159`
      (`sessionChallenges`, filtrado a `strength` en `:1168`) y `:1414` (la
      tarjeta de cierre, solo fuerza), `lib/challenges.ts:291`.
      **Esfuerzo:** bajo.
- [x] **Apuntar un cardio olvidado desde el Calendario** — en modo Fuerza una
      celda pasada vacía abre el registro de ese día; en modo Cardio las celdas
      sin cardio no se pueden tocar. Hacer lo mismo en Cardio: abrir "Insertar
      cardio" con esa fecha (el registro ya acepta `initialDate`) y explicarlo
      en la línea de debajo de la rejilla, como en Fuerza.
      **Por qué:** la sesión de cardio se olvida igual que la de fuerza, y hoy
      hay que crearla con fecha de hoy y cambiarla después en su subtítulo.
      **Archivos:** `features/workout/CalendarScreen.tsx:445` (celda de cardio,
      `disabled={!hasCardio}`) y `:553` (`canLogForgotten`, el patrón de
      Fuerza), `app/App.tsx` (`onLogForgottenDay`),
      `features/workout/WorkoutLogScreen.tsx` (`initialDate`).
      **Esfuerzo:** bajo.
- [ ] **De un ejercicio de la ficha de rutina a su evolución** — en el Detalle
      de una sesión cada ejercicio lleva a su gráfica y sus récords ("Ver
      evolución"), y desde esa gráfica se llega a la ficha de la rutina; pero
      al revés no: en la ficha, las casillas de los ejercicios solo reproducen
      el GIF. Dar a cada casilla de una rutina propia el mismo acceso a
      Progreso por ejercicio, con vuelta a la ficha.
      **Por qué:** la ficha es donde se decide qué cambiar del plan, y para
      eso se mira cómo va cada ejercicio; hoy hay que salir a Perfil →
      Ejercicios y buscarlo.
      **Archivos:** `features/workout/RoutineDetailScreen.tsx:779` (la
      cuadrícula), `components/ExerciseTileGrid.tsx:44` (sin acción propia;
      la comparte con la rutina pública), `features/workout/DetailScreen.tsx:527`
      (el acceso que ya existe), `app/App.tsx:201` (la pantalla
      `exercise-progress`, que hoy solo sabe volver al Detalle o a Perfil).
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
