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

Las fichas con etiqueta salen del análisis de salida a producción del
2026-10-20: **[Lanzamiento]** = bloquea publicar en Google Play o es un agujero
de seguridad; **[Monetización]** e **[iOS]** = siguientes pasos tras el
lanzamiento. El SDK nuevo (ver "[Lanzamiento] Subir a Expo SDK 54") es
requisito previo de anuncios, suscripción e iOS.

## Mejoras visuales y de UX

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
- [ ] **[iOS] Vibración y teclado que funcionen en iPhone** — iOS ignora la
      duración de `Vibration.vibrate`: los toques de 6 y 18 ms del − / + y de
      "Añadir serie" serían un zumbido largo (~400 ms) en cada pulsación, y el
      patrón de fin de descanso se queda en uno. Pasar a `expo-haptics`
      (impacto ligero para los toques, notificación para el descanso). Y no
      hay `KeyboardAvoidingView` en ningún sitio: en Android lo resuelve
      `adjustResize`, en iOS el teclado tapará el login, los comentarios, el
      peso corporal y las casillas del registro.
      **Por qué:** sin esto la app en iPhone vibra como una alarma a cada
      serie y no deja ver lo que escribes.
      **Archivos:** `components/ExerciseInputField.tsx:440`, `:573`, `:1094`,
      `lib/restTimerStore.ts:277`, `features/workout/DataScreen.tsx:549`
      (login), `features/workout/PublicRoutineScreen.tsx:860` (comentarios),
      `features/workout/WorkoutLogScreen.tsx:1722`,
      `features/workout/BodyWeightScreen.tsx`.
      **Esfuerzo:** medio.
- [ ] **[iOS] Cristal de las barras y descanso flotante** — `glass-blur` y
      `pip-timer` son módulos solo Android: en iOS las barras caen a un fondo
      plano y minimizar con descanso no muestra nada. El cristal se resuelve
      con el desenfoque nativo de iOS (`UIVisualEffectView` vía `expo-blur`,
      allí barato; el coste por frame era cosa de Android). La ventanita no
      existe en iOS para vistas normales: la alternativa es una Live Activity
      (pantalla de bloqueo / Dynamic Island, extensión en Swift) o quedarse
      con la notificación de fin de descanso que ya hay.
      **Por qué:** la identidad glass es la de la app, y el descanso visible
      fuera de la app es de lo más usado entre series.
      **Archivos:** `components/GlassBlur.tsx:41`, `lib/pipTimer.ts:30`,
      `modules/glass-blur/expo-module.config.json`,
      `modules/pip-timer/expo-module.config.json`, `components/PipRestTimer.tsx`.
      **Esfuerzo:** bajo (cristal) / alto (Live Activity).

## Funcionalidades a simplificar

- [ ] **[Lanzamiento] Quitar permisos sobrantes y adelgazar la APK** — fuera
      `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE` y
      `CAMERA` (estos dos últimos con `tools:node="remove"`, los meten
      dependencias); R8 + `shrinkResources` en release y solo las ABIs de
      móvil. Se quedan `SCHEDULE_EXACT_ALARM` (fin de descanso a su hora en
      Android 12-13; Play no lo pide declarar) y `allowBackup` (la copia de
      Google salva los entrenos de quien no tiene cuenta).
      **Por qué:** cada permiso de más es una pregunta en la revisión de Play
      y una línea más en Data Safety; una APK pequeña se instala más.
      **Archivos:** `android/app/src/main/AndroidManifest.xml:1-19`,
      `android/app/proguard-rules.pro` (serialización de los avisos),
      `android/app/build.gradle` (`abiFilters` en release),
      `android/gradle.properties` (R8 y `shrinkResources`).
      **Estado (2026-11-07):** hecho en código; APK de 75 a 40 MB, instalada en
      el móvil 1 y arranca sin errores. **Falta probar en el móvil**, donde R8
      podría romper algo:
      - Descanso con la app minimizada: que suene el aviso al terminar (R8
        quitaba la serialización de los avisos; arreglado en
        `proguard-rules.pro`, falta confirmarlo).
      - Recordatorio de entreno y aviso de peso: que sigan saliendo.
      - Foto de perfil: elegir una y recortarla.
      - Compartir: el póster y el vídeo de la semana.
      - Datos y nube: exportar e importar la copia.
      - PiP: minimizar con un descanso en marcha.
      - Cerrar sesión en modo avión: que salga de verdad (ver "Cerrar sesión"
        sin red y con el token caducado).
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
      **Archivos:** `lib/db/mappers.ts:509` (`entriesMatchRaw` en
      `rowsToAppData`), `lib/cardio.ts:310` (`cardioEntriesOf`) y
      `cardioEntriesFromRaw`, `components/CardioInputField.tsx:139` (el texto
      partido por `' | '`), `features/workout/WorkoutLogScreen.tsx:1101`
      (donde se construye el cardio).
      **Esfuerzo:** medio.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones). Las **[Lanzamiento]** van
