import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import {
  buildExerciseSessions,
  ExerciseRecords,
  ExerciseSession,
  ExerciseSort,
  ExerciseSummary,
  getExerciseRecords,
  listExercises,
  sortExercises,
} from '@lib/exerciseProgress';
import { animateLayout } from '@lib/layoutAnimation';
import { theme } from '@lib/theme';
import { dateLocale, localizeDecimals, t } from '@lib/i18n';
import {
  BarChart,
  BarChartPoint,
  Button,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  SegmentedFilter,
  SegmentedOption,
  StretchScrollView,
} from '../../components';

interface ExerciseProgressScreenProps {
  onBack: () => void;
}

// Sesiones que caben en la gráfica sin que las barras se conviertan en rayas.
const MAX_CHART_SESSIONS = 8;

// Ejercicios por página: con un historial largo pintar la lista entera de golpe
// bloquea la entrada a la pantalla. Se amplía de PAGE_SIZE en PAGE_SIZE.
const PAGE_SIZE = 20;

// Sin icono, a diferencia del filtro de métrica: los cuatro criterios con
// icono + texto no caben de ancho, y "ordenar por sesiones" no tiene un dibujo
// que se entienda solo (el filtro de días de Inicio sí: son sus siluetas).
const SORT_OPTIONS: SegmentedOption<ExerciseSort>[] = [
  { id: 'recent', label: t('Reciente') },
  { id: 'name', label: t('Nombre') },
  { id: 'sessions', label: t('Sesiones') },
  { id: 'best', label: t('1RM') },
];

/** Redondea a un decimal y lo pinta con el separador del idioma ("82,5"). */
const fmtNum = (value: number) =>
  localizeDecimals(String(Math.round(value * 10) / 10));

/** "12 jul" a partir de una fecha YYYY-MM-DD. */
const shortDate = (date: string) =>
  new Date(`${date}T00:00:00`)
    .toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })
    .replace('.', '');

const longDate = (date: string) =>
  new Date(`${date}T00:00:00`)
    .toLocaleDateString(dateLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .replace('.', '');

type ChartMetric = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  get: (session: ExerciseSession) => number;
  fmt: (value: number) => string;
};

const CHART_METRICS: ChartMetric[] = [
  {
    id: '1rm',
    label: t('1RM'),
    icon: 'trophy-outline',
    get: (session) => session.bestOneRepMax,
    fmt: fmtNum,
  },
  {
    id: 'weight',
    label: t('Peso'),
    icon: 'weight-kilogram',
    get: (session) => session.maxWeight,
    fmt: fmtNum,
  },
  {
    id: 'volume',
    label: t('Volumen'),
    icon: 'chart-box-outline',
    get: (session) => session.volume,
    fmt: (value) => String(Math.round(value)),
  },
  {
    id: 'reps',
    label: t('Reps'),
    icon: 'repeat',
    get: (session) => session.totalReps,
    fmt: (value) => String(Math.round(value)),
  },
];

const METRIC_OPTIONS: SegmentedOption<string>[] = CHART_METRICS.map(
  (metric) => ({ id: metric.id, label: metric.label, icon: metric.icon })
);

/**
 * Traduce las sesiones a barras: color por tendencia (sesión vs anterior) y la
 * última en amarillo. El dibujo lo hace <BarChart/> (el mismo de Inicio y
 * Cardio); aquí solo se decide qué mide cada barra y de qué color va.
 */
