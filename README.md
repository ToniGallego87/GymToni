# 💪 GymTrack - MVP

Una app rápida y moderna para registrar tus entrenamientos de gimnasio usando tu rutina semanal personalizada.

## 🎯 Características MVP

- **📋 Rutina semanal de 5 días**: Preconfigurada con push, pull, pierna A, torso mixto y pierna B
- **⚡ Registro ultrarrápido**: Entrada de texto simple en formato `60x8, 65x6, 65x4`
- **📊 Parsing automático**: Convierte texto a datos estructura dos (peso x reps)
- **🏃 Cardio opcional**: Registra las sesiones de cardio complementarias
- **📱 Historial completo**: Consulta tus entrenamientos pasados
- **💾 Persistencia local**: Todos los datos se guardan localmente (sin nube)
- **🎨 UI limpia**: Interfaz moderna y fácil de usar

## 🛠️ Stack Tecnológico

- **Frontend**: React Native + Expo
- **Lenguaje**: TypeScript (strict mode)
- **Estado**: Context API + useReducer
- **Persistencia**: AsyncStorage (local)
- **UI**: Componentes custom en React Native
- **Navegación**: State-based navigation simple

## 📦 Instalación

### Requisitos previos

- Node.js 16+
- npm o yarn
- Expo CLI

```bash
npm install -g expo-cli
```

### Pasos de instalación

1. **Clonar o descargar el proyecto**

```bash
cd GymTrack
```

2. **Instalar dependencias**

```bash
npm install
# o
yarn install
```

3. **Ejecutar la app**

Para desarrollo local:

```bash
npm start
# o
yarn start
```

Se abrirá Expo Go. Puedes:
- Presionar `i` para iOS simulator
- Presionar `a` para Android emulator
- Escanear el código QR con la app Expo Go en tu teléfono

Para Android:

```bash
npm run android
```

Para iOS (solo en Mac):

```bash
npm run ios
```

Para web:

```bash
npm run web
```

## 📖 Guía de uso

### Pantalla principal (Inicio)

- Muestra los 5 días de la semana
- Toca un día para registrar ese entrenamiento

### Registrar entrenamiento

1. Selecciona un día
2. Para cada ejercicio, ingresa el resultado en formato texto:
   - **Fuerza**: `60x8, 65x6, 65x4` (peso en kg x reps)
   - Soporta decimales: `12.5x15, 15x15`
   - Puedes crear notas opcionales (📝)
3. (Opcional) Añade cardio al final: `Cinta: 22.5mins, 11.5kmh`
4. Presiona "Guardar"

### Historial

- Ve todos tus entrenamientos guardados
- Haz tap en uno para ver los detalles
- Visualiza qué series hiciste y notas asociadas

## 🏗️ Estructura del proyecto

```
GymTrack/
├── app/                     # Punto de entrada y navegación
│   ├── index.tsx           # Entry point
│   └── App.tsx             # Navegación principal
├── components/             # Componentes reutilizables
│   ├── DayCard.tsx
│   ├── ExerciseInputField.tsx
│   ├── ExerciseResultDisplay.tsx
│   ├── CardioInputField.tsx
│   ├── Button.tsx
│   ├── Toast.tsx
│   └── index.ts            # Exports
├── features/               # Features y lógica de negocio
│   └── workout/
│       ├── WorkoutContext.tsx      # Estado global
│       ├── HomeScreen.tsx          # Pantalla de días
│       ├── WorkoutLogScreen.tsx    # Registrar entrenamiento
│       ├── HistoryScreen.tsx       # Historial
│       ├── DetailScreen.tsx        # Detalles de sesión
│       └── index.ts                # Exports
├── hooks/                  # Custom hooks
│   └── useWorkout.ts       # Hook para acceder al contexto
├── lib/                    # Utilidades y parsers
│   ├── parsers.ts         # parseSeriesString, parseCardioString
│   └── storage.ts         # AsyncStorage y helpers
├── types/                  # Definiciones TypeScript
│   └── index.ts           # Todos los tipos
├── data/                   # Datos iniciales
│   └── workoutDays.ts     # Rutina de 5 días
├── assets/                 # Imagens, iconos
├── app.json                # Config de Expo
├── package.json            # Dependencias
├── tsconfig.json           # Configuración TypeScript
└── README.md               # Este archivo
```

## 🔌 Cómo agregar un nuevo ejercicio

Edita [`data/workoutDays.ts`](data/workoutDays.ts):

```typescript
{
  id: 'day1-ex8',
  name: 'Mi nuevo ejercicio',
  order: 8,
  targetReps: '8-10',
  targetSets: 3,
}
```

## 📝 Formato de entrada

### Series de fuerza

| Entrada | Resultado parseado |
|---------|-------------------|
| `60x8` | 1 serie: 60kg x 8 reps |
| `60x8, 65x6` | 2 series: 60kg x 8, 65kg x 6 |
| `60x8, 65x6, 65x4` | 3 series: 60kg x 8, 65kg x 6, 65kg x 4 |
| `12.5x15` | 1 serie: 12.5kg x 15 |

### Cardio

| Entrada | Parseado |
|---------|----------|
| `Cinta: 22.5mins, 11.5kmh` | Tipo: Cinta, Duración: 22.5 min, Velocidad: 11.5kmh |
| `Bici: 30mins, 180bpm` | Tipo: Bici, Duración: 30 min, Ritmo: 180bpm |
| `Elíptica: 20mins` | Tipo: Elíptica, Duración: 20 min |

## ⚙️ Variables de entorno

No necesita configuración especial. Los datos se guardan localmente.

## 🔄 Flujo de estado

```
App (navegación) 
├── WorkoutProvider (Context + useReducer)
│   ├── days: WorkoutDay[]
│   ├── logs: WorkoutLog[]
│   └── dispatch: WorkoutAction
└── useWorkout() (consumer)
    └── Componentes acceden y modifican estado
```

## 📚 Modelos de datos

### WorkoutDay

```typescript
{
  id: string;
  dayNumber: 1-5;
  name: string;
  emoji: string;
  description: string;
  exercises: WorkoutExercise[];
}
```

### WorkoutLog

```typescript
{
  id: string;
  dayId: string;
  date: string;
  exercises: ExerciseLog[];
  cardio?: CardioLog;
  createdAt: number;
  updatedAt: number;
}
```

### ExerciseLog

```typescript
{
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  rawInput: string;        // Lo que escribiste
  parsedSets: ParsedSet[]; // Parseado automático
  notes?: string;
  timestamp: number;
}
```

## 🚀 Próximos pasos (NO en MVP)

- [ ] Autenticación de usuario
- [ ] Sincronización en la nube
- [ ] Gráficas de progreso detalladas
- [ ] Cálculo de 1RM (One Rep Max)
- [ ] Planes de entrenamiento adaptables
- [ ] Recordatorios de entrenos
- [ ] Exportar datos a CSV

## 🐛 Solución de problemas

### La app no inicia

```bash
# Limpiar caché
expo prebuild --clean
npm install
npm start
```

### Los datos no se guardan

- Verificar que AsyncStorage funcione (check browser DevTools)
- Limpiar datos del app en el móvil
- Reinstalar

### Error de tipos TypeScript

```bash
npm run type-check
```

## 📝 Notas técnicas

- **Sin Redux**: Context API es suficiente para MVP
- **Sin DB compleja**: AsyncStorage es suficiente para datos locales
- **Código modular**: Fácil agregar nuevas features
- **TypeScript strict**: Seguridad de tipos completa

## 📄 Licencia

Proyecto personal para uso privado.

---

**¡A entrenar! 💪**
