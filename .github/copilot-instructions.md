# GymTrack - Instrucciones de Desarrollo

## 📋 Resumen del Proyecto

**GymTrack** es un MVP de una app para registrar entrenamientos de gimnasio de forma rápida y moderna.

- **Stack**: React Native + Expo + TypeScript
- **Estado**: Context API + useReducer
- **Persistencia**: AsyncStorage (local)
- **Arquitectura**: Componentes reutilizables, tipos strict

## 🚀 Inicio Rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Ejecutar en desarrollo

**Opción web (recomendado):**
```bash
npm run web
```

**Opción móvil:**
```bash
npm start
```

## 📁 Estructura

```
app/                 # Punto de entrada
components/          # Componentes UI (Button, Cards, Inputs)
features/workout/    # Pantallas (Home, WorkoutLog, History, Detail)
lib/                 # Parsers (series, cardio) y storage
hooks/               # useWorkout
types/               # Definiciones de tipos TypeScript
data/                # Rutina inicial de 5 días
```

## 🎯 Funcionalidades Principales

1. **HomeScreen**: Lista de 5 días de entreno
2. **WorkoutLogScreen**: Registrar entrenamientos
3. **HistoryScreen**: Ver entrenamientos pasados
4. **DetailScreen**: Ver detalles de una sesión

## 📝 Cómo registrar un entrenamiento

1. Selecciona un día en la pantalla principal
2. Para cada ejercicio, ingresa: `60x8, 65x6` (peso x reps)
3. (Opcional) Añade notas al ejercicio
4. (Opcional) Añade cardio: `Cinta: 22.5mins, 11.5kmh`
5. Presiona "Guardar"

## 🔧 Parsers disponibles

```typescript
// Series de fuerza
parseSeriesString('60x8, 65x6')
// => [{ weight: 60, reps: 8 }, { weight: 65, reps: 6 }]

// Cardio
parseCardioString('Cinta: 22.5mins, 11.5kmh')
// => { type: 'Cinta', duration: 22.5, pace: '11.5kmh' }
```

## 💾 Tipos principales

```typescript
WorkoutDay      // Define un día de rutina
WorkoutLog      // Registro guardado de una sesión
ExerciseLog     // Resultado de un ejercicio
CardioLog       // Datos de cardio opcional
```

## ✨ Configuración TypeScript

- **Strict mode**: ✅ Habilitado
- **Strict null checks**: ✅ Sí
- **Resolver paths**: `@components/*`, `@lib/*`, etc.

## 🎨 Personalización

### Cambiar colores
Edita el color primario `#6200ee` en los componentes

### Agregar ejercicio
1. Edita `data/workoutDays.ts`
2. Agrega un objeto al array `exercises` del día

### Agregar campo a ejercicio
1. Actualiza el tipo en `types/index.ts`
2. Actualiza los datos en `data/workoutDays.ts`
3. Usa en componentes según necesites

## 🔍 Debugging

```bash
# Verificar tipos
npm run type-check

# Formatear código
npm run format
```

## 📚 Próximas features (no MVP)

- Autenticación
- Sincronización en nube
- Gráficas de progreso
- Cálculo de 1RM
- Planes personalizados

## 📖 Ver más

- [README.md](../README.md) - Documentación completa
- [SETUP.md](../SETUP.md) - Guía de instalación detallada
