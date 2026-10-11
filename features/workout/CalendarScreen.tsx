import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  DayAccentIcon,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  OptionToggle,
  OptionToggleOption,
  StretchScrollView,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import {
  cardioSessionFromLog,
  CardioDay,
  CardioSession,
  CARDIO_ONLY_DAY,
  groupSessionsByDay,
  isCardioOnlyLog,
  topDisciplineIconName,
} from '@lib/cardio';
import { animateLayout } from '@lib/layoutAnimation';
import { WorkoutDay, WorkoutLog, WorkoutRoutine } from '../../types';
import { theme, getTrainingAccent, getDisplayDayName } from '@lib/theme';
import { t } from '@lib/i18n';
import { findDayInRoutines, getToday } from '@lib/utils';
import { groupLogsIntoWeekBlocks } from '@lib/weeks';

type CalendarMode = 'fuerza' | 'cardio';

// Rótulos con getter: t() se evalúa al pintar, no al cargar el módulo, así
// que siguen al idioma en caliente (ver lib/i18n.ts).
const MODE_OPTIONS: OptionToggleOption<CalendarMode>[] = [
  {
    value: 'fuerza',
    get label() {
      return t('Fuerza');
    },
    icon: 'dumbbell',
  },
  {
    value: 'cardio',
    get label() {
      return t('Cardio');
    },
    icon: 'run-fast',
  },
];

// Icono de la celda de cardio: la disciplina que más kcal quemó ese día (cuesta
// arriba si la hizo con pendiente).
const cardioDayIcon = (
  day: CardioDay
): React.ComponentProps<typeof MaterialCommunityIcons>['name'] => {
  return topDisciplineIconName(day) as React.ComponentProps<
    typeof MaterialCommunityIcons
  >['name'];
};

interface CalendarScreenProps {
  onSelectLog: (log: WorkoutLog, day: WorkoutDay) => void;
  // Reabre la inserción de una sesión de solo cardio ya registrada (solo hoy).
  onEditCardioOnly?: (log: WorkoutLog) => void;
  // Salida del estado vacío: empezar un entreno o crear la primera rutina.
  emptyAction?: { label: string; onPress: () => void };
  // Celda pasada sin entreno de fuerza: apuntar el entreno olvidado de ese día.
  onLogForgottenDay?: (date: string) => void;
  // Celda pasada sin cardio (modo Cardio): apuntar el cardio olvidado de ese día.
  onLogForgottenCardio?: (date: string) => void;
}

