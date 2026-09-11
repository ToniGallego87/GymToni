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
  GradientFill,
  StretchScrollView,
} from '@components';
import { WorkoutDay, WorkoutRoutine } from '../../types';
import { useWorkout } from '@hooks/useWorkout';
import { currentWeekDayState } from '@lib/weeks';
import { exerciseCountText } from '@lib/routines';
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
  const { state } = useWorkout();
  const days = routine?.days || [];
  // Cómo va la semana en curso: la lista deja de ser cinco tarjetas idénticas y
  // dice lo que la app ya sabe —cuáles llevas hechos y cuál toca ahora—, en vez
  // de que el usuario lo recuerde. Misma fuente que la hero de Inicio.
  const { trained, nextDay } = currentWeekDayState(routine, state.logs);
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
        {days.map((day) => {
          const isDone = trained.has(day.id);
          // El día que toca: aro dorado y su ceja lo dice. Es una sugerencia
          // (el primero que falta esta semana), no una imposición: los demás se
          // tocan igual, incluidos los ya hechos —repetir un día es legítimo y
          // abre semana nueva—.
          const isNext = !isDone && day.id === nextDay?.id;

          return (
            <Pressable
              key={day.id}
              style={({ pressed }) => [
                styles.dayCard,
                isNext && styles.dayCardNext,
                isDone && styles.dayCardDone,
                // La tarjeta ya hecha nace apagada, así que su feedback al
                // pulsar tiene que apagarla MÁS: con el `dayCardPressed` normal
                // se aclaraba al tocarla, justo al revés que las demás.
                pressed &&
                  (isDone ? styles.dayCardDonePressed : styles.dayCardPressed),
              ]}
              onPress={() => onSelectDay(day)}
              accessibilityRole="button"
              accessibilityLabel={`${t('Día')} ${
                day.dayNumber
              }. ${getDisplayDayName(day.name)}. ${
                isDone
                  ? t('Ya entrenado esta semana')
                  : isNext
                  ? t('Te toca este')
                  : exerciseCountText(day.exercises.length)
              }`}
            >
              {isNext && <GradientFill accent={theme.colors.primaryLine} />}
              <View style={styles.dayLeading}>
                <DayAccentIcon emoji={day.emoji} name={day.name} size={40} />
              </View>
              <View style={styles.dayContent}>
                {/* El número del día como ceja, igual que en la ficha de la
                    rutina: es la referencia, no el titular. Antes era una píldora
                    dorada a la derecha que pesaba más que el nombre del día y
                    competía con la del nombre de la rutina en la barra. En el
                    día que toca la ceja lo dice, que es el dato que se viene a
                    buscar a esta pantalla. */}
                <Text
                  style={[styles.dayEyebrow, isNext && styles.dayEyebrowNext]}
                >
                  {isNext
                    ? `${t('Te toca')} · ${t('Día')} ${day.dayNumber}`
                    : `${t('Día')} ${day.dayNumber}`}
                </Text>
                <Text style={styles.dayName}>
                  {getDisplayDayName(day.name)}
                </Text>
                {/* Mismo recuento (y mismo singular) que la ficha de la rutina:
                    el rótulo vive en lib/routines.ts. */}
                <Text style={styles.dayMeta}>
                  {exerciseCountText(day.exercises.length)}
                </Text>
              </View>
              {/* Ya entrenado esta semana: un visto discreto a la derecha. No
                  desactiva la tarjeta —repetirlo es legítimo—, solo evita tener
                  que recordar por dónde ibas. */}
              {isDone && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color={theme.colors.success}
                  style={styles.dayDoneCheck}
                />
              )}
            </Pressable>
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
            <Text style={styles.cardioOnlyBadge}>{t('Cardio')}</Text>
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
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    // El día que toca: aro dorado + relleno de acento, el mismo tratamiento que
    // "hoy" en el historial de Inicio y la semana en curso.
    dayCardNext: {
      borderWidth: 2,
      borderColor: theme.colors.primaryLine,
    },
    // Ya entrenado esta semana: la tarjeta se apaga un poco (sigue siendo
    // pulsable; repetir un día es legítimo y abre semana nueva).
    dayCardDone: {
      opacity: 0.62,
    },
    dayCardDonePressed: {
      opacity: 0.45,
    },
    dayDoneCheck: {
      marginLeft: 10,
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
    // La tarjeta de solo cardio conserva su píldora: es la única fila que no
    // es un día de la rutina, y su azul no compite con ningún oro.
    cardioOnlyBadge: {
      color: theme.colors.emoji_blue,
      backgroundColor: theme.colors.emoji_blueMuted,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.pill,
      fontSize: 14,
      fontWeight: '800',
      overflow: 'hidden',
      lineHeight: 18,
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
    // "Día 3" como ceja gris, mismo tratamiento que en RoutineDetailScreen.
    dayEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
      lineHeight: 14,
    },
    // La ceja del día que toca va en oro: es la única palabra de la pantalla
    // que responde a la pregunta con la que se entra ("¿cuál me toca?").
    dayEyebrowNext: {
      color: theme.colors.primary,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
