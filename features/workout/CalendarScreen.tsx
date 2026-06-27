import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FloatingPrimaryNav,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  StretchScrollView,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { WorkoutDay, WorkoutLog, WorkoutRoutine } from '../../types';
import { theme, getTrainingAccent } from '@lib/theme';
import { groupLogsIntoWeekBlocks } from '@lib/weeks';

interface CalendarScreenProps {
  onSelectLog: (log: WorkoutLog, day: WorkoutDay) => void;
  onNavigateHome?: () => void;
  onNavigateRoutines?: () => void;
  onNavigateCalendar?: () => void;
  onNavigateData?: () => void;
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function CalendarScreen({
  onSelectLog,
  onNavigateHome,
  onNavigateRoutines,
  onNavigateCalendar,
  onNavigateData,
}: CalendarScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const [monthOffset, setMonthOffset] = useState(0);
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: floatingNavBottom, scrollBottomPadding } =
    getFloatingPrimaryNavMetrics(insets.bottom);

  const titleElement = (
    <View style={styles.topBarTitleRow}>
      <MaterialCommunityIcons name="calendar-month-outline" size={18} color={theme.colors.text} />
      <Text style={styles.topBarTitleText}>Calendario</Text>
    </View>
  );

  const getDayById = (dayId: string) => {
    for (const routine of state.routines) {
      const day = routine.days.find((item: WorkoutDay) => item.id === dayId);
      if (day) return day;
    }
    return undefined;
  };

  // Número de semana (bloque) dentro de su rutina para cada log.
  const logToWeekBlock = useMemo(() => {
    const map: Record<string, number> = {};

    state.routines.forEach((routine: WorkoutRoutine) => {
      const routineLogs = state.logs.filter((log: WorkoutLog) => log.routineId === routine.id);
      const grouped = groupLogsIntoWeekBlocks(routineLogs, log => getDayById(log.dayId)?.dayNumber);

      Object.keys(grouped).forEach(blockKey => {
        const block = Number(blockKey);
        grouped[block].forEach(log => {
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

  const logsByDate = useMemo(() => {
    return state.logs.reduce<Record<string, WorkoutLog[]>>((accumulator: Record<string, WorkoutLog[]>, log: WorkoutLog) => {
      if (!accumulator[log.date]) {
        accumulator[log.date] = [];
      }

      accumulator[log.date].push(log);
      return accumulator;
    }, {});
  }, [state.logs]);

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

  const toDateKey = (dayNumber: number) => (
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
  );

  const todayKey = new Date().toISOString().split('T')[0];

  if (state.logs.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" translucent backgroundColor="transparent" />

        <View style={[styles.emptyState, { paddingTop: topBarHeight + 24 }]}> 
          <MaterialCommunityIcons
            name="inbox-outline"
            size={44}
            color={theme.colors.textSecondary}
            style={styles.emptyEmoji}
          />
          <Text style={styles.emptyTitle}>Sin entrenamientos</Text>
          <Text style={styles.emptyText}>
            Guarda una sesión para verla reflejada en el calendario.
          </Text>
        </View>

        <GlassTopBar
          title="Calendario"
          titleElement={titleElement}
          subtitle="Tu historial mensual"
          topInset={insets.top}
        />

        <FloatingPrimaryNav
          bottom={floatingNavBottom}
          activeTab="calendar"
          onPressHome={onNavigateHome}
          onPressRoutines={onNavigateRoutines}
          onPressCalendar={onNavigateCalendar}
          onPressData={onNavigateData}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

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
          <GradientFill accent={theme.colors.primary} />
          <Pressable
            style={styles.monthNavButton}
            onPress={() => setMonthOffset((prev: number) => prev - 1)}
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color={theme.colors.text} />
          </Pressable>

          <Text style={styles.monthTitle}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>

          <Pressable
            style={styles.monthNavButton}
            onPress={() => setMonthOffset((prev: number) => prev + 1)}
          >
            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekHeader}>
          {WEEK_DAYS.map(label => (
            <Text key={label} style={styles.weekHeaderText}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {dayCells.map((dayNumber, index) => {
            if (!dayNumber) {
              return <View key={`empty-${index}`} style={[styles.dayCell, styles.dayCellEmpty]} />;
            }

            const dateKey = toDateKey(dayNumber);
            const dayLogs = logsByDate[dateKey] || [];
            const primaryLog = dayLogs[0];
            const primaryDay = primaryLog ? getDayById(primaryLog.dayId) : undefined;
            const hasLogs = !!primaryLog && !!primaryDay;
            // Color de la celda = color del día de entrenamiento (emoji de la rutina).
            const dayColor = primaryDay ? getTrainingAccent(primaryDay) : theme.colors.primary;
            const routineIndex = primaryLog
              ? state.routines.findIndex((r: WorkoutRoutine) => r.id === primaryLog.routineId)
              : -1;
            // La rutina activa mantiene el chip amarillo; las no activas, blanco.
            const isActiveRoutine = !!primaryLog && primaryLog.routineId === state.activeRoutineId;
            const routineChipColor = isActiveRoutine ? theme.colors.primary : theme.colors.white;
            // Semana (bloque) dentro de la rutina.
            const weekNumber = primaryLog ? logToWeekBlock[primaryLog.id] : undefined;

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
                  hasLogs && { borderColor: dayColor },
                  dateKey === todayKey && styles.dayCellToday,
                ]}
              >
                {hasLogs ? (
                  <>
                    <GradientFill accent={dayColor} />
                    <Text style={[styles.dayNumber, { color: theme.colors.white }]}>
                      {dayNumber}
                    </Text>
                    {typeof weekNumber === 'number' ? (
                      <Text
                        style={[styles.dayWeekLabel, { color: dayColor }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        S{weekNumber}
                      </Text>
                    ) : (
                      <View style={styles.dayWeekSpacer} />
                    )}
                    {routineIndex >= 0 && (
                      <Text
                        style={[
                          styles.dayRoutineChip,
                          { color: routineChipColor, borderColor: routineChipColor },
                        ]}
                        numberOfLines={1}
                      >
                        R{routineIndex + 1}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.dayNumber}>{dayNumber}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </StretchScrollView>

      <GlassTopBar
        title="Calendario"
        titleElement={titleElement}
        subtitle="Repasa tus ejercicios mes por mes"
        topInset={insets.top}
      />

      <FloatingPrimaryNav
        bottom={floatingNavBottom}
        activeTab="calendar"
        onPressHome={onNavigateHome}
        onPressRoutines={onNavigateRoutines}
        onPressCalendar={onNavigateCalendar}
        onPressData={onNavigateData}
      />
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
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
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
    lineHeight: 27,
  },
  monthNavButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  monthNavText: {
    fontSize: 16,
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
    minHeight: 80,
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
    borderColor: theme.colors.primary,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 16,
  },
  // Chip de rutina (R1, R2...): pequeño, blanco, centrado en la parte inferior.
  // includeFontPadding:false + textAlignVertical centran el texto dentro de la
  // pastilla en Android (si no, queda desplazado hacia arriba).
  dayRoutineChip: {
    alignSelf: 'center',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 12,
    color: theme.colors.primary,
    borderColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  // Número de semana (S1, S2...): protagonista, centrado en el espacio restante.
  // lineHeight con holgura sobre fontSize: Anton tiene ascendentes altas y, si
  // van muy pegados, el glifo se recorta por arriba.
  dayWeekLabel: {
    flex: 1,
    fontFamily: theme.fonts.display,
    fontSize: 26,
    letterSpacing: 0.5,
    lineHeight: 32,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  dayWeekSpacer: {
    flex: 1,
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


