import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { theme } from '@lib/theme';
import { WorkoutAppData, WorkoutDay, WorkoutLog, WorkoutRoutine } from '@types/index';

type Screen =
  | { type: 'home' }
  | { type: 'day-selector' }
  | { type: 'workout-log'; day: WorkoutDay }
  | { type: 'detail'; log: WorkoutLog; day: WorkoutDay; origin: 'home' | 'calendar' }
  | { type: 'calendar' }
  | { type: 'data' }
  | { type: 'new-routine' }
  | { type: 'routine-details'; routine: WorkoutRoutine };

async function readJsonFromBrowser(): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('La importación solo está disponible en web');
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/json';
    input.style.display = 'none';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No se seleccionó ningún archivo'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsText(file);
    };

    document.body.appendChild(input);
    input.click();

    setTimeout(() => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    }, 0);
  });
}

async function downloadJsonFile(fileName: string, json: string): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    Alert.alert('No disponible', 'Exporta los datos desde la vista web.');
    return;
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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

    const persistState = async () => {
      try {
        await saveAppData({
          routines: state.routines,
          activeRoutineId: state.activeRoutineId,
          logs: state.logs,
        });
      } catch (error) {
        console.error('Error saving app data:', error);
      }
    };

    persistState();
  }, [hasHydrated, state.activeRoutineId, state.logs, state.routines]);

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
    const raw = await readJsonFromBrowser();
    const payload = JSON.parse(raw) as Partial<WorkoutAppData>;

    if (!Array.isArray(payload?.routines) || !Array.isArray(payload?.logs)) {
      throw new Error('El fichero no tiene el formato esperado');
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

  const showBottomNav = screen.type === 'home'
    || screen.type === 'calendar'
    || screen.type === 'data';

  return (
    <View style={styles.container}>
      {screen.type === 'home' && (
        <HomeScreen
          onSelectDay={day => setScreen({ type: 'workout-log', day })}
          onSelectLog={(log, day) => setScreen({ type: 'detail', log, day, origin: 'home' })}
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
        />
      )}

      {screen.type === 'day-selector' && (
        <DaySelectorScreen
          routine={activeRoutine}
          onSelectDay={day => setScreen({ type: 'workout-log', day })}
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
        />
      )}

      {screen.type === 'calendar' && (
        <CalendarScreen
          onSelectLog={(log, day) => setScreen({ type: 'detail', log, day, origin: 'calendar' })}
          onBack={() => setScreen({ type: 'home' })}
        />
      )}

      {screen.type === 'data' && (
        <DataScreen
          onImportData={handleImportData}
          onExportData={handleExportData}
          onClearData={handleClearData}
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
          onBack={() => setScreen({ type: 'home' })}
        />
      )}

      {showBottomNav && (
        <View style={styles.bottomNav}>
          <BottomNavItem
            emoji="🏠"
            label="Inicio"
            active={screen.type === 'home'}
            onPress={() => setScreen({ type: 'home' })}
          />
          <BottomNavItem
            emoji="📅"
            label="Calendario"
            active={screen.type === 'calendar'}
            onPress={() => setScreen({ type: 'calendar' })}
          />
          <BottomNavItem
            emoji="🗂️"
            label="Datos"
            active={screen.type === 'data'}
            onPress={() => setScreen({ type: 'data' })}
          />
        </View>
      )}
    </View>
  );
}

interface BottomNavItemProps {
  emoji: string;
  label: string;
  active: boolean;
  onPress: () => void;
}

function BottomNavItem({ emoji, label, active, onPress }: BottomNavItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.navItem,
        active && styles.navItemActive,
        pressed && styles.navItemPressed,
      ]}
      onPress={onPress}
    >
      <Text style={styles.navEmoji}>{emoji}</Text>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <WorkoutProvider>
      <AppContent />
    </WorkoutProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    opacity: 0.7,
  },
  navItemActive: {
    opacity: 1,
    borderTopWidth: 3,
    borderTopColor: theme.colors.primary,
  },
  navItemPressed: {
    opacity: 0.5,
  },
  navEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  navLabelActive: {
    color: theme.colors.text,
  },
});
