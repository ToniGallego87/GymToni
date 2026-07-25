# Roadmap — GymBro

Trabajo pendiente, ordenado por impacto para el usuario dentro de cada sección.
Solo contiene lo que queda por hacer: lo terminado se borra de aquí (el
historial vive en [UPDATES.md](UPDATES.md)). Marcar `[x]` al completar una
tarea y eliminarla al cerrar la versión que la incluya.

Las restricciones de [AGENTS.md](../../AGENTS.md) mandan: **no** login,
**no** backend/cloud, **no** Redux, **no** librerías UI externas.

Última revisión completa: 2026-07-23.

## Mejoras visuales y de UX

- [x] **Títulos de tarjeta con fuente Anton recortados por arriba** — los
      títulos que usan la display (Anton) en las tarjetas de historial de Fuerza
      (nombre del día tipo "Pierna B") y en las de Cardio (nombre del ejercicio
      tipo "Correr en cinta") quedan pegados al borde superior y con la parte
      alta de las mayúsculas comida. Aplicarles la misma compensación que ya
      llevan otros títulos display de la app: `includeFontPadding: false`,
      `textAlignVertical: 'center'` y el `translateY` de 3/5 px por plataforma.
      **Por qué:** el recorte de las letras se ve descuidado y rompe la
      alineación vertical; la corrección ya está resuelta en otros títulos, solo
      falta trasladarla a estos dos.
      **Archivos:** `features/workout/HomeScreen.tsx:1607` (`historyLogDayName`,
      sin la compensación), `features/workout/CardioScreen.tsx:966` (`dailyName`,
      igual). Patrón de referencia ya aplicado en
      `features/workout/HomeScreen.tsx:1463` (`progressTitle`) y
      `features/workout/CardioScreen.tsx:900` (`weekTitle`).
      **Esfuerzo:** bajo.
- [x] **Botón "Volver" translúcido también en modo claro** — en día el botón
      flotante de volver se pinta como una píldora oscura sólida (opaca), no como
      el cristal translúcido que sí luce en noche. Igualar el acabado glass en
      ambos temas para que deje entrever el fondo.
      **Por qué:** rompe la identidad glass de la app en el modo claro; el botón
      queda como un parche opaco en vez del cristal del resto de la interfaz.
      **Archivos:** `components/FloatingBackButton.tsx:82`
      (`floatingBackButtonLight`) y `:94` (`floatingBackGlassOverlayLight`),
      ambos con rellenos casi opacos (`rgba(...,0.94)` / `rgba(...,0.9)`) que hay
      que abrir para dejar pasar el blur; revisar contraste del texto tras el
      cambio.
      **Esfuerzo:** bajo.
- [x] **Tintar de amarillo (no marrón) los acentos dorados del modo claro** — en
      día ciertos dorados tiran a marrón apagado: día en curso del calendario,
      datos del Resumen del perfil y la rutina seleccionada en Rutinas. Llevar
      esos tonos hacia un ámbar más amarillo. El dorado de línea/tinta del tema
      claro (`primary` `#966100`, `primaryLight` `#7A5200`) es el que se lee
      marrón; subirlo de croma choca con el requisito de contraste que documenta
      el propio `theme.ts` (tinta >4.5:1 sobre el lienzo claro), así que hay que
      ajustar buscando el punto más amarillo que siga siendo legible, apoyándose
      en `primaryLine` (`#B87A00`) donde el rol sea de línea y no de texto.
      **Por qué:** el marrón ensucia la paleta clara y desentona con el oro vivo
      del resto; un ámbar más amarillo unifica la identidad dorada en ambos temas.
      **Archivos:** `lib/theme.ts:97-108` (`lightColors.primary`,
      `primaryDark`, `primaryLight`, `primaryMuted`, `primaryLine`), fuente única
      del tono. Consumidores a comprobar tras el cambio:
      `features/workout/CalendarScreen.tsx:439` (día en curso),
      `features/workout/ProfileScreen.tsx:107-114` (tarjeta Resumen),
      `features/workout/RoutineSelectorScreen.tsx:375` (rutina seleccionada).
      **Esfuerzo:** medio.
- [ ] **Transición de tema que revele el contenido real, no un disco opaco** — el
      cambio claro/oscuro anima un círculo de color sólido que tapa la pantalla;
      se pide que ese círculo no sea opaco sino que muestre ya el contenido de la
      vista en el tema de destino, para que sea una transición visual entre las
      dos pieles y no un barrido de color plano.
      **Por qué:** el disco de color maciza la transición; ver la UI de destino
      crecer desde el punto pulsado haría el cambio de tema mucho más pulido.
      **Archivos:** `components/ThemeRevealOverlay.tsx:38-151` (hoy pinta un
      `Animated.View` con `backgroundColor: discColor`; para revelar contenido
      real haría falta una captura/snapshot de la vista en el tema de destino
      recortada por el círculo, sin librerías UI externas). Requiere validar
      rendimiento a 60 fps.
      **Esfuerzo:** alto.

## Funcionalidades a simplificar

Sin entradas pendientes.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

