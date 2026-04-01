# GymTrack — Instrucciones persistentes para GitHub Copilot

Este archivo define el comportamiento esperado de la IA en este repositorio.

GymTrack utiliza SETUP.md como documentación viva del estado real del proyecto.
Cada vez que se realicen cambios relevantes en el código, también debe actualizarse SETUP.md.

Este archivo actúa como un "hook lógico" para mantener consistencia entre código y documentación.


# Objetivo del proyecto

GymTrack es un MVP de app móvil para registrar entrenamientos de gimnasio de forma rápida, simple y fiable.

Prioridades:

1. rapidez de uso
2. simplicidad
3. arquitectura clara
4. código mantenible
5. evitar sobreingeniería

El objetivo principal es registrar entrenamientos reales de forma eficiente, no crear una red social ni un sistema complejo.


# Stack actual

React Native
Expo
TypeScript (strict)
Context API
useReducer
AsyncStorage (solo versión local)
In-memory store (Expo Snack)

NO usar Redux.
NO añadir librerías innecesarias.


# Estado actual del proyecto (v1.1)

Características implementadas:

- soporte multi-rutina
- 3 rutinas completas
- 5 días por rutina
- 25+ ejercicios por rutina
- registro serie por serie
- historial de entrenamientos
- detalle de sesiones
- notas por ejercicio
- cardio opcional
- parsers de series
- arquitectura basada en Context API
- UI optimizada para entrada rápida


# Flujo principal de la app

HomeScreen
→ seleccionar rutina activa
→ empezar entrenamiento
→ seleccionar día
→ registrar ejercicios
→ guardar sesión
→ consultar historial
→ ver detalle de entrenamiento


# Sistema multi-rutina

El estado global contiene:

WorkoutRoutine[]
activeRoutineId
WorkoutLog[]

Cada rutina contiene:

5 días
lista de ejercicios
targetSets
targetReps

Ejemplo de targetReps:

4x6-8
3x10-12
5x5


# Sistema de registro v1.1 (serie por serie)

Las series se introducen individualmente.

Ejemplo de input:

60x8
65x6
70x4

Cada serie se convierte en:

ParsedSet

type ParsedSet = {
  weight: number
  reps: number
}

ExerciseInputField gestiona:

addedSets
targetSets
validación del formato
contador visual de progreso

Reglas:

permitir decimales
22.5x10 es válido

permitir finalizar ejercicio antes de completar todas las series

permitir borrar la última serie añadida

mostrar contador:
Series 2/4

no bloquear el flujo si el usuario no completa todas las series


# Parsers

Ubicación:

lib/parsers.ts

Funciones:

parseSeriesString
parseCardioString

parseSeriesString convierte:

60x8
22.5x10

en:

ParsedSet[]

rawInput también se conserva.


# Cardio opcional

Formato esperado:

Cinta: 22.5mins, 11.5kmh
Bici: 20mins, 120watts
Elíptica: 25mins, ritmo medio

El cardio:

es opcional
se guarda como rawInput
puede parsearse opcionalmente
no debe bloquear guardado si el formato no es perfecto


# Arquitectura actual

features/workout
contiene:

WorkoutContext
HomeScreen
WorkoutLogScreen
AllHistoryScreen
DetailScreen

estado global:

Context API
useReducer

hooks:

useWorkout


# Estructura de carpetas relevante

components
componentes reutilizables

features/workout
pantallas principales
estado global


# 🔄 SINCRONIZACIÓN EXPO SNACK (v1.1+) — ⚠️ CRÍTICO

## Archivos sincronizados

```
EXPO_SNACK_SETUP.md        ← Instrucciones solamente
COPY_TO_SNACK.md           ← Código JavaScript completo (v1.1)
```

## 🚨 REGLA CRÍTICA ABSOLUTA

**COPY_TO_SNACK.md DEBE SER ACTUALIZADO INMEDIATAMENTE DESPUÉS DE CADA CAMBIO**

No es una "tarea pendiente" ni "algo que hacer después". Es una obligación.

Cualquier cambio en:
- UI/Estilos
- Funcionalidad
- Estado/lógica
- Colores, temas
- Componentes
- Tipos de datos

**REQUIERE ACTUALIZACIÓN INMEDIATA DE COPY_TO_SNACK.md**

## Casos que requieren sincronización INMEDIATA

1. **Cambios visuales/estéticos**
   - Cambios de color (theme.colors)
   - Cambios de layout
   - Cambios de spacing
   - Cambios de tipografía
   - Cambios en componentes UI (Button, Card, etc.)
   - Cambios en estilos (StyleSheet)

2. **ExerciseInputField.tsx** (CUALQUIER cambio)
   - Nueva prop
   - Nuevo button
   - Cambio de estilos
   - Cambio de lógica
   - Cambio de placeholder
   - Cambio de validación

3. **WorkoutLogScreen.tsx** (CUALQUIER cambio)
   - Estado `exerciseSets`
   - Handlers `handleAddSet`, `handleRemoveLastSet`, `handleFinishExercise`
   - Lógica de guardado
   - Orden de pantallas
   - Headers, títulos
   - Modales