primero porque sin ellas no se publica.

- [ ] **[Lanzamiento] Subir a Expo SDK 54 (páginas de 16 KB, requisito de
      iOS)** — las 49 `.so` de arm64 de la release están alineadas a 4 KB
      (comprobado 2026-10-20 en `app-release.apk`); Play exige 16 KB a apps
      con target ≥ 35 desde nov-2025. Lo trae RN ≥ 0.77. SDK 54 es el último
      que permite seguir en arquitectura antigua (`newArchEnabled=false`), lo
      que esquiva el bug de toques muertos del intento de agosto. También es
      requisito para compilar iOS con Xcode 26 y para las SDK de anuncios y
      pagos. Rehacer o retirar los tres `patches/` tras subir.
      **Por qué:** sin esto Play rechaza el binario y no hay versión iOS.
      **Archivos:** `package.json` (expo ~51, react-native 0.74.5),
      `android/gradle.properties` (`newArchEnabled`), `android/build.gradle:7-11`,
      `patches/`, `.github/docs/backend-design.md` §14 (lo aprendido en el
      intento anterior).
      **Esfuerzo:** alto.
- [ ] **[Lanzamiento] Borrar la cuenta: plazo de gracia y rutinas anónimas** —
      obligatorio en Play y App Store para apps con cuentas. Al
      pedirlo, la cuenta se oculta y durante **30 días** se puede recuperar
      iniciando sesión; pasado el plazo, una tarea programada de Supabase la
      borra de verdad. Entonces **lo público se conserva anónimo**: sus
      rutinas públicas (con días y ejercicios) y sus comentarios en rutinas de
      otros pasan a un usuario reservado "Cuenta eliminada", con sus likes,
      guardados y sitio en el tablón, y los ids no quedan libres. **Lo privado
      se borra siempre**: email, perfil, foto, entrenos, ajustes, actividad y
      seguidores. Lo que hay en el móvil no se toca. La confirmación y la
      política de privacidad lo explican, avisando de que el nombre y la
      descripción de una rutina pública pueden contener datos personales.
      Más una URL pública para pedirlo sin la app, que va en la ficha de Play:
      basta una página sencilla en el dominio propio o, mientras no lo haya,
      en GitHub Pages.
      **Estado (2026-11-04):** hecho en código; SQL ejecutado, función
      desplegada (comprobado: rechaza llamadas sin secreto) y tarea diaria
      programada. **Pendiente:** comprobar las cascadas reales
      (`pg_constraint`), la prueba completa con una cuenta de prueba (SETUP.md,
      paso 5: es la que crea la cuenta reservada) y publicar la URL web.
      **Por qué:** sin borrado real la ficha no pasa revisión y es un derecho
      del usuario (RGPD). Un borrado lógico puro no vale: Play no acepta
      desactivar o congelar como borrar, y entrenos y peso pueden ser datos de
      salud. Así se puede dar marcha atrás y quien usa esas rutinas no pierde
      la traza.
      **Archivos:** `supabase/functions/purge-deleted-accounts/index.ts`,
      `supabase/social-schema.sql` (sección "Borrado de cuenta"),
      `lib/cloud/auth.ts` (`requestAccountDeletion`), `lib/cloud/social.ts`
      (`DELETED_ACCOUNT_ID`), `components/AccountDeletionPrompt.tsx`,
      `features/workout/DataScreen.tsx` (`handleDeleteAccount`).
      **Esfuerzo:** alto.
