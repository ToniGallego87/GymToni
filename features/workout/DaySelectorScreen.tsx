import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppModal,
  Button,
  ConfirmModal,
  DayAccentIcon,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  StretchScrollView,
} from '@components';
import { WorkoutDay, WorkoutLog, WorkoutRoutine } from '../../types';
import { useWorkout } from '@hooks/useWorkout';
import { currentWeekDayState } from '@lib/weeks';
import { isCardioOnlyLog } from '@lib/cardio';
import { getToday, logDateKey, weekdayDayMonth } from '@lib/utils';
import { exerciseCountText } from '@lib/routines';
import { getDisplayDayName, theme } from '@lib/theme';
import { dayNameText } from '@lib/textStyles';
import { t } from '@lib/i18n';

interface DaySelectorScreenProps {
  routine?: WorkoutRoutine;
  // Entreno olvidado de esa fecha (YYYY-MM-DD): la semana en curso y "hoy" no
  // pintan nada, así que se listan los días sin estado.
  forDate?: string;
  // `startsNewWeek`: el entreno abre semana nueva aunque el día no se repita.
  onSelectDay: (day: WorkoutDay, options?: { startsNewWeek?: boolean }) => void;
  // Abrir el detalle de un día ya entrenado esta semana.
  onOpenLog: (log: WorkoutLog, day: WorkoutDay) => void;
  onBack: () => void;
}

