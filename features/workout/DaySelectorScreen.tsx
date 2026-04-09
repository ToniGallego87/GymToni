import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
} from '@components';
import { WorkoutDay, WorkoutRoutine } from '../../types';
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
  const insets = useSafeAreaInsets();
  const days = routine?.days || [];
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom = Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding = floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + 12,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
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

      <GlassTopBar
        title="Elige la sesión"
        titleElement={(
          <View style={styles.topBarTitleRow}>
            <MaterialCommunityIcons name="calendar-month-outline" size={18} color={theme.colors.text} />
            <Text style={styles.topBarTitleText}>Elige la sesión</Text>
          </View>
        )}
        subtitle="Selecciona el día que vas a registrar"
        topInset={insets.top}
        rightElement={
          !!routine ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{routine.name}</Text>
            </View>
          ) : undefined
        }
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
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
    marginTop: 0,
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
  topBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 24,
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
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 22,
  },
  dayMeta: {
    marginTop: 2,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  dayBadge: {
    color: theme.colors.primaryLight,
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.pill,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    lineHeight: 16,
  },
});
