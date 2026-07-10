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
  DataScreen,
  DaySelectorScreen,
  DetailScreen,
  HomeScreen,
  NewRoutineScreen,
  QRScannerScreen,
  RoutineDetailScreen,
  WeekAchievementScreen,
  WorkoutProvider,
  WorkoutLogScreen,
  useWorkout,
} from '@features/workout';
import { WhatsNewModal } from '@components';
import type { WeekAchievements } from '@lib/achievements';
import {
  clearAppData,
  getLastSeenVersion,
  getSeedAppData,
  loadAppData,
  saveAppData,
  setLastSeenVersion,
} from '@lib/storage';
import { readJsonFromFile, downloadJsonFile } from '@lib/fileIO';
import { parseRoutineShareLink, SharedRoutineDay } from '@lib/routineShare';
import type { SharedRoutine } from '@lib/routineShare';
import { theme } from '@lib/theme';
import { CHANGELOG, ChangelogEntry } from '@data/changelog';
import {
  WorkoutAppData,
  WorkoutDay,
  WorkoutLog,
  WorkoutRoutine,
} from '../types';

type Screen =
  | { type: 'home' }
  | { type: 'cardio' }
  | { type: 'routine-selector' }
  | { type: 'day-selector' }
  | { type: 'workout-log'; day: WorkoutDay; log?: WorkoutLog }
  | {
      type: 'detail';
      log: WorkoutLog;
      day: WorkoutDay;
      origin: 'home' | 'calendar' | 'cardio';
    }
  | { type: 'calendar' }
  | { type: 'data' }
  | { type: 'new-routine'; initialDays?: SharedRoutineDay[] }
  | { type: 'routine-details'; routine: WorkoutRoutine }
  | { type: 'qr-scanner' }
  | {
      type: 'week-achievement';
      achievements: WeekAchievements;
      routineName?: string;
    };