- [ ] **[Lanzamiento] Otra cuenta en el mismo móvil** — los datos del móvil
      conservan sus ids, y esos ids siguen ocupados en la nube por la cuenta
      anterior (durante los 30 días de gracia, o por "Cuenta eliminada" en sus
      rutinas públicas). Al entrar con otra cuenta, "Subir copia" falla (ya con
      un aviso claro), el sync descarta esos cambios tras 5 intentos y publicar
      una de esas rutinas no hace nada. Pasa igual al cambiar de cuenta sin
      borrar ninguna. **Decisión pendiente:** propuesta, detectar que cambia el
      dueño de los datos locales y darles ids nuevos, manteniendo las
      referencias del historial; toca todos los entrenos, así que necesita
      tests y copia previa.
      **Por qué:** quien borra su cuenta y crea otra se queda sin copia en la
      nube, aunque la app le diga que sus datos siguen en el móvil.
      **Archivos:** `lib/cloud/backup.ts` (`upsertAll`), `lib/cloud/sync.ts`
      (`cloudUpsert`, descarte del outbox), `lib/cloud/social.ts`
      (`setRoutinePublic`), `lib/db/mappers.ts` (`appDataToRows`).
      **Esfuerzo:** alto.
- [ ] **[Lanzamiento] Política de privacidad real y Data Safety** — la actual
      dice "GymBro no recopila ningún dato, no tiene servidores": ya es falso
      (email, entrenos, peso, fotos, contenido social en Supabase). Reescribirla
      (qué se guarda, dónde —Supabase, región—, para qué, borrado, contacto),
      enlazarla desde Ajustes y rellenar Data Safety y la declaración de apps
      de salud de Play de acuerdo con ella. Peso y entrenos pueden ser datos
      de salud en el RGPD: consentimiento explícito al crear cuenta. Al
      explicar el borrado de cuenta, contar el plazo de 30 días y lo que no
      desaparece: rutinas públicas y comentarios se quedan anónimos como
      "Cuenta eliminada", las rutinas que otros ya añadieron siguen en sus
      móviles, los reportes de terceros se conservan y Supabase guarda copias
      de seguridad unos días.
      **Por qué:** una política que contradice lo que hace la app es motivo
      de retirada y de sanción.
      **Archivos:** `privacy-policy.html`, `features/workout/SettingsScreen.tsx:266`
      (bloque de enlaces), `features/workout/DataScreen.tsx:145`
      (`handleAuth`, donde iría el consentimiento).
      **Esfuerzo:** bajo.
- [ ] **[Lanzamiento] Bloquear usuarios y términos de uso** — Play (contenido
      generado por usuarios) y Apple (1.2) piden reportar, **bloquear** y
      unos términos que prohíban el contenido ofensivo. Hoy hay reportar y
      ocultar lo reportado en local. Falta "Bloquear" en el perfil ajeno (oculta
      sus rutinas, comentarios y actividad, y le impide seguirte: tabla
      `blocks` + RLS) y unos términos aceptados al crear cuenta.
      **Por qué:** sin ello la comunidad no pasa revisión, y quien recibe
      acoso no tiene cómo cortarlo.
      **Archivos:** `features/workout/UserProfileScreen.tsx:387` (reportar
      perfil), `lib/moderation.ts`, `components/ReportModal.tsx`,
      `supabase/social-schema.sql` (follows y lecturas públicas).
      **Esfuerzo:** medio.
- [ ] **[Lanzamiento] Licencia de los GIFs de ejercicios** — los GIFs vienen
      de un repo de GitHub de un tercero vía jsDelivr (`@main`) y la
      atribución dice "© Gym Visual", que los vende con licencia. En una app
      con ingresos es riesgo de DMCA; y `@main` puede cambiar: lo que suba el
      dueño del repo sale en la app. Comprar la licencia o cambiar de fuente,
      y servirlos desde un sitio propio o un commit fijado.
      **Por qué:** una reclamación de copyright puede tumbar la ficha de la
      tienda entera.
      **Archivos:** `data/exerciseCatalog.ts:63-67` (`CDN`, `ATTRIBUTION`,
      `gifUrl`, `thumbUrl`), `data/exerciseCatalog.json` (1324 `mediaId`).
      **Esfuerzo:** medio.
