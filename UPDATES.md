# UPDATES

## Version 0.4.1 - 2026-04-07

### Nuevas funcionalidades
- Resaltado del entrenamiento de hoy y nuevo modal de acciones (editar/eliminar).
- Cronometro de descanso interactivo al añadir series (+30s, eliminar con pulsacion larga, vibracion al finalizar).
- Configuracion del cronometro por rutina integrada en el flujo de registro.

### Cambios
- Mapeo de colores por emoji ampliado y ajuste visual del bloque de cronometro.
- Tipos, estado global y reducer actualizados para guardar la duracion por rutina.
- Calculo de progreso unificado con formula e1RM (Epley) sobre mejor serie.

## Version 0.4.2 - 2026-04-08

### Nuevas funcionalidades
- Cronometro resiliente basado en timestamp de fin: sigue corriendo correctamente aunque la app pase a segundo plano o el movil se bloquee.
- Notificacion local programada al iniciar el cronometro: avisa al usuario cuando el descanso termina aunque la app este cerrada.
- Al pulsar la notificacion de fin de descanso, la app abre directamente la pantalla de entrenamiento del dia correspondiente (incluido inicio en frio de la app).
- Integracion de expo-notifications en configuracion y runtime nativo.
- Splash screen configurada en app.json.

### Cambios
- Vibracion al finalizar el descanso cambiada a tres pulsos seguidos.
- El cronometro desaparece automaticamente cuando el ejercicio alcanza todas sus series objetivo.
- Feedback visual del cronometro al pulsarlo ahora igual que el boton principal de inicio (opacidad + escala).
- Corregida visibilidad del boton Volver en el modal de acciones del entrenamiento de hoy en movil.
- Import condicional de notificaciones para evitar errores en web.
- Version de app actualizada a 0.4.2.
- Dependencias actualizadas: expo-notifications y lockfile regenerado.
- Ajustes de copy en Data: exportar/importar ahora hablan de rutinas y entrenamientos.
- Bloques de Data con acento visual lateral; en Limpiar datos el acento lateral pasa a rojo.
- Tarjetas de rutina, progreso semanal y varios bloques visuales con borde primario mas marcado.
- Separacion entre rutina activa y rutina visualizada en Home para mejorar claridad de estado.
- Ajuste del calculo de mejora semanal para promediar mejoras por dia a partir del ultimo log por dia.
- En detalle de rutina, los dias usan borde lateral por tipo de entrenamiento y el bloque de cronometro se mueve al final de la lista.
- Mejoras visuales en tarjetas de ejercicios/cardio e historial (bordes laterales/acento de color).