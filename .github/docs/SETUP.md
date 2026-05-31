# 🚀 SETUP GymTrack MVP - Guía de Instalación y Uso

## ⚡ Resumen Rápido

**GymTrack** es un MVP de app para registrar entrenamientos de gimnasio de forma rápida y moderna.

- **Stack**: React Native + Expo + TypeScript
- **Persistencia**: In-memory (Expo Snack) o AsyncStorage (versión local)
- **Arquitectura**: Context API + useReducer, componentes reutilizables
- **Versión**: ✅ **v1.1** - Formulario serie por serie + Multi-rutina + UI diseñada
- **Estado**: MVP Completo con 3 rutinas, soporte multi-rutina, nuevo sistema de registro

---

## 🎯 Requisitos

**Instalación Local (Con Node.js)**

**Requisitos:**
- Node.js 16+ (https://nodejs.org)
- npm (viene con Node.js)
- Expo CLI (se instala con npm)

---

## � Instalación Local

### 1️⃣ Instalar Dependencias

```bash
cd "c:\Users\agallego\OneDrive - ATSISTEMAS SA\Escritorio\Aprendizaje\GymTrack"
npm install
```

Esto instalará:
- React Native + Expo
- React Navigation
- TypeScript
- Y todas las dependencias necesarias

### 2️⃣ Ejecutar la App

**Opción A: Web (Recomendado desarrollo)**

```bash
npm run web
```

Se abrirá en http://localhost:3000 automáticamente

**Opción B: Móvil (Expo Go)**

```bash
npm start
```

- Escanea el QR con la app **Expo Go** (iOS/Android)
- O presiona `w` en terminal para web

**Opción C: Emulador (Android)**

```bash
npm run android
```

Requiere Android Studio instalado

**Opción D: Simulador (iOS - Solo Mac)**

```bash
npm run ios
```

---

## 📁 Estructura de Archivos

```
GymTrack/
│
├── 📄 SETUP.md                    ← Estás aquí
├── 📄 README.md                   ← Documentación completa
├── 📄 ROADMAP.md                  ← Próximas features
├── 📄 app.json                    ← Config de Expo
├── 📄 package.json                ← Dependencias
├── 📄 tsconfig.json               ← TypeScript config
│
├── 📂 app/
│   ├── index.tsx                  ← Entry point
│   └── App.tsx                    ← Componente principal
│
├── 📂 components/                 ← Componentes reutilizables
│   ├── Button.tsx
│   ├── CardioInputField.tsx
│   ├── DayCard.tsx
│   ├── ExerciseInputField.tsx       ← Nuevo: Serie por serie con +/- botones
│   ├── ExerciseResultDisplay.tsx
│   ├── Toast.tsx
│   └── index.ts
│
├── 📂 features/workout/           ← Pantallas principales
│   ├── WorkoutContext.tsx         ← Estado global
│   ├── HomeScreen.tsx             ← Inicio con "Empezar entrenamiento"
│   ├── WorkoutLogScreen.tsx       ← Registrar entrenamiento
│   ├── HistoryScreen.tsx          ← Historial (deprecated, usa all-history)
│   ├── DetailScreen.tsx           ← Detalles de sesión
│   └── index.ts
│
├── 📂 hooks/
│   └── useWorkout.ts              ← Custom hook del contexto
│
├── 📂 lib/
│   ├── parsers.ts                 ← parseSeriesString, parseCardioString
│   └── storage.ts                 ← AsyncStorage helpers
│
├── 📂 types/
│   └── index.ts                   ← Tipos TypeScript
│
├── 📂 data/
│   └── workoutDays.ts             ← WORKOUT_ROUTINES (3 rutinas × 5 días)
│
└── 📂 assets/                     ← Imágenes, íconos
```

---

## 🎯 Funcionalidades Implementadas

✅ **3 Rutinas Completas**
- Rutina 1: Push/Pull/Legs clásico
- Rutina 2: Fuerza y volumen
- Rutina 3: Tu rutina actual (5 días, 30+ ejercicios)

✅ **Interfaz UI/UX Redeseñada**
- HomeScreen con botón "🎯 Empezar entrenamiento"
- Selector de días (DaySelectScreen)
- Historial rutina-específico en la pantalla principal
- AllHistoryScreen (ver todos los entrenamientos)

✅ **Registro de Entrenamientos (Nuevo Flujo)**
- **Agregar series una por una**: Ingresa `60x8` → Click ➕ Añadir
- **Series se muestran arriba** en tags (60x8, 65x8, 70x6, ...)
- **Contador de series**: Muestra progreso (Ej: "Series: 3/4")
- **Botón ➖ Borrar**: Elimina última serie si hay error (solo si hay series)
- **Botón ✓ Fin**: Cierra ejercicio sin completar todas las series (flexible)
- **Deshabilita input** cuando se alcanzan todas las series
- Cardio opcional: `Cinta: 22.5mins, 11.5kmh`
- Notas por ejercicio (modal 📝)

✅ **Gestión de Rutinas**
- Cambiar entre 3 rutinas en cualquier momento
- Historial filtrado por rutina activa
- Estado persiste en contexto

✅ **Historial & Detalles**
- Historial rutina-específico (HomeScreen)
- AllHistoryScreen (todos los entrenamientos)
- DetailScreen (ver detalles de sesión)
- Parsing visual de series

✅ **Arquitectura**
- Context API + useReducer (estado global)
- TypeScript strict mode
- Componentes reutilizables
- Parsers puros (sin side effects)

---

## 🎮 Cómo Usar GymTrack

### **Flujo Principal**

1. **Pantalla Inicio (HomeScreen)**
   - Ves el botón **"🎯 Empezar entrenamiento"**
   - Rutina activa mostrada en la cabecera
   - Historial de la rutina activa debajo

2. **Seleccionar Día**
   - Click en "Empezar entrenamiento"
   - Elige uno de los 5 días
   - Se abre el formulario de registro

3. **Registrar Entrenamiento (Serie a Serie)**
   - Ves "Repeticiones: 4x6-8" (4 series de 6-8 reps)
   - Ingresa **`60x8`** → Click **➕ Añadir**
   - Aparece en tag arriba: "60x8"
   - Contador actualiza: "Series: 1/4"
   - Repite para cada serie (o click **✓ Fin** para saltarte algunas)
   - Cuando completas series → Mensaje "✓ Series completadas (4/4)"
   - (Opcional) Cardio: `Cinta: 22.5mins, 11.5kmh`
   - (Opcional) Notas: Click en 📝
   - Click en **"💾 Guardar"** → Guarda todas las series registradas

4. **Ver Historial**
   - **Historial actual**: En HomeScreen (filtra por rutina activa)
   - **Todos los entrenamientos**: Tab "📊 Historial"
   - Click en un entrenamiento → Ver detalles

5. **Cambiar Rutina**
   - Click en botón azul "Rutina..." (arriba derecha)
   - Selecciona una de las 3 rutinas
   - Los datos se filtran automáticamente

---

## 📝 Formato de Entrada

### **Series (Fuerza) - Ahora una por una**

```
Para cada serie, ingresa UNO a UNO:

60x8              ← Primera serie (60kg × 8 reps)
65x8              ← Segunda serie (65kg × 8 reps)
70x6              ← Tercera serie (70kg × 6 reps)
75x4              ← Cuarta serie (75kg × 4 reps)

Decimales soportados:
22.5x10           ← 22.5kg × 10 reps
12.5x12           ← 12.5kg × 12 reps
```

**Formato de Repeticiones (en la cabecera):**
```
4x6-8             ← 4 series de 6-8 repeticiones
3x12-15           ← 3 series de 12-15 repeticiones
```

### **Cardio (Opcional)**

```
Cinta: 30mins, 12kmh
Bici: 25mins, 120watts
Elíptica: 20mins, 8.5kmh
```

### **Notas**

- Click en el ícono 📝 al lado del ejercicio
- Escribe lo que quieras: "Sentí más fuerza", "Mucho peso", etc.
- Aparece en el historial

---

## 🔧 Cambios Recientes (v1.1)

### **Nuevo Sistema de Registro (Serie por Serie)**
- ✅ **Input individual**: Ingresa una serie a la vez (Ej: "60x8")
- ✅ **Botón ➕ Añadir**: Agrega la serie al contador
- ✅ **Botón ➖ Borrar**: Elimina última serie (solo si hay series)
- ✅ **Botón ✓ Fin**: Cierra ejercicio sin completar todas las series
- ✅ **Tags visuales**: Series se muestran en badges arriba
- ✅ **Contador**: "Series: 3/4" muestra progreso
- ✅ **Protección**: No permite agregar más si alcanza máximo
- ✅ **Formato Repeticiones**: "4x6-8" en lugar de solo "6-8"

### **Arquitectura Multi-Rutina** (v1.0)
- ✅ Cambio `WorkoutDay[]` → `WorkoutRoutine[]` con días anidados
- ✅ Nuevo estado `activeRoutineId` para rutina activa
- ✅ Acciones reducer: `SET_ROUTINES`, `SET_ACTIVE_ROUTINE`

### **Nuevas Pantallas** (v1.0)
- ✅ **HomeScreen Redeseñada**: Botón principal + historial rutina-específico
- ✅ **DaySelectScreen**: Selector de días (nueva)
- ✅ **AllHistoryScreen**: Ver todos entrenamientos (nueva)
- ✅ Removed: Tab de "Registrar" directo (ahora via botón principal)

### **Datos**
- ✅ 3 rutinas completas con 5 días cada una
- ✅ 25-30 ejercicios por rutina
- ✅ Descripción y emojis para cada día


---

## 💾 Tipos TypeScript

```typescript
// Nueva estructura multi-rutina
interface WorkoutRoutine {
  id: string                    // ej: 'routine1'
  name: string                  // ej: 'Rutina 1'
  description?: string
  isActive: boolean
  days: WorkoutDay[]            // 5 días
  createdAt: number
}

interface WorkoutDay {
  id: string
  dayNumber: 1-5
  name: string
  emoji: string
  description?: string
  exercises: WorkoutExercise[]
}

interface WorkoutLog {
  id: string
  routineId: string             // Linkea a WorkoutRoutine
  dayId: string
  date: string                  // '2026-03-31'
  exercises: ExerciseLog[]
  cardio?: { rawInput: string }
  createdAt: number
  updatedAt: number
}

interface ExerciseLog {
  id: string
  exerciseId: string
  exerciseName: string
  rawInput: string              // '60x8, 65x6, 70x4' (generado desde series individuales)
  parsedSets: ParsedSet[]        // [{ weight: 60, reps: 8 }, { weight: 65, reps: 6 }, ...]
  notes?: string
  timestamp: number
}

interface ParsedSet {
  weight: number
  reps: number
}
```

---

## 🔄 Estado Global (Context)

```typescript
interface WorkoutState {
  routines: WorkoutRoutine[]        // Las 3 rutinas
  activeRoutineId: string           // Cuál está activa
  logs: WorkoutLog[]                // Todos los entrenamientos
}

// Acciones
type WorkoutAction =
  | { type: 'SET_ROUTINES'; payload: WorkoutRoutine[] }
  | { type: 'SET_ACTIVE_ROUTINE'; payload: string }
  | { type: 'ADD_WORKOUT_LOG'; payload: WorkoutLog }
  | { type: 'SET_LOGS'; payload: WorkoutLog[] }
  | { type: 'DELETE_WORKOUT_LOG'; payload: string }
  | { type: 'UPDATE_WORKOUT_LOG'; payload: WorkoutLog }
```

---

## 💻 Commands Útiles

```bash
# Instalar dependencias
npm install

# Desarrollo web
npm run web

# Desarrollo móvil (Expo Go)
npm start

# Check TypeScript
npm run type-check

# Format código
npm run format

# Emulador Android
npm run android

# Simulador iOS (Mac only)
npm run ios

# Clean & rebuild
rm -rf node_modules
npm install
expo prebuild --clean
npm start
```

---

## � Componente ExerciseInputField (Nuevo en v1.1)

### **Props del Componente**

```typescript
interface ExerciseInputFieldProps {
  order: number                          // Número del ejercicio
  exerciseName: string                   // Nombre del ejercicio
  repetitions?: string                   // Ej: "4x6-8"
  addedSets: ParsedSet[]                 // Series ya agregadas
  targetSets?: number                    // Máximo de series esperadas (Ej: 4)
  onAddSet: (set: ParsedSet) => void    // Callback: agregar serie
  onRemoveLastSet: () => void            // Callback: borrar última serie
  onFinishExercise: () => void           // Callback: finalizar ejercicio
  onNotesPress: (event) => void          // Callback: abrir modal de notas
  notesCount?: number                    // Cantidad de notas
  placeholder?: string                   // Placeholder del input (default: "Ej: 60x8")
}
```

### **Flujo de Uso**

```
1. Usuario ve: "Repeticiones: 4x6-8" + "Series: 0/4"
2. Ingresa: "60x8" en el input
3. Click ➕ Añadir → Se valida y agrega la serie
4. Series aparecen en tags: [60x8] [65x8] ...
5. Contador actualiza: "Series: 2/4"
6. Si alcanza máximo → Input se deshabilita
7. Mensaje: "✓ Series completadas (4/4)"
8. Click ✓ Continuar o ✓ Fin según si completó o no
```

### **Características Técnicas**

- **Validación en tiempo real**: Formato `NúmeroxNúmero` (Ej: 60x8, 22.5x10)
- **Soporte de decimales**: 22.5x10, 12.5x12
- **Botón ➖ Borrar condicional**: Solo aparece si hay series agregadas
- **Flexibilidad**: Puedes finalizar sin completar todas las series
- **Contador visual**: Muestra progreso (SeriesAgregadas/SeriesEsperadas)
- **Deshabilita input**: Cuando alcanza el máximo de series
- **Limpia input**: Después de agregar una serie

---

## � Comparativa: v1.0 vs v1.1

| Característica | v1.0 | v1.1 |
|---|---|---|
| **Entrada de series** | Todas de una vez: "60x8, 65x6, 70x4" | Una por una con botones |
| **Botones** | Solo Guardar/Cancelar | ➕ Añadir, ➖ Borrar, ✓ Fin |
| **Series visuales** | No | Sí, en tags arriba |
| **Contador** | No | Sí, "Series: 3/4" |
| **Flexible** | No (completa todas o nada) | Sí (completa o finaliza) |
| **Error corrections** | Reescribir todo | Solo borrar la última |
| **Validación** | Al guardar | En tiempo real |

---

## ⚡ Mejoras en v1.1

### **Experiencia de Usuario**
- ✅ **Menos errores**: Valida mientras escribes, no al guardar
- ✅ **Correcciones rápidas**: Botón ➖ para borrar último régimen, no todo
- ✅ **Progreso visual**: Ves las series agregadas en tiempo real con tags
- ✅ **Flexibilidad**: Puedes terminar el ejercicio sin completar todas las series
- ✅ **Protección**: El input se deshabilita cuando alcanza el máximo

### **Facilidad de Uso**
- ✅ **Menos escritura**: "60x8" vs "60x8, 65x6, 70x4" (una a la vez)
- ✅ **Menos errores de formato**: Validación integrada
- ✅ **Feedback inmediato**: Ves la serie agregada al instante
- ✅ **Contador de progreso**: Sabes cuántas series te faltan

### **Técnicas**
- ✅ Estado `exerciseSets` guarda arrays de `ParsedSet[]` por ejercicio
- ✅ Series se pasan individuales, no como string parseado
- ✅ Construcción secuencial desde UI mejora precisión

---

## 💻 Personalización Rápida

### **Cambiar rutina activa por defecto**

En `features/workout/WorkoutContext.tsx`:

```typescript
const initialState: WorkoutState = {
  routines: WORKOUT_ROUTINES,
  activeRoutineId: 'routine1',  // ← Cambia aquí (routine1, routine2, routine3)
  logs: [],
};
```

### **Cambiar colores principales**

Busca `#6200ee` (púrpura) en los estilos:

```typescript
backgroundColor: '#6200ee'    // Alterna a:
// #1976d2 (azul)
// #d32f2f (rojo)
// #388e3c (verde)
```

### **Agregar ejercicio**

En `data/workoutDays.ts`, busca la rutina y el día:

```typescript
exercises: [
  // ... ejercicios existentes
  {
    id: 'new-ex',
    name: 'Mi nuevo ejercicio',
    order: 6,
    targetReps: '3x8-10',       // ← Formato: NúmeroSeriesx RangoReps
    targetSets: 3,              // ← Máximo de series (debe coincidir con el número de series)
  },
]
```

**Ejemplos de targetReps válidos:**
```typescript
'4x6-8'      // 4 series de 6-8 repeticiones
'3x10-12'    // 3 series de 10-12 repeticiones
'5x5'        // 5 series de 5 repeticiones exactas
```

### **Agregar rutina completa**

1. Duplica un objeto rutina en `data/workoutDays.ts`
2. Cambia `id`, `name`, `description`
3. Modifica los ejercicios según necesites
4. En `WorkoutContext.tsx`, ya se carga automáticamente

---

## 🔍 Parsers Disponibles

### **Series (en `lib/parsers.ts`)**

```typescript
import { parseSeriesString } from './lib/parsers';

parseSeriesString('60x8, 65x6')
// → [{ weight: 60, reps: 8 }, { weight: 65, reps: 6 }]

parseSeriesString('22.5x10')
// → [{ weight: 22.5, reps: 10 }]

parseSeriesString('')
// → []
```

### **Cardio**

```typescript
// Nota: En versión Snack, no está parseado
// Se guarda el rawInput como string
// Próxima versión: agregar parseCardioString
```

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| **"npm command not found"** | Instala Node.js desde https://nodejs.org |
| **"Module not found"** | `npm install` nuevamente |
| **"Port 3000 en uso"** | `npm start -- --port 3001` (cambia puerto) |
| **Datos desaparecieron (Snack)** | Normal en Snack. Usa versión local para persistencia |
| **Compilación lenta (web)** | Espera 10-15s o recarga la página |
| **TypeScript errors** | Ejecuta `npm run type-check` |

---

## 📚 Documentación Adicional

- **[README.md](README.md)** - Overview del proyecto
- **[ROADMAP.md](ROADMAP.md)** - Features futuras

---

## ✅ Checklist de Setup

- [ ] Ejecutaste `npm install`
- [ ] Ejecutaste `npm run web` o `npm start`
- [ ] La app está corriendo
- [ ] Probaste registrar un entrenamiento
- [ ] Probaste cambiar de rutina
- [ ] Viste el historial

---

## 🎯 Próximos Pasos

1. **Instalación local**: Ejecuta `npm install` y `npm run web`
2. **Desarrollo**: Usa `npm start` para Expo Go o `npm run web` para web
3. **Para deployment**: Consulta [README.md](README.md) y [ROADMAP.md](ROADMAP.md)

### 2️⃣ Ejecutar la App

**Opción A: Web (Recomendado para desarrollo)**

```bash
npm run web
```

Se abrirá en el navegador automáticamente (http://localhost:3000)

**Opción B: iOS Simulator (Solo Mac)**

```bash
npm run ios
```

**Opción C: Android Emulator**

```bash
npm run android
```

**Opción D: Expo Go en tu teléfono**

```bash
npm start
```

Escanea el código QR con la app Expo Go

---

## 🎮 Cómo Usar la App

### Flujo básico:

1. **Pantalla Inicio** 💪
   - Ves los 5 días de la semana
   - Toca uno para registrar ese entrenamiento

2. **Registrar Entrenamiento** 📝
   - Para **cada ejercicio**: Escribe en formato texto
     - `60x8, 65x6, 65x4` ← 3 series
     - `12.5x15` ← 1 serie con decimal
   - Para **notas**: Toca el botón 📝 al lado del ejercicio
   - Opcional: **Cardio** al final (formato: `Modalidad: duración, velocidad`)
   - Presiona **Guardar**

3. **Historial** 📊
   - Ve todos tus entrenamientos guardados
   - Toca uno para ver detalles
   - Total de ejercicios realizados

4. **Detalles** 🔍
   - Ves exactamente qué series hiciste
   - Las series están parseadas automáticamente
   - Muestra tus notas si las agregaste

---

## 💻 Commands Útiles

```bash
# Instalar deps
npm install

# Desarrollo en web
npm run web

# Desarrollo en móvil (Expo Go)
npm start

# Verificar tipos TypeScript
npm run type-check

# Formatear código
npm run format

# Android
npm run android

# iOS (Mac only)
npm run ios

# Full clean & rebuild
npm install
expo prebuild --clean
npm start
```

---

## 📝 Personalización Rápida

### Cambiar rutina de ejercicios

Edita: `data/workoutDays.ts`

```typescript
{
  id: 'day1-ex1',
  name: 'Mi nuevo ejercicio',
  order: 1,
  targetReps: '8-10',
  targetSets: 3,
}
```

### Cambiar colores/temas

Edita los `StyleSheet` en cualquier componente:

```typescript
const styles = StyleSheet.create({
  button: {
    backgroundColor: '#6200ee', // ← Cambiar color
    // ...
  }
});
```

### Agregar nuevo campo a un ejercicio

1. Edita el tipo en `types/index.ts`
2. Actualiza `data/workoutDays.ts`
3. Usa en los componentes

---

## 🔍 Parsers Disponibles

### Series de fuerza

```typescript
import { parseSeriesString } from '@lib/parsers';

parseSeriesString('60x8, 65x6')
// Retorna: [{ weight: 60, reps: 8 }, { weight: 65, reps: 6 }]

parseSeriesString('12.5x15')
// Retorna: [{ weight: 12.5, reps: 15 }]
```

### Cardio

```typescript
import { parseCardioString } from '@lib/parsers';

parseCardioString('Cinta: 22.5mins, 11.5kmh')
// Retorna: { 
//   type: 'Cinta', 
//   duration: 22.5, 
//   pace: '11.5kmh',
//   rawInput: '...'
// }
```

---

## 🎯 Próximos pasos sugeridos (NOT NOW)

1. **Autenticación**: Agregar login/signup
2. **Cloud Sync**: Guardar en Firebase/Supabase
3. **Gráficas**: Charts de progreso
4. **Notificaciones**: Recordar entrenamientos
5. **Exportar**: CSV, PDF de historial
6. **Planes**: Crear planes personalizados

---

## 🐛 Si algo no funciona

### "npm command not found"

Node.js no está instalado. Descarga e instala desde: https://nodejs.org/

### "Module not found"

```bash
rm -rf node_modules package-lock.json
npm install
```

### "Port already in use"

```bash
npm start -- --port 3000
```

### "TypeScript errors"

```bash
npm run type-check
```

---

## 📚 Documentación Extra

- Consulta `README.md` para guía completa
- Cada archivo `.tsx` tiene comentarios claros
- Tipos están bien documentados en `types/index.ts`

---

## ✨ Resumen Final

**GymToni MVP está 100% listo para:**
- ✅ Ejecutar localmente con persistencia de datos
- ✅ Registrar y guardar entrenamientos
- ✅ Ver historial completo
- ✅ Estudiar el código (TypeScript, componentes, state)
- ✅ Extender con nuevas features

**Sin dependencias complejas. Sin configuración complicada. Puro React Native con AsyncStorage.**

---

**¡Que disfrutes entrenando! 💪**

Ejecuta: `npm start` o `npm run web` y ¡a por ello!