function buildSessionChart(
  sessions: ExerciseSession[],
  metric: ChartMetric
): { bars: BarChartPoint[]; domain: { min: number; max: number } } | null {
  const points = sessions
    .map((session) => ({ session, value: metric.get(session) }))
    .filter((point) => point.value > 0)
    .slice(-MAX_CHART_SESSIONS);
  if (points.length < 2) return null;

  const values = points.map((point) => point.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  // El peso y el 1RM se mueven en rangos estrechos (60 → 65 kg): arrancando en
  // cero todas las barras saldrían iguales y no se vería el progreso. El
  // volumen y las reps sí nacen del suelo.
  const zeroBased = metric.id === 'volume' || metric.id === 'reps';
  const domainMin = zeroBased
    ? 0
    : Math.max(0, minVal - (maxVal - minVal) * 0.4 - 0.5);
  const span = maxVal - domainMin || maxVal || 1;

  const bars = points.map((point, index) => {
    const isLatest = index === points.length - 1;
    const prev = index > 0 ? points[index - 1].value : null;
    const improved = prev == null ? null : point.value >= prev;
    const color = isLatest
      ? theme.colors.primaryFill
      : improved == null
      ? theme.colors.emoji_blue
      : improved
      ? theme.colors.success
      : theme.colors.error;

    return {
      key: point.session.logId,
      value: point.value,
      label: shortDate(point.session.date),
      valueLabel: metric.fmt(point.value),
      color,
      // La etiqueta es texto sobre la tarjeta: la última sesión necesita la
      // tinta del oro, no su oro de línea (ver theme.ts).
      valueColor: isLatest ? theme.colors.primary : color,
      highlighted: isLatest,
    };
  });

  return { bars, domain: { min: domainMin, max: maxVal + span * 0.15 } };
}

/**
 * Progreso por ejercicio: la evolución y los récords de UN ejercicio concreto
 * ("¿cuánto hacía en banca hace un mes?"). El resto de la app mira la sesión o
 * la semana; el eje aquí es el ejercicio, atravesando rutinas y semanas.
 *
 * Dos pasos en la misma pantalla (elegir ejercicio → verlo) en vez de un modal
 * de selección: la lista ya es útil de por sí (dice cuándo se entrenó cada uno
 * y su mejor marca).
 */
export function ExerciseProgressScreen({
  onBack,
}: ExerciseProgressScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const { width: windowWidth } = useWindowDimensions();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [metricId, setMetricId] = useState(CHART_METRICS[0].id);
  const [sort, setSort] = useState<ExerciseSort>('recent');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const exercises = useMemo(() => listExercises(state.logs), [state.logs]);
  const sorted = useMemo(
    () => sortExercises(exercises, sort),
    [exercises, sort]
  );
  const visible = useMemo(
    () => sorted.slice(0, visibleCount),
    [sorted, visibleCount]
  );
  const selected = exercises.find((exercise) => exercise.key === selectedKey);

  const sessions = useMemo(
    () => (selectedKey ? buildExerciseSessions(state.logs, selectedKey) : []),
    [selectedKey, state.logs]
  );
  const records = useMemo(() => getExerciseRecords(sessions), [sessions]);

  const metric =
    CHART_METRICS.find((item) => item.id === metricId) ?? CHART_METRICS[0];
  const chart = useMemo(
    () => buildSessionChart(sessions, metric),
    [sessions, metric]
  );

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const backBottom = Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding = backBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;
  const chartWidth = Math.max(
    250,
    Math.min(windowWidth - theme.spacing.md * 2 - 20, 420)
  );

  // Volver: primero deshace la selección (de la ficha a la lista) y solo desde
  // la lista sale de la pantalla.
  const handleBack = () => {
    if (selected) {
      animateLayout();
      setSelectedKey(null);
    } else {
      onBack();
    }
  };

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
          { paddingTop: topBarHeight + 28, paddingBottom: scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {exercises.length === 0 && (
          <View style={styles.emptyCard}>
            <GradientFill accent={theme.colors.accentLine} />
            <MaterialCommunityIcons
              name="chart-line-variant"
              size={30}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.emptyText}>
              {t('Registra un entrenamiento y aquí verás tu evolución.')}
            </Text>
          </View>
        )}

        {!selected && exercises.length > 1 && (
          <SegmentedFilter
            style={styles.sortFilter}
            options={SORT_OPTIONS}
            value={sort}
            onChange={(id) => {
              animateLayout();
              setSort(id);
              // La página vuelve al principio: el orden nuevo trae otras filas
              // arriba y quedarse en la página 3 no significa nada.
              setVisibleCount(PAGE_SIZE);
            }}
          />
        )}

        {!selected &&
          visible.map((exercise) => (
            <ExerciseRow
              key={exercise.key}
              exercise={exercise}
              onPress={() => {
                animateLayout();
                setSelectedKey(exercise.key);
              }}
            />
          ))}

        {!selected && visibleCount < sorted.length && (
          <Button
            title={t('Ver más ({n})', { n: sorted.length - visibleCount })}
            variant="secondary"
            onPress={() => {
              animateLayout();
              setVisibleCount((count) => count + PAGE_SIZE);
            }}
          />
        )}

        {!!selected && (
          <>
            <View style={styles.chartCard}>
              <GradientFill accent={theme.colors.accentLine} />
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons
                  name="chart-line"
                  size={18}
                  color={theme.colors.text}
                  style={styles.cardTitleIcon}
                />
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {selected.name}
                </Text>
              </View>
              <Text style={styles.cardHint}>
                {t('{n} sesiones · última el {date}', {
                  n: selected.sessionCount,
                  date: shortDate(selected.lastDate),
                })}
              </Text>

              {chart ? (
                <BarChart
                  points={chart.bars}
                  domain={chart.domain}
                  width={chartWidth}
                  formatYTick={(value) => metric.fmt(value)}
                />
              ) : (
                <Text style={styles.chartEmpty}>
                  {t('Aún no hay dos sesiones que comparar con esta medida.')}
                </Text>
              )}

              <SegmentedFilter
                style={{ width: chartWidth }}
                options={METRIC_OPTIONS}
                value={metricId}
                onChange={(id) => {
                  animateLayout();
                  setMetricId(id);
                }}
              />
            </View>

            <RecordsCard records={records} />
          </>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={selected ? t('Tu evolución') : t('Progreso')}
        icon="chart-line"
        subtitle={
          selected
            ? t('Sesión a sesión y tus mejores marcas')
            : t('Elige un ejercicio para ver su evolución')
        }
        topInset={insets.top}
      />

      <FloatingBackButton onPress={handleBack} bottom={backBottom} />
    </View>
  );
}

function ExerciseRow({
  exercise,
  onPress,
}: {
  exercise: ExerciseSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}
      onPress={onPress}
    >
      <GradientFill accent={theme.colors.accentLine} />
      <View style={styles.exerciseTextWrap}>
        <Text style={styles.exerciseName} numberOfLines={2}>
          {exercise.name}
        </Text>
        <Text style={styles.exerciseHint} numberOfLines={1}>
          {t('{n} sesiones · {date}', {
            n: exercise.sessionCount,
            date: shortDate(exercise.lastDate),
          })}
        </Text>
      </View>
      {exercise.bestOneRepMax > 0 && (
        <View style={styles.exerciseBest}>
          <Text style={styles.exerciseBestValue}>
            {fmtNum(exercise.bestOneRepMax)}
          </Text>
          <Text style={styles.exerciseBestLabel}>{t('1RM')}</Text>
        </View>
      )}
      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );
}

function RecordsCard({ records }: { records: ExerciseRecords }) {
  const rows: { label: string; value: string; date: string }[] = [];

  if (records.oneRepMax) {
    rows.push({
      label: t('1RM estimado'),
      value: `${fmtNum(records.oneRepMax.value)} kg`,
      date: records.oneRepMax.date,
    });
  }
  if (records.maxWeight) {
    rows.push({
      label: t('Peso máximo'),
      value: t('{w} kg × {r}', {
        w: fmtNum(records.maxWeight.value),
        r: records.maxWeight.reps,
      }),
      date: records.maxWeight.date,
    });
  }
  if (records.maxReps) {
    rows.push({
      label: t('Más repeticiones'),
      value: records.maxReps.weight
        ? t('{r} reps con {w} kg', {
            r: records.maxReps.value,
            w: fmtNum(records.maxReps.weight),
          })
        : t('{r} reps', { r: records.maxReps.value }),
      date: records.maxReps.date,
    });
  }
  if (records.bestVolume) {
    rows.push({
      label: t('Mejor sesión'),
      value: `${Math.round(records.bestVolume.value)} kg`,
      date: records.bestVolume.date,
    });
  }

  if (rows.length === 0) return null;

  return (
    <View style={styles.recordsCard}>
      <GradientFill accent={theme.colors.primaryLine} />
      <View style={styles.cardTitleRow}>
        <MaterialCommunityIcons
          name="medal-outline"
          size={18}
          color={theme.colors.text}
          style={styles.cardTitleIcon}
        />
        <Text style={styles.cardTitle}>{t('Récords')}</Text>
      </View>

      {rows.map((row) => (
        <View key={row.label} style={styles.recordRow}>
          <View style={styles.recordTextWrap}>
            <Text style={styles.recordLabel}>{row.label}</Text>
            <Text style={styles.recordDate}>{longDate(row.date)}</Text>
          </View>
          <Text style={styles.recordValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    gap: 12,
  },
  pressed: {
    opacity: 0.8,
  },
  // El raíl nace con hueco arriba para separarse de la gráfica; aquí encabeza
  // la lista y el scroll ya trae su propio padding.
  sortFilter: {
    marginTop: 0,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  exerciseTextWrap: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 22,
  },
  exerciseHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  exerciseBest: {
    alignItems: 'flex-end',
  },
  exerciseBestValue: {
    fontSize: 19,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.3,
    color: theme.colors.primary,
    lineHeight: 24,
  },
  exerciseBestLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
    lineHeight: 13,
  },
  chartCard: {
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  cardTitleRow: {
    flexDirection: 'row',
    // Arriba, no centrado: el nombre del ejercicio puede ocupar dos líneas y el
    // icono tiene que quedarse a la altura de la primera.
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    gap: 8,
  },
  // Centra el icono (18) en la primera línea del título (lineHeight 26).
  cardTitleIcon: {
    marginTop: 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: 21,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.4,
    color: theme.colors.text,
    lineHeight: 26,
  },
  cardHint: {
    alignSelf: 'flex-start',
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  chartEmpty: {
    marginTop: 16,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  recordsCard: {
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 10,
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordTextWrap: {
    flex: 1,
  },
  recordLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 20,
  },
  recordDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  recordValue: {
    fontSize: 17,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.3,
    color: theme.colors.primary,
    lineHeight: 22,
  },
});

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
