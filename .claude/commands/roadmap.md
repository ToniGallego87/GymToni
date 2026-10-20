---
description: Integra una lista de tareas pendientes en el ROADMAP de GymToni siguiendo su lógica de documento vivo (poda, fichas homogéneas, tres secciones, orden por impacto). Fuente única de la lógica del ROADMAP; revision-app la reutiliza.
---

Coge la lista de tareas de abajo y **intégrala en `GymToni/.github/docs/ROADMAP.md`** respetando la
lógica de ese documento. Trabaja siempre dentro de `GymToni/`. No implementes ninguna tarea: el
ROADMAP es una lista de trabajo pendiente, no un plan de ejecución de esta pasada.

Lista de tareas a integrar (una idea por línea o por bloque; puede venir en cualquier formato):

$ARGUMENTS

Si la lista está vacía, no inventes tareas: haz solo la poda (paso 1) y avisa de que no había nada
que integrar.

## Qué es el ROADMAP

Un documento **vivo**: no se crea uno nuevo ni se acumulan informes sueltos. Solo contiene lo que
**queda por hacer**; lo terminado se borra (el historial vive en `UPDATES.md`). Las restricciones de
`AGENTS.md` mandan: **no** login, **no** backend/cloud, **no** Redux, **no** librerías UI externas.
Una tarea que las contradiga no entra al ROADMAP: va (o se queda) en "Descartado por restricciones
del proyecto", explicando por qué.

## Paso 0 — Contexto antes de escribir

- Lee el `ROADMAP.md` actual entero para saber qué hay ya.
- Lee `AGENTS.md` para tener presentes las restricciones.
- Para cada tarea entrante que no traiga `ruta/archivo.tsx:línea`, **búscala en el código** y cita el
  archivo real. Si no consigues citar dónde vive una tarea, es que no está lo bastante pensada:
  intégrala igualmente pero deja el `**Archivos:**` con lo más concreto que hayas encontrado, nunca
  algo genérico inventado.

## Paso 1 — Poda lo que ya hay

Antes de añadir nada, limpia el ROADMAP actual:

- **Borra lo finalizado.** Todo lo marcado `[x]` y cualquier entrada que compruebes que ya está
  hecha. No se mueve a un histórico: **se borra**. Al terminar no puede quedar ni una casilla `[x]`.
- **Mantén lo pendiente** con su intención original. Si una entrada sigue viva pero está mal
  redactada o le faltan datos, reescríbela al formato de abajo en vez de descartarla.
- **Borra lo obsoleto**: propuestas que el código ha dejado sin sentido o que contradicen `AGENTS.md`.
  Si dudas, mantén.
- La sección "Descartado por restricciones del proyecto" se conserva tal cual: es memoria de por qué
  algo no se hace, no trabajo pendiente.

## Paso 2 — Clasifica e integra cada tarea entrante

Para cada tarea de la lista:

1. **Asígnala a su sección** (ver definiciones abajo).
2. **Contrástala con lo que ya hay** en esa sección: si ya está recogida, **funde** las dos en una
   sola ficha mejor en lugar de duplicarla.
3. **Escríbela como ficha** con el formato exacto del paso 3.
4. Dentro de cada sección, **ordena por impacto para el usuario**: lo más valioso arriba. El orden es
   la recomendación.

### Las tres secciones (en este orden)

- `## Mejoras visuales y de UX` — jerarquía visual, consistencia entre pantallas, espaciado,
  contraste y legibilidad, estados vacíos, feedback al tocar, accesibilidad (tamaños de toque, fuente).
  Evolución de la identidad glass/gradientes actual, no rediseño desde cero.
- `## Funcionalidades a simplificar` — fricción sobrante: pasos innecesarios, opciones duplicadas,
  ajustes que nadie usa, flujos con demasiados toques, cosas que debería recordar la app. Incluye lo
  que se puede **quitar**: simplificar es a menudo eliminar.
- `## Nuevas funcionalidades` — ideas que complementan lo que ya existe (no las de otra app distinta)
  y que respetan las restricciones. Ojo con la acumulación: si una idea vieja lleva pasadas ahí sin
  que nadie la toque y ya no aporta, bórrala y dilo en el resumen.

Después de las tres va `## Descartado por restricciones del proyecto`.

## Paso 3 — Formato homogéneo

Todo el documento queda con la misma estructura, sin importar si la entrada es vieja o nueva. Cada
propuesta es una ficha con esta forma exacta:

```markdown
- [ ] **Título corto en negrita** — qué cambia, en una o dos frases.
      **Por qué:** qué gana el usuario con esto.
      **Archivos:** `ruta/archivo.tsx:línea`, `lib/otro.ts`.
      **Esfuerzo:** bajo | medio | alto.
```

Reglas del formato:

- Ninguna ficha sin `Por qué`, `Archivos` y `Esfuerzo`.
- Una sección sin entradas se queda con una línea que lo diga; no la borres.
- La cabecera del documento mantiene el texto de las restricciones de `AGENTS.md`. **No toques** la
  línea "Última revisión completa: AAAA-MM-DD": esa marca una auditoría completa (la pone
  `revision-app`), no una simple integración de tareas.

## Salida

Un mensaje corto en el chat, en español:

1. Cuántas entradas has borrado por finalizadas/obsoletas, cuántas has mantenido y cuántas ha
   aportado esta lista (indicando cuáles se fundieron con entradas existentes).
2. En qué sección ha caído cada tarea nueva.

El ROADMAP es el entregable: escríbelo para que el usuario pueda decidir sin volver a leer el código,
y para que la siguiente pasada encuentre un documento que solo contiene trabajo pendiente.
