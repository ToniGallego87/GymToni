import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DayAccentIcon,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  StretchScrollView,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { groupLogsIntoWeekBlocks } from '@lib/weeks';
import { WorkoutDay, WorkoutRoutine } from '../../types';
import { getDisplayDayName, theme } from '@lib/theme';
import { t } from '@lib/i18n';

interface DaySelectorScreenProps {
  routine?: WorkoutRoutine;
  onSelectDay: (day: WorkoutDay, startsNewWeek?: boolean) => void;
  // Registrar una sesión de solo cardio (sin ejercicios de fuerza).
  onSelectCardioOnly?: () => void;
  onBack: () => void;
}

export function DaySelectorScreen({
  routine,
  onSelectDay,
  onSelectCardioOnly,
  onBack,
}: DaySelectorScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const days = routine?.days || [];
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding =
    floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  // Día seleccionado a la espera de confirmar (solo cuando implicaría empezar
  // una nueva semana). El resto de días arrancan la sesión directamente.
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [forceNewWeek, setForceNewWeek] = useState(false);

  // Días ya entrenados en la semana EN CURSO (último bloque). Si la semana ya
  // tiene sesiones y se elige un día distinto, ese día no es "el primero de la
  // semana": puede forzarse a iniciar una nueva.
  const daysInCurrentWeek = useMemo(() => {
    if (!routine) return new Set<string>();
    const dayNumberById = new Map(
      routine.days.map((day) => [day.id, day.dayNumber])
    );
    const routineLogs = state.logs.filter(
      (log) => log.routineId === routine.id
    );
    const blocks = groupLogsIntoWeekBlocks(routineLogs, (log) =>
      dayNumberById.get(log.dayId)
    );
    const blockNumbers = Object.keys(blocks)
      .map(Number)
      .sort((a, b) => a - b);
    const lastBlock = blockNumbers.length
      ? blocks[blockNumbers[blockNumbers.length - 1]]
      : [];
    return new Set(lastBlock.map((log) => log.dayId));
  }, [routine, state.logs]);

  // Un día "no es el primero de la semana" si la semana en curso ya tiene
  // sesiones y este día aún no se ha entrenado en ella (entrenarlo continuaría
  // la semana; el check permite forzar el inicio de una nueva).
  const dayImpliesNewWeekChoice = (day: WorkoutDay) =>
    daysInCurrentWeek.size > 0 && !daysInCurrentWeek.has(day.id);

  const handleDayPress = (day: WorkoutDay) => {
    if (!dayImpliesNewWeekChoice(day)) {
      onSelectDay(day, false);
      return;
    }
    // Alternar la selección para mostrar/ocultar el check bajo el día.
    if (selectedDayId === day.id) {
      setSelectedDayId(null);
    } else {
      setSelectedDayId(day.id);
      setForceNewWeek(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

      <StretchScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + 28,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {days.map((day) => {
          const isSelected = selectedDayId === day.id;
          return (
            <View key={day.id}>
              <Pressable
                style={({ pressed }) => [
                  styles.dayCard,
                  isSelected && styles.dayCardSelected,
                  pressed && styles.dayCardPressed,
                ]}
                onPress={() => handleDayPress(day)}
              >
                <View style={styles.dayLeading}>
                  <DayAccentIcon emoji={day.emoji} name={day.name} size={40} />
                </View>
                <View style={styles.dayContent}>
                  <Text style={styles.dayName}>
                    {getDisplayDayName(day.name)}
                  </Text>
                  <Text style={styles.dayMeta}>
                    {t('{n} ejercicios', { n: day.exercises.length })}
                  </Text>
                </View>
                <Text style={styles.dayBadge}>
                  {t('Día')} {day.dayNumber}
                </Text>
              </Pressable>

              {isSelected && (
                <View style={styles.newWeekPanel}>
                  <Pressable
                    style={styles.newWeekCheckRow}
                    onPress={() => setForceNewWeek((prev) => !prev)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        forceNewWeek && styles.checkboxChecked,
                      ]}
                    >
                      {forceNewWeek && (
                        <MaterialCommunityIcons
                          name="check-bold"
                          size={14}
                          color={theme.colors.onGold}
                        />
                      )}
                    </View>
                    <Text style={styles.newWeekText}>
                      {t('Empezar una nueva semana con este día')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.newWeekStartButton}
                    onPress={() => onSelectDay(day, forceNewWeek)}
                  >
                    <MaterialCommunityIcons
                      name="arrow-right-bold"
                      size={18}
                      color={theme.colors.onGold}
                    />
                    <Text style={styles.newWeekStartText}>
                      {t('Empezar sesión')}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        {!!onSelectCardioOnly && (
          <Pressable
            style={({ pressed }) => [
              styles.dayCard,
              styles.cardioOnlyCard,
              pressed && styles.dayCardPressed,
            ]}
            onPress={onSelectCardioOnly}
          >
            <View style={styles.dayLeading}>
              <View style={styles.cardioOnlyIcon}>
                <MaterialCommunityIcons
                  name="run-fast"
                  size={26}
                  color={theme.colors.emoji_blue}
                />
              </View>
            </View>
            <View style={styles.dayContent}>
              <Text style={styles.dayName}>{t('Solo cardio')}</Text>
              <Text style={styles.dayMeta}>{t('Registra solo tu cardio')}</Text>
            </View>
            <Text style={[styles.dayBadge, styles.cardioOnlyBadge]}>
              {t('Cardio')}
            </Text>
          </Pressable>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Elige la sesión')}
        icon="calendar-month-outline"
        subtitle={t('Selecciona el día que vas a registrar')}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.pill,
  },
  badgeText: {
    color: theme.colors.primaryLight,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
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
  dayCardSelected: {
    borderColor: theme.colors.primaryLine,
    borderWidth: 2,
    marginBottom: 0,
  },
  cardioOnlyCard: {
    borderColor: theme.colors.emoji_blue,
    borderStyle: 'dashed',
  },
  cardioOnlyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.14)',
  },
  cardioOnlyBadge: {
    color: theme.colors.emoji_blue,
    backgroundColor: 'rgba(0, 122, 255, 0.14)',
  },
  dayCardPressed: {
    opacity: 0.85,
  },
  newWeekPanel: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 10,
    gap: 12,
  },
  newWeekCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.primaryLine,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primaryFill,
  },
  newWeekText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 19,
  },
  newWeekStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryFill,
  },
  newWeekStartText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.onGold,
  },
  dayLeading: {
    marginRight: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    fontSize: 14,
    fontWeight: '800',
    overflow: 'hidden',
    lineHeight: 18,
  },
});
