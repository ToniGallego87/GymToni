import { subscribeTheme } from '@lib/themeStore';
import React, { useState, useEffect, useRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  PanResponder,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
// expo-notifications does not support web; load it only on native platforms
const Notifications: typeof import('expo-notifications') | null =
  Platform.OS !== 'web' ? require('expo-notifications') : null;
import {
  AppModal,
  ConfirmModal,
  RestTimerModal,
  DatePickerModal,
  DayAccentIcon,
  ExerciseInputField,
  InvalidAddReason,
  CardioInputField,
  Button,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  getFloatingBackButtonMetrics,
  GradientCtaButton,
  GradientFill,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  Toast,
  StretchScrollView,
} from '../../components';
import { GlassBlur } from '../../components/GlassBlur';
import {
  GLASS_BACK_BUTTON_BORDER,
  GLASS_BACK_BUTTON_OVERLAY,
  GLASS_BACK_BUTTON_TEXT,
  GLASS_REST_TIMER_BG,
} from '../../components/glassTokens';
import {
  assignmentDuplicatesDayInWeek,
  groupLogsIntoWeekBlocks,
  isDeloadBlock,
  orderedBlockNumbers,
  takenStrengthDates,
} from '@lib/weeks';
import { isCardioOnlyLog } from '@lib/cardio';
import {
  MAX_SET_REPS,
  MAX_SET_WEIGHT_KG,
  parseCardioString,
  parseSeriesString,
} from '@lib/parsers';
import {
  combineDateWithTime,
  findDayInRoutines,
  formatRestTime,
  generateId,
  getLogTimestamp,
  getToday,
} from '@lib/utils';
import {
  WorkoutDay,
  WorkoutLog,
  ExerciseLog,
  CardioLog,
  ParsedSet,
  WorkoutRoutine,
} from '../../types';
import { theme, getTrainingAccent, getDisplayDayName } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  buildImprovementFromStrengthScores,
  getTotalSetsStrengthScore,
} from '@lib/progress';
import { withExerciseCatalogId } from '@lib/routines';
import { exerciseKey } from '@lib/exerciseProgress';
import {
  extendRestTimer,
  getRestDuration,
  REST_TIMER_CHANNEL_ID,
  startRestTimer,
  stopRestTimer,
  useRestSecondsLeft,
  useRestTimer,
} from '@lib/restTimerStore';
import { useRestFillStyle } from '@lib/restFill';

interface WorkoutLogScreenProps {
  day: WorkoutDay;
  log?: WorkoutLog;
  // Sesión de solo cardio: se oculta todo lo de fuerza y el log se marca para
  // no aparecer en Inicio (solo en Cardio).
  cardioOnly?: boolean;
  onSave: () => void;
  onBack: () => void;
  // Abrir la ficha de la rutina a la que pertenece este día (con él desplegado).
  onOpenRoutine?: () => void;
}

// Lado de la × que salta el descanso. El icono ES el botón (disco lleno con el
// aspa recortada), así que el tamaño del dibujo y el del control coinciden.
// Grande: se pulsa con el pulgar y con las manos ocupadas, y es la única forma
// de quitarse el bloque de encima.
const TIMER_CLOSE_SIZE = 34;
// Cuánto puede subir el bloque desde su sitio (pegado a "Volver") arrastrándolo:
// hasta el borde inferior de la barra de título, nunca por encima. El tope real
// se calcula con la altura medida del bloque; esto es solo el aire que se le
// deja a la barra.
const TIMER_DRAG_TOP_GAP = 10;
// Desplazamiento mínimo para que un arrastre sea un arrastre y no un toque en
// el "+30s" o en la ×.
const TIMER_DRAG_SLOP = 6;

