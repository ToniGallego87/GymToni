import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ConfirmModal,
  DatePickerModal,
  DayAccentIcon,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  StretchScrollView,
  TopBarActionButton,
} from '@components';
import {
  dateAssignmentConflict,
  groupLogsIntoWeekBlocks,
  isWeekCompleted,
  orderedBlockNumbers,
  planWeekMove,
  takenStrengthDates,
  weekMoveNeedsConfirm,
  WeekMoveDirection,
  WeekMovePlan,
} from '@lib/weeks';
import { ExerciseResultDisplay } from '@components/ExerciseResultDisplay';
import {
  cardioSessionFromLog,
  disciplineIconName,
  hasIncline,
  isCardioOnlyLog,
  rangeStr,
  topDisciplineIconName,
  WeightSegment,
} from '@lib/cardio';
import { withExerciseCatalogId } from '@lib/routines';
import { isExtraExerciseLog, parseExtraExerciseId } from '@lib/extraExercises';
import { TrendDelta } from '@components/TrendDelta';
import { getCardioWeightHistory } from '@lib/storage';
import {
  combineDateWithTime,
  findDayInRoutines,
  formatWorkoutDuration,
  getLogTimestamp,
  logDateKey,
  weekdayDayMonth,
} from '@lib/utils';
import { WorkoutLog, WorkoutDay, ExerciseLog } from '../../types';
import { useWorkout } from '@hooks/useWorkout';
import { useExerciseKeyResolver } from '@hooks/useExerciseKeyResolver';
import { useAfterFirstPaint } from '@hooks/useDeferredReady';
import { theme, getTrainingAccent, getDisplayDayName } from '@lib/theme';
import { t, fmtNum } from '@lib/i18n';
import {
  buildImprovementFromStrengthScores,
  buildWorkoutImprovement,
  getExerciseStrengthScore,
  hasScoringSets,
  workoutDurationMinutes,
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
  // Abrir la ficha de la rutina a la que pertenece este día (con él desplegado).
  onOpenRoutine?: () => void;
}

