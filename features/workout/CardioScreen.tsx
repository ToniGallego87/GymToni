import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import { useDeferredReady } from '@hooks/useDeferredReady';
import { getToday } from '@lib/utils';
import { animateLayout } from '@lib/layoutAnimation';
import { theme } from '@lib/theme';
import { dayNameText, weekTitleText } from '@lib/textStyles';
import { t, dateLocale, localizeDecimals, parseTypedNumber } from '@lib/i18n';
import {
  buildCardioDays,
  buildCardioWeeks,
  buildCardioMonths,
  disciplineIconName,
  formatMergedResults,
  fmtNum,
  hasIncline,
  CardioDay,
  CardioMonth,
  CARDIO_ONLY_DAY,
  isCardioOnlyLog,
  WeightSegment,
} from '@lib/cardio';
import { getCardioWeightHistory, setCardioWeightHistory } from '@lib/storage';
import {
  AppModal,
  BarChart,
  BarChartPoint,
  Button,
  Collapsible,
  FloatingPrimaryNav,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  HeroCard,
  HeroCarousel,
  HeroStatsCard,
  HeroWeightCard,
  SegmentedFilter,
  SegmentedOption,
  StretchScrollView,
  TrendDelta,
  LoadMoreButton,
} from '../../components';
import { WorkoutDay, WorkoutLog } from '../../types';

interface CardioScreenProps {
  onNavigateHome?: () => void;
  onNavigateCardio?: () => void;
  onNavigateCalendar?: () => void;
  onNavigateCommunity?: () => void;
  onNavigateProfile?: () => void;
  // Abre la vista de resultados (DetailScreen) del día de cardio pulsado.
  onSelectLog?: (log: WorkoutLog, day: WorkoutDay) => void;
  // Abre la vista de registro del cardio (la usan el hero y el día de hoy, que
  // sigue vivo). Precarga sola todo el cardio que ya tenga ese día.
  onInsertCardioOnly?: () => void;
}

// Cuántas semanas se muestran de inicio y cuántas añade "Cargar más".
const WEEKS_PAGE = 5;