export function CalendarScreen({
  onSelectLog,
  onEditCardioOnly,
  emptyAction,
  onLogForgottenDay,
  onLogForgottenCardio,
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
  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { scrollBottomPadding } = getFloatingPrimaryNavMetrics(insets.bottom);

  const getDayById = (dayId: string) =>
    findDayInRoutines(state.routines, dayId);

  // Celda pasada vacía que se puede tocar para apuntar lo olvidado (fuerza o
  // cardio): borde discontinuo (`dayCellLoggable`) y un "+" tenue donde iría el
  // icono, para que se note que responde frente a las que no (futuro).
  const renderLoggableEmpty = (dayNumber: number) => (
    <>
      <Text style={styles.dayNumber}>{dayNumber}</Text>
      <View style={styles.dayIconSlot}>
        <MaterialCommunityIcons
          name="plus"
          size={20}
          color={theme.colors.textMuted}
        />
      </View>
      <View style={styles.dayWeekSpacer} />
    </>
  );

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

  // Clave de día del mes visible sin el día ("2026-07-"): con ella se filtran
  // los entrenos del mes y se arma la clave de cada celda.
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(
    2,
    '0'
  )}-`;

  // Rutinas que aparecen en el mes visible. La celda de fuerza rotula la suya
  // con su inicial numerada ("R1", "R2"…) y la leyenda de debajo la resuelve a
  // su nombre. Sale SIEMPRE que haya alguna, también con una sola en el mes: el
  // chip no solo distingue entre rutinas, también dice DE QUÉ rutina es ese
  // entreno (y su color, si sigue activa o ya está cerrada).
  const monthRoutines = useMemo(() => {
    const found = new Map<
      string,
      { id: string; index: number; name: string }
    >();
    state.logs.forEach((log: WorkoutLog) => {
      if (!log.date?.startsWith(monthPrefix)) return;
      // Solo los logs de fuerza: son los únicos que pintan el chip.
      if (!getDayById(log.dayId)) return;
      if (found.has(log.routineId)) return;
      const index = state.routines.findIndex(
        (routine: WorkoutRoutine) => routine.id === log.routineId
      );
      if (index < 0) return;
      found.set(log.routineId, {
        id: log.routineId,
        index,
        name: state.routines[index].name,
      });
    });
    return [...found.values()].sort((a, b) => a.index - b.index);
  }, [state.logs, state.routines, monthPrefix]);

  const showRoutineChip = monthRoutines.length > 0;

  // Subtítulo de la barra: lo que hay en el mes visible, del modo que se mira.
  const monthCount =
    mode === 'fuerza'
      ? new Set(
          state.logs
            .filter(
              (log: WorkoutLog) =>
                log.date?.startsWith(monthPrefix) && !!getDayById(log.dayId)
            )
            .map((log: WorkoutLog) => log.date)
        ).size
      : Object.keys(cardioByDate).filter((date) => date.startsWith(monthPrefix))
          .length;
  const monthName = MONTH_NAMES[currentMonth].toLowerCase();
  const monthSubtitle =
    mode === 'fuerza'
      ? monthCount === 1
        ? t('1 entreno en {month}', { month: monthName })
        : t('{n} entrenos en {month}', { n: monthCount, month: monthName })
      : monthCount === 1
      ? t('1 día de cardio en {month}', { month: monthName })
      : t('{n} días de cardio en {month}', { n: monthCount, month: monthName });

  // ¿Hay cardio en el mes visible? Decide si el modo cardio pinta su leyenda,
  // igual que `monthRoutines` decide la del modo fuerza.
  const monthHasCardio = useMemo(
    () =>
      Object.keys(cardioByDate).some((date) => date.startsWith(monthPrefix)),
    [cardioByDate, monthPrefix]
  );

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
    `${monthPrefix}${String(dayNumber).padStart(2, '0')}`;

  const todayKey = getToday();

  if (state.logs.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar
          style={theme.statusBarStyle}
          translucent
          backgroundColor="transparent"
        />

        <View
          style={[
            styles.emptyState,
            { paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP },
          ]}
        >
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
          {/* Un vacío que solo describe el vacío deja al usuario nuevo
              tocando pestañas; este apunta al siguiente paso. */}
          {!!emptyAction && (
            <Button
              title={emptyAction.label}
              onPress={emptyAction.onPress}
              variant="primary"
              size="medium"
              style={styles.emptyButton}
            />
          )}
        </View>

        {/* Sin entrenos no hay dato que contar: sin subtítulo. */}
        <GlassTopBar
          title={t('Calendario')}
          icon="calendar-month-outline"
          topInset={insets.top}
          onLayout={onTopBarLayout}
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

      {/* Mes, Fuerza/Cardio y días de la semana quedan FIJOS: son los mandos
          y la clave de lectura de la rejilla, y al hacer scroll se iban con
          ella. Solo el mes (y sus chuletas) se desplaza. */}
      <View
        style={[
          styles.fixedHeader,
          { paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP },
        ]}
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
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('Mes anterior')}
            accessibilityState={{ disabled: !canGoPrev }}
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
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('Mes siguiente')}
            accessibilityState={{ disabled: !canGoNext }}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={theme.colors.text}
            />
          </Pressable>
        </View>

        {/* Elegir una de dos = `OptionToggle`, el mismo componente (y el mismo
            estado activo translúcido) que Configuración y Datos. Antes esto era
            un par de botones a mano con relleno dorado sólido: otra piel para la
            misma tarea. */}
        <OptionToggle
          style={styles.modeToggle}
          options={MODE_OPTIONS}
          value={mode}
          onChange={(next) => {
            animateLayout();
            setMode(next);
          }}
        />

        <View style={styles.weekHeader}>
          {WEEK_DAYS.map((label) => (
            <Text key={label} style={styles.weekHeaderText}>
              {label}
            </Text>
          ))}
        </View>
      </View>

      <StretchScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
              // Día pasado sin cardio: se puede apuntar el cardio olvidado
              // (mismo patrón que la fuerza, más abajo).
              const canLogCardio =
                !hasCardio && dateKey < todayKey && !!onLogForgottenCardio;

              return (
                <Pressable
                  key={dateKey}
                  disabled={!hasCardio && !canLogCardio}
                  accessibilityRole={
                    hasCardio || canLogCardio ? 'button' : undefined
                  }
                  accessibilityLabel={
                    hasCardio
                      ? `${dayNumber} ${MONTH_NAMES[currentMonth]}. ${t(
                          'Cardio'
                        )}, ${Math.round(cardio.cardioDay.totalMinutes)} min`
                      : canLogCardio
                      ? `${dayNumber} ${MONTH_NAMES[currentMonth]}. ${t(
                          'Apuntar cardio olvidado'
                        )}`
                      : `${dayNumber} ${MONTH_NAMES[currentMonth]}`
                  }
                  onPress={() => {
                    if (canLogCardio) {
                      onLogForgottenCardio?.(dateKey);
                      return;
                    }
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
                    canLogCardio && styles.dayCellLoggable,
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
                      {/* Número y unidad en Text separados: si fueran uno
                          solo, adjustsFontSizeToFit en Android corta en el
                          espacio y se come el "min". Así el "min" (fijo,
                          pequeño) sale siempre y es el número el que encoge
                          lo que haga falta. */}
                      <View style={styles.dayMinutesRow}>
                        <Text
                          style={[
                            styles.dayWeekLabel,
                            styles.dayMinutesValue,
                            { color: theme.colors.textSecondary },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.4}
                        >
                          {Math.round(cardio.cardioDay.totalMinutes)}
                        </Text>
                        <Text
                          style={[
                            styles.dayMinutesUnit,
                            { color: theme.colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          min
                        </Text>
                      </View>
                    </>
                  ) : canLogCardio ? (
                    renderLoggableEmpty(dayNumber)
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
            // Día pasado sin fuerza: se puede apuntar el entreno olvidado.
            const canLogForgotten =
              !hasLogs && dateKey < todayKey && !!onLogForgottenDay;
            const cellDate = `${dayNumber} ${MONTH_NAMES[currentMonth]}`;

            return (
              <Pressable
                key={dateKey}
                disabled={!hasLogs && !canLogForgotten}
                onPress={() => {
                  if (primaryLog && primaryDay) {
                    onSelectLog(primaryLog, primaryDay);
                  } else if (canLogForgotten) {
                    onLogForgottenDay?.(dateKey);
                  }
                }}
                accessibilityRole={
                  hasLogs || canLogForgotten ? 'button' : undefined
                }
                accessibilityLabel={
                  hasLogs && primaryDay
                    ? `${cellDate}. ${getDisplayDayName(primaryDay.name)}${
                        typeof weekNumber === 'number'
                          ? `, ${t('Semana')} ${weekNumber}`
                          : ''
                      }`
                    : canLogForgotten
                    ? `${cellDate}. ${t('Apuntar entreno olvidado')}`
                    : cellDate
                }
                style={[
                  styles.dayCell,
                  hasLogs && styles.dayCellActive,
                  hasLogs && { borderColor: dayBorderColor },
                  canLogForgotten && styles.dayCellLoggable,
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
                      {showRoutineChip && routineIndex >= 0 && (
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
                    {/* Pie: semana (bloque) dentro de la rutina. Rotulada
                        ("Sem 3", no "S3"): el hueco lo comparte con los minutos
                        del modo cardio, así que cada uno dice su unidad y
                        ninguno necesita chuleta. */}
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
                        {t('Sem {n}', { n: weekNumber })}
                      </Text>
                    ) : (
                      <View style={styles.dayWeekSpacer} />
                    )}
                  </>
                ) : canLogForgotten ? (
                  renderLoggableEmpty(dayNumber)
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

        {/* Chuleta de lo que rotula la celda, justo DEBAJO de la rejilla (decisión
            de producto: primero el mes, luego su explicación). Solo aparece
            cuando hay algo que descifrar (varias rutinas en el mes). */}
        {mode === 'fuerza' && showRoutineChip && (
          <View style={styles.legend}>
            {monthRoutines.map((routine) => {
              // El mismo color que el chip de la celda: la rutina activa en oro
              // y las cerradas en gris. Antes la leyenda pintaba todas en oro,
              // así que una rutina vieja salía gris arriba y amarilla aquí.
              const isActive = routine.id === state.activeRoutineId;
              return (
                <View key={routine.index} style={styles.legendRow}>
                  <Text
                    style={[
                      styles.legendCode,
                      !isActive && styles.legendCodeInactive,
                    ]}
                  >
                    R{routine.index + 1}
                  </Text>
                  <Text style={styles.legendText} numberOfLines={1}>
                    {routine.name}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Las celdas vacías pasadas se pueden tocar: se dice aquí, en vez de
            llenar el mes de "+". */}
        {mode === 'fuerza' && !!onLogForgottenDay && (
          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <View style={styles.legendIcon}>
                <MaterialCommunityIcons
                  name="calendar-plus"
                  size={15}
                  color={theme.colors.textSecondary}
                />
              </View>
              <Text style={styles.legendText}>
                {t('Toca un día vacío para apuntar un entreno olvidado')}
              </Text>
            </View>
          </View>
        )}

        {mode === 'cardio' && !!onLogForgottenCardio && (
          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <View style={styles.legendIcon}>
                <MaterialCommunityIcons
                  name="calendar-plus"
                  size={15}
                  color={theme.colors.textSecondary}
                />
              </View>
              <Text style={styles.legendText}>
                {t('Toca un día vacío para apuntar un cardio olvidado')}
              </Text>
            </View>
          </View>
        )}

        {/* El modo cardio también tiene su chuleta: el icono de la celda NO es
            "el cardio" sino la disciplina que más quemó ese día. */}
        {mode === 'cardio' && monthHasCardio && (
          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <View style={styles.legendIcon}>
                <MaterialCommunityIcons
                  name="run-fast"
                  size={15}
                  color={theme.colors.textSecondary}
                />
              </View>
              <Text style={styles.legendText}>
                {t('La disciplina que más calorías quemó ese día')}
              </Text>
            </View>
          </View>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Calendario')}
        icon="calendar-month-outline"
        subtitle={monthSubtitle}
        topInset={insets.top}
        onLayout={onTopBarLayout}
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
    fixedHeader: {
      paddingHorizontal: theme.spacing.md,
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
      // Poco relleno: las flechas ya miden 48 (zona de toque recomendada).
      paddingHorizontal: 4,
      paddingVertical: 2,
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
      minWidth: 48,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
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
    // Día pasado vacío que se puede apuntar: discontinuo = "hueco por rellenar".
    dayCellLoggable: {
      borderStyle: 'dashed',
      borderColor: theme.colors.textMuted,
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
    // Pie de la celda: metadato discreto y centrado. Lo comparten los dos
    // modos —"Sem 3" en fuerza y "45 min" en cardio—, así que cada uno dice su
    // unidad en la propia celda: el mismo hueco con la misma letra no puede
    // significar dos magnitudes sin rotularlas.
    dayWeekLabel: {
      fontFamily: theme.fonts.display,
      fontSize: 15,
      letterSpacing: 0.5,
      lineHeight: 21,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    // Mismo alto que la etiqueta "Sem N" del modo fuerza (lineHeight 21).
    dayMinutesRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      height: 21,
      gap: 1,
    },
    dayMinutesValue: {
      flexShrink: 1,
      letterSpacing: 0,
    },
    dayMinutesUnit: {
      flexShrink: 0,
      fontFamily: theme.fonts.display,
      fontSize: 10,
      lineHeight: 21,
      letterSpacing: 0,
    },
    dayWeekSpacer: {
      height: 19,
    },
    // Toggle Fuerza/Cardio bajo la cabecera de mes. La piel la pone
    // `OptionToggle`; aquí solo su hueco.
    modeToggle: {
      marginBottom: 14,
    },
    // Chuleta de lo que rotula la celda (R# = rutina), bajo la rejilla.
    legend: {
      marginTop: 14,
      gap: 6,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendCode: {
      minWidth: 26,
      textAlign: 'center',
      color: theme.colors.primary,
      backgroundColor: theme.colors.primaryMuted,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
      overflow: 'hidden',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.2,
      lineHeight: 15,
    },
    // Rutina ya cerrada: el gris del chip de su celda.
    legendCodeInactive: {
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.surfaceAlt,
    },
    // Mismo hueco que `legendCode` para que las filas de la leyenda queden
    // alineadas cuando lo que se explica es un icono y no un código.
    legendIcon: {
      minWidth: 26,
      alignItems: 'center',
    },
    legendText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emptyButton: {
      marginTop: 18,
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
