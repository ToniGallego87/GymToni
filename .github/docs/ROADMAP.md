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

- [x] **El progreso de cada reto en la hero card, como ruedecita y no como
      "1/3"** — la tarjeta "Retos de la semana" de Inicio (y "Retos de cardio")
      pinta bajo cada reto una cifra compacta (`challengeProgressLabel(c, true)`:
      "1/3", "2/2", "340/1000 kcal", "✓"), tres números pequeños que hay que
      leer y comparar con su objetivo. Sustituir cada cifra por un anillo fino
      (`RestTimerRing`, el mismo que ya llevan las casillas de Logros y el
      descanso) con el icono del reto dentro, que se rellena con
      `current / target` y se pinta entero (o con el check) al superarlo; el
      nombre del reto queda debajo. `HeroStat` hoy solo admite `value` +
      `label`: necesita una variante con `progress` + `icon` (o un
      `renderValue`) y el anillo en `onGold` sobre el dorado.
      **Por qué:** una rueda se lee de un vistazo desde el otro lado del gym
      ("me falta poco") sin descifrar tres fracciones con unidades distintas;
      y es el mismo lenguaje de progreso que ya usan Logros y el descanso.
      **Archivos:** `features/workout/HomeScreen.tsx:1049-1060` (la tarjeta
      de retos: `stats` con `challengeProgressLabel`),
      `features/workout/CardioScreen.tsx:441-452` (la gemela de cardio),
      `components/HeroStatsCard.tsx:17-20` (`HeroStat`) y `:258-290`
      (`heroStatsRow` / `heroStatValue`, donde iría el anillo),
      `components/RestTimerRing.tsx` (prop `color` ya existe),
      `lib/challenges.ts:287` (`challengeProgressLabel`, que quedaría solo
      para `ChallengesModal`).
      **Esfuerzo:** bajo.
- [ ] **Rendimiento: el blur de las cuatro barras cuesta ~7 ms/frame cada
      una; buscar cómo abaratarlo** — decisión de producto (2026-09-22): se
      quieren borrosas la barra superior, la inferior, Volver y descanso.
      Cada `BlurView` dimezis redibuja la pantalla entera en un bitmap por
      frame, sea cual sea `blurReductionFactor`: con las cuatro, mediana 28 ms
      (p90 48, p99 73) frente a 16 ms con una sola. Vías: (1) un ÚNICO
      `BlurView` a pantalla completa como capa base y que las barras solo lo
      recorten (`overflow: hidden` + posicionar el hijo), así se paga una
      pasada; (2) Volver y descanso solo con blur mientras están quietos (no
      scrollea nada debajo en el registro); (3) Skia `BackdropBlur` (GPU),
      descartado por dependencia grande salvo que compense. Además de los
      picos que ya había: Candidatos, por orden: (1) sombra/elevación +
      `GradientFill` en cada tarjeta del historial de semanas (una por log);
      (2) `animateLayout` (LayoutAnimation) en los desplegables; (3) el
      `Anton` con `adjustsFontSizeToFit` en las cabeceras. Medir con el mismo
      recorrido ([COMMANDS.md](COMMANDS.md#medir-rendimiento)) antes y después
      de cada uno; si no mueve el p90, no entra.
      **Por qué:** "velocidad de uso" es la prioridad número uno; lo grande ya
      está, lo que queda son picos que se notan al abrir semanas y al arrastrar
      entre pestañas.
      **Archivos:** `components/glassTokens.ts` (`GLASS_BLUR_ENABLED`,
      `GLASS_TOP_BAR_BLUR_REDUCTION`),
      `features/workout/HomeScreen.tsx` (tarjetas de semana y de log),
      `components/GradientFill.tsx`, `lib/theme.ts` (`shadow.soft` /
      `shadow.card`).
      **Esfuerzo:** medio.

## Funcionalidades a simplificar

- [x] **Inicio enseña el progreso de la semana en dos sitios** — la segunda
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
- [x] **El reto "Tres días" da puntos pero no se ve en ningún sitio** — se
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
