import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { WorkoutProvider, useWorkout } from '@features/workout';
import { HomeScreen } from '@features/workout/HomeScreen';
import { WorkoutLogScreen } from '@features/workout/WorkoutLogScreen';
import { HistoryScreen } from '@features/workout/HistoryScreen';
import { DetailScreen } from '@features/workout/DetailScreen';
import { loadLogs, saveLogs } from '@lib/storage';
import { WorkoutDay, WorkoutLog } from '@types/index';

type Screen =
  | { type: 'home' }
  | { type: 'workout-log'; day: WorkoutDay }
  | { type: 'history' }
  | { type: 'detail'; log: WorkoutLog; day: WorkoutDay };

function AppContent() {
  const { dispatch, state } = useWorkout();
  const [screen, setScreen] = useState<Screen>({ type: 'home' });

  // Cargar logs al iniciar
  useEffect(() => {
    const initializeLogs = async () => {
      try {
        const savedLogs = await loadLogs();
        dispatch({ type: 'SET_LOGS', payload: savedLogs });
      } catch (error) {
        console.error('Error loading logs:', error);
      }
    };
    initializeLogs();
  }, [dispatch]);

  // Guardar logs cuando cambien
  useEffect(() => {
    const saveLogs$ = async () => {
      try {
        await saveLogs(state.logs);
      } catch (error) {
        console.error('Error saving logs:', error);
      }
    };
    saveLogs$();
  }, [state.logs]);

  const getCurrentDayForLog = (log: WorkoutLog): WorkoutDay | undefined => {
    return state.days.find(d => d.id === log.dayId);
  };

  return (
    <View style={styles.container}>
      {screen.type === 'home' && (
        <HomeScreen
          onSelectDay={day => setScreen({ type: 'workout-log', day })}
        />
      )}

      {screen.type === 'history' && (
        <HistoryScreen
          onSelectLog={log => {
            const day = getCurrentDayForLog(log);
            if (day) {
              setScreen({ type: 'detail', log, day });
            }
          }}
        />
      )}

      {screen.type === 'workout-log' && (
        <WorkoutLogScreen
          day={screen.day}
          onSave={() => setScreen({ type: 'history' })}
          onBack={() => setScreen({ type: 'home' })}
        />
      )}

      {screen.type === 'detail' && (
        <DetailScreen
          log={screen.log}
          day={screen.day}
          onBack={() => setScreen({ type: 'history' })}
        />
      )}

      {/* Bottom Navigation Tabs */}
      <View style={styles.bottomNav}>
        <BottomNavItem
          emoji="🏠"
          label="Inicio"
          active={screen.type === 'home'}
          onPress={() => setScreen({ type: 'home' })}
        />
        <BottomNavItem
          emoji="📋"
          label="Registrar"
          active={screen.type === 'workout-log'}
          onPress={() => {
            if (screen.type !== 'workout-log') {
              setScreen({ type: 'home' });
            }
          }}
        />
        <BottomNavItem
          emoji="📊"
          label="Historial"
          active={screen.type === 'history' || screen.type === 'detail'}
          onPress={() => setScreen({ type: 'history' })}
        />
      </View>
    </View>
  );
}

interface BottomNavItemProps {
  emoji: string;
  label: string;
  active: boolean;
  onPress: () => void;
}

function BottomNavItem({
  emoji,
  label,
  active,
  onPress,
}: BottomNavItemProps) {
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
      <Text style={styles.navLabel}>{label}</Text>
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
    backgroundColor: '#fafafa',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    opacity: 0.6,
  },
  navItemActive: {
    opacity: 1,
    borderTopWidth: 3,
    borderTopColor: '#6200ee',
  },
  navItemPressed: {
    opacity: 0.4,
  },
  navEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 10,
    color: '#222',
  },
});