- [ ] **[Lanzamiento] Supabase y dominio listos para producción** — cuatro
      piezas, casi todas decisión y configuración más que código:
      **dominio propio** (~10–15 €/año, p. ej. `gymbro.app`: correo desde una
      dirección propia, URL de la política de privacidad y la página web de
      borrado de cuenta que pide Play); **SMTP propio** (Resend 3.000/mes o
      Brevo 300/día gratis: el de Supabase tiene un cupo mínimo y los códigos
      de registro dejarían de llegar; mirar antes si ya hay uno en
      Authentication → Emails → SMTP Settings); **plan Pro** (~25 $/mes:
      backups, sin pausa) con tope de gasto activado; y **captcha** en el
      registro y en recuperar la contraseña (Supabase lo exige en los dos
      si se activa; Turnstile o hCaptcha, gratis; exige añadir
      `react-native-webview`, a justificar según CONVENTIONS).
      **Decisiones pendientes:** nombre del dominio, proveedor de SMTP, cuándo
      pasar a Pro (propuesta: justo antes de abrir al público) y si el
      captcha va desde el inicio o solo si aparecen bots (propuesta: después).
      Dominio y SMTP van primero: los necesitan "Política de privacidad" y
      "Borrar la cuenta: plazo de gracia y rutinas anónimas".
      **Por qué:** con usuarios reales, sin esto el registro falla, no hay
      dónde publicar la política ni el borrado, o la base se llena de cuentas
      falsas (el historial privado, entrenos y series, no tiene tope de filas:
      lo frenan el captcha y el plan Pro).
      **Archivos:** `lib/cloud/auth.ts` (`signUp` y `requestPasswordReset`
      recibirían el `captchaToken`), `features/workout/DataScreen.tsx`
      (`handleAuth`, `handleForgotPassword`), `privacy-policy.html`,
      `.github/docs/SETUP.md` ("Panel de Supabase"); el resto es
      configuración del panel de Supabase y del registrador del dominio.
      **Esfuerzo:** medio.
- [ ] **[Lanzamiento] Avisos de cuelgues (Sentry o Crashlytics)** — hoy no
      hay reporte de errores: si la app se cae en móviles que no son los
      tuyos, no se sabe. Integrar el SDK con el source map de Hermes y sin
      datos personales.
      **Por qué:** es la única forma de enterarse de un cuelgue antes de que
      llegue como reseña de una estrella.
      **Archivos:** `app/_layout.tsx`, `app/App.tsx` (arranque),
      `android/app/build.gradle` (source maps de Hermes).
      **Esfuerzo:** bajo.
- [ ] **[Monetización] GymBro Pro (suscripción)** — suscripción con
      RevenueCat (Play y App Store a la vez): 3,99 €/mes, 24,99 €/año con 7
      días de prueba y un vitalicio (~49,99 €). Pro = sin anuncios + algo
      que valga por sí mismo: progreso avanzado y 1RM por ejercicio,
      tendencia de peso corporal, temas, póster/vídeo de la semana sin marca
      de agua y, quizá, sync entre dispositivos. Comunidad gratis siempre. Si
      Pro abre algo de la nube, el derecho se guarda en Supabase por webhook
      (el cliente solo no basta). Mantener gratis a los testers actuales lo
      que ya usan.
      **Por qué:** en apps de registro de gimnasio (Hevy, Strong) la
      suscripción es lo que paga; "solo quitar anuncios" apenas convierte.
      **Archivos:** `features/workout/SettingsScreen.tsx` (entrada a Pro),
      `features/workout/ExerciseProgressScreen.tsx`,
      `features/workout/BodyWeightScreen.tsx`,
      `features/workout/WeekAchievementScreen.tsx`, `lib/themeStore.ts`,
      `hooks/useCloudSync.ts`.
      **Esfuerzo:** alto.
