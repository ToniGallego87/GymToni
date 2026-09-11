import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  exerciseKey,
  getExerciseRecords,
  listExercises,
  sortExercises,
} from '@lib/exerciseProgress';
import { animateLayout } from '@lib/layoutAnimation';
import { theme } from '@lib/theme';
import { dateLocale, fmtNum, t } from '@lib/i18n';
import {
  BarChart,
  BarChartPoint,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  ExerciseGifButton,
  GradientFill,
  LoadMoreButton,
  SEGMENTED_FILTER_CHART_GAP,
  SegmentedFilter,
  SegmentedOption,
  StretchScrollView,
} from '../../components';

interface ExerciseProgressScreenProps {
  // Sube un paso: de la ficha a la lista, o de la lista fuera de la pantalla.
  // Lo decide `app/App.tsx`, que es también quien atiende el atrás del móvil,
  // para que los dos gestos recorran lo mismo.
  onBack: () => void;
  // Ejercicio abierto ahora mismo. La selección vive en la navegación (App), no
  // aquí: cuando era estado local, el atrás del móvil no la veía y se saltaba
  // la lista.
  selectedKey?: string;
  onSelectExercise: (exerciseKey: string) => void;
  // Se abrió desde el detalle de un día, ya enfocado en un ejercicio: no hay
  // lista detrás, así que "Volver" sale de la pantalla en vez de subir a ella.
  focused?: boolean;
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
 *
 * Las sesiones de DESCARGA no entran: bajar la carga es el plan, no un
 * retroceso, y dibujarlas metía un bache rojo en mitad de la progresión y
 * ensanchaba el dominio hasta aplanar el resto de barras.
 */
function buildSessionChart(
  sessions: ExerciseSession[],
  metric: ChartMetric
): { bars: BarChartPoint[]; domain: { min: number; max: number } } | null {
  const points = sessions
    .filter((session) => !session.isDeload)
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
  selectedKey,
  onSelectExercise,
  focused,
}: ExerciseProgressScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const { width: windowWidth } = useWindowDimensions();

  const [metricId, setMetricId] = useState(CHART_METRICS[0].id);
  const [sort, setSort] = useState<ExerciseSort>('recent');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [query, setQuery] = useState('');

  // Las semanas de descarga quedan fuera de la evolución y los récords: se
  // entrenan con menos series y peso a propósito, así que no reflejan progreso ni
  // deben ensuciar las mejores marcas.
  const evolutionLogs = useMemo(
    () => state.logs.filter((log) => !log.isDeload),
    [state.logs]
  );

  const exercises = useMemo(
    () => listExercises(evolutionLogs),
    [evolutionLogs]
  );

