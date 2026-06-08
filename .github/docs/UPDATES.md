# UPDATES

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
- En detalle de rutina, los dias usan borde lateral por tipo de entrenamiento y el bloque de  se mueve al final de la lista.
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
