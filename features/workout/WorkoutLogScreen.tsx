import { subscribeTheme } from '@lib/themeStore';
import React, { useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Vibration,
  AppState,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
// expo-notifications does not support web; load it only on native platforms
const Notifications: typeof import('expo-notifications') | null =
  Platform.OS !== 'web' ? require('expo-notifications') : null;
import {
  AppModal,
  DayAccentIcon,
  ExerciseInputField,
  InvalidAddReason,
  CardioInputField,
  Button,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GradientCtaButton,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  Toast,
  StretchScrollView,
} from '../../components';
import { isCardioOnlyLog } from '@lib/cardio';
import {
  MAX_SET_REPS,
  MAX_SET_WEIGHT_KG,
  parseCardioString,
  parseSeriesString,
} from '@lib/parsers';
import { generateId, getToday } from '@lib/utils';
import {
  WorkoutDay,
  WorkoutLog,
  ExerciseLog,
  CardioLog,
  ParsedSet,
  WorkoutRoutine,
} from '../../types';
import { theme, getTrainingAccent } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  buildImprovementFromStrengthScores,
  getTotalSetsStrengthScore,
} from '@lib/progress';

interface WorkoutLogScreenProps {
  day: WorkoutDay;
  log?: WorkoutLog;
  // El usuario forzó, en "Elige la sesión", que este entreno inicie una nueva
  // semana (ver DaySelectorScreen / lib/weeks.ts).
  startsNewWeek?: boolean;
  // Sesión de solo cardio: se oculta todo lo de fuerza y el log se marca para
  // no aparecer en Inicio (solo en Cardio).
  cardioOnly?: boolean;
  onSave: () => void;
  onBack: () => void;
}

const REST_TIMER_CHANNEL_ID = 'rest-timer-v5';

