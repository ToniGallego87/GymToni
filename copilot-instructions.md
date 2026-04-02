# GymTrack — Instrucciones persistentes para GitHub Copilot

Este archivo define el comportamiento esperado de la IA en este repositorio.

GymTrack utiliza SETUP.md como documentación viva del estado real del proyecto.
Cada vez que se realicen cambios relevantes en el código, también debe actualizarse SETUP.md.


# PRINCIPIO FUNDAMENTAL

El código fuente es la única fuente de verdad.

COPY_TO_SNACK.md es un artefacto derivado exclusivamente para permitir ejecución inmediata en Expo Snack.

Nunca es el origen de cambios.


# Objetivo del proyecto

GymTrack es un MVP de app móvil para registrar entrenamientos de gimnasio de forma rápida, simple y fiable.

Prioridades:

1 rapidez de uso
2 simplicidad
3 arquitectura clara
4 código mantenible
5 evitar sobreingeniería

El objetivo principal es registrar entrenamientos reales de forma eficiente.


# Stack actual

React Native
Expo
TypeScript strict
Context API
useReducer
AsyncStorage local
In-memory store para Snack

NO Redux
NO librerías innecesarias


# Arquitectura actual

features/workout
components
hooks
lib
types
data


# SINCRONIZACIÓN EXPO SNACK

Archivos implicados:

COPY_TO_SNACK.md
EXPO_SNACK_SETUP.md


# FUENTE DE VERDAD DEL CÓDIGO (PRIORIDAD ABSOLUTA)

Los cambios funcionales SIEMPRE comienzan en el código fuente.

Archivos fuente incluyen:

features/*
components/*
hooks/*
lib/*
types/*
data/*
App.tsx


COPY_TO_SNACK.md es una representación sincronizada en JavaScript.

Nunca implementar lógica directamente en COPY_TO_SNACK.md.


# ORDEN OBLIGATORIO DE TRABAJO

Cuando se solicite un cambio:

1 modificar código fuente
2 verificar coherencia lógica
3 actualizar COPY_TO_SNACK.md
4 verificar equivalencia funcional
5 finalizar tarea

Si falta el paso 3 la tarea no está completa.


# PROHIBIDO

implementar features solo en COPY_TO_SNACK.md
corregir bugs solo en COPY_TO_SNACK.md
añadir lógica solo en COPY_TO_SNACK.md
añadir handlers solo en COPY_TO_SNACK.md
modificar estado solo en COPY_TO_SNACK.md
crear divergencias entre source y Snack


# COPY_TO_SNACK.md ES

una representación ejecutable
una copia funcional
un bundle JS equivalente
una vista sincronizada


# COPY_TO_SNACK.md NO ES

fuente de verdad
archivo principal de desarrollo
lugar donde introducir cambios primero


# DETECCIÓN AUTOMÁTICA DE DESINCRONIZACIÓN

si un cambio afecta:

props
estado
reducers
context
hooks
tipos
componentes
parsers
theme
storage
pantallas

entonces COPY_TO_SNACK.md debe actualizarse.


# TRANSFORMACIÓN TYPESCRIPT → JAVASCRIPT

COPY_TO_SNACK.md debe mantenerse en JavaScript válido.

reglas:

eliminar tipos
eliminar interfaces
eliminar generics
mantener nombres de funciones
mantener estructura lógica
no simplificar comportamiento
no eliminar validaciones


# SINCRONIZACIÓN OBLIGATORIA

sincronizar después de modificar:

ExerciseInputField
WorkoutLogScreen
DetailScreen
HistoryScreen
HomeScreen
WorkoutContext
useWorkout
theme
storage
parsers
types
workoutDays
componentes reutilizables


# CHECKLIST OBLIGATORIO

antes de terminar:

el cambio existe en código fuente
el cambio existe en COPY_TO_SNACK.md
no existen divergencias funcionales
nombres de props coinciden
estructura de estado coincide
reducers coinciden
context coincide
Snack ejecutaría correctamente


# COMPORTAMIENTO ESPERADO DE COPILOT

cuando se modifique código:

aplicar cambios directamente
no pedir confirmación
no dividir la tarea en múltiples respuestas
no dejar sincronización pendiente
no sugerir hacerlo manualmente

ejecutar tarea completa hasta finalizar


# CUÁNDO ACTUALIZAR SETUP.md

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


# RESTRICCIONES DEL PROYECTO

NO añadir:

login
signup
usuarios
backend remoto
sincronización cloud
redux
arquitecturas complejas
abstracciones innecesarias


# DETECCIÓN DE ERRORES FRECUENTES

evitar:

invocar funciones undefined
cambiar nombres de props sin actualizar consumidores
cambiar estructura de context sin actualizar hooks
cambiar reducer sin actualizar dispatch usage
eliminar handlers usados en pantallas


# PERFORMANCE RULE

COPY_TO_SNACK.md es un archivo grande.

cuando buscar código:

usar maxResults 2000

no detener búsqueda antes de localizar:

ExerciseInputField
WorkoutContext
reducers
parsers
theme
screens


# RUNTIME SAFETY RULE

antes de finalizar cambios verificar:

todas las funciones usadas existen
todos los handlers existen
context provee todas las funciones consumidas
hooks retornan valores definidos
no invocar propiedades opcionales sin validación
no cambiar shape del estado sin actualizar consumidores


# SKILLS

para frontend usar reglas definidas en:

docs/ai-skills/frontend-design.md