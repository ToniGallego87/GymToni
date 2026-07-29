import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ConfirmModal,
  DatePickerModal,
  DayAccentIcon,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  StretchScrollView,
} from '@components';
import { assignmentDuplicatesDayInWeek } from '@lib/weeks';
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
import {
  combineDateWithTime,
  formatDate,
  getImprovementDisplay,
  getLogTimestamp,
} from '@lib/utils';
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
  // Abrir el registro para corregir esta sesión (misma acción que "Editar" en
  // el menú ⋯ de Inicio).
  onEdit?: () => void;
  // Eliminar la sesión completa (fuerza y cardio). Se pide confirmación antes.
  onDelete?: () => void;
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

export function DetailScreen({
  log,
  day,
  onBack,
  onEdit,
  onDelete,
}: DetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingSplitDate, setPendingSplitDate] = useState<string | null>(null);
  // La fecha se puede corregir aquí; se guarda en el acto (UPDATE_WORKOUT_LOG).
  // Estado local para que el subtítulo se refresque sin salir de la pantalla.
  const [currentDate, setCurrentDate] = useState(log.date);

  const dayNumberForLog = (l: WorkoutLog): number | undefined => {
    for (const routine of state.routines) {
      const d = routine.days.find((day) => day.id === l.dayId);
      if (d) return d.dayNumber;
    }
    return undefined;
  };

  // Guarda la nueva fecha del log, recolocando `createdAt` (con lo que se ordenan
  // y agrupan las semanas). Avisa antes si la fecha parte una semana existente.
  const commitDate = (date: string) => {
    const baseCreatedAt = log.createdAt || Date.now();
    const createdAt = combineDateWithTime(date, baseCreatedAt);
    dispatch({
      type: 'UPDATE_WORKOUT_LOG',
      payload: { ...log, date, createdAt, updatedAt: Date.now() },
    });
    setCurrentDate(date);
  };

  const applyChosenDate = (date: string) => {
    setShowDatePicker(false);
    if (date === currentDate) return;

    const routineLogs = state.logs.filter((l) => l.routineId === log.routineId);
    const newTimestamp = combineDateWithTime(date, log.createdAt || Date.now());
    if (
      assignmentDuplicatesDayInWeek(
        routineLogs,
        log,
        newTimestamp,
        dayNumberForLog
      )
    ) {
      setPendingSplitDate(date);
      return;
    }
    commitDate(date);
  };

  // Fija un GIF del catálogo al ejercicio de la rutina a la que pertenece el log
  // (por routineId + exerciseId): se guarda en la rutina, no en el log.
  const handleAssignGif = (exerciseId: string, catalogId: string) => {
    const routine = state.routines.find((r) => r.id === log.routineId);
    const targetDay = routine?.days.find((d) => d.id === log.dayId);
    if (!routine || !targetDay) return;
    const updatedDay = {
      ...targetDay,
      exercises: targetDay.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, catalogId } : ex
      ),
    };
    dispatch({
      type: 'UPDATE_DAY',
      payload: { routineId: routine.id, dayId: targetDay.id, day: updatedDay },
    });
  };

  // catalogId VIVO del ejercicio (refleja una asignación recién hecha).
  const liveDay = state.routines
    .flatMap((r) => r.days)
    .find((d) => d.id === log.dayId);
  const liveCatalogId = (exerciseId: string): string | undefined =>
    liveDay?.exercises.find((ex) => ex.id === exerciseId)?.catalogId;

  // Acciones propias del detalle en el menú ⋯: corregir la sesión o borrarla.
  // Eliminar pasa por un ConfirmModal (acción destructiva).
  type TopBarItem = NonNullable<
    React.ComponentProps<typeof GlassTopBar>['menuItems']
  >[number];
  const menuItems: TopBarItem[] = [];
  if (onEdit) {
    menuItems.push({
      icon: 'pencil-outline',
      label: t('Editar'),
      onPress: onEdit,
    });
  }
  menuItems.push({
    icon: 'calendar-edit',
    label: t('Cambiar fecha'),
    onPress: () => setShowDatePicker(true),
  });
  if (onDelete) {
    menuItems.push({
      icon: 'delete-outline',
      label: t('Eliminar'),
      onPress: () => setShowDeleteModal(true),
    });
  }
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

  const displayedDate = currentDate
    ? new Date(`${currentDate}T00:00:00`)
        .toLocaleDateString(dateLocale, {
          weekday: 'long',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        .replace(/^[a-z]/, (c) => c.toUpperCase())
    : formatDate(log.createdAt);

  // La comparación con la sesión anterior salta las semanas de descarga (su marca
  // viaja en cada log del bloque): un deload no es referencia. Y si ESTE log es de
  // una semana de descarga, no se compara con nada (queda al margen).
  const previousLog = log.isDeload
    ? null
    : [...state.logs]
        .filter(
          (l) =>
            l.dayId === log.dayId &&
            !l.isDeload &&
            getLogTimestamp(l) < getLogTimestamp(log)
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
              catalogId={liveCatalogId(exercise.id) ?? exercise.catalogId}
              onAssignGif={(catalogId) =>
                handleAssignGif(exercise.id, catalogId)
              }
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
        menuItems={menuItems.length ? menuItems : undefined}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      <ConfirmModal
        visible={showDeleteModal}
        title={t('¿Eliminar entrenamiento?')}
        message={t('Esta acción no se puede deshacer. ¿Estás seguro?')}
        confirmLabel={t('Eliminar')}
        onConfirm={() => {
          setShowDeleteModal(false);
          onDelete?.();
        }}
        onCancel={() => setShowDeleteModal(false)}
      />

      <DatePickerModal
        visible={showDatePicker}
        value={currentDate}
        onSelect={applyChosenDate}
        onRequestClose={() => setShowDatePicker(false)}
      />

      <ConfirmModal
        visible={pendingSplitDate !== null}
        title={t('¿Dividir la semana?')}
        message={t(
          'Esa fecha cae en una semana que ya tiene este día. Se partirá en dos y puede afectar a la racha y al progreso. ¿Continuar?'
        )}
        confirmLabel={t('Continuar')}
        confirmVariant="primary"
        onConfirm={() => {
          if (pendingSplitDate) commitDate(pendingSplitDate);
          setPendingSplitDate(null);
        }}
        onCancel={() => setPendingSplitDate(null)}
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

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
