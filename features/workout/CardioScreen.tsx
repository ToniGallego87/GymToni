import React, { useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Modal,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import { animateLayout } from '@lib/layoutAnimation';
import { theme } from '@lib/theme';
import {
  buildCardioWeeks,
  buildCardioMonths,
  formatMergedResults,
  CardioMonth,
  WeightSegment,
} from '@lib/cardio';
import {
  FloatingPrimaryNav,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  StretchScrollView,
} from '../../components';
import { WorkoutDay, WorkoutLog } from '../../types';

interface CardioScreenProps {
  onNavigateHome?: () => void;
  onNavigateCardio?: () => void;
  onNavigateRoutines?: () => void;
  onNavigateCalendar?: () => void;
  onNavigateData?: () => void;
  // Abre la vista de resultados (DetailScreen) del día de cardio pulsado.
  onSelectLog?: (log: WorkoutLog, day: WorkoutDay) => void;
}

// Cuántas semanas se muestran de inicio y cuántas añade "Cargar más".
const WEEKS_PAGE = 5;

// "29 jun" a partir de YYYY-MM-DD.
const dayMonth = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00`)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    .replace('.', '');

// Icono de la disciplina; distinto si hay pendiente (cuesta arriba).
function disciplineIcon(
  type: string,
  hasIncline: boolean
): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  const t = type.toLowerCase();
  if (hasIncline) return 'slope-uphill';
  if (t.includes('andar')) return 'walk';
  if (t.includes('bici')) return 'bike';
  if (t.includes('elíptica') || t.includes('eliptica')) return 'human-handsup';
  if (t.includes('correr') || t.includes('cinta') || t.includes('run'))
    return 'run-fast';
  return 'run';
}

// "jul" a partir de un mes.
const monthLabel = (m: CardioMonth) =>
  new Date(m.year, m.month, 1)
    .toLocaleDateString('es-ES', { month: 'short' })
    .replace('.', '');

type ChartMetric = {
  id: string;
  label: string;
  unit: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  get: (m: CardioMonth) => number | null;
  fmt: (v: number) => string;
};

const CHART_METRICS: ChartMetric[] = [
  {
    id: 'kcal',
    label: 'Kcal',
    unit: 'kcal',
    icon: 'fire',
    get: (m) => m.totalKcal,
    fmt: (v) => String(Math.round(v)),
  },
  {
    id: 'min',
    label: 'Minutos',
    unit: 'min',
    icon: 'clock-outline',
    get: (m) => m.totalMinutes,
    fmt: (v) => String(Math.round(v)),
  },
  {
    id: 'km',
    label: 'Distancia',
    unit: 'km',
    icon: 'map-marker-distance',
    get: (m) => m.totalKm,
    fmt: (v) => String(Math.round(v * 10) / 10),
  },
  {
    id: 'speed',
    label: 'Velocidad',
    unit: 'km/h',
    icon: 'speedometer',
    get: (m) => m.avgSpeed,
    fmt: (v) => String(Math.round(v * 10) / 10),
  },
];

// Gráfico compacto por MES de la métrica seleccionada. Color por tendencia (mes
// vs mes anterior) de esa métrica; el mes en curso, en amarillo.
function CardioMetricChart({
  months,
  width,
  metric,
}: {
  months: CardioMonth[];
  width: number;
  metric: ChartMetric;
}) {
  const points = months
    .map((m) => ({ m, value: metric.get(m) }))
    .filter((p): p is { m: CardioMonth; value: number } => {
      return p.value != null && p.value > 0;
    });
  if (points.length < 2) return null;

  const padding = { top: 18, right: 12, bottom: 26, left: 42 };
  const height = 170;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = points.map((p) => p.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  // La velocidad no arranca en 0 (rangos pequeños); el resto sí.
  const domainMin =
    metric.id === 'speed'
      ? Math.max(0, minVal - (maxVal - minVal) * 0.4 - 0.5)
      : 0;
  const span = maxVal - domainMin || maxVal || 1;
  const domainMax = maxVal + span * 0.15;

  const slotWidth = plotWidth / points.length;
  const barWidth = Math.max(18, Math.min(slotWidth * 0.55, 34));
  const getX = (i: number) =>
    padding.left + i * slotWidth + (slotWidth - barWidth) / 2;
  const getY = (value: number) => {
    if (domainMax === domainMin) return padding.top + plotHeight / 2;
    return (
      padding.top + ((domainMax - value) / (domainMax - domainMin)) * plotHeight
    );
  };
  const baseY = padding.top + plotHeight;
  const yTicks = [domainMax, (domainMax + domainMin) / 2, domainMin];

  return (
    <View style={styles.chartWrapper}>
      <View style={[styles.chart, { width }]}>
        {yTicks.map((tick, idx) => (
          <View
            key={`grid-${idx}`}
            style={[
              styles.chartGridLine,
              { top: getY(tick), left: padding.left, width: plotWidth },
            ]}
          />
        ))}

        {points.map((point, index) => {
          const x = getX(index);
          const y = getY(point.value);
          const barHeight = Math.max(baseY - y, 4);
          const isCurrent = point.m.isCurrent;
          const prev = index > 0 ? points[index - 1].value : null;
          const improved = prev == null ? null : point.value >= prev;
          const barColor = isCurrent
            ? theme.colors.primary
            : improved == null
            ? theme.colors.emoji_blue
            : improved
            ? theme.colors.success
            : theme.colors.error;

          return (
            <React.Fragment key={point.m.monthKey}>
              <View
                style={[
                  styles.chartBar,
                  {
                    left: x,
                    top: y,
                    height: barHeight,
                    width: barWidth,
                    backgroundColor: barColor,
                  },
                ]}
              />
              <Text
                style={[
                  styles.chartValueLabel,
                  { color: barColor, left: x + barWidth / 2 - 22, top: y - 16 },
                ]}
                numberOfLines={1}
              >
                {metric.fmt(point.value)}
              </Text>
              <Text
                style={[
                  styles.chartXLabel,
                  isCurrent && styles.chartXLabelCurrent,
                  { left: x + barWidth / 2 - 20, top: height - 18, width: 40 },
                ]}
                numberOfLines={1}
              >
                {monthLabel(point.m)}
              </Text>
            </React.Fragment>
          );
        })}

        {yTicks.map((tick, idx) => (
          <Text
            key={`y-${idx}`}
            style={[styles.chartYLabel, { top: getY(tick) - 8 }]}
          >
            {metric.fmt(tick)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function CardioScreen({
  onNavigateHome,
  onNavigateCardio,
  onNavigateRoutines,
  onNavigateCalendar,
  onNavigateData,
  onSelectLog,
}: CardioScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const { width: windowWidth } = useWindowDimensions();
  const [showChart, setShowChart] = useState(false);
  const [metricIdx, setMetricIdx] = useState(0);
  const [visibleCount, setVisibleCount] = useState(WEEKS_PAGE);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>(
    {}
  );
  // Historial de tramos de peso. Cada peso nuevo recalcula el tramo anterior si
  // se mete <1 semana después, o abre un tramo nuevo (sin recalcular) si es más.
  const [weightHistory, setWeightHistory] = useState<WeightSegment[]>([]);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('cardioWeightHistory');
        if (raw) {
          const parsed = JSON.parse(raw) as WeightSegment[];
          if (Array.isArray(parsed) && parsed.length) {
            setWeightHistory(parsed);
            return;
          }
        }
        // Migración del peso único antiguo a un primer tramo.
        const legacy = await AsyncStorage.getItem('cardioWeightKg');
        const n = legacy ? parseFloat(legacy) : NaN;
        if (Number.isFinite(n) && n > 0) {
          setWeightHistory([{ weight: n, appliesFrom: 0, setAt: 0 }]);
        }
      } catch {}
    })();
  }, []);

  // Recuperar la métrica de la gráfica guardada.
  useEffect(() => {
    AsyncStorage.getItem('cardioChartMetric')
      .then((id) => {
        const idx = CHART_METRICS.findIndex((m) => m.id === id);
        if (idx >= 0) setMetricIdx(idx);
      })
      .catch(() => {});
  }, []);

  const currentWeight = weightHistory.length
    ? weightHistory[weightHistory.length - 1].weight
    : null;

  const handleSaveWeight = async () => {
    const w = parseFloat(weightInput.replace(',', '.'));
    if (!Number.isFinite(w) || w <= 0) return;

    const now = Date.now();
    const WEEK_MS = 7 * 24 * 3600 * 1000;
    let next: WeightSegment[];
    if (weightHistory.length === 0) {
      // Primer peso: cubre todo lo anterior (appliesFrom 0).
      next = [{ weight: w, appliesFrom: 0, setAt: now }];
    } else {
      const last = weightHistory[weightHistory.length - 1];
      if (now - last.setAt < WEEK_MS) {
        // <1 semana: recalcula el tramo anterior (mismo appliesFrom, nuevo peso).
        next = [
          ...weightHistory.slice(0, -1),
          { ...last, weight: w, setAt: now },
        ];
      } else {
        // ≥1 semana: tramo nuevo desde ahora, sin tocar lo anterior.
        next = [...weightHistory, { weight: w, appliesFrom: now, setAt: now }];
      }
    }

    setWeightHistory(next);
    setShowWeightModal(false);
    try {
      await AsyncStorage.setItem('cardioWeightHistory', JSON.stringify(next));
    } catch {}
  };

  const weeks = useMemo(
    () => buildCardioWeeks(state.logs, weightHistory),
    [state.logs, weightHistory]
  );

  // Pulsar un día de cardio abre su vista de resultados (DetailScreen). Se
  // resuelve el log completo por id y su día dentro de las rutinas.
  const handleSessionPress = (logId: string) => {
    const log = state.logs.find((l) => l.id === logId);
    if (!log) return;
    let day: WorkoutDay | undefined;
    for (const routine of state.routines) {
      const found = routine.days.find((d) => d.id === log.dayId);
      if (found) {
        day = found;
        break;
      }
    }
    if (day) onSelectLog?.(log, day);
  };
  const months = useMemo(
    () => buildCardioMonths(state.logs, weightHistory),
    [state.logs, weightHistory]
  );
  // Más recientes primero.
  const orderedWeeks = useMemo(() => weeks.slice().reverse(), [weeks]);

  const todayKey = new Date().toISOString().split('T')[0];

  // Última semana YA TERMINADA (no la en curso) vs la media de las semanas con cardio.
  const completedWeeks = useMemo(
    () => weeks.filter((w) => !w.isCurrent),
    [weeks]
  );
  const lastWeek = completedWeeks.length
    ? completedWeeks[completedWeeks.length - 1]
    : null;
  const lastWeekKcal = lastWeek?.totalKcal ?? 0;
  const avgWeekKcal = useMemo(
    () =>
      completedWeeks.length
        ? completedWeeks.reduce((s, w) => s + w.totalKcal, 0) /
          completedWeeks.length
        : null,
    [completedWeeks]
  );
  const weekVsAvgPct =
    completedWeeks.length >= 2 && avgWeekKcal && avgWeekKcal > 0 && lastWeek
      ? ((lastWeekKcal - avgWeekKcal) / avgWeekKcal) * 100
      : null;

  // Totales acumulados (all-time) para el hero: no redundan con el día/semana.
  const totalSessionsAll = useMemo(
    () => weeks.reduce((s, w) => s + w.sessionCount, 0),
    [weeks]
  );
  const totalHoursAll = useMemo(() => {
    const h = weeks.reduce((s, w) => s + w.totalMinutes, 0) / 60;
    return Math.round(h * 10) / 10;
  }, [weeks]);

  // La gráfica es mensual; la métrica se elige con el selector.
  const kcalMonths = months.filter((m) => m.totalKcal > 0);
  const latestMonth = months[months.length - 1];
  const metric = CHART_METRICS[metricIdx];
  const latestMonthValue = latestMonth ? metric.get(latestMonth) : null;

  // Lista: 5 semanas más recientes (incluida la actual); "Cargar más" añade 5.
  const visibleWeeks = orderedWeeks.slice(0, visibleCount);
  const hasMore = orderedWeeks.length > visibleCount;

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: floatingNavBottom, scrollBottomPadding } =
    getFloatingPrimaryNavMetrics(insets.bottom);
  const chartWidth = Math.max(
    250,
    Math.min(windowWidth - theme.spacing.md * 2 - 20, 420)
  );

  const hasCardio = weeks.length > 0;

  // La tarjeta de la gráfica es siempre blanca.
  const progressAccent = theme.colors.white;

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <StretchScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topBarHeight + 28,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero informativo con el mismo aspecto que la HeroCard de Fuerza:
            gradiente opaco, sin borde y tipografía display. El cardio se registra
            dentro del día de fuerza, así que aquí solo resumimos. */}
        <LinearGradient
          colors={['#F9D85A', '#F7CC3D', '#E0B226']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroSheen}
            pointerEvents="none"
          />
          {!hasCardio ? (
            <Text style={styles.heroEmptyText}>
              Aún no hay cardio. Añádelo dentro de un día de fuerza.
            </Text>
          ) : lastWeek == null ? (
            <Text style={styles.heroEmptyText}>
              Aún no hay una semana completa. Sigue registrando cardio.
            </Text>
          ) : (
            <View>
              <Text style={styles.heroKicker}>
                {weekVsAvgPct == null
                  ? 'Última semana'
                  : 'Última semana vs tu media'}
              </Text>
              <View style={styles.heroCompareRow}>
                {weekVsAvgPct != null ? (
                  <>
                    <MaterialCommunityIcons
                      name={
                        weekVsAvgPct >= 0 ? 'arrow-up-bold' : 'arrow-down-bold'
                      }
                      size={22}
                      color={theme.colors.darkGray}
                    />
                    <Text style={styles.heroComparePct}>
                      {weekVsAvgPct >= 0 ? '+' : ''}
                      {Math.round(weekVsAvgPct)}%
                    </Text>
                  </>
                ) : (
                  <Text style={styles.heroComparePct}>
                    {Math.round(lastWeekKcal)} kcal
                  </Text>
                )}
              </View>
            </View>
          )}

          {hasCardio && (
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{totalSessionsAll}</Text>
                <Text style={styles.heroStatLabel}>sesiones</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>
                  {avgWeekKcal != null
                    ? `${Math.round(avgWeekKcal)} kcal`
                    : '—'}
                </Text>
                <Text style={styles.heroStatLabel}>media/sem</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{totalHoursAll} h</Text>
                <Text style={styles.heroStatLabel}>tiempo total</Text>
              </View>
            </View>
          )}

          <Pressable
            style={styles.heroWeightRow}
            onPress={() => {
              setWeightInput(
                currentWeight != null ? String(currentWeight) : ''
              );
              setShowWeightModal(true);
            }}
          >
            <MaterialCommunityIcons
              name="scale-bathroom"
              size={16}
              color={theme.colors.darkGray}
            />
            <Text style={styles.heroWeightText}>
              {currentWeight != null
                ? `Peso: ${currentWeight} kg`
                : 'Pulsa para indicar tu peso'}
            </Text>
          </Pressable>
        </LinearGradient>

        {kcalMonths.length >= 2 && (
          <View style={[styles.progressCard, { borderColor: progressAccent }]}>
            <GradientFill accent={progressAccent} />
            <TouchableOpacity
              style={styles.progressToggle}
              activeOpacity={0.85}
              onPress={() => {
                animateLayout();
                setShowChart((prev) => !prev);
              }}
            >
              <View style={styles.progressHeaderRow}>
                <View style={styles.progressTitleRow}>
                  <MaterialCommunityIcons
                    name={metric.icon}
                    size={18}
                    color={theme.colors.text}
                  />
                  <Text style={styles.progressTitle}>{metric.label} / mes</Text>
                  <MaterialCommunityIcons
                    name={showChart ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.colors.text}
                  />
                </View>
                {latestMonthValue != null && (
                  <Text
                    style={[
                      styles.progressLatestKcal,
                      metric.id === 'kcal' && { color: theme.colors.primary },
                    ]}
                  >
                    {metric.fmt(latestMonthValue)} {metric.unit}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {showChart && (
              <>
                <CardioMetricChart
                  months={months}
                  width={chartWidth}
                  metric={metric}
                />
                <TouchableOpacity
                  style={styles.chartFilterButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    animateLayout();
                    const next = (metricIdx + 1) % CHART_METRICS.length;
                    setMetricIdx(next);
                    AsyncStorage.setItem(
                      'cardioChartMetric',
                      CHART_METRICS[next].id
                    ).catch(() => {});
                  }}
                >
                  <MaterialCommunityIcons
                    name="autorenew"
                    size={16}
                    color={theme.colors.text}
                  />
                  <Text style={styles.chartFilterButtonText} numberOfLines={1}>
                    {metric.label}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {visibleWeeks.map((week) => {
          const isExpanded = expandedWeeks[week.weekKey] ?? week.isCurrent;
          // Tarjeta: siempre blanca salvo la semana en curso (amarilla). El
          // verde/rojo solo se usa en el dato de subida/bajada (kcalDelta).
          const accent = week.isCurrent
            ? theme.colors.primary
            : theme.colors.white;

          return (
            <View key={week.weekKey} style={styles.weekBlock}>
              <Pressable
                style={[styles.weekHeader, { borderColor: accent }]}
                onPress={() => {
                  animateLayout();
                  setExpandedWeeks((prev) => ({
                    ...prev,
                    [week.weekKey]: !isExpanded,
                  }));
                }}
              >
                <GradientFill accent={accent} />
                <View style={styles.weekTitleRow}>
                  <Text
                    style={[styles.weekTitle, { color: accent }]}
                    numberOfLines={1}
                  >
                    {dayMonth(week.weekStart)} – {dayMonth(week.weekEnd)}
                  </Text>
                  {/* Arriba a la derecha: diferencia de kcal vs semana anterior.
                      La semana en curso no la muestra (aún está acumulando). */}
                  {week.kcalDelta != null && !week.isCurrent && (
                    <View style={styles.deltaRow}>
                      <MaterialCommunityIcons
                        name={
                          week.kcalDelta >= 0
                            ? 'arrow-up-bold'
                            : 'arrow-down-bold'
                        }
                        size={15}
                        color={
                          week.kcalDelta >= 0
                            ? theme.colors.success
                            : theme.colors.error
                        }
                      />
                      <Text
                        style={[
                          styles.weekDelta,
                          week.kcalDelta >= 0
                            ? styles.progressLatestUp
                            : styles.progressLatestDown,
                        ]}
                      >
                        {Math.round(Math.abs(week.kcalDelta))} kcal
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.weekMetaRow}>
                  <Text style={styles.weekMeta}>
                    {week.sessionCount}{' '}
                    {week.sessionCount === 1 ? 'sesión' : 'sesiones'}
                  </Text>
                  <MaterialCommunityIcons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </View>
              </Pressable>

              {isExpanded &&
                week.sessions
                  .slice()
                  .reverse()
                  .map((session, sIdx) => {
                    const d = new Date(`${session.date}T00:00:00`);
                    const weekday = d.toLocaleDateString('es-ES', {
                      weekday: 'long',
                    });
                    const weekdayCap =
                      weekday.charAt(0).toUpperCase() + weekday.slice(1);
                    const dateStr = d.toLocaleDateString('es-ES');
                    const isToday = session.date === todayKey;
                    return session.disciplines.map((entry, eIdx) => {
                      const hasIncline =
                        entry.maxPendiente != null && entry.maxPendiente > 0;
                      return (
                        <Animated.View
                          key={`${session.logId}-${eIdx}`}
                          entering={FadeInDown.duration(200).delay(sIdx * 40)}
                        >
                          <Pressable
                            onPress={() => handleSessionPress(session.logId)}
                            style={({ pressed }) => [
                              styles.dailyCard,
                              isToday && styles.dailyCardToday,
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <View style={styles.dailyHeader}>
                              <View style={styles.dailyLeft}>
                                <MaterialCommunityIcons
                                  name={disciplineIcon(entry.type, hasIncline)}
                                  size={30}
                                  color={theme.colors.white}
                                  style={styles.dailyAccent}
                                />
                                <View style={styles.dailyInfo}>
                                  <Text
                                    style={[
                                      styles.dailyName,
                                      isToday && styles.dailyTextToday,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {entry.type}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.dailyResults,
                                      isToday && styles.dailyTextToday,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {formatMergedResults(entry)}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.dailyRight}>
                                <Text
                                  style={styles.dailyDate}
                                  numberOfLines={1}
                                >
                                  <Text
                                    style={[
                                      styles.dailyWeekday,
                                      isToday && styles.dailyTextToday,
                                    ]}
                                  >
                                    {weekdayCap}{' '}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.dailyDateBold,
                                      isToday && styles.dailyTextToday,
                                    ]}
                                  >
                                    {dateStr}
                                  </Text>
                                </Text>
                                <Text
                                  style={[
                                    styles.dailyBadge,
                                    isToday && styles.dailyTextToday,
                                  ]}
                                >
                                  {Math.round(entry.kcal)} kcal
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        </Animated.View>
                      );
                    });
                  })}
            </View>
          );
        })}

        {hasMore && (
          <TouchableOpacity
            style={styles.showMoreButton}
            activeOpacity={0.8}
            onPress={() => {
              animateLayout();
              setVisibleCount((c) => c + WEEKS_PAGE);
            }}
          >
            <MaterialCommunityIcons
              name="reload"
              size={16}
              color={theme.colors.text}
            />
            <Text style={styles.showMoreText}>Cargar más</Text>
          </TouchableOpacity>
        )}
      </StretchScrollView>

      <FloatingPrimaryNav
        bottom={floatingNavBottom}
        activeTab="cardio"
        onPressHome={onNavigateHome}
        onPressCardio={onNavigateCardio}
        onPressRoutines={onNavigateRoutines}
        onPressCalendar={onNavigateCalendar}
        onPressData={onNavigateData}
      />

      <GlassTopBar
        title="Cardio"
        titleElement={
          <View style={styles.topBarTitleRow}>
            <MaterialCommunityIcons
              name="run-fast"
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.topBarTitleText}>Cardio</Text>
          </View>
        }
        subtitle="Consulta tus resultados"
        topInset={insets.top}
      />

      <Modal
        visible={showWeightModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWeightModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tu peso</Text>
            <Text style={styles.modalHint}>
              Se usa para estimar las kcalorías del cardio. Al cambiarlo, todas
              se recalculan.
            </Text>
            <View style={styles.weightInputRow}>
              <TextInput
                style={styles.weightInput}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
                placeholder="70"
                placeholderTextColor={theme.colors.textSecondary}
                maxLength={5}
                autoFocus
              />
              <Text style={styles.weightUnit}>kg</Text>
            </View>
            <TouchableOpacity
              style={styles.weightSaveButton}
              onPress={handleSaveWeight}
            >
              <Text style={styles.weightSaveText}>Guardar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.weightCancelButton}
              onPress={() => setShowWeightModal(false)}
            >
              <Text style={styles.weightCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
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
  hero: {
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 20,
    paddingVertical: 14,
    // Misma altura mínima que la HeroCard de Fuerza, centrando el contenido
    // para que empty-state y estado con stats ocupen la tarjeta por igual.
    minHeight: 172,
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  heroSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: theme.colors.darkGray,
    opacity: 0.75,
    marginBottom: 6,
  },
  heroCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroComparePct: {
    fontFamily: theme.fonts.display,
    fontSize: 30,
    lineHeight: 36,
    // Anton pega el glifo al borde superior de su caja; sin esto el número
    // queda más alto que la flecha de al lado. includeFontPadding:false +
    // translateY lo baja para centrarlo con el icono (mismo patrón que weekTitle).
    includeFontPadding: false,
    transform: [{ translateY: 4 }],
    color: theme.colors.darkGray,
  },
  heroEmptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.darkGray,
    opacity: 0.8,
    lineHeight: 20,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 19, 24, 0.16)',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(16, 19, 24, 0.16)',
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.darkGray,
  },
  heroStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.darkGray,
    opacity: 0.8,
    marginTop: 2,
  },
  heroWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 19, 24, 0.16)',
  },
  heroWeightText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.darkGray,
  },
  progressCard: {
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  progressToggle: {
    width: '100%',
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.5,
    color: theme.colors.text,
    lineHeight: 24,
    includeFontPadding: false,
    textAlignVertical: 'center',
    transform: [{ translateY: 3 }],
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  progressLatestKcal: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.white,
  },
  progressLatestUp: {
    color: theme.colors.success,
  },
  progressLatestDown: {
    color: theme.colors.error,
  },
  chartWrapper: {
    marginTop: 18,
    alignItems: 'center',
  },
  chartFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  chartFilterButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  chart: {
    height: 170,
    position: 'relative',
  },
  chartGridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: theme.colors.border,
  },
  chartBar: {
    position: 'absolute',
    borderRadius: 6,
  },
  chartValueLabel: {
    position: 'absolute',
    width: 44,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  chartXLabel: {
    position: 'absolute',
    textAlign: 'center',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  chartXLabelCurrent: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  chartYLabel: {
    position: 'absolute',
    left: 0,
    width: 38,
    textAlign: 'right',
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  weekBlock: {
    marginBottom: 10,
  },
  weekHeader: {
    borderRadius: theme.borderRadius.sm,
    borderLeftWidth: 5,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  weekTitle: {
    fontSize: 21,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.5,
    lineHeight: 26,
    includeFontPadding: false,
    transform: [{ translateY: 3 }],
  },
  weekDelta: {
    fontSize: 14,
    fontWeight: '800',
  },
  weekMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  weekMeta: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  // Tarjeta diaria con el mismo formato/tamaño que las de Inicio (Fuerza).
  dailyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  dailyCardToday: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryMuted,
  },
  dailyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  dailyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dailyAccent: {
    marginRight: 12,
  },
  dailyInfo: {
    flex: 1,
  },
  dailyName: {
    fontSize: 19,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.3,
    color: theme.colors.text,
    lineHeight: 22,
  },
  dailyResults: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  dailyRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  dailyDate: {
    fontSize: 14,
    lineHeight: 16,
    textAlign: 'right',
  },
  dailyWeekday: {
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  dailyDateBold: {
    fontWeight: '800',
    color: theme.colors.text,
  },
  dailyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.pill,
    fontSize: 15,
    fontFamily: theme.fonts.display,
    fontWeight: '800',
    lineHeight: 18,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  dailyTextToday: {
    color: theme.colors.primary,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 2,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  weightInput: {
    backgroundColor: theme.colors.darkGray,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    minWidth: 120,
  },
  weightUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  weightSaveButton: {
    backgroundColor: theme.colors.success,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  weightSaveText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.background,
  },
  weightCancelButton: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  weightCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
});
