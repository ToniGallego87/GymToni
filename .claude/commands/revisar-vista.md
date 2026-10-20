---
description: Revisa a fondo UNA vista, componente o flujo de GymToni que le indiques y propone una versión más limpia e intuitiva sin perder funcionalidad, integrando las propuestas en el ROADMAP. Crítica estricta con rúbrica; no implementa (es decisión de producto).
---

Revisa **a fondo** la vista, componente o flujo de **GymToni** que te indique el usuario y propón una
versión **más limpia e intuitiva**, bajando la complejidad **sin perder ni una funcionalidad**.
Trabaja siempre dentro de `GymToni/`. Es una revisión de **producto**: **no implementes nada** en esta
pasada; el entregable son propuestas integradas en `GymToni/.github/docs/ROADMAP.md`.

Objetivo a revisar (una o varias vistas/componentes/flujos, en cualquier formato): $ARGUMENTS

Si el objetivo está **vacío**, no inventes qué revisar: pregunta al usuario qué vista o elemento
quiere revisar y detente hasta que lo diga.

## Paso 0 — Fija el objetivo y su inventario de funciones

1. **Resuelve el objetivo a archivos reales.** Traduce lo que pide el usuario ("Consulta de detalles
   de esta rutina", "Nueva rutina", un componente, un flujo) al archivo o archivos concretos
   (`features/…`, `components/…`, `app/…`), citando la ruta. Si hay varios candidatos plausibles y no
   está claro cuál, **pregunta** antes de seguir; no revises el que no era.
2. **Lee el objetivo entero** y su contexto: los componentes compartidos que usa, los tokens de estilo
   (`lib/theme.ts`, `components/glassTokens.ts`), `.github/docs/frontend-design.md` (sistema de
   diseño) y `AGENTS.md` (restricciones + reglas de UI). No opines sin haber leído el código.
3. **Haz el inventario de funciones.** Enumera **toda** la funcionalidad y **cada** acción/affordance
   que el objetivo ofrece hoy: botón a botón, gesto a gesto, modal a modal, campo a campo. Este
   inventario es el **contrato**: la regla dura de esta revisión es que la propuesta no puede perder
   nada de aquí. Guárdalo para el auto-chequeo del Paso 3.

## Paso 1 — Recórrelo como el usuario

Recorre el objetivo como el usuario final: qué ve primero, qué toca y en qué orden, cuántos toques
cuesta la acción principal, qué es primario y qué secundario, dónde se satura o se pierde. La
prioridad del proyecto es **velocidad de uso > simplicidad > arquitectura** (AGENTS): optimiza el caso
común.

Si el usuario nombró **varias vistas relacionadas**, evalúa también la **coherencia entre ellas**: la
misma tarea debería resolverse con el mismo patrón en todas (una divergencia entre pantallas hermanas
es, por sí sola, un hallazgo).

## Paso 2 — Crítica estricta (rúbrica: recórrela entera)

> Esta rúbrica es la **fuente única de la "rúbrica visual" de GymToni**. `/revision-app` la reutiliza
> por referencia en su barrido visual (no la copia); si cambias los criterios de aquí, cambian para
> las dos.

Evalúa el objetivo contra **cada** criterio y anota hallazgos **concretos**, cada uno citando
`ruta/archivo.tsx:línea`. No vale "se ve recargado": di **qué** elemento, **dónde** y **por qué**
estorba.

- **Carga cognitiva / saturación:** demasiados elementos compitiendo a la vez, muros de controles,
  chrome que abruma en el primer vistazo.
- **Jerarquía visual:** ¿se distingue la acción principal? ¿Hay dos "héroes" compitiendo? ¿El peso
  visual corresponde a la importancia real de cada cosa?
- **Consistencia:** con las demás pantallas (mismo patrón para la misma tarea) y con el sistema de
  diseño (componentes de `components/`, tokens de `theme.ts`/`glassTokens.ts`; nada de hex sueltos ni
  modales montados a mano en vez de `AppModal`/`ConfirmModal`).
- **Gestos ocultos y affordances ambiguas:** nada tras long-press ni acciones invisibles; si algo se
  puede hacer, tiene que **verse** con su botón e icono (AGENTS). Señala pistas engañosas (algo que
  parece botón y no lo es, dos iconos que significan cosas distintas).
- **Redundancia / duplicación:** dos señales para lo mismo, dos acciones casi idénticas, ajustes que
  nadie usa. Simplificar es a menudo **quitar**.
- **Consultar vs. editar mezclados:** ¿se está enseñando andamiaje de edición cuando el uso común es
  solo consultar? ¿Cabe separar lectura de edición?
- **Fricción:** toques de más, modales innecesarios, scroll dentro de scroll, formularios largos,
  cosas que la app debería recordar por el usuario.
- **Detalle fino:** estados vacíos, feedback al tocar, tamaños de toque, legibilidad y contraste,
  revisado en los **dos temas** (día no es el negativo de noche), uso con una mano.

## Paso 3 — Diseña la versión más limpia (sin perder funciones)

Para cada problema del Paso 2, una **propuesta concreta**. Simplificar aquí significa reorganizar,
**escalonar** (p. ej. modo lectura vs. edición), **fundir** duplicados o **quitar** lo redundante —
nunca amputar una capacidad.

Reglas duras de esta fase:

- **Preserva todo el inventario.** Repasa la lista del Paso 0 y confirma, función por función, que
  cada una sigue presente en la propuesta (reubicada, escalonada o fundida, pero accesible). Si una
  propuesta elimina un elemento, justifica que es **pura redundancia** y di dónde sobrevive la
  capacidad. En la salida declaras explícitamente que no se pierde nada.
- **No añadas fricción al caso común.** Ninguna propuesta puede encarecer la acción más frecuente para
  embellecer una rara (velocidad de uso manda).
- **Respeta las restricciones** de `AGENTS.md`: **no** login, **no** backend/cloud, **no** Redux, **no**
  librerías UI externas, nada de rediseñar desde cero la identidad glass/gradientes (es evolución, no
  reinicio). Lo que las viole no entra: va a "Descartado por restricciones del proyecto" del ROADMAP,
  explicando por qué.

## Paso 4 — Intégralo en el ROADMAP (reutiliza `/roadmap`)

1. Convierte las propuestas en una **lista de tareas**, cada una con su sección tentativa (Mejoras
   visuales y de UX / Funcionalidades a simplificar / Nuevas funcionalidades), su "por qué", el
   archivo (`ruta/archivo.tsx:línea`) que la respalda y un esfuerzo tentativo.
2. **Aplica el comando `/roadmap` con esa lista** (lee `.claude/commands/roadmap.md` y sigue sus pasos
   al pie de la letra: poda, clasificación en las tres secciones, fusión de duplicados, fichas
   homogéneas y orden por impacto). **La lógica del ROADMAP vive ahí; no la repitas aquí.**
3. Esto **no** es una auditoría completa de la app: **no toques** la línea "Última revisión completa:
   AAAA-MM-DD" de la cabecera (esa la pone `/revision-app`).
4. **No implementes** ninguna propuesta: son decisiones de producto del usuario. (Si luego pide
   aplicar alguna, eso es otra tarea aparte.)

## Salida

Un mensaje corto en el chat, en español:

1. **Qué revisaste** y con qué archivos (`ruta/archivo.tsx`).
2. **La crítica**: 3–6 hallazgos concretos (el diagnóstico), no genéricos.
3. **La versión más limpia** en prosa breve: la visión de cómo queda, agrupada por vista si hay varias.
4. **Sin perder funciones**: confirma el auto-chequeo del inventario (qué se reubica/funde/quita y
   dónde sigue viva cada capacidad).
5. **Qué le pasó al ROADMAP**: cuántas fichas has borrado por finalizadas/obsoletas, cuántas has
   mantenido y cuántas ha aportado esta revisión, y en qué sección cae cada tarea nueva.

El ROADMAP es el entregable: escríbelo para que el usuario pueda decidir sin volver a leer el código.