export function WorkoutLogScreen({
  day,
  log,
  cardioOnly,
  onSave,
  onBack,
  onOpenRoutine,
}: WorkoutLogScreenProps) {
  // La pantalla no se apaga mientras se registra: entre serie y serie pasan
  // minutos y desbloquear el móvil con las manos ocupadas es la fricción del
  // banco. Solo aquí; se libera al salir de la pantalla.
  useKeepAwake();

  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
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

  // Identidad de ESTA sesión, fijada al montar y ya inmutable: el log que se
  // edita, el entreno de hoy que se continúa, o uno nuevo.
  //
  // Antes el autoguardado generaba un id NUEVO en cada serie y borraba el log
  // anterior para insertar otro. Si ese borrado no llegaba —fecha distinta de
  // hoy (no se hacía), dos guardados en el mismo tick (el `state` del render aún
  // no lo veía) o la nube devolviendo la versión ya borrada— quedaba un log
  // huérfano con todo lo insertado hasta ese momento. Y un día repetido abre
  // bloque nuevo en `lib/weeks.ts`, así que el entreno salía clonado "en la
  // semana siguiente". Con id fijo el autoguardado siempre actualiza el mismo
  // log y no hay nada que borrar.
  const [sessionLogId] = useState(() => existingLog?.id ?? generateId());
  // Mismo motivo para `createdAt` (con él se ordenan y agrupan las semanas): si
  // se recalcula en cada guardado, la sesión se va desplazando hacia delante.
  const [sessionCreatedAt] = useState(
    () => existingLog?.createdAt ?? Date.now()
  );
  // ¿El log de la sesión ya está creado? En un ref (síncrono), no en `state`:
  // dos guardados seguidos sin re-render en medio verían el mismo estado y
  // crearían dos logs.
  const sessionLogExistsRef = useRef(!!existingLog);

  // Fecha del entreno: se puede registrar un día olvidado o reasignar uno
  // guardado a otro día. Arranca en la del log editado (o hoy al crear).
  const originalDate = log?.date ?? existingLog?.date ?? getToday();
  const [selectedDate, setSelectedDate] = useState(originalDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Fecha elegida pendiente de confirmar por partir una semana ya existente.
  const [pendingSplitDate, setPendingSplitDate] = useState<string | null>(null);

  // Editando una sesión que NO es de hoy: rellenar o corregir un entreno de otro
  // día no es entrenar, así que no se lanza la cuenta atrás de descanso (ni su
  // notificación). Editar el log de hoy sí mantiene el temporizador.
  const isEditingPastLog = !!log && (log.date ?? getToday()) !== getToday();

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

  // El cardio ya NO se fusiona con la fuerza: son dos sesiones distintas del
  // mismo día, cada una con su log, su nota y su borrado. Antes un día con las
  // dos cosas acababa en un solo log (el de cardio se absorbía dentro del de
  // fuerza, o al revés), y eso ataba las dos: el registro de fuerza pedía
  // cardio al pie, el detalle de un entreno lo mostraba, borrar la fuerza
  // preguntaba por el cardio y la nota era la misma para las dos.
  const initialCardioInput = cardioOnly
    ? (existingLog?.cardio?.rawInput ?? '').trim()
    : '';

  // Estado para almacenar las series agregadas por cada ejercicio
  const [exerciseSets, setExerciseSets] =
    useState<Record<string, ParsedSet[]>>(initialExerciseSets);

  const [exerciseNotes, setExerciseNotes] =
    useState<Record<string, string>>(initialNotes);
  const [cardioInput, setCardioInput] = useState(initialCardioInput);
  // Nota de la SESIÓN: el contexto del día ("gym lleno, cambié banca por
  // mancuernas"), lo único que explica los datos raros al revisar el histórico.
  // Distinta de las notas por ejercicio (exerciseNotes) y, desde que cardio y
  // fuerza son sesiones aparte, propia de CADA una: la nota del cardio ya no es
  // la del entreno de fuerza de ese mismo día.
  const [sessionNote, setSessionNote] = useState(() => existingLog?.notes ?? '');
  // La nota solo ocupa sitio si ya hay algo escrito; si no, se ofrece como un
  // botón (mismo criterio que el cardio: quien no la usa no la arrastra al pie
  // de la pantalla que más se usa).
  const [sessionNoteOpen, setSessionNoteOpen] = useState(
    () => !!existingLog?.notes
  );
  // ¿Semana de descarga? La marca vive en cada log del bloque (semana). Se decide
  // por el bloque al que se une esta sesión:
  //  - Continuar una semana ya marcada como descarga la hereda automáticamente.
  //  - Iniciar una semana nueva (primer día) permite marcarla desde el menú ⋯.
  const deloadWeekInfo = (() => {
    const routineId =
      state.routines.find((r) => r.days.some((d) => d.id === selectedDay.id))
        ?.id ||
      state.activeRoutineId ||
      '';
    // Se excluye el log de ESTA sesión: decidimos si abre semana nueva frente
    // al resto, sin contarse a sí misma.
    const others = state.logs.filter(
      (l) =>
        l.routineId === routineId &&
        !isCardioOnlyLog(l) &&
        l.id !== sessionLogId &&
        !(l.dayId === selectedDay.id && l.date === selectedDate)
    );
    const blocks = groupLogsIntoWeekBlocks(
      others,
      (l) => findDayInRoutines(state.routines, l.dayId)?.dayNumber
    );
    const ordered = orderedBlockNumbers(blocks);
    const lastBlock = ordered.length ? blocks[ordered[ordered.length - 1]] : [];
    const lastDays = new Set(lastBlock.map((l) => l.dayId));
    // Continúa la semana en curso si esta tiene días y este día aún no se ha
    // entrenado en ella (si no, abre semana nueva).
    const continuesCurrentWeek =
      lastDays.size > 0 && !lastDays.has(selectedDay.id);
    // Marcar descarga solo tiene sentido en la semana en curso (la más reciente),
    // no al editar semanas antiguas: si esta sesión es anterior a la última semana
    // ya registrada, no es la actual y no debe ofrecer marcar/quitar descarga.
    const sessionTs = log
      ? getLogTimestamp(log)
      : existingLog
      ? getLogTimestamp(existingLog)
      : new Date(`${selectedDate}T23:59:59`).getTime();
    const lastBlockTs = lastBlock.length
      ? Math.max(...lastBlock.map((l) => getLogTimestamp(l)))
      : 0;
    const isLatestWeek = lastBlock.length === 0 || sessionTs >= lastBlockTs;
    return {
      isFirstDayOfNewWeek: !continuesCurrentWeek,
      weekAlreadyDeload: continuesCurrentWeek && isDeloadBlock(lastBlock),
      isLatestWeek,
    };
  })();

  // Sesión de descarga: al editar se conserva el valor del log; al continuar una
  // semana ya de descarga se hereda; al iniciar semana nueva arranca en falso
  // (se marca desde el menú ⋯).
  const [isDeloadSession, setIsDeloadSession] = useState<boolean>(
    () =>
      log?.isDeload ?? existingLog?.isDeload ?? deloadWeekInfo.weekAlreadyDeload
  );
  // Marcar o quitar descarga siempre pide confirmación (afecta a objetivos de
  // series y peso propuesto, y al marcar con datos metidos los borra).
  const [pendingDeload, setPendingDeload] = useState<'mark' | 'unmark' | null>(
    null
  );

  const [showNotesModal, setShowNotesModal] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  // Editar el descanso por defecto sin salir del registro (opción del ⋯). Es
  // donde de verdad se toca: estás entrenando y se te queda corto.
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    duration?: number;
  } | null>(null);
  // El descanso ya no vive aquí: es un singleton (lib/restTimerStore) que
  // sobrevive a salir de esta pantalla. Antes era estado local y la navegación
  // —que desmonta la pantalla— lo mataba junto con su aviso: mirar el
  // Calendario entre serie y serie dejaba el descanso en nada.
  const restTimer = useRestTimer();
  const timerSeconds = useRestSecondsLeft();
  // Solo se pinta en ESTA sesión el descanso que se lanzó desde ella; si viene
  // de otro día (se dejó corriendo y se abrió otro registro), lo enseña la
  // barra flotante y aquí no se mezcla.
  const activeTimerId =
    restTimer && restTimer.dayId === selectedDay.id
      ? restTimer.exerciseId
      : null;
  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);
  // El descanso flota al pie, justo encima de "Volver": la MISMA posición que
  // ocupa la barra de descanso cuando se sale de esta pantalla (ver
  // `restBarBottom` en App.tsx), para que el temporizador no salte de sitio al
  // entrar y salir del registro. Aquí conserva su contenido completo.
  const floatingTimerBottom =
    floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 10;
  const showFloatingTimer = !!activeTimerId && timerSeconds > 0;

  // ── Subir y bajar el bloque del descanso ──────────────────────────────────
  //
  // El descanso se posa encima de la lista y tapa justo el ejercicio que estás
  // metiendo. Se puede apartar arrastrándolo en vertical, pero solo dentro del
  // hueco libre: nunca por debajo de su sitio (encima de "Volver") ni por
  // encima del borde inferior de la barra de título. Se recorta en cada render
  // (`timerLift`) porque el tope depende de la altura medida del bloque, que se
  // conoce después del primer pintado.
  const [timerLiftRaw, setTimerLiftRaw] = useState(0);
  const [timerHeight, setTimerHeight] = useState(0);
  const timerMaxLift = Math.max(
    0,
    windowHeight -
      topBarHeight -
      TIMER_DRAG_TOP_GAP -
      timerHeight -
      floatingTimerBottom
  );
  const timerLift = Math.min(timerLiftRaw, timerMaxLift);
  const timerLiftRef = useRef(0);
  timerLiftRef.current = timerLift;
  const timerMaxLiftRef = useRef(0);
  timerMaxLiftRef.current = timerMaxLift;
  const timerDragStart = useRef(0);
  // PanResponder (RN de serie) y no `react-native-gesture-handler`: el pan
  // casero con RNGH ya se colgó en MIUI (ver CONVENTIONS.md) y aquí no hay que
  // competir con ningún scroll horizontal. Solo se queda el gesto si el dedo
  // se mueve en vertical más que el umbral, así que la × y el "+30s" siguen
  // recibiendo sus toques.
  const timerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dy) > TIMER_DRAG_SLOP &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        timerDragStart.current = timerLiftRef.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        const next = Math.min(
          timerMaxLiftRef.current,
          Math.max(0, timerDragStart.current - gesture.dy)
        );
        setTimerLiftRaw(next);
      },
    })
  ).current;
  // Relleno del bloque: lo YA consumido del descanso, de izquierda a derecha.
  // La mecánica vive en `lib/restFill`, compartida con la barra flotante y la
  // ventanita PiP: el mismo descanso se rellena igual en las tres caras.
  const timerFillStyle = useRestFillStyle(showFloatingTimer);
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

  // Descanso por defecto entre series (ajuste de la PERSONA, el mismo que
  // Configuración): el modal lo cambia al momento con flechas.
  const openTimerModal = () => setShowTimerModal(true);

  // Arrancar, alargar y cortar el descanso: la mecánica (cuenta atrás,
  // notificación y ventanita flotante) vive en el store, que es su dueño. Aquí
  // solo se dice CUÁNDO, con los datos del día que lo lanza.
  const stopTimer = () => stopRestTimer();

  const startOrResetTimer = (exerciseId: string, durationSeconds: number) => {
    const exercise = selectedDay.exercises.find((ex) => ex.id === exerciseId);
    // El permiso de notificaciones se pide AQUÍ, al primer descanso, y no al
    // abrir la pantalla: pedido nada más entrar, antes de la primera serie y
    // sin saber que existe el descanso, el diálogo del sistema se deniega.
    // Ahora llega justo cuando el aviso "ha terminado el descanso" va a tener
    // sentido. Es asíncrono y no bloquea el arranque de la cuenta atrás.
    void ensureNotificationPermission();
    startRestTimer({
      seconds: durationSeconds,
      exerciseId,
      exerciseName: exercise?.name || '',
      dayId: selectedDay.id,
      dayName: getDisplayDayName(selectedDay.name),
      routineId: getRoutineIdForDay(),
    });
  };

  const extendTimerBy = (extraSeconds: number) => extendRestTimer(extraSeconds);

  // Pide el permiso una sola vez por sesión de pantalla (el sistema recuerda
  // la respuesta; esto solo evita repetir la consulta en cada serie).
  const permissionAskedRef = useRef(false);
  const ensureNotificationPermission = async () => {
    if (!Notifications || permissionAskedRef.current) return;
    permissionAskedRef.current = true;
    try {
      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  // El canal de Android se configura al abrir la pantalla (no pide nada al
  // usuario); el permiso se pide al primer descanso (ver startOrResetTimer).
  useEffect(() => {
    if (!Notifications) return;

    const configureNotifications = async () => {
      try {
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

  // La cuenta atrás, su final (vibración), su notificación y la ventanita
  // flotante los lleva el store: aquí solo se lee. Y salir de la pantalla YA NO
  // lo mata — mirar el calendario entre serie y serie no es terminar el
  // descanso—: muere al llegar a cero o al pulsar "Saltar", desde la tarjeta o
  // desde la barra flotante que lo acompaña por el resto de la app.

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

  // Objetivo de series efectivo. En descarga se recorta una serie (3→2, 2→1),
  // nunca por debajo de una; sin descarga es el objetivo tal cual.
  const effectiveTargetSets = (targetSets?: number): number => {
    const base = targetSets ?? 0;
    if (!isDeloadSession || base <= 0) return base;
    return Math.max(1, base - 1);
  };

  // Cuántos ejercicios del día siguen sin alcanzar su objetivo de series (los
  // sin objetivo no cuentan: nunca se dan por "completos"). Sirve para decidir,
  // al terminar un ejercicio, si aún tiene sentido descansar —queda otro por
  // hacer— o ya no —era el último—.
  const countIncompleteExercises = (
    sets: Record<string, ParsedSet[]>
  ): number =>
    selectedDay.exercises.filter((ex) => {
      const target = effectiveTargetSets(ex.targetSets);
      if (target <= 0) return false;
      return (sets[ex.id]?.length || 0) < target;
    }).length;

  const handleAddSet = (exerciseId: string, set: ParsedSet) => {
    const targetSets = effectiveTargetSets(
      selectedDay.exercises.find((ex) => ex.id === exerciseId)?.targetSets
    );

    const updated = {
      ...exerciseSets,
      [exerciseId]: [...(exerciseSets[exerciseId] || []), set],
    };
    setExerciseSets(updated);
    autoSaveWorkout(updated);

    // Editando un entreno de otro día: se guarda la serie pero no hay descanso.
    if (isEditingPastLog) return;

    const currentSetsCount = exerciseSets[exerciseId]?.length || 0;
    const willReachTarget =
      targetSets > 0 && currentSetsCount + 1 >= targetSets;

    if (willReachTarget) {
      // Objetivo alcanzado. Si aún quedan ejercicios por completar en el día, el
      // descanso sigue teniendo sentido (toca pasar al siguiente): se lanza el
      // temporizador, que se pinta BAJO la tarjeta —ya completada—. Si era el
      // último, no hay siguiente serie ni ejercicio: se detiene.
      if (countIncompleteExercises(updated) > 0) {
        void startOrResetTimer(exerciseId, getRestDuration());
      } else {
        void stopTimer();
      }
      return;
    }

    // Activar temporizador solo si aún faltan series por completar.
    void startOrResetTimer(exerciseId, getRestDuration());
  };

  // Quita la serie del índice indicado (la × de su burbuja).
  const handleRemoveSet = (exerciseId: string, index: number) => {
    let updatedSets = (exerciseSets[exerciseId] || []).filter(
      (_, i) => i !== index
    );
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
  // Todas las ejecuciones anteriores de un ejercicio (ordenadas de más reciente
  // a más antigua), respetando el tope temporal al editar un log existente.
  // Salta las semanas de descarga: un deload nunca es la referencia "anterior"
  // (misma regla que la vista de consulta, DetailScreen), así que al empezar una
  // semana normal tras una de descarga la referencia es la anterior al deload.
  //
  // Primero se busca en ESTE día de ESTA rutina (por `exerciseId`, que es
  // distinto en cada rutina). Si no hay nada —la rutina se estrena—, se cae a
  // la última vez que se hizo el mismo ejercicio en CUALQUIER log, agrupando
  // por nombre normalizado (`exerciseKey`, como Progreso por ejercicio une el
  // histórico entre rutinas): cambiar de rutina no borra la memoria de un
  // press de banca que llevas meses haciendo.
  const getPreviousExerciseRuns = (exerciseId: string) => {
    // La sesión en curso nunca es su propia referencia (su id ya es estable,
    // esté el log creado o no).
    const currentLogId = sessionLogId;

    // Tope temporal: si estamos editando un log existente, "anterior" debe ser
    // el inmediatamente previo a ESE log, no el más reciente de todos (que podría
    // ser uno posterior al que editamos).
    const currentLogDate = existingLog?.createdAt ?? Infinity;

    // Ejecuciones de los logs dados que pasen el filtro de ejercicio, sin el
    // log actual, sin los posteriores al editado y sin descargas; de más
    // reciente a más antigua.
    const collectRuns = (
      logs: WorkoutLog[],
      matches: (ex: ExerciseLog) => boolean
    ) =>
      logs
        .filter(
          (log) =>
            log.id !== currentLogId &&
            log.createdAt < currentLogDate &&
            !log.isDeload
        )
        .flatMap((log) =>
          log.exercises
            .filter(matches)
            .map((ex) => ({ ...ex, logDate: log.createdAt, logId: log.id }))
        )
        .sort((a, b) => b.logDate - a.logDate);

    const sameDayRuns = collectRuns(
      state.logs.filter((log) => log.dayId === selectedDay.id),
      (ex) => ex.exerciseId === exerciseId
    );
    if (sameDayRuns.length > 0) return sameDayRuns;

    const exercise = selectedDay.exercises.find((ex) => ex.id === exerciseId);
    if (!exercise) return sameDayRuns;
    const key = exerciseKey(exercise.name);
    return collectRuns(
      state.logs,
      (ex) => exerciseKey(ex.exerciseName) === key
    );
  };

  // ¿Ese registro dice algo? Un ejercicio SALTADO se guarda igual que uno hecho
  // (una fila por serie), pero con todas a (-1, -1) —"-" en el rawInput—: existir
  // existe y no aporta nada, así que como "anterior" dejaba la comparación y los
  // placeholders en blanco.
  const hasLoggedSets = (log: ExerciseLog | null): boolean => {
    if (!log) return false;
    if (log.parsedSets?.length) {
      return log.parsedSets.some((s) => s.weight !== -1 && s.reps !== -1);
    }
    return parseSeriesString(log.rawInput || '').length > 0;
  };

  // "Anterior" es la última vez que este ejercicio se hizo DE VERDAD, no la
  // última sesión del día: si la semana pasada se saltó (o se saltó varias
  // seguidas) se retrocede hasta la que sí tiene series. Las semanas de descarga
  // ya quedaron fuera en getPreviousExerciseRuns.
  const getPreviousExerciseLog = (exerciseId: string) =>
    getPreviousExerciseRuns(exerciseId).find(hasLoggedSets) || null;

  // ¿Tiene el log algún peso real (>0)? Las series a peso corporal (weight -1)
  // o vacías no sirven para calcular el peso de descarga.
  const hasUsableWeight = (log: ExerciseLog | null): boolean => {
    if (!log) return false;
    if (log.parsedSets?.length) return log.parsedSets.some((s) => s.weight > 0);
    if (log.rawInput && log.rawInput.trim() && log.rawInput !== '-') {
      return parseSeriesString(log.rawInput).some((s) => s.weight > 0);
    }
    return false;
  };

  // Base para el peso sugerido en descarga: la última semana en que este
  // ejercicio se hizo con peso real, no necesariamente la inmediatamente
  // anterior (que pudo saltarse o hacerse sin carga).
  const getPreviousWeightLog = (exerciseId: string): ExerciseLog | null =>
    getPreviousExerciseRuns(exerciseId).find(hasUsableWeight) || null;

  const buildExerciseImprovement = (
    currentSets: ParsedSet[],
    previousLog: ExerciseLog | null
  ): { isImproved: boolean; percent: number } | null => {
    if (!previousLog) return null;
    // Sin ninguna serie válida todavía no hay nada que comparar: un ejercicio
    // que no se ha hecho salía en −100% en vez de quedarse sin dato.
    if (!currentSets.some((set) => set.reps > 0)) return null;

    const currentScore = getTotalSetsStrengthScore(currentSets);
    const previousScore = getTotalSetsStrengthScore(
      previousLog.parsedSets || []
    );
    return buildImprovementFromStrengthScores(currentScore, previousScore);
  };

  const handleFinishExercise = (exerciseId: string) => {
    const targetSets = effectiveTargetSets(
      selectedDay.exercises.find((ex) => ex.id === exerciseId)?.targetSets
    );
    if (targetSets > 0) {
      // Rellenar con guiones cada serie que falte para alcanzar el objetivo
      const currentSets = exerciseSets[exerciseId] || [];
      const setsToAdd = targetSets - currentSets.length;

      if (setsToAdd > 0) {
        const filledSets = [...currentSets];
        for (let i = 0; i < setsToAdd; i++) {
          filledSets.push({ weight: -1, reps: -1 });
        }
        const finalSets = { ...exerciseSets, [exerciseId]: filledSets };
        setExerciseSets(finalSets);
        autoSaveWorkout(finalSets);
      }

      // Saltar NO es descansar: el ejercicio se cierra porque no se va a hacer
      // (o no se va a terminar), así que no se lanza descanso ninguno y el que
      // estuviera corriendo por ESTE ejercicio se detiene. Antes, saltar un
      // ejercicio sin tocarlo dejaba 2:30 de cuenta atrás por un esfuerzo que
      // nunca existió.
      if (activeTimerId === exerciseId) {
        void stopTimer();
      }
    }
  };

  // Construye el WorkoutLog a partir de las series indicadas (reutilizado por
  // el auto-guardado y por el guardado manual). `isDeload` se puede forzar al
  // alternar el modo descarga (el estado aún no se ha propagado en ese tick).
  const buildWorkoutLog = (
    sets: Record<string, ParsedSet[]>,
    isDeloadValue: boolean = isDeloadSession
  ): WorkoutLog => {
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

    // Al reasignar la fecha hay que mover también `createdAt`: es con lo que se
    // ordenan y agrupan las semanas (getLogTimestamp lo prioriza). Se conserva
    // la hora del log y se cambia solo el día; si la fecha no cambia, intacto.
    const createdAt =
      selectedDate === originalDate
        ? sessionCreatedAt
        : combineDateWithTime(selectedDate, sessionCreatedAt);

    return {
      id: sessionLogId,
      routineId: getRoutineIdForDay(),
      dayId: selectedDay.id,
      date: selectedDate,
      exercises: exerciseLogs,
      cardio: cardioLog,
      createdAt,
      updatedAt: Date.now(),
      // Marca de "este entreno abre semana" (la pone y la quita mover el día
      // entre semanas desde el detalle, ver lib/weeks.ts): se conserva tanto al
      // editar como al continuar el entreno de hoy.
      startsNewWeek: log?.startsNewWeek ?? existingLog?.startsNewWeek,
      cardioOnly: log?.cardioOnly ?? (cardioOnly || undefined),
      // Semana de descarga: se marca este día para que el bloque entero cuente
      // como descarga (ver isDeloadBlock).
      isDeload: isDeloadValue || undefined,
      // Nota de la sesión (el contexto del día). Se guarda con el resto: no
      // tiene botón propio, igual que las series y el cardio.
      notes: sessionNote.trim() || undefined,
    };
  };

  // Persiste el log de la sesión. Siempre el MISMO id (`sessionLogId`): se crea
  // en el primer guardado y a partir de ahí se actualiza en el sitio, así que el
  // autoguardado nunca puede dejar un segundo entreno del mismo día suelto.
  const persistWorkoutLog = (workoutLog: WorkoutLog) => {
    if (sessionLogExistsRef.current) {
      dispatch({ type: 'UPDATE_WORKOUT_LOG', payload: workoutLog });
      return;
    }

    sessionLogExistsRef.current = true;
    dispatch({ type: 'ADD_WORKOUT_LOG', payload: workoutLog });
  };

  const autoSaveWorkout = (
    sets: Record<string, ParsedSet[]>,
    isDeloadValue: boolean = isDeloadSession
  ) => {
    try {
      persistWorkoutLog(buildWorkoutLog(sets, isDeloadValue));
    } catch (error) {
      console.error('Error auto-saving workout:', error);
    }
  };

  // Hay series ya insertadas en esta sesión (lo que se borraría al pasar a
  // descarga, porque cambian los objetivos de series y el peso propuesto).
  const hasInsertedData = Object.values(exerciseSets).some(
    (arr) => arr.length > 0
  );

  // Alterna el modo descarga. Al activarlo con datos ya metidos se limpian (los
  // pide el flujo de descarga: menos series y peso más ligero). Al quitarlo se
  // conserva lo insertado.
  const applyDeload = (next: boolean, clearData: boolean) => {
    const sets = clearData
      ? selectedDay.exercises.reduce(
          (acc, ex) => ({ ...acc, [ex.id]: [] }),
          {} as Record<string, ParsedSet[]>
        )
      : exerciseSets;
    if (clearData) setExerciseSets(sets);
    setIsDeloadSession(next);
    // Persistir solo si ya existe un log (creado por el autoguardado o editado):
    // en una sesión nueva y vacía basta con el estado, se guardará al añadir.
    if (log || existingLog || hasInsertedData) {
      autoSaveWorkout(sets, next);
    }
  };

  const handleToggleDeload = () => {
    setPendingDeload(isDeloadSession ? 'unmark' : 'mark');
  };

  // Las series se autoguardan al añadirlas/borrarlas, pero el cardio y las notas
  // no persisten al teclearse: sin esto, salir con "Volver" tras escribir un
  // cardio o una nota los perdería. Se vuelca el estado en cuanto cambian (si ya
  // hay algo que guardar), de modo que salir por cualquier vía es seguro.
  const cardioNotesMountedRef = useRef(false);
  useEffect(() => {
    if (!cardioNotesMountedRef.current) {
      cardioNotesMountedRef.current = true;
      return;
    }
    if (
      log ||
      existingLog ||
      hasInsertedData ||
      cardioInput.trim() ||
      sessionNote.trim()
    ) {
      autoSaveWorkout(exerciseSets);
    }
    // Solo depende de cardio y notas a propósito: las series ya persisten por su
    // cuenta y añadir exerciseSets aquí duplicaría el guardado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardioInput, exerciseNotes, sessionNote]);

  const handleSaveWorkout = () => {
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
      setExerciseNotes((prev) => ({
        ...prev,
        [showNotesModal]: notesText,
      }));
    }
    setShowNotesModal(null);
    setNotesText('');
  };

  const handleDeleteNotes = () => {
    if (showNotesModal) {
      setExerciseNotes((prev) => {
        const next = { ...prev };
        delete next[showNotesModal];
        return next;
      });
    }
    setShowNotesModal(null);
    setNotesText('');
  };

  // Fecha mostrada en el subtítulo, en formato dd/mm/aaaa.
  const getSubtitleDate = (): string =>
    selectedDate.split('-').reverse().join('/');

  // Clave de día (dayNumber) para agrupar semanas, igual que Inicio.
  const dayNumberForLog = (l: WorkoutLog): number | undefined =>
    findDayInRoutines(state.routines, l.dayId)?.dayNumber;

  // Aplica la fecha elegida. Si cae en una semana que ya tiene este mismo día,
  // asignarla parte esa semana en dos (ver lib/weeks): se avisa antes.
  const applyChosenDate = (date: string) => {
    setShowDatePicker(false);
    if (date === selectedDate) return;

    const routineId = getRoutineIdForDay();
    const routineLogs = state.logs.filter((l) => l.routineId === routineId);
    const movedLog: WorkoutLog = {
      ...(log || existingLog || ({ id: 'new-log' } as WorkoutLog)),
      dayId: selectedDay.id,
    };
    const newTimestamp = combineDateWithTime(
      date,
      log?.createdAt || Date.now()
    );

    if (
      assignmentDuplicatesDayInWeek(
        routineLogs,
        movedLog,
        newTimestamp,
        dayNumberForLog
      )
    ) {
      setPendingSplitDate(date);
      return;
    }
    setSelectedDate(date);
  };

  // Fija un GIF del catálogo al ejercicio de la rutina (botón "Asignar" del
  // buscador). Se guarda en la rutina, no en el log, para que el play quede
  // directo la próxima vez y viaje al compartir.
  const handleAssignGif = (exerciseId: string, catalogId: string) => {
    const routineId = getRoutineIdForDay();
    const routine = state.routines.find((r) => r.id === routineId);
    const day = routine?.days.find((d) => d.id === selectedDay.id);
    if (!routine || !day) return;
    dispatch({
      type: 'UPDATE_DAY',
      payload: {
        routineId,
        dayId: day.id,
        day: withExerciseCatalogId(day, exerciseId, catalogId),
      },
    });
    setToast({
      message: t('GIF asignado al ejercicio'),
      type: 'success',
      duration: 2000,
    });
  };

  // catalogId VIVO del ejercicio (refleja una asignación recién hecha sin salir).
  const liveDay = state.routines
    .flatMap((r) => r.days)
    .find((d) => d.id === selectedDay.id);
  const liveCatalogId = (exerciseId: string): string | undefined =>
    liveDay?.exercises.find((ex) => ex.id === exerciseId)?.catalogId;

  // Ejercicio "en curso": el primero del día que aún no ha alcanzado su objetivo
  // de series. Es el que la tarjeta abre sola (los demás quedan colapsados como
  // resumen) para no obligar a desplegar cada ejercicio antes de registrar. Al
  // completarse uno, el siguiente incompleto pasa a ser el en curso y se abre.
  // ¿Está todo el día hecho? Solo cuenta si se ha metido algo: un día cuyos
  // ejercicios no tienen objetivo daría cero incompletos sin haber empezado.
  const allExercisesDone =
    !cardioOnly &&
    selectedDay.exercises.length > 0 &&
    hasInsertedData &&
    countIncompleteExercises(exerciseSets) === 0;

  const currentExerciseId = selectedDay.exercises.find((ex) => {
    const target = effectiveTargetSets(ex.targetSets);
    const sets = exerciseSets[ex.id] || [];
    return !(target > 0 && sets.length >= target);
  })?.id;

  // Contenido del temporizador de descanso (cuenta atrás + acciones). Antes se
  // inyectaba dentro de la tarjeta del ejercicio (o debajo, si ya estaba
  // completa), así que se movía por la lista y desaparecía al hacer scroll;
  // ahora va en un bloque flotante que se posa sobre ella (`floatingTimer`).
  // Una sola fila centrada: asa de arrastre, cuenta atrás y "+30s", con la × de
  // cerrar —grande— en la esquina del bloque, y encima un rótulo pequeño que
  // dice qué se espera (siguiente serie o siguiente ejercicio). Lo que queda de
  // descanso lo pinta el RELLENO de la tarjeta, que la cruza de izquierda a
  // derecha.
  // ¿El descanso es antes de otra serie del mismo ejercicio o antes del
  // siguiente? Lo dice si el ejercicio que lo lanzó ya tiene todas sus series.
  const restExercise = selectedDay.exercises.find(
    (ex) => ex.id === activeTimerId
  );
  const restTarget = effectiveTargetSets(restExercise?.targetSets);
  const restBeforeNextExercise =
    restTarget > 0 &&
    (exerciseSets[activeTimerId ?? '']?.length || 0) >= restTarget;

  const renderRestTimerContent = () => (
    <>
      {/* Qué se está esperando: sin él, el bloque era un número suelto. */}
      <Text style={styles.timerCaption} numberOfLines={1}>
        {restBeforeNextExercise
          ? t('Tiempo hasta el siguiente ejercicio')
          : t('Tiempo hasta la siguiente serie')}
      </Text>
      {/* Cerrar el descanso: en la esquina del bloque, como la × que cierra
          cualquier cosa. Fuera de la fila para no robarle sitio al reloj. */}
      <Pressable
        style={({ pressed }) => [
          styles.timerCloseButton,
          pressed && styles.timerActionButtonPressed,
        ]}
        onPress={() => {
          void stopTimer();
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('Saltar descanso')}
      >
        {/* Disco lleno con la × recortada, EXACTAMENTE la de las series
            metidas (misma tinta `white`): misma marca de "quitar esto" en toda
            la tarjeta. */}
        <MaterialCommunityIcons
          name="close-circle"
          size={TIMER_CLOSE_SIZE}
          color={GLASS_BACK_BUTTON_TEXT}
        />
      </Pressable>
      <View style={styles.timerRow}>
        <Text style={styles.timerText}>{formatRestTime(timerSeconds)}</Text>
        {/* Acción VISIBLE (nada escondido tras un gesto): alargar el descanso.
            En oro, el color de lo que se pulsa: es el único control del bloque
            con el que se hace algo (la × solo cierra). */}
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
          <Text style={styles.timerActionText} numberOfLines={1}>
            30s
          </Text>
        </Pressable>
      </View>
    </>
  );

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
        {selectedDay.exercises.map((exercise) => {
          const previousLog = getPreviousExerciseLog(exercise.id);
          const currentSets = exerciseSets[exercise.id] || [];
          const improvement = buildExerciseImprovement(
            currentSets,
            previousLog
          );
          // En descarga el peso sugerido se calcula sobre la última semana con
          // carga real: si la anterior no tiene peso en este ejercicio, se
          // retrocede hasta la que sí lo tuvo. (En descarga la comparación
          // "Anterior" no se muestra, así que reusar este log como previousLog
          // solo afecta al peso propuesto.)
          const previousLogForField =
            isDeloadSession && !hasUsableWeight(previousLog)
              ? getPreviousWeightLog(exercise.id)
              : previousLog;
          return (
            <React.Fragment key={exercise.id}>
              <ExerciseInputField
                exerciseName={exercise.name}
                catalogId={liveCatalogId(exercise.id) ?? exercise.catalogId}
                onAssignGif={(catalogId) =>
                  handleAssignGif(exercise.id, catalogId)
                }
                target={{
                  sets: effectiveTargetSets(exercise.targetSets),
                  reps: exercise.targetReps,
                }}
                deload={isDeloadSession}
                addedSets={currentSets}
                onAddSet={(set: ParsedSet) => handleAddSet(exercise.id, set)}
                onInvalidAdd={(reason) =>
                  setToast({
                    message: getInvalidAddMessage(reason),
                    type: 'error',
                    duration: 2000,
                  })
                }
                onRemoveSet={(index) => handleRemoveSet(exercise.id, index)}
                onFinishExercise={() => handleFinishExercise(exercise.id)}
                onNotesPress={() => handleExerciseNotesPress(exercise.id)}
                notes={exerciseNotes[exercise.id]}
                previousLog={previousLogForField}
                improvement={isDeloadSession ? null : improvement}
                accent={dayAccent}
                isCurrent={exercise.id === currentExerciseId}
              />
            </React.Fragment>
          );
        })}

        {/* El cardio solo se mete desde la pestaña de Cardio: aquí se registra
            fuerza. Antes este campo estaba también al pie de un día de fuerza,
            lo que ataba las dos cosas en un mismo log. */}
        {cardioOnly && (
          <CardioInputField
            value={cardioInput}
            onChangeText={setCardioInput}
            accent={dayAccent}
            inlinePicker
          />
        )}

        {/* Nota de la SESIÓN, al pie y junto al cardio: lo que pasó hoy y no
            cabe en ningún ejercicio ("gym lleno, cambié banca por mancuernas").
            Es lo que explica los datos raros al revisar el histórico. Se
            autoguarda como el cardio, así que no lleva botón propio. */}
        {sessionNoteOpen ? (
          <View
            style={[styles.sessionNoteCard, { borderLeftColor: dayAccent }]}
          >
            <View style={styles.sessionNoteHeader}>
              <MaterialCommunityIcons
                name="note-text-outline"
                size={18}
                color={theme.colors.text}
              />
              <Text style={styles.sessionNoteTitle}>
                {t('Nota de la sesión')}
              </Text>
            </View>
            <TextInput
              style={styles.sessionNoteInput}
              value={sessionNote}
              onChangeText={setSessionNote}
              placeholder={t('Ej: gym lleno, cambié banca por mancuernas')}
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              textAlignVertical="top"
              maxLength={280}
            />
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.addSessionNoteButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setSessionNoteOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('Añadir nota de la sesión')}
          >
            <MaterialCommunityIcons
              name="note-plus-outline"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.addSessionNoteText}>
              {t('Añadir nota de la sesión')}
            </Text>
          </Pressable>
        )}

        {/* Ni fuerza ni cardio llevan botón de guardar: las series, las
            disciplinas y las notas se autoguardan al meterlas, así que "Volver"
            ya cierra sin perder nada. El "Hecho" del cardio no hacía más que
            validar que hubiera algo antes de salir, y para eso basta con no
            haber insertado nada. */}
        {/* Fuerza: al completar el último ejercicio, un remate que diga que
            está hecho y guardado. "Terminar" hace lo mismo que "Volver" (el
            registro ya está en el historial): no añade un paso, le pone nombre
            al que existe, que es lo que le faltaba al primer entreno. */}
        {allExercisesDone && (
          <View style={styles.completedCard}>
            <GradientFill accent={theme.colors.success} />
            <View style={styles.completedRow}>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color={theme.colors.success}
              />
              <Text style={styles.completedText}>
                {t('Entreno completado · {n} ejercicios', {
                  n: selectedDay.exercises.length,
                })}
              </Text>
            </View>
            <Text style={styles.completedHint}>
              {t('Ya está guardado en tu historial.')}
            </Text>
            <GradientCtaButton
              icon="check-bold"
              title={t('Terminar')}
              onPress={handleSaveWorkout}
            />
          </View>
        )}
      </StretchScrollView>

      {/* En solo cardio la pantalla se titula como la tarjeta de disciplinas
          (icono 'run' + "Cardio") y el subtítulo es solo la fecha: no hay
          ejercicios que rellenar, así que no hay nada más que decir. */}
      <GlassTopBar
        title={cardioOnly ? t('Cardio') : getDisplayDayName(selectedDay.name)}
        titleElement={
          <View style={styles.topBarTitleRow}>
            {cardioOnly ? (
              <MaterialCommunityIcons
                name="run-fast"
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
              {cardioOnly ? t('Cardio') : getDisplayDayName(selectedDay.name)}
            </Text>
          </View>
        }
        subtitle={
          isDeloadSession
            ? `${getSubtitleDate()} · ${t('Descarga')}`
            : getSubtitleDate()
        }
        onSubtitlePress={() => setShowDatePicker(true)}
        topInset={insets.top}
        onLayout={onTopBarLayout}
        menuItems={
          // "Cambiar fecha" no va en el ⋯: el subtítulo de la barra ya es un
          // enlace visible (icono calendar-edit) que abre el mismo DatePicker,
          // igual que en el Detalle. Una acción, una vía.
          cardioOnly
            ? undefined
            : [
                ...(onOpenRoutine
                  ? [
                      {
                        icon: 'file-document-edit-outline' as const,
                        label: t('Ir a la rutina'),
                        onPress: onOpenRoutine,
                      },
                    ]
                  : []),
                {
                  icon: 'timer-cog-outline' as const,
                  label: t('Modificar temporizador'),
                  onPress: openTimerModal,
                },
                // Marcar como descarga solo tiene sentido al iniciar una semana
                // nueva (su primer día) y solo en la semana en curso: las semanas
                // antiguas no se marcan. Los días siguientes la heredan solos.
                ...(deloadWeekInfo.isFirstDayOfNewWeek &&
                deloadWeekInfo.isLatestWeek
                  ? [
                      {
                        icon: isDeloadSession
                          ? ('sleep-off' as const)
                          : ('sleep' as const),
                        label: isDeloadSession
                          ? t('Quitar semana de descarga')
                          : t('Marcar semana de descarga'),
                        onPress: handleToggleDeload,
                      },
                    ]
                  : []),
              ]
        }
      />

      {/* Un entreno por día: los días que ya tienen uno salen bloqueados (el
          cardio suelto no ocupa día). */}
      <DatePickerModal
        visible={showDatePicker}
        value={selectedDate}
        onSelect={applyChosenDate}
        onRequestClose={() => setShowDatePicker(false)}
        takenDates={
          cardioOnly ? undefined : takenStrengthDates(state.logs, sessionLogId)
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
          if (pendingSplitDate) setSelectedDate(pendingSplitDate);
          setPendingSplitDate(null);
        }}
        onCancel={() => setPendingSplitDate(null)}
      />

      <ConfirmModal
        visible={pendingDeload !== null}
        title={
          pendingDeload === 'unmark'
            ? t('¿Quitar semana de descarga?')
            : t('¿Marcar semana de descarga?')
        }
        message={
          pendingDeload === 'unmark'
            ? t(
                'La semana volverá a contar como carga normal (objetivos de series y peso completos). ¿Continuar?'
              )
            : hasInsertedData
            ? t(
                'Se borrarán los datos ya insertados de esta sesión para prepararla como descarga (menos series y peso más ligero). ¿Continuar?'
              )
            : t(
                'La semana se preparará como descarga: menos series y peso más ligero. ¿Continuar?'
              )
        }
        confirmLabel={t('Continuar')}
        confirmVariant="primary"
        onConfirm={() => {
          if (pendingDeload === 'unmark') {
            applyDeload(false, false);
          } else {
            applyDeload(true, hasInsertedData);
          }
          setPendingDeload(null);
        }}
        onCancel={() => setPendingDeload(null)}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      {/* Descanso en curso de ESTE día, flotando sobre la lista justo encima
          de "Volver". Fuera del registro lo releva la barra de la raíz, en el
          mismo sitio. */}
      {showFloatingTimer && (
        <View
          style={[
            styles.floatingTimer,
            { bottom: floatingTimerBottom + timerLift },
          ]}
          onLayout={(e) => setTimerHeight(e.nativeEvent.layout.height)}
          {...timerPan.panHandlers}
        >
          {/* Cristal oscuro como "Volver", pero más denso (ver
              GLASS_REST_TIMER_BG): deja intuir la lista sin competir con la
              cuenta atrás. */}
          <GlassBlur tint={GLASS_REST_TIMER_BG} style={styles.timerBlur} />
          <View style={styles.timerGlassOverlay} pointerEvents="none" />
          {/* El paso del descanso se pinta como un relleno que cruza la
              tarjeta de IZQUIERDA a DERECHA (llena = se acabó), en vez de la
              rueda de antes: se lee de reojo sin buscar un anillo pequeño, y no
              se confunde con el cronómetro del ejercicio, que son dígitos lisos
              dentro de la tarjeta. Avanza de forma continua, no a saltos de un
              segundo. */}
          <Animated.View
            style={[styles.timerFill, timerFillStyle]}
            pointerEvents="none"
          />
          <View style={styles.timerContainer}>{renderRestTimerContent()}</View>
        </View>
      )}

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

      {/* Descanso por defecto entre series, sin salir del registro. Ajuste de
          la PERSONA (el mismo que edita Configuración); cambia el de las
          próximas series, no el descanso en curso. */}
      <RestTimerModal
        visible={showTimerModal}
        onClose={() => setShowTimerModal(false)}
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
    // Remate del día completado: tarjeta verde con el CTA de cierre.
    completedCard: {
      marginTop: 15,
      padding: 16,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.success,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
      gap: 10,
      ...theme.shadow.soft,
    },
    completedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    completedText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    completedHint: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    // "Añadir cardio": ocupa el hueco del campo cuando está plegado. Contorno
    // discontinuo, como el resto de "añadir" de la app (Añadir ejercicio/día).
    // Nota de la sesión: misma carpintería que la tarjeta de cardio (borde
    // izquierdo del acento del día), para que se lean como dos apuntes del día.
    sessionNoteCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      marginVertical: 12,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderLeftWidth: 5,
      borderLeftColor: theme.colors.primaryLine,
      ...theme.shadow.soft,
    },
    sessionNoteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sessionNoteTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    sessionNoteInput: {
      minHeight: 64,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    addSessionNoteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginVertical: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1.5,
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.surface,
    },
    addSessionNoteText: {
      color: theme.colors.primary,
      fontWeight: '800',
      fontSize: 15,
    },
    buttonPressed: {
      opacity: 0.85,
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
    // Mismo patrón que las burbujas de serie (`serieTag` de ExerciseInputField):
    // relleno del acento al 18% y tinta del acento. Sin sombra: un fondo
    // translúcido con `elevation` pinta en Android un rectángulo de esquinas
    // vivas dentro del redondeo (ver checklist de frontend-design.md).
    // Cristal translúcido con blur, piel de "Volver" pero más denso
    // (GLASS_REST_TIMER_BG). Sin `elevation`: un fondo con transparencias y
    // elevación pinta en Android un rectángulo de esquinas vivas dentro del
    // redondeo (ver frontend-design.md).
    floatingTimer: {
      position: 'absolute',
      left: 16,
      right: 16,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: GLASS_REST_TIMER_BG,
      borderWidth: 1,
      borderColor: GLASS_BACK_BUTTON_BORDER,
      overflow: 'hidden',
    },
    timerBlur: {
      ...StyleSheet.absoluteFillObject,
    },
    timerGlassOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: GLASS_BACK_BUTTON_OVERLAY,
    },
    // Rótulo del bloque: qué se espera (siguiente serie o ejercicio).
    timerCaption: {
      fontSize: 12,
      fontWeight: '700',
      color: GLASS_BACK_BUTTON_TEXT,
      opacity: 0.8,
      textAlign: 'center',
      lineHeight: 16,
      marginBottom: 4,
      // Deja libre la × de la esquina.
      paddingHorizontal: 34,
    },
    // Lo consumido del descanso: crece de izquierda a derecha hasta llenar la
    // tarjeta cuando se acaba. Va pegado al borde izquierdo, detrás del
    // contenido.
    timerFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      // Tinta clara del cristal: en día `accentLine` es gris y no se vería
      // sobre el cristal oscuro.
      backgroundColor: GLASS_BACK_BUTTON_TEXT + '3D',
    },
    timerContainer: {
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 12,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    // Fila única del descanso, centrada en el bloque. El hueco lateral es
    // simétrico (no solo a la derecha) para que el centrado sea el real y de
    // paso el contenido nunca llegue a la × de la esquina.
    timerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      justifyContent: 'center',
      gap: 14,
      // Hueco simétrico para que el centrado sea el real y el contenido nunca
      // llegue a la × de la esquina, que ahora es más grande.
      paddingHorizontal: 34,
    },
    // Cuenta atrás: ahora es el protagonista del bloque (la rueda ya no está;
    // el paso del tiempo lo pinta el relleno de la tarjeta).
    timerText: {
      fontSize: 34,
      fontWeight: '800',
      color: GLASS_BACK_BUTTON_TEXT,
      fontVariant: ['tabular-nums'],
    },
    // "+30s" en oro macizo: es lo ÚNICO que se pulsa dentro del bloque (el
    // descanso corre solo), así que lleva el color de las acciones y destaca
    // sobre el relleno gris del acento.
    timerActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.primaryFill,
    },
    // Cerrar el descanso: aspa en la esquina superior derecha del bloque. Sin
    // borde ni fondo propios (la forma la pone el icono `close-circle`); su
    // `hitSlop` le da el área de toque que el dibujo no tiene.
    timerCloseButton: {
      position: 'absolute',
      top: 6,
      right: 6,
      zIndex: 1,
      width: TIMER_CLOSE_SIZE,
      height: TIMER_CLOSE_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timerActionButtonPressed: {
      opacity: 0.6,
    },
    timerActionText: {
      fontSize: 16,
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
