import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, StatusBar, StyleSheet, View } from 'react-native';
// expo-notifications does not support web; load it only on native platforms
const Notifications: typeof import('expo-notifications') | null =
  Platform.OS !== 'web' ? require('expo-notifications') : null;
import {
  CalendarScreen,
  DataScreen,
  DaySelectorScreen,
  DetailScreen,
  HomeScreen,
  NewRoutineScreen,
  RoutineDetailScreen,
  WorkoutProvider,
  WorkoutLogScreen,
  useWorkout,
} from '@features/workout';
import { clearAppData, loadAppData, saveAppData } from '@lib/storage';
import { readJsonFromFile, downloadJsonFile } from '@lib/fileIO';
import { theme } from '@lib/theme';
import { WorkoutAppData, WorkoutDay, WorkoutLog, WorkoutRoutine } from '../types';

type Screen =
  | { type: 'home' }
  | { type: 'routine-selector' }
  | { type: 'day-selector' }
  | { type: 'workout-log'; day: WorkoutDay; log?: WorkoutLog }
  | { type: 'detail'; log: WorkoutLog; day: WorkoutDay; origin: 'home' | 'calendar' }
  | { type: 'calendar' }
  | { type: 'data' }
  | { type: 'new-routine' }
  | { type: 'routine-details'; routine: WorkoutRoutine };

