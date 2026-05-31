# GymTrack — Instrucciones para GitHub Copilot

## Contexto del proyecto

GymTrack es un MVP de app móvil para registrar entrenamientos de gimnasio.
Prioridad absoluta: velocidad de uso > simplicidad > arquitectura clara > mantenibilidad.

Para detalles técnicos consulta:
- [ARCHITECTURE.md](ARCHITECTURE.md) — stack, flujo de datos, tipos, navegación
- [CONVENTIONS.md](CONVENTIONS.md) — naming, patrones, reglas de código
- [docs/frontend-design.md](docs/frontend-design.md) — principios de diseño UI
- [docs/SETUP.md](docs/SETUP.md) — instalación y estructura de archivos
- [docs/UPDATES.md](docs/UPDATES.md) — historial de versiones

---

## Orden de trabajo obligatorio

Cuando se solicite un cambio:

1. Modificar código fuente
2. Verificar coherencia lógica (tipos, imports, consumidores)
3. Finalizar tarea

---

## Comportamiento esperado

- Aplicar cambios directamente, sin pedir confirmación
- No dividir la tarea en múltiples respuestas
- No dejar sincronización pendiente
- Ejecutar tarea completa hasta finalizar
- No sugerir "hacerlo manualmente"

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
