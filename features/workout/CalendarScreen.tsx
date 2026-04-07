import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { useWorkout } from '@hooks/useWorkout';
import { WorkoutDay, WorkoutLog, WorkoutRoutine } from '../../types';
import { theme } from '@lib/theme';

interface CalendarScreenProps {
  onSelectLog: (log: WorkoutLog, day: WorkoutDay) => void;
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

export function CalendarScreen({ onSelectLog }: CalendarScreenProps) {
  const { state } = useWorkout();
  const [monthOffset, setMonthOffset] = useState(0);

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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📅 Calendario</Text>
          <Text style={styles.subtitle}>Tu historial mensual</Text>
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>Sin entrenamientos</Text>
          <Text style={styles.emptyText}>
            Guarda una sesión para verla reflejada en el calendario.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📅 Calendario</Text>
        <Text style={styles.subtitle}>Vista mensual del historial</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.monthCard}>
          <Pressable
            style={styles.monthNavButton}
            onPress={() => setMonthOffset((prev: number) => prev - 1)}
          >
            <Text style={styles.monthNavText}>⬅️</Text>
          </Pressable>

          <Text style={styles.monthTitle}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>

          <Pressable
            style={styles.monthNavButton}
            onPress={() => setMonthOffset((prev: number) => prev + 1)}
          >
            <Text style={styles.monthNavText}>➡️</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    marginTop: theme.spacing.md,
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