export function DaySelectorScreen({
  routine,
  forDate,
  onSelectDay,
  onOpenLog,
  onBack,
}: DaySelectorScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const days = routine?.days || [];
  // Cómo va la semana en curso: la lista deja de ser cinco tarjetas idénticas y
  // dice lo que la app ya sabe —cuáles llevas hechos y cuál toca ahora—, en vez
  // de que el usuario lo recuerde. Misma fuente que la hero de Inicio.
  const weekState = currentWeekDayState(routine, state.logs);
  const { weekNumber, logByDayId } = weekState;
  const trained = forDate ? new Set<string>() : weekState.trained;
  const nextDay = forDate ? undefined : weekState.nextDay;
  // Un entrenamiento por día: si hoy ya hay uno, el resto de días no se pueden
  // arrancar (el Calendario pinta una celda por fecha y el segundo quedaría
  // escondido; ver `takenStrengthDates`). El día ya entrenado sí se toca: abre
  // su registro para seguir metiendo series. Con `forDate` la celda elegida
  // estaba vacía, así que no hay nada que bloquear.
  const todayStrengthLog = forDate
    ? undefined
    : state.logs.find(
        (log) => !isCardioOnlyLog(log) && logDateKey(log) === getToday()
      );
  const todayDayName = todayStrengthLog
    ? getDisplayDayName(
        days.find((d) => d.id === todayStrengthLog.dayId)?.name || ''
      )
    : '';
  // Día ya hecho que se ha tocado: abre un menú con lo que se puede hacer con
  // él (verlo, o repetirlo empezando semana nueva) en vez de adivinarlo.
  const [doneDay, setDoneDay] = useState<WorkoutDay | null>(null);
  const doneDayLog = doneDay ? logByDayId[doneDay.id] : undefined;
  // "Nueva semana" de la cabecera: cierra la en curso a medias, así que se
  // confirma diciendo con cuántos días se cierra.
  const [confirmNewWeek, setConfirmNewWeek] = useState(false);
  // Solo con la semana a medias (completa o caducada, la siguiente ya empieza
  // sola) y sin entreno hoy (un entreno por día).
  const canStartNewWeek =
    trained.size > 0 && !todayStrengthLog && days.length > 0;
  const weekClosesMessage = t(
    'La semana {week} se cierra con {n} de {total} días.',
    { week: weekNumber, n: trained.size, total: days.length }
  );
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

        {/* La semana en curso, a la vista: sin ella "semana nueva" no se
            entendía (un usuario no veía que un día hecho se pudiera tocar).
            Su acción, al lado: empezar la siguiente sin esperar a terminarla. */}
        {days.length > 0 && !forDate && (
          <View style={styles.weekHeader}>
            <View style={styles.weekHeaderText}>
              <View style={styles.weekTitleRow}>
                <Text style={styles.weekTitle}>
                  {`${t('Semana')} ${weekNumber}`.toUpperCase()}
                </Text>
                <Text style={styles.weekCount}>
                  {t('{n} de {total} días', {
                    n: trained.size,
                    total: days.length,
                  })}
                </Text>
              </View>
              <View style={styles.weekBar}>
                {days.map((day) => (
                  <View
                    key={day.id}
                    style={[
                      styles.weekBarSegment,
                      trained.has(day.id) && styles.weekBarSegmentDone,
                    ]}
                  />
                ))}
              </View>
            </View>
            {canStartNewWeek && (
              <Pressable
                style={({ pressed }) => [
                  styles.newWeekButton,
                  pressed && styles.dayCardPressed,
                ]}
                onPress={() => setConfirmNewWeek(true)}
                accessibilityRole="button"
                accessibilityLabel={t('Empezar semana nueva')}
              >
                <MaterialCommunityIcons
                  name="restart"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.newWeekButtonText}>
                  {t('Nueva semana')}
                </Text>
              </Pressable>
            )}
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
          // Hecho HOY: tocarlo reabre ese registro para seguir metiendo series.
          // Hecho otro día de la semana: tocarlo abre un menú (verlo o
          // repetirlo empezando semana nueva).
          const doneToday = isDone && todayStrengthLog?.dayId === day.id;
          const opensMenu = isDone && !doneToday;

          return (
            <Pressable
              key={day.id}
              disabled={blockedByToday}
              style={({ pressed }) => [
                styles.dayCard,
                isNext && styles.dayCardNext,
                blockedByToday && styles.dayCardBlocked,
                pressed && styles.dayCardPressed,
              ]}
              onPress={() => (opensMenu ? setDoneDay(day) : onSelectDay(day))}
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
              accessibilityHint={
                opensMenu ? t('Ver lo que hiciste o repetirlo') : undefined
              }
            >
              {isNext && <GradientFill accent={theme.colors.primaryLine} />}
              {/* Ya hecho: se atenúa el contenido, no la tarjeta entera. Apagar
                  la caja es el lenguaje de "bloqueado" y aquí se puede tocar. */}
              <View style={[styles.dayLeading, isDone && styles.doneDimmed]}>
                <DayAccentIcon emoji={day.emoji} name={day.name} size={40} />
              </View>
              <View style={styles.dayContent}>
                {/* El número del día como ceja, igual que en la ficha de la
                    rutina: es la referencia, no el titular. En el día que toca
                    la ceja lo dice, que es el dato que se viene a buscar a esta
                    pantalla. En un día hecho, el visto va aquí y no en una
                    columna a la derecha: así el nombre conserva todo el ancho
                    (con un chip al lado, los nombres largos partían en dos). */}
                <View style={styles.eyebrowRow}>
                  <Text
                    style={[styles.dayEyebrow, isNext && styles.dayEyebrowNext]}
                  >
                    {isNext
                      ? `${t('Te toca')} · ${t('Día')} ${day.dayNumber}`
                      : `${t('Día')} ${day.dayNumber}`}
                  </Text>
                  {isDone && (
                    <>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={12}
                        color={theme.colors.success}
                      />
                      <Text style={[styles.dayEyebrow, styles.dayEyebrowDone]}>
                        {doneToday ? t('Hecho hoy') : t('Hecho')}
                      </Text>
                    </>
                  )}
                </View>
                <Text style={[styles.dayName, isDone && styles.dayNameDone]}>
                  {getDisplayDayName(day.name)}
                </Text>
                {/* Mismo recuento (y mismo singular) que la ficha de la rutina:
                    el rótulo vive en lib/routines.ts. El de hoy dice que se
                    sigue; el de otro día lleva el chevron de su menú. */}
                {doneToday ? (
                  <View style={styles.doneActionRow}>
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={14}
                      color={theme.colors.textSecondary}
                    />
                    <Text
                      style={[styles.dayMeta, styles.dayMetaInline]}
                      numberOfLines={1}
                    >
                      {t('Toca para seguir')}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.dayMeta}>
                    {exerciseCountText(day.exercises.length)}
                  </Text>
                )}
              </View>
              {opensMenu && (
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={theme.colors.textSecondary}
                />
              )}
            </Pressable>
          );
        })}
      </StretchScrollView>

      <ConfirmModal
        visible={confirmNewWeek}
        icon="restart"
        title={t('¿Empezar semana nueva?')}
        message={`${weekClosesMessage} ${t(
          'La semana {week} empieza con {day}.',
          {
            week: weekNumber + 1,
            day: days[0] ? getDisplayDayName(days[0].name) : '',
          }
        )}`}
        confirmLabel={t('Empezar semana nueva')}
        confirmVariant="primary"
        onCancel={() => setConfirmNewWeek(false)}
        onConfirm={() => {
          setConfirmNewWeek(false);
          if (days[0]) onSelectDay(days[0], { startsNewWeek: true });
        }}
      />

      {/* Menú de un día ya hecho: lo que antes había que adivinar (que tocarlo
          lo repetía) pasa a ser una elección explícita, y de paso se puede
          consultar lo que se hizo. */}
      <AppModal
        visible={!!doneDay}
        onRequestClose={() => setDoneDay(null)}
        onOverlayPress={() => setDoneDay(null)}
        icon="check-circle-outline"
        title={doneDay ? getDisplayDayName(doneDay.name) : ''}
        footer={
          <Button
            title={t('Cancelar')}
            onPress={() => setDoneDay(null)}
            variant="secondary"
            size="medium"
          />
        }
      >
        <View style={styles.menuOptions}>
          {!!doneDayLog && (
            <Pressable
              style={({ pressed }) => [
                styles.menuOption,
                pressed && styles.dayCardPressed,
              ]}
              onPress={() => {
                const day = doneDay;
                setDoneDay(null);
                if (day) onOpenLog(doneDayLog, day);
              }}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="eye-outline"
                size={22}
                color={theme.colors.text}
              />
              <View style={styles.menuOptionText}>
                <Text style={styles.menuOptionTitle}>
                  {t('Ver lo que hiciste')}
                </Text>
                <Text style={styles.menuOptionHint}>
                  {t('Series, pesos y notas de ese día')}
                </Text>
              </View>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.menuOption,
              pressed && styles.dayCardPressed,
            ]}
            onPress={() => {
              const day = doneDay;
              setDoneDay(null);
              if (day) onSelectDay(day, { startsNewWeek: true });
            }}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="restart"
              size={22}
              color={theme.colors.text}
            />
            <View style={styles.menuOptionText}>
              <Text style={styles.menuOptionTitle}>
                {t('Empezar una nueva semana con este día')}
              </Text>
              <Text style={styles.menuOptionHint}>{weekClosesMessage}</Text>
            </View>
          </Pressable>
        </View>
      </AppModal>

      <GlassTopBar
        title={t('Elige la sesión')}
        icon="calendar-month-outline"
        // El subtítulo dice algo vivo: la rutina que se va a entrenar. En una
        // sola línea, que es la altura con la que la barra se estima antes de
        // medirse: con dos, la lista nacía pegada al título y se recolocaba.
        subtitle={
          forDate
            ? t('Entreno · {date}', { date: weekdayDayMonth(forDate) })
            : routine?.name ?? t('Selecciona el día que vas a registrar')
        }
        subtitleNumberOfLines={1}
        topInset={insets.top}
        onLayout={onTopBarLayout}
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
    // Ya entrenado esta semana: se atenúan el icono y el nombre, no la tarjeta
    // (apagarla entera se leía como "desactivada", y se puede tocar).
    doneDimmed: {
      opacity: 0.55,
    },
    dayNameDone: {
      color: theme.colors.textSecondary,
    },
    // Cabecera de la semana en curso: número, días hechos, barra por día y,
    // a la derecha, "Nueva semana".
    weekHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
      paddingVertical: 14,
      paddingLeft: 16,
      paddingRight: 14,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
    },
    weekHeaderText: {
      flex: 1,
      minWidth: 0,
    },
    weekTitleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    weekTitle: {
      ...dayNameText(),
      fontSize: 18,
      lineHeight: 24,
    },
    weekCount: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    weekBar: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 8,
    },
    weekBarSegment: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceAlt,
    },
    weekBarSegmentDone: {
      backgroundColor: theme.colors.success,
    },
    newWeekButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.primaryLine,
    },
    newWeekButtonText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    // Menú del día hecho: dos opciones grandes con el mismo peso (ninguna es
    // "la buena": son dos cosas distintas que se pueden querer hacer).
    menuOptions: {
      gap: 10,
    },
    menuOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 64,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    menuOptionText: {
      flex: 1,
    },
    menuOptionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    menuOptionHint: {
      marginTop: 2,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
    },
    // Ceja con el visto del día hecho ("DÍA 1  ✓ HECHO").
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dayEyebrowDone: {
      color: theme.colors.success,
    },
    // Lo que pasa al tocar un día hecho, con su icono (repetir / seguir).
    doneActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 2,
    },
    // Día que hoy no se puede arrancar (ya hay entreno): la tarjeta entera se
    // apaga, el único estado que no se toca.
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
    dayMetaInline: {
      marginTop: 0,
    },
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
