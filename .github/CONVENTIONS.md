# Convenciones — GymTrack

## Naming

| Elemento         | Convención            | Ejemplo                    |
| ---------------- | --------------------- | -------------------------- |
| Componentes      | PascalCase            | `ExerciseInputField.tsx`   |
| Hooks            | camelCase con `use`   | `useWorkout.ts`            |
| Archivos lib     | camelCase             | `parsers.ts`, `storage.ts` |
| Tipos/Interfaces | PascalCase            | `WorkoutLog`, `ParsedSet`  |
| Acciones reducer | UPPER_SNAKE_CASE      | `ADD_WORKOUT_LOG`          |
| Props interfaces | PascalCase + Props    | `DayCardProps`             |
| IDs              | camelCase con prefijo | `day1-ex3`, `routine1`     |

## Estructura de archivos nuevos

- **Componente UI** → `components/NombreComponente.tsx`
- **Pantalla** → `features/workout/NombreScreen.tsx`
- **Utilidad** → `lib/nombre.ts`
- **Tipo nuevo** → añadir a `types/index.ts` (centralizado)
- **Datos semilla** → `data/nombre.ts`

## Patrones obligatorios

### Estado global

- Siempre `useReducer` dentro de un Context Provider
- Nunca Redux ni librerías externas de estado
- Nuevo estado → nueva acción en `WorkoutAction` type union

### Componentes

- Props tipadas con interface explícita
- Sin lógica de negocio en componentes UI (solo presentación)
- Lógica compleja → extraer a hook o lib

### Imports

- Barrel exports desde `components/index.ts` y `features/workout/index.ts`
- Paths relativos dentro del mismo directorio
- Alias `@components/*`, `@lib/*` para imports cruzados

### Estilos

- `StyleSheet.create()` al final del archivo
- Tokens glass compartidos desde `components/glassTokens.ts`
- Color primario: variable, no hardcoded (excepto en theme)

## Formato de entrada (parsers)

- Series: `{peso}x{reps}` — ej: `60x8`
- Cardio: `{tipo}: {duración}mins, {pace}` — ej: `Cinta: 22.5mins, 11.5kmh`
- Soporta decimales en peso y duración

## Reglas de código

- TypeScript strict (no `any`, no `as` innecesarios)
- Null checks explícitos (strict null checks habilitado)
- Lógica pura y testeable en `lib/` (`parsers.ts`, `progress.ts`, `weeks.ts`, `cardio.ts`, `achievements.ts`, `utils.ts`); la persistencia (`storage.ts`, `persistence.ts`, `db/`) es la excepción con side effects
- Side effects de UI solo en hooks o Context

## Lo que NO se hace

- No login/auth/usuarios
- No backend/cloud/sync
- No Redux
- No librerías UI externas (todo custom)
- No sobre-abstracciones (si solo se usa una vez, no crear helper)

## Tests

- Jest (ts-jest) sobre la lógica pura de `lib/`: suites en `lib/__tests__/`
- `npm test` debe pasar antes de cerrar cualquier cambio en `lib/`
- No se testean componentes UI ni pantallas
