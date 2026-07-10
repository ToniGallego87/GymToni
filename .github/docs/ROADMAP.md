# Roadmap — GymBro

Features futuras fuera del alcance actual. Las restricciones de
[AGENTS.md](../../AGENTS.md) mandan: **no** login, **no** backend/cloud,
**no** Redux, **no** librerías UI externas.

## Ya implementado (histórico del roadmap original)

- ✅ Gráficas de progreso semanal (barras por semana, filtro por día)
- ✅ 1RM estimado (Epley) en `lib/progress.ts`
- ✅ Notificaciones locales (timer de descanso con canal Android propio)
- ✅ Exportar/importar backup JSON (pantalla Datos)
- ✅ Testing (Jest sobre `lib/`, 60 tests)
- ✅ Compartir rutina por QR / texto plano
- ✅ Cardio como experiencia propia (sesiones, kcal, peso corporal)
- ✅ Logros semanales compartibles (imagen y vídeo)
- ✅ Popup de novedades tras actualizar (changelog in-app)

## Ideas candidatas (compatibles con las restricciones)

- **Exportar CSV** además de JSON (para Excel), reutilizando `lib/fileIO.ts`
- **Gráfica por ejercicio**: evolución de peso/1RM de un ejercicio concreto
- **Tabla de PRs**: récords personales por ejercicio
- **Recordatorio de entrenamiento**: notificación local programable por día
- **Duplicar rutina**: crear una rutina nueva a partir de una existente
- **Widget Android** con el estado de la semana en curso

## Descartado por restricciones del proyecto

Autenticación, sincronización cloud, modo coach/atleta, dashboard web e IA:
requieren backend/usuarios, explícitamente fuera del alcance del MVP.
Si algún día se replantea, revisar primero AGENTS.md.
