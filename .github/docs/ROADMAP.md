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

- [ ] **En edición, cada ejercicio enseña su plan** — en lectura, la ficha de
      una rutina pinta cada ejercicio con su GIF y sus series × reps; al pulsar
      "Editar" se convierte en una lista que solo dice el nombre, así que para
      comprobar cuántas series tenía algo hay que abrir su popup, uno a uno. Lo
      mismo en Nueva rutina, que usa la misma fila. Poner "3 × 8-10" bajo el
      nombre de cada fila del editor.
      **Por qué:** se entra a editar casi siempre para tocar series o reps; ver
      el plan de todo el día mientras se edita evita abrir y cerrar popups solo
      para leer.
      **Archivos:** `components/ExerciseFormRow.tsx:394` (la fila: solo el
      nombre), `components/ExerciseTileGrid.tsx:80` (el plan que sí sale en
      lectura), `features/workout/NewRoutineScreen.tsx:477`.
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

## Funcionalidades a simplificar

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
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:1412` (el registro
      itera solo `selectedDay.exercises`) y `:928` (el guardado hace lo mismo),
      `types/index.ts:54` (`ExerciseLog.exerciseId` apunta al ejercicio de la
      rutina: un extra necesita id propio), `features/workout/DetailScreen.tsx:372`
      (`getExerciseFromLog` ya resuelve por nombre/orden, que es por donde
      entraría un extra).
      **Esfuerzo:** alto.
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
      **Archivos:** `lib/db/mappers.ts:499` (`entriesMatchRaw` en
      `rowsToAppData`), `lib/cardio.ts:310` (`cardioEntriesOf`) y
      `cardioEntriesFromRaw`, `components/CardioInputField.tsx:79` (el texto
      partido por `' | '`), `features/workout/WorkoutLogScreen.tsx:956` (donde
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
      la comparte con la rutina pública), `features/workout/DetailScreen.tsx:533`
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