- [ ] **[Monetización] Anuncios donde no molestan** — AdMob con consentimiento
      UMP (obligatorio en la UE) y ATT en iOS. Dónde: nativo en el tablón de
      Comunidad cada ~8 rutinas; banner al final del scroll en Calendario,
      Detalle de un entreno pasado y Progreso; interstitial al salir del
      registro con series metidas (máx. 1/día); rewarded para el póster/vídeo
      en HD o una estadística Pro 24 h. Nunca en el registro en curso, el
      descanso, el PiP, la tarjeta de Inicio ni al abrir la app. Ojo: un
      banner bajo las barras de cristal cuenta como "tapado" y uno junto a la
      barra inferior provoca clics accidentales; las dos cosas son causa de
      baja en AdMob. Medir el coste de `GlassBlur` con un WebView de anuncio
      debajo.
      **Por qué:** ingreso con quien no paga sin estropear el uso entre
      series, que es el corazón de la app.
      **Archivos:** `features/workout/CommunityScreen.tsx:1040` (lista del
      tablón), `features/workout/CalendarScreen.tsx`,
      `features/workout/DetailScreen.tsx`,
      `features/workout/ExerciseProgressScreen.tsx`,
      `features/workout/WorkoutLogScreen.tsx` (salida),
      `components/FloatingPrimaryNav.tsx`, `components/GlassTopBar.tsx`,
      `components/GlassBlur.tsx`.
      **Esfuerzo:** alto.
- [ ] **[iOS] Publicar en App Store** — con el SDK nuevo, la base de la
      versión iPhone: cuenta Apple Developer (99 $/año), build y envío con
      EAS (sin Mac) y pruebas en iPhone físico por TestFlight;
      `supportsTablet: false` para no pasar revisión en iPad; textos de
      permisos (fotos, notificaciones) en `app.json`; aviso de actualización
      con la URL de App Store y fila `ios` en `app_releases`; compilar y
      probar el `video-encoder` en Swift (nunca se ha ejecutado); revisar a
      ojo los ajustes de texto por plataforma. Apple pide además lo de
      Android (borrar cuenta, bloquear) y pago con su sistema para la
      suscripción (RevenueCat lo cubre).
      **Por qué:** dobla el público con el mismo código y la misma nube: las
      cuentas valen en los dos sistemas.
      **Archivos:** `app.json` (`ios`), `eas.json`, `lib/appUpdate.ts:50`
      (`playStoreUrls`, solo Play), `app/App.tsx:548` y `:583`,
      `lib/cloud/release.ts:26` (`platform = 'android'` fijo),
      `modules/video-encoder/ios/VideoEncoderModule.swift`,
      `lib/textStyles.ts:26`.
      **Esfuerzo:** alto.
- [ ] **Limpiar el móvil cuando la sesión se cierra sola** — si la sesión se
      pierde sin pedirlo (token caducado, o cuenta borrada desde otro móvil),
      la copia del perfil y las de las pantallas sociales se quedan en ese
      dispositivo; solo se limpian al pulsar "Cerrar sesión". Hacer la misma
      limpieza al recibir un `SIGNED_OUT` que no inició el usuario.
      **Por qué:** el nombre, la foto y lo visto en Comunidad de una cuenta
      cerrada o borrada no deben seguir en un móvil.
      **Archivos:** `lib/cloud/auth.ts:48` (`onAuthStateChange`),
      `lib/socialCache.ts` (`clearSocialCache`), `hooks/useMyProfile.ts`
      (`useForgetSignedOutAccount`).
      **Estado (2026-11-04):** hecho en código; falta probarlo en el móvil.
      **Esfuerzo:** bajo.
