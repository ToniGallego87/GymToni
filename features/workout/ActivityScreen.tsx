import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityList,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  LoadMoreButton,
  useGlassTopBarHeight,
  StretchScrollView,
} from '@components';
import { WorkoutDay, WorkoutLog } from '../../types';
import { useWorkout } from '@hooks/useWorkout';
import { useAccountLevel } from '@hooks/useAccountLevel';
import { useExerciseKeyResolver } from '@hooks/useExerciseKeyResolver';
import { useMyProfile } from '@hooks/useMyProfile';
import { useSession } from '@lib/cloud/auth';
import { useChallengeWins } from '@lib/level';
import { buildLocalActivity, groupActivityByMonth } from '@lib/activity';
import { buildWorkoutImprovement } from '@lib/progress';
import { findDayInRoutines, getLogTimestamp } from '@lib/utils';
import { theme } from '@lib/theme';
import { dateLocale, t } from '@lib/i18n';
import { ProfileEditModal } from './ProfileEditModal';

interface ActivityScreenProps {
  onBack: () => void;
  /** Un entreno abre su sesión (el Detalle), como desde Inicio o el Calendario. */
  onOpenLog: (log: WorkoutLog, day: WorkoutDay) => void;
  /** Un récord abre el Progreso de su ejercicio. */
  onOpenExerciseProgress: (exerciseKey: string) => void;
}

// Meses por tanda: con años de historial, pintarlos todos al entrar se nota.
// Los siguientes se piden con el botón del pie, que dice cuántos quedan.
const MONTH_PAGE = 3;

/**
 * Actividad PROPIA: tus logros, retos, récords y días entrenados como un diario
 * por meses, desde los datos del móvil. Es la misma lista que ven los demás en
 * tu perfil de Comunidad, pero sin depender de la nube: sin cuenta, sin red o
 * con "No compartir", uno sigue pudiendo ver su propia trayectoria. Todo sale
 * de lo que la app ya calcula (`buildLocalActivity`, el mismo cálculo que se
 * publica).
 */
export function ActivityScreen({
  onBack,
  onOpenLog,
  onOpenExerciseProgress,
}: ActivityScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const { badges, challenges } = useAccountLevel();
  const wins = useChallengeWins();
  const resolveExerciseKey = useExerciseKeyResolver();
  const { user } = useSession();
  const { profile } = useMyProfile();
  const [visibleMonths, setVisibleMonths] = useState(MONTH_PAGE);
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  const items = useMemo(
    () =>
      buildLocalActivity({
        logs: state.logs,
        routines: state.routines,
        badges,
        challenges,
        wins,
        resolveExerciseKey,
      }),
    [state.logs, state.routines, badges, challenges, wins, resolveExerciseKey]
  );

  const months = useMemo(() => groupActivityByMonth(items), [items]);
  const shownItems = useMemo(
    () => months.slice(0, visibleMonths).flatMap((month) => month.items),
    [months, visibleMonths]
  );
  const remainingMonths = Math.max(0, months.length - visibleMonths);

  const logsById = useMemo(
    () => new Map(state.logs.map((log) => [log.id, log])),
    [state.logs]
  );
  const dayOf = (logId: string) => {
    const log = logsById.get(logId);
    const day = log ? findDayInRoutines(state.routines, log.dayId) : undefined;
    return log && day ? { log, day } : null;
  };

  // Mejora de cada entreno frente a la sesión anterior del mismo día, saltando
  // las descargas (pesos rebajados a propósito): el mismo % que el historial
  // de Inicio. Una sesión de descarga no se compara.
  const trendByLog = useMemo(() => {
    const byDay = new Map<string, WorkoutLog[]>();
    state.logs
      .filter((log) => !log.cardioOnly)
      .forEach((log) => {
        byDay.set(log.dayId, [...(byDay.get(log.dayId) ?? []), log]);
      });
    const trends = new Map<string, { percent: number; isImproved: boolean }>();
    byDay.forEach((dayLogs) => {
      const sorted = [...dayLogs].sort(
        (a, b) => getLogTimestamp(a) - getLogTimestamp(b)
      );
      let previous: WorkoutLog | null = null;
      for (const log of sorted) {
        if (log.isDeload) continue;
        const trend = previous ? buildWorkoutImprovement(log, previous) : null;
        if (trend) trends.set(log.id, trend);
        previous = log;
      }
    });
    return trends;
  }, [state.logs]);

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  // "34 hitos desde mar 2025": el total y desde cuándo, en una línea.
  const oldest = items[items.length - 1]?.happenedOn;
  const since = oldest
    ? new Date(
        Number(oldest.slice(0, 4)),
        Number(oldest.slice(5, 7)) - 1,
        1
      )
        .toLocaleDateString(dateLocale, { month: 'short', year: 'numeric' })
        .replace('.', '')
    : '';

  // Si Comunidad ve esta lista: solo con cuenta (sin ella no se publica nada).
  const shared = profile ? profile.share_activity !== false : null;

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
                'Cada día que entrenes, cada récord que batas, cada reto que superes y cada logro que consigas aparecerá aquí.'
              )}
            </Text>
          </View>
        ) : (
          <>
            <ActivityList
              items={shownItems}
              canOpenDay={(item) => !!dayOf(item.ref)}
              onOpenDay={(item) => {
                const found = dayOf(item.ref);
                if (found) onOpenLog(found.log, found.day);
              }}
              dayTrend={(item) => trendByLog.get(item.ref) ?? null}
              onOpenRecord={(item) => {
                if (item.exerciseKey) onOpenExerciseProgress(item.exerciseKey);
              }}
            />

            {remainingMonths > 0 && (
              <LoadMoreButton
                style={styles.loadMore}
                label={
                  remainingMonths === 1
                    ? t('Mes anterior')
                    : t('Meses anteriores ({n})', { n: remainingMonths })
                }
                onPress={() => setVisibleMonths((n) => n + MONTH_PAGE)}
              />
            )}
          </>
        )}

        {/* Quién ve esta lista: la misma sale en tu perfil de Comunidad si la
            compartes. El interruptor vive en Editar perfil, a un toque. */}
        {!!user && shared !== null && (
          <View style={styles.shareRow}>
            <MaterialCommunityIcons
              name={shared ? 'account-group-outline' : 'lock-outline'}
              size={18}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.shareText}>
              {shared
                ? t('Visible en tu perfil de Comunidad')
                : t('Solo la ves tú')}
            </Text>
            <Pressable
              onPress={() => setShowProfileEdit(true)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.shareButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Cambiar quién ve tu actividad')}
            >
              <Text style={styles.shareButtonText}>{t('Cambiar')}</Text>
            </Pressable>
          </View>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Actividad')}
        icon="timeline-text-outline"
        subtitle={
          items.length
            ? t('{n} hitos desde {date}', { n: items.length, date: since })
            : undefined
        }
        subtitleNumberOfLines={1}
        topInset={insets.top}
        onLayout={onTopBarLayout}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      <ProfileEditModal
        visible={showProfileEdit}
        onClose={() => setShowProfileEdit(false)}
      />
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
    loadMore: {
      marginTop: 16,
    },
    shareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 20,
      paddingHorizontal: 4,
    },
    shareText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    shareButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    shareButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    pressed: { opacity: 0.6 },
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
