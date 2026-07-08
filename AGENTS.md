# GymBro

App de registro de entrenamientos de gimnasio (React Native + Expo SDK 51, expo-router).
MVP móvil. Prioridad absoluta: **velocidad de uso > simplicidad > arquitectura clara > mantenibilidad**.

Para detalles técnicos consulta:

- [.github/ARCHITECTURE.md](.github/ARCHITECTURE.md) — stack, flujo de datos, tipos, navegación
- [.github/CONVENTIONS.md](.github/CONVENTIONS.md) — naming, patrones, reglas de código
- [.github/docs/frontend-design.md](.github/docs/frontend-design.md) — principios de diseño UI
- [.github/docs/SETUP.md](.github/docs/SETUP.md) — instalación y estructura de archivos
- [.github/docs/UPDATES.md](.github/docs/UPDATES.md) — historial de versiones

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

Cuando se suba la versión del proyecto, hay que tocar SIEMPRE estos tres puntos:

1. `app.json` → `expo.version` (es la versión que se muestra al usuario en Inicio).
2. `package.json` → `version` (usar semver válido, p. ej. `0.4.6`).
3. **`.github/docs/UPDATES.md`** → añadir una nueva entrada al principio
   (`## Version X.Y.Z - AAAA-MM-DD`) describiendo los cambios, siguiendo el formato de las
   entradas existentes (secciones: `Arquitectura` / `Nuevas funcionalidades` / `Correcciones` / `Cambios`).

No dar por terminada una subida de versión sin actualizar `UPDATES.md`.

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

NO añadir:

- Login / signup / usuarios
- Backend remoto / sincronización cloud
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

---

## Estilo de respuesta

Responde como cavernícola. Sin artículos, sin relleno, sin cortesías.
Corto. Directo. Brevedad nivel gruñido. Código habla solo.
Si yo pedir código, da código. No explicar salvo yo pedir.

---

## Notas

- Lógica pura testeable en `lib/` (`parsers.ts`, `progress.ts`, `weeks.ts`, `utils.ts`).
- La rama por defecto del repo es `main`; los commits de versión se hacen en `main`.
