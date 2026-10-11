import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityList,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  StretchScrollView,
} from '@components';
import { WorkoutRoutine } from '../../types';
import { useWorkout } from '@hooks/useWorkout';
import { useAccountLevel } from '@hooks/useAccountLevel';
import { useChallengeWins } from '@lib/level';
import { buildLocalActivity } from '@lib/activity';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';

interface ActivityScreenProps {
  onBack: () => void;
  onOpenRoutine: (routine: WorkoutRoutine) => void;
}

// Hitos por tanda: con años de historial son cientos de días, y pintarlos
// todos al entrar se nota. La siguiente se pide tirando de la lista hacia
// arriba más allá de su final (no solo con llegar a él).
const PAGE_SIZE = 10;
// Lo que gira la rueda antes de añadir la tanda. Cargar es local e inmediato,
// pero sin este momento la lista crecería de golpe sin que se viera por qué.
const LOAD_DELAY_MS = 450;

/**
 * Actividad PROPIA: tus insignias, tus retos superados y tus días entrenados en
 * una línea de tiempo, desde los datos del móvil. Es la misma lista que ven los
 * demás en tu perfil de Comunidad, pero sin depender de la nube: sin cuenta,
 * sin red o con "No compartir", uno sigue pudiendo ver su propia trayectoria.
 * Todo sale de lo que la app ya calcula (`buildLocalActivity`, el mismo cálculo
 * que se publica).
 */
export function ActivityScreen({ onBack, onOpenRoutine }: ActivityScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const { badges, challenges } = useAccountLevel();
  const wins = useChallengeWins();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingRef = useRef(false);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportHeight = useRef(0);
  const spin = useRef(new Animated.Value(0)).current;

  const items = useMemo(
    () =>
      buildLocalActivity({
        logs: state.logs,
        routines: state.routines,
        badges,
        challenges,
        wins,
      }),
    [state.logs, state.routines, badges, challenges, wins]
  );

  const counts = useMemo(
    () => ({
      badge: items.filter((item) => item.kind === 'badge').length,
      challenge: items.filter((item) => item.kind === 'challenge').length,
      day: items.filter((item) => item.kind === 'day').length,
    }),
    [items]
  );

  const hasMore = items.length > visible;

  // Siguiente tanda: la rueda gira un momento y la lista crece. El ref evita
  // pedir dos tandas a la vez.
  const loadMore = () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    loadTimer.current = setTimeout(() => {
      setVisible((n) => n + PAGE_SIZE);
      setLoadingMore(false);
      loadingRef.current = false;
    }, LOAD_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (loadTimer.current) clearTimeout(loadTimer.current);
    },
    []
  );

  // La rueda está quieta mientras no carga, y gira solo mientras carga.
  useEffect(() => {
    if (!loadingMore) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [loadingMore, spin]);
  const spinStyle = {
    transform: [
      {
        rotate: spin.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  // Si la tanda no llena la pantalla no hay scroll que la pida: se carga sola.
  const onContentSizeChange = (_width: number, height: number) => {
    if (viewportHeight.current && height < viewportHeight.current) loadMore();
  };

  // Un día enlaza a su rutina si sigue existiendo en el móvil.
  const routineIds = useMemo(
    () => new Set(state.routines.map((routine) => routine.id)),
    [state.routines]
  );

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  const summary = [
    { icon: 'calendar-check' as const, value: counts.day, label: t('Días') },
    {
      icon: 'trophy-variant' as const,
      value: counts.challenge,
      label: t('Retos'),
    },
    { icon: 'medal-outline' as const, value: counts.badge, label: t('Logros') },
  ];

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
        onPullPastEnd={loadMore}
        onLayout={(event) => {
          viewportHeight.current = event.nativeEvent.layout.height;
        }}
        onContentSizeChange={onContentSizeChange}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="timeline-outline"
              size={40}
              color={theme.colors.textMuted}
            />
            <Text style={styles.emptyTitle}>{t('Aún no hay actividad')}</Text>
            <Text style={styles.emptyText}>
              {t(
                'Cada día que entrenes, cada reto que superes y cada logro que consigas aparecerá aquí.'
              )}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              {summary.map((entry) => (
                <View key={entry.label} style={styles.summaryItem}>
                  <MaterialCommunityIcons
                    name={entry.icon}
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.summaryValue}>{entry.value}</Text>
                  <Text style={styles.summaryLabel}>{entry.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.listCard}>
              <ActivityList
                items={items.slice(0, visible)}
                publicRoutineIds={routineIds}
                onOpenRoutine={(routineId) => {
                  const routine = state.routines.find(
                    (r) => r.id === routineId
                  );
                  if (routine) onOpenRoutine(routine);
                }}
              />
            </View>

            {/* La rueda solo existe mientras carga: aparece al tirar de la
                lista hacia arriba más allá del final, gira y se va con la
                siguiente tanda ya dentro. */}
            {loadingMore && (
              <View
                style={styles.loader}
                accessibilityLabel={t('Cargando más actividad')}
              >
                <Animated.View style={spinStyle}>
                  <MaterialCommunityIcons
                    name="loading"
                    size={26}
                    color={theme.colors.textSecondary}
                  />
                </Animated.View>
              </View>
            )}
          </>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Actividad')}
        icon="timeline-text-outline"
        subtitle={
          items.length ? t('{n} hitos', { n: items.length }) : undefined
        }
        subtitleNumberOfLines={1}
        topInset={insets.top}
        onLayout={onTopBarLayout}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />
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
    },
    summary: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
    },
    summaryLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    listCard: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    loader: {
      alignItems: 'center',
      paddingVertical: 18,
    },
    empty: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 48,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.text,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      color: theme.colors.textSecondary,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