- [ ] **Los avisos de Comunidad sobreviven a cerrar sesión** — lo ya visto
      (seguidores y "me gusta" de tus rutinas) se guarda en
      `gymbro_social_seen_<uid>`, que lleva el prefijo de las copias sociales:
      al cerrar sesión `clearSocialCache` lo borra con ellas, y al volver a
      entrar `refreshCommunityNews` siembra con lo actual y los avisos
      pendientes desaparecen sin haberlos visto (los comentarios sin leer no,
      van en la nube en `comment_reads`).
      **Decisión (2026-11-07): lo visto va a la nube**, como `comment_reads`, y
      no queda nada en el móvil. Tabla `community_seen` (una fila por cuenta:
      `user_id` uuid PK con `on delete cascade` a `auth.users`, `followers`
      int, `routine_likes` jsonb `{routineId: likes}` con CHECK de tamaño,
      `updated_at`), RLS de dueño para leer, insertar y actualizar. Fuera del
      sync, como `comment_reads`: solo sirve con red, y sin red ya no se mide.
      `readSeen`/`writeSeen` pasan a leer y escribir esa fila; la primera vez,
      si hay copia local de una versión anterior, se sube (para no perder lo
      pendiente de ahora) y se borra del móvil. Sin la tabla (SQL sin
      ejecutar) la app sigue funcionando y avisa como hoy. Vale además en
      todos tus móviles: un aviso atendido en uno desaparece en los demás.
      **Por qué:** cerrar sesión y volver a entrar no debería tragarse los
      seguidores nuevos y los "me gusta" que aún no habías visto, y lo atendido
      en un móvil no debería volver a avisar en otro.
      **Archivos:** `hooks/useCommunityNews.ts:38` (`seenKey`, `readSeen`,
      `writeSeen`), `:57` (`refreshCommunityNews`, siembra sin lo visto),
      `lib/cloud/social.ts:1025` (`getCommentReads` / `markCommentsRead`, el
      patrón a copiar), `supabase/social-schema.sql:258` (`comment_reads`, el
      modelo de tabla y RLS), `lib/socialCache.ts:143` (`clearSocialCache`,
      que hoy la borra por el prefijo). **Requiere ejecutar el SQL nuevo en
      Supabase.**
      **Estado (2026-11-07):** hecho en código y SQL ejecutado en Supabase
      (verificado con curl). Falta probarlo en el móvil (aviso pendiente →
      cerrar sesión → entrar: sigue ahí).
      **Esfuerzo:** medio.
- [ ] **Pedir la contraseña antes de borrar la cuenta** — en el popup de
      "Eliminar la cuenta", además de la casilla, pedir la contraseña y
      comprobarla antes de llamar a la función. Las tiendas no lo exigen.
      **Por qué:** protege una acción irreversible si alguien coge el móvil
      desbloqueado.
      **Archivos:** `features/workout/DataScreen.tsx` (`handleDeleteAccount`,
      popup de borrar), `lib/cloud/auth.ts` (`signIn`).
      **Estado (2026-11-04):** hecho en código; falta probarlo en el móvil.
      **Esfuerzo:** bajo.
- [ ] **Cambiar la contraseña con la sesión iniciada** — hoy solo se cambia
      cerrando sesión y usando "¿Has olvidado la contraseña?". Un "Cambiar
      contraseña" en el bloque de sesión de Datos y nube, con la misma
      contraseña nueva con ojo que la recuperación (`updatePassword` ya
      existe) y cerrando las demás sesiones al terminar
      (`signOutOtherDevices`).
      **Por qué:** cambiar la contraseña sin olvidarla (porque se filtró, o
      era débil) no debería exigir salir de la cuenta.
      **Archivos:** `features/workout/DataScreen.tsx` (rama `session && user`
      del bloque de cuenta), `components/PasswordField.tsx`, `lib/cloud/auth.ts`.
      **Estado (2026-11-04):** hecho en código; falta probarlo en el móvil.
      **Esfuerzo:** bajo.
- [ ] **Sesión guardada al arrancar sin red** — al abrir la app sin conexión y
      con el token caducado, Supabase da una sesión vacía aunque siga guardada:
      la app se pinta como si no hubiera cuenta y el sync se para hasta que
      vuelve la red. Distinguir "sin sesión" de "sesión guardada pendiente de
      renovar" (`hasStoredSession` ya lo sabe) y usarlo en la pantalla de
      cuenta y en el sync.
      **Por qué:** quien entrena sin cobertura no debería ver que ha perdido la
      cuenta; la sesión vuelve sola y el aviso es falso.
      **Archivos:** `lib/cloud/auth.ts` (`onAuthChange`, `restoring` en
      `useSession`), `lib/cloud/storedSession.ts` (`readStoredSession`),
      `hooks/useCloudSync.ts` (no sincroniza mientras se renueva),
      `features/workout/DataScreen.tsx` (texto y "Sincronizar ahora").
      **Estado (2026-11-07):** hecho en código; falta probarlo en el móvil
      (sesión de más de una hora → modo avión → cerrar y abrir la app: debe
      seguir la cuenta; quitar el modo avión: a los ~30 s sincroniza sola).
      **Esfuerzo:** medio.
