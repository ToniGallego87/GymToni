# GymBro

App de registro de entrenamientos de gimnasio (React Native + Expo SDK 51, expo-router).
MVP móvil. Prioridad absoluta: **velocidad de uso > simplicidad > arquitectura clara > mantenibilidad**.

Para detalles técnicos consulta:

- [.github/ARCHITECTURE.md](.github/ARCHITECTURE.md) — stack, flujo de datos, tipos, navegación
- [.github/CONVENTIONS.md](.github/CONVENTIONS.md) — naming, patrones, reglas de código
- [.github/docs/frontend-design.md](.github/docs/frontend-design.md) — principios de diseño UI
- [.github/docs/backend-design.md](.github/docs/backend-design.md) — propuesta de backend, cuentas y sincronización (Supabase, por fases)
- [.github/docs/backend-fase1-runbook.md](.github/docs/backend-fase1-runbook.md) — runbook de la Fase 1 del backend: fundaciones locales de sync sobre la `expo-sqlite` actual (sin subir SDK ni New Architecture). Entregada en 0.7.0; PowerSync se descartó (ver backend-design.md §14)
- [.github/docs/SETUP.md](.github/docs/SETUP.md) — instalación y estructura de archivos
- [.github/docs/UPDATES.md](.github/docs/UPDATES.md) — historial de versiones
- [.github/docs/ROADMAP.md](.github/docs/ROADMAP.md) — seguimiento de futuros desarrollos (mejoras visuales, simplificaciones y nuevas funcionalidades pendientes)

---

## Orden de trabajo obligatorio

Cuando se solicite un cambio:

1. Modificar código fuente
2. Verificar coherencia lógica (tipos, imports, consumidores)
3. Finalizar tarea

### Comportamiento esperado

- Aplicar cambios directamente, sin pedir confirmación
- No dividir la tarea en múltiples respuestas
- No dejar sincronización pendiente
- Ejecutar tarea completa hasta finalizar
- No sugerir "hacerlo manualmente"

---

## Comandos

- `npm test` — tests con Jest (ts-jest). Suites en `lib/__tests__/`.
- `npm run type-check` — `tsc --noEmit`.
- `npm run format` — Prettier.

---

## Al subir de versión (IMPORTANTE)

Cuando se suba la versión del proyecto, hay que tocar SIEMPRE estos **cinco** puntos:

1. `app.json` → `expo.version` (es la versión que se muestra al usuario en Inicio).
2. `package.json` → `version` (usar semver válido, p. ej. `0.4.6`).
3. `android/app/build.gradle` → `versionCode` (+1) y `versionName` (misma semver).
4. **`.github/docs/UPDATES.md`** → añadir una nueva entrada al principio
   (`## Version X.Y.Z - AAAA-MM-DD`) describiendo los cambios, siguiendo el formato de las
   entradas existentes (secciones: `Arquitectura` / `Nuevas funcionalidades` / `Correcciones` / `Cambios`).
5. **`data/changelog.ts`** → añadir la entrada `{ version, items }` al principio de `CHANGELOG`
   (alimenta el popup de novedades in-app, `WhatsNewModal`; redactar para usuario final, sin tecnicismos).

No dar por terminada una subida de versión sin actualizar `UPDATES.md` y `data/changelog.ts`.

El cierre completo de una versión (bump + UPDATES + changelog + commit + push + APK)
lo hace de principio a fin el subagente **close-version** cuando se pide
"cierra la versión X.Y.Z".

Los cambios aplicados entre versiones se anotan en `UPDATES.md` bajo una sección
`## Sin publicar` al principio; el cierre de versión la convierte en la entrada
de la nueva versión.

---

## Sincronización obligatoria

Después de modificar cualquiera de estos, verificar que el resto sigue coherente:

- `ExerciseInputField` ↔ `WorkoutLogScreen`
- `WorkoutContext` ↔ `useWorkout` ↔ `types/index.ts`
- `normalize.ts` ↔ `storage.ts` ↔ `WorkoutContext` (fuente única de normalización)
- `parsers.ts` ↔ componentes que consumen parsed data
- `theme.ts` / `glassTokens.ts` ↔ componentes visuales
- `storage.ts` ↔ App.tsx (load/save)
- `workoutDays.ts` / `seedData.ts` ↔ tipos
- `exerciseForm.ts` ↔ `ExerciseFormRow` ↔ `NewRoutineScreen` / `RoutineDetailScreen`
  (crear una rutina y editar los ejercicios de un día usan el MISMO modelo)
- `weeks.ts` ↔ `HomeScreen` (semanas, rachas y progreso; la pantalla no recalcula)

---

## Cuándo actualizar docs

### UPDATES.md (`.github/docs/UPDATES.md`)

Después de aplicar mejoras o cambios funcionales. Formato:

- Contenido resumido y directo (2-4 puntos por apartado)
- Priorizar impacto funcional visible para el usuario

### SETUP.md (`.github/docs/SETUP.md`)

Cuando cambie: estructura de carpetas, tipos, modelo de datos, flujo de registro, componentes clave.

---

## Restricciones

Backend, cuentas y sincronización cloud **dejan de estar prohibidos**: pasan a
ser una dirección planificada **por fases**. La fuente única del plan es
[.github/docs/backend-design.md](.github/docs/backend-design.md) (Supabase,
offline-first, cuenta opcional). No improvisar nube ni login fuera de ese plan.

NO añadir (sigue vigente):

- Redux / librerías de estado externas
- Arquitecturas complejas / abstracciones innecesarias
- Librerías UI externas

---

## Detección de errores

Antes de finalizar, verificar:

- Todas las funciones/handlers invocados existen
- No hay props renombradas sin actualizar consumidores
- No hay cambios en context/reducer sin actualizar dispatch usage
- Tipos coherentes entre definición y uso

---

## Diseño UI

- Inputs rápidos (ej: `60x8`), botones grandes (➕ ➖ ✓)
- Uso con una mano, navegación simple
- Evitar modales innecesarios y formularios largos
- Sistema glass: usar tokens de `glassTokens.ts`
- Colores y degradados SIEMPRE desde `theme.ts` (`theme.colors`, `theme.gradients`); no hex sueltos en pantallas
- Modales: SIEMPRE `AppModal` (overlay/tarjeta/título/pie), con `Button` en las
  acciones. Nunca montar un `Modal` + overlay a mano
- Confirmaciones (eliminar/importar/limpiar): `ConfirmModal` (es `AppModal` + cancelar/confirmar)
- Gráficas de barras: `BarChart`. Filtros de gráfica: `SegmentedFilter`
- Nada de acciones escondidas tras long-press: si algo se puede hacer, tiene que
  verse (botón propio con su icono)
- Título de pantalla: prop `icon` de `GlassTopBar` (no recrear el row icono+texto a mano)
- Detalle completo del sistema en [.github/docs/frontend-design.md](.github/docs/frontend-design.md)

---

## Estilo de respuesta

Responde como cavernícola. Sin artículos, sin relleno, sin cortesías.
Corto. Directo. Brevedad nivel gruñido. Código habla solo.
Si yo pedir código, da código. No explicar salvo yo pedir.

---

## Notas

- Lógica pura testeable en `lib/` (`parsers.ts`, `progress.ts`, `weeks.ts`, `utils.ts`).
- La rama por defecto del repo es `main`; los commits de versión se hacen en `main`.
