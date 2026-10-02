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
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  StretchScrollView,
  TopBarActionButton,
} from '@components';
import {
  assignmentDuplicatesDayInWeek,
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
import { exerciseKey } from '@lib/exerciseProgress';
import { withExerciseCatalogId } from '@lib/routines';
import { TrendDelta } from '@components/TrendDelta';
import { getCardioWeightHistory } from '@lib/storage';
import {
  combineDateWithTime,
  findDayInRoutines,
  formatDate,
  formatDateFromKey,
  getLogTimestamp,
} from '@lib/utils';
import { WorkoutLog, WorkoutDay, ExerciseLog } from '../../types';
import { useWorkout } from '@hooks/useWorkout';
import { theme, getTrainingAccent, getDisplayDayName } from '@lib/theme';
import { t, fmtNum } from '@lib/i18n';
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
  // Abrir la ficha de la rutina a la que pertenece este día (con él desplegado).
  onOpenRoutine?: () => void;
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
  onOpenRoutine,
}: DetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
  // log no la lleva, la de creación. Las dos ramas pintan el MISMO formato, así
  // que las dos salen de `formatDate` (una por su puerta de clave de día).
  const displayedDate = currentDate
    ? formatDateFromKey(currentDate)
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
      summaryItems.push({
        key: 'minutes',
        value: String(workoutMinutes),
        label: 'min',
      });
    }
  } else if (cardioSession) {
    // Solo cardio: la tira ES el total del día.
    summaryItems.push({
      key: 'cardio-minutes',
      value: String(Math.round(cardioSession.totalMinutes)),
      label: 'min',
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
                  />
                ) : (
                  <Text
                    style={[
                      styles.summaryValue,
                      isCardioTotal && styles.summaryValueTotal,
                    ]}
                  >
                    {item.value}
                  </Text>
                )}
                <Text style={styles.summaryLabel}>{item.label}</Text>
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
              improvement={exerciseImprovement}
              isDetail={true}
              accent={dayAccent}
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
                  { marginTop: theme.spacing.xl, color: theme.colors.white },
                ]}
              >
                {t('Cardio')}
              </Text>
            )}
            {cardioSession ? (
              // Una caja por DISCIPLINA, no por tramo: el día se piensa como
              // "anduve 69 min y corrí 8", y así se lee igual que en la lista de
              // Cardio (que ya agrupa). Los tramos se suman y la velocidad y la
              // pendiente pasan a rango (mín-máx). Cada tramo tal como se tecleó
              // sigue a la vista en "Editar".
              cardioSession.disciplines.map((discipline, index) => {
                const incline = hasIncline(discipline.maxPendiente);
                return (
                  <View
                    key={`${discipline.type}-${incline}-${index}`}
                    style={styles.cardioBox}
                  >
                    <GradientFill accent={dayAccent} />
                    <View style={styles.cardioLabelRow}>
                      <MaterialCommunityIcons
                        name={
                          disciplineIconName(
                            discipline.type,
                            incline
                          ) as React.ComponentProps<
                            typeof MaterialCommunityIcons
                          >['name']
                        }
                        size={20}
                        color={theme.colors.primary}
                      />
                      <Text
                        style={[styles.cardioLabel, styles.cardioLabelInRow]}
                      >
                        {discipline.type.toUpperCase()}
                      </Text>
                    </View>
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
                            <Text style={styles.cardioStatUnit}>km/h</Text>
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
    cardioLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    // El margen inferior lo pone la fila: aquí desalinearía el icono.
    cardioLabelInRow: {
      marginBottom: 0,
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
