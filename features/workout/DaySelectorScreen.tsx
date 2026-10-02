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
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  StretchScrollView,
} from '@components';
import { WorkoutDay, WorkoutRoutine } from '../../types';
import { useWorkout } from '@hooks/useWorkout';
import { currentWeekDayState } from '@lib/weeks';
import { isCardioOnlyLog } from '@lib/cardio';
import { getToday, logDateKey } from '@lib/utils';
import { exerciseCountText } from '@lib/routines';
import { getDisplayDayName, theme } from '@lib/theme';
import { dayNameText } from '@lib/textStyles';
import { t } from '@lib/i18n';

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
  const { state } = useWorkout();
  const days = routine?.days || [];
  // Cómo va la semana en curso: la lista deja de ser cinco tarjetas idénticas y
  // dice lo que la app ya sabe —cuáles llevas hechos y cuál toca ahora—, en vez
  // de que el usuario lo recuerde. Misma fuente que la hero de Inicio.
  const { trained, nextDay } = currentWeekDayState(routine, state.logs);
  // Un entrenamiento por día: si hoy ya hay uno, el resto de días no se pueden
  // arrancar (el Calendario pinta una celda por fecha y el segundo quedaría
  // escondido; ver `takenStrengthDates`). El día ya entrenado sí se toca: abre
  // su registro para seguir metiendo series.
  const todayStrengthLog = state.logs.find(
    (log) => !isCardioOnlyLog(log) && logDateKey(log) === getToday()
  );
  const todayDayName = todayStrengthLog
    ? getDisplayDayName(
        days.find((d) => d.id === todayStrengthLog.dayId)?.name || ''
      )
    : '';
  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
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
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Tocar el día arranca la sesión y continúa la semana en curso. Aquí
            solo se elige el día; mover un entreno a otra semana se hace desde
            su detalle ("Mover a la semana anterior/siguiente"). */}
        {/* Hoy ya hay entreno: se dice arriba, antes de que el usuario toque
            una tarjeta apagada y no entienda por qué no pasa nada. */}
        {!!todayStrengthLog && (
          <View style={styles.todayNotice}>
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.todayNoticeText}>
              {todayDayName
                ? t('Hoy ya entrenaste {day}. Un entreno por día', {
                    day: todayDayName,
                  })
                : t('Hoy ya tienes un entreno. Un entreno por día')}
            </Text>
          </View>
        )}

        {days.map((day) => {
          const isDone = trained.has(day.id);
          // El día que toca: aro dorado y su ceja lo dice. Es una sugerencia
          // (el primero que falta esta semana), no una imposición: los demás se
          // tocan igual, incluidos los ya hechos —repetir un día es legítimo y
          // abre semana nueva—.
          const isNext = !isDone && day.id === nextDay?.id;
          // Bloqueado por el entreno de hoy (que es de otro día).
          const blockedByToday =
            !!todayStrengthLog && todayStrengthLog.dayId !== day.id;

          return (
            <Pressable
              key={day.id}
              disabled={blockedByToday}
              style={({ pressed }) => [
                styles.dayCard,
                isNext && styles.dayCardNext,
                isDone && styles.dayCardDone,
                blockedByToday && styles.dayCardBlocked,
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
                blockedByToday
                  ? t('Hoy ya tienes un entreno. Un entreno por día')
                  : isDone
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

      </StretchScrollView>

      <GlassTopBar
        title={t('Elige la sesión')}
        icon="calendar-month-outline"
        subtitle={t('Selecciona el día que vas a registrar')}
        topInset={insets.top}
        onLayout={onTopBarLayout}
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
    // Día que hoy no se puede arrancar (ya hay entreno). Más apagado que el ya
    // hecho: aquel se toca, este no.
    dayCardBlocked: {
      opacity: 0.35,
    },
    // Aviso de "hoy ya entrenaste", encima de la lista.
    todayNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    todayNoticeText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    dayCardDonePressed: {
      opacity: 0.45,
    },
    dayDoneCheck: {
      marginLeft: 10,
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
