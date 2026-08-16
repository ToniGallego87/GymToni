# SETUP — GymBro

Guía de instalación y estructura del proyecto. Para arquitectura y flujo de
datos ver [ARCHITECTURE.md](../ARCHITECTURE.md); para el sistema visual,
[frontend-design.md](frontend-design.md).

## Requisitos

- Node.js 18+ y npm
- Para APK/emulador: Android Studio (SDK + platform-tools)

## Instalación y ejecución

```bash
npm install

npm run web        # desarrollo en navegador (persistencia en localStorage)
npm start          # Expo Go en el móvil (escanear QR)
npm run android    # emulador/dispositivo Android
```

Comandos de verificación:

```bash
npm run type-check # tsc --noEmit
npm test           # Jest sobre lib/ (15 suites, 181 tests)
npm run format     # Prettier
```

La construcción de la APK release está documentada en [COMMANDS.md](COMMANDS.md).

## Estructura de archivos

```
GymToni/
├── app.json                  ← Config Expo (nombre, versión, iconos, scheme gymbro://)
├── app/
│   ├── index.tsx             ← Entry point (expo-router)
│   ├── App.tsx               ← Raíz: hidratación, navegación por estado, deep links
│   └── +native-intent.ts     ← Redirección de deep links nativos
├── components/               ← UI reutilizable
│   ├── glassTokens.ts        ← Tokens del sistema glass (blur, opacidades)
│   ├── GlassTopBar.tsx       ← Barra superior (título estándar via prop icon)
│   ├── FloatingPrimaryNav.tsx / FloatingBackButton.tsx / FloatingGlassBar.tsx
│   ├── Button.tsx            ← Botón estándar (primary/secondary/danger)
│   ├── AppModal.tsx          ← Carpintería única de los modales de la app
│   ├── ConfirmModal.tsx      ← AppModal + par cancelar/confirmar
│   ├── HeroCard.tsx          ← Tarjeta principal de Inicio
│   ├── BarChart.tsx          ← Gráfica de barras (Inicio y Cardio)
│   ├── SegmentedFilter.tsx   ← Filtro de chips de las gráficas
│   ├── ExerciseInputField.tsx← Registro serie a serie (60x8 → ➕)
│   ├── ExerciseFormRow.tsx   ← Edición de un ejercicio (crear rutina y editar día)
│   ├── CardioInputField.tsx  ← Registro de cardio por disciplina
│   ├── GymIcon.tsx / DayAccentIcon.tsx ← Iconos de grupo muscular por día
│   ├── AchievementPoster.tsx ← Póster SVG de logros semanales (imagen/vídeo)
│   ├── WhatsNewModal.tsx     ← Popup de novedades tras actualizar
│   └── Toast.tsx, GradientFill.tsx, AnimatedCounter.tsx, StretchScrollView.tsx…
├── features/workout/         ← Pantallas + estado global
│   ├── WorkoutContext.tsx    ← Provider + reducer + persistencia granular
│   ├── HomeScreen.tsx        ← Inicio: héroe, progreso semanal e historial
│   ├── RoutineSelectorScreen.tsx ← Rutinas: elegir la que se ve en Inicio, duplicar, borrar
│   ├── ExerciseProgressScreen.tsx ← Progreso por ejercicio: gráfica y récords
│   ├── DaySelectorScreen.tsx / WorkoutLogScreen.tsx  ← Elegir día y registrar
│   ├── DetailScreen.tsx      ← Detalle de una sesión guardada
│   ├── CardioScreen.tsx      ← Sesiones de cardio, kcal, peso corporal
│   ├── CalendarScreen.tsx    ← Vista mensual fuerza/cardio
│   ├── DataScreen.tsx        ← Exportar / importar / limpiar datos
│   ├── CloudScreen.tsx       ← Cuenta y nube: login, perfil público, backup/restore y sync
│   ├── CommunityScreen.tsx   ← Comunidad (pestaña): tablón, feed, buscar usuarios
│   ├── UserProfileScreen.tsx / FollowingScreen.tsx ← Perfil de otro y listas de seguir/seguidores
│   ├── NewRoutineScreen.tsx / RoutineDetailScreen.tsx / QRScannerScreen.tsx
│   └── WeekAchievementScreen.tsx ← Compartir logros semanales
├── hooks/
│   ├── useWorkout.ts         ← Consumer del contexto
│   ├── useCloudSync.ts       ← Sync de fondo (login / foreground) → refresca estado
│   └── useDeferredReady.ts   ← Difiere el contenido pesado de una pantalla un frame
├── lib/                      ← Lógica compartida (ver ARCHITECTURE.md)
│   ├── theme.ts              ← Colores, degradados, tipografía, spacing
│   ├── storage.ts / persistence.ts / db/ ← Persistencia SQLite (nativo) / JSON (web)
│   ├── cloud/               ← Nube: auth.ts, backup.ts, sync.ts (motor push/pull), social.ts (perfiles/seguir/tablón)
│   ├── supabase.ts / supabaseConfig.ts ← Cliente Supabase (clave anon pública)
│   └── parsers.ts, progress.ts, weeks.ts, exerciseProgress.ts, routines.ts,
│       cardio.ts, achievements.ts…
├── lib/__tests__/            ← Tests Jest de la lógica pura
├── types/index.ts            ← Tipos centralizados
├── data/
│   ├── workoutDays.ts / seedData.ts ← Rutinas y logs de fábrica
│   └── changelog.ts          ← Novedades por versión (popup in-app)
├── supabase/
│   ├── schema.sql            ← Esquema de la nube (tablas espejo + RLS)
│   └── social-schema.sql     ← Esquema social (is_public, follows, likes, RLS pública)
├── android/                  ← Proyecto nativo Android (build.gradle: versionCode)
└── assets/                   ← Iconos, wordmark, fuente Anton
```

## Formato de entrada

- **Series**: `{peso}x{reps}`, una a una — `60x8`, `22.5x10`. Botones ➕ añadir,
  ➖ borrar última, ✓ finalizar sin completar.
- **Cardio**: por disciplina en `CardioInputField` (cinta andar/correr, bici,
  elíptica…), con duración, velocidad/pendiente. Se guarda como `rawInput`.
- **Notas**: icono 📝 por ejercicio (modal).

## Persistencia

- **Nativo**: SQLite (`gymbro.db`) con escrituras granulares por acción.
- **Web**: JSON en localStorage con debounce.
- Backup manual: pantalla Datos → Exportar/Importar (JSON con historial de peso corporal).
- **Nube (opcional, desde 0.7.0)**: pantalla Cuenta y nube → cuenta Supabase,
  copia/restauración completa y **sincronización incremental** entre dispositivos
  sobre `sync_outbox` (`lib/cloud/sync.ts`; solo nativo). Plan en
  [backend-design.md](backend-design.md).

Detalle completo del esquema y migraciones en
[ARCHITECTURE.md](../ARCHITECTURE.md#persistencia).

## Troubleshooting

| Problema                   | Solución                                    |
| -------------------------- | ------------------------------------------- |
| "Module not found"         | `rm -rf node_modules && npm install`        |
| Errores TypeScript         | `npm run type-check` y revisar consumidores |
| Cambios nativos no aplican | `npx expo prebuild --clean` y reconstruir   |
| Parches de dependencias    | `npm run postinstall` (patch-package)       |
