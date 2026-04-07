# GymTrack — Instrucciones persistentes para GitHub Copilot

Este archivo define el comportamiento esperado de la IA en este repositorio.

GymTrack utiliza SETUP.md como documentación viva del estado real del proyecto.
Cada vez que se realicen cambios relevantes en el código, también debe actualizarse SETUP.md.


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

NO Redux
NO librerías innecesarias


# Arquitectura actual

features/workout
components
hooks
lib
types
data


# ORDEN OBLIGATORIO DE TRABAJO

Cuando se solicite un cambio:

1 modificar código fuente
2 verificar coherencia lógica
3 finalizar tarea


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


# REGISTRO OBLIGATORIO EN UPDATES.md

Después de aplicar mejoras o cambios en el código, reflejarlos también en UPDATES.md.

Cuando el usuario indique que se inicia una nueva versión, crear o actualizar su bloque en UPDATES.md con los apartados:

Nuevas funcionalidades
Cambios

Estilo obligatorio para UPDATES.md:

contenido resumido y directo
usar pocos puntos por apartado (ideal 2 a 4)
evitar detalle técnico largo o repetido
priorizar impacto funcional visible para el usuario


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