- [ ] **El nivel no debe bajar el XP de la nube** — el efecto que sube nivel
      y XP al perfil público compara contra `profile.xp` de la copia local del
      perfil. Al arrancar con esa copia, o al renovarse una sesión que esperaba
      a la red (el perfil se recarga a la vez, no antes), puede subir un XP
      menor que el que otro móvil ya dejó en la nube, y la nube no se queda con
      el mayor: el nivel público retrocede hasta que el sync baja los entrenos
      del otro móvil y se recalcula. Dos arreglos posibles: no subir hasta que
      el perfil se haya leído de la nube en esta sesión (una marca en el store
      de `useMyProfile`; solo código), o un trigger en `profiles` que guarde
      `greatest(old.xp, new.xp)` con su nivel (más robusto, pero exige
      ejecutar SQL). Detectado en la 3.ª revisión de código del 2026-11-07.
      **Por qué:** quien entrena en dos móviles no debería ver su nivel
      público bajar (ni que lo vean otros) por abrir el móvil que va por detrás.
      **Archivos:** `hooks/useAccountLevel.ts:213-232` (subida del nivel,
      compara con `profile?.xp`), `hooks/useMyProfile.ts:57`
      (`readCachedProfile`, la copia que se pinta primero) y `:223`
      (`useReloadProfileOnSessionRestore`), `supabase/schema.sql:26-31`
      (columnas `level` / `xp`, donde iría el trigger).
      **Esfuerzo:** bajo.
- [ ] **"Cerrar sesión" sin red y con el token caducado** — supabase-js, sin
      red y con el token caducado, devuelve el error sin borrar la sesión
      guardada: el popup terminaba y se seguía dentro. Ahora, si la sesión
      sigue guardada, se borra de este móvil igualmente (los demás
      dispositivos siguen dentro), y si ni así se puede, el popup lo dice.
      **Por qué:** quien pulsa "Cerrar sesión" da por hecho que ha salido, y en
      un móvil prestado o vendido eso importa.
      **Archivos:** `lib/cloud/auth.ts:108` (`signOut`, plan B con
      `_removeSession`), `components/SignOutConfirmModal.tsx` (`handleConfirm`),
      `components/AccountDeletionPrompt.tsx` (`handleSignOut`).
      **Estado (2026-11-07):** hecho en código; falta probarlo en el móvil
      (modo avión con la sesión de más de una hora → "Cerrar sesión").
      **Esfuerzo:** bajo.
- [ ] **Copias de Comunidad por cuenta** — las copias sociales (tablón, listas
      de seguir, perfiles ajenos, rutinas públicas) van marcadas con la cuenta
      que las cargó: al cambiar de cuenta se vacían las de memoria antes de
      repintar y las de disco de otra cuenta se ignoran; sin cuenta resuelta
      (arranque sin red) valen las de la sesión guardada.
      **Por qué:** la cuenta nueva no debe ver lo que cargó la anterior, ni un
      instante, y sin cobertura Comunidad sigue enseñando lo último visto.
      **Archivos:** `lib/socialCache.ts` (`setSocialCacheOwner`,
      `readSocialCache`), `lib/cloud/auth.ts:42` (`apply`),
      `features/workout/CommunityScreen.tsx` (`boardCache`),
      `features/workout/FollowingScreen.tsx` (`listCache`),
      `features/workout/UserProfileScreen.tsx` (`profileCache`).
      **Estado (2026-11-07):** hecho en código; falta probarlo en el móvil
      (cerrar sesión y entrar con otra cuenta sin cerrar la app; abrir
      Comunidad sin red).
      **Esfuerzo:** bajo.
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

## Descartado por restricciones del proyecto

- **Nivel, XP, Actividad y récords calculados en el servidor**: sin planificar
  por prioridad (análisis del 2026-10-20). Hoy los declara el propio cliente y
  se pueden falsear con la API, pero solo se enseñan en tu perfil: no hay
  rankings ni premios. Si llegan rankings entre usuarios o premios reales,
  vuelve, porque entonces sí hay que calcularlos en la nube.
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
