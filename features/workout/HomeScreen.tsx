import React, { useState } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useWorkout } from '@hooks/useWorkout';
import { DayCard } from '@components/DayCard';
import { WorkoutDay, WorkoutRoutine } from '@types/index';
import { theme } from '@lib/theme';

interface HomeScreenProps {
  onSelectDay: (day: WorkoutDay) => void;
}

export function HomeScreen({ onSelectDay }: HomeScreenProps) {
  const { state, dispatch } = useWorkout();
  const [showRoutineSelector, setShowRoutineSelector] = useState(false);

  const activeRoutine = state.routines.find(
    (routine: WorkoutRoutine) => routine.id === state.activeRoutineId
  );
  const activeDays = activeRoutine?.days || [];

  const handleSelectRoutine = (routineId: string) => {
    dispatch({ type: 'SET_ACTIVE_ROUTINE', payload: routineId });
    setShowRoutineSelector(false);
  };

  if (showRoutineSelector) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📚 Selecciona una rutina</Text>
          <Text style={styles.subtitle}>Elige cuál deseas trabajar hoy</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.routineListContainer}
          scrollEnabled={true}
        >
          {state.routines.map((routine: WorkoutRoutine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              isActive={routine.id === state.activeRoutineId}
              onPress={() => handleSelectRoutine(routine.id)}
            />
          ))}
        </ScrollView>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setShowRoutineSelector(false)}
        >
          <Text style={styles.backButtonText}>← Volver a los días</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>💪 GymToni</Text>
          <TouchableOpacity
            style={styles.routineButton}
            onPress={() => setShowRoutineSelector(true)}
          >
            <Text style={styles.routineButtonText}>
              {activeRoutine?.name || 'Sin rutina'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          {activeRoutine?.description || 'Tu rutina semanal'}
        </Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.heroIconWrap}>
          <Text style={styles.heroIcon}>🏋️</Text>
        </View>
        <Text style={styles.heroTitle}>Empezar entrenamiento</Text>
        <Text style={styles.heroSubtitle}>Elige una sesión y registra tu progreso de hoy</Text>
      </View>

      <FlatList
        data={activeDays}
        keyExtractor={(day: WorkoutDay) => day.id}
        renderItem={({ item }: { item: WorkoutDay }) => (
          <DayCard
            emoji={item.emoji}
            name={item.name}
            description={item.description}
            onPress={() => onSelectDay(item)}
          />
        )}
        contentContainerStyle={styles.list}
        scrollEnabled={true}
      />
    </SafeAreaView>
  );
}

interface RoutineCardProps {
  routine: WorkoutRoutine;
  isActive: boolean;
  onPress: () => void;
}

function RoutineCard({ routine, isActive, onPress }: RoutineCardProps) {
  return (
    <TouchableOpacity
      style={[styles.routineCard, isActive && styles.routineCardActive]}
      onPress={onPress}
    >
      <View style={styles.routineCardContent}>
        <Text style={styles.routineCardName}>{routine.name}</Text>
        <Text style={styles.routineCardDesc}>{routine.description}</Text>
        <Text style={styles.routineCardDays}>
          {routine.days.length} días de entrenamiento
        </Text>
      </View>
      {isActive && <Text style={styles.routineCardActiveIndicator}>✓ Activa</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  routineButton: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.pill,
    maxWidth: 180,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  routineButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  heroGlow: {
    position: 'absolute',
    top: -30,
    right: -8,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16, 19, 24, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroIcon: {
    fontSize: 30,
  },
  heroTitle: {
    color: theme.colors.darkGray,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: theme.colors.darkGray,
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.72,
    textAlign: 'center',
  },
  list: {
    paddingTop: 0,
    paddingBottom: theme.spacing.xl,
  },
  routineListContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  routineCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.soft,
  },
  routineCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceAlt,
  },
  routineCardContent: {
    flex: 1,
  },
  routineCardName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  routineCardDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  routineCardDays: {
    fontSize: 12,
    color: theme.colors.lightGray,
  },
  routineCardActiveIndicator: {
    fontSize: 13,
    color: theme.colors.primaryLight,
    fontWeight: '800',
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
  },
  backButton: {
    marginHorizontal: theme.spacing.md,
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});

