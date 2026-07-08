# GymBro

App móvil para registrar entrenamientos de gimnasio de forma rápida y eficiente.

## Stack

React Native + Expo · TypeScript · Context API + useReducer · AsyncStorage

## Inicio rápido

```bash
npm install
npm run web        # desarrollo en navegador
npm start          # Expo Go (móvil)
```

## Uso

1. Selecciona un día de tu rutina
2. Registra series una por una: `60x8` → ➕
3. (Opcional) Cardio: `Cinta: 22.5mins, 11.5kmh`
4. Guarda el entrenamiento

## Documentación

| Documento                                  | Contenido                                |
| ------------------------------------------ | ---------------------------------------- |
| [ARCHITECTURE.md](.github/ARCHITECTURE.md) | Stack, flujo de datos, tipos, navegación |
| [CONVENTIONS.md](.github/CONVENTIONS.md)   | Naming, patrones, reglas de código       |
| [SETUP.md](.github/docs/SETUP.md)          | Instalación detallada y estructura       |
| [COMMANDS.md](.github/docs/COMMANDS.md)    | Comandos de desarrollo y build           |
| [UPDATES.md](.github/docs/UPDATES.md)      | Historial de versiones                   |
| [ROADMAP.md](.github/docs/ROADMAP.md)      | Features futuras (no MVP)                |

## Estructura

```
app/                → Entry point
components/         → UI reutilizable (Glass system, inputs, cards)
features/workout/   → Pantallas y lógica de negocio
hooks/              → useWorkout
lib/                → Parsers, storage, theme, progress
types/              → Tipos TypeScript centralizados
data/               → Rutinas seed
```

**¡A entrenar! 💪**