function AppContent() {
  const { dispatch, state } = useWorkout();
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
          // Primer arranque: sembrar el almacenamiento con los datos de fábrica
          // que el reducer ya muestra, para que las escrituras granulares
          // posteriores tengan base (rutinas + marca de inicialización).
          await saveAppData(getSeedAppData());
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

  // Oculta el splash nativo una vez los datos reales ya están en pantalla.
  useEffect(() => {
    if (hydrated) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [hydrated]);

  // Manejar botón atrás en móvil
  useEffect(() => {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (screen.type === 'home') {
            // Permitir que salga de la app desde la pantalla de inicio
            return false;
          } else {
            // En cualquier otra pantalla, volver a inicio
            setScreen({ type: 'home' });
            return true;
          }
        }
      );

      return () => backHandler.remove();
    }
  }, [screen.type]);

  const activeRoutine = useMemo(
    () =>
      state.routines.find((routine) => routine.id === state.activeRoutineId),
    [state.activeRoutineId, state.routines]
  );

  const activeRoutineLogs = useMemo(
    () => state.logs.filter((log) => log.routineId === state.activeRoutineId),
    [state.activeRoutineId, state.logs]
  );

  const canDeleteCurrentRoutine =
    activeRoutineLogs.length === 0 && state.routines.length > 1;

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

  const handleDeleteCurrentRoutine = () => {
    if (!activeRoutine || !canDeleteCurrentRoutine) {
      return;
    }

    dispatch({ type: 'DELETE_ROUTINE', payload: activeRoutine.id });
    setScreen({ type: 'home' });
  };

  const handleClearData = async () => {
    await clearAppData();
    dispatch({ type: 'CLEAR_DATA' });
    setScreen({ type: 'home' });
  };

  const handleExportData = async () => {
    const payload: WorkoutAppData & { version: number; exportedAt: string } = {
      version: 1,
      exportedAt: new Date().toISOString(),
      routines: state.routines,
      activeRoutineId: state.activeRoutineId,
      logs: state.logs,
    };

    const fileName = `gymbro-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    await downloadJsonFile(fileName, JSON.stringify(payload, null, 2));
  };

  const handleImportData = async () => {
    const raw = await readJsonFromFile();
    const payload = JSON.parse(raw) as Partial<WorkoutAppData>;

    if (!Array.isArray(payload?.routines) || !Array.isArray(payload?.logs)) {
      throw new Error('El fichero no tiene el formato esperado');
    }

    const routinesValid = payload.routines.every(
      (routine) =>
        routine && typeof routine.id === 'string' && Array.isArray(routine.days)
    );
    const logsValid = payload.logs.every(
      (log) => log && typeof log.id === 'string' && Array.isArray(log.exercises)
    );

    if (!routinesValid || !logsValid) {
      throw new Error('El fichero contiene datos con un formato no válido');
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

    setScreen({ type: 'home' });
  };

  return (
    <View style={styles.container}>
      <WhatsNewModal
        visible={whatsNewEntry !== null}
        entry={whatsNewEntry}
        onClose={handleCloseWhatsNew}
      />

      {screen.type === 'routine-selector' && (
        <HomeScreen
          onSelectDay={(day) => setScreen({ type: 'workout-log', day })}
          onSelectLog={(log, day) =>
            setScreen({ type: 'detail', log, day, origin: 'home' })
          }
          onEditLog={(log, day) => setScreen({ type: 'workout-log', day, log })}
          onNavigateHome={() => setScreen({ type: 'home' })}
          onNavigateCardio={() => setScreen({ type: 'cardio' })}
          onNavigateCalendar={() => setScreen({ type: 'calendar' })}
          onNavigateData={() => setScreen({ type: 'data' })}
          onOpenDaySelector={() => {
            if (activeRoutine?.days.length) {
              setScreen({ type: 'day-selector' });
            } else {
              setScreen({ type: 'new-routine' });
            }
          }}
          onOpenRoutineDetails={(routine) =>
            setScreen({ type: 'routine-details', routine })
          }
          onCreateRoutine={() => setScreen({ type: 'new-routine' })}
          onScanRoutineQR={() => setScreen({ type: 'qr-scanner' })}
          onDeleteCurrentRoutine={handleDeleteCurrentRoutine}
          canDeleteCurrentRoutine={canDeleteCurrentRoutine}
          initialShowRoutineSelector={true}
          onCloseRoutineSelector={() => setScreen({ type: 'home' })}
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
          onNavigateData={() => setScreen({ type: 'data' })}
          onOpenDaySelector={() => {
            if (activeRoutine?.days.length) {
              setScreen({ type: 'day-selector' });
            } else {
              setScreen({ type: 'new-routine' });
            }
          }}
          onOpenRoutineSelector={() => setScreen({ type: 'routine-selector' })}
          onOpenRoutineDetails={(routine) =>
            setScreen({ type: 'routine-details', routine })
          }
          onCreateRoutine={() => setScreen({ type: 'new-routine' })}
          onScanRoutineQR={() => setScreen({ type: 'qr-scanner' })}
          onDeleteCurrentRoutine={handleDeleteCurrentRoutine}
          onShowWeekAchievement={(achievements, routineName) =>
            setScreen({ type: 'week-achievement', achievements, routineName })
          }
          canDeleteCurrentRoutine={canDeleteCurrentRoutine}
        />
      )}

      {screen.type === 'cardio' && (
        <CardioScreen
          onSelectLog={(log, day) =>
            setScreen({ type: 'detail', log, day, origin: 'cardio' })
          }
          onNavigateHome={() => setScreen({ type: 'home' })}
          onNavigateCardio={() => setScreen({ type: 'cardio' })}
          onNavigateRoutines={() => setScreen({ type: 'routine-selector' })}
          onNavigateCalendar={() => setScreen({ type: 'calendar' })}
          onNavigateData={() => setScreen({ type: 'data' })}
        />
      )}

      {screen.type === 'day-selector' && (
        <DaySelectorScreen
          routine={activeRoutine}
          onSelectDay={(day) => {
            // Si la rutina activa ya tiene un log de hoy para este día, volver a home
            const today = new Date().toISOString().split('T')[0];
            const hasLogToday = state.logs.some(
              (log) =>
                log.dayId === day.id &&
                log.routineId === state.activeRoutineId &&
                (log.date === today ||
                  new Date(log.createdAt).toISOString().split('T')[0] === today)
            );

            if (hasLogToday) {
              setScreen({ type: 'home' });
            } else {
              setScreen({ type: 'workout-log', day });
            }
          }}
          onBack={() => setScreen({ type: 'home' })}
        />
      )}

      {screen.type === 'workout-log' && (
        <WorkoutLogScreen
          day={screen.day}
          log={screen.log}
          onSave={() => setScreen({ type: 'home' })}
          onBack={() => setScreen({ type: 'home' })}
        />
      )}

      {screen.type === 'detail' && (
        <DetailScreen
          log={screen.log}
          day={screen.day}
          onBack={() =>
            setScreen({
              type:
                screen.origin === 'calendar'
                  ? 'calendar'
                  : screen.origin === 'cardio'
                  ? 'cardio'
                  : 'home',
            })
          }
          onEdit={(log, day) => setScreen({ type: 'workout-log', day, log })}
        />
      )}

      {screen.type === 'calendar' && (
        <CalendarScreen
          onSelectLog={(log, day) =>
            setScreen({ type: 'detail', log, day, origin: 'calendar' })
          }
          onNavigateHome={() => setScreen({ type: 'home' })}
          onNavigateCardio={() => setScreen({ type: 'cardio' })}
          onNavigateRoutines={() => setScreen({ type: 'routine-selector' })}
          onNavigateCalendar={() => setScreen({ type: 'calendar' })}
          onNavigateData={() => setScreen({ type: 'data' })}
        />
      )}

      {screen.type === 'data' && (
        <DataScreen
          onImportData={handleImportData}
          onExportData={handleExportData}
          onClearData={handleClearData}
          onNavigateHome={() => setScreen({ type: 'home' })}
          onNavigateCardio={() => setScreen({ type: 'cardio' })}
          onNavigateRoutines={() => setScreen({ type: 'routine-selector' })}
          onNavigateCalendar={() => setScreen({ type: 'calendar' })}
          onNavigateData={() => setScreen({ type: 'data' })}
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
          onBack={() => setScreen({ type: 'home' })}
          onScanRoutineQR={() => setScreen({ type: 'qr-scanner' })}
          initialDays={screen.initialDays}
        />
      )}

      {screen.type === 'routine-details' && (
        <RoutineDetailScreen
          routine={screen.routine}
          onBack={() => setScreen({ type: 'routine-selector' })}
        />
      )}

      {screen.type === 'qr-scanner' && (
        <QRScannerScreen
          onScanSuccess={(shared: SharedRoutine) =>
            setScreen({ type: 'new-routine', initialDays: shared.days })
          }
          onBack={() => setScreen({ type: 'new-routine' })}
        />
      )}

      {screen.type === 'week-achievement' && (
        <WeekAchievementScreen
          achievements={screen.achievements}
          routineName={screen.routineName}
          onBack={() => setScreen({ type: 'home' })}
        />
      )}
    </View>
  );
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
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
          barStyle="light-content"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