// "29 jun" a partir de YYYY-MM-DD.
const dayMonth = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00`)
    .toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })
    .replace('.', '');

// Icono de la disciplina (cuesta arriba si hay pendiente): la lógica vive en
// lib/cardio (disciplineIconName); aquí solo se castea al tipo del icono.
const disciplineIcon = (
  type: string,
  incline: boolean
): React.ComponentProps<typeof MaterialCommunityIcons>['name'] =>
  disciplineIconName(type, incline) as React.ComponentProps<
    typeof MaterialCommunityIcons
  >['name'];

// "jul" a partir de un mes.
const monthLabel = (m: CardioMonth) =>
  new Date(m.year, m.month, 1)
    .toLocaleDateString(dateLocale, { month: 'short' })
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
    label: t('Minutos'),
    unit: 'min',
    icon: 'clock-outline',
    get: (m) => m.totalMinutes,
    fmt: (v) => String(Math.round(v)),
  },
  {
    id: 'km',
    label: t('Distancia'),
    unit: 'km',
    icon: 'map-marker-distance',
    get: (m) => m.totalKm,
    // fmtNum redondea a 1 decimal y lo pinta en el separador del idioma.
    fmt: fmtNum,
  },
  {
    id: 'speed',
    label: t('Velocidad'),
    unit: 'km/h',
    icon: 'speedometer',
    get: (m) => m.avgSpeed,
    fmt: fmtNum,
  },
];

// Opciones del filtro de la gráfica, en el mismo orden que CHART_METRICS.
const METRIC_OPTIONS: SegmentedOption<string>[] = CHART_METRICS.map(
  (chartMetric) => ({
    id: chartMetric.id,
    label: chartMetric.label,
    icon: chartMetric.icon,
  })
);

// Traduce los meses a barras de la métrica seleccionada: color por tendencia
// (mes vs mes anterior) y el mes en curso en amarillo. El dibujo lo hace
// <BarChart/> (compartido con la gráfica de progreso de Inicio).
function buildMetricChart(
  months: CardioMonth[],
  metric: ChartMetric
): { bars: BarChartPoint[]; domain: { min: number; max: number } } | null {
  const points = months
    .map((month) => ({ month, value: metric.get(month) }))
    .filter((point): point is { month: CardioMonth; value: number } => {
      return point.value != null && point.value > 0;
    });
  if (points.length < 2) return null;

  const values = points.map((point) => point.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  // La velocidad no arranca en 0 (rangos pequeños); el resto sí.
  const domainMin =
    metric.id === 'speed'
      ? Math.max(0, minVal - (maxVal - minVal) * 0.4 - 0.5)
      : 0;
  const span = maxVal - domainMin || maxVal || 1;

  const bars = points.map((point, index) => {
    const isCurrent = point.month.isCurrent;
    const prev = index > 0 ? points[index - 1].value : null;
    const improved = prev == null ? null : point.value >= prev;
    const color = isCurrent
      ? theme.colors.primaryFill
      : improved == null
      ? theme.colors.emoji_blue
      : improved
      ? theme.colors.success
      : theme.colors.error;

    return {
      key: point.month.monthKey,
      value: point.value,
      label: monthLabel(point.month),
      valueLabel: metric.fmt(point.value),
      color,
      // La etiqueta es texto sobre la tarjeta: el mes en curso necesita la
      // tinta, no el oro de línea de su barra (ver theme.ts).
      valueColor: isCurrent ? theme.colors.primary : color,
      highlighted: isCurrent,
    };
  });

  return { bars, domain: { min: domainMin, max: maxVal + span * 0.15 } };
}

export function CardioScreen({
  onNavigateHome,
  onNavigateCardio,
  onNavigateCalendar,
  onNavigateCommunity,
  onNavigateProfile,
  onSelectLog,
  onInsertCardioOnly,
}: CardioScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  // El hero se pinta al instante; la gráfica y el historial de semanas (lo caro
  // de Cardio) se difieren un frame para que abrir Cardio sea ágil.
  const ready = useDeferredReady();
  const { width: windowWidth } = useWindowDimensions();
  const [showChart, setShowChart] = useState(false);
  const [metricIdx, setMetricIdx] = useState(0);
  const [visibleCount, setVisibleCount] = useState(WEEKS_PAGE);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>(
    {}
  );
  // Historial de tramos de peso. Cada peso nuevo recalcula el tramo anterior si
  // se mete <1 día después, o abre un tramo nuevo (sin recalcular) si es más.
  const [weightHistory, setWeightHistory] = useState<WeightSegment[]>([]);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');

  useEffect(() => {
    getCardioWeightHistory()
      .then((history) => {
        if (history.length) setWeightHistory(history);
      })
      .catch(() => {});
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

  const openWeightModal = () => {
    // Se edita en el separador del idioma; parseTypedNumber lo lee igual.
    setWeightInput(
      currentWeight != null ? localizeDecimals(String(currentWeight)) : ''
    );
    setShowWeightModal(true);
  };

  const handleSaveWeight = async () => {
    const w = parseTypedNumber(weightInput);
    if (!Number.isFinite(w) || w <= 0) return;

    const now = Date.now();
    const DAY_MS = 24 * 3600 * 1000;
    let next: WeightSegment[];
    if (weightHistory.length === 0) {
      // Primer peso: cubre todo lo anterior (appliesFrom 0).
      next = [{ weight: w, appliesFrom: 0, setAt: now }];
    } else {
      const last = weightHistory[weightHistory.length - 1];
      if (now - last.setAt < DAY_MS) {
        // <1 día: recalcula el tramo anterior (mismo appliesFrom, nuevo peso).
        next = [
          ...weightHistory.slice(0, -1),
          { ...last, weight: w, setAt: now },
        ];
      } else {
        // ≥1 día: tramo nuevo desde ahora, sin tocar lo anterior.
        next = [...weightHistory, { weight: w, appliesFrom: now, setAt: now }];
      }
    }

    setWeightHistory(next);
    setShowWeightModal(false);
    try {
      await setCardioWeightHistory(next);
    } catch {}
  };

  const weeks = useMemo(
    () => buildCardioWeeks(state.logs, weightHistory),
    [state.logs, weightHistory]
  );

  // Abre la vista de resultados (DetailScreen) de un log de cardio ya cerrado.
  // Se resuelve el log completo por id y su día dentro de las rutinas.
  const handleSessionPress = (logId: string) => {
    const log = state.logs.find((l) => l.id === logId);
    if (!log) return;
    // Solo cardio: el día no existe en ninguna rutina, se usa el día sintético
    // para abrir su consulta (el detalle mostrará solo el cardio).
    if (isCardioOnlyLog(log)) {
      onSelectLog?.(log, CARDIO_ONLY_DAY);
      return;
    }
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

  // Pulsar la tarjeta de un día. HOY la sesión sigue viva: se abre la inserción
  // de cardio (que ya precarga todo lo del día) para seguir sumando, en vez de
  // la consulta. Los días pasados abren su log; si ese día tiene fuerza y cardio
  // suelto (datos antiguos), manda el de fuerza: es el que lo contiene todo.
  const handleDayPress = (cardioDay: CardioDay) => {
    if (cardioDay.date === todayKey) {
      onInsertCardioOnly?.();
      return;
    }
    const logs = cardioDay.sessions
      .map((s) => state.logs.find((l) => l.id === s.logId))
      .filter((l): l is WorkoutLog => l != null);
    const primary = logs.find((l) => !isCardioOnlyLog(l)) ?? logs[0];
    if (primary) handleSessionPress(primary.id);
  };
  const months = useMemo(
    () => buildCardioMonths(state.logs, weightHistory),
    [state.logs, weightHistory]
  );
  // Más recientes primero.
  const orderedWeeks = useMemo(() => weeks.slice().reverse(), [weeks]);

  const todayKey = getToday();

  // Datos del hero: HOY como protagonista, con tres referencias diarias para
  // leerlo de un vistazo (mismo día de la semana pasada, media y mejor día).
  const days = useMemo(
    () => buildCardioDays(state.logs, weightHistory),
    [state.logs, weightHistory]
  );
  const today = useMemo(() => days.find((d) => d.isToday) ?? null, [days]);
  // Compara lunes con lunes: el mismo día de la semana anterior (hoy - 7).
  const sameDayLastWeek = useMemo(() => {
    const d = new Date(`${todayKey}T00:00:00`);
    d.setDate(d.getDate() - 7);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(d.getDate()).padStart(2, '0')}`;
    return days.find((x) => x.date === key) ?? null;
  }, [days, todayKey]);
  // La media es de días CON cardio y ya cerrados: hoy aún está sumando.
  const pastDays = useMemo(() => days.filter((d) => !d.isToday), [days]);
  const avgDayKcal = useMemo(
    () =>
      pastDays.length
        ? pastDays.reduce((s, d) => s + d.totalKcal, 0) / pastDays.length
        : null,
    [pastDays]
  );
  const bestDayKcal = useMemo(
    () => (days.length ? Math.max(...days.map((d) => d.totalKcal)) : null),
    [days]
  );

  // La gráfica es mensual; la métrica se elige con el selector.
  const kcalMonths = months.filter((m) => m.totalKcal > 0);
  const latestMonth = months[months.length - 1];
  const metric = CHART_METRICS[metricIdx];
  const latestMonthValue = latestMonth ? metric.get(latestMonth) : null;
  // Diferido hasta `ready`: solo alimenta la gráfica (diferida y colapsada).
  const metricChart = useMemo(
    () => (ready ? buildMetricChart(months, metric) : null),
    [ready, months, metric]
  );

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

  // La tarjeta de la gráfica lleva siempre el acento estructural.
  const progressAccent = theme.colors.accentLine;

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
          styles.scrollContent,
          {
            paddingTop: topBarHeight + 28,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero con tres estados (carrusel con flechas): estadísticas de la
            semana, peso corporal (editable, con su evolución) e "Insertar nuevo
            cardio" (día de solo cardio, sin fuerza).
            Mismo aspecto que la HeroCard de Fuerza: el scroll no lleva padding
            horizontal y la tarjeta se posiciona con el margen propio de la
            HeroCard (misma estrategia de márgenes que Inicio, sin heroBleed). */}
        <HeroCarousel
          slides={[
            <HeroStatsCard
              key="stats"
              isEmpty={!hasCardio}
              emptyText={t(
                'Aún no hay cardio. Añádelo dentro de un día de fuerza.'
              )}
              kicker={t('Hoy')}
              mainIcon="fire"
              mainValue={String(Math.round(today?.totalKcal ?? 0))}
              mainUnit="kcal"
              subline={
                today
                  ? `${today.disciplines.length} ${
                      today.disciplines.length === 1
                        ? t('disciplina')
                        : t('disciplinas')
                    } · ${Math.round(today.totalMinutes)} min · ${fmtNum(
                      today.totalKm
                    )} km`
                  : t('Aún sin cardio hoy')
              }
              stats={[
                {
                  value: sameDayLastWeek
                    ? String(Math.round(sameDayLastWeek.totalKcal))
                    : '—',
                  label: t('hace 7 días'),
                },
                {
                  value:
                    avgDayKcal != null ? String(Math.round(avgDayKcal)) : '—',
                  label: t('media diaria'),
                },
                {
                  value:
                    bestDayKcal != null ? String(Math.round(bestDayKcal)) : '—',
                  label: t('mejor día'),
                },
              ]}
            />,
            <HeroWeightCard
              key="weight"
              weight={currentWeight}
              history={weightHistory.map((s) => s.weight)}
              onPress={openWeightModal}
            />,
            <HeroCard
              key="insert"
              variant="start"
              icon="run-fast"
              title={t('Insertar cardio')}
              onPress={() => onInsertCardioOnly?.()}
            />,
          ]}
        />

        {ready && kcalMonths.length >= 2 && (
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
                  <Text style={styles.progressTitle}>
                    {metric.label} / {t('mes')}
                  </Text>
                  <MaterialCommunityIcons
                    name={showChart ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.colors.text}
                  />
                </View>
                {latestMonthValue != null && (
                  <Text style={styles.progressLatestKcal}>
                    {metric.fmt(latestMonthValue)} {metric.unit}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {showChart && (
              // Centrado: el `progressCard` no puede llevar alignItems:'center'
              // (su cabecera usa space-between y necesita el ancho completo), así
              // que la gráfica y su selector —ambos de ancho fijo `chartWidth`—
              // se centran en su propio contenedor.
              <View style={styles.chartArea}>
                {!!metricChart && (
                  <BarChart
                    points={metricChart.bars}
                    domain={metricChart.domain}
                    width={chartWidth}
                    formatYTick={metric.fmt}
                  />
                )}
                <SegmentedFilter
                  style={{ width: chartWidth }}
                  options={METRIC_OPTIONS}
                  labelMode="below"
                  value={metric.id}
                  onChange={(id) => {
                    const next = CHART_METRICS.findIndex((m) => m.id === id);
                    if (next < 0) return;
                    animateLayout();
                    setMetricIdx(next);
                    AsyncStorage.setItem('cardioChartMetric', id).catch(
                      () => {}
                    );
                  }}
                />
              </View>
            )}
          </View>
        )}

        {ready &&
          visibleWeeks.map((week) => {
            const isExpanded = expandedWeeks[week.weekKey] ?? week.isCurrent;
            // Tarjeta: acento estructural salvo la semana en curso (amarilla). El
            // verde/rojo solo se usa en el dato de subida/bajada (kcalDelta).
            const accent = week.isCurrent
              ? theme.colors.primaryLine
              : theme.colors.accentLine;

            return (
              <View key={week.weekKey} style={styles.weekBlock}>
                <Pressable
                  style={[styles.weekHeader, { borderColor: accent }]}
                  onPress={() => {
                    // Sin animateLayout: la altura la anima <Collapsible/> (mismo
                    // motor que Inicio); un LayoutAnimation encima competiría.
                    setExpandedWeeks((prev) => ({
                      ...prev,
                      [week.weekKey]: !isExpanded,
                    }));
                  }}
                >
                  <GradientFill accent={accent} />
                  <View style={styles.weekTitleRow}>
                    <Text
                      style={[styles.weekTitle, { color: theme.colors.white }]}
                      numberOfLines={1}
                    >
                      {dayMonth(week.weekStart)} – {dayMonth(week.weekEnd)}
                    </Text>
                    {/* Arriba a la derecha: diferencia de kcal vs semana anterior.
                      La semana en curso no la muestra (aún está acumulando). */}
                    {week.kcalDelta != null && !week.isCurrent && (
                      <TrendDelta
                        value={week.kcalDelta}
                        suffix=" kcal"
                        decimals={0}
                      />
                    )}
                  </View>
                  <View style={styles.weekMetaRow}>
                    <Text style={styles.weekMeta}>
                      {week.sessionCount}{' '}
                      {week.sessionCount === 1 ? t('sesión') : t('sesiones')}
                    </Text>
                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </View>
                </Pressable>

                {/* Una tarjeta por DÍA: fecha y kcal del día arriba, y dentro el
                  listado de disciplinas que se hicieron ese día. La altura la
                  anima <Collapsible/>, el mismo motor que las semanas de Inicio
                  (antes: FadeInDown escalonado por día + animateLayout). */}
                <Collapsible open={isExpanded}>
                  {week.days
                    .slice()
                    .reverse()
                    .map((day) => {
                      const d = new Date(`${day.date}T00:00:00`);
                      const weekday = d.toLocaleDateString(dateLocale, {
                        weekday: 'long',
                      });
                      const weekdayCap =
                        weekday.charAt(0).toUpperCase() + weekday.slice(1);
                      const dateStr = d.toLocaleDateString(dateLocale);
                      const isToday = day.date === todayKey;
                      return (
                        <View key={day.date}>
                          {/* "Hoy" se marca con el aro dorado y el GradientFill,
                              como en Inicio; el texto va en sus colores de
                              siempre (fecha y resultados en gris). */}
                          <Pressable
                            onPress={() => handleDayPress(day)}
                            style={({ pressed }) => [
                              styles.dailyCard,
                              isToday && styles.dailyCardToday,
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            {isToday && (
                              <GradientFill accent={theme.colors.primaryLine} />
                            )}
                            <View style={styles.dailyHeader}>
                              <Text style={styles.dailyDate} numberOfLines={1}>
                                <Text style={styles.dailyWeekday}>
                                  {weekdayCap}{' '}
                                </Text>
                                <Text style={styles.dailyDateBold}>
                                  {dateStr}
                                </Text>
                              </Text>
                              <Text style={styles.dailyBadge}>
                                {Math.round(day.totalKcal)} kcal
                              </Text>
                            </View>

                            {day.disciplines.map((entry, eIdx) => (
                              <View
                                key={`${day.date}-${eIdx}`}
                                style={styles.disciplineRow}
                              >
                                <MaterialCommunityIcons
                                  name={disciplineIcon(
                                    entry.type,
                                    hasIncline(entry.maxPendiente)
                                  )}
                                  size={28}
                                  color={theme.colors.white}
                                />
                                <View style={styles.dailyInfo}>
                                  <Text
                                    style={styles.dailyName}
                                    numberOfLines={1}
                                  >
                                    {entry.type}
                                  </Text>
                                  <Text
                                    style={styles.dailyResults}
                                    numberOfLines={1}
                                  >
                                    {formatMergedResults(entry)}
                                  </Text>
                                </View>
                                {/* Las kcal por disciplina solo aportan si hay
                                    más de una: si no, repiten las del día. */}
                                {day.disciplines.length > 1 && (
                                  <Text style={styles.disciplineKcal}>
                                    {Math.round(entry.kcal)} kcal
                                  </Text>
                                )}
                              </View>
                            ))}
                          </Pressable>
                        </View>
                      );
                    })}
                </Collapsible>
              </View>
            );
          })}

        {ready && hasMore && (
          <LoadMoreButton
            style={styles.showMore}
            onPress={() => {
              animateLayout();
              setVisibleCount((c) => c + WEEKS_PAGE);
            }}
          />
        )}
      </StretchScrollView>

      <FloatingPrimaryNav
        bottom={floatingNavBottom}
        activeTab="cardio"
        onPressHome={onNavigateHome}
        onPressCardio={onNavigateCardio}
        onPressCalendar={onNavigateCalendar}
        onPressCommunity={onNavigateCommunity}
        onPressProfile={onNavigateProfile}
      />

      <GlassTopBar
        title={t('Cardio')}
        icon="run-fast"
        subtitle={t('Consulta tus resultados')}
        topInset={insets.top}
      />

      <AppModal
        visible={showWeightModal}
        onRequestClose={() => setShowWeightModal(false)}
        title={t('Tu peso')}
        icon="scale-bathroom"
        message={t(
          'Se usa para estimar las kcalorías del cardio. Se aplica a los próximos; los cardios ya registrados mantienen el peso que tenías entonces.'
        )}
        footer={
          <View style={styles.modalButtonRow}>
            <Button
              title={t('Cancelar')}
              onPress={() => setShowWeightModal(false)}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            <Button
              title={t('Guardar')}
              onPress={handleSaveWeight}
              variant="primary"
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
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
      </AppModal>
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
    scrollContent: {
      flexGrow: 1,
    },
    progressCard: {
      // Margen propio por tarjeta (misma estrategia que Inicio): el scroll no
      // lleva padding horizontal, cada superficie pone su marginHorizontal.
      marginHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 2,
      paddingVertical: 16,
      paddingHorizontal: 16,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.lg,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      ...theme.shadow.card,
    },
    // Centra la gráfica y su selector (ambos de ancho fijo `chartWidth`) dentro
    // del `progressCard`, que no puede centrar por su cabecera de ancho completo.
    chartArea: {
      alignItems: 'center',
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
      lineHeight: 28,
      includeFontPadding: false,
      textAlignVertical: 'center',
      transform: [{ translateY: Platform.OS === 'android' ? 3 : 5 }],
    },
    progressLatestKcal: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.white,
    },
    weekBlock: {
      // Margen propio (misma estrategia que Inicio). El hueco inferior bajo el
      // último día lo pone el SHADOW_BLEED_BOTTOM del <Collapsible/> que los
      // envuelve, igual que en Inicio.
      marginHorizontal: theme.spacing.md,
      marginBottom: 10,
    },
    weekHeader: {
      borderRadius: theme.borderRadius.sm,
      borderLeftWidth: 5,
      paddingVertical: 14,
      paddingHorizontal: 14,
      minHeight: 52,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...theme.shadow.soft,
    },
    weekTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 1,
    },
    // Título de la semana (rango de fechas): estilo display compartido con Inicio
    // (lib/textStyles). El color lo pone el render inline (blanco).
    weekTitle: weekTitleText(),
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
    // Mismo "hoy" que la tarjeta de Inicio: aro dorado + GradientFill. NO pisar
    // aquí el backgroundColor con un tinte translúcido: la tarjeta lleva
    // elevation (shadow.soft) y Android, sin fondo opaco, pinta el relleno como
    // un rectángulo con esquinas vivas dentro del redondeo.
    dailyCardToday: {
      borderColor: theme.colors.primaryLine,
      borderWidth: 2.5,
    },
    // Cabecera de la tarjeta del día: fecha a la izquierda, kcal del día a la
    // derecha. Debajo va una fila por disciplina.
    dailyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    disciplineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 10,
    },
    disciplineKcal: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.textSecondary,
    },
    dailyInfo: {
      flex: 1,
    },
    // Nombre de la disciplina/día: estilo display compartido con Inicio y el
    // selector de día.
    dailyName: dayNameText(),
    dailyResults: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    dailyDate: {
      fontSize: 14,
      lineHeight: 16,
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
      lineHeight: 21,
      color: theme.colors.text,
      backgroundColor: theme.colors.surfaceAlt,
      overflow: 'hidden',
    },
    // Solo el margen horizontal propio de Cardio; el resto del botón "Cargar más"
    // vive en el componente compartido LoadMoreButton.
    showMore: {
      marginHorizontal: theme.spacing.md,
    },
    modalButtonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    modalButton: {
      flex: 1,
    },
    weightInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
    },
    weightInput: {
      backgroundColor: theme.colors.inputBg,
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
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
