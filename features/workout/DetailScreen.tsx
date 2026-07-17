import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DayAccentIcon,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  StretchScrollView,
} from '@components';
import { ExerciseResultDisplay } from '@components/ExerciseResultDisplay';
import {
  cardioSessionFromLog,
  disciplineIconName,
  estimateEntryKcal,
  fmtNum,
  hasIncline,
  weightForTimestamp,
  WeightSegment,
} from '@lib/cardio';
import { getCardioWeightHistory } from '@lib/storage';
import { formatDate, getImprovementDisplay, getLogTimestamp } from '@lib/utils';
import { WorkoutLog, WorkoutDay, ExerciseLog } from '../../types';
import { useWorkout } from '@hooks/useWorkout';
import { theme, getTrainingAccent, getDisplayDayName } from '@lib/theme';
import { t, dateLocale } from '@lib/i18n';
import {
  buildImprovementFromStrengthScores,
  getExerciseStrengthScore,
} from '@lib/progress';

interface DetailScreenProps {
  log: WorkoutLog;
  day: WorkoutDay;
  onBack: () => void;
}

function extractIncline(rawInput: string): string | null {
  if (!rawInput) return null;
  // Buscar patrón "10p", "5.5p", etc.
  const match = rawInput.match(/(\d+(?:\.\d+)?)\s*p(?:\s|,|$)/i);
  return match ? `${match[1]}%` : null;
}

function extractPaceNumber(pace: string): string {
  if (!pace) return '';
  // Extraer solo el número (ej: "11.5kmh" -> "11.5")
  const match = pace.match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : pace;
}