4. **DetailScreen.tsx** (CUALQUIER cambio)
   - Formato de resultados
   - Comparación con anterior
   - Display de notas
   - Colores (verde/naranja)

5. **HistoryScreen.tsx** (CUALQUIER cambio)
   - Agrupación (por semana)
   - Formato de fechas
   - Nombres de días
   - Secciones

6. **HomeScreen.tsx** (CUALQUIER cambio)
   - Nombre de la app
   - Títulos
   - Botones
   - Lógica de selección

7. **lib/theme.ts** (CUALQUIER cambio)
   - Colores
   - Tipografía
   - Spacing

8. **lib/storage.ts** (cambios de funciones)
   - formatDate
   - getWeekNumber
   - Nuevas funciones

9. **data/workoutDays.ts** (agregar/cambiar ejercicios)
   - Cambios en `targetReps`
   - Cambios en `targetSets`
   - Agregar/eliminar rutinas
   - Agregar/eliminar días
   - Agregar/eliminar ejercicios

10. **types/index.ts** (cambios de tipos)
    - Nueva propiedad en `Exercise`
    - Nueva propiedad en `ExerciseLog`
    - Cambios en `WorkoutDay`
    - Cambios en `ParsedSet`

11. **hooks/useWorkout.ts** (cambios de lógica)
    - Nuevos handlers
    - Nuevas funciones auxiliares
    - Cambios en estado

12. **Componentes (Button.tsx, CardioInputField.tsx, etc.)** (CUALQUIER cambio)
    - Cambios de estilos
    - Cambios de props
    - Cambios de lógica

## Procedimiento de actualización

Cuando hagas CUALQUIERA de los cambios de arriba:

1. **Edita el código local** (archivo .tsx o .ts)
   - Verifica que compila sin errores
2. **INMEDIATAMENTE: Abre `COPY_TO_SNACK.md`**
   - Localiza la sección que necesita actualización
   - Reemplaza el código relevante
   - Asegúrate de que todo sigue siendo JavaScript válido (sin TypeScript extras)
3. **Verifica `EXPO_SNACK_SETUP.md`**
   - Si cambió algo functional importante, puede necesitar actualización
   - Comprueba que las referencias sigan siendo válidas
4. **Verifica que el archivo actualizado sea válido**
   - Sin errores de sintaxis
   - Temas importados correctamente
   - Todas las funciones presentes

## Checklist antes de terminar

- [ ] Código compilado localmente sin errores
- [ ] COPY_TO_SNACK.md tiene el código actualizado
- [ ] COPY_TO_SNACK.md es JavaScript válido (no TypeScript)
- [ ] EXPO_SNACK_SETUP.md referencias están OK
- [ ] La aplicación Snack funcionaría con este código

## Por qué es CRÍTICO

- Usuarios sin ambiente local CONFÍAN EN COPY_TO_SNACK.md
- Si no está actualizado, la versión Snack quedará vieja
- Esto causa confusión: "¿Por qué no me funciona esto que vi en SETUP.md?"
- Es la única forma de que usuarios puedan probar los cambios sin clonar el repo
- Una versión "ghosted" de Snack es POR con que nada

## Nota importante

Este archivo (copilot-instructions.md) actúa como "guardián" de la sincronización.
**CADA VEZ que cambies código con implicaciones visuales o funcionales, actualiza COPY_TO_SNACK.md también.**

Es tan importante como el código en sí.

hooks
custom hooks de React

lib
parsers
helpers de storage

types
tipos TypeScript

data
rutinas predefinidas


# Reglas importantes del proyecto

NO introducir:

login
signup
usuarios
backend remoto
sincronización cloud
redux
arquitecturas complejas
abstracciones innecesarias
optimización prematura


# 🔧 Comportamiento esperado de Copilot

## Límite de búsqueda en archivos

Cuando se encuentre el mensaje: `El algoritmo de comparación se detuvo pronto (después de 5000 ms)`

**Acción:**
1. Incrementar automáticamente `maxResults` en búsquedas
2. Si `maxResults` < 1000: utilizar 1000
3. Si `maxResults` >= 1000: utilizar 2000
4. NO preguntar al usuario si continuar o no
5. Completar la operación sin interrumpir el flujo

**Regla:** Este timeout es normal en archivos grandes (COPY_TO_SNACK.md)


## Aplicar cambios directamente

Cuando se modifique un archivo:

**Acción:**
1. Aplicar todos los cambios de forma directa
2. NO preguntar "¿Mantengo estos cambios?"
3. NO solicitar confirmación del usuario
4. Ejecutar la operación hasta completarla
5. Reportar resultado final

**Regla:** Asumir intención clara del usuario y ejecutar sin fricción


# Cuándo actualizar SETUP.md

Actualizar SETUP.md cuando cambie:

estructura de carpetas
tipos TypeScript
modelo de datos
flujo de registro
ExerciseInputField
WorkoutContext
acciones reducer
parsers
estructura multi-rutina

# Skills

para el frontend usa las reglas de diseño definidas en: 
docs/ai-skills/frontend-design.md