export function DetailScreen({
  log,
  day,
  onBack,
  onEdit,
  onDelete,
  onOpenExerciseProgress,
  onOpenRoutine,
}: DetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const resolveExerciseKey = useExerciseKeyResolver();
  // Las tarjetas entran un frame después de la vista: abrir un día pasado
  // responde al instante en vez de esperar a pintarlas todas.
  const contentReady = useAfterFirstPaint();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Fecha pendiente de confirmar porque parte una semana ('split') o deja el
  // entreno solo en una semana entre otras ('lone').
  const [pendingDate, setPendingDate] = useState<{
    date: string;
    reason: 'split' | 'lone';
  } | null>(null);
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

    // El mismo aviso que el registro (`dateAssignmentConflict`): partir una
    // semana o dejar el entreno solo en una semana aparte.
    const reason = dateAssignmentConflict(
      state.logs.filter((l) => l.routineId === log.routineId),
      log,
      combineDateWithTime(date, log.createdAt || Date.now()),
      dayNumberForLog,
      state.routines.find((r) => r.id === log.routineId)?.days.length ?? 0
    );
    if (reason) {
      setPendingDate({ date, reason });
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
    dispatch({
      type: 'UPDATE_DAY',
      payload: {
        routineId: routine.id,
        dayId: targetDay.id,
        day: withExerciseCatalogId(targetDay, exerciseId, catalogId),
      },
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
  // Sin las sesiones de solo cardio: no forman parte de ninguna semana (igual
  // que en el resto de lib/weeks). Así, en el detalle de un día de cardio
  // `planWeekMove` no lo encuentra y el ⋯ no ofrece "mover de semana", que ahí
  // no significaría nada; y un entreno de fuerza calcula sus bloques sin ellas.
  const routineLogs = state.logs.filter(
    (l) => l.routineId === log.routineId && !isCardioOnlyLog(l)
  );
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

  // Acciones raras del detalle en el ⋮: ir a la rutina, mover de semana o borrar.
  // Eliminar pasa por un ConfirmModal (acción destructiva).
  type TopBarItem = NonNullable<
    React.ComponentProps<typeof GlassTopBar>['menuItems']
  >[number];
  // "Editar" NO va aquí: es la acción principal de la pantalla (se entra casi
  // siempre a corregir una serie) y va rotulada en la barra, como en la ficha
  // de una rutina. El ⋮ se queda con lo raro.
  const menuItems: TopBarItem[] = [];
  if (onOpenRoutine) {
    menuItems.push({
      icon: 'file-document-edit-outline',
      label: t('Ir a la rutina'),
      onPress: onOpenRoutine,
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
  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
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

  // Sesión de cardio parseada del log (null si no hay cardio parseable). Solo
  // se enseña en una sesión DE cardio: consultar un entreno de fuerza ya no
  // saca su cardio, porque cardio y fuerza son dos sesiones distintas del día
  // y cada una se consulta por su lado (los logs antiguos pueden llevarlo
  // dentro; su cardio sigue contando en la pestaña de Cardio).
  const cardioSession =
    log.cardio && isCardioOnlyLog(log)
      ? cardioSessionFromLog(log, weightHistory)
      : null;
  // La tira de arriba es el total de un día de cardio (no un resumen de fuerza).
  const isCardioTotal = !!cardioSession;

  // La fecha que manda es la elegida (`currentDate`, clave YYYY-MM-DD); si el
  // log no la lleva, la de creación. Misma forma que el historial y el registro.
  const displayedDate = weekdayDayMonth(currentDate || logDateKey(log));

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
  // Duración: de la primera a la última serie apuntada (ver lib/progress).
  const workoutMinutes = workoutDurationMinutes(log);

  // Celdas de la tira-resumen. Se arma como lista para que la tira exista
  // SIEMPRE que haya algo que resumir: antes estaba condicionada a que hubiera
  // ejercicios de fuerza, así que una sesión de solo cardio —la más corta de
  // leer, y donde una línea bastaba— se quedaba sin ningún total, y una sesión
  // mixta resumía la fuerza e ignoraba el cardio del pie.
  // `improvement` en vez de `value`: la celda de progreso la pinta `TrendDelta`
  // (el mismo indicador que Inicio y Cardio), no un texto suelto.
  const summaryItems: {
    key: string;
    label: string;
    value?: string;
    improvement?: { isImproved: boolean; percent: number };
  }[] = [];

  if (exerciseCount > 0) {
    summaryItems.push({
      key: 'exercises',
      value: String(exerciseCount),
      label: t('Ejercicios'),
    });
    if (sessionImprovement) {
      summaryItems.push({
        key: 'improvement',
        improvement: sessionImprovement,
        label: t('Progreso'),
      });
    }
    if (workoutMinutes > 0) {
      // A partir de la hora, en horas ("1:25 h"), no "85 min".
      const duration = formatWorkoutDuration(workoutMinutes);
      summaryItems.push({
        key: 'minutes',
        value: duration.value,
        label: duration.unit,
      });
    }
  } else if (cardioSession) {
    // Solo cardio: la tira ES el total del día.
    const cardioDuration = formatWorkoutDuration(cardioSession.totalMinutes);
    summaryItems.push({
      key: 'cardio-minutes',
      value: cardioDuration.value,
      label: cardioDuration.unit,
    });
    if (cardioSession.totalKcal > 0) {
      summaryItems.push({
        key: 'kcal',
        value: String(Math.round(cardioSession.totalKcal)),
        label: 'kcal',
      });
    }
    if (cardioSession.totalKm > 0) {
      summaryItems.push({
        key: 'km',
        value: fmtNum(cardioSession.totalKm),
        label: 'km',
      });
    }
  }

  // Ejercicios ADICIONALES (lib/extraExercises): no son del día, así que no
  // se emparejan con los suyos (ni por nombre ni por orden) ni se comparan con
  // nada. Van al final, marcados.
  const routineExerciseLogs = (log.exercises ?? []).filter(
    (e) => !isExtraExerciseLog(e)
  );
  const extraExerciseLogs = (log.exercises ?? [])
    .filter(isExtraExerciseLog)
    .sort((a, b) => a.order - b.order);

  const getExerciseFromLog = (
    sourceLog: WorkoutLog | null,
    exerciseId: string,
    exerciseName: string,
    order?: number
  ): ExerciseLog | null => {
    if (!sourceLog || !sourceLog.exercises) return null;
    const candidates = sourceLog.exercises.filter(
      (e) => !isExtraExerciseLog(e)
    );

    // Buscar por ID de ejercicio
    let found = candidates.find((e) => e.exerciseId === exerciseId);
    if (found) return found;

    // Buscar por nombre
    found = candidates.find((e) => e.exerciseName === exerciseName);
    if (found) return found;

    // Buscar por orden si todo lo demás falla
    if (order !== undefined) {
      found = candidates.find((e) => e.order === order);
      if (found) return found;
    }

    return null;
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
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* La vista entra YA y el contenido un frame después (`contentReady`). */}
        {!contentReady ? (
          <ActivityIndicator
            style={styles.contentLoading}
            color={theme.colors.primary}
          />
        ) : (
          <>
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

            {/* En un día de cardio la tira ES el total del día y debajo vienen las
            disciplinas con el mismo tipo de cifras: va con relleno sólido y
            números mayores (relleno = el total; contorno = cada parte) para que
            no se confunda con una disciplina más. */}
            {summaryItems.length > 0 && (
              <View
                style={[
                  styles.summaryCard,
                  isCardioTotal && styles.summaryCardTotal,
                ]}
              >
                {!isCardioTotal && <GradientFill accent={dayAccent} />}
                {summaryItems.map((item) => (
                  <View key={item.key} style={styles.summaryItem}>
                    {item.improvement ? (
                      <TrendDelta
                        value={item.improvement.percent}
                        improved={item.improvement.isImproved}
                        iconSize={20}
                        textStyle={styles.summaryValue}
                        shrinkToFit
                      />
                    ) : (
                      <Text
                        style={[
                          styles.summaryValue,
                          isCardioTotal && styles.summaryValueTotal,
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {item.value}
                      </Text>
                    )}
                    <Text
                      style={styles.summaryLabel}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Nota de la sesión: el contexto del día, justo bajo el resumen. Va
            ARRIBA porque es lo que explica los números que vienen debajo (por
            qué ese día bajó el peso, por qué falta un ejercicio). */}
            {!!log.notes?.trim() && (
              <View style={styles.sessionNote}>
                <MaterialCommunityIcons
                  name="note-text-outline"
                  size={16}
                  color={dayAccent}
                />
                <Text style={styles.sessionNoteText}>{log.notes.trim()}</Text>
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
                !currentExercise && routineExerciseLogs[exerciseIndex]
                  ? routineExerciseLogs[exerciseIndex]
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
                      getExerciseStrengthScore(
                        fallbackExercise || currentExercise
                      ),
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
                      ? () =>
                          onOpenExerciseProgress(
                            resolveExerciseKey({
                              name: exercise.name,
                              catalogId:
                                liveCatalogId(exercise.id) ??
                                exercise.catalogId,
                            })
                          )
                      : undefined
                  }
                  targetSets={exercise.targetSets}
                  targetReps={
                    exercise.targetReps as string | number | undefined
                  }
                  rawInput={selectedExercise?.rawInput || '-'}
                  parsedSets={selectedExercise?.parsedSets || []}
                  notes={selectedExercise?.notes}
                  previousSets={prevExercise?.parsedSets}
                  improvement={exerciseImprovement}
                  isDetail={true}
                  accent={dayAccent}
                />
              );
            })}

            {extraExerciseLogs.map((exerciseLog) => {
              const target = parseExtraExerciseId(exerciseLog.exerciseId);
              return (
                <ExerciseResultDisplay
                  key={exerciseLog.exerciseId}
                  exerciseName={exerciseLog.exerciseName}
                  catalogId={exerciseLog.catalogId}
                  targetSets={target?.targetSets || undefined}
                  targetReps={target?.targetReps || undefined}
                  rawInput={exerciseLog.rawInput || '-'}
                  parsedSets={exerciseLog.parsedSets || []}
                  notes={exerciseLog.notes}
                  isDetail={true}
                  accent={theme.colors.emoji_blue}
                  extra
                />
              );
            })}

            {!!cardioSession && !!log.cardio && (
              <>
                {/* En un día de solo cardio (sin ejercicios) el título "Cardio"
                sobra: toda la vista es cardio. */}
                {day.exercises.length > 0 && (
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        marginTop: theme.spacing.xl,
                        color: theme.colors.white,
                      },
                    ]}
                  >
                    {t('Cardio')}
                  </Text>
                )}
                {/* Una caja por DISCIPLINA, no por tramo: el día se piensa como
                "anduve 69 min y corrí 8", y así se lee igual que en la lista de
                Cardio (que ya agrupa). Los tramos se suman y la velocidad y la
                pendiente pasan a rango (mín-máx). Cada tramo tal como se tecleó
                sigue a la vista en "Editar". */}
                {cardioSession.disciplines.map((discipline, index) => {
                  const incline = hasIncline(discipline.maxPendiente);
                  return (
                    <View
                      key={`${discipline.type}-${incline}-${index}`}
                      style={styles.cardioBox}
                    >
                      <GradientFill accent={dayAccent} />
                      <View style={styles.cardioBody}>
                        <MaterialCommunityIcons
                          name={
                            disciplineIconName(
                              discipline.type,
                              incline
                            ) as React.ComponentProps<
                              typeof MaterialCommunityIcons
                            >['name']
                          }
                          size={44}
                          color={theme.colors.primary}
                        />
                        <View style={styles.cardioContent}>
                          <Text style={styles.cardioLabel}>
                            {discipline.type.toUpperCase()}
                          </Text>
                          <View style={styles.cardioStatsRow}>
                            {discipline.totalMinutes > 0 && (
                              <View style={styles.cardioStat}>
                                <Text style={styles.cardioStatValue}>
                                  {fmtNum(discipline.totalMinutes)}
                                </Text>
                                <Text style={styles.cardioStatUnit}>min</Text>
                              </View>
                            )}
                            {discipline.minSpeed != null &&
                              discipline.maxSpeed != null && (
                                <View style={styles.cardioStat}>
                                  <Text style={styles.cardioStatValue}>
                                    {rangeStr(
                                      discipline.minSpeed,
                                      discipline.maxSpeed
                                    )}
                                  </Text>
                                  <Text style={styles.cardioStatUnit}>
                                    km/h
                                  </Text>
                                </View>
                              )}
                            {discipline.minPendiente != null &&
                              discipline.maxPendiente != null && (
                                <View style={styles.cardioStat}>
                                  <Text style={styles.cardioStatValue}>
                                    {rangeStr(
                                      discipline.minPendiente,
                                      discipline.maxPendiente
                                    )}
                                  </Text>
                                  <Text style={styles.cardioStatUnit}>
                                    {t('Pendiente %')}
                                  </Text>
                                </View>
                              )}
                            {discipline.kcal > 0 && (
                              <View style={styles.cardioStat}>
                                <Text style={styles.cardioStatValue}>
                                  {Math.round(discipline.kcal)}
                                </Text>
                                <Text style={styles.cardioStatUnit}>kcal</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </StretchScrollView>

      {/* Un día de cardio se titula por lo que es ("Registro de cardio") y lleva
          el icono de la disciplina que más kcal quemó, con la prop `icon`
          estándar. El de fuerza conserva su icono de grupo muscular vía
          `titleElement`: es la excepción que GlassTopBar documenta ("icono de
          día"). */}
      <GlassTopBar
        title={
          isCardioOnlyLog(log)
            ? t('Registro de cardio')
            : getDisplayDayName(day.name)
        }
        icon={
          isCardioOnlyLog(log)
            ? cardioSession
              ? topDisciplineIconName(cardioSession)
              : 'run-fast'
            : undefined
        }
        titleElement={
          isCardioOnlyLog(log) ? undefined : (
            <View style={styles.topBarTitleRow}>
              <DayAccentIcon emoji={day.emoji} name={day.name} size={24} />
              <Text style={styles.topBarTitleText}>
                {getDisplayDayName(day.name)}
              </Text>
            </View>
          )
        }
        subtitle={displayedDate}
        onSubtitlePress={() => setShowDatePicker(true)}
        topInset={insets.top}
        onLayout={onTopBarLayout}
        menuItems={menuItems.length ? menuItems : undefined}
        rightElement={
          onEdit ? (
            <TopBarActionButton
              label={t('Editar')}
              icon="pencil"
              iconOnly
              onPress={onEdit}
            />
          ) : undefined
        }
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      <ConfirmModal
        visible={showDeleteModal}
        title={t('¿Eliminar entrenamiento?')}
        message={t('Esta acción no se puede deshacer. ¿Estás seguro?')}
        confirmLabel={t('Eliminar')}
        // Borrar el entreno borra el entreno: su cardio es otra sesión.
        onConfirm={() => {
          setShowDeleteModal(false);
          onDelete?.();
        }}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* Un entreno por día: los días ocupados por otro entreno no se eligen
          (el cardio suelto no ocupa día). */}
      <DatePickerModal
        visible={showDatePicker}
        value={currentDate}
        onSelect={applyChosenDate}
        onRequestClose={() => setShowDatePicker(false)}
        takenDates={
          isCardioOnlyLog(log)
            ? undefined
            : takenStrengthDates(state.logs, log.id)
        }
      />

      <ConfirmModal
        visible={pendingDate !== null}
        title={
          pendingDate?.reason === 'lone'
            ? t('¿Semana aparte?')
            : t('¿Dividir la semana?')
        }
        message={
          pendingDate?.reason === 'lone'
            ? t(
                'Esa fecha no encaja en ninguna semana ya registrada: este entreno quedará como una semana aparte, solo con este día, y puede afectar a la racha y al progreso. ¿Continuar?'
              )
            : t(
                'Esa fecha cae en una semana que ya tiene este día. Se partirá en dos y puede afectar a la racha y al progreso. ¿Continuar?'
              )
        }
        confirmLabel={t('Continuar')}
        confirmVariant="primary"
        onConfirm={() => {
          if (pendingDate) commitDate(pendingDate.date);
          setPendingDate(null);
        }}
        onCancel={() => setPendingDate(null)}
      />

      <ConfirmModal
        visible={pendingMove !== null}
        icon="calendar-sync"
        title={t('¿Mover el día?')}
        message={
          pendingMove?.removesWeek
            ? t(
                'Este movimiento vacía una semana y recalcula racha, progreso e hitos. ¿Continuar?'
              )
            : t(
                'Este movimiento reorganiza una semana ya completada y recalcula racha, progreso e hitos. ¿Continuar?'
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
    // Spinner del frame en que la vista ya está y su contenido aún no.
    contentLoading: {
      marginTop: 40,
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
    // Nota de la sesión: lo que el usuario apuntó del día entero. Tarjeta
    // sobria (sin degradado) para que no compita con la tira de resumen.
    sessionNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: theme.spacing.sm,
      padding: 12,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    sessionNoteText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 19,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    // Tira-resumen de la sesión: responde "¿cómo fue?" de un vistazo.
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
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
    // Columnas iguales (un tercio cada una con tres cifras): el texto que no
    // cabe se encoge en vez de ensanchar su columna o saltar de línea.
    summaryItem: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xs,
    },
    // El total de un día de cardio: relleno sólido y sombra elevada frente al
    // contorno de las tarjetas de disciplina, para que se lea como "el día".
    summaryCardTotal: {
      backgroundColor: theme.colors.surface,
      ...theme.shadow.card,
    },
    summaryValue: {
      fontSize: 22,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 31,
    },
    summaryValueTotal: {
      fontSize: 30,
      lineHeight: 40,
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
    // Icono grande a la izquierda de todo el bloque (título + cifras).
    cardioBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    // flex: 1 obliga al título a partir línea dentro de la tarjeta; sin él se
    // salía por la derecha y el overflow de la caja lo cortaba ("ANDAR EN").
    cardioContent: {
      flex: 1,
    },
    // Titular de la tarjeta: tiene que pesar más que sus cifras para que se vea
    // de qué disciplina va (antes era 14/600 en textSecondary, por debajo de los
    // números de 22 que tenía debajo).
    cardioLabel: {
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: theme.colors.text,
      marginBottom: 6,
      textTransform: 'uppercase',
      lineHeight: 20,
    },
    // Cuadrícula valor+unidad: mismo peso de dato que la tira-resumen de fuerza
    // (número display grande + unidad pequeña en versalitas). Con las kcal son
    // cuatro celdas: en pantallas estrechas rompen a dos filas.
    cardioStatsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: theme.spacing.lg,
      rowGap: theme.spacing.sm,
      marginTop: 4,
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
