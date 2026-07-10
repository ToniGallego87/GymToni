# UPDATES

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

- **El primer arranque en release ya no muestra rutinas de ejemplo**: `getSeedAppData` devuelve datos vacíos cuando `__DEV__` es false y `App.tsx` refleja el seed en el estado con dispatch (antes el reducer seguía enseñando las rutinas de fábrica aunque el almacenamiento quedara vacío). Los datos seed solo se cargan en desarrollo; usuarios con datos no se ven afectados.
- Celdas del calendario con altura fija (80) para que las filas midan lo mismo en los modos Fuerza y Cardio.

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
