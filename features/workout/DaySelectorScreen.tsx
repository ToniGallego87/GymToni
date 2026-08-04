import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
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
  // la semana; el botón de abajo permite forzar el inicio de una nueva).
  const dayImpliesNewWeekChoice = (day: WorkoutDay) =>
    daysInCurrentWeek.size > 0 && !daysInCurrentWeek.has(day.id);

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
          // Tocar el día SIEMPRE arranca la sesión (continúa la semana en curso):
          // es el caso común y el gesto no cambia de un día a otro. Para los días
          // que además pueden abrir una semana nueva, se ofrece un botón visible y
          // constante debajo (antes era un panel que solo salía al tocar, y
          // entonces el toque no entraba: mismo gesto, dos resultados distintos).
          const canStartNewWeek = dayImpliesNewWeekChoice(day);
          return (
            <View key={day.id}>
              <Pressable
                style={({ pressed }) => [
                  styles.dayCard,
                  canStartNewWeek && styles.dayCardAttached,
                  pressed && styles.dayCardPressed,
                ]}
                onPress={() => onSelectDay(day, false)}
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

              {canStartNewWeek && (
                <Pressable
                  style={({ pressed }) => [
                    styles.newWeekButton,
                    pressed && styles.dayCardPressed,
                  ]}
                  onPress={() => onSelectDay(day, true)}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'Empezar una nueva semana con este día'
                  )}
                >
                  <MaterialCommunityIcons
                    name="calendar-plus"
                    size={18}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.newWeekButtonText}>
                    {t('Empezar una nueva semana con este día')}
                  </Text>
                </Pressable>
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

const makeStyles = () =>
  StyleSheet.create({
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
    // Cuando el día lleva debajo el botón de "nueva semana", la tarjeta se pega a
    // él (sin margen ni redondeo inferior) para que se lean como un solo bloque.
    dayCardAttached: {
      marginBottom: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
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
      backgroundColor: theme.colors.emoji_blueMuted,
    },
    cardioOnlyBadge: {
      color: theme.colors.emoji_blue,
      backgroundColor: theme.colors.emoji_blueMuted,
    },
    dayCardPressed: {
      opacity: 0.85,
    },
    // Botón secundario, visible y constante, pegado bajo el día: arranca una
    // semana nueva con ese día en vez de continuar la actual.
    newWeekButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 11,
      paddingHorizontal: theme.spacing.md,
      marginBottom: 10,
      borderRadius: theme.borderRadius.md,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.surfaceAlt,
    },
    newWeekButtonText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.primary,
      lineHeight: 17,
    },
    dayLeading: {
      marginRight: 12,
    },
    dayContent: {
      flex: 1,
    },
    // Nombre del día en la fuente display (Anton), igual que en Inicio y Detalle
    // (antes iba en fuente de sistema, la única lista de días que divergía).
    dayName: {
      fontSize: 19,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 27,
      includeFontPadding: false,
      textAlignVertical: 'center',
      transform: [{ translateY: Platform.OS === 'android' ? 3 : 5 }],
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

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
