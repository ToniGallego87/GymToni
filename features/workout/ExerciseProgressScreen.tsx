import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import { useExerciseNames } from '@hooks/useExerciseKeyResolver';
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
import {
  formatExerciseNames,
  otherExerciseNames,
  slugExerciseName,
} from '@lib/exerciseIdentity';
import {
  getCatalogExercise,
  matchesExercise,
  matchesTagFilter,
  TagFilter,
} from '@data/exerciseCatalog';
import { planExerciseMerge } from '@lib/exerciseMerge';
import { animateLayout } from '@lib/layoutAnimation';
import { theme } from '@lib/theme';
import { fmtNum, t } from '@lib/i18n';
import { longDate, shortDayMonth } from '@lib/utils';
import { WorkoutRoutine } from '../../types';
import {
  AnchorMenu,
  AppModal,
  BarChart,
  ChartArea,
  ChartCardStat,
  BarChartPoint,
  getChartWidth,
  Button,
  ConfirmModal,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  CatalogTagFilters,
  ExerciseGifButton,
  GradientFill,
  LoadMoreButton,
  SEGMENTED_FILTER_CHART_GAP,
  SectionLegend,
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
  // Abre la ficha de la rutina que contiene el ejercicio, con su día
  // desplegado. Desde el menú ⋯ de la ficha: la pregunta "¿cómo voy en press
  // banca?" acaba muchas veces en "pues le subo el peso en la rutina".
  onOpenRoutine?: (routine: WorkoutRoutine, dayId: string) => void;
  // Salida del estado vacío: empezar un entreno o crear la primera rutina.
  emptyAction?: { label: string; onPress: () => void };
}

// Sesiones de la gráfica. No caben todas a la vez: con fechas ("14 sept") de
// etiqueta, la gráfica se desliza (`scrollable`) y arranca en las últimas.
const MAX_CHART_SESSIONS = 12;

// Ejercicios por página: con un historial largo pintar la lista entera de golpe
// bloquea la entrada a la pantalla. Se amplía de PAGE_SIZE en PAGE_SIZE.
const PAGE_SIZE = 10;

// Umbrales del chrome de la lista. Con dos o tres ejercicios registrados (las
// primeras semanas) buscador y orden eran más control que contenido encima de
// filas que caben enteras: la cabecera con el orden aparece cuando la lista
// deja de verse de un vistazo y el buscador cuando ya no cabe en una pantalla.
const MIN_EXERCISES_FOR_SORT = 5;
const MIN_EXERCISES_FOR_SEARCH = 10;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Candidatos que enseña "Es el mismo que…" a la vez: el buscador acota
// el resto (pintar cientos de filas en un modal se nota).
const MERGE_MAX_OPTIONS = 30;

// El orden de la lista. No es un raíl más: con la misma piel que el filtro de
// zonas, filtrar y ordenar no se distinguían, y el orden se cambia rara vez. Va
// en la cabecera de la lista (el activo a la vista) y abre un menú con los
// cuatro. `label` es el corto del botón; `menuLabel`, el que se lee en el menú.
// Rótulos con getter para que sigan al idioma en caliente.
const SORT_CHOICES: {
  id: ExerciseSort;
  icon: IconName;
  label: string;
  menuLabel: string;
}[] = [
  {
    id: 'recent',
    icon: 'clock-outline',
    get label() {
      return t('Reciente');
    },
    get menuLabel() {
      return t('Más reciente');
    },
  },
  {
    id: 'name',
    icon: 'sort-alphabetical-ascending',
    get label() {
      return t('Nombre');
    },
    get menuLabel() {
      return t('Por nombre');
    },
  },
  {
    id: 'sessions',
    icon: 'counter',
    get label() {
      return t('Sesiones');
    },
    get menuLabel() {
      return t('Más sesiones');
    },
  },
  {
    id: 'best',
    icon: 'trophy-outline',
    get label() {
      return t('1RM');
    },
    get menuLabel() {
      return t('Mejor 1RM');
    },
  },
];