function AppContent() {
  const { dispatch, state } = useWorkout();
  const [screen, setScreen] = useState<Screen>({ type: 'home' });
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateState = async () => {
      try {
        const savedData = await loadAppData();
        if (savedData && isMounted) {
          dispatch({ type: 'SET_APP_DATA', payload: savedData });
        }
      } catch (error) {
        console.error('Error loading app data:', error);
      } finally {
        if (isMounted) {
          setHasHydrated(true);
        }
      }
    };

    hydrateState();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!hasHydrated) return;

    // Debounce: agrupa ráfagas de cambios (p. ej. añadir varias series seguidas)
    // en una sola escritura a almacenamiento.
    const handle = setTimeout(() => {
      saveAppData({
        routines: state.routines,
        activeRoutineId: state.activeRoutineId,
        logs: state.logs,
      }).catch(error => {
        console.error('Error saving app data:', error);
      });
    }, 500);

    return () => clearTimeout(handle);
  }, [hasHydrated, state.activeRoutineId, state.logs, state.routines]);

  // Manejar botón atrás en móvil
  useEffect(() => {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (screen.type === 'home') {
          // Permitir que salga de la app desde la pantalla de inicio
          return false;
        } else {
          // En cualquier otra pantalla, volver a inicio
          setScreen({ type: 'home' });
          return true;
        }
      });

      return () => backHandler.remove();
    }
  }, [screen.type]);

  const activeRoutine = useMemo(
    () => state.routines.find(routine => routine.id === state.activeRoutineId),
    [state.activeRoutineId, state.routines]
  );

  const activeRoutineLogs = useMemo(
    () => state.logs.filter(log => log.routineId === state.activeRoutineId),
    [state.activeRoutineId, state.logs]
  );

  const canDeleteCurrentRoutine = !!activeRoutine?.isCustom
    && activeRoutineLogs.length === 0
    && state.routines.length > 1;

  const openWorkoutFromNotificationData = (data: Record<string, unknown> | undefined) => {
    if (!data || data.source !== 'rest-timer') return;

    const dayId = typeof data.dayId === 'string' ? data.dayId : undefined;
    const routineId = typeof data.routineId === 'string' ? data.routineId : undefined;

    if (routineId && routineId !== state.activeRoutineId) {
      const exists = state.routines.some(routine => routine.id === routineId);
      if (exists) {
        dispatch({ type: 'SET_ACTIVE_ROUTINE', payload: routineId });
      }
    }

    const routineCandidates = routineId
      ? state.routines.filter(routine => routine.id === routineId)
      : state.routines;

    const dayFromNotification = routineCandidates
      .flatMap(routine => routine.days)
      .find(day => day.id === dayId);

    if (dayFromNotification) {
      setScreen({ type: 'workout-log', day: dayFromNotification });
      return;
    }

    const fallbackRoutine = state.routines.find(routine => routine.id === state.activeRoutineId)
      || state.routines[0];
    const fallbackDay = fallbackRoutine?.days?.[0];

    if (fallbackDay) {
      setScreen({ type: 'workout-log', day: fallbackDay });
    } else {
      setScreen({ type: 'home' });
    }
  };

  useEffect(() => {
    if (!Notifications) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openWorkoutFromNotificationData(response.notification.request.content.data as Record<string, unknown>);
    });

    const consumeInitialNotificationTap = async () => {
      try {
        const response = await Notifications!.getLastNotificationResponseAsync();
        if (response) {
          openWorkoutFromNotificationData(response.notification.request.content.data as Record<string, unknown>);
        }
      } catch (error) {
        console.error('Error reading notification response:', error);
      }
    };

    consumeInitialNotificationTap();

    return () => subscription.remove();
  }, [dispatch, state.activeRoutineId, state.routines]);

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

    const fileName = `gymtrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    await downloadJsonFile(fileName, JSON.stringify(payload, null, 2));
  };

  const handleImportData = async () => {
    const raw = await readJsonFromFile();
    const payload = JSON.parse(raw) as Partial<WorkoutAppData>;

    if (!Array.isArray(payload?.routines) || !Array.isArray(payload?.logs)) {
      throw new Error('El fichero no tiene el formato esperado');
    }

    const routinesValid = payload.routines.every(
      routine => routine && typeof routine.id === 'string' && Array.isArray(routine.days)
    );
    const logsValid = payload.logs.every(
      log => log && typeof log.id === 'string' && Array.isArray(log.exercises)
    );

    if (!routinesValid || !logsValid) {
      throw new Error('El fichero contiene datos con un formato no válido');
    }

    const activeRoutineId = payload.activeRoutineId
      || payload.routines.find(routine => routine.isActive)?.id
      || payload.routines[0]?.id;

    dispatch({
      type: 'SET_APP_DATA',
      payload: {
        routines: payload.routines,
        activeRoutineId,
        logs: payload.logs,
      },
    });

    setScreen({ type: 'home' });
  };

  return (
    <View style={styles.container}>
      {screen.type === 'routine-selector' && (
        <HomeScreen
          onSelectDay={day => setScreen({ type: 'workout-log', day })}
          onSelectLog={(log, day) => setScreen({ type: 'detail', log, day, origin: 'home' })}
          onEditLog={(log, day) => setScreen({ type: 'workout-log', day, log })}
          onNavigateHome={() => setScreen({ type: 'home' })}
          onNavigateCalendar={() => setScreen({ type: 'calendar' })}
          onNavigateData={() => setScreen({ type: 'data' })}
          onOpenDaySelector={() => {
            if (activeRoutine?.days.length) {
              setScreen({ type: 'day-selector' });
            } else {
              setScreen({ type: 'new-routine' });
            }
          }}
          onOpenRoutineDetails={routine => setScreen({ type: 'routine-details', routine })}
          onCreateRoutine={() => setScreen({ type: 'new-routine' })}
          onDeleteCurrentRoutine={handleDeleteCurrentRoutine}
          canDeleteCurrentRoutine={canDeleteCurrentRoutine}
          initialShowRoutineSelector={true}
          onCloseRoutineSelector={() => setScreen({ type: 'home' })}
        />
      )}

      {screen.type === 'home' && (
        <HomeScreen
          onSelectDay={day => setScreen({ type: 'workout-log', day })}
          onSelectLog={(log, day) => setScreen({ type: 'detail', log, day, origin: 'home' })}
          onEditLog={(log, day) => setScreen({ type: 'workout-log', day, log })}
          onNavigateHome={() => setScreen({ type: 'home' })}
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
          onOpenRoutineDetails={routine => setScreen({ type: 'routine-details', routine })}
          onCreateRoutine={() => setScreen({ type: 'new-routine' })}
          onDeleteCurrentRoutine={handleDeleteCurrentRoutine}
          canDeleteCurrentRoutine={canDeleteCurrentRoutine}
        />
      )}

      {screen.type === 'day-selector' && (
        <DaySelectorScreen
          routine={activeRoutine}
          onSelectDay={day => {
            // Si la rutina activa ya tiene un log de hoy para este día, volver a home
            const today = new Date().toISOString().split('T')[0];
            const hasLogToday = state.logs.some(
              log => log.dayId === day.id && 
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
          onSave={() => setScreen({ type: 'home' })}
          onBack={() => setScreen({ type: 'home' })}
        />
      )}

      {screen.type === 'detail' && (
        <DetailScreen
          log={screen.log}
          day={screen.day}
          onBack={() => setScreen({ type: screen.origin === 'calendar' ? 'calendar' : 'home' })}
          onEdit={(log, day) => setScreen({ type: 'workout-log', day, log })}
        />
      )}

      {screen.type === 'calendar' && (
        <CalendarScreen
          onSelectLog={(log, day) => setScreen({ type: 'detail', log, day, origin: 'calendar' })}
          onNavigateHome={() => setScreen({ type: 'home' })}
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
          onNavigateRoutines={() => setScreen({ type: 'routine-selector' })}
          onNavigateCalendar={() => setScreen({ type: 'calendar' })}
          onNavigateData={() => setScreen({ type: 'data' })}
        />
      )}

      {screen.type === 'new-routine' && (
        <NewRoutineScreen
          existingRoutineCount={state.routines.length}
          onCreateRoutine={handleCreateRoutine}
          onBack={() => setScreen({ type: 'home' })}
        />
      )}

      {screen.type === 'routine-details' && (
        <RoutineDetailScreen
          routine={screen.routine}
          onBack={() => setScreen({ type: 'routine-selector' })}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <WorkoutProvider>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppContent />
    </WorkoutProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
