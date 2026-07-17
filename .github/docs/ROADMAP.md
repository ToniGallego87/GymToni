# Roadmap — GymBro

Documento de seguimiento de futuros desarrollos. Marcar `[x]` al completar una
tarea y moverla a "Ya implementado" al cerrar la versión que la incluya.
Las restricciones de [AGENTS.md](../../AGENTS.md) mandan: **no** login,
**no** backend/cloud, **no** Redux, **no** librerías UI externas.

Origen: ideas del roadmap original + revisión completa de la app (2026-07-16).

## Mejoras visuales y de UX

Detectadas usando la app (2026-07-17). Aplicadas el mismo día (ver UPDATES.md);
pendientes de mover a "Ya implementado" al cerrar la versión que las incluya.

- [x] **Filtro por día de la gráfica de fuerza: iconos en vez de texto**
      (`HomeScreen` → `dayFilterOptions` + `SegmentedFilter`). Resuelto con la
      silueta de grupo muscular (`resolveDayIcon`, no el emoji: los días se
      distinguen por icono desde el sistema de `GymIcon`) y `labelMode="below"`:
      chips de solo icono repartiéndose el ancho del raíl y el nombre del día
      activo centrado debajo, para que la fila no se mueva al cambiar de día.
- [x] **Vista de progreso paginada y ordenable** (`ExerciseProgressScreen`):
      20 filas y "Ver más", más orden por reciente / nombre / sesiones / 1RM
      (`sortExercises` en `lib/exerciseProgress.ts`, con tests). El raíl de orden
      va sin iconos: con ellos el cuarto criterio no cabía.
- [x] **Chips de métrica de "Tu evolución" que quepan**: `SegmentedFilter`
      encogido (texto 13→12, padding 14→9, icono 15→14) hasta que los cuatro
      caben sin scroll.
- [x] **Nombre del ejercicio a dos líneas en "Tu evolución"**
      (`styles.cardTitle` → `numberOfLines={2}`, icono anclado a la primera
      línea), y también en las tarjetas del listado (`styles.exerciseName`).
- [x] **Volver desde el registro de cardio vuelve a Cardio, no a Fuerza**:
      `workout-log` gana `origin` ('home' | 'calendar' | 'cardio'), como ya
      tenía `detail`.

## Funcionalidades a simplificar

- [ ] **Tema/idioma sin reiniciar la app**: el reinicio está bien documentado
      (StyleSheets creados a nivel de módulo), pero es la fricción más visible
      de Configuración. Refactor grande (theming dinámico: hay que convertir
      todos los `StyleSheet.create` de módulo de la app): deuda anotada, no
      abordar hasta que duela más.

## Nuevas funcionalidades

Candidatas (compatibles con las restricciones):

- [ ] **Registrar con fecha pasada**: un entreno olvidado de ayer no se puede
      meter (el log siempre nace con `getToday()`). Selector de fecha en
      `WorkoutLogScreen`.
- [ ] **Nota de sesión** (además de las notas por ejercicio): "gym lleno,
      cambié banca por mancuernas".
- [ ] **Backup automático local**: exportación silenciosa periódica al
      almacenamiento del dispositivo (reutiliza `lib/fileIO.ts`, sin cloud).
      La app es local-only: hoy un móvil perdido = historial perdido salvo
      export manual.
- [ ] **Exportar CSV** además de JSON (para Excel), reutilizando
      `lib/fileIO.ts`.
- [ ] **Recordatorio de entrenamiento**: notificación local programable por
      día.
- [ ] **Widget Android** con el estado de la semana en curso.

## Ya implementado (histórico)

Nuevas funcionalidades recomendadas de la revisión, aplicadas el 2026-07-17
(ver UPDATES.md):

- ✅ Gráfica por ejercicio + tabla de récords (`ExerciseProgressScreen` +
  `lib/exerciseProgress.ts` con tests; Perfil → Progreso por ejercicio)
- ✅ Duplicar rutina desde su tarjeta en Rutinas (`lib/routines.ts` con tests)
- ✅ Pantalla siempre encendida durante el registro (`useKeepAwake`)

Revisión de 2026-07-16, aplicada el 2026-07-17 (ver UPDATES.md):

- ✅ Gestos ocultos hechos visibles: botón de trofeo (logros de una semana),
  `⋯` (opciones de un entrenamiento), papelera (eliminar rutina) y, en el
  detalle de rutina, tarjeta → ejercicios e icono → selector de icono
- ✅ Familia de modales unificada (`AppModal` + `Button` en los 9 modales)
- ✅ Nombre real de la rutina en la tarjeta de progreso de Inicio
- ✅ Filtros de gráfica segmentados (`SegmentedFilter`), sin botón que cicla
- ✅ Guardar un entrenamiento vuelve al instante (sin la espera de 1,5s)
- ✅ Editor estructurado para los ejercicios de un día guardado (arregla el
  cruce de históricos al reordenar; `lib/exerciseForm.ts` con tests)
- ✅ `HomeScreen` partido: `RoutineSelectorScreen` propio y cálculos de
  semanas/rachas en `lib/weeks.ts` con tests (2.475 → ~1.590 líneas)
- ✅ `BarChart` compartido entre Inicio y Cardio

Anterior:

- ✅ Gráficas de progreso semanal (barras por semana, filtro por día)
- ✅ 1RM estimado (Epley) en `lib/progress.ts`
- ✅ Notificaciones locales (timer de descanso con canal Android propio)
- ✅ Exportar/importar backup JSON (pantalla Datos)
- ✅ Testing (Jest sobre `lib/`, 119 tests)
- ✅ Compartir rutina por QR / texto plano
- ✅ Cardio como experiencia propia (sesiones, kcal, peso corporal)
- ✅ Logros semanales compartibles (imagen y vídeo)
- ✅ Popup de novedades tras actualizar (changelog in-app)

## Descartado por restricciones del proyecto

Autenticación, sincronización cloud, modo coach/atleta, dashboard web e IA:
requieren backend/usuarios, explícitamente fuera del alcance del MVP.
Si algún día se replantea, revisar primero AGENTS.md.
