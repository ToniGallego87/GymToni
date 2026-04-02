import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { WorkoutDay, WorkoutRoutine } from '@types/index';
import { getDisplayDayName, theme } from '@lib/theme';

interface DaySelectorScreenProps {
  routine?: WorkoutRoutine;
  onSelectDay: (day: WorkoutDay) => void;
  onBack: () => void;
}

export function DaySelectorScreen({
  routine,
  onSelectDay,
  onBack,
}: DaySelectorScreenProps) {
  const days = routine?.days || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>📅 Elige la sesión</Text>
          {!!routine && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{routine.name}</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>Selecciona el día que vas a registrar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {days.map(day => (
          <Pressable
            key={day.id}
            style={({ pressed }) => [styles.dayCard, pressed && styles.dayCardPressed]}
            onPress={() => onSelectDay(day)}
          >
            <View style={styles.dayLeading}>
              <Text style={styles.dayEmoji}>{day.emoji}</Text>
            </View>
            <View style={styles.dayContent}>
              <Text style={styles.dayName}>{getDisplayDayName(day.name)}</Text>
              <Text style={styles.dayMeta}>{day.exercises.length} ejercicios</Text>
            </View>
            <Text style={styles.dayBadge}>Día {day.dayNumber}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Volver</Text>
      </Pressable>
    </SafeAreaView>
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
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
  },
  subtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  badge: {
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
  },
  badgeText: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  dayCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadow.soft,
  },
  dayCardPressed: {
    opacity: 0.85,
  },
  dayLeading: {
    marginRight: 12,
  },
  dayEmoji: {
    fontSize: 24,
  },
  dayContent: {
    flex: 1,
  },
  dayName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  dayMeta: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  dayBadge: {
    color: theme.colors.primaryLight,
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.pill,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
  },
  backButton: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});