export function WorkoutLogScreen({
  day,
  log,
  startsNewWeek,
  cardioOnly,
  onSave,
  onBack,
}: WorkoutLogScreenProps) {
  // La pantalla no se apaga mientras se registra: entre serie y serie pasan
  // minutos y desbloquear el móvil con las manos ocupadas es la fricción del
  // banco. Solo aquí; se libera al salir de la pantalla.
  useKeepAwake();

  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();

  const getActiveDays = (): WorkoutDay[] => {
    const activeRoutine = state.routines.find(
      (r: WorkoutRoutine) => r.id === state.activeRoutineId
    );
    return activeRoutine?.days || [];
  };

  const [selectedDay] = useState(() => {
    if (log) {
      const activeDays = getActiveDays();
      return activeDays.find((d) => d.id === log.dayId) || day;
    }
    return day;
  });

  // Función para obtener el último log de hoy para este día
  const getLatestTodayLog = () => {
    const today = getToday();
    const logsForDayToday = state.logs.filter(
      (l) => l.dayId === selectedDay.id && l.date === today
    );
    if (logsForDayToday.length === 0) return null;

    // Retornar el más reciente (createdAt más alto)
    return logsForDayToday.reduce((latest, current) =>
      current.createdAt > latest.createdAt ? current : latest
    );
  };

  // Obtener el log existente: si se pasa log, usarlo; sino el último de hoy
  const existingLog = log || getLatestTodayLog();

  // Cargar datos iniciales del log existente si existe
  const initialExerciseSets = selectedDay.exercises.reduce(
    (acc, ex) => {
      if (existingLog) {
        const exerciseLog = existingLog.exercises.find(
          (e: ExerciseLog) => e.exerciseId === ex.id
        );
        if (
          exerciseLog &&
          exerciseLog.parsedSets &&
          exerciseLog.parsedSets.length > 0
        ) {
          return { ...acc, [ex.id]: exerciseLog.parsedSets };
        } else if (exerciseLog && exerciseLog.rawInput) {
          // Parsear rawInput si no hay parsedSets
          const parsed = parseSeriesString(exerciseLog.rawInput);
          return { ...acc, [ex.id]: parsed };
        }
      }
      return { ...acc, [ex.id]: [] };
    },
    {} as Record<string, ParsedSet[]>
  );

  const initialNotes = selectedDay.exercises.reduce(
    (acc, ex) => {
      if (existingLog) {
        const exerciseLog = existingLog.exercises.find(
          (e: ExerciseLog) => e.exerciseId === ex.id
        );
        if (exerciseLog && exerciseLog.notes) {
          return { ...acc, [ex.id]: exerciseLog.notes };
        }
      }
      return acc;
    },
    {} as Record<string, string>
  );

  // Sesión de "solo cardio" ya registrada en la misma fecha: la absorbe este día
  // de fuerza. Su cardio se precarga en el campo (queda igual que si se hubiera
  // metido desde aquí) y el log suelto se elimina al guardar.
  const [absorbedCardioLog] = useState(() => {
    if (cardioOnly || selectedDay.exercises.length === 0) return null;
    const date = existingLog?.date || getToday();
    return (
      state.logs.find((l) => isCardioOnlyLog(l) && l.date === date) || null
    );
  });

  // Espejo del caso anterior: en "solo cardio", si ese día ya tiene entreno de
  // fuerza, el cardio es del mismo día y va dentro de ese log. Se precarga su
  // cardio y al guardar se escribe ahí (no se crea un log suelto aparte).
  const [hostStrengthLog] = useState(() => {
    if (!cardioOnly) return null;
    const date = log?.date || getToday();
    return (
      state.logs.find((l) => !isCardioOnlyLog(l) && l.date === date) || null
    );
  });

  const initialCardioInput = [
    absorbedCardioLog?.cardio?.rawInput,
    hostStrengthLog?.cardio?.rawInput,
    existingLog?.cardio?.rawInput,
  ]
    .map((raw) => raw?.trim())
    .filter(Boolean)
    .join(' | ');

  // Estado para almacenar las series agregadas por cada ejercicio
  const [exerciseSets, setExerciseSets] =
    useState<Record<string, ParsedSet[]>>(initialExerciseSets);

  const [exerciseNotes, setExerciseNotes] =
    useState<Record<string, string>>(initialNotes);
  const [cardioInput, setCardioInput] = useState(initialCardioInput);
  const [showNotesModal, setShowNotesModal] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  // Editar el descanso por defecto de la rutina sin salir del registro (botón
  // dentro del propio temporizador y opción en el menú de tres puntos).
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerInput, setTimerInput] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    duration?: number;
  } | null>(null);
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const [timerNotificationId, setTimerNotificationId] = useState<string | null>(
    null
  );
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding =
    floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;
  const dayAccent = getTrainingAccent({
    emoji: selectedDay.emoji,
    name: selectedDay.name,
  });

  const getRoutineIdForDay = () => {
    const owningRoutine = state.routines.find((routine) =>
      routine.days.some((d) => d.id === selectedDay.id)
    );
    return owningRoutine?.id || state.activeRoutineId || '';
  };

  const getTimerDurationFromRoutine = (): number => {
    const routineId = getRoutineIdForDay();
    const routine = state.routines.find((r) => r.id === routineId);
    return routine?.timerDuration || 150;
  };

  const formatTimerLabel = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const openTimerModal = () => {
    setTimerInput(getTimerDurationFromRoutine().toString());
    setShowTimerModal(true);
  };

  // Guarda el nuevo descanso por defecto en la rutina dueña del día (mismo
  // UPDATE_ROUTINE que RoutineDetailScreen). No toca el descanso en curso: para
  // eso están +30s y Saltar; esto ajusta el valor de las próximas series.
  const handleSaveTimer = () => {
    const newDuration = parseInt(timerInput, 10);
    const routineId = getRoutineIdForDay();
    const routine = state.routines.find((r) => r.id === routineId);
    if (routine && !isNaN(newDuration) && newDuration > 0) {
      dispatch({
        type: 'UPDATE_ROUTINE',
        payload: { ...routine, timerDuration: newDuration },
      });
    }
    setShowTimerModal(false);
    setTimerInput('');
  };

  const clearTimerNotification = async () => {
    if (!timerNotificationId || !Notifications) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(timerNotificationId);
    } catch (error) {
      console.error('Error canceling timer notification:', error);
    } finally {
      setTimerNotificationId(null);
    }
  };

  const scheduleTimerNotification = async (seconds: number) => {
    if (!Notifications || seconds <= 0) return;

    try {
      if (timerNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(
          timerNotificationId
        );
      }

      const triggerDate = new Date(Date.now() + seconds * 1000);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: t('Descanso finalizado'),
          body: t('Es hora de tu siguiente serie'),
          icon: 'notification_icon',
          color: theme.colors.primary,
          sound: 'default',
          vibrate: [0, 300, 150, 300, 150, 300],
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: {
            source: 'rest-timer',
            dayId: selectedDay.id,
            routineId: getRoutineIdForDay(),
          },
        } as any,
        trigger: {
          date: triggerDate,
          allowWhileIdle: true,
          channelId: REST_TIMER_CHANNEL_ID,
        } as any,
      });

      setTimerNotificationId(notificationId);
    } catch (error) {
      console.error('Error scheduling timer notification:', error);
    }
  };

  const stopTimer = async () => {
    setActiveTimerId(null);
    setTimerSeconds(0);
    setTimerEndAt(null);
    await clearTimerNotification();
  };

  const startOrResetTimer = async (
    exerciseId: string,
    durationSeconds: number
  ) => {
    const safeDuration = Math.max(1, durationSeconds);
    const endAt = Date.now() + safeDuration * 1000;

    setActiveTimerId(exerciseId);
    setTimerEndAt(endAt);
    setTimerSeconds(safeDuration);

    await scheduleTimerNotification(safeDuration);
  };

  const extendTimerBy = async (extraSeconds: number) => {
    if (!activeTimerId || !timerEndAt) return;

    const newEndAt = timerEndAt + extraSeconds * 1000;
    const remainingSeconds = Math.max(
      1,
      Math.ceil((newEndAt - Date.now()) / 1000)
    );

    setTimerEndAt(newEndAt);
    setTimerSeconds(remainingSeconds);
    await scheduleTimerNotification(remainingSeconds);
  };

  useEffect(() => {
    if (!Notifications) return;

    const configureNotifications = async () => {
      try {
        const permissions = await Notifications.getPermissionsAsync();
        if (permissions.status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }

        if (Platform.OS === 'android') {
          // Remove previous channels to avoid stale channel settings kept by Android.
          await Notifications.deleteNotificationChannelAsync(
            'rest-timer'
          ).catch(() => undefined);
          await Notifications.deleteNotificationChannelAsync(
            'rest-timer-v2'
          ).catch(() => undefined);
          await Notifications.deleteNotificationChannelAsync(
            'rest-timer-v3'
          ).catch(() => undefined);
          await Notifications.deleteNotificationChannelAsync(
            'rest-timer-v4'
          ).catch(() => undefined);

          await Notifications.setNotificationChannelAsync(
            REST_TIMER_CHANNEL_ID,
            {
              name: 'Rest Timer',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 300, 150, 300, 150, 300],
              lightColor: theme.colors.primary,
              lockscreenVisibility:
                Notifications.AndroidNotificationVisibility.PUBLIC,
              bypassDnd: true,
              sound: 'default',
            }
          );
        }
      } catch (error) {
        console.error('Error configuring notifications:', error);
      }
    };

    configureNotifications();
  }, []);

  useEffect(() => {
    if (!activeTimerId || !timerEndAt) return;

    const updateRemaining = () => {
      const remainingMs = timerEndAt - Date.now();
      if (remainingMs <= 0) {
        setActiveTimerId(null);
        setTimerEndAt(null);
        setTimerSeconds(0);
        setTimerNotificationId(null);
        void clearTimerNotification();
        Vibration.vibrate([0, 300, 150, 300, 150, 300]);
        return;
      }

      setTimerSeconds(Math.ceil(remainingMs / 1000));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [activeTimerId, timerEndAt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !activeTimerId || !timerEndAt) return;

      const remainingMs = timerEndAt - Date.now();
      if (remainingMs <= 0) {
        setActiveTimerId(null);
        setTimerEndAt(null);
        setTimerSeconds(0);
        setTimerNotificationId(null);
        void clearTimerNotification();
        return;
      }

      setTimerSeconds(Math.ceil(remainingMs / 1000));
    });

    return () => subscription.remove();
  }, [activeTimerId, timerEndAt]);

  useEffect(() => {
    return () => {
      if (timerNotificationId && Notifications) {
        Notifications.cancelScheduledNotificationAsync(
          timerNotificationId
        ).catch(() => undefined);
      }
    };
  }, [timerNotificationId]);

  // Mensaje de "Añadir serie" fallido según la causa real, en vez de un único
  // aviso genérico que confunde cuando el dato tecleado no está vacío.
  const getInvalidAddMessage = (reason: InvalidAddReason): string => {
    switch (reason) {
      case 'negative':
        return t('El peso y las repeticiones no pueden ser negativos');
      case 'too-large':
        return t('Valor demasiado alto (máx. {max}kg / {reps} reps)', {
          max: MAX_SET_WEIGHT_KG,
          reps: MAX_SET_REPS,
        });
      case 'format':
        return t('Valor no válido: usa solo números');
      case 'empty':
      default:
        return t('Rellena primero los datos');
    }
  };

  const handleAddSet = (exerciseId: string, set: ParsedSet) => {
    const targetSets =
      selectedDay.exercises.find((ex) => ex.id === exerciseId)?.targetSets || 0;

    const updated = {
      ...exerciseSets,
      [exerciseId]: [...(exerciseSets[exerciseId] || []), set],
    };
    setExerciseSets(updated);
    autoSaveWorkout(updated);

    const currentSetsCount = exerciseSets[exerciseId]?.length || 0;
    const willReachTarget =
      targetSets > 0 && currentSetsCount + 1 >= targetSets;

    if (willReachTarget) {
      void stopTimer();
      return;
    }

    // Activar temporizador solo si aún faltan series por completar.
    void startOrResetTimer(exerciseId, getTimerDurationFromRoutine());
  };

  const handleRemoveLastSet = (exerciseId: string) => {
    let updatedSets = (exerciseSets[exerciseId] || []).slice(0, -1);
    // Borrar todos los vacíos (guiones) del final
    while (updatedSets.length > 0) {
      const lastSet = updatedSets[updatedSets.length - 1];
      if (lastSet.weight === -1 || lastSet.reps === -1) {
        updatedSets = updatedSets.slice(0, -1);
      } else {
        break;
      }
    }

    const updated = { ...exerciseSets, [exerciseId]: updatedSets };
    setExerciseSets(updated);
    autoSaveWorkout(updated);

    // Detener el temporizador si está activo para este ejercicio
    if (activeTimerId === exerciseId) {
      void stopTimer();
    }
  };

  const getPreviousExerciseLog = (exerciseId: string) => {
    const currentLogId = existingLog?.id;

    // Obtener todos los logs del mismo día, sin filtrar por fecha
    const logsForDay = state.logs.filter((log) => log.dayId === selectedDay.id);

    // Obtener todos los ejercicios de esos logs
    const allExercisesForDay: (ExerciseLog & {
      logDate: number;
      logId: string;
    })[] = [];
    logsForDay.forEach((log) => {
      log.exercises.forEach((ex) => {
        allExercisesForDay.push({
          ...ex,
          logDate: log.createdAt,
          logId: log.id,
        });
      });
    });

    // Tope temporal: si estamos editando un log existente, "anterior" debe ser
    // el inmediatamente previo a ESE log, no el más reciente de todos (que podría
    // ser uno posterior al que editamos).
    const currentLogDate = existingLog?.createdAt ?? Infinity;

    // Filtrar por exerciseId, excluir el log actual y descartar los posteriores
    // al log que se está editando.
    const matchingExercises = allExercisesForDay.filter(
      (ex) =>
        ex.exerciseId === exerciseId &&
        ex.logId !== currentLogId &&
        ex.logDate < currentLogDate
    );

    if (matchingExercises.length === 0) {
      return null;
    }

    // Ordenar por fecha descendente y retornar el más reciente anterior
    matchingExercises.sort((a, b) => b.logDate - a.logDate);
    return matchingExercises[0] || null;
  };

  const buildExerciseImprovement = (
    currentSets: ParsedSet[],
    previousLog: ExerciseLog | null
  ): { isImproved: boolean; percent: number } | null => {
    if (!previousLog) return null;

    const currentScore = getTotalSetsStrengthScore(currentSets);
    const previousScore = getTotalSetsStrengthScore(
      previousLog.parsedSets || []
    );
    return buildImprovementFromStrengthScores(currentScore, previousScore);
  };

  const handleFinishExercise = (exerciseId: string) => {
    const targetSets =
      selectedDay.exercises.find((ex) => ex.id === exerciseId)?.targetSets || 0;
    if (targetSets > 0) {
      // Rellenar con guiones cada serie que falte para alcanzar el objetivo
      const currentSets = exerciseSets[exerciseId] || [];
      const setsToAdd = targetSets - currentSets.length;

      if (setsToAdd > 0) {
        const filledSets = [...currentSets];
        for (let i = 0; i < setsToAdd; i++) {
          filledSets.push({ weight: -1, reps: -1 });
        }
        const updated = { ...exerciseSets, [exerciseId]: filledSets };
        setExerciseSets(updated);
        autoSaveWorkout(updated);
      }

      void stopTimer();
    }
  };

  // Construye el WorkoutLog a partir de las series indicadas (reutilizado por
  // el auto-guardado y por el guardado manual).
  const buildWorkoutLog = (sets: Record<string, ParsedSet[]>): WorkoutLog => {
    const exerciseLogs: ExerciseLog[] = selectedDay.exercises.map((ex) => {
      const exSets = sets[ex.id] || [];
      const rawInput = exSets
        .map((s) =>
          s.weight === -1 || s.reps === -1 ? '-' : `${s.weight}x${s.reps}`
        )
        .join(', ');

      return {
        id: generateId(),
        exerciseId: ex.id,
        exerciseName: ex.name,
        order: ex.order,
        rawInput,
        parsedSets: exSets,
        notes: exerciseNotes[ex.id],
        timestamp: Date.now(),
      };
    });

    const cardioLog: CardioLog | undefined = cardioInput.trim()
      ? {
          id: generateId(),
          ...(parseCardioString(cardioInput) as Omit<CardioLog, 'id'>),
        }
      : undefined;

    // Solo cardio sobre un día que ya tiene fuerza: se actualiza ese log (su
    // fuerza no se toca aquí), no se crea una sesión suelta.
    if (hostStrengthLog) {
      return { ...hostStrengthLog, cardio: cardioLog, updatedAt: Date.now() };
    }

    return {
      id: log?.id || generateId(),
      routineId: getRoutineIdForDay(),
      dayId: selectedDay.id,
      date: log?.date || getToday(),
      exercises: exerciseLogs,
      cardio: cardioLog,
      createdAt: log?.createdAt || Date.now(),
      updatedAt: Date.now(),
      // Al editar se conserva el valor previo del log; al crear se toma la
      // elección hecha en "Elige la sesión".
      startsNewWeek: log?.startsNewWeek ?? startsNewWeek ?? undefined,
      cardioOnly: log?.cardioOnly ?? (cardioOnly || undefined),
    };
  };

  // Persiste el log: actualiza el existente o crea uno nuevo (eliminando antes
  // un posible log del mismo día de hoy para no duplicar).
  const persistWorkoutLog = (workoutLog: WorkoutLog) => {
    // El "solo cardio" del día queda fusionado en este entrenamiento (su cardio
    // ya viaja en workoutLog.cardio), así que el log suelto sobra.
    if (absorbedCardioLog) {
      dispatch({ type: 'DELETE_WORKOUT_LOG', payload: absorbedCardioLog.id });
    }

    // El cardio se fusiona en el entreno de fuerza del día: si además había un
    // log de solo cardio suelto (datos antiguos), ya viaja dentro y sobra.
    if (hostStrengthLog) {
      if (existingLog && existingLog.id !== hostStrengthLog.id) {
        dispatch({ type: 'DELETE_WORKOUT_LOG', payload: existingLog.id });
      }
      dispatch({ type: 'UPDATE_WORKOUT_LOG', payload: workoutLog });
      return;
    }

    if (log) {
      dispatch({ type: 'UPDATE_WORKOUT_LOG', payload: workoutLog });
      return;
    }

    const today = getToday();
    const existingLogOfToday = state.logs.find(
      (l) => l.dayId === selectedDay.id && l.date === today
    );

    if (existingLogOfToday) {
      dispatch({ type: 'DELETE_WORKOUT_LOG', payload: existingLogOfToday.id });
    }

    dispatch({ type: 'ADD_WORKOUT_LOG', payload: workoutLog });
  };

  const autoSaveWorkout = (sets: Record<string, ParsedSet[]>) => {
    try {
      persistWorkoutLog(buildWorkoutLog(sets));
    } catch (error) {
      console.error('Error auto-saving workout:', error);
    }
  };

  const handleSaveWorkout = () => {
    // En modo solo cardio no hay ejercicios: exige al menos el cardio.
    if (cardioOnly && !cardioInput.trim()) {
      setToast({
        message: t('Añade tu cardio antes de guardar'),
        type: 'error',
        duration: 2000,
      });
      return;
    }

    try {
      persistWorkoutLog(buildWorkoutLog(exerciseSets));
      // Vuelta inmediata: la confirmación es aterrizar en Inicio con la sesión
      // de hoy ya en el historial (además el registro se autoguarda serie a
      // serie, así que aquí no hay nada que esperar).
      onSave();
    } catch (error) {
      setToast({
        message: t('Error al guardar.'),
        type: 'error',
      });
    }
  };

  const handleExerciseNotesPress = (exerciseId: string) => {
    setShowNotesModal(exerciseId);
    setNotesText(exerciseNotes[exerciseId] || '');
  };

  const handleSaveNotes = () => {
    if (showNotesModal) {
      setExerciseNotes((prev: any) => ({
        ...prev,
        [showNotesModal]: notesText,
      }));
    }
    setShowNotesModal(null);
    setNotesText('');
  };

  const handleDeleteNotes = () => {
    if (showNotesModal) {
      setExerciseNotes((prev: any) => {
        const next = { ...prev };
        delete next[showNotesModal];
        return next;
      });
    }
    setShowNotesModal(null);
    setNotesText('');
  };

  // Fecha mostrada en el subtítulo, en formato dd/mm/aaaa.
  const getSubtitleDate = (): string => {
    const dateString =
      log?.date ||
      existingLog?.date ||
      new Date(existingLog?.createdAt || Date.now())
        .toISOString()
        .split('T')[0];
    return dateString.split('-').reverse().join('/');
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
        {selectedDay.exercises.map((exercise: any) => {
          const previousLog = getPreviousExerciseLog(exercise.id);
          const currentSets = exerciseSets[exercise.id] || [];
          const improvement = buildExerciseImprovement(
            currentSets,
            previousLog
          );
          const isTargetCompleted =
            exercise.targetSets > 0 &&
            currentSets.length >= exercise.targetSets;

          return (
            <React.Fragment key={exercise.id}>
              <ExerciseInputField
                order={exercise.order}
                exerciseName={exercise.name}
                catalogId={exercise.catalogId}
                target={{
                  sets: exercise.targetSets,
                  reps: exercise.targetReps,
                }}
                addedSets={currentSets}
                onAddSet={(set: ParsedSet) => handleAddSet(exercise.id, set)}
                onInvalidAdd={(reason) =>
                  setToast({
                    message: getInvalidAddMessage(reason),
                    type: 'error',
                    duration: 2000,
                  })
                }
                onRemoveLastSet={() => handleRemoveLastSet(exercise.id)}
                onFinishExercise={() => handleFinishExercise(exercise.id)}
                onNotesPress={() => handleExerciseNotesPress(exercise.id)}
                notes={exerciseNotes[exercise.id]}
                previousLog={previousLog}
                improvement={improvement}
                accent={dayAccent}
              />
              {activeTimerId === exercise.id &&
                timerSeconds > 0 &&
                !isTargetCompleted && (
                  <View style={styles.timerContainer}>
                    <View style={styles.timerLabelRow}>
                      <MaterialCommunityIcons
                        name="timer-sand"
                        size={16}
                        color={theme.colors.onGold}
                      />
                      <Text style={styles.timerLabel}>
                        {t('Tiempo hasta la siguiente serie')}
                      </Text>
                    </View>
                    <Text style={styles.timerText}>
                      {Math.floor(timerSeconds / 60)}:
                      {(timerSeconds % 60).toString().padStart(2, '0')}
                    </Text>
                    {/* Acciones VISIBLES (antes escondidas en toque/long-press,
                        contra la regla de AGENTS): añadir 30s o saltar el
                        descanso, cada una con su botón e icono. */}
                    <View style={styles.timerActionsRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.timerActionButton,
                          pressed && styles.timerActionButtonPressed,
                        ]}
                        onPress={() => {
                          void extendTimerBy(30);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('Añadir 30 segundos')}
                      >
                        <MaterialCommunityIcons
                          name="plus"
                          size={18}
                          color={theme.colors.onGold}
                        />
                        <Text style={styles.timerActionText}>30s</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.timerActionButton,
                          pressed && styles.timerActionButtonPressed,
                        ]}
                        onPress={() => {
                          void stopTimer();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('Saltar descanso')}
                      >
                        <MaterialCommunityIcons
                          name="skip-next"
                          size={18}
                          color={theme.colors.onGold}
                        />
                        <Text style={styles.timerActionText}>
                          {t('Saltar')}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.timerActionButton,
                          pressed && styles.timerActionButtonPressed,
                        ]}
                        onPress={openTimerModal}
                        accessibilityRole="button"
                        accessibilityLabel={t('Modificar temporizador')}
                      >
                        <MaterialCommunityIcons
                          name="timer-cog-outline"
                          size={18}
                          color={theme.colors.onGold}
                        />
                        <Text style={styles.timerActionText}>
                          {t('Editar')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
            </React.Fragment>
          );
        })}

        <CardioInputField
          value={cardioInput}
          onChangeText={setCardioInput}
          accent={dayAccent}
        />

        <View style={styles.buttonContainer}>
          <GradientCtaButton
            icon="content-save-check"
            title={t('Guardar')}
            onPress={handleSaveWorkout}
          />
        </View>
      </StretchScrollView>

      {/* En solo cardio la pantalla se titula como la tarjeta de disciplinas
          (icono 'run' + "Cardio") y el subtítulo es solo la fecha: no hay
          ejercicios que rellenar, así que no hay nada más que decir. */}
      <GlassTopBar
        title={cardioOnly ? t('Cardio') : selectedDay.name}
        titleElement={
          <View style={styles.topBarTitleRow}>
            {cardioOnly ? (
              <MaterialCommunityIcons
                name="run"
                size={24}
                color={theme.colors.white}
              />
            ) : (
              <DayAccentIcon
                emoji={selectedDay.emoji}
                name={selectedDay.name}
                size={24}
              />
            )}
            <Text style={styles.topBarTitleText}>
              {cardioOnly ? t('Cardio') : selectedDay.name}
            </Text>
          </View>
        }
        subtitle={
          cardioOnly
            ? getSubtitleDate()
            : `${t('Rellena los ejercicios')} - ${getSubtitleDate()}`
        }
        topInset={insets.top}
        menuItems={
          cardioOnly
            ? undefined
            : [
                {
                  icon: 'timer-cog-outline',
                  label: t('Modificar temporizador'),
                  onPress: openTimerModal,
                },
              ]
        }
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onDismiss={() => setToast(null)}
        />
      )}

      <AppModal
        visible={showNotesModal !== null}
        onRequestClose={() => setShowNotesModal(null)}
        title={t('Notas del ejercicio')}
        icon="note-text-outline"
        align="left"
        footer={
          <View style={styles.modalButtons}>
            <Button
              title={t('Cancelar')}
              onPress={() => setShowNotesModal(null)}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            {showNotesModal && exerciseNotes[showNotesModal] ? (
              <Button
                title={t('Borrar')}
                onPress={handleDeleteNotes}
                variant="danger"
                size="medium"
                style={styles.modalButton}
              />
            ) : null}
            <Button
              title={t('Guardar')}
              onPress={handleSaveNotes}
              variant="primary"
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
        <TextInput
          style={styles.notesInput}
          placeholder={t(
            'Añade una nota (ej: muy cansado, fallo en última serie)'
          )}
          value={notesText}
          onChangeText={setNotesText}
          multiline
          placeholderTextColor={theme.colors.textSecondary}
        />
      </AppModal>

      {/* Editar el descanso por defecto de la rutina sin salir del registro.
          Mismo modal que RoutineDetailScreen; ajusta el valor de las próximas
          series (no el descanso en curso). */}
      <AppModal
        visible={showTimerModal}
        onRequestClose={() => setShowTimerModal(false)}
        title={t('Editar Temporizador')}
        icon="timer-sand"
        align="left"
        footer={
          <View style={styles.modalButtons}>
            <Button
              title={t('Cancelar')}
              onPress={() => setShowTimerModal(false)}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            <Button
              title={t('Guardar')}
              onPress={handleSaveTimer}
              variant="primary"
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
        <Text style={styles.timerFieldLabel}>{t('Duración en segundos:')}</Text>
        <TextInput
          style={styles.timerInputBox}
          keyboardType="number-pad"
          placeholder="150"
          placeholderTextColor={theme.colors.textSecondary}
          value={timerInput}
          onChangeText={setTimerInput}
        />
        <Text style={styles.timerModalFormat}>
          {t('Equivalente:')} {formatTimerLabel(parseInt(timerInput, 10) || 0)}
        </Text>
      </AppModal>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 0,
    },
    buttonContainer: {
      marginTop: 15,
    },
    notesInput: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.sm,
      padding: 14,
      fontSize: 16,
      minHeight: 88,
      color: theme.colors.text,
      backgroundColor: theme.colors.inputBg,
      lineHeight: 22,
      textAlignVertical: 'top',
    },
    timerFieldLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    timerInputBox: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      backgroundColor: theme.colors.inputBg,
    },
    timerModalFormat: {
      marginTop: 10,
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    // Reparto equitativo y sin la sombra fuerte del Button: dentro de la tarjeta
    // del modal la sombra grande dejaba una mancha oscura debajo.
    modalButton: {
      flex: 1,
      shadowOpacity: 0,
      elevation: 0,
    },
    timerContainer: {
      marginVertical: 16,
      marginHorizontal: 20,
      backgroundColor: theme.colors.primaryFill,
      borderRadius: theme.borderRadius.lg,
      padding: 15,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    timerText: {
      fontSize: 48,
      fontWeight: '800',
      color: theme.colors.onGold,
    },
    timerLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timerLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.onGold,
    },
    timerActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
      marginTop: 14,
    },
    timerActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 18,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.onGold,
    },
    timerActionButtonPressed: {
      opacity: 0.6,
    },
    timerActionText: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.onGold,
    },
    topBarTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    topBarTitleText: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 24,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
