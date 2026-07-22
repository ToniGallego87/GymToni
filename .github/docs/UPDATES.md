# UPDATES

## Version 0.6.5 - 2026-07-22

### Nuevas funcionalidades

- **Editar el descanso por defecto sin salir del registro**
  (`features/workout/WorkoutLogScreen.tsx`, `components/GlassTopBar.tsx`): antes el
  `timerDuration` de la rutina solo se cambiaba entrando a `RoutineDetailScreen`.
  Ahora hay un botón "Editar" (icono `timer-cog-outline`) en la fila de acciones del
  propio temporizador de descanso y una opción "Modificar temporizador" en el menú de
  tres puntos; ambos abren el mismo `AppModal` (segundos → equivalente m:ss) y guardan
  con `UPDATE_ROUTINE` en la rutina dueña del día. Ajusta el valor de las próximas
  series, no el descanso en curso (para eso están +30s y Saltar). `GlassTopBar` gana
  una prop `menuItems` para colgar opciones propias de la pantalla encima del cambio
  de tema.

- **Cambio de tema rápido con animación de revelado circular** (`components/GlassTopBar.tsx`,
  `components/ThemeRevealOverlay.tsx`, `lib/themeTransition.ts`, `lib/theme.ts`,
  `app/App.tsx`): un botón de tres puntos arriba a la derecha despliega una opción
  con el modo contrario al activo ("Modo claro"/"Modo oscuro"); al pulsarla, un
  círculo de color sólido (`View` con `transform:scale`, acelerado por GPU a 60fps)
  nace en la posición pulsada (`measureInWindow`) y recolorea la pantalla:
  **noche→día** el círculo del color de destino CRECE sobre la vista y al llenarla
  se aplica el tema (`setThemeMode`) y se desvanece; **día→noche** se aplica el tema
  ya (la noche queda debajo) y el círculo del color saliente, que cubre todo, se
  ENCOGE de fuera adentro revelando la noche desde los bordes. El overlay se monta
  en la raíz (`app/App.tsx`) para cubrir también las barras flotantes y bloquea los
  toques mientras dura. Usa Reanimated (ya en el repo); un canal mínimo
  `themeTransition` lleva la petición desde la barra hasta el overlay.

### Cambios

- **Cardio se guarda solo, sin botón "Guardar"** (`components/CardioInputField.tsx`,
  `components/AppModal.tsx`): en el paso de datos del asistente de cardio (inserción
  dentro de un día y cardio suelto usan el mismo campo) se quita el botón "Guardar". El
  registro se confirma al pulsar ✓ ("done") en el teclado desde cualquier campo
  (minutos con `autoFocus`) o al tocar fuera de la tarjeta si hay minutos válidos; si
  no, se descarta. `AppModal` gana una prop opcional `onOverlayPress` (por defecto el
  overlay no captura toques, sin cambios para el resto de modales) para ese
  "tocar fuera = guardar". Una línea de ayuda explica el gesto. Un toque menos en una
  acción muy repetida.

- **Menú de tres puntos en TODAS las pantallas** (`components/GlassTopBar.tsx`,
  `features/workout/HomeScreen.tsx`): el menú de opciones (hoy, cambio de tema)
  vivía solo en Inicio; ahora lo renderiza `GlassTopBar` por defecto (`showMenu`),
  con su estado, botón y desplegable propios, así que aparece siempre en el mismo
  sitio en cualquier vista. HomeScreen deja de montarlo a mano.
- **Más contraste de superficies y barras glass en modo oscuro** (`lib/theme.ts`,
  `components/glassTokens.ts`): se suben `surface`/`surfaceAlt` de la paleta noche
  y los tokens de la top bar y la barra de navegación (`GLASS_TOP_BAR_BG`,
  `GLASS_TOP_BAR_OVERLAY`, `GLASS_FLOATING_BG`, `GLASS_ACTIVE_ITEM_BG` y sus
  bordes) para que tarjetas y barras se despeguen del fondo en noche.

- **Idioma sin reiniciar la app** (`lib/i18n.ts`, `features/workout/SettingsScreen.tsx`,
  `features/workout/CalendarScreen.tsx`, `app/App.tsx`): antes cambiar de idioma
  relanzaba el bundle; ahora se aplica en caliente, igual que el tema.
  `language`/`dateLocale`/`decimalSeparator` pasan a bindings vivos que
  `setLanguage` reasigna, y un store mínimo (espejo de `themeStore`) re-renderiza
  el árbol vía `useLanguageVersion` en la raíz. Los nombres de mes/día del
  calendario se movieron dentro del componente (a nivel de módulo capturaban el
  idioma de arranque); el catálogo de ejercicios ya leía el idioma en render.
  Configuración deja de mostrar el modal de reinicio y su aviso para el idioma.
  +1 test en `i18n.test.ts` que verifica que `t()` y los locales cambian sin
  reiniciar.
