import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DayAccentIcon,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  StretchScrollView,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import {
  hasAnyCardio,
  cardioSessionFromLog,
  CardioDay,
  CardioSession,
  CARDIO_ONLY_DAY,
  disciplineIconName,
  groupSessionsByDay,
  hasIncline,
  isCardioOnlyLog,
  topKcalDiscipline,
} from '@lib/cardio';
import { animateLayout } from '@lib/layoutAnimation';
import { WorkoutDay, WorkoutLog, WorkoutRoutine } from '../../types';
import { theme, getTrainingAccent } from '@lib/theme';
import { t } from '@lib/i18n';
import { findDayInRoutines, getToday } from '@lib/utils';
import { groupLogsIntoWeekBlocks } from '@lib/weeks';

type CalendarMode = 'fuerza' | 'cardio';

// Icono de la celda de cardio: la disciplina que más kcal quemó ese día (cuesta
// arriba si la hizo con pendiente).
const cardioDayIcon = (
  day: CardioDay
): React.ComponentProps<typeof MaterialCommunityIcons>['name'] => {
  const top = topKcalDiscipline(day);
  if (!top) return 'run-fast';
  return disciplineIconName(
    top.type,
    hasIncline(top.maxPendiente)
  ) as React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

interface CalendarScreenProps {
  onSelectLog: (log: WorkoutLog, day: WorkoutDay) => void;
  // Reabre la inserción de una sesión de solo cardio ya registrada (solo hoy).
  onEditCardioOnly?: (log: WorkoutLog) => void;
}

export function CalendarScreen({
  onSelectLog,
  onEditCardioOnly,
}: CalendarScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  // Meses y días DENTRO del componente: así se recalculan con el idioma activo
  // (i18n en caliente). A nivel de módulo capturarían el idioma de arranque y no
  // cambiarían al alternarlo sin reiniciar.
  const MONTH_NAMES = [
    t('Enero'),
    t('Febrero'),
    t('Marzo'),
    t('Abril'),
    t('Mayo'),
    t('Junio'),
    t('Julio'),
    t('Agosto'),
    t('Septiembre'),
    t('Octubre'),
    t('Noviembre'),
    t('Diciembre'),
  ];
  const WEEK_DAYS = [
    t('Lun'),
    t('Mar'),
    t('Mié'),
    t('Jue'),
    t('Vie'),
    t('Sáb'),
    t('Dom'),
  ];
  const [monthOffset, setMonthOffset] = useState(0);
  const [mode, setMode] = useState<CalendarMode>('fuerza');
  const cardioAvailable = hasAnyCardio(state.logs);
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { scrollBottomPadding } = getFloatingPrimaryNavMetrics(insets.bottom);

  const getDayById = (dayId: string) =>
    findDayInRoutines(state.routines, dayId);

  // Número de semana (bloque) dentro de su rutina para cada log.
  const logToWeekBlock = useMemo(() => {
    const map: Record<string, number> = {};

    state.routines.forEach((routine: WorkoutRoutine) => {
      const routineLogs = state.logs.filter(
        (log: WorkoutLog) => log.routineId === routine.id
      );
      const grouped = groupLogsIntoWeekBlocks(
        routineLogs,
        (log) => getDayById(log.dayId)?.dayNumber
      );

      Object.keys(grouped).forEach((blockKey) => {
        const block = Number(blockKey);
        grouped[block].forEach((log) => {
          map[log.id] = block;
        });
      });
    });

    return map;
  }, [state.logs, state.routines]);

  const viewDate = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  // Offset mínimo permitido: mes del primer registro guardado. Máximo: mes actual (0).
  const minMonthOffset = useMemo(() => {
    if (state.logs.length === 0) return 0;
    const earliest = state.logs.reduce(
      (min: string, log: WorkoutLog) => (log.date < min ? log.date : min),
      state.logs[0].date
    );
    const [year, month] = earliest.split('-').map(Number);
    const today = new Date();
    return (year - today.getFullYear()) * 12 + (month - 1 - today.getMonth());
  }, [state.logs]);

  const canGoPrev = monthOffset > minMonthOffset;
  const canGoNext = monthOffset < 0;

  const logsByDate = useMemo(() => {
    return state.logs.reduce<Record<string, WorkoutLog[]>>(
      (accumulator: Record<string, WorkoutLog[]>, log: WorkoutLog) => {
        if (!accumulator[log.date]) {
          accumulator[log.date] = [];
        }

        accumulator[log.date].push(log);
        return accumulator;
      },
      {}
    );
  }, [state.logs]);

  // Cardio por fecha: la celda representa TODO el cardio del día (aunque venga
  // de varios logs), con el log/día a abrir al pulsarla.
  const cardioByDate = useMemo(() => {
    const map: Record<
      string,
      { log: WorkoutLog; day: WorkoutDay; sessions: CardioSession[] }
    > = {};
    state.logs.forEach((log: WorkoutLog) => {
      const session = cardioSessionFromLog(log);
      if (!session) return;
      // Solo cardio: el día no existe en ninguna rutina; se usa el sintético.
      const day =
        getDayById(log.dayId) ??
        (isCardioOnlyLog(log) ? CARDIO_ONLY_DAY : undefined);
      if (!day) return;
      const entry = map[log.date];
      // El día de fuerza manda al abrir la celda; el solo cardio solo si no hay.
      if (!entry) map[log.date] = { log, day, sessions: [session] };
      else {
        entry.sessions.push(session);
        if (isCardioOnlyLog(entry.log) && !isCardioOnlyLog(log)) {
          entry.log = log;
          entry.day = day;
        }
      }
    });
    return Object.fromEntries(
      Object.entries(map).map(([date, entry]) => [
        date,
        { ...entry, cardioDay: groupSessionsByDay(entry.sessions)[0] },
      ])
    );
  }, [state.logs, state.routines]);

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const firstWeekDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const dayCells: Array<number | null> = [
    ...Array(firstWeekDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  while (dayCells.length % 7 !== 0) {
    dayCells.push(null);
  }

  const toDateKey = (dayNumber: number) =>
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
      dayNumber
    ).padStart(2, '0')}`;

  const todayKey = getToday();

  if (state.logs.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar
          style={theme.statusBarStyle}
          translucent
          backgroundColor="transparent"
        />

        <View style={[styles.emptyState, { paddingTop: topBarHeight + 24 }]}>
          <MaterialCommunityIcons
            name="inbox-outline"
            size={44}
            color={theme.colors.textSecondary}
            style={styles.emptyEmoji}
          />
          <Text style={styles.emptyTitle}>{t('Sin entrenamientos')}</Text>
          <Text style={styles.emptyText}>
            {t('Guarda una sesión para verla reflejada en el calendario.')}
          </Text>
        </View>

        <GlassTopBar
          title={t('Calendario')}
          icon="calendar-month-outline"
          subtitle={t('Tu historial mensual')}
          topInset={insets.top}
        />

        {/* Barra de navegación fija en app/App.tsx (fuera del pager). */}
      </View>
    );
  }

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
        <View style={styles.monthCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <Pressable
            style={[
              styles.monthNavButton,
              !canGoPrev && styles.monthNavButtonDisabled,
            ]}
            disabled={!canGoPrev}
            onPress={() => setMonthOffset((prev: number) => prev - 1)}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={22}
              color={theme.colors.text}
            />
          </Pressable>

          <Text style={styles.monthTitle}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>

          <Pressable
            style={[
              styles.monthNavButton,
              !canGoNext && styles.monthNavButtonDisabled,
            ]}
            disabled={!canGoNext}
            onPress={() => setMonthOffset((prev: number) => prev + 1)}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={theme.colors.text}
            />
          </Pressable>
        </View>

        {cardioAvailable && (
          <View style={styles.modeToggle}>
            {(['fuerza', 'cardio'] as CalendarMode[]).map((m) => {
              const active = mode === m;
              // Activo = relleno dorado, así que la tinta es la del oro. Iba con
              // `background`, que en día es casi blanco y sobre el oro vivo no se
              // leía (en noche coinciden, así que allí no cambia nada).
              const color = active
                ? theme.colors.onGold
                : theme.colors.textSecondary;
              return (
                <Pressable
                  key={m}
                  style={[styles.modeButton, active && styles.modeButtonActive]}
                  onPress={() => {
                    if (m === mode) return;
                    animateLayout();
                    setMode(m);
                  }}
                >
                  <MaterialCommunityIcons
                    name={m === 'fuerza' ? 'dumbbell' : 'run-fast'}
                    size={16}
                    color={color}
                  />
                  <Text style={[styles.modeButtonText, { color }]}>
                    {m === 'fuerza' ? t('Fuerza') : t('Cardio')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.weekHeader}>
          {WEEK_DAYS.map((label) => (
            <Text key={label} style={styles.weekHeaderText}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {dayCells.map((dayNumber, index) => {
            if (!dayNumber) {
              return (
                <View
                  key={`empty-${index}`}
                  style={[styles.dayCell, styles.dayCellEmpty]}
                />
              );
            }

            const dateKey = toDateKey(dayNumber);

            // Modo cardio: la celda refleja la sesión de cardio del día (icono
            // + minutos), no el día de fuerza.
            if (mode === 'cardio') {
              const cardio = cardioByDate[dateKey];
              const hasCardio = !!cardio;

              return (
                <Pressable
                  key={dateKey}
                  disabled={!hasCardio}
                  onPress={() => {
                    if (!cardio) return;
                    // Solo cardio de hoy: la sesión sigue viva, se abre la
                    // inserción en vez de la consulta.
                    if (isCardioOnlyLog(cardio.log) && dateKey === todayKey) {
                      onEditCardioOnly?.(cardio.log);
                    } else {
                      onSelectLog(cardio.log, cardio.day);
                    }
                  }}
                  style={[
                    styles.dayCell,
                    hasCardio && styles.dayCellActive,
                    hasCardio && { borderColor: theme.colors.accentLine },
                    dateKey === todayKey && styles.dayCellToday,
                  ]}
                >
                  {hasCardio ? (
                    <>
                      <GradientFill accent={theme.colors.accentLine} />
                      <View style={styles.dayHeaderRow}>
                        <Text
                          style={[
                            styles.dayNumber,
                            { color: theme.colors.white },
                          ]}
                        >
                          {dayNumber}
                        </Text>
                      </View>
                      <View style={styles.dayIconSlot}>
                        <MaterialCommunityIcons
                          name={cardioDayIcon(cardio.cardioDay)}
                          size={28}
                          color={theme.colors.white}
                        />
                      </View>
                      <Text
                        style={[
                          styles.dayWeekLabel,
                          { color: theme.colors.textSecondary },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        {Math.round(cardio.cardioDay.totalMinutes)}'
                      </Text>
                    </>
                  ) : (
                    <>
                      {dateKey === todayKey && (
                        <GradientFill accent={theme.colors.primaryLine} />
                      )}
                      <Text style={styles.dayNumber}>{dayNumber}</Text>
                    </>
                  )}
                </Pressable>
              );
            }

            const dayLogs = logsByDate[dateKey] || [];
            // Modo fuerza: solo cuentan los logs de fuerza reales (su día existe
            // en una rutina). Los días de solo cardio NO se muestran aquí; solo
            // aparecen en el modo cardio.
            const primaryLog = dayLogs.find((l) => !!getDayById(l.dayId));
            const primaryDay = primaryLog
              ? getDayById(primaryLog.dayId)
              : undefined;
            const hasLogs = !!primaryLog && !!primaryDay;

            // Color de la celda = color del día de entrenamiento (emoji de la rutina).
            const dayColor = primaryDay
              ? getTrainingAccent(primaryDay)
              : theme.colors.primaryLine;
            // Día de una semana de descarga: el borde se pinta de azul (el mismo
            // azul del deload en el resto de la app) para reconocerlo de un vistazo.
            const isDeloadDay = !!primaryLog?.isDeload;
            const dayBorderColor = isDeloadDay
              ? theme.colors.emoji_blue
              : dayColor;
            const routineIndex = primaryLog
              ? state.routines.findIndex(
                  (r: WorkoutRoutine) => r.id === primaryLog.routineId
                )
              : -1;
            // La rutina activa mantiene el texto amarillo; las no activas, gris.
            const isActiveRoutine =
              !!primaryLog && primaryLog.routineId === state.activeRoutineId;
            const routineChipColor = isActiveRoutine
              ? theme.colors.primary
              : theme.colors.textSecondary;
            // Semana (bloque) dentro de la rutina.
            const weekNumber = primaryLog
              ? logToWeekBlock[primaryLog.id]
              : undefined;

            return (
              <Pressable
                key={dateKey}
                disabled={!hasLogs || !primaryDay || !primaryLog}
                onPress={() => {
                  if (primaryLog && primaryDay) {
                    onSelectLog(primaryLog, primaryDay);
                  }
                }}
                style={[
                  styles.dayCell,
                  hasLogs && styles.dayCellActive,
                  hasLogs && { borderColor: dayBorderColor },
                  dateKey === todayKey && styles.dayCellToday,
                ]}
              >
                {hasLogs ? (
                  <>
                    <GradientFill accent={dayColor} />
                    {/* Cabecera: número de día (izq) + chip de rutina (der). */}
                    <View style={styles.dayHeaderRow}>
                      <Text
                        style={[
                          styles.dayNumber,
                          { color: theme.colors.white },
                        ]}
                      >
                        {dayNumber}
                      </Text>
                      {routineIndex >= 0 && (
                        <Text
                          style={[
                            styles.dayRoutineChip,
                            { color: routineChipColor },
                          ]}
                          numberOfLines={1}
                        >
                          R{routineIndex + 1}
                        </Text>
                      )}
                    </View>
                    {/* Protagonista: icono del día de la rutina (qué entreno es). */}
                    <View style={styles.dayIconSlot}>
                      <DayAccentIcon
                        emoji={primaryDay?.emoji}
                        name={primaryDay?.name}
                        size={30}
                        color={theme.colors.white}
                      />
                    </View>
                    {/* Pie: semana (bloque) dentro de la rutina. */}
                    {typeof weekNumber === 'number' ? (
                      <Text
                        style={[
                          styles.dayWeekLabel,
                          { color: theme.colors.textSecondary },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        S{weekNumber}
                      </Text>
                    ) : (
                      <View style={styles.dayWeekSpacer} />
                    )}
                  </>
                ) : (
                  <>
                    {dateKey === todayKey && (
                      <GradientFill accent={theme.colors.primaryLine} />
                    )}
                    <Text style={styles.dayNumber}>{dayNumber}</Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </StretchScrollView>

      <GlassTopBar
        title={t('Calendario')}
        icon="calendar-month-outline"
        subtitle={t('Repasa tus ejercicios mes por mes')}
        topInset={insets.top}
      />

      {/* Barra de navegación fija en app/App.tsx (fuera del pager). */}
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
      paddingBottom: theme.spacing.xl,
      marginTop: 0,
    },
    monthCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 14,
      ...theme.shadow.soft,
    },
    monthTitle: {
      fontSize: 22,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.5,
      color: theme.colors.text,
      lineHeight: 31,
      // Anton pega el glifo al borde superior de su caja; sin esto el mes/año
      // queda descentrado frente a las flechas (mismo patrón que HeroCard).
      includeFontPadding: false,
      textAlignVertical: 'center',
      transform: [{ translateY: 2 }],
    },
    monthNavButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    monthNavButtonDisabled: {
      opacity: 0.25,
    },
    weekHeader: {
      flexDirection: 'row',
      marginBottom: 8,
      gap: 6,
    },
    weekHeaderText: {
      flex: 1,
      textAlign: 'center',
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'space-between',
    },
    dayCell: {
      flex: 1,
      minWidth: '12.8%',
      // Altura FIJA (no mínima) para que las filas midan lo mismo en los modos
      // fuerza y cardio, independientemente del contenido de cada celda.
      height: 80,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 7,
      paddingHorizontal: 6,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      overflow: 'hidden',
    },
    dayCellEmpty: {
      opacity: 0,
    },
    dayCellActive: {
      ...theme.shadow.soft,
    },
    dayCellToday: {
      borderWidth: 2.5,
      borderColor: theme.colors.primaryLine,
    },
    // Cabecera del cell: número de día (izq) y chip de rutina (der) en una fila.
    dayHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dayNumber: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 16,
    },
    // Slot del icono: protagonista, ocupa el espacio central y centra la silueta.
    dayIconSlot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Rutina (R1, R2...): texto suelto en la esquina superior derecha. Amarillo
    // si es la rutina activa, gris en el resto (color inline).
    dayRoutineChip: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.2,
      lineHeight: 13,
      textAlign: 'center',
      textAlignVertical: 'center',
      includeFontPadding: false,
    },
    // Número de semana (S1, S2...): metadato de pie, discreto y centrado.
    dayWeekLabel: {
      fontFamily: theme.fonts.display,
      fontSize: 15,
      letterSpacing: 0.5,
      lineHeight: 21,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    dayWeekSpacer: {
      height: 19,
    },
    // Toggle Fuerza/Cardio junto a la cabecera de mes: dos segmentos; el activo se
    // rellena de amarillo (primary) con texto oscuro, el inactivo va gris sobre surface.
    modeToggle: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
      padding: 4,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    modeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.sm,
    },
    modeButtonActive: {
      backgroundColor: theme.colors.primaryFill,
    },
    modeButtonText: {
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emptyEmoji: {
      fontSize: 46,
      marginBottom: 10,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 6,
    },
    emptyText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
