import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
// expo-notifications does not support web; load it only on native platforms
const Notifications: typeof import('expo-notifications') | null =
  Platform.OS !== 'web' ? require('expo-notifications') : null;
import {
  CalendarScreen,
  CardioScreen,
  CloudScreen,
  CommunityScreen,
  UserProfileScreen,
  DataScreen,
  DaySelectorScreen,
  DetailScreen,
  ExerciseProgressScreen,
  HomeScreen,
  NewRoutineScreen,
  ProfileScreen,
  QRScannerScreen,
  RoutineDetailScreen,
  RoutineSelectorScreen,
  SettingsScreen,
  WeekAchievementScreen,
  WorkoutProvider,
  WorkoutLogScreen,
  useWorkout,
} from '@features/workout';
import { WhatsNewModal, ThemeRevealOverlay } from '@components';
import type { WeekAchievements } from '@lib/achievements';
import { CARDIO_ONLY_DAY } from '@lib/cardio';
import type { WeightSegment } from '@lib/cardio';
import {
  clearAppData,
  getCardioWeightHistory,
  getLastSeenVersion,
  getSeedAppData,
  getSeedCardioWeightHistory,
  isValidWeightSegments,
  loadAppData,
  saveAppData,
  setCardioWeightHistory,
  setLastSeenVersion,
} from '@lib/storage';
import { readJsonFromFile, downloadJsonFile } from '@lib/fileIO';
import { isAutoBackupDue, runAutoBackup } from '@lib/backup';
import { parseRoutineShareLink, SharedRoutineDay } from '@lib/routineShare';
import type { SharedRoutine } from '@lib/routineShare';
import { theme, useThemeVersion } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t, useLanguageVersion } from '@lib/i18n';
import { CHANGELOG, ChangelogEntry } from '@data/changelog';
import { useCloudSync } from '@hooks/useCloudSync';
import {
  WorkoutAppData,
  WorkoutDay,
  WorkoutLog,
  WorkoutRoutine,
} from '../types';

type Screen =
  | { type: 'home' }
  | { type: 'cardio' }
  | { type: 'routine-selector'; origin?: 'home' | 'profile' }
  | { type: 'day-selector' }
  | {
      type: 'workout-log';
      day: WorkoutDay;
      log?: WorkoutLog;
      startsNewWeek?: boolean;
      cardioOnly?: boolean;
      origin?: 'home' | 'calendar' | 'cardio';
    }
  | {
      type: 'detail';
      log: WorkoutLog;
      day: WorkoutDay;
      origin: 'home' | 'calendar' | 'cardio';
    }
  | { type: 'calendar' }
  | { type: 'profile' }
  | { type: 'settings' }
  | { type: 'data' }
  | { type: 'cloud' }
  | { type: 'community' }
  | { type: 'user-profile'; userId: string; name: string }
  | {
      type: 'exercise-progress';
      // Ejercicio preseleccionado al abrir la evolución desde el detalle de un día.
      initialExerciseKey?: string;
      // Detalle al que volver si se llegó desde ahí (si no, se vuelve a Perfil).
      detailReturn?: {
        log: WorkoutLog;
        day: WorkoutDay;
        origin: 'home' | 'calendar' | 'cardio';
      };
    }
  | { type: 'new-routine'; initialDays?: SharedRoutineDay[] }
  | {
      type: 'routine-details';
      routine: WorkoutRoutine;
      origin?: 'home' | 'profile';
    }
  | { type: 'qr-scanner' }
  | {
      type: 'week-achievement';
      achievements: WeekAchievements;
      routineName?: string;
    };

