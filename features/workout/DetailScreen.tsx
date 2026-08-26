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
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  StretchScrollView,
} from '@components';
import {
  assignmentDuplicatesDayInWeek,
  groupLogsIntoWeekBlocks,
  isWeekCompleted,
  orderedBlockNumbers,
  planWeekMove,
  weekMoveNeedsConfirm,
  WeekMoveDirection,
  WeekMovePlan,
} from '@lib/weeks';
import { ExerciseResultDisplay } from '@components/ExerciseResultDisplay';
import {
  cardioSessionFromLog,
  toCardioOnlyLog,
  disciplineIconName,
  estimateEntryKcal,
  hasIncline,
  weightForTimestamp,
  WeightSegment,
} from '@lib/cardio';
import { exerciseKey } from '@lib/exerciseProgress';
import { getCardioWeightHistory } from '@lib/storage';
import {
  combineDateWithTime,
  findDayInRoutines,
  formatDate,
  getImprovementColor,
  getImprovementDisplay,
  getLogTimestamp,
} from '@lib/utils';
import { WorkoutLog, WorkoutDay, ExerciseLog } from '../../types';
import { useWorkout } from '@hooks/useWorkout';
import { theme, getTrainingAccent, getDisplayDayName } from '@lib/theme';
import { t, dateLocale, fmtNum } from '@lib/i18n';
import {
  buildImprovementFromStrengthScores,
  buildWorkoutImprovement,
  getExerciseStrengthScore,
  hasScoringSets,
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
  // Abrir la evolución de un ejercicio (gráfica) preseleccionado por su clave.
  onOpenExerciseProgress?: (exerciseKey: string) => void;
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
  onOpenExerciseProgress,
}: DetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCardioToo, setDeleteCardioToo] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingSplitDate, setPendingSplitDate] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    plan: WeekMovePlan;
    removesWeek: boolean;
  } | null>(null);
  // La fecha se puede corregir aquí; se guarda en el acto (UPDATE_WORKOUT_LOG).
  // Estado local para que el subtítulo se refresque sin salir de la pantalla.
  const [currentDate, setCurrentDate] = useState(log.date);

  const dayNumberForLog = (l: WorkoutLog): number | undefined =>
    findDayInRoutines(state.routines, l.dayId)?.dayNumber;

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

  // Mover el día a la semana contigua. El detalle es la única superficie de
  // acciones de un log pasado (Inicio ya no lo ofrece), así que aquí vive también
  // "mover semana": misma lógica derivada de bloques que usaba Inicio (lib/weeks).
  const routine = state.routines.find((r) => r.id === log.routineId);
  const routineLogs = state.logs.filter((l) => l.routineId === log.routineId);
  const moveDayKey = (l: WorkoutLog) => dayNumberForLog(l);
  const movePrevPlan = planWeekMove(routineLogs, log.id, 'prev', moveDayKey);
  const moveNextPlan = planWeekMove(routineLogs, log.id, 'next', moveDayKey);

  const applyMoveWeek = (plan: WeekMovePlan) => {
    const stamp = Date.now();
    plan.changedLogs.forEach((l) =>
      dispatch({
        type: 'UPDATE_WORKOUT_LOG',
        payload: { ...l, updatedAt: stamp },
      })
    );
  };

  // Confirmar solo si el movimiento vacía una semana o toca una ya completada
  // (origen o destino): recalcula racha, progreso y logros. En incompletas, directo.
  const requestMoveWeek = (
    plan: WeekMovePlan,
    direction: WeekMoveDirection
  ) => {
    const moveBlocks = groupLogsIntoWeekBlocks(routineLogs, moveDayKey);
    const ordered = orderedBlockNumbers(moveBlocks);
    const activeDays = routine?.days ?? [];
    const sourceBlock = ordered.find((b) =>
      (moveBlocks[b] || []).some((l) => l.id === log.id)
    );
    const blockCompleted = (b: number | undefined) =>
      b != null && isWeekCompleted(moveBlocks[b] || [], activeDays);
    if (
      weekMoveNeedsConfirm({
        plan,
        sourceBlock,
        direction,
        isBlockCompleted: blockCompleted,
      })
    ) {
      setPendingMove({ plan, removesWeek: plan.removesSourceWeek });
      return;
    }
    applyMoveWeek(plan);
  };

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
  // "Cambiar fecha" no va aquí: el subtítulo de la barra ya es un enlace visible
  // (texto dorado + icono calendar-edit) que abre el mismo DatePicker. Un item en
  // el ⋯ sería una segunda vía para lo mismo.
  if (movePrevPlan) {
    menuItems.push({
      icon: 'calendar-arrow-left',
      label: t('Mover a la semana anterior'),
      onPress: () => requestMoveWeek(movePrevPlan, 'prev'),
    });
  }
  if (moveNextPlan) {
    menuItems.push({
      icon: 'calendar-arrow-right',
      label: moveNextPlan.createsNewWeek
        ? t('Mover a una semana nueva')
        : t('Mover a la semana siguiente'),
      onPress: () => requestMoveWeek(moveNextPlan, 'next'),
    });
  }
  if (onDelete) {
    menuItems.push({
      icon: 'delete-outline',
      label: t('Eliminar'),
      onPress: () => setShowDeleteModal(true),
    });
  }
  const dayAccent = getTrainingAccent({ emoji: day.emoji, name: day.name });
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

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

  // Resumen de la sesión para la cabecera: nº de ejercicios registrados, mejora
  // global respecto a la sesión anterior (mismo % que Inicio muestra en el badge
  // del log) y totales de cardio. Da la respuesta "¿cómo fue?" de un vistazo sin
  // escanear todas las tarjetas.
  const exerciseCount = log.exercises?.length ?? 0;
  const sessionImprovement = buildWorkoutImprovement(log, previousLog);
  // Duración estimada: hueco entre el primer y el último ejercicio insertados
  // (cada ExerciseLog guarda su timestamp = created_at). Mide cuándo se
  // registró, no el tiempo real bajo la barra: si todo se mete al acabar, sale 0.
  const workoutMinutes = (() => {
    const stamps = (log.exercises ?? [])
      .map((e) => e.timestamp)
      .filter((ts): ts is number => typeof ts === 'number' && ts > 0);
    if (stamps.length < 2) return 0;
    return Math.round((Math.max(...stamps) - Math.min(...stamps)) / 60000);
  })();

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
    return { symbol, color: getImprovementColor(kind), display };
  };

  // Solo tiene sentido "conservar el cardio" al borrar si hay fuerza que quitar
  // y además cardio que salvar (si no, el borrado es un borrado normal).
  const canKeepCardio = exerciseCount > 0 && !!log.cardio?.rawInput?.trim();

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
        {log.isDeload && (
          // Este día pertenece a una semana de descarga: se avisa para que se lea
          // en contexto (menos series y peso a propósito, al margen del progreso).
          <View style={styles.deloadBanner}>
            <MaterialCommunityIcons
              name="sleep"
              size={16}
              color={theme.colors.emoji_blue}
            />
            <Text style={styles.deloadBannerText}>
              {t('Semana de descarga')}
            </Text>
          </View>
        )}

        {exerciseCount > 0 && (
          <View style={styles.summaryCard}>
            <GradientFill accent={dayAccent} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{exerciseCount}</Text>
              <Text style={styles.summaryLabel}>{t('Ejercicios')}</Text>
            </View>
            {sessionImprovement &&
              (() => {
                const fmt = formatImprovementDisplay(sessionImprovement);
                return (
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: fmt.color }]}>
                      {fmt.symbol} {fmt.display}%
                    </Text>
                    <Text style={styles.summaryLabel}>{t('Progreso')}</Text>
                  </View>
                );
              })()}
            {workoutMinutes > 0 && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{workoutMinutes}</Text>
                <Text style={styles.summaryLabel}>min</Text>
              </View>
            )}
          </View>
        )}

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
          // Sin series válidas en alguno de los dos lados no hay comparación:
          // un ejercicio que no se hizo salía como −100%, no como "sin dato".
          const exerciseImprovement =
            hasScoringSets(fallbackExercise || currentExercise) &&
            hasScoringSets(prevExercise)
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
              onOpenProgress={
                onOpenExerciseProgress
                  ? () => onOpenExerciseProgress(exerciseKey(exercise.name))
                  : undefined
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
                    <View style={styles.cardioStatsRow}>
                      {entry.minutes != null && (
                        <View style={styles.cardioStat}>
                          <Text style={styles.cardioStatValue}>
                            {fmtNum(entry.minutes)}
                          </Text>
                          <Text style={styles.cardioStatUnit}>min</Text>
                        </View>
                      )}
                      {entry.speed != null && (
                        <View style={styles.cardioStat}>
                          <Text style={styles.cardioStatValue}>
                            {fmtNum(entry.speed)}
                          </Text>
                          <Text style={styles.cardioStatUnit}>km/h</Text>
                        </View>
                      )}
                      {entry.pendiente != null && (
                        <View style={styles.cardioStat}>
                          <Text style={styles.cardioStatValue}>
                            {fmtNum(entry.pendiente)}
                          </Text>
                          <Text style={styles.cardioStatUnit}>
                            {t('Pendiente %')}
                          </Text>
                        </View>
                      )}
                      {kcal > 0 && (
                        <View style={styles.cardioStat}>
                          <Text style={styles.cardioStatValue}>
                            {Math.round(kcal)}
                          </Text>
                          <Text style={styles.cardioStatUnit}>kcal</Text>
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
                <View style={styles.cardioStatsRow}>
                  {log.cardio.duration && (
                    <View style={styles.cardioStat}>
                      <Text style={styles.cardioStatValue}>
                        {log.cardio.duration}
                      </Text>
                      <Text style={styles.cardioStatUnit}>min</Text>
                    </View>
                  )}
                  {log.cardio.pace && (
                    <View style={styles.cardioStat}>
                      <Text style={styles.cardioStatValue}>
                        {extractPaceNumber(log.cardio.pace)}
                      </Text>
                      <Text style={styles.cardioStatUnit}>km/h</Text>
                    </View>
                  )}
                  {log.cardio.rawInput &&
                    extractIncline(log.cardio.rawInput) && (
                      <View style={styles.cardioStat}>
                        <Text style={styles.cardioStatValue}>
                          {extractIncline(log.cardio.rawInput)?.replace(
                            '%',
                            ''
                          )}
                        </Text>
                        <Text style={styles.cardioStatUnit}>
                          {t('Pendiente %')}
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
        onSubtitlePress={() => setShowDatePicker(true)}
        topInset={insets.top}
        menuItems={menuItems.length ? menuItems : undefined}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      <ConfirmModal
        visible={showDeleteModal}
        title={t('¿Eliminar entrenamiento?')}
        message={t('Esta acción no se puede deshacer. ¿Estás seguro?')}
        confirmLabel={t('Eliminar')}
        checkLabel={canKeepCardio ? t('Borrar también el cardio') : undefined}
        checked={deleteCardioToo}
        onToggleCheck={() => setDeleteCardioToo((prev) => !prev)}
        onConfirm={() => {
          setShowDeleteModal(false);
          if (canKeepCardio && !deleteCardioToo) {
            // Sin marcar el check, el cardio sobrevive: el log se queda sin la
            // fuerza y pasa a ser una sesión de "Solo cardio" de ese mismo día.
            dispatch({
              type: 'UPDATE_WORKOUT_LOG',
              payload: toCardioOnlyLog(log),
            });
            setDeleteCardioToo(false);
            onBack();
          } else {
            setDeleteCardioToo(false);
            onDelete?.();
          }
        }}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeleteCardioToo(false);
        }}
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

      <ConfirmModal
        visible={pendingMove !== null}
        icon="calendar-sync"
        title={t('¿Mover el día?')}
        message={
          pendingMove?.removesWeek
            ? t(
                'Este movimiento vacía una semana y recalcula racha, progreso y logros. ¿Continuar?'
              )
            : t(
                'Este movimiento reorganiza una semana ya completada y recalcula racha, progreso y logros. ¿Continuar?'
              )
        }
        confirmLabel={t('Mover')}
        confirmVariant="primary"
        onConfirm={() => {
          if (pendingMove) applyMoveWeek(pendingMove.plan);
          setPendingMove(null);
        }}
        onCancel={() => setPendingMove(null)}
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
    // Aviso de semana de descarga: mismo azul que el resto de la app (listado de
    // semanas y calendario) para señalar el deload de un vistazo.
    deloadBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      backgroundColor: theme.colors.emoji_blueMuted,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: theme.borderRadius.pill,
      marginBottom: 10,
    },
    deloadBannerText: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.3,
      color: theme.colors.emoji_blue,
      lineHeight: 16,
    },
    // Tira-resumen de la sesión: responde "¿cómo fue?" de un vistazo.
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      flexWrap: 'wrap',
      rowGap: 8,
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      marginBottom: 10,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    summaryItem: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
    },
    summaryValue: {
      fontSize: 22,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 31,
    },
    summaryLabel: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
      lineHeight: 15,
    },
    sectionTitle: {
      fontSize: 20,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.current,
      marginBottom: theme.spacing.xs,
      lineHeight: 28,
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
    // Cuadrícula valor+unidad: mismo peso de dato que la tira-resumen de fuerza
    // (número display grande + unidad pequeña en versalitas). Con las kcal son
    // cuatro celdas: en pantallas estrechas rompen a dos filas.
    cardioStatsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      columnGap: theme.spacing.lg,
      rowGap: theme.spacing.sm,
      marginTop: 10,
    },
    cardioStat: {
      alignItems: 'center',
    },
    cardioStatValue: {
      fontSize: 22,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 30,
    },
    cardioStatUnit: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
      lineHeight: 15,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