type ChartMetric = {
  id: string;
  label: string;
  icon: IconName;
  get: (session: ExerciseSession) => number;
  fmt: (value: number) => string;
  /** Unidad del cambio en el titular de la ficha (" kg", " reps"). */
  unit: string;
};

// Rótulos con getter: t() se evalúa al pintar, no al cargar el módulo, así
// que siguen al idioma en caliente (ver lib/i18n.ts).
const CHART_METRICS: ChartMetric[] = [
  {
    id: '1rm',
    get label() {
      return t('1RM');
    },
    icon: 'trophy-outline',
    get: (session) => session.bestOneRepMax,
    fmt: fmtNum,
    unit: ' kg',
  },
  {
    id: 'weight',
    get label() {
      return t('Peso');
    },
    icon: 'weight-kilogram',
    get: (session) => session.maxWeight,
    fmt: fmtNum,
    unit: ' kg',
  },
  {
    id: 'volume',
    get label() {
      return t('Volumen');
    },
    icon: 'chart-box-outline',
    get: (session) => session.volume,
    fmt: (value) => String(Math.round(value)),
    unit: ' kg',
  },
  {
    id: 'reps',
    get label() {
      return t('Reps');
    },
    icon: 'repeat',
    get: (session) => session.totalReps,
    fmt: (value) => String(Math.round(value)),
    get unit() {
      return ` ${t('reps')}`;
    },
  },
];

const METRIC_OPTIONS: SegmentedOption<string>[] = CHART_METRICS.map(
  (metric) => ({
    id: metric.id,
    get label() {
      return metric.label;
    },
    icon: metric.icon,
  })
);

/**
 * Las sesiones que mide una gráfica: con valor en esa medida y sin las de
 * DESCARGA (bajar la carga es el plan, no un retroceso; dibujarlas metía un
 * bache rojo en mitad de la progresión y ensanchaba el dominio hasta aplanar
 * el resto de barras). La gráfica y el titular de la ficha leen la misma
 * serie.
 */
function metricPoints(sessions: ExerciseSession[], metric: ChartMetric) {
  return sessions
    .filter((session) => !session.isDeload)
    .map((session) => ({ session, value: metric.get(session) }))
    .filter((point) => point.value > 0);
}

/**
 * Titular de la ficha: cuánto ha cambiado la medida desde la primera sesión
 * que la tiene (no solo desde la primera barra visible: "desde el 3 ago" dice
 * la fecha). Responde a "¿cómo voy?" sin tener que leer las barras. null con
 * menos de dos sesiones: no hay con qué comparar.
 */
function buildHeadline(
  sessions: ExerciseSession[],
  metric: ChartMetric
): { delta: number; since: string } | null {
  const points = metricPoints(sessions, metric);
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return {
    delta: Math.round((last.value - first.value) * 10) / 10,
    since: first.session.date,
  };
}

/**
 * Traduce las sesiones a barras: color por tendencia (sesión vs anterior) y la
 * última en amarillo. El dibujo lo hace <BarChart/> (el mismo de Inicio y
 * Cardio); aquí solo se decide qué mide cada barra y de qué color va.
 */
