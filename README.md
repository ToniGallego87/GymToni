# GymBro

App móvil para registrar entrenamientos de gimnasio de forma rápida y eficiente.

## Stack

React Native + Expo (SDK 51) · TypeScript · Context API + useReducer · SQLite local (`expo-sqlite`) en nativo / localStorage en web

## Inicio rápido

```bash
npm install
npm run web        # desarrollo en navegador
npm start          # Expo Go (móvil)
```

## Uso

1. Pulsa la tarjeta principal de Inicio: abre el día que te toca (o elige otro)
2. Registra cada serie: peso y repeticiones (salen rellenos con lo de la última vez) → "Añadir serie"
3. (Opcional) Cardio: elige la disciplina (cinta, bici, elíptica…) y apunta minutos, velocidad y pendiente
4. Sal con "Volver": el entrenamiento se guarda solo, serie a serie

## Documentación

| Documento                                             | Contenido                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| [ARCHITECTURE.md](.github/ARCHITECTURE.md)            | Stack, flujo de datos, tipos, navegación                         |
| [CONVENTIONS.md](.github/CONVENTIONS.md)              | Naming, patrones, reglas de código                               |
| [frontend-design.md](.github/docs/frontend-design.md) | Sistema de diseño UI (colores, tipos)                            |
| [backend-design.md](.github/docs/backend-design.md)   | Nube opcional: cuentas, sync y social                            |
| [SETUP.md](.github/docs/SETUP.md)                     | Instalación detallada y estructura                               |
| [COMMANDS.md](.github/docs/COMMANDS.md)               | Comandos de desarrollo y build                                   |
| [UPDATES.md](.github/docs/UPDATES.md)                 | Historial de versiones                                           |
| [ROADMAP.md](.github/docs/ROADMAP.md)                 | Trabajo pendiente: UX, simplificaciones y nuevas funcionalidades |

## Estructura

```
app/                → Entry point
components/         → UI reutilizable (Glass system, inputs, cards)
features/workout/   → Pantallas y lógica de negocio
hooks/              → useWorkout, sync de nube, perfil, nivel
lib/                → Parsers, storage, theme, progress, nube (cloud/)
types/              → Tipos TypeScript centralizados
data/               → Rutinas seed, catálogo de ejercicios, changelog
modules/            → Módulos nativos locales (descanso PiP, cristal, vídeo)
```

**¡A entrenar! 💪**