- **El temporizador de descanso se salta y se alarga con botones visibles, no con
  gestos** (`features/workout/WorkoutLogScreen.tsx`): parar el descanso estaba
  solo en un long-press (y +30s en un toque), con un texto de ayuda, contra la
  regla de AGENTS ("si algo se puede hacer, tiene que verse; botón propio con su
  icono"). Ahora la tarjeta del temporizador tiene dos botones con icono: "+30s"
  y "Saltar". Nuevas claves i18n.
- **La tarjeta "Entrenamiento completado" ya no es un toque muerto**
  (`features/workout/HomeScreen.tsx`): cuando el día de hoy estaba terminado, la
  hero de Inicio seguía siendo pulsable pero `handleStartPress` salía sin hacer
  nada (parecía rota). Ahora abre el registro de hoy para revisarlo o editarlo,
  igual que el toque en su tarjeta del historial.
- **Rama muerta fuera del modal de Configuración** (`features/workout/SettingsScreen.tsx`):
  desde que el tema se aplica en caliente (0.6.4), el `ConfirmModal` de reinicio
  solo se abre para el cambio de idioma, así que su título tenía una rama
  inalcanzable (`… ? 'Cambiar idioma' : 'Cambiar tema'`). Se simplifica al único
  caso posible.

### Correcciones

- **Dos tests de `weeks` reconciliados con la fórmula de progreso de 0.6.3**
  (`lib/__tests__/weeks.test.ts`): `getWeekImprovement` y `buildWeekProgress`
  esperaban un 10% de mejora para 100→110 kg × 10 reps, el valor de la fórmula
  antigua (peso a pelo). Desde 0.6.3 la puntuación es Epley sobre la carga
  virtual (`peso + BODYWEIGHT_VIRTUAL_LOAD = 10`), que da 9,0909%; el cambio
  actualizó `progress.test.ts` pero dejó estos dos asserts sin migrar, y la
  suite estaba en rojo (2/148). Ajustados los valores esperados a 9,0909% (no se
  toca código de la app; el comportamiento ya era el correcto). Suite en verde.

## Version 0.6.4 - 2026-07-22

### Cambios

- **El cambio de tema (día/noche) se aplica al instante, sin reiniciar la app** (`features/workout/SettingsScreen.tsx`): antes cambiar de tema relanzaba el bundle (pantalla en negro, corte de la sesión) porque la paleta se capturaba una sola vez al arrancar. Ahora el toque en Configuración repinta la app en caliente. El **idioma sigue reiniciando** (i18n se resuelve al evaluar el módulo); el aviso de Configuración se acota a "El cambio de idioma reinicia la app".
- **Cristal del modo día más transparente** (`components/glassTokens.ts`): la barra superior baja su opacidad de `0.7` a `0.5` y las barras flotantes de `0.55` a `0.38`, para que se vea mejor el fondo a través del cristal en modo claro.
- **Oro del modo día un pelín más claro** (`lib/theme.ts`): `primaryFill` (`#F2B307`→`#F7C21A`), sus variantes light/dark y la rama light de `gradients.primary` se aclaran un punto, para un dorado algo más luminoso sin perder contraste.
- **Gráfica de Cardio centrada** (`features/workout/CardioScreen.tsx`): la gráfica y su selector de métrica (ambos de ancho fijo `chartWidth`) se envuelven en un contenedor `chartArea` centrado; el `progressCard` no podía centrar por su cabecera de ancho completo.
- **Mes/año del calendario centrado verticalmente** (`features/workout/CalendarScreen.tsx`): la fuente Anton pega el glifo al borde superior de su caja y el mes/año quedaba descentrado frente a las flechas; se corrige con `includeFontPadding:false` + `textAlignVertical:'center'` + `translateY` (mismo patrón que `HeroCard`).

### Correcciones

- **Botón "Volver" legible en modo día** (`components/FloatingBackButton.tsx`): tras el cambio de tema en caliente, en día el botón usaba la variante equivocada y salía con texto oscuro casi ilegible sobre fondo claro. Vuelve a ser una píldora oscura sólida con texto blanco (variante `isLight` leída en render, no capturada al cargar el módulo).
- **La hero de Fuerza mantiene su oro en todos los estados** (`components/HeroCard.tsx`): el mapa `GRADIENTS` estaba capturado a nivel de módulo y, al cambiar de tema, el estado "semana completada" se quedaba con un oro distinto (`amber`) mezclado con el `primary` del resto. Ahora TODOS los estados dorados (empezar, completado, semana completada y cerrada) usan el mismo oro `primary`; solo "añadir rutina" conserva el naranja de aviso.

### Arquitectura

- **Theming dinámico: la paleta se aplica en caliente** (`lib/theme.ts`, `lib/themeStore.ts`, `components/glassTokens.ts`, `components/AchievementPoster.tsx` y TODOS los `StyleSheet.create` de módulo): la paleta ya no se congela al evaluar el bundle. `theme` es un singleton que se MUTA en su sitio (`setThemeMode` → `Object.assign(theme, buildTheme(mode))`) y un `themeStore` mínimo (`subscribeTheme`/`notifyThemeChange`) avisa a los suscriptores. Cada componente pasó de `const styles = StyleSheet.create({…})` a una fábrica `makeStyles()` + `let styles` que se recalcula en cada cambio de tema; el re-render global lo dispara un `useThemeVersion()` en la raíz (`app/App.tsx`) —no hay ningún `React.memo` que corte la cascada—. `glassTokens` pasó de `const` a bindings vivos recalculados por `subscribeTheme`. El póster de logros (`AchievementPoster`) se ancla a la paleta oscura exportada (`darkColors`) porque su lienzo es siempre oscuro (antes seguía el tema de arranque, lo que en modo día dejaba el texto casi negro). Solo el TEMA es dinámico; el idioma se mantuvo con reinicio.
- **Capturas de tema a nivel de módulo movidas a render** (`components/FloatingBackButton.tsx`, `components/HeroCard.tsx`, `components/Button.tsx`, `components/ExerciseResultDisplay.tsx`): varios componentes definían sus mapas de color/gradiente (`GRADIENTS`, `STATUS_COLOR`) y flags de variante (`isLight`) como `const` a nivel de módulo, así que se congelaban con la paleta de arranque y no respondían al cambio de tema en caliente (mismo fallo que ya se ancló en `AchievementPoster`). Ahora se calculan dentro del cuerpo del componente, leyendo el `theme` vivo en cada render.

## Version 0.6.3 - 2026-07-21

### Nuevas funcionalidades

- **Catálogo de ejercicios con GIF de referencia** (`data/exerciseCatalog.json` + `data/exerciseCatalog.ts`, `components/ExercisePickerModal.tsx`, `components/GifViewerModal.tsx`): meter ejercicios a mano era lento y sin ayuda visual. Ahora, al editar los ejercicios de un día (tanto en "Nueva rutina" como en el editor de una rutina guardada, que comparten `ExerciseFormRow`), un botón de lupa abre un **buscador del catálogo** —1324 ejercicios, nombre bilingüe ES/EN buscable sin tildes, filtro por zona corporal y miniatura de cada uno—; al elegir uno se rellena el nombre y se guarda su `catalogId`. Si el ejercicio viene del catálogo aparece un botón que abre su **GIF de referencia** (también en la fila colapsada). Los datos salen del dataset público `hasaneyldrm/exercises-dataset`: el catálogo (nombres + taxonomía traducida) va empaquetado (~226 KB), pero **los GIF NO** —se cargan bajo demanda desde el CDN de jsDelivr, así que no engordan la APK y solo pesan cuando se abren—. La media es © Gym Visual y el visor muestra siempre su atribución. Los nombres en español se tradujeron a mano (550) o por reglas (774); la taxonomía (músculo/equipo/zona) tiene diccionario ES/EN. Nuevo campo opcional `catalogId` en `WorkoutExercise`/`ExerciseForm` (los ejercicios tecleados a mano no lo tienen; escribir a mano rompe el vínculo con el GIF).
- **Botón de GIF del ejercicio en registro y detalle del día** (`components/ExerciseGifButton.tsx`, en `ExerciseInputField` y `ExerciseResultDisplay`): además del editor de rutinas, cada ejercicio muestra el botón de play (ver GIF) mientras entrenas (vista de inserción) y al consultar un día pasado. Si el ejercicio viene del catálogo abre su GIF directo; si no (tecleado a mano o historial antiguo), abre el catálogo en modo consulta ya buscando por su nombre para dar con su GIF. `ExercisePickerModal` gana modo `reference` (tocar una fila solo previsualiza el GIF, no elige) y `initialQuery`. `ExerciseInputField`/`ExerciseResultDisplay` ganan un `catalogId` opcional; las pantallas de registro (`WorkoutLogScreen`) y detalle (`DetailScreen`) lo pasan desde el ejercicio.

### Cambios

- **Tocar la tarjeta de hoy en Inicio continúa el entreno directamente** (`features/workout/HomeScreen.tsx`): el toque abría el modal "¿Qué deseas hacer?" (Continuar / Eliminar), duplicando lo que ya hace el botón `⋯` de la propia tarjeta. Ahora el toque directo continúa/edita el registro (lo que se quiere casi siempre) y el `⋯` sigue dando acceso a eliminar. Un toque y un modal menos en el flujo más frecuente.
- **Se puede importar un backup con la base de datos vacía** (`features/workout/HomeScreen.tsx`): en el primer arranque, sin rutinas, se ocultaba la navegación inferior, así que no había forma de llegar a Perfil → Datos → Importar hasta crear una rutina a mano. La nav se muestra siempre; quien reinstala o cambia de móvil puede restaurar su JSON desde el primer arranque.

### Correcciones

- **Elegir en "Elige la sesión" un día con log de hoy ya no vuelve a Inicio en silencio** (`app/App.tsx`): si el día elegido ya tenía un registro de hoy, la app expulsaba a Inicio sin aviso —parecía que el toque no había funcionado—. Ahora abre ese registro para seguir metiendo series (`WorkoutLogScreen` ya detectaba el log de hoy solo; sobraba el atajo que volvía a Inicio).
- **Un día a medias ya no cuenta como entrenado en la semana ni en la gráfica** (`features/workout/HomeScreen.tsx`): salir de un día sin terminar todos los ejercicios dejaba la semana marcada como "completada" y sumaba en la racha y en la barra de la semana en curso, aunque solo se hubiera hecho la mitad. Mientras el día de HOY siga a medias (según el mismo criterio que ya pinta "Continúa tu entrenamiento" en la hero), racha, "semana completada" y gráfica lo ignoran; el registro se sigue viendo y editando en el historial. En cuanto se completa, o al pasar al día siguiente sin terminarlo, vuelve a contar como siempre.
- **Botón atrás físico coherente con el "Volver" de cada pantalla** (`app/App.tsx`): el `BackHandler` de Android mandaba siempre a Inicio, así que desde Configuración/Datos/Progreso el físico saltaba a Inicio mientras el botón en pantalla iba a Perfil, y un detalle abierto desde Calendario/Cardio perdía el origen. Ambos caminos comparten ahora las mismas funciones de navegación.
- **Avisos concretos al meter un valor inválido en una serie** (`components/ExerciseInputField.tsx`, `features/workout/WorkoutLogScreen.tsx`): un símbolo raro, un número negativo o un valor disparatado mostraban el mismo "Rellena primero los datos", así que no se entendía qué había pasado. Cada causa tiene ahora su mensaje.
- **Tope a peso y repeticiones al añadir una serie** (`lib/parsers.ts`, `components/ExerciseInputField.tsx`): un 2000 kg o 300 reps tecleados por error rompían el eje de las gráficas y falseaban récords/comparativas durante semanas. Se rechaza (con aviso) cualquier valor por encima de 500 kg / 100 reps, tanto al añadir una serie como al parsear el texto de series ya guardadas.
- **Mejorar en un ejercicio de peso corporal ya no sale en rojo** (`lib/progress.ts`): la puntuación de cada serie usaba dos escalas incompatibles —cuando el peso era 0 puntuaba las reps a pelo (`0×15` = 15), y en cuanto había carga usaba el 1RM de Epley (`5×15` = 7,5)—. Añadir poco lastre a un ejercicio sin peso HUNDÍA la nota: `0·0·0` daba 45 y `0·5·10` daba 37,5, o sea −16,7% pese a haber mejorado. Ahora se suma siempre una carga virtual constante (`BODYWEIGHT_VIRTUAL_LOAD = 10` kg, "el cuerpo también pesa") y se puntúa todo con Epley sobre `peso + 10`. La escala pasa a ser continua: cualquier kilo o repetición añadidos siempre suben la nota, imposible mejorar y salir en rojo. El valor 10 mantiene la escala histórica del peso corporal a 15 reps. +3 tests.

### Arquitectura

- **Tintes de color sueltos migrados a `theme.ts`** (`lib/theme.ts`, `HomeScreen.tsx`, `DaySelectorScreen.tsx`, `RoutineSelectorScreen.tsx`): quedaban varios `rgba` a mano que el modo día no podía ajustar (chip de racha, badges de mejora del historial, fondo del check "Solo cardio" y de la etiqueta "Preparada"). Nuevos tokens `emoji_blueMuted`, `emoji_orangeMuted(Border)`, `successMuted`, `errorMuted` y `warningMuted` en ambas paletas, mismo patrón que `primaryMuted`.
- **`GymIconGrid`: una sola rejilla para el selector de icono de día** (`components/GymIconGrid.tsx`): los modales de "Nueva rutina" y del detalle de rutina pintaban cada uno su propia rejilla de siluetas (mismas celdas, mismo estado activo, ~40 líneas duplicadas por pantalla). Ahora la rejilla es un componente y cada modal solo aporta su margen y cómo resuelve el icono activo.
- **`GradientCtaButton`: el CTA dorado compartido** (`components/GradientCtaButton.tsx`): `SaveWorkoutButton` (registro) y `CreateRoutineButton` (Nueva rutina) eran el mismo botón hero (gradiente dorado + sheen + encogido al pulsar) copiado en las dos pantallas. Pasa a ser un componente con `icon`/`title`; las pantallas pierden sus copias y sus estilos.
- **El icono de disciplina de Cardio sale de `lib/cardio`**: `CardioScreen` llevaba una copia literal de `disciplineIconName` (la que ya usan Calendario y el detalle). Se queda solo el casteo al tipo del icono.
- **Tokens de color muertos fuera** (`lib/theme.ts`): se retiran de ambas paletas `darkGray`, `gray`, `mediumGray`, `previous`, `successLight`, `emoji_purple`, `emoji_green` y `emoji_brown`, que ya no usaba nadie (verificado por búsqueda).
- **Textos del registro sin `t()`** (`components/ExerciseInputField.tsx`): "Borrar", "Terminar", "Nota" y "Completado · X/Y series" iban en español fijo; ahora pasan por `i18n` (claves nuevas `Terminar`, `Nota` y `Completado · {a}/{b} series`). En español no cambia nada.

## Version 0.6.2 - 2026-07-17

### Nuevas funcionalidades

- **Progreso por ejercicio: gráfica y récords** (`features/workout/ExerciseProgressScreen.tsx` + `lib/exerciseProgress.ts`, con tests): los datos estaban en `parsedSets` y el 1RM estimado en `lib/progress.ts`, pero no había forma de responder a LA pregunta del gimnasio ("¿cuánto hacía en banca hace un mes?"): la app solo miraba la sesión o la semana. Nueva pantalla (Perfil → **Progreso por ejercicio**) en dos pasos sin modal: la lista de ejercicios entrenados (última vez y mejor 1RM) y, al elegir uno, su gráfica sesión a sesión —el `BarChart` de siempre, filtro `SegmentedFilter` con 1RM / peso / volumen / reps— más la tabla de récords (1RM estimado, peso máximo, más repeticiones y mejor sesión por volumen, cada uno con la fecha en que se logró). Los ejercicios se agrupan **por nombre, no por `exerciseId`**: el mismo press de banca tiene un id distinto en cada rutina, así que agrupar por id partiría el histórico justo al cambiar de rutina, que es cuando más interesa comparar. El peso y el 1RM no arrancan la escala en cero (rangos de 60 → 65 kg: todas las barras saldrían iguales); volumen y reps sí. +16 tests.
- **Duplicar rutina** (`lib/routines.ts`, con tests): botón de copiar en cada tarjeta de la vista de Rutinas. Encaja con el concepto "preparada": la copia nace sin historial, o sea preparada y seleccionada, así que se ajusta y se estrena sin tocar la rutina en curso. Ids nuevos en rutina, días y ejercicios (compartirlos cruzaría el historial, que apunta a `routineId`/`dayId`/`exerciseId`) y nombre libre automático: "Push Pull (copia)", "(copia 2)"… +9 tests.
- **La pantalla no se apaga mientras se registra** (`useKeepAwake` en `WorkoutLogScreen`): en el banco pasan minutos entre series y el móvil se bloqueaba, obligando a desbloquearlo con las manos ocupadas. Solo en la pantalla de registro; al salir se libera.
- **Eliminar un día de fuerza sin perder su cardio** (`HomeScreen` + `ConfirmModal`): la confirmación de "¿Eliminar entrenamiento?" ofrece un check "Borrar también el cardio", DESMARCADO por defecto. Marcado, se borra el log entero (comportamiento anterior). Desmarcado, el log conserva el cardio y se degrada a sesión de "Solo cardio" de ese día (`UPDATE_WORKOUT_LOG` con `dayId: CARDIO_ONLY_DAY_ID`, `exercises: []`, `cardioOnly: true`): desaparece de Inicio y de las semanas, y sigue en Cardio y en el modo Cardio del calendario. El check solo se ofrece si el día tiene cardio que salvar. `ConfirmModal` gana los props `checkLabel`/`checked`/`onToggleCheck` (sin `checkLabel` no pinta nada), para que la confirmación siga siendo el componente único.
- **El solo cardio de hoy se sigue registrando, no se consulta** (`CardioScreen`, `CalendarScreen`, `App.tsx`): pulsar un día de solo cardio abría siempre el detalle. Si el día es HOY la sesión sigue viva, así que ahora se abre la inserción (`WorkoutLogScreen` con el log y `cardioOnly`) para seguir sumando entradas; los días pasados siguen yendo al detalle. Nuevo prop `onEditCardioOnly` en ambas pantallas.
- **Un día de fuerza absorbe el solo cardio de la misma fecha** (`WorkoutLogScreen`): al registrar un día de rutina existiendo ya un log `cardioOnly` de esa fecha, su `rawInput` se precarga en el campo de cardio (delante de lo que se meta ahí) y el log suelto se elimina al guardar. El cardio queda dentro del día de fuerza, igual que si se hubiera metido desde ahí. La absorción se resuelve al abrir la pantalla, así que el autoguardado (borra+crea el log) no la duplica ni la pierde.

### Arquitectura

- **`AppModal`: una sola carpintería para todos los modales** (`components/AppModal.tsx`): convivían varias familias de modal (`ConfirmModal`, el de opciones de Inicio, los artesanales de `RoutineDetailScreen`, el asistente de cardio, el popup de novedades y el bottom-sheet de notas), cada una con su `Modal` + overlay + tarjeta y medidas ligeramente distintas. `AppModal` centraliza overlay, tarjeta, título con icono, mensaje y pie; el cuerpo y los botones los pone quien lo usa, siempre con `Button` (antes cada modal se pintaba sus propios Pressables dorados/rojos a mano). Migrados **los 11 modales de la app**: `<Modal>` de react-native ya solo aparece dentro de `AppModal`. `ConfirmModal` pasa a ser su especialización con el par cancelar/confirmar. El de notas deja de ser bottom-sheet (misma tarjeta centrada que el resto) y el asistente de cardio conserva sus tres pasos, ahora con título y pie por paso.
- **`BarChart` compartido** (`components/BarChart.tsx`): `ProgressBarChart` (Inicio) y `CardioMetricChart` (Cardio) eran ~150 líneas casi idénticas de posicionamiento absoluto (mismo alto, mismas ranuras, mismas tres líneas de rejilla). Ahora el dibujo vive en un componente único y cada pantalla solo aporta lo que de verdad las diferencia: sus barras ya coloreadas y etiquetadas (`BarChartPoint[]`) y su dominio. El prop `signed` cubre la única diferencia estructural (Inicio dibuja el eje del cero y barras negativas; Cardio nace del suelo del dominio).
- **Los cálculos de semanas salen de `HomeScreen` a `lib/weeks.ts`** (con tests): `buildWeekProgress`, `isWeekCompleted`, `getWeekImprovement`, `computeStreak`, `logsBeforeBlock`, `workoutsUpToBlock` y `orderedBlockNumbers`. Eran lógica pura viviendo en una pantalla, sin tests y con duplicados: `buildWeekProgress` repetía a mano el bucle de agrupado de `groupLogsIntoWeekBlocks` (por `dayId` en vez de por `dayNumber`), y las rachas se calculaban tres veces con el mismo bucle copiado (racha actual, días de racha, racha hasta un bloque → un solo `computeStreak` con `upToBlock` opcional). `groupLogsIntoWeekBlocks` generaliza su segundo parámetro a `getDayKey` (`string | number`), que es lo que permitía la duplicación. +21 tests.
- **`RoutineSelectorScreen`** (`features/workout/RoutineSelectorScreen.tsx`): la vista de Rutinas vivía dentro de `HomeScreen` tras un `if (showRoutineSelector)` con su propio return, alimentada por los props `initialShowRoutineSelector`/`onCloseRoutineSelector`. Ahora es una pantalla propia con su estado, y `HomeScreen` pierde esos props, los de la rutina a borrar (`onDeleteCurrentRoutine`, `canDeleteCurrentRoutine`, que App.tsx ya solo usaba para el selector) y `onScanRoutineQR`/`onOpenRoutineDetails`. **HomeScreen pasa de 2.475 a ~1.590 líneas.**
- **Modelo de edición de ejercicios compartido** (`lib/exerciseForm.ts` + `components/ExerciseFormRow.tsx`, con tests): el editor estructurado de "Nueva rutina" (`ExerciseRow`/`ExerciseSummaryRow`, filas + stepper + toggle reps/seg) y su parseo de texto importado eran privados de esa pantalla. Se extraen para que el editor de un día guardado use lo mismo (ver Correcciones). +15 tests.
- **Limpieza de código muerto**: se elimina el componente `DayCard` (importado en `HomeScreen` pero nunca renderizado), las acciones del reducer `SET_ROUTINES` / `SET_LOGS` / `SET_CURRENT_DAY` y el campo `currentDay` de `WorkoutState` (nadie los despachaba ni leía; `WorkoutState` pasa a ser un alias de `WorkoutAppData`), el bloque comentado del botón "Editar entrenamiento" de `DetailScreen` (y su prop `onEdit`, ya sin uso), y varios restos menores (`parseCurrentValue` vacío en `CardioInputField`, imports sin uso detectados con `tsc --noUnusedLocals`).
- **Menos indirecciones**: `storage.ts` deja de reexportar `generateId`/`formatDate`/`getToday` (los consumidores importan de `@lib/utils`, su módulo real) y `components/index.ts` deja de reexportar los tokens glass y `FloatingGlassBar`, que solo se usan dentro de `components/`.
- **Coherencia con el sistema de diseño**: los cuatro overlays de modal con `rgba(0,0,0,…)` a mano (WorkoutLog, Cardio, NewRoutine, RoutineDetail) pasan a `theme.colors.overlay`; textos sueltos sin `t()` envueltos ("Elegir icono", "Añadir/Quitar día", el hint del temporizador y "¡Ánimo con tu nueva rutina!"). `NewRoutineScreen` deja de crear rutinas con `isActive: true` (el reducer las deja "preparadas"; el flag mentía).

### Cambios

- **El filtro por día de la gráfica de fuerza se lee de un vistazo** (`HomeScreen` + `SegmentedFilter`): sus chips llevaban el nombre real del día ("Pecho y tríceps"), así que con 3-4 días el raíl solo se recorría scrollando y las opciones quedaban escondidas detrás del borde. Ahora cada día es su silueta de grupo muscular (`resolveDayIcon`, el mismo icono que ya lo representa en el resto de la app) y el nombre del día activo se pinta centrado **bajo** el raíl (nuevo `labelMode="below"`): los chips de icono se reparten el ancho a partes iguales, así que la fila llena la barra y no se mueve al cambiar de día —dentro del chip, el texto la reordenaba a cada pulsación—. "Semana completa" estrena icono de calendario. Los chips con texto se aprietan además (13→12, padding 14→9) para que los cuatro del filtro de métrica de "Tu evolución" quepan sin scroll en un móvil estrecho.
- **La lista de Progreso se pagina y se ordena** (`ExerciseProgressScreen` + `lib/exerciseProgress.ts`, con tests): pintaba de golpe una fila por ejercicio entrenado alguna vez —130 en un historial de año y medio— y entrar a la pantalla se atascaba. Pasa a mostrar 20 y ampliar con "Ver más", y estrena orden por reciente (por defecto), nombre, número de sesiones o mejor 1RM (`sortExercises`, con desempate por el más reciente). Su raíl va sin iconos, al revés que el de métrica: con ellos el cuarto criterio no cabía, y "ordenar por sesiones" no tiene un dibujo que se entienda solo. +5 tests.
- **Se acabaron los gestos invisibles** (`HomeScreen`, `RoutineSelectorScreen`, `RoutineDetailScreen`): tres funciones solo existían tras un long-press que nada anunciaba. Ahora cada una tiene su botón:
  - Los logros de una semana pasada pedían **mantener pulsada 3 segundos** su cabecera; pasan a un botón de trofeo en la propia cabecera.
  - Editar/eliminar un entrenamiento pedía long-press de 1s en su tarjeta; pasa a un botón `⋯` en la tarjeta (pulsarla sigue haciendo lo de siempre: hoy abre las opciones, un día pasado abre su detalle).
  - Eliminar una rutina pedía long-press en su tarjeta; pasa a un botón de papelera, que solo aparece en las rutinas sin historial (las únicas que se pueden borrar).
  - En el detalle de una rutina, sus dos acciones eran gestos a ciegas y además contraintuitivos (pulsar el día abría el selector de ICONO; mantener 1s, el editor de EJERCICIOS). Ahora pulsar la tarjeta edita sus ejercicios —la acción principal, y la misma regla que el bloque de información de arriba: se pulsa y se abre su editor, con su chip de lápiz— y el icono del día es su propio botón (se toca el icono para cambiar el icono, con un micro-badge de lápiz que lo delata).
- **Filtros de gráfica segmentados** (`components/SegmentedFilter.tsx`): el filtro por día (Inicio) y el de métrica (Cardio) eran un botón `autorenew` que rotaba entre opciones a cada pulsación: no se veía qué más había y para volver a la anterior había que dar la vuelta entera. Pasan a un raíl de chips con todas las opciones a la vista y la activa rellena de oro, mismo lenguaje que el toggle Fuerza/Cardio del calendario. El raíl scrollea en horizontal cuando no caben (hasta 8 en el filtro por día).
- **La tarjeta de progreso de Inicio dice qué rutina es**: mostraba "Rutina 2", que era el índice del array y no el nombre que puso el usuario. Pasa a mostrar `displayedRoutine.name`.
- **Guardar un entrenamiento vuelve al instante** (`WorkoutLogScreen`): al guardar se pintaba un bloque verde de "Entrenamiento guardado" y se esperaban 1,5s antes de volver. La espera era artificial (el registro ya se autoguarda serie a serie) y la confirmación real es aterrizar en Inicio con la sesión de hoy ya en el historial.
- **Coma decimal en español** (`lib/i18n.ts` + formateadores y campos): en español los decimales se pintan con coma ("12,6 km/h", "22,5x10", "9,1%") y los campos aceptan lo que escriba el teclado, coma o punto. El dato NO cambia: se guarda y se parsea siempre con punto, porque en `rawInput` la coma separa series ("60x8, 60x8") y una coma decimal las partiría. La coma vive solo en los extremos, con tres helpers en `i18n`: `localizeDecimals` (pintar), `canonicalDecimals` (guardar lo tecleado) y `parseTypedNumber` (leer lo tecleado). Aplicado en `fmtNum` (Cardio, heros, detalle, gráfica: las métricas de km y km/h pasan a usarlo en vez de formatear a mano), `formatParsedSet` (series), `getImprovementDisplay` (%), `AnimatedCounter`, el póster de logros y los seis campos decimales (cardio, series y peso corporal, que ya hacía su propio `replace(',', '.')` y ahora usa el helper).

- **El cardio se lee por DÍA, no por log ni por disciplina** (`lib/cardio.ts`): nuevo `CardioDay` (todo el cardio de una fecha, venga del día de fuerza y/o de sesiones sueltas, con las disciplinas fusionadas) con `groupSessionsByDay` / `buildCardioDays` / `mergeDisciplines`. `CardioWeek` gana `days` y su `sessionCount` pasa a contar días, no logs.
- **Hero de Cardio: HOY en vez de la semana** (`CardioScreen`): el dato grande son las kcal de hoy (subtítulo: disciplinas · min · km) y las tres referencias pasan a ser diarias: "hace 7 días" (mismo día de la semana anterior, lunes contra lunes), "media diaria" (días con cardio ya cerrados) y "mejor día".
- **Una tarjeta por día de cardio** (`CardioScreen`): antes cada disciplina era su propia tarjeta y repetía la fecha. Ahora la tarjeta es el día: fecha y kcal totales arriba, y dentro una fila por disciplina (icono, resultados y sus kcal, que solo salen si hay más de una porque si no repiten las del día).
- **La vista de registro de cardio se llama Cardio** (`WorkoutLogScreen`, `CardioInputField`, `i18n.ts`): en modo solo cardio la barra pasa a titularse como su tarjeta (icono `run` + "Cardio") en vez de "Solo cardio" con el icono del día sintético, y el subtítulo se queda solo con la fecha ("Registra tu cardio" sobraba: no hay nada más en la pantalla; clave de `i18n` retirada). La tarjeta cambia su rótulo "Cardio" por "Disciplinas ejecutadas:" y conserva su icono, que es lo que la identifica también dentro de un día de fuerza.
- **El día de hoy en la lista de Cardio abre el registro, no la consulta** (`CardioScreen`, `App.tsx`): pulsarlo llevaba al detalle salvo que fuese un solo cardio. Hoy la sesión sigue viva se meta el cardio por donde se meta, así que ahora abre la inserción (`onInsertCardioOnly`, que ya precarga todo el cardio del día); los días pasados siguen yendo al detalle. `onEditCardioOnly` desaparece de `CardioScreen` (el caso de hoy lo cubre `onInsertCardioOnly`); Calendario lo mantiene.
- **La tarjeta de hoy en Cardio, con los colores de siempre** (`CardioScreen`): el día en curso pintaba TODO su texto en blanco (`dailyTextToday`, ya retirado). Ahora "hoy" se marca solo con el aro dorado y el `GradientFill`, como la tarjeta equivalente de Inicio, y la fecha y los resultados se quedan en su gris.
- **Separación entre la última tarjeta del día y la semana siguiente** (`CardioScreen`): Inicio la tiene porque el `Collapsible` que envuelve los días reserva 10px abajo (`SHADOW_BLEED_BOTTOM`) y Cardio, sin acordeón, no. Los días pasan a ir en un contenedor con `paddingBottom: 10`: mismo ritmo vertical en las dos pantallas.
- **La cuesta es una disciplina propia** (`lib/cardio.ts`): andar en cinta en cuesta y en llano se fusionaban en la misma fila, promediando dos esfuerzos distintos (la pendiente cambia las kcal y el icono). La fusión pasa a ir por disciplina + pendiente (`disciplineKey`, con `hasIncline` como criterio único: pendiente 0 o sin pendiente es llano), tanto por sesión como por día. `DetailScreen` pintaba cuesta arriba con pendiente 0 porque miraba `!= null`; ahora usa el mismo `hasIncline`.
- **Icono del calendario de cardio por disciplina** (`CalendarScreen` + `lib/cardio.ts`): la celda pintaba siempre `run-fast`; ahora pinta la disciplina que más kcal quemó ese día (nuevo `topKcalDiscipline`, que sustituye al no usado `mostPerformedDiscipline`; el orden por kcal no depende del peso porque escalan linealmente). La celda agrega además los minutos de todo el día, no los del último log.

- **Las flechas del carrusel encogen con la hero card** (`HeroCarousel`, `HeroCard`, `HeroWeightCard`): flechas y puntos son hermanos de la tarjeta, así que al pulsar (`scale` 0.97) el dorado encogía y ellos se quedaban clavados, despegándose del borde. La escala de pulsación sube al envoltorio del carrusel, que escala el conjunto; las tarjetas pulsables reciben la `SharedValue` por el prop `pressScale` y la animan en vez de aplicarse la suya. Sueltas (fuera del carrusel) siguen escalándose ellas mismas.
- **Botón Guardar del peso en amarillo** (`CardioScreen`): pasa de `success` + `onDanger` a `primaryFill` + `onGold`, como el resto de botones de acción principal (`CardioInputField`).
- **El aviso del peso decía algo que ya no pasa** (`CardioScreen` + `i18n.ts`): "Al cambiarlo, todas se recalculan" venía de cuando el peso era único y global. Con el historial de tramos, un peso nuevo (≥1 día después del anterior) solo aplica de ahí en adelante y los cardios ya registrados conservan el peso que estaba vigente. El texto pasa a "Se aplica a los próximos; los cardios ya registrados mantienen el peso que tenías entonces".
- **Flechas del carrusel de heros menos oscuras en día**: el sombreado del peldaño era un trío de hex sueltos en `HeroCarousel` (contra la regla de "ningún hex fuera de `theme.ts`/`glassTokens.ts`"). Pasa a `theme.gradients.heroStep`, con la tinta rebajada en día (0.26/0.22/0.10 → 0.15/0.12/0.06): sobre el oro vivo la de noche ennegrecía el escalón. Noche sin cambios.
- **Los acentos dorados de día dejan de verse marrones** (borde izquierdo de la semana, día en curso en Inicio/Cardio/Calendario, barra del mes/semana en curso, contorno de checkboxes): usaban `colors.primary`, que es la TINTA y por eso es un ámbar oscuro (necesita 4.5:1 sobre el fondo). Como líneas y acentos gráficos no son texto, les basta 3:1, así que estrenan `colors.primaryLine` (día `#B87A00`: 3.2:1 sobre el fondo y 3.6:1 sobre las tarjetas, bastante más amarillo; noche = el oro de siempre, sin cambios). Migrados ~30 sitios de `border*Color`, los acentos de semana/día en curso y el `accent` de `GradientFill`, que es estructural por definición (hermano de `getTrainingAccent`). En las gráficas, donde la barra y su etiqueta compartían color, la barra pasa a `primaryLine` y la etiqueta se queda en `primary` (es texto).
- **Oro vivo en modo claro** (`lib/theme.ts`): el bronce apagado (`#A26A05`) con texto blanco se cambia por un oro ámbar vivo con tinta oscura. El oro no se podía arreglar con un solo tono porque `primary` hacía de TINTA (texto/iconos/bordes sobre el lienzo claro, que exige un tono oscuro) y de SUPERFICIE (heros, botones, badges, que exigen un oro vivo) a la vez. Se separan los roles, como ya se hizo con `accentLine`:
  - `primary` se queda como tinta (día `#966100`, 4.6:1 sobre el fondo).
  - Nuevos `primaryFill`/`primaryFillLight`/`primaryFillDark` para los rellenos (día `#F2B307`), con `gradients.primary`/`amber` repintados en el mismo oro. **En noche los tres valen lo que `primary`/`primaryLight`/`primaryDark`, así que el tema oscuro no cambia en nada.**
  - `onGold` pasa a ser tinta oscura cálida (`#3A2B04`, ≈7:1 sobre el oro) en vez de blanca, en los dos temas.
  - Nuevo `onDanger` para la tinta sobre los rellenos sólidos de estado (rojo/verde), que iba con `onGold` por comodidad: al separar el oro los dos roles dejaron de coincidir y sobre el rojo profundo de día la tinta tiene que seguir siendo blanca. Migrados los tres sitios afectados (botón `danger` de `Button`, Iniciar/Parar del cronómetro y Eliminar del modal de opciones) y los dos botones sobre verde (guardar peso, "Entrenamiento guardado").
  - Migrados a `primaryFill` los rellenos dorados sólidos (~20 sitios: botones, badges, checkboxes, el bloque de temporizador y el póster de logros, que se pinta siempre sobre lienzo oscuro). El toggle Fuerza/Cardio del calendario pasa a tinta `onGold`: usaba `background`, que en día es casi blanco y sobre el oro vivo no se leería.
- **Detalle de cardio por entrada, no por disciplina** (`DetailScreen`): el detalle fusionaba las entradas por disciplina y mostraba rangos (`12-12.6 km/h`). Ahora hay una caja por cada entrada registrada, con el icono de su disciplina (`disciplineIconName`, cuesta arriba si hay pendiente) y sus kcal (`estimateEntryKcal` con el peso vigente del log vía `getCardioWeightHistory` + `weightForTimestamp`, mismo criterio que Cardio). La fila de datos pasa a `flexWrap` porque ya son cuatro.
- **Números grandes de las hero cards recortados en Android** (`HeroStatsCard`, `HeroWeightCard`): con `includeFontPadding: false`, Android recorta el ascendente de Anton si `lineHeight` no le deja hueco, y el 44→40 de la 0.6.1 dejaba el número comido por arriba. Vuelve a `lineHeight: 44`. (El `translateY: 4` se quitó aquí dando por hecho que el hueco extra caía bajo la línea base; no es así, y hubo que devolverlo — ver la corrección del alineado, más arriba.)
- En Datos, "Limpiar" pasa a "Borrar" y "Limpiar datos" a "Borrar datos" (botón, tarjeta y confirmación); en Configuración, el tema "Noche" pasa a "Oscuro" y "Día" a "Claro". Claves de `i18n.ts` renombradas (`Borrar datos`: "Clear data", `Oscuro`/`Claro`; `Borrar` reutiliza la ya existente); la clave `Día` se conserva, que la usan "Día 1", "Día 2"…

- **Rediseño del modo día** (`lib/theme.ts`): fondo más frío y profundo (`#EDF0F6`) para que las tarjetas blancas se separen del lienzo; bordes (`#C7CDDB`) y textos secundarios (`#4E5565`) con más contraste; oro ámbar-bronce más rico (`#A26A05`, gradientes `primary`/`amber` más profundos) que mantiene >4:1 con el texto blanco `onGold`; verdes/rojos/azules de estado recalibrados para fondo claro; overlay de modal más denso (0.5).
- **Sombras según tema** (`lib/theme.ts`): en día `theme.shadow.card/soft` pasan a sombra azulada suave (`#26314A`, opacidad 0.14/0.10, elevation 6/4) en vez de la negra densa de noche, que sobre fondo claro se veía como mancha gris. Misma corrección en la sombra propia de `FloatingGlassBar`.
- **Glass en modo día** (`components/glassTokens.ts`): barra flotante más sólida (blanco 0.55) con borde y estado activo más marcados; nuevo token `GLASS_TOP_BAR_HAIRLINE` y filo inferior de `GlassTopBar` solo en día para separar la barra del contenido al hacer scroll.
- **Sheen de tarjetas neutras según tema** (`GradientFill` + `theme.gradients.cardSheen`): en día el brillo superior pasa a blanco 0.55 (el 0.06 de noche era invisible sobre superficies claras).
- **Acento estructural separado de la tinta** (`colors.accentLine`): `colors.white` hacía de tinta de texto Y de borde/tinte a la vez. Al invertirse en día quedaba en `#171B23`, que como texto es correcto pero como aro de tarjeta o barra de semana daba un canto casi negro con aspecto de pegatina. El nuevo token vale `#ffffff` en noche (comportamiento idéntico al previo) y un pizarra medio `#6B7385` en día, que marca el borde sin apelmazar y deja el oro de la semana en curso como único acento fuerte. `getTrainingAccent()` lo devuelve y se migran los consumidores estructurales que iban directos a `colors.white` (`HomeScreen`, `CardioScreen`, `CalendarScreen`, `NewRoutineScreen`); los usos como tinta de texto/iconos se quedan igual.
- `frontend-design.md` deja de decir "tema oscuro fijo" y documenta los dos temas, la regla de `accentLine` vs `colors.white` y la revisión en ambos modos.
- `versionCode` 15 -> 16 en `android/app/build.gradle`.

### Correcciones

- **Volver desde el registro de cardio vuelve a Cardio** (`app/App.tsx`): la pantalla `workout-log` no guardaba de dónde se había entrado, así que `onBack`/`onSave` aterrizaban siempre en Inicio (Fuerza), aunque la sesión se hubiera insertado desde Cardio o editado desde el Calendario. Gana un `origin` opcional (`'home' | 'calendar' | 'cardio'`), como el que ya tenía `detail`, y vuelve al sitio del que salió. Sin origen (día de rutina, notificación) se mantiene Inicio.
- **El nombre del ejercicio cabe entero en Progreso** (`ExerciseProgressScreen`): tanto el título de la ficha como las tarjetas del listado estaban limitados a una línea, y "Sentadilla goblet con talones elevados" salía cortado con puntos suspensivos. Pasan a dos líneas, con el icono de la ficha anclado a la altura de la primera.
- **Editar los ejercicios de un día cruzaba el historial entre ejercicios** (`RoutineDetailScreen` + `lib/exerciseForm.ts`): el editor era un textarea con formato "Nombre — 4x8" que se volvía a parsear con un regex frágil, y al guardar repartía los ids de los ejercicios **por posición** (`day.exercises[index]`). Reordenar los ejercicios de un día, o insertar uno en medio, le daba a cada uno el id del que ocupaba antes su puesto: a partir de ahí las comparaciones de progreso ("Anterior", % de mejora) mostraban los datos de OTRO ejercicio, y el histórico quedaba corrupto de forma silenciosa. Ahora el editor es el mismo estructurado de "Nueva rutina" (filas con stepper y toggle reps/seg, sin texto que parsear) y cada fila viaja con el id de su ejercicio (`exerciseFormFromExercise` → `buildWorkoutExercises`), así que el historial sigue apuntando a donde debe. Cubierto con tests, incluido el caso de reordenar.
- **El número de las hero cards no alineaba con su icono** (`HeroStatsCard`, `HeroWeightCard`): Anton a 34px pide 51px de línea (ascendente 40 + descendente 11) y solo hay 44, así que la línea base cae a `lineHeight - descendente` = 32.8 y los dígitos (altura de mayúscula 29.2) ocupan de 3.6 a 32.8: su centro está en 18.2 y el de la caja en 22, o sea 3.8px altos frente al icono y la unidad, que sí van centrados. Vuelve el `translateY: 4` que la 0.6.1 quitó al subir el `lineHeight` a 44 (el hueco sobrante NO cae bajo la línea base, como decía su nota: el descendente que las cifras no usan tira de ellas hacia arriba). El recorte que arregló el 44 sigue arreglado.

- **Un día con cardio partido en dos logs salía distinto en cada pantalla** (`lib/normalize.ts`): con el cardio de una fecha repartido entre el día de fuerza y una sesión suelta (lo que creaba "Insertar cardio" antes de la corrección de abajo), Cardio y el calendario fusionaban el día y enseñaban las cuatro entradas, pero al entrar el detalle abría UN log y solo enseñaba las suyas. Se fusiona en el normalizado, que es la fuente única y corre en cada carga y guardado: el cardio suelto de una fecha que ya tiene día de fuerza se mete en él (`mergeSameDayCardio`, delante lo que ya tenía el día) y el log suelto desaparece. Los datos ya partidos se curan solos al abrir la app. Dos días de fuerza de la misma fecha no se tocan: son entrenamientos distintos, cada uno con su cardio.

- **Insertar cardio partía el día en dos sesiones** (`WorkoutLogScreen`): la absorción solo iba en un sentido (el día de fuerza absorbe el solo cardio). Al revés no: si el cardio del día ya estaba dentro de un día de fuerza, "Insertar cardio" abría el formulario en blanco y creaba un log `cardioOnly` aparte, así que el mismo día quedaba con dos sesiones de cardio. Ahora, en modo `cardioOnly`, si esa fecha ya tiene log de fuerza (`hostStrengthLog`), su `rawInput` se precarga en el campo y al guardar se escribe en ESE log (`UPDATE_WORKOUT_LOG`, fuerza intacta) en vez de crear uno suelto; si además había un `cardioOnly` de la misma fecha (datos ya partidos), se fusiona y se elimina. Un día = un cardio, se meta por donde se meta.

- **Rectángulo en la tarjeta del día de cardio en curso** (`CardioScreen`): `dailyCardToday` marcaba "hoy" pisando el `backgroundColor` de la tarjeta con `primaryMuted` (translúcido). La tarjeta lleva `elevation` (`shadow.soft`) y en Android, sin fondo opaco, el relleno se pinta como un rectángulo con esquinas vivas dentro del redondeo. Pasa a marcar "hoy" como la tarjeta equivalente de Inicio: fondo opaco intacto, aro dorado de 2.5 y `GradientFill`. Era el único `primaryMuted` sobre una superficie elevada.
## Version 0.6.1 - 2026-07-15

### Nuevas funcionalidades

- **Estado de peso en la hero de Cardio** (`components/HeroWeightCard.tsx`): el peso corporal deja de ser una fila al pie de las estadísticas y pasa a ser un estado propio del carrusel (Cardio pasa a 3: estadísticas, peso e "Insertar cardio"). Muestra el peso vigente en grande con la diferencia respecto al anterior, al pulsar abre su edición y, con 3 o más pesos en el histórico, dibuja la evolución de los últimos 8 (gráfica de línea con `react-native-svg`, dominio ajustado al rango real).
- **Sesiones de solo cardio**: nuevo día sintético `CARDIO_ONLY_DAY` (`lib/cardio.ts`, id `__cardio_only__`, sin ejercicios) para registrar cardio suelto sin un día de fuerza. Se accede desde el estado "Insertar cardio" de la hero de Cardio y desde la opción "Solo cardio" del selector de sesión (`DaySelectorScreen`). El log se marca `cardioOnly`: no cuenta como entrenamiento de fuerza (se filtra en `HomeScreen`/`buildWeekProgress` y en el modo Fuerza del calendario) pero sí aparece en Cardio y en el modo Cardio del calendario, que resuelven el día con el sintético (`isCardioOnlyLog`).
- **Hero cards en carrusel** (`components/HeroCarousel.tsx` + `components/HeroStatsCard.tsx`): el frame dorado queda fijo y solo el contenido entra deslizándose (`enterFrom`) con flechas y puntos. Inicio pasa a 3 estados (situación actual, "Ver rutinas" y estadísticas de fuerza con volumen semanal en kg y comparativa progresiva de 1/2/3+ semanas); Cardio pasa a 3 (estadísticas semanales + peso corporal + "Insertar cardio").
- **Rutina seleccionada independiente de la activa** ("Preparada"): crear o pulsar una rutina en Rutinas ya no la activa; queda `selectedRoutineId` (persistido, `SET_SELECTED_ROUTINE`) y se muestra en Inicio. Una rutina creada/preparada se marca "Preparada" en su tarjeta y se convierte en activa al registrar en ella el primer día de fuerza (`ADD_WORKOUT_LOG` con promoción a activa; el solo-cardio no promociona). La hero de rutina cerrada pasa a llevar a Rutinas al pulsarla.
- **Forzar inicio de nueva semana** en "Elige la sesión": nuevo flag `startsNewWeek` en el log; `DaySelectorScreen` ofrece un check "Empezar una nueva semana con este día" cuando el día elegido continuaría la semana en curso. Respetado por `lib/weeks.ts` y por `buildWeekProgress` de `HomeScreen`.

### Arquitectura

- **Esquema SQLite v2** (`lib/db/schema.ts`): nuevas columnas `starts_new_week` y `cardio_only` en `workout_logs` y setting `selected_routine_id`. Migración incremental idempotente por `ALTER TABLE ... ADD COLUMN` con try/catch para BD existentes; inserts/mappers (`db/index.ts`, `db/mappers.ts`) y `dbSetSelectedRoutine`/`persistence.ts` actualizados. `types/index.ts` añade `selectedRoutineId`, `startsNewWeek` y `cardioOnly`; `normalize.ts` conserva la seleccionada solo si existe (cae a la activa).
- **Helpers de cardio** (`lib/cardio.ts`): `CARDIO_ONLY_DAY`/`CARDIO_ONLY_DAY_ID`, `isCardioOnlyLog`, `disciplineIconName` (iconos por disciplina, reconoce keywords es/en) y `mostPerformedDiscipline` (disciplina con más minutos, kcal de desempate).
- **Seed de desarrollo web desde backup real** (`lib/storage.ts` + `data/devWebSeed.json`): en web+dev `getSeedAppData` siembra desde el backup real y `getSeedCardioWeightHistory` restaura el historial de peso para calcular kcal reales; el seed de fábrica se mantiene en nativo dev.

### Cambios

- Hero de Fuerza siempre en dorado: los estados `completed` y `closed` dejan de usar verde/rojo (consistente con Cardio); icono del estado inicial pasa a `weight-lifter`.
- Títulos de semana (Inicio y Cardio) en blanco en vez del color de acento; texto del día "hoy" de Cardio también en blanco.
- Ajuste de centrado vertical de la tipografía Anton en Android (`translateY` 9 vs 5 en web) en títulos de semana y del progreso.
- `WhatsNewModal` con `ScrollView` y `maxHeight` para changelogs largos; el detalle de una sesión de solo cardio omite el título "Cardio" redundante.
- `versionCode` 14 → 15 en `android/app/build.gradle`.
- **Bordes blancos fuera de las hero cards**: el círculo del icono (`HeroCard`) y los peldaños de las flechas (`HeroCarousel`) pierden su `borderColor: rgba(255,255,255,·)`, que sobre el dorado se leía como un filo blanco. Se quedan solo con su tinte oscuro.
- **Peldaño de las flechas difuminado** (`HeroCarousel`): `STEP_SHADE` pasa de 2 a 4 paradas (con `locations`) y termina en alpha 0 en vez de 0.04, así que el escalón se desvanece en el dorado en vez de cortarse en un canto visible.
- **Ritmo vertical de las hero de datos** (`HeroStatsCard` + `HeroWeightCard`): la fila de datos y la gráfica quedaban a 2px de los puntitos del carrusel. Se aprieta el aire muerto de arriba (kicker `marginBottom` 6→2, `lineHeight` del número 44→40 —ratio 1.18, el del resto de textos en Anton—, subline `marginTop` 4→2, fila de datos 6+6→4+4, gráfica de peso 44→36) y el `paddingVertical: 14` pasa a `paddingTop: 14` / `paddingBottom: 24`, que sube el bloque centrado. Ambas tarjetas se quedan dentro de los 172px del marco, sin desajustar el carrusel.
- **La fila de datos ya no se mete bajo las flechas** (`HeroStatsCard`): se encoge a los lados con el nuevo `HERO_ARROW_INSET` (exportado por `HeroCarousel` junto a `HERO_ARROW_WIDTH`), que también usa la gráfica de `HeroWeightCard` en lugar de su margen a ojo.
- **Tramos de peso por día en vez de por semana** (`CardioScreen`): un peso nuevo abre tramo propio (`WeightSegment`) si pasó ≥1 día desde el anterior; dentro del mismo día sigue recalculando el tramo en curso. Los cardios anteriores mantienen el peso vigente cuando se registraron y la evolución de la hero gana un punto por día en vez de por semana.
- `HeroStatsCard` pierde las props `footer` y `dense` (solo las usaba Cardio para encajar la fila de peso): la hero de estadísticas de Cardio queda idéntica a la de Fuerza.

### Correcciones

- **El % de cambio de la hero de Fuerza comparaba semana a medias contra semana entera** (`HomeScreen`): con 2 semanas registradas, `deltaPct` medía el volumen de la semana en curso contra el TOTAL de la anterior, así que el dato solo reflejaba los días que faltaban por entrenar (el lunes, -100%). Ahora compara contra los mismos días ya entrenados esta semana (mismo `dayId`); al completar la semana converge solo al % de semana entera. La etiqueta pasa de "cambio" a "vs mismos días".
- **Parpadeo de rutina al abrir, resuelto de raíz**: se elimina el estado local `viewedRoutineId` y su `useEffect` de `HomeScreen`; la rutina mostrada deriva ahora de `selectedRoutineId` persistido (cae a la activa si no existe), sin el frame de desincronía tras la hidratación.
- Tests nuevos de `groupLogsIntoWeekBlocks` con `startsNewWeek` (`lib/__tests__/weeks.test.ts`).

## Version 0.6.0 - 2026-07-12

### Nuevas funcionalidades

- **Pestaña Perfil y navegación simplificada**: la barra inferior pasa de 5 a 4 pestañas (Fuerza, Cardio, Calendario, Perfil). Nueva `ProfileScreen` con resumen (entrenamientos/rutinas/sesiones cardio) y accesos a Mis rutinas (el selector de rutinas), Datos y Configuración; `FloatingPrimaryNav` reescrita con las nuevas claves (la pestaña activa sigue siendo pulsable para volver a Perfil desde sus subpantallas, que la marcan activa).
- **Configuración con tema día/noche e idioma es/en** (`SettingsScreen`): selectores de tema y de idioma, acceso al popup de Novedades (`WhatsNewModal` con la última entrada del changelog) y versión. Los cambios se persisten en `lib/appSettings.ts` (SQLite síncrono `gymbro-settings.db` en nativo, localStorage en web) y se aplican relanzando el bundle con la nueva dependencia `react-native-restart` — los `StyleSheet.create` a nivel de módulo capturan la paleta en la evaluación del bundle, por eso la lectura es síncrona y el cambio requiere reinicio.
- **Tema claro**: `lib/theme.ts` pasa a dos paletas (`darkColors`/`lightColors`) elegidas al evaluar el módulo; nuevo token `colors.inputBg` (los inputs usaban `darkGray`, que ahora queda solo como tinta oscura sobre amarillo), `theme.statusBarStyle` (todas las pantallas dejan de hardcodear `style="light"`), variantes claras de los tokens glass (`glassTokens.ts`, incluido `GLASS_TINT` para los BlurView) y `QRScannerScreen` sin blancos rgba hardcodeados.
- **Idioma inglés**: nuevo `lib/i18n.ts` minimalista (clave = texto español, diccionario EN único, placeholders `{n}`, `dateLocale` para `toLocaleDateString`); todos los textos de pantallas, componentes y libs de UI envueltos en `t()`. Las etiquetas de disciplina de cardio se guardan en el idioma activo, y `lib/cardio.ts`/`CardioScreen` reconocen también las palabras clave en inglés (walk/bike/elliptical/run) para kcal e iconos; `getDisplayDayName` acepta prefijos "Día N -" y "Day N -".
- **Nombre y descripción de rutina editables**: en la creación (`NewRoutineScreen`, tarjeta inicial con ambos campos; si se dejan vacíos se generan como antes) y en la consulta (`RoutineDetailScreen`, tarjeta de cabecera + modal de edición vía `UPDATE_ROUTINE`). Solo rutinas no cerradas (cerrada = con logs y no activa; misma regla que la tarjeta "Rutina Cerrada" de Inicio), que muestran candado y no abren el modal.

### Cambios

- **Continuar en lugar de "completado" cuando falta algo hoy**: `todayWorkoutStatus` en `HomeScreen` consideraba un ejercicio "relleno" con que tuviera UNA sola serie metida, así que con la última serie de un ejercicio pendiente el hero ya decía "Entrenamiento completado". Ahora exige alcanzar el número de series objetivo (`targetSets`), el mismo criterio que usa `WorkoutLogScreen` para marcar un ejercicio como completado. El hero pasa a "Continúa tu entrenamiento" (antes "Continuar entrenamiento") mientras falte una serie, y pulsarlo lleva directo a la inserción del ejercicio pendiente. El modal de opciones ("¿Qué deseas hacer?") de la tarjeta de hoy cambia su botón "Editar" a "Continuar" (icono `play-outline`) en ese mismo caso; en días pasados o cuando ya está todo completo, sigue diciendo "Editar".
- **Resumen movido a Perfil**: la tarjeta de resumen (Rutinas/Entrenamientos/Sesiones cardio, con título "Resumen") vive ahora en `ProfileScreen` y se ha quitado de `DataScreen`, que queda centrada en exportar/importar/limpiar.
- **Subpantallas de Perfil sin barra de navegación**: Mis rutinas (selector), Datos y Configuración (que no son pestañas de navegación) dejan de mostrar la `FloatingPrimaryNav` y llevan el botón `FloatingBackButton` abajo, coherente con el resto de vistas de detalle.
- **Cabecera de rutina rediseñada** (`RoutineDetailScreen`): la tarjeta de nombre/descripción deja de parecer una tarjeta de día (transparente con borde izquierdo de acento) y pasa a un banner propio con fondo dorado tenue, insignia, "eyebrow" RUTINA y chip de edición.
- **Modo día más legible**: los oros de marca (`theme.gradients.primary`/`amber`) se vuelven más profundos en tema claro para que las tarjetas semanales de Fuerza y Cardio destaquen sobre el fondo claro; el botón "Volver" pasa a píldora oscura sólida con texto blanco (antes cristal claro, poco visible); y el título "GymBro" tiene una variante negra + oro (`assets/title-day.png`) para el modo día en vez del blanco + oro de noche.
- **Texto blanco sobre dorado en modo día**: nuevo token `theme.colors.onGold` (blanco en día, tinta oscura en noche) que sustituye a `darkGray` en todo el texto/iconos sobre rellenos dorados/rojos/verdes (hero de Fuerza y Cardio, botones Guardar/Crear/Importar, temporizador, badges); el oro sólido del día se profundiza (`primary`/`accent`) para que el blanco contraste. La numeración de ejercicios (`ExerciseInputField`) usa `colors.background` como inversa del badge para verse en ambos temas (en día quedaba oscuro sobre oscuro).
- **Sombras homogéneas**: las tarjetas de la gráfica (Inicio y Cardio) y las tarjetas semanales del historial reciben `theme.shadow`, igual que las hero, en ambos temas.
- Botones del modal de notas (`WorkoutLogScreen`) sin la sombra fuerte del `Button` (dejaba una mancha oscura bajo el botón en el bottom-sheet) y repartidos al ancho.
- **Hero de Cardio rediseñado**: protagonismo de la semana en curso (kcal grande con llama + sesiones · min · km) y tres referencias fijas comparables (kcal de semana pasada, media semanal y mejor semana) en lugar del "% vs media" y los totales históricos, que resultaban confusos. Se mantiene la fila de peso corporal.
- Texto del botón "Guardar" de un día de ejercicios centrado verticalmente (Anton pega los glifos arriba; mismo arreglo `lineHeight`/`includeFontPadding` que "Crear rutina").
- **Póster de logros semanales con selector de logros** (`lib/achievements.ts`, `AchievementPoster.tsx`): las 4 métricas fijas (mejora, mayor logro, racha, peso máximo) se sustituyen por un catálogo de logros candidatos solo positivos (mejora global, mejor ejercicio, récord personal, asistencia perfecta, racha, volumen movido, entrenos totales, series/reps, días) del que `selectSlots` elige de forma determinista los 4 mejores por prioridad, sin repetir categoría. Consecuencias: la primera semana ya no muestra huecos "—", una semana peor nunca pinta datos en rojo (entran constancia/volumen en su lugar), el peso máximo solo aparece como primera marca (sin histórico) y en su lugar aparece "Récord personal" solo cuando se bate el máximo histórico de un ejercicio.
- **Racha con sentido**: con asistencia perfecta se celebra "100% asistencia · ni un día faltado" en lugar del contador; el contador de días solo entra cuando la racha cubre al menos 2 semanas completas.
- **Nombres de ejercicio largos ya no desbordan el póster**: nuevo `fitSubLabel` (envuelve a 2 líneas, trunca a 24 caracteres con "…" y encoge la fuente 50→38 según la línea más larga); el tamaño del número central también se adapta a su longitud (`centerFontFor`).
- `HomeScreen` pasa a `computeWeekAchievements` el histórico completo (`historyLogs`) y los entrenos totales (`totalWorkouts`) para récords y contadores; tests nuevos del selector (67 en total).
- `versionCode` 13 → 14 en `android/app/build.gradle`.

### Correcciones

- **Sin parpadeo de rutina antigua al abrir**: `viewedRoutineId` en `HomeScreen` deja de fijarse al id de la rutina activa (queda `undefined` = "mostrar la activa") y vuelve a `undefined` cada vez que cambia `state.activeRoutineId`; solo se fija a un id concreto cuando el usuario elige explícitamente otra rutina en el selector. Corrige el frame en el que, tras la hidratación del storage, se veía una rutina desactualizada antes de la activa.
- **Nuevo `components/Collapsible.tsx`** para el plegado de semanas de Inicio: anima su propia altura (no un `transform` del padre) y mide el contenido con una copia invisible fuera de flujo (`position: absolute`, `opacity: 0`) en lugar del contenedor visible. En Android, forzar `height: 0` en el contenedor antes de medir propagaba esa restricción al hijo y `onLayout` nunca llegaba a reportar el alto real, dejando el acordeón bloqueado en 0. Sustituye al `CollapsibleWeekLogs` anterior (montaba/desmontaba sin animar altura).
- **Sombra de las tarjetas semanales/diarias de Inicio ya no se recorta**: se elimina el `ScrollView` anidado que envolvía la lista de semanas (cortaba en seco la sombra de elevación de las tarjetas); ahora comparte scroll con el resto de la pantalla, igual que Cardio.
- **Barra de navegación**: el fondo de la pestaña activa (`FloatingPrimaryNav`) pasa a ser una capa absoluta que aparece creciendo (`ZoomIn` de Reanimated) en lugar de un borde aplicado al propio item; icono y texto ya no se reajustan de tamaño/posición al activarse una pestaña.

### Documentación

- `COMMANDS.md`: se añade `./gradlew.bat clean` al flujo de compilación release y un aviso explícito de por qué es obligatorio tras tocar `app.json` (ver bug de versión desincronizada documentado en el cierre de la 0.5.9).

## Version 0.5.9 - 2026-07-10

### Nuevas funcionalidades

- **Backup completo con historial de peso corporal**: la exportación de datos (`app/App.tsx`) pasa a formato `version: 2` e incluye `cardioWeightHistory`; la importación lo restaura si viene (backups v1 siguen funcionando). Sin él, las kcal del cardio se recalculaban con el peso por defecto tras restaurar.
- **Detalle de entrenamiento con cardio por disciplina**: `DetailScreen` parsea el cardio con `cardioSessionFromLog` y muestra una caja por disciplina (minutos totales, rango de velocidad y de pendiente con `fmtNum`/`rangeStr`, ahora exportados de `lib/cardio.ts`); si el `rawInput` no es parseable cae al resumen simple anterior.

### Arquitectura

- **Historial de peso corporal centralizado en `lib/storage.ts`**: nuevas `getCardioWeightHistory`/`setCardioWeightHistory`/`isValidWeightSegments` (con migración del `cardioWeightKg` legado); `CardioScreen` deja de acceder a AsyncStorage directamente y las usa igual que la import/export de `App.tsx`.

- **Degradados centralizados en el tema**: nuevo `theme.gradients` (`primary`, `success`, `danger`, `warning`, `amber`, `sheen`) en `lib/theme.ts`. Sustituye los tríos de color duplicados a mano en 6 archivos (`Button`, `HeroCard`, `WorkoutLogScreen`, `CardioScreen`, `WeekAchievementScreen`, `NewRoutineScreen`); el danger de `Button` divergía del resto (`#D85555` vs `#D85151`) y queda unificado.
- **Nuevo `components/ConfirmModal.tsx`**: diálogo de confirmación único (overlay `theme.colors.overlay`, tarjeta surface, botones `Button`). Reemplaza los 5 modales de confirmación duplicados de `HomeScreen` (eliminar rutina/entrenamiento) y `DataScreen` (importar/limpiar), que tenían overlays y tipografías distintas entre sí (0.5/0.6/0.7 de opacidad, títulos 18/20px).
- **`GlassTopBar` con prop `icon`**: el patrón "icono 18px + título 20/800" que cada pantalla recreaba a mano con `titleElement` pasa a ser un prop; migradas 9 pantallas (Datos, Calendario, Cardio, Nueva rutina, Rutina, Elige la sesión, Logros, selector de Rutinas) y eliminados sus estilos locales duplicados. `titleElement` queda solo para el logo de Inicio y el icono de día.
- `HomeScreen` lee la versión desde `Constants.expoConfig` (como `App.tsx`) en lugar de `require('app.json')`; `AchievementPoster` toma sus colores del tema en vez de constantes locales duplicadas.

### Cambios

- **Tarjetas de comparación rediseñadas** (`ExerciseResultDisplay`): nombre del ejercicio en fuente display (como en la vista de inserción), objetivo `series×reps` centrado entre las columnas Actual/Anterior, flechas de estado coloreadas (verde/rojo/gris) en lugar de badges con fondo, filas con separador fino.
- **Iconos launcher regenerados** con nuevo `scripts/regen-icons.js`: recalcula todas las densidades `mipmap-*` desde `assets/adaptive-icon.png` con escala 0.52 y centrado vertical sobre la pesa (antes el contenido llenaba el viewport del icono borde a borde).
- **QRScannerScreen alineada con el tema**: fondo `background` (antes `#0A0A0A`), error `colors.error`, y el texto del botón "Importar rutina" pasa a oscuro sobre amarillo (antes blanco, sin contraste; en el resto de la app el texto sobre amarillo es oscuro).
- Notificación del timer de descanso con el amarillo de marca (`colors.primary`) en color e LED (antes `#F9A825`, ajeno a la paleta).
- Overlays de modal unificados a `theme.colors.overlay` (`WhatsNewModal`, modal de opciones de Inicio); el modal de opciones de Inicio adopta la tipografía del `ConfirmModal` (título 18 centrado); badges de "Elige la sesión" más grandes y legibles.
- `versionCode` 13 en `android/app/build.gradle`.

### Correcciones

- **Sin parpadeo de rutina al abrir**: `HomeScreen` ya no fija `viewedRoutineId` al id activo (queda `undefined` = "mostrar la activa"); solo se fija a un id concreto cuando el usuario elige explícitamente otra rutina en el selector, y vuelve a `undefined` en cuanto cambia la rutina activa. Antes, tras la hidratación, se mostraba por un frame una rutina semilla obsoleta en lugar de la activa.
- **Nuevo `components/Collapsible.tsx`**: acordeón que anima su propia altura (no un `transform`/`LayoutAnimation` del padre), usado en las semanas de Inicio. Mide el contenido con una copia invisible fuera de flujo (`position: absolute`, `opacity: 0`) en vez de medir el contenedor visible: en Android, forzar `height: 0` en el contenedor ANTES de medir propaga esa restricción al hijo y `onLayout` nunca llega a reportar la altura real, dejando el acordeón bloqueado en 0 para siempre aunque se marque como abierto (por eso los días no aparecían al desplegar). Al colapsar, el bloque siguiente se recoloca en flujo normal (altura real, sin transform), sin solaparse con el contenido que se recoge.
- **Sombra de las tarjetas semanales/diarias de Inicio corregida**: la lista de semanas ya no vive dentro de un `ScrollView` anidado (recortaba la sombra de elevación de las tarjetas en Android, dejándola con un corte duro sin redondear); ahora comparte scroll con el resto de la pantalla, igual que Cardio.
- **Barra de navegación**: el fondo de la pestaña activa aparece creciendo desde muy pequeño (`ZoomIn`) y pasa a ser una capa absoluta, de modo que el icono y el texto ya no se reajustan de posición al cambiar de pestaña (antes el borde del estado activo alteraba el tamaño del item).

- **El primer arranque en release ya no muestra rutinas de ejemplo**: `getSeedAppData` devuelve datos vacíos cuando `__DEV__` es false y `App.tsx` refleja el seed en el estado con dispatch (antes el reducer seguía enseñando las rutinas de fábrica aunque el almacenamiento quedara vacío). Los datos seed solo se cargan en desarrollo; usuarios con datos no se ven afectados.
- Celdas del calendario con altura fija (80) para que las filas midan lo mismo en los modos Fuerza y Cardio.
- **Versión mostrada en Inicio desincronizada del `versionCode`/`versionName` reales**: la tarea de `expo-constants` que embebe `app.json` en el `app.config` de assets (lo que lee `Constants.expoConfig` en runtime) no declara `app.json` como input de Gradle, así que una build incremental la daba por "up to date" y dejaba una versión vieja embebida (detectado tras este mismo cierre: la app instalada mostraba 0.5.2 con un APK cuyo manifiesto ya llevaba versionCode/versionName de la 0.5.9). Arreglado con `gradlew clean` antes de compilar release; documentado como paso obligatorio en `COMMANDS.md` y en el agente `close-version` para futuros cierres.

### Documentación

- `AGENTS.md`: la subida de versión documenta los **5** puntos reales (faltaban `android/app/build.gradle` y `data/changelog.ts`), referencia al subagente close-version y la convención de sección `## Sin publicar` en este archivo.
- `frontend-design.md` reescrito como sistema de diseño completo (paleta, degradados, tipografía Anton, glass, patrones de componentes, checklist visual).
- `SETUP.md` reescrito (estaba obsoleto: pantallas inexistentes, rutas de otro equipo, colores de una versión antigua); `ROADMAP.md` podado (separa lo ya implementado y lo incompatible con las restricciones); `README.md` corrige el stack (SQLite, no AsyncStorage); `CONVENTIONS.md` y `ARCHITECTURE.md` recogen los nuevos patrones.
- Verificado `npm run type-check` y `npm test` (60/60) en verde.

## Version 0.5.8 - 2026-07-10

### Nuevas funcionalidades

- **Popup "Qué hay de nuevo"**: al abrir la app tras una actualización se muestra un modal (`components/WhatsNewModal.tsx`) con las novedades de la versión, leídas de `data/changelog.ts` (array `CHANGELOG` con `{version, items}`). `app/App.tsx` compara la versión actual (`Constants.expoConfig.version`) contra `gymbro_last_seen_version` (nuevas `getLastSeenVersion`/`setLastSeenVersion` en `lib/storage.ts`); en instalación nueva no se muestra nada, solo se marca la versión como vista.
- **Icono adaptativo de Android configurado vía Expo**: `app.json` añade `expo.android.adaptiveIcon` (`foregroundImage: assets/adaptive-icon.png`, fondo negro), sustituyendo el cableado manual de `mipmap-anydpi-v26/ic_launcher.xml` de 0.5.7 por la vía estándar de Expo; icono e iconos de todas las densidades (mdpi a xxxhdpi) recomprimidos y `title.png` ajustado.

### Arquitectura

- **Firma release real**: `android/app/build.gradle` añade soporte de `keystore.properties` (fuera de git) para firmar el APK/AAB con el keystore de publicación; si no existe el archivo, sigue cayendo a la firma debug para compilar en local sin configuración adicional. `.gitignore` excluye `android/keystore.properties` y `android/app/*-release.keystore`. `versionCode` 9 → 10.
- **Capturas de pantalla para la ficha de Play Store**: nuevos scripts de Playwright (`scripts/capture-phone*.js`) que navegan la app en Expo web y generan capturas automáticas en `store-assets/screenshots/` (móvil y tablet 7"/10"), junto con el icono de 512px y el feature graphic de la ficha.

### Correcciones

- **Parche a `react-native-screens`**: `patches/react-native-screens+3.31.1.patch` (vía `patch-package`) corrige un crash nativo en `ScreenStack.kt` (`removeLast()` no disponible en la versión de Kotlin del proyecto), sustituido por `removeAt(lastIndex)`.
- Verificado `npm run type-check` y `npm test` (60/60) en verde tras estos cambios.

## Version 0.5.7 - 2026-07-09

### Nuevas funcionalidades

- **Rebranding a GymBro**: la app cambia de nombre en toda la interfaz, documentación y comentarios de código (`GymToni`/`GymTrack` → `GymBro`); nuevo `assets/title.png` (744×158) con el wordmark actualizado.
- **Iconos nuevos**: diseño renovado (mancuernas + check, negro sólido con detalle amarillo/dorado) para `assets/icon.png` y las 5 densidades del adaptive icon de Android (mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi), generado desde un master de 432×432.
- **Nuevo `privacy-policy.html`** en la raíz del repo con la política de privacidad (la app no recopila ningún dato, todo se guarda localmente), pensado para publicarse vía GitHub Pages y cumplir el requisito de ficha de Google Play Console.

### Arquitectura

- **Nuevo package Android**: `com.gymtrack.app` → `com.tonigallego.gymbro` (colisión con el paquete antiguo ya registrado en Play Console). Afecta `app.json` (`android.package`, `ios.bundleIdentifier`, `scheme`, `slug`), `android/app/build.gradle` (`namespace`, `applicationId`), `android/settings.gradle` (`rootProject.name`), `AndroidManifest.xml` y la carpeta Java, movida con `git mv` de `com/gymtrack/app/` a `com/tonigallego/gymbro/` (`MainActivity.kt`, `MainApplication.kt`).
- **Adaptive icon de Android arreglado**: el icono adaptativo nunca estuvo realmente cableado (`mipmap-anydpi-v26` vacía y `iconBackground` en `colors.xml` sin uso en ningún XML). Se añade `mipmap-anydpi-v26/ic_launcher.xml` y se cambia `iconBackground` a `#000000`.
- **Identificadores internos renombrados**: BD SQLite `gymtoni.db` → `gymbro.db` (`lib/db/index.ts`), claves de AsyncStorage `gymtrack_app_data`/`gymtrack_logs` → `gymbro_app_data`/`gymbro_logs` (`lib/storage.ts`), deep link scheme `gymtrack://` → `gymbro://` (`app.json`, `lib/routineShare.ts`, `app/+native-intent.ts`, `app/App.tsx`).
- `assets/splash.png` eliminado (no se usa: el splash nativo de Android es solo color de fondo vía `splashscreen.xml`).

### Cambios

- Nombres de fichero de exportación con el nuevo prefijo `gymbro-` (backup JSON, imagen/vídeo de logros semanales en `WeekAchievementScreen`).

### Correcciones

- Ninguna pendiente relevante para el usuario en este cierre; verificado `npm run type-check` y `npm test` (60/60) en verde.

## Version 0.5.7 - 2026-07-08

### Nuevas funcionalidades

- **Iconos de grupo muscular / tipo de sesión**: nuevo sistema de siluetas monocromo (`components/GymIcon.tsx` + lógica pura en `lib/gymIcons.ts`, con `GymIconName`, `detectGymIcon` y `resolveDayIcon`) que sustituye a los puntos de color para distinguir los días. Cada día se identifica por su icono (pecho, hombro, espalda, bíceps, tríceps, abdominales, piernas, push, pull, torso, full body) en lugar del emoji de color.
- **Selector de icono al crear rutina**: en `NewRoutineScreen` cada día tiene un selector de icono (modal con todas las siluetas). El icono se autodetecta a partir del nombre del día (`detectGymIcon`) y, si no puede inferirse, se obliga a elegirlo a mano antes de guardar.
- **Calendario con vista Fuerza / Cardio**: `CalendarScreen` añade un conmutador que alterna entre fuerza (icono del día + semana de la rutina + chip R1/R2 de rutina) y cardio (icono de carrera + minutos de la sesión); el toggle solo aparece si hay cardio registrado (`cardioByDate`, `cardioSessionFromLog`). Cada celda de cardio abre el detalle de ese día al pulsarla.
- **Compartir rutina con icono**: `buildRoutineShareText` añade una etiqueta `[#icono]` al final del título de cada día y `parseRoutineShareLink` la interpreta (`stripIconTag`), de modo que el icono viaja tanto en el texto plano como en el QR (`icon` en el payload).

### Arquitectura

- Nuevo `lib/layoutAnimation.ts`: se centraliza `animateLayout()` (activación de `LayoutAnimation` en Android incluida), antes duplicada en `HomeScreen`, para reutilizarla en el conmutador del calendario.
- `getTrainingAccent` deja de mapear emojis a colores: el acento visual (bordes, degradados, puntos, calendario) pasa a blanco uniforme y la distinción es por icono. Se conserva la firma para no tocar los ~40 consumidores del acento.
- Limpieza de lógica muerta en `lib/parsers.ts` y `lib/progress.ts` (`formatMergedCardio`, `formatSets`, `getBestSetStrengthScore` sin uso); `readLegacyJsonData` pasa a `async` en `lib/storage.ts`. `versionCode` 8 → 9.

### Cambios

- **Registro de ejercicio más claro**: `ExerciseInputField` sugiere peso y repeticiones automáticamente (última serie hecha, historial previo o tope del rango objetivo), muestra las notas del ejercicio y del entrenamiento anterior, y representa las series de peso corporal / asistidas con "—" en vez de valores negativos.
- **`DayAccentIcon` admite color** y tamaños mayores en tarjetas, detalle y calendario; el día activo y los acentos en detalle pasan a gris/blanco para no competir con el icono.

### Correcciones

- La rutina activa se distingue en el calendario por el color del texto del chip R (amarillo) frente a las no activas (gris), en vez de por borde de pastilla, evitando el desalineado del texto en Android.

### Nuevas funcionalidades

- **Cardio como sección propia**: nueva pantalla `CardioScreen` con su pestaña "Cardio" en la barra inferior (`FloatingPrimaryNav`), que aparece solo cuando existe algún registro de cardio (`hasAnyCardio`). Reinterpreta los cardios ya guardados dentro de los días de fuerza (`WorkoutLog.cardio.rawInput`) como una experiencia independiente: sesiones agrupadas por semana ISO y por mes, con kcal quemadas, minutos, distancia y velocidad, mejora semana a semana y gráfica mensual por métrica.
- **Estimación de kcal por disciplina y peso**: nuevo `lib/cardio.ts` (lógica pura con tests en `lib/__tests__/cardio.test.ts`) que estima calorías con ecuaciones ACSM (VO2, incorporando la pendiente) para andar/correr y un modelo distancia × factor para bici/elíptica. El usuario puede fijar su peso, con tramos históricos (`WeightSegment`) para que cada cardio use el peso vigente cuando se registró.
- **Andar en cinta**: `CardioInputField` añade la disciplina "Andar en cinta" (con campo de pendiente), separada de "Correr en cinta". Los cardios antiguos con pendiente se reclasifican retroactivamente como "andar" hasta la fecha de corte.
- **Compartir rutina en texto plano**: `RoutineDetailScreen` añade un botón que copia la rutina al portapapeles (`buildRoutineShareText` + `expo-clipboard`) en el mismo formato que entiende "Crear a partir de texto plano", con aviso `Toast` al copiar.

### Cambios

- **Toast flotante global**: `Toast` pasa a posición absoluta sobre la barra inferior (respetando `safe-area`), con soporte de duración configurable; se usa el aviso "Rellena primero los datos" al intentar añadir una serie vacía (`ExerciseInputField.onInvalidAdd` → `WorkoutLogScreen`).
- **Tarjeta de progreso semanal en la primera semana**: en Inicio, la primera semana de una rutina no se despliega (no hay semana previa con la que comparar) y muestra un mensaje de ánimo en lugar de flecha y porcentaje.
- **Hero de Inicio y día actual resaltados**: la tarjeta "Empezar entrenamiento" se rediseña (icono de toque + pesa junto al título) y el día de hoy se resalta con gradiente tanto en el calendario como en el historial de Inicio.

### Correcciones

- **Títulos con tipografía Anton sin recortar**: se ajusta el interlineado y el padding de fuente en `HeroCard` y en el título de `NewRoutineScreen` para que los glifos de Anton no se corten por arriba. `versionCode` 7 → 8.

## Version 0.5.5 - 2026-07-01

### Nuevas funcionalidades

- **Continuar entrenamiento del día**: la tarjeta principal de Inicio distingue ahora tres estados del entreno de hoy (sin empezar / empezado con ejercicios pendientes / completado). Si está a medias muestra "Continuar entrenamiento" y al pulsar abre directamente ese día en vez del selector.
- **Cardio bajo demanda**: el campo de cardio en el registro deja de ocupar sitio siempre. Mientras no hay cardio guardado se muestra un botón "Añadir cardio"; la tarjeta de cardio solo aparece cuando hay datos y se tiñe con el color de acento del día.
- **Crear rutina con ejercicios plegables**: en `NewRoutineScreen`, cada ejercicio ya definido se colapsa a una fila de resumen (nombre · `SxR`) con lápiz para editar y ✓ para plegar; al añadir uno nuevo se abre su editor y los demás quedan colapsados. Cada día arranca con un color de acento propio de una paleta (`DAY_COLOR_PALETTE`) aunque aún no tenga nombre.

### Cambios

- **Tarjetas de ejercicio plegables**: `ExerciseInputField` se reorganiza en secciones desplegables (contexto objetivo/anterior arriba, resultados fijos en medio, inputs/completado abajo). La tarjeta reajusta su altura con `LinearTransition` de Reanimated (render condicional), en vez de medir la altura a mano. Badge de orden y de mejora, borde completo teñido con el acento.
- **Historial de semanas con despliegue fiable**: en Inicio, abrir/cerrar una semana refluye el layout de forma síncrona y cada entrenamiento anima su entrada con `FadeInDown`; el contenedor se mantiene montado para animar también la salida.
- **Semana completada solo el mismo día**: la tarjeta "¡Semana completada!" (con acceso a la imagen/vídeo de logros) solo se ofrece el día en que se cierra la semana; al día siguiente vuelve a "Empezar entrenamiento" para iniciar la siguiente.
- **Vídeo de logros más fluido**: la exportación pasa a 30 fps con fotogramas reales (sin repetición), animación de ~4 s + 4 s de resultado fijo (~8 s totales), sin trompicones.
- **Color de día marrón**: el día amarillo 🟡 se sustituye por marrón 🟤 (nuevo `emoji_brown`) y el púrpura se aclara, para no confundirse con el amarillo de acento de la marca.
- **Navegación y botón atrás en blanco**: la barra de navegación inferior y el botón flotante de atrás pasan de amarillo (`primary`) a blanco para mejor legibilidad.
- **Calendario acotado**: las flechas de mes anterior/siguiente se deshabilitan (atenuadas) al llegar al mes del primer registro guardado o al mes actual, evitando navegar a meses vacíos.

### Correcciones

- El wordmark del título ("GymToni") ahora rasteriza correctamente dentro de la imagen/vídeo de logros en Android: en nativo se pasa el módulo del asset (`require`) en vez de un data URI, que no se pintaba con `toDataURL`. Eliminado el texto de respaldo "GymToni" del póster.
- **Arranque sin parpadeo**: el splash nativo se mantiene hasta que los datos reales están hidratados desde almacenamiento; ya no se ven un instante los datos de ejemplo antes de saltar a los reales (`App.tsx`).
- **Plegado fiable en la build de release**: las animaciones de altura de las tarjetas de ejercicio y de las semanas del historial se reescriben con `LinearTransition`/`FadeInDown` de Reanimated; el método anterior medía la altura con `onLayout` y en release devolvía 0, dejando el cuerpo recortado o sin animar. `versionCode` 6 → 7.

## Version 0.5.4 - 2026-06-27

### Nuevas funcionalidades

- **Imagen de logros de la semana**: cuando se completan todos los días de la rutina activa, la tarjeta principal de Inicio pasa a "¡Semana completada! Pulsa para ver resultados". Abre una pantalla con una imagen lista para redes (1080×1350) que muestra la semana, los días entrenados, la **racha de semanas seguidas**, el **mayor logro** (ejercicio con mayor mejora respecto a la semana anterior) y el **récord de peso** de la semana. Se exporta a PNG con `react-native-svg` y se comparte con la hoja del sistema (sin dependencias nativas nuevas).
- **Logros de semanas pasadas**: mantener pulsada 3 s la cabecera de una semana no actual en el historial de Inicio abre su pantalla de Logros con los datos de esa semana concreta (racha y serie de progreso reconstruidas hasta esa semana).
- **Inserción de rutina más cómoda**: el cuadro de texto con sintaxis `[4x6-8]` se sustituye por un editor estructurado por ejercicio: nombre, stepper de series (➖/➕) y campo de repeticiones con conmutador **reps / segundos**. Añadir y quitar ejercicios con un toque; la importación por QR rellena estas filas automáticamente.

### Arquitectura

- Nuevo `lib/achievements.ts` (cálculo puro y testeable de los logros semanales), `components/AchievementPoster.tsx` (póster SVG) y `lib/imageShare.ts` (guardar/compartir PNG base64). Nueva pantalla `WeekAchievementScreen` y estado `week-achievement` en `App.tsx`.
- `HeroCard` admite subtítulo y nueva variante `week-completed`.
- **Compartir resultados como vídeo (MP4)**: la pantalla de logros anima la imagen (aparición escalonada + donuts rellenándose) y el botón «Compartir resultados» exporta un vídeo (~48 s, animación muy pausada y tipografía de marca Anton); si el codificador no está disponible (web o binario sin recompilar) cae a compartir el PNG estático. Nuevo **módulo nativo local** `modules/video-encoder` que codifica los fotogramas a MP4 H.264 (Android `MediaCodec`+`MediaMuxer`, iOS `AVAssetWriter`), sin dependencias externas. La captura de fotogramas usa `react-native-svg` `toDataURL`; `lib/videoExport.ts` envuelve el módulo y se desactiva en web. **Requiere recompilar el binario nativo** (`expo prebuild`/EAS); `versionCode` 5 → 6.

### Cambios

- Pantalla de Logros: subtítulo de la barra superior a "Comparte tus resultados en redes", retirada la frase "¡Has completado la Semana…!" sobre el póster y más separación entre "SEMANA" y "¡COMPLETADA!" en la imagen.

## Version 0.5.3 - 2026-06-27

### Nuevas funcionalidades

- **Importar rutina por QR**: nueva pantalla de importación (botón "Crear a partir de QR" en "Nueva rutina" e Inicio). Escanear el QR con la cámara del móvil abre GymToni con la rutina prerrellenada; también admite pegar el enlace `gymtrack://import-routine?data=...` a mano.
- **Filtro de la gráfica de progreso**: bajo la gráfica de Inicio, un botón que rota a cada pulsación entre "Semana completa" (por defecto) y cada día de la rutina. El eje sigue siendo por semanas; el filtro solo restringe qué sesiones puntúan.

### Correcciones

- La flecha de cada serie (↑/↓) en la comparativa usaba un criterio distinto que el porcentaje del ejercicio, por lo que podían contradecirse. Ahora ambos usan la misma puntuación (1RM estimado por serie), así que tarjeta y porcentaje son siempre coherentes.
- La importación completa fallaba en nativo: con ~3000 filas el aluvión de `finalize` (un statement por fila) abortaba la transacción ("NativeStatement.finalizeAsync()"). Ahora `bulkInsert` reutiliza un único prepared statement por tabla.
- Borrado y reescritura de datos en SQLite ya no deja filas huérfanas ni choca en PK al reimportar: el `ON DELETE CASCADE` no se aplica en la conexión de `withExclusiveTransactionAsync` (sin `PRAGMA foreign_keys = ON`), así que ahora se borra explícitamente tabla a tabla (hijos antes que padres) en guardar/vaciar/upsert/borrar rutina y upsert de entrenamiento.
- El cronómetro de series ahora reinicia a cero en cada inicio (descarta el valor parado anterior); eliminado el botón de reset, ya redundante.
- Editar un entrenamiento de un día que no es el de hoy ya no abre el formulario vacío: `WorkoutLogScreen` no recibía el `log` a editar, así que precargaba en blanco y al guardar creaba un registro nuevo. Ahora se pasa el log, se prerrellenan series/notas/cardio y al guardar se actualiza ese mismo entrenamiento.
- Al editar un entrenamiento antiguo, el apartado "Anteriores" de cada ejercicio mostraba el último resultado registrado en vez del realmente anterior a esa sesión. Ahora se descartan los logs posteriores al que se edita y se muestra el inmediatamente previo a su fecha.

### Cambios

- **Porcentajes de progreso replanteados**: Inicio (comparativa diaria y semanal) deja de promediar el porcentaje de cada ejercicio —donde un accesorio ligero con gran % distorsionaba el total— y ahora agrega la puntuación de fuerza de toda la sesión/semana en un único porcentaje, el mismo criterio que ya usaban la comparativa de Detalle y la gráfica. La métrica base es el **1RM estimado** (Epley): subir peso aunque baje alguna repetición cuenta como progreso (no como retroceso, como haría el volumen de carga), y sumar las series sigue premiando hacer más series y más reps. Las regresiones se muestran de forma coherente en todas las pantallas (antes Inicio las recortaba a 0).
- Deep link de importación robusto: `app/+native-intent.ts` redirige `import-routine` a la raíz para que expo-router no muestre "Unmatched Route"; el listener de `Linking` en `App.tsx` procesa la URL original.
- Botones (`Button`) con degradado por variante (primary dorado, danger rojo) y brillo superior (sheen), al estilo del botón "Guardar".
- Calendario: el chip de rutina (R1, R2…) se pinta en amarillo solo si es la rutina activa (blanco el resto); el borde del día de "hoy" pasa a azul primario.
- Android: iconos de notificación regenerados; `colorPrimary` y splash ajustados; `versionCode` 4 → 5. Workaround de `aapt2` local en `gradle.properties` (bug de AGP 8.2.1 con referencias `@android:color/` en AARs).

## Version 0.5.2 - 2026-06-11

### Nuevas funcionalidades

- **Compartir rutina por QR**: en el detalle de una rutina, botón "Compartir por QR" que genera un código con toda la rutina (días y ejercicios). Otro móvil con GymToni instalada lo escanea y abre "Nueva rutina" con el contenido prerrellenado, listo para crear. Todo local, sin servidor.

### Arquitectura

- El QR codifica un deep link `gymtrack://import-routine?data=...` con la rutina minificada (sin IDs: se regeneran al importar para evitar colisiones). Nuevo `lib/routineShare.ts` para codificar/decodificar el enlace.
- `App.tsx` escucha el deep link (`expo-linking`) en arranque y en caliente, y enruta a "Nueva rutina" con los días iniciales. `NewRoutineScreen` acepta `initialDays` para prerrellenar el formulario.
- Nuevas dependencias `react-native-svg` + `react-native-qrcode-svg` para pintar el código (requiere recompilar el binario nativo).

## Version 0.5.1 - 2026-06-11

### Arquitectura

- **Persistencia granular en SQLite**: cada acción (crear/editar/borrar rutina, día o entrenamiento, cambiar rutina activa) escribe en la base de datos solo lo que cambia, en lugar de reescribir todos los datos en cada cambio. Eliminado el guardado completo periódico; un wrapper del `dispatch` traduce cada acción a su escritura mínima (`lib/persistence.ts`), serializada en una cola para preservar el orden.
- Editar una rutina o un día hace _upsert_ preservando la identidad de la rutina y de los días que perduran, de modo que el historial conserva sus referencias (antes editar la rutina podía dejar logs sin asociación correcta).
- Primer arranque sin datos siembra la base con las rutinas de fábrica. En web se mantiene el guardado completo en JSON con debounce.

### Cambios

- "Vaciar datos" deja la app vacía e inicializada: las rutinas de fábrica ya no reaparecen al reiniciar tras vaciar.

## Version 0.5.0 - 2026-06-11

### Arquitectura

- La persistencia en nativo pasa de JSON en AsyncStorage a **SQLite** (`expo-sqlite`): nuevo `lib/db/` con esquema relacional (rutinas → días → ejercicios como plan; logs → ejercicios → series como historial), migraciones por `PRAGMA user_version` y mappers puros testeados. En web se mantiene JSON/localStorage (expo-sqlite no soporta web en SDK 51).
- Migración automática y única al arrancar: si existen datos JSON del formato anterior, se vuelcan a SQLite y se eliminan las claves antiguas. `storage.ts` conserva su interfaz (`loadAppData`/`saveAppData`/`clearAppData`), el resto de la app no cambia.
- Datos saneados en el nuevo modelo: el flag `isActive` duplicado deja de persistirse (la rutina activa vive en `settings`), las series se guardan como filas (no como derivado del texto), desaparece el doble guardado de logs y las referencias colgando del historial se anulan de forma controlada.
- `generateId()` ahora devuelve GUID (UUID v4); las rutinas/días/ejercicios nuevos usan GUID en lugar de ids derivados de `Date.now()`.

### Cambios

- Cualquier rutina puede borrarse, incluidas las de fábrica: eliminado el campo `isCustom` (siguen sin poder borrarse rutinas con entrenamientos registrados).

## Version 0.4.9 - 2026-06-10

### Cambios

- Barra de estado del móvil ahora transparente y edge-to-edge: el contenido se dibuja detrás del status bar y la barra de título glass (`GlassTopBar`) lo cubre, de modo que status bar y título parecen un único elemento translúcido y se ve el fondo a través.

### Arquitectura

- Android pasa a edge-to-edge real: `targetSdk`/`compileSdk` 34 → 35 (en Android 15+ targetear SDK < 35 forzaba el inset del status bar). `MainActivity` configura `statusBarColor` transparente, `layoutInDisplayCutoutMode=shortEdges` (para muescas/cámara) y desactiva el contraste forzado.
- Nuevo `app/_layout.tsx` con `<Slot/>`: elimina el `Stack` por defecto de expo-router, que envolvía la ruta e inseteaba el contenido el alto del status bar.
- Patch de `expo-modules-core` (`patches/`) para compilar contra SDK 35 (`requestedPermissions` pasó a nullable en API 35).

## Version 0.4.8 - 2026-06-09

### Nuevas funcionalidades

- Indicador de racha en Inicio ("🔥 N semanas seguidas") que cuenta semanas completadas consecutivas; una semana en curso no rompe la racha.

### Cambios

- Vista de día de entrenamiento terminado acorde a Inicio: cada tarjeta de ejercicio y la de cardio se tiñen con el color del día (`GradientFill` + borde de acento), con el nombre del ejercicio en fuente display. El título de la barra muestra solo el nombre del día (sin el prefijo "Día X -") y se eliminó el encabezado "Ejercicios" redundante.
- Barra superior (`GlassTopBar`) ahora crece con el contenido: los títulos de 2 líneas ya no empujan la fecha/subtítulo contra el borde inferior.
- Vistas Rutinas y Datos acordes a Inicio: tarjetas de rutina, de día (detalle de rutina) y de resumen/acciones de Datos con gradiente sutil (`GradientFill`), borde de acento y títulos en fuente display; los contadores de Datos (rutinas/entrenamientos) también en fuente display.
- Calendario acorde a Inicio: cabecera de mes con gradiente sutil (`GradientFill`), borde de acento y nombre del mes en fuente display; el día de "hoy" se resalta en azul (antes blanco) para alinearse con el resto de la app.
- Pantalla de rellenar ejercicios rediseñada acorde a Inicio: cada tarjeta de ejercicio se tiñe con el color del día (push azul, pull rojo, pierna verde) mediante borde de acento, gradiente sutil (`GradientFill`) y círculo de acento, con el nombre en fuente display y las series añadidas como chips del mismo color. Botón "Guardar" con gradiente dorado estilo tarjeta principal.
- Pantalla de nueva rutina rediseñada acorde a Inicio: cada día se tiñe en vivo con el color de su tipo (push azul, pull rojo, pierna verde) mediante borde de acento y gradiente sutil (`GradientFill`), con círculo de acento, emoji y "Día N" en fuente display.
- Previsualización de ejercicios en vivo bajo el campo de texto: chips con el nombre y el esquema de series×reps (p. ej. "Press banca · 4×6-8"), confirmando que la sintaxis `[4x6-8]` se interpretó.
- Botón "Crear rutina" con gradiente dorado estilo tarjeta principal, y "Añadir/Quitar día" convertidos en chips-pill coherentes con el resto de la app.
- Barra de navegación inferior con etiqueta de texto bajo cada icono (Entrenar, Rutinas, Calendario, Datos), más clara que solo iconos.
- Indicadores de tendencia unificados a iconos vectoriales (flechas y chevrons) en la tarjeta de progreso, las cabeceras de semana y el historial, sustituyendo los símbolos de texto (▲▼↑↓✓).
- El resaltado del entrenamiento de "hoy" pasa de ámbar a azul, para que no compita con el amarillo de marca.
- Fuente display "Anton" (condensada, estilo deportivo) en los titulares: tarjeta principal, "Semana N", "Rutina N" y nombres de día. Cargada con expo-font (sin dependencias nuevas).
- Animación de despliegue suave al expandir/colapsar semanas y el gráfico de progreso.
- Los porcentajes de mejora destacados (progreso y semanas) cuentan animados desde 0.
- Gráfico de progreso mejorado: etiqueta de valor sobre cada barra y resaltado de la mejor semana.

## Version 0.4.7 - 2026-06-08

### Cambios

- Tarjeta principal de Inicio rediseñada: fondo con gradiente diagonal y brillo superior (sheen) para dar relieve, con paleta propia por estado (empezar, completado, cerrada, añadir rutina).
- Animación de pulsación con spring (la tarjeta se hunde y rebota al tocar), sustituyendo el cambio de opacidad anterior.
- Tarjeta de progreso y cabeceras de semana con el mismo tratamiento: gradiente oscuro sutil, tinte según mejora/empeoramiento y sheen, vía nuevo `components/GradientFill.tsx`.
- Extraída la hero a componente reutilizable `components/HeroCard.tsx`; `HomeScreen` consume `variant` en lugar de estilos inline.

## Version 0.4.6 - 2026-06-08

### Arquitectura

- Nuevo `lib/weeks.ts` con la lógica de agrupación en semanas (`groupLogsIntoWeekBlocks`) y de puntuación semanal (`getWeekStrengthScore`), antes duplicada en Home y Calendario.
- Helpers compartidos en `lib/utils.ts`: `getLogTimestamp` (timestamp comparable de un log) y `getImprovementDisplay` (símbolo/texto/tipo de una mejora), eliminando las copias repartidas por las pantallas.
- `WorkoutLogScreen` deduplicado: `buildWorkoutLog` y `persistWorkoutLog` reemplazan la lógica de guardado repetida entre auto-guardado y guardado manual.
- `FIRST_TIME_IMPROVEMENT_PERCENT` centralizado en `lib/progress.ts`.

### Nuevas funcionalidades

- El parser de series admite pesos combinados (p. ej. `8+8x11` → 16 kg) para cargas con dos mancuernas.
- Cardio admite múltiples entradas por sesión.

### Correcciones

- Unificado el porcentaje de mejora de "primera vez" (antes 30% en unas pantallas y 100% en otras).
- El cálculo de mejora semana a semana compara de verdad la semana actual contra la anterior (antes calculaba un valor que no usaba la semana previa concreta).
- El entrenamiento se auto-guarda también al borrar o terminar series (antes solo al añadir).
- Eliminados `console.log` de depuración y código muerto (modal de cambio de día inalcanzable).
- Quitados casts `as any` y el ID de rutina hardcodeado.

### Cambios

- Persistencia con debounce (agrupa ráfagas de cambios en una sola escritura).
- Importación de datos con validación de estructura más estricta.
- Tests automatizados (Jest + ts-jest) para `lib/parsers.ts` y `lib/progress.ts` (23 casos).
- Iconos de cardio corregidos (cinta y bici estática).
- `buildlog.txt` añadido a `.gitignore`; metadatos de `package.json` alineados con la app.
- Android: memoria del daemon de Gradle aumentada para builds más estables.

## Version 0.4.5.c - 2026-05-31

### Arquitectura

- Capa de normalización centralizada en `lib/normalize.ts`: `syncActiveRoutine`, `ensureParsedSets`, `resolveActiveRoutineId` y `normalizeAppData` como fuente única de verdad.
- `lib/utils.ts` extraído de `storage.ts`: `generateId`, `formatDate`, `getToday`.
- `lib/fileIO.ts`: operaciones de fichero (importar/exportar JSON) desacopladas de `App.tsx`, con lógica específica por plataforma (web/nativo).
- `lib/storage.ts` y `WorkoutContext.tsx` refactorizados para eliminar duplicaciones usando `lib/normalize.ts`.

### Nuevas funcionalidades

- Cronómetro de series para ejercicios basados en tiempo (detecta unidades `s`, `seg`, `min` en el objetivo): muestra pantalla Start/Stop, botón "Usar Xs" y Reset.
- Home sincroniza automáticamente con la rutina activa al arrancar la app (ya no queda rutina desincronizada tras cargar datos).

### Cambios

- Comportamiento de pulsación en logs del historial: logs de días pasados abren el detalle directamente; el log de hoy muestra modal con opciones editar/eliminar.
- Gráfica semanal unificada con el listado: misma penalización por días faltantes (`penaltyFactor`) y mismo tipo de porcentaje (delta semana-a-semana en lugar de acumulado desde la semana 1).
- Calendario: la etiqueta de rutina en cada celda muestra número ordinal (R1, R2…) en lugar del ID interno.
- Botón "Añadir cardio" ahora usa fondo amarillo primario (era casi invisible con `primaryMuted`).
- Opciones de selección de cardio con icono representativo a la izquierda y color amarillo (borde, icono y texto).
- Iconos de editar y borrar cardio corregidos: editar en amarillo primario, borrar en rojo.

## Version 0.4.5.b - 2026-04-23

### Cambios

- Ajustes y arreglos en los porcentajes
- Opción para eliminar días de ejercicio antiguos
- Mejoras visuales en varios puntos de la aplicación

## Version 0.4.5.a - 2026-04-10

### Cambios

- Eliminados los emojis de colores y sustituidos por icons que usan colores a traves de css.
- Cohesión de la barra de título en todas las ventanas.
- Ajustes visuales en la barra de navegación.
- Mejora general en la coherencia visual.

## Version 0.4.5 - 2026-04-09

### Nuevas funcionalidades

- Nueva barra flotante primaria reutilizable para la navegacion principal entre Entrenar, Rutinas, Calendario y Datos.

### Cambios

- Flujo de navegacion refinado: Calendario y Datos pasan a usar la barra primaria flotante y el detalle de rutina vuelve a "Selecciona una rutina".
- Limpieza visual en vistas clave sustituyendo emojis visibles por iconos de Material Design Icons, manteniendo los colores de los dias de rutina.
- Selector de rutinas, detalle, nueva rutina, calendario, datos y registro de entrenamiento adaptados al nuevo sistema iconografico.
- Home: `assets/title.png` reducido para integrarse mejor en la top bar.
- Top bar ajustada para acercar el contenido a la barra de estado y mejorar la integracion edge-to-edge.
- Android: barra de estado nativa configurada como transparente para integrarse con la cabecera glass.
- Dependencia `expo-blur` alineada con Expo SDK 51 para evitar incompatibilidades en Android.

## Version 0.4.4.a - 2026-04-09

### Nuevas funcionalidades

- Nuevo sistema visual reutilizable tipo glass para cabeceras y acciones flotantes (top bar fija con blur + overlays).
- Nueva barra flotante reutilizable para acciones principales en Home.
- Personalizacion de titulo en la top bar mediante nodo React (soporte para imagen en lugar de texto).

### Cambios

- Rediseño edge-to-edge aplicado y unificado en pantallas clave: Rutina, Selector de dia, Detalle, Registro de entrenamiento, Nueva rutina, Calendario y Datos.
- Botones Volver convertidos a estilo flotante glass en vistas con retorno.
- Navegacion principal integrada en Home dentro de barra flotante (Rutinas, Calendario y Datos), eliminando la barra inferior clasica de App.
- En selector de rutinas, acceso a "Consultar detalles" movido a boton dedicado dentro de la propia vista.
- Calendario: se añade boton Volver flotante y ajuste de espaciado inferior para evitar solapes.
- Datos: se añade boton Volver flotante y ajuste de espaciado inferior para evitar solapes.
- Home: la cabecera superior ahora usa `assets/title.png` como titulo visual y alineado a la izquierda.
- Unificacion global de parametros de blur/transparencia mediante tokens compartidos para mantener homogeneidad visual.

## Version 0.4.3 - 2026-04-08

### Cambios

- Penalizacion por faltas al gym ajustada a 10% por dia no entrenado en el calculo semanal.
- Unificacion del calculo de mejora semanal entre grafica y listado en Home (misma formula y mismos criterios).
- La grafica semanal ahora muestra delta semanal directo (semana vs semana anterior) en lugar de progreso acumulado.
- En semanas cerradas (cuando ya arranco la siguiente), el porcentaje aplica penalizacion por dias no entrenados segun la misma regla del listado.
- APK de release regenerada localmente tras los cambios: app-release.apk.

## Version 0.4.2 - 2026-04-08

### Nuevas funcionalidades

- Temporizador resiliente basado en timestamp de fin: sigue corriendo correctamente aunque la app pase a segundo plano o el movil se bloquee.
- Notificacion local programada al iniciar el temporizador: avisa al usuario cuando el descanso termina aunque la app este cerrada.
- Al pulsar la notificacion de fin de descanso, la app abre directamente la pantalla de entrenamiento del dia correspondiente (incluido inicio en frio de la app).
- Integracion de expo-notifications en configuracion y runtime nativo.
- Splash screen configurada en app.json.

### Cambios

- Vibracion al finalizar el descanso cambiada a tres pulsos seguidos.
- El temporizador desaparece automaticamente cuando el ejercicio alcanza todas sus series objetivo.
- Feedback visual del temporizador al pulsarlo ahora igual que el boton principal de inicio (opacidad + escala).
- Corregida visibilidad del boton Volver en el modal de acciones del entrenamiento de hoy en movil.
- Import condicional de notificaciones para evitar errores en web.
- Version de app actualizada a 0.4.2.
- Dependencias actualizadas: expo-notifications y lockfile regenerado.
- Ajustes de copy en Data: exportar/importar ahora hablan de rutinas y entrenamientos.
- Bloques de Data con acento visual lateral; en Limpiar datos el acento lateral pasa a rojo.
- Tarjetas de rutina, progreso semanal y varios bloques visuales con borde primario mas marcado.
- Separacion entre rutina activa y rutina visualizada en Home para mejorar claridad de estado.
- Ajuste del calculo de mejora semanal para promediar mejoras por dia a partir del ultimo log por dia.
- En detalle de rutina, los dias usan borde lateral por tipo de entrenamiento y el bloque de se mueve al final de la lista.
- Mejoras visuales en tarjetas de ejercicios/cardio e historial (bordes laterales/acento de color).

## Version 0.4.1 - 2026-04-07

### Nuevas funcionalidades

- Resaltado del entrenamiento de hoy y nuevo modal de acciones (editar/eliminar).
- Temporizador de descanso interactivo al añadir series (+30s, eliminar con pulsacion larga, vibracion al finalizar).
- Configuracion del temporizador por rutina integrada en el flujo de registro.

### Cambios

- Mapeo de colores por emoji ampliado y ajuste visual del bloque de temporizador.
- Tipos, estado global y reducer actualizados para guardar la duracion por rutina.
- Calculo de progreso unificado con formula e1RM (Epley) sobre mejor serie.
