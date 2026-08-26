import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  DayAccentIcon,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  StretchScrollView,
  Toast,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { WorkoutRoutine } from '../../types';
import { getDisplayDayName, getTrainingAccent, theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import {
  countRoutineSets,
  duplicateRoutine,
  intensityLabel,
  routineIntensity,
} from '@lib/routines';
import { fetchPublicRoutine } from '@lib/cloud/social';

interface PublicRoutineScreenProps {
  routineId: string;
  // Nombre y autor que ya tenía la tarjeta del tablón: se pintan mientras baja
  // el plan, para que la vista no abra en blanco.
  name: string;
  authorName?: string;
  onBack: () => void;
}

/**
 * Consulta de una rutina PÚBLICA de la comunidad: sus días y ejercicios en solo
 * lectura, más el "Añadir a mis rutinas". Antes el tablón solo enseñaba nombre y
 * descripción, así que para saber qué traía dentro había que clonarla primero y
 * borrarla si no gustaba. Aquí no se toca nada del espacio del usuario hasta que
 * pulsa el botón.
 *
 * Lo ajeno es SOLO lectura: nada de editar ni reordenar (eso vive en
 * RoutineDetailScreen, sobre las rutinas propias).
 */
export function PublicRoutineScreen({
  routineId,
  name,
  authorName,
  onBack,
}: PublicRoutineScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();

  const [routine, setRoutine] = useState<WorkoutRoutine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: floatingBackBottom } = getFloatingBackButtonMetrics(
    insets.bottom
  );
  const backButtonSpace = FLOATING_BACK_BUTTON_HEIGHT + floatingBackBottom;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchPublicRoutine(routineId);
      if (!fetched) {
        setError(t('Esta rutina ya no está disponible'));
        return;
      }
      setRoutine(fetched);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useEffect(() => {
    load();
  }, [load]);

  // Clona lo ya descargado (ids nuevos) en vez de volver a bajarlo: la vista ya
  // tiene el plan entero delante.
  const handleClone = () => {
    if (!routine) return;
    setCloning(true);
    try {
      const copy = duplicateRoutine(
        routine,
        state.routines.map((r) => r.name)
      );
      dispatch({ type: 'ADD_ROUTINE', payload: copy });
      setToast({ message: t('Añadida a tus rutinas'), type: 'success' });
    } catch (e) {
      setToast({ message: (e as Error).message, type: 'error' });
    } finally {
      setCloning(false);
    }
  };

  const totalSets = routine ? countRoutineSets(routine) : 0;
  const level = routineIntensity(totalSets);
  const levelColor =
    level === 'soft'
      ? theme.colors.success
      : level === 'medium'
      ? theme.colors.warning
      : theme.colors.error;

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
            paddingTop: topBarHeight + 28,
            paddingBottom: backButtonSpace + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera: quién la hizo, de qué va y cuánto pesa la semana. */}
        <View style={styles.infoBlock}>
          <GradientFill accent={theme.colors.primaryLine} />
          <Text style={styles.infoName}>{routine?.name ?? name}</Text>
          {!!authorName && (
            <Text style={styles.author}>
              {t('por {name}', { name: authorName })}
            </Text>
          )}
          {!!routine?.description && (
            <Text style={styles.description}>{routine.description}</Text>
          )}
          {!!routine && (
            <View style={styles.metaRow}>
              <View style={[styles.levelPill, { borderColor: levelColor }]}>
                <MaterialCommunityIcons
                  name="lightning-bolt"
                  size={14}
                  color={levelColor}
                />
                <Text style={[styles.levelText, { color: levelColor }]}>
                  {intensityLabel(level)}
                </Text>
              </View>
              <Text style={styles.metaText}>
                {routine.days.length === 1
                  ? t('1 día')
                  : t('{n} días', { n: routine.days.length })}
                {' · '}
                {totalSets === 1
                  ? t('1 serie')
                  : t('{n} series', { n: totalSets })}
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.muted}>{t('Cargando…')}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <GradientFill accent={theme.colors.error} />
            <Text style={styles.muted}>{error}</Text>
            <Button
              title={t('Reintentar')}
              onPress={load}
              variant="secondary"
            />
          </View>
        ) : (
          routine?.days.map((day) => {
            const accent = getTrainingAccent(day);
            return (
              <View
                key={day.id}
                style={[styles.dayBlock, { borderColor: accent }]}
              >
                <GradientFill accent={accent} />
                <View style={styles.dayHeader}>
                  <View style={styles.dayHeaderLeft}>
                    <DayAccentIcon
                      emoji={day.emoji}
                      name={day.name}
                      size={32}
                    />
                    <Text style={styles.dayName}>
                      {getDisplayDayName(day.name)}
                    </Text>
                  </View>
                  <Text style={styles.dayBadge}>
                    {t('Día')} {day.dayNumber}
                  </Text>
                </View>

                {/* Mismo listado que el modo lectura de una rutina propia:
                    punto de acento + "Nombre — 4x8". */}
                <View style={styles.exerciseList}>
                  {day.exercises.map((exercise) => (
                    <View key={exercise.id} style={styles.exerciseRow}>
                      <View
                        style={[
                          styles.exerciseDot,
                          { backgroundColor: accent },
                        ]}
                      />
                      <Text style={styles.exerciseText}>
                        {exercise.name} — {exercise.targetSets || '-'}x
                        {exercise.targetReps || '-'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}

        {!!routine && (
          <Button
            title={cloning ? t('Añadiendo…') : t('Añadir a mis rutinas')}
            onPress={handleClone}
            disabled={cloning}
            size="large"
          />
        )}
      </StretchScrollView>

      <GlassTopBar
        title={routine?.name ?? name}
        icon="book-open-variant"
        subtitle={t('Rutina de la comunidad')}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1 },
    content: { paddingHorizontal: theme.spacing.md, gap: 12 },
    // Banner de cabecera con el mismo lenguaje que el de una rutina propia
    // (fondo dorado tenue), para que se lea como "ficha de rutina".
    infoBlock: {
      backgroundColor: theme.colors.primaryMuted,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.primary + '55',
      padding: theme.spacing.md,
      overflow: 'hidden',
      gap: 6,
    },
    infoName: {
      fontSize: 22,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 31,
    },
    author: { color: theme.colors.textMuted, fontSize: 13 },
    description: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 19,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    levelPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
    },
    levelText: { fontSize: 12, fontWeight: '800' },
    metaText: { color: theme.colors.textSecondary, fontSize: 13 },
    dayBlock: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderLeftWidth: 4,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      overflow: 'hidden',
      gap: 10,
      ...theme.shadow.soft,
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    dayHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    dayName: {
      flex: 1,
      fontSize: 18,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 25,
    },
    dayBadge: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
    },
    exerciseList: { gap: 6 },
    exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    exerciseDot: { width: 6, height: 6, borderRadius: 3 },
    exerciseText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 19,
      color: theme.colors.textSecondary,
    },
    loadingBox: { alignItems: 'center', gap: 10, paddingVertical: 28 },
    errorCard: {
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    muted: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