export function DetailScreen({ log, day, onBack }: DetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const dayAccent = getTrainingAccent({ emoji: day.emoji, name: day.name });
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding =
    floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  // Tramos de peso: las kcal de cada entrada se estiman con el peso vigente
  // cuando se registró el cardio (mismo criterio que la pantalla de Cardio).
  const [weightHistory, setWeightHistory] = useState<WeightSegment[]>([]);
  useEffect(() => {
    getCardioWeightHistory()
      .then((history) => {
        if (history.length) setWeightHistory(history);
      })
      .catch(() => {});
  }, []);
  const weightKg = weightForTimestamp(weightHistory, log.createdAt);

  // Sesión de cardio parseada del log (null si no hay cardio parseable).
  const cardioSession = log.cardio
    ? cardioSessionFromLog(log, weightHistory)
    : null;

  const displayedDate = log.date
    ? new Date(`${log.date}T00:00:00`)
        .toLocaleDateString(dateLocale, {
          weekday: 'long',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        .replace(/^[a-z]/, (c) => c.toUpperCase())
    : formatDate(log.createdAt);

  const previousLog =
    [...state.logs]
      .filter(
        (l) =>
          l.dayId === log.dayId && getLogTimestamp(l) < getLogTimestamp(log)
      )
      .sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a))[0] || null;

  const getExerciseFromLog = (
    sourceLog: WorkoutLog | null,
    exerciseId: string,
    exerciseName: string,
    order?: number
  ): ExerciseLog | null => {
    if (!sourceLog || !sourceLog.exercises) return null;

    // Buscar por ID de ejercicio
    let found = sourceLog.exercises.find((e) => e.exerciseId === exerciseId);
    if (found) return found;

    // Buscar por nombre
    found = sourceLog.exercises.find((e) => e.exerciseName === exerciseName);
    if (found) return found;

    // Buscar por orden si todo lo demás falla
    if (order !== undefined) {
      found = sourceLog.exercises.find((e) => e.order === order);
      if (found) return found;
    }

    return null;
  };

  const formatImprovementDisplay = (imp: {
    isImproved: boolean;
    percent: number;
  }) => {
    const { symbol, display, kind } = getImprovementDisplay(imp);
    const color =
      kind === 'up'
        ? theme.colors.success
        : kind === 'down'
        ? theme.colors.error
        : theme.colors.warning;
    return { symbol, color, display };
  };

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

      <StretchScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topBarHeight + 28,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {day.exercises.map((exercise, exerciseIndex) => {
          const currentExercise = getExerciseFromLog(
            log,
            exercise.id,
            exercise.name,
            exercise.order
          );

          // Si no encuentra el ejercicio por ID/nombre/order, intenta por índice
          const fallbackExercise =
            !currentExercise && log.exercises && log.exercises[exerciseIndex]
              ? log.exercises[exerciseIndex]
              : currentExercise;

          const prevExercise = getExerciseFromLog(
            previousLog,
            exercise.id,
            exercise.name,
            exercise.order
          );
          const exerciseImprovement =
            (fallbackExercise || currentExercise) && prevExercise
              ? buildImprovementFromStrengthScores(
                  getExerciseStrengthScore(fallbackExercise || currentExercise),
                  getExerciseStrengthScore(prevExercise)
                )
              : null;

          const selectedExercise = fallbackExercise || currentExercise;

          return (
            <ExerciseResultDisplay
              key={exercise.id}
              exerciseName={exercise.name}
              targetSets={exercise.targetSets}
              targetReps={exercise.targetReps as string | number | undefined}
              rawInput={selectedExercise?.rawInput || '-'}
              parsedSets={selectedExercise?.parsedSets || []}
              notes={selectedExercise?.notes}
              previousSets={prevExercise?.parsedSets}
              improvementText={
                exerciseImprovement
                  ? (() => {
                      const fmt = formatImprovementDisplay(exerciseImprovement);
                      return `${fmt.symbol} ${fmt.display}%`;
                    })()
                  : undefined
              }
              improvementPositive={
                exerciseImprovement ? exerciseImprovement.isImproved : true
              }
              improvementColor={
                exerciseImprovement
                  ? (() => {
                      const fmt = formatImprovementDisplay(exerciseImprovement);
                      return fmt.color;
                    })()
                  : undefined
              }
              isDetail={true}
              accent={dayAccent}
            />
          );
        })}

        {log.cardio && (
          <>
            {/* En un día de solo cardio (sin ejercicios) el título "Cardio"
                sobra: toda la vista es cardio. */}
            {day.exercises.length > 0 && (
              <Text
                style={[
                  styles.sectionTitle,
                  { marginTop: theme.spacing.xl, color: theme.colors.white },
                ]}
              >
                {t('Cardio')}
              </Text>
            )}
            {cardioSession ? (
              // Una caja por entrada registrada (el rawInput puede traer varias
              // unidas por " | "): sin agrupar por disciplina, para poder leer
              // cada tanda tal cual se metió.
              cardioSession.entries.map((entry, index) => {
                const kcal = estimateEntryKcal(entry, weightKg);
                return (
                  <View key={`${entry.raw}-${index}`} style={styles.cardioBox}>
                    <GradientFill accent={dayAccent} />
                    <View style={styles.cardioLabelRow}>
                      <MaterialCommunityIcons
                        name={
                          disciplineIconName(
                            entry.type,
                            hasIncline(entry.pendiente)
                          ) as React.ComponentProps<
                            typeof MaterialCommunityIcons
                          >['name']
                        }
                        size={16}
                        color={theme.colors.textSecondary}
                      />
                      <Text
                        style={[styles.cardioLabel, styles.cardioLabelInRow]}
                      >
                        {entry.type.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.cardioDetails}>
                      {entry.minutes != null && (
                        <View style={styles.cardioDetailRow}>
                          <MaterialCommunityIcons
                            name="timer-sand"
                            size={14}
                            color={theme.colors.textSecondary}
                          />
                          <Text style={styles.cardioDetail}>
                            {fmtNum(entry.minutes)} min
                          </Text>
                        </View>
                      )}
                      {entry.speed != null && (
                        <View style={styles.cardioDetailRow}>
                          <MaterialCommunityIcons
                            name="map-marker-path"
                            size={14}
                            color={theme.colors.textSecondary}
                          />
                          <Text style={styles.cardioDetail}>
                            {fmtNum(entry.speed)} km/h
                          </Text>
                        </View>
                      )}
                      {entry.pendiente != null && (
                        <View style={styles.cardioDetailRow}>
                          <MaterialCommunityIcons
                            name="chart-line"
                            size={14}
                            color={theme.colors.textSecondary}
                          />
                          <Text style={styles.cardioDetail}>
                            {fmtNum(entry.pendiente)}%
                          </Text>
                        </View>
                      )}
                      {kcal > 0 && (
                        <View style={styles.cardioDetailRow}>
                          <MaterialCommunityIcons
                            name="fire"
                            size={14}
                            color={theme.colors.textSecondary}
                          />
                          <Text style={styles.cardioDetail}>
                            {Math.round(kcal)} kcal
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              // Fallback legado: rawInput no parseable, se muestra el resumen
              // simple del primer registro como antes.
              <View style={styles.cardioBox}>
                <GradientFill accent={dayAccent} />
                <Text style={styles.cardioLabel}>
                  {log.cardio.type?.toUpperCase()}
                </Text>
                <View style={styles.cardioDetails}>
                  {log.cardio.duration && (
                    <View style={styles.cardioDetailRow}>
                      <MaterialCommunityIcons
                        name="timer-sand"
                        size={14}
                        color={theme.colors.textSecondary}
                      />
                      <Text style={styles.cardioDetail}>
                        {log.cardio.duration} min
                      </Text>
                    </View>
                  )}
                  {log.cardio.pace && (
                    <View style={styles.cardioDetailRow}>
                      <MaterialCommunityIcons
                        name="map-marker-path"
                        size={14}
                        color={theme.colors.textSecondary}
                      />
                      <Text style={styles.cardioDetail}>
                        {extractPaceNumber(log.cardio.pace)} km/h
                      </Text>
                    </View>
                  )}
                  {log.cardio.rawInput &&
                    extractIncline(log.cardio.rawInput) && (
                      <View style={styles.cardioDetailRow}>
                        <MaterialCommunityIcons
                          name="chart-line"
                          size={14}
                          color={theme.colors.textSecondary}
                        />
                        <Text style={styles.cardioDetail}>
                          {extractIncline(log.cardio.rawInput)}
                        </Text>
                      </View>
                    )}
                </View>
              </View>
            )}
          </>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={getDisplayDayName(day.name)}
        titleElement={
          <View style={styles.topBarTitleRow}>
            <DayAccentIcon emoji={day.emoji} name={day.name} size={24} />
            <Text style={styles.topBarTitleText}>
              {getDisplayDayName(day.name)}
            </Text>
          </View>
        }
        subtitle={displayedDate}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topBarTitleText: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.4,
    color: theme.colors.current,
    marginBottom: theme.spacing.xs,
    lineHeight: 25,
  },
  cardioBox: {
    backgroundColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  cardioLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  // El margen inferior lo pone la fila: aquí desalinearía el icono.
  cardioLabelInRow: {
    marginBottom: 0,
  },
  cardioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    lineHeight: 16,
  },
  cardioDetails: {
    flexDirection: 'row',
    // Con las kcal ya son cuatro datos: en pantallas estrechas pasan a dos filas.
    flexWrap: 'wrap',
    columnGap: 16,
    rowGap: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  cardioDetail: {
    fontSize: 13,
    color: theme.colors.white,
    fontWeight: '500',
    lineHeight: 18,
  },
  cardioDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
