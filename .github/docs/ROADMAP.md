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

- [x] **Actividad por meses: una cabecera por mes con su resumen** — hoy la
      Actividad es una lista plana de filas idénticas (círculo, título y una
      línea gris de 12 px) con fechas sin año ("13 oct"): con más de un año de
      historial no se sabe de cuál es. Encima lleva tres casillas (Días /
      Retos / Logros) con totales de por vida que parecen botones y no hacen
      nada, y que repiten el "{n} hitos" del subtítulo. Propuesta: agrupar
      por mes con una cabecera "Octubre 2026" (`SectionLegend`, la de los
      historiales de Inicio y Cardio) y a su derecha el resumen del mes ("12
      entrenos · 2 retos · 1 logro"); quitar las tres casillas; el subtítulo
      de la barra pasa a "{n} hitos desde mar 2025". Igual en el perfil de
      otra persona, que usa la misma lista.
      **Por qué:** se lee como un diario ("¿qué hice en septiembre?"), el año
      va en la cabecera y desaparece una fila de falsos botones. Los totales
      siguen: por mes en cada cabecera, el de hitos en el subtítulo y el de
      logros en Logros ("n de total").
      **Archivos:** `features/workout/ActivityScreen.tsx:192` (casillas),
      `:262` (subtítulo), `components/ActivityList.tsx:43` (la lista plana),
      `components/SectionLegend.tsx`, `lib/utils.ts:57` (`shortDayMonth`, sin
      año), `features/workout/UserProfileScreen.tsx:657` (la otra Actividad).
      **Esfuerzo:** medio.
- [ ] **La semana en curso se dibuja de dos maneras** — Inicio la pinta como
      una fila con el icono de cada día (verde hecho, aro dorado el que toca,
      anillo que se llena el de hoy) y Elige la sesión, un toque después, como
      una barra de segmentos sin iconos. Sacar la fila de Inicio a un
      componente y usarla también en la cabecera de Elige la sesión.
      **Por qué:** es el mismo dato en dos pantallas seguidas; con el mismo
      dibujo se reconoce sin volver a leerlo, y la barra no dice qué día
      falta.
      **Archivos:** `features/workout/HomeScreen.tsx:1153` (`weekDaysRow`),
      `features/workout/DaySelectorScreen.tsx:151` (`weekBar`).
      **Esfuerzo:** bajo.
- [x] **Actividad: los retos con su semana y sin eco** — un reto se fecha con
      el lunes de su semana pero se pinta como si fuera un día exacto ("13
      oct"), y un reto antiguo cuyo nombre ya no está en el catálogo sale
      "Reto superado · 13 oct · reto superado". Propuesta: los retos dicen
      "Semana del 13 oct"; el genérico se titula "Reto semanal" y la línea de
      debajo no repite "reto superado" cuando el título ya lo dice.
      **Por qué:** la fecha no engaña y la fila no dice dos veces lo mismo.
      **Archivos:** `lib/activity.ts:206` (`weekKeyToDate`) y `:266` (título
      genérico), `components/ActivityList.tsx:75` (la línea de fecha y tipo).
      **Esfuerzo:** bajo.

## Funcionalidades a simplificar

- [x] **Actividad: los entrenos plegados en una fila por mes, los hitos
      delante** — cada entreno de fuerza es una fila: con 4 días por semana
      son ~17 filas al mes de "Pecho · Mi rutina" frente a uno o dos logros o
      retos, que se pierden entre ellas; y esos días ya están en el historial
      de Inicio y en el Calendario. Propuesta: dentro de cada mes, logros y
      retos como filas completas (icono en su color sobre fondo tintado) y
      los entrenos fundidos en UNA fila "12 entrenos" con los iconos de sus
      días y un chevron visible que la despliega en la lista de días.
      **Por qué:** lo que se viene a mirar a Actividad (logros y retos) queda
      a la vista, y los días siguen ahí a un toque: no se pierde ninguno.
      **Archivos:** `components/ActivityList.tsx:43`, `lib/activity.ts:272`
      (un hito por log), `features/workout/ActivityScreen.tsx:66` (recuentos).
      **Esfuerzo:** medio.
- [x] **Actividad: un entreno abre esa sesión, no la ficha de la rutina** —
      hoy tocar un día abre la ficha de su rutina, que no dice nada de ese
      entreno, y la fila del día no lleva ningún dato. Propuesta: en la
      Actividad propia el día abre su Detalle (el mismo que desde Inicio o el
      Calendario, con un origen `activity` para que "Volver" regrese aquí) y
      enseña su % de mejora con `TrendDelta`, como el historial de Inicio. La
      ficha de la rutina sigue en la pestaña Rutinas; en el perfil de otra
      persona la fila sigue abriendo su rutina pública (de las sesiones
      ajenas no hay Detalle).
      **Por qué:** "¿qué hice ese día?" es lo que se pregunta al tocar un
      entreno.
      **Archivos:** `features/workout/ActivityScreen.tsx:212`, `app/App.tsx:157`
      (pantalla `detail` y sus `origin`) y `:1627`, `lib/progress.ts:179`
      (`buildWorkoutImprovement`), `components/TrendDelta.tsx`.
      **Esfuerzo:** bajo.
- [x] **Actividad: "Meses anteriores" visible en vez de tirar más allá del
      final** — la Actividad propia carga tandas de 10 al estirar la lista
      pasado el final, con una rueda y una espera artificial de 450 ms, y
      nada dice que haya más: es un gesto oculto. El perfil de otra persona
      ya usa `LoadMoreButton`. Propuesta: paginar por meses (encaja con la
      cabecera por mes) con un `LoadMoreButton` "Meses anteriores" al pie; se
      quitan la rueda, el retraso y `onPullPastEnd`.
      **Por qué:** se ve que hay más y se llega de un toque, con el mismo
      patrón en las dos Actividades (y sin gesto escondido, como pide AGENTS).
      **Archivos:** `features/workout/ActivityScreen.tsx:33` (retraso), `:80`
      (`loadMore`), `:112` (rueda), `:172` (`onPullPastEnd`),
      `features/workout/UserProfileScreen.tsx:667`,
      `components/LoadMoreButton.tsx`.
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
      **Archivos:** `features/workout/RoutineDetailScreen.tsx:586`
      (`canDragDays`) y `:935` (el aviso).
      **Esfuerzo:** bajo.
- [ ] **Cardio: retirar el texto `raw_input` cuando todos los móviles lo
      entiendan** — desde la 0.8.5 el cardio se guarda también en
      `cardio_entries` (una fila por entrada), pero el texto sigue siendo la
      verdad: si las filas no cuadran con él, manda el texto, porque un móvil
      sin actualizar solo edita el texto. Cuando no quede ninguno, invertir:
      las filas mandan, `CardioInputField` edita entradas en vez de texto y
      `raw_input` deja de escribirse. (El histórico ya se sube a
      `cardio_entries` en el primer sync de cada cuenta con la versión nueva;
      lo viejo no se borra.) Las filas salieron publicadas en la 0.8.5
      (2026-10-11): falta esperar a que no quede ningún móvil con la 0.8.2 o
      anterior sincronizando la misma cuenta, o hacerlo ya dejaría su cardio
      vacío.
      **Por qué:** es lo que quita de verdad el troceo de texto y la
      comprobación de que filas y texto cuadran; hasta entonces es una red de
      seguridad que se paga en cada lectura.
      **Archivos:** `lib/db/mappers.ts:504` (`entriesMatchRaw` en
      `rowsToAppData`), `lib/cardio.ts:310` (`cardioEntriesOf`) y
      `cardioEntriesFromRaw`, `components/CardioInputField.tsx:139` (el texto
      partido por `' | '`), `features/workout/WorkoutLogScreen.tsx:1101`
      (donde se construye el cardio).
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
      **Archivos:** `features/workout/RoutineDetailScreen.tsx:605`
      (`renderDayBlock`, edición de días) y `:565` (`handleMoveDayTo`, el
      renumerado ya existe), `features/workout/NewRoutineScreen.tsx:301`
      (`handleAddDay`), `lib/exerciseForm.ts`.
      **Esfuerzo:** medio.
- [x] **Récords personales como hitos de la Actividad** — el hito más
      motivador del gimnasio ("nuevo récord en Press banca: 85 kg") no sale
      en la Actividad: solo logros, retos y días, y el récord solo se ve un
      momento en el registro. La app ya calcula los récords de cada
      ejercicio. Propuesta: un tipo de hito `record` (trofeo en oro) con
      ejercicio, marca y fecha, que abre Progreso por ejercicio; uno por
      ejercicio y día (la mejor marca), sin contar las descargas. Para el
      perfil público, `kind` es texto en la nube, así que basta con publicar
      el tipo nuevo (antes, comprobar que la tabla no limita `kind` con un
      CHECK).
      **Por qué:** es lo que de verdad dice "voy progresando", y queda
      guardado en vez de durar dos segundos.
      **Archivos:** `lib/activity.ts:181` (`ActivityItem.kind`) y `:228`
      (`buildLocalActivity`), `lib/exerciseProgress.ts:247` y `:275`
      (`getExerciseRecords`), `components/ActivityList.tsx:24` (`KIND_COLOR`),
      `lib/cloud/activity.ts:100` (`publishActivity`).
      **Esfuerzo:** medio.
- [ ] **De un ejercicio de la ficha de rutina a su evolución** — en el Detalle
      de una sesión cada ejercicio lleva a su gráfica y sus récords ("Ver
      evolución"), y desde esa gráfica se llega a la ficha de la rutina; pero
      al revés no: en la ficha, las casillas de los ejercicios solo reproducen
      el GIF. Dar a cada casilla de una rutina propia el mismo acceso a
      Progreso por ejercicio, con vuelta a la ficha.
      **Por qué:** la ficha es donde se decide qué cambiar del plan, y para
      eso se mira cómo va cada ejercicio; hoy hay que salir a Perfil →
      Progreso y buscarlo.
      **Archivos:** `features/workout/RoutineDetailScreen.tsx:776` (la
      cuadrícula), `components/ExerciseTileGrid.tsx:236` (sin acción propia;
      la comparte con la rutina pública), `features/workout/DetailScreen.tsx:565`
      (el acceso que ya existe), `app/App.tsx:208` (la pantalla
      `exercise-progress`, que hoy solo sabe volver al Detalle o a Perfil).
      **Esfuerzo:** medio.
- [x] **Actividad: decir si Comunidad la ve** — tu Actividad es la misma
      lista que ven los demás en tu perfil, pero la pantalla no lo dice, ni
      si la compartes: el interruptor está en Editar perfil. Propuesta: con
      sesión iniciada, una línea al pie "Visible en tu perfil de Comunidad" /
      "Solo la ves tú" con un botón "Cambiar" que abre Editar perfil. Sin
      cuenta, nada.
      **Por qué:** saber quién ve tus entrenos es parte de que la lista sea
      tuya; hoy hay que adivinarlo.
      **Archivos:** `features/workout/ActivityScreen.tsx` (pie de la lista),
      `features/workout/ProfileEditModal.tsx:162` (`share_activity`).
      **Esfuerzo:** bajo.

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
