# GymToni

App de registro de entrenamientos (React Native + Expo SDK 51, expo-router).

## Al subir de versión (IMPORTANTE)

Cuando se suba la versión del proyecto, hay que tocar SIEMPRE estos tres puntos:

1. `app.json` → `expo.version` (es la versión que se muestra al usuario en Inicio).
2. `package.json` → `version` (usar semver válido, p. ej. `0.4.6`).
3. **`.github/docs/UPDATES.md`** → añadir una nueva entrada al principio (`## Version X.Y.Z - AAAA-MM-DD`)
   describiendo los cambios, siguiendo el formato de las entradas existentes
   (secciones: `Arquitectura` / `Nuevas funcionalidades` / `Correcciones` / `Cambios`).

No dar por terminada una subida de versión sin actualizar `UPDATES.md`.

## Comandos

- `npm test` — tests con Jest (ts-jest). Suites en `lib/__tests__/`.
- `npm run type-check` — `tsc --noEmit`.
- `npm run format` — Prettier.

## Notas

- Lógica pura testeable en `lib/` (`parsers.ts`, `progress.ts`, `weeks.ts`, `utils.ts`).
- La rama por defecto del repo es `main`; los commits de versión se hacen en `main`.