function buildSessionChart(
  sessions: ExerciseSession[],
  metric: ChartMetric
): { bars: BarChartPoint[]; domain: { min: number; max: number } } | null {
  const points = metricPoints(sessions, metric).slice(-MAX_CHART_SESSIONS);
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
    // La primera barra no tiene con quién compararse: va en neutro. Era azul,
    // y el azul ya dice otra cosa en el resto de la app (descarga, semana
    // incompleta en Inicio).
    const color = isLatest
      ? theme.colors.primaryFill
      : improved == null
      ? theme.colors.textMuted
      : improved
      ? theme.colors.success
      : theme.colors.error;

    return {
      key: point.session.logId,
      value: point.value,
      label: shortDayMonth(point.session.date),
      valueLabel: metric.fmt(point.value),
      color,
      // La etiqueta es texto sobre la tarjeta: la última sesión necesita la
      // tinta del oro, no su oro de línea (ver theme.ts), y la neutra el gris
      // de texto, que contrasta más que el de la barra.
      valueColor: isLatest
        ? theme.colors.primary
        : improved == null
        ? theme.colors.textSecondary
        : color,
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
  onOpenRoutine,
  emptyAction,
}: ExerciseProgressScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const { resolve: resolveExerciseKey, namesByKey } = useExerciseNames();
  const { width: windowWidth } = useWindowDimensions();

  const [metricId, setMetricId] = useState(CHART_METRICS[0].id);
  const [sort, setSort] = useState<ExerciseSort>('recent');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<TagFilter>({});
  // Menú del orden, anclado a su botón de la cabecera de la lista.
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortAnchorRef = useRef<View>(null);
  // "Son el mismo ejercicio": elegir con cuál se une el abierto y confirmarlo.
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<ExerciseSummary | null>(null);

  // Las semanas de descarga quedan fuera de la evolución y los récords: se
  // entrenan con menos series y peso a propósito, así que no reflejan progreso ni
  // deben ensuciar las mejores marcas.
  const evolutionLogs = useMemo(
    () => state.logs.filter((log) => !log.isDeload),
    [state.logs]
  );

  // Agrupados por su identidad (lib/exerciseIdentity.ts): el ejercicio del
  // catálogo, o el nombre si es propio. Cada fila trae ya su GIF (`catalogId`).
  const exercises = useMemo(
    () => listExercises(evolutionLogs, resolveExerciseKey),
    [evolutionLogs, resolveExerciseKey]
  );

  // Rutinas que tienen el ejercicio abierto (y en qué día): la activa primero,
  // que es la que se está entrenando. Misma identidad que la lista.
  const routineHits = useMemo(() => {
    if (!selectedKey) return [];
    const hits: { routine: WorkoutRoutine; dayId: string }[] = [];
    for (const routine of state.routines) {
      const day = routine.days.find((d) =>
        d.exercises.some((e) => resolveExerciseKey(e) === selectedKey)
      );
      if (day) hits.push({ routine, dayId: day.id });
    }
    return hits.sort(
      (a, b) =>
        Number(b.routine.id === state.activeRoutineId) -
        Number(a.routine.id === state.activeRoutineId)
    );
  }, [selectedKey, state.routines, state.activeRoutineId, resolveExerciseKey]);
  const sorted = useMemo(
    () => sortExercises(exercises, sort),
    [exercises, sort]
  );
  // Ejercicio del catálogo de cada fila: sus etiquetas (zona, músculo, equipo)
  // para filtrar. undefined en los propios ("Sin clasificar").
  const catalogEntries = useMemo(
    () =>
      new Map(
        exercises.map((exercise) => [
          exercise.key,
          getCatalogExercise(exercise.catalogId),
        ])
      ),
    [exercises]
  );
  const tagItems = useMemo(
    () => exercises.map((exercise) => catalogEntries.get(exercise.key)),
    [exercises, catalogEntries]
  );
  // Filtro por nombre y por etiqueta. Con una rutina de 5 días son 30-40
  // ejercicios y la pregunta real es "¿cómo voy en press banca?" o "¿y en
  // pecho?": buscarlo a mano era recorrer la lista de 20 en 20. El texto busca
  // en TODOS los nombres del ejercicio (también los "también lo llamas") y en
  // su ficha del catálogo (nombre, sinónimos y etiquetas: "bíceps" encuentra
  // tus curls aunque los llames "Curl"). Sin acentos ni mayúsculas.
  const filtered = useMemo(() => {
    const needle = slugExerciseName(query);
    return sorted.filter((exercise) => {
      const entry = catalogEntries.get(exercise.key);
      if (!matchesTagFilter(entry, tagFilter)) return false;
      if (!needle) return true;
      const names = namesByKey.get(exercise.key) ?? [exercise.name];
      return (
        names.some((name) => slugExerciseName(name).includes(needle)) ||
        (!!entry && matchesExercise(entry, query))
      );
    });
  }, [sorted, query, tagFilter, catalogEntries, namesByKey]);
  const filtering = !!query.trim() || !!tagFilter.category;
  // Salida del "Sin resultados": texto y zona fuera de una vez.
  const clearFilters = () => {
    animateLayout();
    setQuery('');
    setTagFilter({});
    setVisibleCount(PAGE_SIZE);
  };
  const activeSort =
    SORT_CHOICES.find((choice) => choice.id === sort) ?? SORT_CHOICES[0];
  const visible = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const selected = exercises.find((exercise) => exercise.key === selectedKey);
  const selectedOtherNames = selected
    ? otherExerciseNames(namesByKey.get(selected.key), selected.name)
    : [];

  const sessions = useMemo(
    () =>
      selectedKey
        ? buildExerciseSessions(evolutionLogs, selectedKey, resolveExerciseKey)
        : [],
    [selectedKey, evolutionLogs, resolveExerciseKey]
  );

  // "Es el mismo que…": el abierto y `mergeTarget` pasan a ser UN ejercicio con
  // los nombres de los dos (ver lib/exerciseMerge.ts), y queda abierta su ficha. Sobre TODO el historial, también
  // las semanas de descarga: son apuntes del mismo ejercicio.
  const confirmMerge = () => {
    if (!selected || !mergeTarget) return;
    const plan = planExerciseMerge(
      state.routines,
      state.logs,
      resolveExerciseKey,
      selected,
      mergeTarget
    );
    for (const { routineId, day } of plan.days) {
      dispatch({
        type: 'UPDATE_DAY',
        payload: { routineId, dayId: day.id, day },
      });
    }
    for (const log of plan.logs) {
      dispatch({ type: 'UPDATE_WORKOUT_LOG', payload: log });
    }
    setMergeTarget(null);
    animateLayout();
    onSelectExercise(plan.key);
  };
  const records = useMemo(() => getExerciseRecords(sessions), [sessions]);

  const metric =
    CHART_METRICS.find((item) => item.id === metricId) ?? CHART_METRICS[0];
  const chart = useMemo(
    () => buildSessionChart(sessions, metric),
    [sessions, metric]
  );
  const headline = useMemo(
    () => buildHeadline(sessions, metric),
    [sessions, metric]
  );

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: backBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);
  const chartWidth = getChartWidth(windowWidth);

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
          {
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
            paddingBottom: scrollBottomPadding,
          },
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
            {!!emptyAction && (
              <Button
                title={emptyAction.label}
                onPress={emptyAction.onPress}
                variant="primary"
                size="medium"
              />
            )}
          </View>
        )}

        {/* Buscar por nombre, encima del orden: con 30-40 ejercicios encontrar
            uno concreto era scroll y "Ver más". Mismo patrón que el buscador
            del catálogo de ejercicios. */}
        {!selected && exercises.length >= MIN_EXERCISES_FOR_SEARCH && (
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
              <Pressable
                onPress={() => {
                  setQuery('');
                  setVisibleCount(PAGE_SIZE);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('Borrar búsqueda')}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            )}
          </View>
        )}

        {/* Solo la zona: la cascada zona → músculo → equipo es para los
            cientos de ejercicios del catálogo; aquí son 30-40 y el buscador ya
            encuentra por músculo y equipo ("bíceps mancuerna"). */}
        {!selected && exercises.length >= MIN_EXERCISES_FOR_SEARCH && (
          <CatalogTagFilters
            zoneOnly
            items={tagItems}
            value={tagFilter}
            onChange={(next) => {
              animateLayout();
              setTagFilter(next);
              setVisibleCount(PAGE_SIZE);
            }}
          />
        )}

        {/* Cabecera de la lista: cuántos salen (y de cuántos, filtrando) y
            cómo están ordenados, con el orden como botón de su menú. */}
        {!selected && exercises.length >= MIN_EXERCISES_FOR_SORT && (
          <SectionLegend
            title={
              filtering
                ? t('{n} de {total}', {
                    n: filtered.length,
                    total: exercises.length,
                  })
                : t('{n} ejercicios', { n: exercises.length })
            }
            right={
              <View ref={sortAnchorRef} collapsable={false}>
                <Pressable
                  style={({ pressed }) => [
                    styles.sortButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setSortMenuOpen(true)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('Ordenar: {sort}', {
                    sort: activeSort.menuLabel,
                  })}
                >
                  <MaterialCommunityIcons
                    name="sort"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.sortButtonText}>{activeSort.label}</Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              </View>
            }
          />
        )}

        {!selected && filtering && filtered.length === 0 && (
          <View style={styles.noResults}>
            <Text style={styles.emptyText}>{t('Sin resultados')}</Text>
            <Button
              title={t('Quitar filtros')}
              onPress={clearFilters}
              variant="secondary"
              size="small"
            />
          </View>
        )}

        {!selected &&
          visible.map((exercise) => (
            <ExerciseRow
              key={exercise.key}
              exercise={exercise}
              onPress={() => {
                animateLayout();
                onSelectExercise(exercise.key);
              }}
            />
          ))}

        {/* Mismo botón de paginar que el historial de Inicio y el de Cardio:
            antes era un `Button` secundario con otras palabras ("Ver más"). El
            rótulo dice lo que va a CRECER la lista ("+10"), no cuántos faltan:
            con un catálogo de cientos, "Cargar más (312)" se leía como si el
            botón fuese a soltarlos todos. */}
        {!selected && visibleCount < filtered.length && (
          <LoadMoreButton
            step={Math.min(PAGE_SIZE, filtered.length - visibleCount)}
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
                  catalogId={selected.catalogId}
                  size={20}
                  style={styles.cardTitleGif}
                />
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {selected.name}
                </Text>
                {/* La respuesta a "¿cómo voy?" escrita: cuánto ha cambiado la
                    medida elegida desde su primera sesión. El mismo dato de
                    cabecera que "Progreso / semana" de Inicio. Las sesiones y
                    la última fecha van en la barra superior. */}
                {!!headline && (
                  <ChartCardStat
                    trend={{
                      value: headline.delta,
                      suffix: metric.unit,
                      decimals: Number.isInteger(headline.delta) ? 0 : 1,
                    }}
                    caption={t('desde el {date}', {
                      date: shortDayMonth(headline.since),
                    })}
                  />
                )}
              </View>
              {/* Un ejercicio, varios nombres: los otros con los que aparece
                  en tus rutinas y tu historial. */}
              {selectedOtherNames.length > 0 && (
                <Text style={styles.cardHint} numberOfLines={2}>
                  {t('También lo llamas: {names}', {
                    names: formatExerciseNames(selectedOtherNames),
                  })}
                </Text>
              )}

              {/* La gráfica y su filtro, centrados con la misma pieza que
                  Inicio y Cardio (`ChartArea`). La TARJETA sí es distinta: aquí
                  no se pliega ni se pulsa, y el título es el GIF del ejercicio,
                  así que no usa `ChartCard`. */}
              <ChartArea>
                {chart ? (
                  <BarChart
                    points={chart.bars}
                    domain={chart.domain}
                    width={chartWidth}
                    formatYTick={(value) => metric.fmt(value)}
                    scrollable
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

                {/* Qué dicen los colores: sin ella, un rojo se leía como "lo
                    estás haciendo mal" y no como una sesión contra la
                    anterior. */}
                {!!chart && (
                  <View style={[styles.chartLegend, { width: chartWidth }]}>
                    <LegendDot
                      color={theme.colors.success}
                      label={t('Mejor que la anterior')}
                    />
                    <LegendDot color={theme.colors.error} label={t('Peor')} />
                    <LegendDot
                      color={theme.colors.primaryFill}
                      label={t('Última')}
                    />
                  </View>
                )}
              </ChartArea>
            </View>

            <RecordsCard records={records} />
          </>
        )}
      </StretchScrollView>

      {/* Un solo nombre, "Progreso", en lista y en ficha: lo que cambia es el
          subtítulo. En la ficha el nombre del ejercicio ya titula la tarjeta,
          así que aquí van sus sesiones; en la lista, el total, salvo cuando
          ya lo dice la cabecera de la lista (entonces, qué es la pantalla:
          sin subtítulo la barra encoge y el nivel sube respecto a las demás). */}
      <GlassTopBar
        title={t('Progreso')}
        icon="chart-line"
        subtitle={
          selected
            ? t('{n} sesiones · última el {date}', {
                n: selected.sessionCount,
                date: shortDayMonth(selected.lastDate),
              })
            : exercises.length === 0 ||
              exercises.length >= MIN_EXERCISES_FOR_SORT
            ? t('Tu evolución por ejercicio')
            : exercises.length === 1
            ? t('1 ejercicio')
            : t('{n} ejercicios', { n: exercises.length })
        }
        subtitleNumberOfLines={1}
        topInset={insets.top}
        onLayout={onTopBarLayout}
        // Salto a la rutina desde la ficha. Con el ejercicio en varias rutinas,
        // una opción por rutina (con su nombre) en vez de un selector aparte.
        // Y "Es el mismo que…", para cuando el mismo ejercicio salió dos veces
        // (escrito distinto): pasa a ser uno con los dos nombres.
        menuItems={
          selected
            ? [
                ...(onOpenRoutine
                  ? routineHits.map(({ routine, dayId }) => ({
                      icon: 'book-open-variant' as const,
                      label:
                        routineHits.length === 1
                          ? t('Ver en la rutina')
                          : t('Ver en {routine}', { routine: routine.name }),
                      onPress: () => onOpenRoutine(routine, dayId),
                    }))
                  : []),
                ...(exercises.length > 1
                  ? [
                      {
                        icon: 'call-merge' as const,
                        label: t('Es el mismo que…'),
                        onPress: () => setMergeOpen(true),
                      },
                    ]
                  : []),
              ]
            : undefined
        }
      />

      <AnchorMenu
        visible={sortMenuOpen}
        onClose={() => setSortMenuOpen(false)}
        anchorRef={sortAnchorRef}
        items={SORT_CHOICES.map((choice) => ({
          icon: choice.icon,
          label: choice.menuLabel,
          selected: choice.id === sort,
          onPress: () => {
            if (choice.id === sort) return;
            animateLayout();
            setSort(choice.id);
            // La página vuelve al principio: el orden nuevo trae otras filas
            // arriba y quedarse en la página 3 no significa nada.
            setVisibleCount(PAGE_SIZE);
          },
        }))}
      />

      <FloatingBackButton
        onPress={onBack}
        bottom={backBottom}
        label={
          backGoesToList ? `← ${t('Todos los ejercicios')}` : `← ${t('Volver')}`
        }
      />

      {!!selected && (
        <MergeExerciseModal
          visible={mergeOpen}
          current={selected}
          exercises={exercises}
          onClose={() => setMergeOpen(false)}
          onPick={(target) => {
            setMergeOpen(false);
            setMergeTarget(target);
          }}
        />
      )}
      <ConfirmModal
        visible={!!selected && !!mergeTarget}
        icon="call-merge"
        title={t('¿Son el mismo ejercicio?')}
        // Dice lo que va a pasar de verdad (ver lib/exerciseMerge.ts): con un
        // ejercicio del catálogo de por medio, uno con dos nombres; si los dos
        // son propios, el nombre ES lo que los identifica y uno se renombra.
        message={
          selected?.catalogId || mergeTarget?.catalogId
            ? t(
                '«{a}» y «{b}» serán el mismo ejercicio con dos nombres: su historial y sus récords se juntan. Tus series no cambian.',
                { a: selected?.name ?? '', b: mergeTarget?.name ?? '' }
              )
            : t(
                '«{a}» pasará a llamarse «{b}» y su historial y sus récords se juntan. Tus series no cambian.',
                { a: selected?.name ?? '', b: mergeTarget?.name ?? '' }
              )
        }
        confirmLabel={t('Sí, es el mismo')}
        confirmVariant="primary"
        onConfirm={confirmMerge}
        onCancel={() => setMergeTarget(null)}
      />
    </View>
  );
}

