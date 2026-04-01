import React from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  SectionList,
} from 'react-native';
import { useWorkout } from '@hooks/useWorkout';
import { formatDate, getWeekNumber } from '@lib/storage';
import { WorkoutLog } from '@types/index';
import { theme } from '@lib/theme';

interface HistoryScreenProps {
  onSelectLog: (log: WorkoutLog) => void;
}

interface LogSection {
  title: string;
  week: number;
  data: WorkoutLog[];
}

export function HistoryScreen({ onSelectLog }: HistoryScreenProps) {
  const { state } = useWorkout();

  const sortedLogs = [...state.logs].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  // Agrupar logs por semana
  const groupedByWeek = sortedLogs.reduce((acc: Record<number, WorkoutLog[]>, log) => {
    const week = getWeekNumber(log.createdAt);
    if (!acc[week]) {
      acc[week] = [];
    }
    acc[week].push(log);
    return acc;
  }, {});

  // Convertir a formato de SectionList
  const sections: LogSection[] = Object.entries(groupedByWeek)
    .sort(([weekA], [weekB]) => parseInt(weekB) - parseInt(weekA))
    .map(([week, logs]) => ({
      title: `Semana ${week}`,
      week: parseInt(week),
      data: logs.sort((a, b) => b.createdAt - a.createdAt),
    }));

  const getDay = (dayId: string) => {
    // Busca el día en todas las rutinas
    for (const routine of state.routines) {
      const day = routine.days.find((d: any) => d.id === dayId);
      if (day) return day;
    }
    return undefined;
  };

  const renderLogItem = ({ item }: { item: WorkoutLog }) => {
    const day = getDay(item.dayId);
    if (!day) return null;

    return (
      <Pressable
        style={({ pressed }: { pressed: boolean }) => [
          styles.logCard,
          pressed && styles.logCardPressed,
        ]}
        onPress={() => onSelectLog(item)}
      >
        <View style={styles.logHeader}>
          <View>
            <Text style={styles.dayName}>
              {day.emoji} {day.name}
            </Text>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.exerciseCount}>
            {item.exercises.length} ejercicios
          </Text>
        </View>

        <View style={styles.logPreview}>
          {item.exercises.slice(0, 2).map((ex, idx) => (
            <Text
              key={idx}
              style={styles.previewText}
              numberOfLines={1}
            >
              • {ex.exerciseName}
            </Text>
          ))}
          {item.exercises.length > 2 && (
            <Text style={styles.moreText}>
              +{item.exercises.length - 2} más
            </Text>
          )}
        </View>

        {item.cardio && (
          <View style={styles.cardioIndicator}>
            <Text style={styles.cardioText}>🏃 Cardio</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section: { title } }: { section: LogSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Historial</Text>
        <Text style={styles.subtitle}>Tus entrenamientos</Text>
      </View>

      {sortedLogs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>Sin entrenamientos</Text>
          <Text style={styles.emptyText}>
            Comienza a registrar tus sesiones de entrenamiento
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderLogItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionHeader: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logCardPressed: {
    opacity: 0.7,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  date: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  exerciseCount: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.darkGray,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  logPreview: {
    marginBottom: 8,
  },
  previewText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginVertical: 2,
  },
  moreText: {
    fontSize: 11,
    color: theme.colors.lightGray,
    fontStyle: 'italic',
    marginTop: 4,
  },
  cardioIndicator: {
    backgroundColor: theme.colors.darkGray,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  cardioText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
