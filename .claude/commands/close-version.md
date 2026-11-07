---
description: Cierra una versión de GymBro de principio a fin con el subagente close-version (sube versión en los cinco sitios, UPDATES.md, commit y push, changelog para el usuario, APK y SQL de app_releases). Argumento opcional: el número de versión, p. ej. 1.4.0.
argument-hint: "[X.Y.Z]"
---

Lanza el subagente `close-version` (definido en `.claude/agents/close-version.agent.md`) con la
herramienta Agent para cerrar una versión de GymToni. No hagas el cierre tú mismo: todo el proceso
está escrito en ese agente y es la fuente única.

Versión indicada por el usuario (puede estar vacía): $ARGUMENTS

- Si viene una versión, pásasela al agente tal cual: "Cierra la versión $ARGUMENTS".
- Si está vacía, pídele al agente que deduzca la siguiente versión a partir del estado del repo
  y de la sección "## Sin publicar" de UPDATES.md, y que pregunte solo si no puede deducirla.

Cuando el agente termine, transmite al usuario lo importante de su informe: la versión cerrada,
el changelog para el usuario final, si se generó e instaló la APK y la query SQL de `app_releases`.
