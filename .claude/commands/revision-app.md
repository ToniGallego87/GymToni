---
description: Auditoría completa de GymToni — propuestas de UI/UX, simplificación y nuevas funcionalidades, más limpieza de código muerto y revisión de la documentación.
---

Haz una revisión completa de **GymToni** (React Native + Expo SDK 51, repo en `GymToni/`).
Trabaja siempre dentro de `GymToni/`. La revisión tiene dos mitades muy distintas y **no debes
mezclarlas**: primero una parte de análisis que **no toca código**, después una parte de limpieza
que sí edita. Argumento adicional del usuario (puede estar vacío, y entonces revisas todo): $ARGUMENTS

El entregable es **`GymToni/.github/docs/ROADMAP.md`**, que es un documento vivo: no se crea uno
nuevo por revisión ni se acumulan informes sueltos. Cada pasada lo limpia y lo reescribe entero.

## Fase 0 — Entender la app antes de opinar

No propongas nada sin haber leído el código. Como mínimo:

- `AGENTS.md` y `.github/docs/` (ROADMAP.md, UPDATES.md, frontend-design.md, COMMANDS.md, SETUP.md).
- Las pantallas reales: `features/workout/` y `app/`.
- Los componentes compartidos de `components/` y los tokens de estilo (`glassTokens.ts`, `lib/theme.ts`).
- La lógica de dominio en `lib/` y `hooks/`.

Recorre la app como si fueras el usuario final: qué ve al abrir, cuántos toques necesita para
registrar una serie, dónde se pierde. Las propuestas deben referirse a pantallas y flujos que
existen de verdad, citando el archivo (`ruta/archivo.tsx:línea`). Nada genérico.

## Fase 1 — Propuestas: limpiar y reescribir el ROADMAP (sin editar código)

El resultado de la revisión va a `GymToni/.github/docs/ROADMAP.md`. **La lógica de cómo se poda,
clasifica, funde y da formato al ROADMAP no vive aquí: vive en el comando `/roadmap`
(`.claude/commands/roadmap.md`), fuente única de esa lógica.** No la repitas.

### Barrido visual (rúbrica de `revisar-vista`)

La parte visual se revisa con la **rúbrica de `revisar-vista`** (`.claude/commands/revisar-vista.md`,
Paso 2), **fuente única de esa rúbrica**: no la repitas aquí. Aplícala a las **vistas principales**
(los flujos que el usuario toca a diario), pero **a menor altura** que una pasada dedicada —esto es un
barrido ancho, no un análisis a fondo de cada pantalla:

- Recorre cada vista principal contra los criterios de la rúbrica (carga cognitiva, jerarquía,
  consistencia, gestos ocultos, redundancia, consultar vs. editar, fricción y detalle fino en los dos
  temas) y anota hallazgos **concretos** citando `ruta/archivo.tsx:línea`. Nada genérico.
- Respeta la **regla dura de no perder funciones**, pero en modo barrido el contrato se relaja a los
  **flujos principales**; el inventario función-por-función queda para la pasada dedicada.
- **A diferencia de `/revisar-vista`, aquí no preguntas** qué revisar: en una auditoría completa el
  alcance lo fijas tú (las vistas principales).
- **Nomina 1–3 vistas** —las peores— para una revisión a fondo con `/revisar-vista`. **No la ejecutes
  tú**: es una pasada aparte que lanza el usuario. Déjalas listadas en el mensaje de salida.

Estos hallazgos visuales **se suman a los de la Fase 0** y entran en la **misma y única** llamada a
`/roadmap` de abajo: no invoques `/roadmap` por vista, ni una vez por el barrido y otra por el resto.

En esta fase:

1. Convierte los hallazgos de la Fase 0 y del barrido visual en una **lista de tareas propuestas**,
   cada una con su sección tentativa, su "por qué" y el archivo (`ruta/archivo.tsx:línea`) que la respalda.
   - Máximo ~6 ideas nuevas bien justificadas por pasada en "Nuevas funcionalidades": prefiero pocas
     y buenas a una lista larga. Ojo con el efecto acumulación.
2. **Aplica el comando `/roadmap` con esa lista** (lee `.claude/commands/roadmap.md` y sigue sus
   pasos al pie de la letra: poda, clasificación en las tres secciones, fusión de duplicados,
   fichas homogéneas y orden por impacto).
3. Como esto **sí es una auditoría completa**, además actualiza en la cabecera del ROADMAP la línea
   "Última revisión completa: AAAA-MM-DD" con la fecha de hoy (esa línea `/roadmap` no la toca).

**Las propuestas son propuestas, no decisiones.** No implementes nada del ROADMAP en esta pasada,
aunque te parezca obvio: son decisiones de producto del usuario.

## Fase 2 — Limpieza y refactor (aquí sí se edita)

Independiente de la Fase 1 y limitada a cambios **sin efecto en el comportamiento**:

- Código muerto: componentes, helpers, tipos, assets y dependencias que ya no usa nadie. Verifica
  con búsqueda que de verdad no se referencian (ojo con `components/index.ts`, imports dinámicos y
  rutas de Expo Router) antes de borrar.
- Redundancias: lógica duplicada entre pantallas, estilos repetidos que deberían salir de los
  tokens, utilidades que hacen lo mismo con dos nombres.
- Refactors que dejen el código más simple y escalable, siguiendo las convenciones que ya existen
  en el repo. No introduzcas librerías ni patrones nuevos.

Reglas de la Fase 2:

- Si un refactor cambia comportamiento o es discutible, **no lo hagas**: anótalo en el ROADMAP
  como propuesta, con el mismo formato de ficha que el resto.
- Al terminar, ejecuta `npm run type-check` y `npm test`. Deben pasar. Si algo falla por tus
  cambios, arréglalo; si ya fallaba antes, dilo pero no lo arregles a la brava.
- No hagas commit ni push. Deja los cambios en el working tree para que el usuario los revise.
- Los cambios que dejes en el working tree deben quedar recogidos en `UPDATES.md` bajo
  `## Sin publicar` (créala si no existe), en el formato que usan las entradas existentes.

## Fase 3 — Documentación

Revisa `AGENTS.md` y `.github/docs/`: incoherencias con el código real, instrucciones obsoletas,
huecos que convendría cubrir. Corrige lo que sea claramente un error de hecho (una ruta que ya no
existe, un script renombrado). Lo opinable — reestructurar, añadir guías nuevas — va al ROADMAP
como propuesta, no lo hagas por tu cuenta.

Si has limpiado algo en la Fase 2 que el ROADMAP tenía como pendiente, tacha esa entrada del
ROADMAP en la misma pasada: no puede quedar pidiendo algo que acabas de hacer.

## Salida final

Un mensaje corto en el chat, en español, con:

1. Qué le ha pasado al ROADMAP: cuántas entradas has borrado por estar finalizadas, cuántas has
   mantenido y cuántas ha aportado esta revisión.
2. Los 3 cambios que recomiendas de verdad hacer primero, y por qué esos.
3. Las 1–3 vistas que **nominas para una pasada a fondo con `/revisar-vista`**, y por qué esas.
4. Qué has limpiado en la Fase 2 (resumen en una línea por bloque) y el resultado de `type-check` y `test`.
5. Qué has tocado de documentación.

El ROADMAP es el entregable importante: escríbelo para que el usuario pueda decidir sin volver a
leer el código, y para que la siguiente pasada encuentre un documento que solo contiene trabajo
pendiente.