function AppContent() {
  const { dispatch, state } = useWorkout();
  // Sync de fondo con la nube (Fase 3): al iniciar sesión y al volver a primer
  // plano. Refresca el estado si el pull trae cambios de otro dispositivo.
  useCloudSync(dispatch);
  const [screen, setScreen] = useState<Screen>({ type: 'home' });
  // Datos hidratados desde almacenamiento. El splash nativo se mantiene hasta
  // que esto es true, para no pintar primero los datos semilla y saltar luego
  // a los reales (el "carga a trompicones" del arranque).
  const [hydrated, setHydrated] = useState(false);
  const [isFirstInstall, setIsFirstInstall] = useState(false);
  const [whatsNewEntry, setWhatsNewEntry] = useState<ChangelogEntry | null>(
    null
  );

  // Hidratación: carga desde almacenamiento (o migra el JSON legacy). La
  // persistencia de cada cambio la hace el wrapper de dispatch de forma
  // granular (lib/persistence.ts), no un guardado completo periódico.
  useEffect(() => {
    let isMounted = true;

    const hydrateState = async () => {
      try {
        const savedData = await loadAppData();
        if (!isMounted) return;

        if (savedData) {
          dispatch({ type: 'SET_APP_DATA', payload: savedData });
        } else {
          // Primer arranque: sembrar el almacenamiento y reflejar ese seed en
          // el estado. El reducer parte de datos de fábrica (WORKOUT_ROUTINES /
          // INITIAL_LOGS), así que hay que sobrescribirlo con dispatch; si no,
          // en release (seed vacío) la UI seguiría mostrando las rutinas de
          // ejemplo del estado inicial en lugar de arrancar vacía.
          const seed = getSeedAppData();
          await saveAppData(seed);
          dispatch({ type: 'SET_APP_DATA', payload: seed });
          // Peso corporal del backup de dev (web): sin él las kcal del cardio
          // se calcularían con el peso por defecto.
          const seedWeights = getSeedCardioWeightHistory();
          if (seedWeights.length) {
            await setCardioWeightHistory(seedWeights);
          }
          setIsFirstInstall(true);
        }
      } catch (error) {
        console.error('Error loading app data:', error);
      } finally {
        // Siempre marcar hidratado (aunque falle) para no dejar el splash colgado.
        if (isMounted) setHydrated(true);
      }
    };

    hydrateState();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  // Popup de novedades: se muestra la primera vez que se abre la app tras
  // actualizar a una versión con changelog. En una instalación nueva no hay
  // nada que anunciar, así que solo se marca la versión actual como vista.
  useEffect(() => {
    if (!hydrated) return;

    const checkWhatsNew = async () => {
      const currentVersion = Constants.expoConfig?.version;
      if (!currentVersion) return;

      try {
        const lastSeenVersion = await getLastSeenVersion();

        if (lastSeenVersion === currentVersion) return;

        if (lastSeenVersion === null && isFirstInstall) {
          await setLastSeenVersion(currentVersion);
          return;
        }

        const entry = CHANGELOG.find((item) => item.version === currentVersion);
        if (entry) {
          setWhatsNewEntry(entry);
        } else {
          await setLastSeenVersion(currentVersion);
        }
      } catch (error) {
        console.error('Error checking novedades de versión:', error);
      }
    };

    checkWhatsNew();
  }, [hydrated, isFirstInstall]);

  const handleCloseWhatsNew = () => {
    const currentVersion = Constants.expoConfig?.version;
    setWhatsNewEntry(null);
    if (currentVersion) {
      setLastSeenVersion(currentVersion).catch((error) =>
        console.error('Error guardando versión vista:', error)
      );
    }
  };

  // Backup automático local: al abrir la app, si está activado y ha pasado el
  // intervalo (un día), se escribe un backup silencioso en el dispositivo. Sin
  // cloud; solo protege frente a perder el móvil sin haber exportado a mano.
  useEffect(() => {
    if (!hydrated || isFirstInstall) return;
    if (!isAutoBackupDue()) return;
    handleAutoBackup().catch((error) =>
      console.error('Error en backup automático:', error)
    );
    // Solo al arrancar (tras hidratar); el resto de deps son estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isFirstInstall]);

  // Oculta el splash nativo una vez los datos reales ya están en pantalla, pero
  // NO en el mismo tick que se marca `hydrated`: se esperan dos frames para que
  // el primer render con la UI real (incluida la fuente Anton) se pinte y MIDA
  // antes de revelarlo. Si no, en algunos arranques en frío el splash se retiraba
  // sobre un primer frame con las métricas de Anton aún sin asentar y el titular
  // de la HeroCard salía recortado/mal dibujado.
  useEffect(() => {
    if (!hydrated) return;
    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        SplashScreen.hideAsync().catch(() => {});
      });
    });
    return () => cancelAnimationFrame(outer);
  }, [hydrated]);

  // Navegación "atrás" compartida entre el botón físico de Android y el
  // "Volver" en pantalla de cada vista: una sola función por pantalla para
  // que ambos caminos lleven siempre al mismo sitio.
  const goHome = () => setScreen({ type: 'home' });
  const goProfile = () => setScreen({ type: 'profile' });
  const backFromRoutineSelector = (origin?: 'home' | 'profile') =>
    setScreen({ type: origin === 'home' ? 'home' : 'profile' });
  const backFromWorkoutLog = (origin?: 'home' | 'calendar' | 'cardio') =>
    setScreen({ type: origin ?? 'home' });
  const backFromDetail = (origin: 'home' | 'calendar' | 'cardio') =>
    setScreen({
      type:
        origin === 'calendar'
          ? 'calendar'
          : origin === 'cardio'
          ? 'cardio'
          : 'home',
    });
  const backFromRoutineDetails = (origin?: 'home' | 'profile') =>
    setScreen({ type: 'routine-selector', origin });
  const backToNewRoutine = () => setScreen({ type: 'new-routine' });

  // Manejar botón atrás físico en móvil: debe reproducir el mismo destino que
  // el "Volver" en pantalla (arriba), no saltar siempre a Inicio. Antes
  // Configuración/Datos/Progreso volvían a Inicio con el físico pero a Perfil
  // con el botón en pantalla, y un detalle abierto desde Calendario/Cardio
  // ignoraba el origen.
  useEffect(() => {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          switch (screen.type) {
            case 'home':
              // Permitir que salga de la app desde la pantalla de inicio
              return false;
            case 'cardio':
            case 'calendar':
            case 'profile':
            case 'day-selector':
            case 'new-routine':
            case 'week-achievement':
              // Pantallas sin "Volver" propio en pantalla (navegación inferior
              // o destino final de un flujo corto): el físico vuelve a Inicio,
              // igual que antes.
              goHome();
              return true;
            case 'routine-selector':
              backFromRoutineSelector(screen.origin);
              return true;
            case 'workout-log':
              backFromWorkoutLog(screen.origin);
              return true;
            case 'detail':
              backFromDetail(screen.origin);
              return true;
            case 'settings':
            case 'data':
              goProfile();
              return true;
            case 'exercise-progress':
              // Vuelve al detalle si se abrió desde ahí; si no, a Perfil.
              if (screen.detailReturn) {
                setScreen({ type: 'detail', ...screen.detailReturn });
              } else {
                goProfile();
              }
              return true;
            case 'routine-details':
              backFromRoutineDetails(screen.origin);
              return true;
            case 'qr-scanner':
              backToNewRoutine();
              return true;
            default:
              goHome();
              return true;
          }
        }
      );

      return () => backHandler.remove();
    }
  }, [screen]);

  const activeRoutine = useMemo(
    () =>
      state.routines.find((routine) => routine.id === state.activeRoutineId),
    [state.activeRoutineId, state.routines]
  );

  // Rutina que se está mostrando/entrenando: la seleccionada (si existe) o, en
  // su defecto, la activa. "Empezar entrenamiento" opera sobre esta, de modo
  // que se puede entrenar una rutina "preparada" seleccionada aunque no sea la
  // activa (al registrar su primer día pasará a ser la activa).
  const displayedRoutine = useMemo(() => {
    const selected = state.routines.find(
      (routine) => routine.id === state.selectedRoutineId
    );
    return selected ?? activeRoutine;
  }, [state.routines, state.selectedRoutineId, activeRoutine]);

  const openWorkoutFromNotificationData = (
    data: Record<string, unknown> | undefined
  ) => {
    if (!data || data.source !== 'rest-timer') return;

    const dayId = typeof data.dayId === 'string' ? data.dayId : undefined;
    const routineId =
      typeof data.routineId === 'string' ? data.routineId : undefined;

    if (routineId && routineId !== state.activeRoutineId) {
      const exists = state.routines.some((routine) => routine.id === routineId);
      if (exists) {
        dispatch({ type: 'SET_ACTIVE_ROUTINE', payload: routineId });
      }
    }

    const routineCandidates = routineId
      ? state.routines.filter((routine) => routine.id === routineId)
      : state.routines;

    const dayFromNotification = routineCandidates
      .flatMap((routine) => routine.days)
      .find((day) => day.id === dayId);

    if (dayFromNotification) {
      setScreen({ type: 'workout-log', day: dayFromNotification });
      return;
    }

    const fallbackRoutine =
      state.routines.find((routine) => routine.id === state.activeRoutineId) ||
      state.routines[0];
    const fallbackDay = fallbackRoutine?.days?.[0];

    if (fallbackDay) {
      setScreen({ type: 'workout-log', day: fallbackDay });
    } else {
      setScreen({ type: 'home' });
    }
  };

  useEffect(() => {
    if (!Notifications) return;

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        openWorkoutFromNotificationData(
          response.notification.request.content.data as Record<string, unknown>
        );
      }
    );

    const consumeInitialNotificationTap = async () => {
      try {
        const response =
          await Notifications!.getLastNotificationResponseAsync();
        if (response) {
          openWorkoutFromNotificationData(
            response.notification.request.content.data as Record<
              string,
              unknown
            >
          );
        }
      } catch (error) {
        console.error('Error reading notification response:', error);
      }
    };

    consumeInitialNotificationTap();

    return () => subscription.remove();
  }, [dispatch, state.activeRoutineId, state.routines]);

  // Deep link de importación (QR): gymbro://import-routine?data=...
  // Abre Nueva rutina con los días prerrellenados desde el código escaneado.
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const shared = parseRoutineShareLink(url);
      if (shared) {
        setScreen({ type: 'new-routine', initialDays: shared.days });
      }
    };

    Linking.getInitialURL()
      .then(handleUrl)
      .catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) =>
      handleUrl(url)
    );

    return () => subscription.remove();
  }, []);

  const handleCreateRoutine = (routine: WorkoutRoutine) => {
    dispatch({ type: 'ADD_ROUTINE', payload: routine });
    setScreen({ type: 'home' });
  };

  const handleClearData = async () => {
    await clearAppData();
    dispatch({ type: 'CLEAR_DATA' });
    setScreen({ type: 'home' });
  };

  // Arma el JSON del backup (mismo formato que usa import). Incluye el historial
  // de pesos corporales: las kcal del cardio dependen del peso de cada tramo.
  const buildBackupJson = async (): Promise<string> => {
    const cardioWeightHistory = await getCardioWeightHistory();
    const payload: WorkoutAppData & {
      version: number;
      exportedAt: string;
      cardioWeightHistory: WeightSegment[];
    } = {
      version: 2,
      exportedAt: new Date().toISOString(),
      routines: state.routines,
      activeRoutineId: state.activeRoutineId,
      logs: state.logs,
      cardioWeightHistory,
    };
    return JSON.stringify(payload, null, 2);
  };

  const handleExportData = async () => {
    const fileName = `gymbro-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    await downloadJsonFile(fileName, await buildBackupJson());
  };

  // Backup silencioso al almacenamiento del dispositivo. Lo usa tanto el disparo
  // automático (al hidratar, si toca) como el botón "backup ahora" de Datos.
  const handleAutoBackup = async (): Promise<void> => {
    if (state.routines.length === 0 && state.logs.length === 0) return;
    await runAutoBackup(await buildBackupJson());
  };

  const handleImportData = async () => {
    const raw = await readJsonFromFile();
    const payload = JSON.parse(raw) as Partial<WorkoutAppData> & {
      cardioWeightHistory?: unknown;
    };

    if (!Array.isArray(payload?.routines) || !Array.isArray(payload?.logs)) {
      throw new Error(t('El fichero no tiene el formato esperado'));
    }

    const routinesValid = payload.routines.every(
      (routine) =>
        routine && typeof routine.id === 'string' && Array.isArray(routine.days)
    );
    const logsValid = payload.logs.every(
      (log) => log && typeof log.id === 'string' && Array.isArray(log.exercises)
    );

    if (!routinesValid || !logsValid) {
      throw new Error(t('El fichero contiene datos con un formato no válido'));
    }

    const activeRoutineId =
      payload.activeRoutineId ||
      payload.routines.find((routine) => routine.isActive)?.id ||
      payload.routines[0]?.id;

    const importedData: WorkoutAppData = {
      routines: payload.routines,
      activeRoutineId,
      logs: payload.logs,
    };

    dispatch({ type: 'SET_APP_DATA', payload: importedData });
    // SET_APP_DATA no se persiste en el wrapper (es también la acción de
    // hidratación): la importación guarda explícitamente el conjunto completo.
    await saveAppData(importedData);

    // Historial de pesos (backups v2+): sin él las kcal del cardio se
    // calcularían con el peso por defecto. Los backups antiguos no lo traen.
    if (
      isValidWeightSegments(payload.cardioWeightHistory) &&
      payload.cardioWeightHistory.length > 0
    ) {
      await setCardioWeightHistory(payload.cardioWeightHistory);
    }

    setScreen({ type: 'home' });
  };

  // Hasta que termina la hidratación, el reducer aún tiene los datos de fábrica
  // (WORKOUT_ROUTINES / INITIAL_LOGS): pintar las pantallas con ellos hacía que,
  // al retirar el splash, se viera un fogonazo de la rutina demo antes de cargar
  // los datos reales. Mientras no haya datos reales se pinta solo el fondo (el
  // splash lo cubre); el contenido monta ya directamente con los datos del
  // usuario. Todos los hooks están declarados arriba, así que el early-return es
  // seguro (no altera el orden de hooks).
  if (!hydrated) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <WhatsNewModal
        visible={whatsNewEntry !== null}
        entry={whatsNewEntry}
        onClose={handleCloseWhatsNew}
      />

      {screen.type === 'routine-selector' && (
        <RoutineSelectorScreen
          onOpenRoutineDetails={(routine) =>
            setScreen({
              type: 'routine-details',
              routine,
              origin: screen.origin,
            })
          }
          onCreateRoutine={() => setScreen({ type: 'new-routine' })}
          // Volver a la vista desde la que se abrió Rutinas (Fuerza o Perfil).
          onBack={() => backFromRoutineSelector(screen.origin)}
        />
      )}

      {screen.type === 'home' && (
        <HomeScreen
          onSelectDay={(day) => setScreen({ type: 'workout-log', day })}
          onSelectLog={(log, day) =>
            setScreen({ type: 'detail', log, day, origin: 'home' })
          }
          onEditLog={(log, day) => setScreen({ type: 'workout-log', day, log })}
          onNavigateHome={() => setScreen({ type: 'home' })}
          onNavigateCardio={() => setScreen({ type: 'cardio' })}
          onNavigateCalendar={() => setScreen({ type: 'calendar' })}
          onNavigateProfile={() => setScreen({ type: 'profile' })}
          onOpenDaySelector={() => {
            if (displayedRoutine?.days.length) {
              setScreen({ type: 'day-selector' });
            } else {
              setScreen({ type: 'new-routine' });
            }
          }}
          onOpenRoutineSelector={() =>
            setScreen({ type: 'routine-selector', origin: 'home' })
          }
          onCreateRoutine={() => setScreen({ type: 'new-routine' })}
          onShowWeekAchievement={(achievements, routineName) =>
            setScreen({ type: 'week-achievement', achievements, routineName })
          }
        />
      )}

      {screen.type === 'cardio' && (
        <CardioScreen
          onSelectLog={(log, day) =>
            setScreen({ type: 'detail', log, day, origin: 'cardio' })
          }
          onInsertCardioOnly={() =>
            setScreen({
              type: 'workout-log',
              day: CARDIO_ONLY_DAY,
              cardioOnly: true,
              origin: 'cardio',
            })
          }
          onNavigateHome={() => setScreen({ type: 'home' })}
          onNavigateCardio={() => setScreen({ type: 'cardio' })}
          onNavigateCalendar={() => setScreen({ type: 'calendar' })}
          onNavigateProfile={() => setScreen({ type: 'profile' })}
        />
      )}

      {screen.type === 'day-selector' && (
        <DaySelectorScreen
          routine={displayedRoutine}
          onSelectDay={(day, startsNewWeek) => {
            // Si el día ya tiene un log de hoy, WorkoutLogScreen lo detecta solo
            // (getLatestTodayLog) y abre ese registro para seguir metiendo series,
            // igual que la hero "Continúa tu entrenamiento": no hay que volver a
            // Inicio en silencio, eso solo confunde ("¿no ha funcionado el toque?").
            setScreen({ type: 'workout-log', day, startsNewWeek });
          }}
          onSelectCardioOnly={() =>
            setScreen({
              type: 'workout-log',
              day: CARDIO_ONLY_DAY,
              cardioOnly: true,
            })
          }
          onBack={goHome}
        />
      )}

      {screen.type === 'workout-log' && (
        <WorkoutLogScreen
          day={screen.day}
          log={screen.log}
          startsNewWeek={screen.startsNewWeek}
          cardioOnly={screen.cardioOnly}
          onSave={() => backFromWorkoutLog(screen.origin)}
          onBack={() => backFromWorkoutLog(screen.origin)}
        />
      )}

      {screen.type === 'detail' && (
        <DetailScreen
          log={screen.log}
          day={screen.day}
          onBack={() => backFromDetail(screen.origin)}
          onEdit={() =>
            setScreen({
              type: 'workout-log',
              day: screen.day,
              log: screen.log,
              cardioOnly: screen.log.cardioOnly || undefined,
              origin: screen.origin,
            })
          }
          onDelete={() => {
            dispatch({ type: 'DELETE_WORKOUT_LOG', payload: screen.log.id });
            backFromDetail(screen.origin);
          }}
          onOpenExerciseProgress={(exerciseKey) =>
            setScreen({
              type: 'exercise-progress',
              initialExerciseKey: exerciseKey,
              detailReturn: {
                log: screen.log,
                day: screen.day,
                origin: screen.origin,
              },
            })
          }
        />
      )}

      {screen.type === 'calendar' && (
        <CalendarScreen
          onSelectLog={(log, day) =>
            setScreen({ type: 'detail', log, day, origin: 'calendar' })
          }
          onEditCardioOnly={(log) =>
            setScreen({
              type: 'workout-log',
              day: CARDIO_ONLY_DAY,
              log,
              cardioOnly: true,
              origin: 'calendar',
            })
          }
          onNavigateHome={() => setScreen({ type: 'home' })}
          onNavigateCardio={() => setScreen({ type: 'cardio' })}
          onNavigateCalendar={() => setScreen({ type: 'calendar' })}
          onNavigateProfile={() => setScreen({ type: 'profile' })}
        />
      )}

      {screen.type === 'profile' && (
        <ProfileScreen
          onOpenRoutines={() =>
            setScreen({ type: 'routine-selector', origin: 'profile' })
          }
          onOpenExerciseProgress={() =>
            setScreen({ type: 'exercise-progress' })
          }
          onOpenData={() => setScreen({ type: 'data' })}
          onOpenCloud={() => setScreen({ type: 'cloud' })}
          onOpenCommunity={() => setScreen({ type: 'community' })}
          onOpenSettings={() => setScreen({ type: 'settings' })}
          onNavigateHome={() => setScreen({ type: 'home' })}
          onNavigateCardio={() => setScreen({ type: 'cardio' })}
          onNavigateCalendar={() => setScreen({ type: 'calendar' })}
          onNavigateProfile={() => setScreen({ type: 'profile' })}
        />
      )}

      {screen.type === 'settings' && <SettingsScreen onBack={goProfile} />}

      {screen.type === 'cloud' && <CloudScreen onBack={goProfile} />}

      {screen.type === 'community' && (
        <CommunityScreen
          onBack={goProfile}
          onOpenProfile={(userId, name) =>
            setScreen({ type: 'user-profile', userId, name })
          }
        />
      )}

      {screen.type === 'user-profile' && (
        <UserProfileScreen
          userId={screen.userId}
          name={screen.name}
          onBack={() => setScreen({ type: 'community' })}
        />
      )}

      {screen.type === 'exercise-progress' && (
        <ExerciseProgressScreen
          initialExerciseKey={screen.initialExerciseKey}
          onBack={() =>
            screen.detailReturn
              ? setScreen({ type: 'detail', ...screen.detailReturn })
              : goProfile()
          }
        />
      )}

      {screen.type === 'data' && (
        <DataScreen
          onImportData={handleImportData}
          onExportData={handleExportData}
          onBackupNow={handleAutoBackup}
          onClearData={handleClearData}
          onBack={goProfile}
        />
      )}

      {screen.type === 'new-routine' && (
        <NewRoutineScreen
          key={
            screen.initialDays
              ? `import-${screen.initialDays.length}-${
                  screen.initialDays[0]?.title ?? ''
                }`
              : 'blank'
          }
          existingRoutineCount={state.routines.length}
          onCreateRoutine={handleCreateRoutine}
          onBack={goHome}
          onScanRoutineQR={() => setScreen({ type: 'qr-scanner' })}
          initialDays={screen.initialDays}
        />
      )}

      {screen.type === 'routine-details' && (
        <RoutineDetailScreen
          routine={screen.routine}
          onBack={() => backFromRoutineDetails(screen.origin)}
        />
      )}

      {screen.type === 'qr-scanner' && (
        <QRScannerScreen
          onScanSuccess={(shared: SharedRoutine) =>
            setScreen({ type: 'new-routine', initialDays: shared.days })
          }
          onBack={backToNewRoutine}
        />
      )}

      {screen.type === 'week-achievement' && (
        <WeekAchievementScreen
          achievements={screen.achievements}
          routineName={screen.routineName}
          onBack={goHome}
        />
      )}

      {/* Encima de todo (incluidas las barras flotantes): el círculo del cambio
          de tema en caliente. */}
      <ThemeRevealOverlay />
    </View>
  );
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // Suscribe la RAÍZ del árbol al modo de tema: al cambiarlo (setThemeMode) todo
  // el árbol se re-renderiza y cada componente relee sus `styles` vivos (ningún
  // componente está memoizado, así que el re-render cascada llega a todos).
  useThemeVersion();
  // Igual que el tema: al cambiar el idioma en caliente, re-renderiza todo el
  // árbol para que los t() inline y las fechas se repinten sin reiniciar.
  useLanguageVersion();
  const [fontsLoaded] = useFonts({
    Anton: require('../assets/fonts/Anton-Regular.ttf'),
  });

  // El splash nativo se mantiene (preventAutoHide) hasta que AppContent termina
  // de hidratar los datos; allí se llama a SplashScreen.hideAsync(). Así no se
  // oculta solo con las fuentes cargadas, evitando el parpadeo de datos semilla.
  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <WorkoutProvider>
        <StatusBar
          barStyle={
            theme.statusBarStyle === 'light' ? 'light-content' : 'dark-content'
          }
          backgroundColor="transparent"
          translucent
        />
        <View style={styles.container}>
          <AppContent />
        </View>
      </WorkoutProvider>
    </GestureHandlerRootView>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
