import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DayAccentIcon,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  StretchScrollView,
} from '@components';
import { WorkoutDay, WorkoutRoutine } from '../../types';
import { getDisplayDayName, theme } from '@lib/theme';
import { dayNameText } from '@lib/textStyles';
import { t } from '@lib/i18n';

interface DaySelectorScreenProps {
  routine?: WorkoutRoutine;
  onSelectDay: (day: WorkoutDay) => void;
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
  const days = routine?.days || [];
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

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
        {/* Tocar el día arranca la sesión y continúa la semana en curso. Aquí
            solo se elige el día; mover un entreno a otra semana se hace desde
            su detalle ("Mover a la semana anterior/siguiente"). */}
        {days.map((day) => (
          <Pressable
            key={day.id}
            style={({ pressed }) => [
              styles.dayCard,
              pressed && styles.dayCardPressed,
            ]}
            onPress={() => onSelectDay(day)}
          >
            <View style={styles.dayLeading}>
              <DayAccentIcon emoji={day.emoji} name={day.name} size={40} />
            </View>
            <View style={styles.dayContent}>
              <Text style={styles.dayName}>{getDisplayDayName(day.name)}</Text>
              <Text style={styles.dayMeta}>
                {t('{n} ejercicios', { n: day.exercises.length })}
              </Text>
            </View>
            <Text style={styles.dayBadge}>
              {t('Día')} {day.dayNumber}
            </Text>
          </Pressable>
        ))}

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
    dayLeading: {
      marginRight: 12,
    },
    dayContent: {
      flex: 1,
    },
    // Nombre del día en la fuente display: estilo compartido (lib/textStyles),
    // igual que en Inicio y Cardio.
    dayName: dayNameText(),
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