  // GIF asignado a cada ejercicio. La lista agrupa por NOMBRE (el mismo press de
  // banca tiene otro id en cada rutina), así que el `catalogId` se busca igual:
  // por nombre, en los ejercicios de todas las rutinas. El primero que lo tenga
  // manda — es el mismo movimiento, así que el dibujo es el mismo.
  const catalogIdByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const routine of state.routines) {
      for (const day of routine.days) {
        for (const exercise of day.exercises) {
          if (!exercise.catalogId) continue;
          const key = exerciseKey(exercise.name);
          if (!map.has(key)) map.set(key, exercise.catalogId);
        }
      }
    }
    return map;
  }, [state.routines]);
  const sorted = useMemo(
    () => sortExercises(exercises, sort),
    [exercises, sort]
  );
  // Filtro por nombre. Con una rutina de 5 días son 30-40 ejercicios y la
  // pregunta real es "¿cómo voy en press banca?": buscarlo a mano era recorrer
  // la lista de 20 en 20. Mismo criterio que el buscador del catálogo: sin
  // acentos ni mayúsculas y por trozo de palabra.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((exercise) =>
      exercise.name.toLowerCase().includes(needle)
    );
  }, [sorted, query]);
  const visible = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const selected = exercises.find((exercise) => exercise.key === selectedKey);

  const sessions = useMemo(
    () =>
      selectedKey ? buildExerciseSessions(evolutionLogs, selectedKey) : [],
    [selectedKey, evolutionLogs]
  );
  const records = useMemo(() => getExerciseRecords(sessions), [sessions]);

  const metric =
    CHART_METRICS.find((item) => item.id === metricId) ?? CHART_METRICS[0];
  const chart = useMemo(
    () => buildSessionChart(sessions, metric),
    [sessions, metric]
  );

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: backBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);
  const chartWidth = Math.max(
    250,
    Math.min(windowWidth - theme.spacing.md * 2 - 20, 420)
  );

  // "Volver" sube un paso: de la ficha a la lista, o de la lista fuera. Si se
  // entró enfocado desde el detalle de un día no hay lista que enseñar y se
  // vuelve directo. El destino lo resuelve `onBack` (App), y aquí solo se
  // decide cómo ROTULARLO: era el mismo botón para dos sitios distintos sin
  // decir a cuál iba.
  const backGoesToList = !!selected && !focused;

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

        {/* Buscar por nombre, encima del orden: con 30-40 ejercicios encontrar
            uno concreto era scroll y "Ver más". Mismo patrón que el buscador
            del catálogo de ejercicios. */}
        {!selected && exercises.length > 1 && (
          <View style={styles.searchBox}>
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={theme.colors.textMuted}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t('Buscar ejercicio…')}
              placeholderTextColor={theme.colors.textMuted}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                // Otra búsqueda, otra lista: la paginación vuelve al principio.
                setVisibleCount(PAGE_SIZE);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            )}
          </View>
        )}

        {!selected && exercises.length > 1 && (
          <SegmentedFilter
            // Sin margen: encabeza la lista, no cuelga de ninguna gráfica.
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

        {!selected && !!query.trim() && filtered.length === 0 && (
          <Text style={styles.emptyText}>{t('Sin resultados')}</Text>
        )}

        {!selected &&
          visible.map((exercise) => (
            <ExerciseRow
              key={exercise.key}
              exercise={exercise}
              catalogId={catalogIdByKey.get(exercise.key)}
              onPress={() => {
                animateLayout();
                onSelectExercise(exercise.key);
              }}
            />
          ))}

        {/* Mismo botón de paginar que el historial de Inicio y el de Cardio:
            antes era un `Button` secundario con otras palabras ("Ver más"). El
            recuento de los que faltan sobrevive como prop del componente
            compartido, no como una copia con otra piel. */}
        {!selected && visibleCount < filtered.length && (
          <LoadMoreButton
            remaining={filtered.length - visibleCount}
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
                {/* El GIF del ejercicio en lugar del icono de gráfica, que era
                    el mismo para todos y no decía cuál estabas mirando. */}
                <ExerciseGifButton
                  name={selected.name}
                  catalogId={catalogIdByKey.get(selected.key)}
                  size={20}
                  style={styles.cardTitleGif}
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
                style={{
                  width: chartWidth,
                  marginTop: SEGMENTED_FILTER_CHART_GAP,
                }}
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

      <FloatingBackButton
        onPress={onBack}
        bottom={backBottom}
        label={
          backGoesToList ? `← ${t('Todos los ejercicios')}` : `← ${t('Volver')}`
        }
      />
    </View>
  );
}

function ExerciseRow({
  exercise,
  catalogId,
  onPress,
}: {
  exercise: ExerciseSummary;
  catalogId?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}
      onPress={onPress}
    >
      <GradientFill accent={theme.colors.accentLine} />
      {/* El mismo elemento que en el registro y en el Detalle: con GIF asignado
          el botón ES el GIF en miniatura (a un vistazo se reconoce el ejercicio
          antes por el dibujo que por el nombre, que es lo que se busca en una
          lista de 30-40); sin él, la lupa abre el catálogo buscando por su
          nombre. Va fuera del `Pressable` de texto para que su toque no arrastre
          a abrir la ficha. */}
      <ExerciseGifButton
        name={exercise.name}
        catalogId={catalogId}
        size={20}
        style={styles.exerciseGif}
      />
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
      gap: 12,
    },
    pressed: {
      opacity: 0.8,
    },
    // Buscador de la lista de ejercicios, con la misma caja que el resto de
    // buscadores de la app (catálogo y Comunidad).
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      height: 46,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.text,
      fontSize: 16,
      padding: 0,
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
    // El GIF de la fila, algo mayor que el de 34 del Detalle: aquí es lo que
    // identifica la fila de un vistazo, como el icono del día en las listas de
    // Inicio y Cardio (36-40).
    exerciseGif: {
      width: 40,
      height: 40,
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
      lineHeight: 27,
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
    // Centra el icono (18) en la primera línea del título (lineHeight 26). Lo
    // usa la tarjeta de Récords.
    cardTitleIcon: {
      marginTop: 4,
    },
    // El GIF del ejercicio en la cabecera de la ficha. La fila alinea arriba
    // (el nombre puede ocupar dos líneas), así que el botón —más alto que el
    // icono de 18 que había— se queda a la altura de la primera.
    cardTitleGif: {
      marginTop: 1,
    },
    cardTitle: {
      flex: 1,
      fontSize: 21,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 30,
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
      lineHeight: 24,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
