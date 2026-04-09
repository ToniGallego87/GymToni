import React, { useMemo, useState } from 'react';
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
  FloatingPrimaryNav,
  FLOATING_GLASS_BAR_HEIGHT,
  FLOATING_GLASS_BAR_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { WorkoutDay, WorkoutLog, WorkoutRoutine } from '../../types';
import { theme } from '@lib/theme';

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
const WEEK_COLORS = [
  theme.colors.primary,
  theme.colors.emoji_green,
  theme.colors.emoji_blue,
  theme.colors.error,
  theme.colors.warning,
];

function getLogTimestamp(log: WorkoutLog) {
  if (typeof log.createdAt === 'number' && Number.isFinite(log.createdAt)) {
    return log.createdAt;
  }

  return new Date(`${log.date}T00:00:00`).getTime();
}

function getWeekColor(blockNumber: number) {
  return WEEK_COLORS[(Math.max(1, blockNumber) - 1) % WEEK_COLORS.length];
}

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
  const floatingNavBottom = Math.max(insets.bottom, 10) + FLOATING_GLASS_BAR_MARGIN;
  const scrollBottomPadding = floatingNavBottom + FLOATING_GLASS_BAR_HEIGHT + 28;

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

  const logToWeekBlock = useMemo(() => {
    const map: Record<string, number> = {};

    state.routines.forEach((routine: WorkoutRoutine) => {
      const routineLogs = state.logs
        .filter((log: WorkoutLog) => log.routineId === routine.id)
        .sort((a: WorkoutLog, b: WorkoutLog) => getLogTimestamp(a) - getLogTimestamp(b));

      let block = 1;
      const seenDays = new Set<number>();

      routineLogs.forEach((log: WorkoutLog) => {
        const dayNumber = getDayById(log.dayId)?.dayNumber;

        if (dayNumber && seenDays.has(dayNumber) && seenDays.size > 0) {
          block += 1;
          seenDays.clear();
        }

        map[log.id] = block;

        if (dayNumber) {
          seenDays.add(dayNumber);
        }
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
        <View style={styles.monthCard}>
          <Pressable
            style={styles.monthNavButton}
            onPress={() => setMonthOffset((prev: number) => prev - 1)}
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={theme.colors.text} />
          </Pressable>

          <Text style={styles.monthTitle}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>

          <Pressable
            style={styles.monthNavButton}
            onPress={() => setMonthOffset((prev: number) => prev + 1)}
          >
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.text} />
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
            const weekBlocks = dayLogs
              .map((log: WorkoutLog) => logToWeekBlock[log.id])
              .filter((value: number | undefined): value is number => typeof value === 'number');
            const cellColor = weekBlocks.length > 0
              ? getWeekColor(Math.min(...weekBlocks))
              : theme.colors.primary;

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
                  hasLogs && { backgroundColor: cellColor, borderColor: cellColor },
                  dateKey === todayKey && styles.dayCellToday,
                ]}
              >
                <Text style={[styles.dayNumber, hasLogs && styles.dayNumberActive]}>
                  {dayNumber}
                </Text>

                {hasLogs && primaryLog && primaryDay && (
                  <View style={styles.dayMeta}>
                    <Text style={styles.dayMetaText}>R{primaryLog.routineId.replace('routine', '')}</Text>
                    <Text style={styles.dayMetaText}>Día {primaryDay.dayNumber}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 22,
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
    minHeight: 72,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayCellEmpty: {
    opacity: 0,
  },
  dayCellActive: {
    ...theme.shadow.soft,
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 16,
  },
  dayNumberActive: {
    color: theme.colors.darkGray,
  },
  dayMeta: {
    alignItems: 'center',
    gap: 1,
  },
  dayMetaText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.darkGray,
    lineHeight: 16,
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