- [ ] **Subir target/compile SDK a 36 (Android 16) antes del 31-08-2026** —
      cambiar `compileSdkVersion` y `targetSdkVersion` de 35 a 36 en
      `android/build.gradle`. Google Play exige API 36 para publicar
      actualizaciones a partir de esa fecha; con 35 la app sigue disponible para
      los usuarios actuales, pero no se puede subir ninguna versión nueva. Ya se
      hizo el salto 34→35 y `gradle.properties` ya suprime el warning de
      compileSdk 36. Tras el bump, probar: pantalla completa/edge-to-edge (ya
      resuelto en `MainActivity.kt`), notificaciones y el requisito de páginas de
      16 KB en librerías nativas.
      **Por qué:** sin esto queda bloqueada cualquier actualización futura en la
      tienda tras el 31-08-2026; es el único punto que puede congelar el
      desarrollo entero, así que va antes que cualquier mejora.
      **Archivos:** `android/build.gradle:7-8`
      (`compileSdkVersion`/`targetSdkVersion`), `android/gradle.properties:62`
      (ya suprime el warning de compileSdk 36),
      `android/app/src/main/java/com/tonigallego/gymbro/MainActivity.kt:33`
      (edge-to-edge a verificar).
      **Esfuerzo:** bajo.
- [ ] **Registrar y editar la fecha de un entreno** — un entreno olvidado de
      ayer no se puede meter (el log siempre nace con `getToday()`), y una vez
      guardado tampoco se puede cambiar de día. Añadir un selector de fecha en el
      registro, tanto al crear un log como para reasignar uno existente a un día
      pasado.
      **Por qué:** olvidarse de registrar un día pasa, y hoy ese entreno se
      pierde para las semanas, rachas y comparativas; corregir la fecha a mano es
      imposible.
      **Archivos:** `features/workout/WorkoutLogScreen.tsx:663-677`
      (`buildWorkoutLog` → `date`), `features/workout/DaySelectorScreen.tsx`,
      `features/workout/DetailScreen.tsx` (editar la fecha de un log ya guardado).
      **Esfuerzo:** medio.
- [ ] **Reordenar los ejercicios de una rutina** — poder cambiar la posición de
      los ejercicios desde la consulta/edición de la rutina. El cambio no debe
      alterar los registros de días pasados: los resultados ya insertados se
      muestran en la nueva posición junto a su ejercicio (se reordenan con él, no
      se recalculan).
      **Por qué:** el orden en que entrenas cambia con el tiempo, y hoy queda
      congelado como se creó la rutina; reordenar sin romper el histórico deja la
      lista fiel a cómo entrenas de verdad.
      **Archivos:** `features/workout/RoutineDetailScreen.tsx` (UI de reordenado),
      `types/index.ts:4` (`WorkoutExercise.order`) y `:37` (`ExerciseLog.order`),
      `features/workout/DetailScreen.tsx` (mostrar los logs por el `order` actual,
      manteniendo el vínculo por `exerciseId` para que los registros pasados sigan
      al ejercicio).
      **Esfuerzo:** medio.
- [ ] **Recordatorio de entrenamiento** — notificación local programable por
      día de la semana (la infraestructura de notificaciones ya existe para el
      timer de descanso).
      **Por qué:** la constancia es el producto; un recordatorio a la hora de
      entrenar es la palanca más barata para sostener la racha.
      **Archivos:** `features/workout/SettingsScreen.tsx`,
      `features/workout/WorkoutLogScreen.tsx:354-399` (patrón de canal/permisos
      a reutilizar).
      **Esfuerzo:** medio.
- [ ] **Backup automático local** — exportación silenciosa periódica al
      almacenamiento del dispositivo, reutilizando `lib/fileIO.ts` (sin cloud).
      **Por qué:** la app es local-only: hoy un móvil perdido = historial
      perdido salvo export manual, y nadie exporta a mano con regularidad.
      **Archivos:** `lib/fileIO.ts`, `app/App.tsx` (disparo al hidratar),
      `features/workout/DataScreen.tsx` (ajuste/estado del último backup).
      **Esfuerzo:** medio.
- [ ] **Nota de sesión** — además de las notas por ejercicio: "gym lleno,
      cambié banca por mancuernas".
      **Por qué:** el contexto del día explica los datos raros al revisar el
      histórico, y hoy no hay dónde apuntarlo.
      **Archivos:** `types/index.ts` (`WorkoutLog.notes`),
      `features/workout/WorkoutLogScreen.tsx`,
      `features/workout/DetailScreen.tsx`, `lib/db/schema.ts` (columna nueva).
      **Esfuerzo:** medio.
- [ ] **Exportar CSV además de JSON** — para abrir el historial en Excel.
      **Por qué:** el JSON del backup no se puede analizar sin herramientas; un
      CSV por series abre el análisis libre a cualquiera.
      **Archivos:** `lib/fileIO.ts`, `features/workout/DataScreen.tsx`.
      **Esfuerzo:** bajo.
- [ ] **Widget Android** — estado de la semana en curso en la pantalla de
      inicio del móvil.
      **Por qué:** ver la semana a medias sin abrir la app empuja a completarla.
      **Archivos:** `android/` (módulo nativo nuevo), `lib/weeks.ts` (datos).
      **Esfuerzo:** alto.

## Descartado por restricciones del proyecto

Autenticación, sincronización cloud, modo coach/atleta, dashboard web e IA:
requieren backend/usuarios, explícitamente fuera del alcance del MVP.
Si algún día se replantea, revisar primero AGENTS.md.