/**
 * Elegir qué ejercicio es el abierto con otro nombre: la misma lista de
 * Progreso (sin él), con buscador, porque el duplicado suele llamarse parecido.
 */
function MergeExerciseModal({
  visible,
  current,
  exercises,
  onClose,
  onPick,
}: {
  visible: boolean;
  current: ExerciseSummary;
  exercises: ExerciseSummary[];
  onClose: () => void;
  onPick: (target: ExerciseSummary) => void;
}) {
  const [query, setQuery] = useState('');
  const options = useMemo(() => {
    const needle = slugExerciseName(query);
    return exercises
      .filter((exercise) => exercise.key !== current.key)
      .filter(
        (exercise) =>
          !needle || slugExerciseName(exercise.name).includes(needle)
      )
      .slice(0, MERGE_MAX_OPTIONS);
  }, [exercises, current.key, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      onRequestClose={close}
      onOverlayPress={close}
      icon="call-merge"
      title={t('Es el mismo que…')}
      message={t('Elige el ejercicio que es «{name}» con otro nombre.', {
        name: current.name,
      })}
      align="left"
      footer={
        <Button title={t('Cancelar')} variant="secondary" onPress={close} />
      }
    >
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
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <ScrollView style={styles.mergeList} keyboardShouldPersistTaps="handled">
        {options.length === 0 && (
          <Text style={styles.emptyText}>{t('Sin resultados')}</Text>
        )}
        {options.map((exercise) => (
          <Pressable
            key={exercise.key}
            style={({ pressed }) => [
              styles.mergeRow,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              setQuery('');
              onPick(exercise);
            }}
          >
            <Text style={styles.exerciseName} numberOfLines={2}>
              {exercise.name}
            </Text>
            <Text style={styles.exerciseHint} numberOfLines={1}>
              {t('{n} sesiones · {date}', {
                n: exercise.sessionCount,
                date: shortDayMonth(exercise.lastDate),
              })}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </AppModal>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText} numberOfLines={1}>
        {label}
      </Text>
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
      accessibilityRole="button"
      accessibilityLabel={exercise.name}
    >
      <GradientFill accent={theme.colors.accentLine} />
      {/* La miniatura del GIF identifica la fila de un vistazo (antes por el
          dibujo que por el nombre en una lista de 30-40), pero es solo imagen:
          toda la fila abre la ficha. Cuando era un botón propio, un toque en
          ella abría el GIF a pantalla completa, y sin GIF era una lupa debajo
          del buscador. El visor (y buscar un GIF si falta) vive en la cabecera
          de la ficha. */}
      <ExerciseGifButton
        decorative
        name={exercise.name}
        catalogId={exercise.catalogId}
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
            date: shortDayMonth(exercise.lastDate),
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
    mergeList: {
      maxHeight: 320,
      marginTop: 10,
    },
    mergeRow: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      gap: 2,
    },
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
    noResults: {
      alignItems: 'center',
      gap: 12,
      paddingVertical: theme.spacing.md,
    },
    // El orden activo en la cabecera de la lista: píldora neutra (no un chip
    // de oro, que es de filtrar) con el chevron de "despliega".
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 36,
      paddingHorizontal: 10,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    sortButtonText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.text,
    },
    chartLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      columnGap: 14,
      rowGap: 4,
      marginTop: 10,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
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
