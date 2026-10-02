import { subscribeTheme } from '@lib/themeStore';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppModal,
  Button,
  ConfirmModal,
  DayAccentIcon,
  ExerciseEditorModal,
  ExerciseSummaryRow,
  ExerciseTileGrid,
  SortableList,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  GymIconGrid,
  resolveDayIcon,
  RoutineIntensityPill,
  RoutineOriginPill,
  StretchScrollView,
  Toast,
  TopBarActionButton,
} from '../../components';
import type { GymIconName } from '../../components';
import { WorkoutDay, WorkoutRoutine } from '../../types';
import { getDisplayDayName, getTrainingAccent, theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  buildWorkoutExercises,
  createEmptyExercise,
  ExerciseForm,
  exerciseFormFromExercise,
} from '@lib/exerciseForm';
import {
  buildRoutineShareLink,
  buildRoutineShareText,
} from '@lib/routineShare';
import { useWorkout } from '@hooks/useWorkout';
import {
  countRoutineSets,
  duplicateRoutine,
  exerciseCountText,
  isLinkedRoutine,
  routineAuthorId,
  routineIntensity,
  routineStatus,
} from '@lib/routines';
import { useSession } from '@lib/cloud/auth';
import {
  setRoutinePublic,
  getPublicRoutineIds,
  updateProfile,
} from '@lib/cloud/social';
import {
  hasProfileFilled,
  loadMyProfile,
  useMyProfile,
} from '@hooks/useMyProfile';

// Plegado de los días: MISMAS transiciones que las tarjetas de la pantalla de
// registro (ver components/ExerciseInputField.tsx), para que plegar sea el mismo
// gesto y el mismo movimiento en toda la app.
const layoutTransition = LinearTransition.duration(220).easing(
  Easing.inOut(Easing.ease)
);
const fadeIn = FadeIn.duration(180);
// El cuerpo del día NO lleva `exiting`: en Android, una vista que se desvanece
// al desmontarse dentro de un padre con `layout` (y en un ScrollView) se queda
// a veces como fantasma: la tarjeta crecía vacía y las filas de abajo se
// pintaban encima. Sin salida animada el bloque encoge con su transición de
// layout y el contenido aparece con el fundido de entrada.

// Sombreado del "peldaño" del pliegue al pie de la tarjeta (mismos cortes que en
// ExerciseInputField): intenso en el borde inferior y desvanecido hacia el
// centro, para que la barra se lea como un escalón tallado y no como un botón.
const STEP_SHADE_STOPS = [0, 0.35, 0.72, 1];

interface RoutineDetailScreenProps {
  routine: WorkoutRoutine;
  onBack: () => void;
  // Copia editable recién sacada de una rutina enlazada: la pantalla no puede
  // navegar sola, así que avisa para que se abra la ficha de la copia.
  onForked?: (copy: WorkoutRoutine) => void;
  // Pantalla de cuenta (Datos y nube): destino del aviso de "inicia sesión".
  onOpenAccount?: () => void;
  // Perfil del autor de una rutina traída de la comunidad.
  onOpenProfile?: (userId: string, name: string) => void;
  // La rutina se ha borrado desde su ⋮: la pantalla no puede seguir abierta.
  onDeleted?: () => void;
  // Día que nace desplegado: se llega desde la ficha de un ejercicio (Progreso)
  // y lo que se quiere ver es ESE ejercicio, no una lista de días plegados.
  initialExpandedDayId?: string;
}

export function RoutineDetailScreen({
  routine,
  onBack,
  onForked,
  onOpenAccount,
  onOpenProfile,
  onDeleted,
  initialExpandedDayId,
}: RoutineDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  // Modo lectura por defecto: la pantalla es de CONSULTA. El andamiaje de
  // edición (reordenar, borrar, cambiar icono, editar ejercicios) solo aparece
  // al pulsar "Editar" en la barra. Nada se esconde tras gestos: entrar en
  // edición es un botón visible y en edición todas las acciones se ven.
  const [isEditing, setIsEditing] = useState(false);
  const [dayToDeleteId, setDayToDeleteId] = useState<string | null>(null);
  // Día que se está renombrando / cambiando de icono. Un único modal "Editar
  // día" para las dos cosas: antes el icono tenía su propia rejilla en un modal
  // aparte y el nombre no se podía cambiar de ninguna forma.
  const [dayToEditId, setDayToEditId] = useState<string | null>(null);
  const [dayNameInput, setDayNameInput] = useState('');
  const [dayIconDraft, setDayIconDraft] = useState<GymIconName | null>(null);
  // Filas editables por día mientras dura la edición. NO son un formulario con
  // "Guardar": son el borrador de la fila que está abierta. En cuanto se cierra
  // (✓), se mueve, se quita una o se sale de edición, el día se guarda solo.
  const [drafts, setDrafts] = useState<Record<string, ExerciseForm[]>>({});
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null
  );
  // Días desplegados. La ficha nace PLEGADA entera: de un vistazo se ve qué días
  // tiene la rutina y cuántos ejercicios cada uno, en vez de un rollo de 30
  // ejercicios que obliga a hacer scroll para saber si hay un cuarto día. Salvo
  // que se venga buscando un ejercicio concreto: entonces su día ya está abierto.
  const [expandedDayIds, setExpandedDayIds] = useState<Set<string>>(
    () => new Set(initialExpandedDayId ? [initialExpandedDayId] : [])
  );
  const [showShareModal, setShowShareModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  // Duplicar pide confirmación: antes un toque en la tarjeta de Rutinas creaba
  // una copia sin avisar.
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    // Aviso con salida: "inicia sesión para…" lleva a la pantalla de cuenta.
    action?: 'sign-in';
  } | null>(null);
  // Estado de "rutina pública en la comunidad" (Fase 4). is_public vive solo en
  // la nube; se consulta al abrir si hay sesión.
  const { user } = useSession();
  const [isPublic, setIsPublic] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Publicar una rutina no te hace visible: el perfil nace en privado, así que
  // sin esto la rutina sale al tablón firmada como "Anónimo", sin foto y sin
  // camino a tu perfil. Se avisa ANTES de publicar y se ofrece arreglarlo en el
  // mismo gesto.
  const { profile: myProfile } = useMyProfile();
  const profileVisible = !!myProfile?.is_public && hasProfileFilled(myProfile);
  const [showAnonModal, setShowAnonModal] = useState(false);
  const [visibleNameInput, setVisibleNameInput] = useState('');

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  // Obtener la rutina actualizada del estado
  const currentRoutine =
    state.routines.find((r) => r.id === routine.id) || routine;

  // Rutina cerrada: tiene entrenamientos y ya no es la activa (misma regla que
  // la tarjeta "Rutina Cerrada" de Inicio). No se permite editar su información.
  const isClosed =
    state.logs.some((log) => log.routineId === currentRoutine.id) &&
    currentRoutine.id !== state.activeRoutineId;

  // Rutina traída de la comunidad: es de otra persona, así que aquí se consulta
  // y se entrena, pero no se edita ni se republica. Para cambiarla se saca una
  // copia propia (que sí guarda de dónde vino).
  const isLinked = isLinkedRoutine(currentRoutine);
  const totalSets = useMemo(
    () => countRoutineSets(currentRoutine),
    [currentRoutine]
  );
  const canEdit = !isLinked;
  // Se borra con la regla de la lista de Rutinas: solo sin entrenamientos.
  const canDelete = !state.logs.some(
    (log) => log.routineId === currentRoutine.id
  );
  // Subtítulo de la barra: el estado de la rutina (el rótulo de su tarjeta en
  // Rutinas) y cuántos días tiene.
  const status = routineStatus(
    currentRoutine,
    state.logs,
    state.activeRoutineId
  );
  const statusLabel =
    status === 'active'
      ? t('La que entrenas')
      : status === 'prepared'
      ? t('Sin estrenar')
      : t('Cerrada');
  const daysCount = currentRoutine.days.length;
  const statusSubtitle = `${statusLabel} · ${
    daysCount === 1 ? t('1 día') : t('{n} días', { n: daysCount })
  }`;

  // Filas de un día: el borrador si lo hay, y si no el plan tal cual.
  const dayRows = (day: WorkoutDay): ExerciseForm[] =>
    drafts[day.id] ?? day.exercises.map(exerciseFormFromExercise);

  // Vuelca las filas de un día en la rutina. `buildWorkoutExercises` descarta
  // las que no tienen nombre, así que una fila recién añadida no se guarda
  // hasta que se llama de alguna forma; un día no puede quedarse sin ninguna.
  const commitDay = (dayId: string, rows: ExerciseForm[]) => {
    const day = currentRoutine.days.find((d) => d.id === dayId);
    if (!day) return;
    const exercises = buildWorkoutExercises(rows);
    if (!exercises.length) return;
    dispatch({
      type: 'UPDATE_DAY',
      payload: {
        routineId: currentRoutine.id,
        dayId,
        day: { ...day, exercises },
      },
    });
  };

  // Cambia las filas de un día y, si el cambio ya está cerrado (mover, quitar,
  // plegar), lo guarda. Mientras se teclea dentro de una fila abierta solo se
  // toca el borrador: guardar en cada pulsación escribiría en SQLite por letra.
  const updateDayRows = (
    day: WorkoutDay,
    updater: (rows: ExerciseForm[]) => ExerciseForm[],
    commit: boolean
  ) => {
    const next = updater(dayRows(day));
    setDrafts((previous) => ({ ...previous, [day.id]: next }));
    if (commit) commitDay(day.id, next);
  };

  // Al salir de edición se guarda lo que quede abierto. Antes se descartaba el
  // borrador en silencio: pulsar "Hecho" con un ejercicio a medias lo perdía.
  const commitAllDrafts = () => {
    for (const [dayId, rows] of Object.entries(drafts)) commitDay(dayId, rows);
  };

  const toggleEditing = () => {
    if (isEditing) {
      commitAllDrafts();
      setDrafts({});
      setEditingExerciseId(null);
    } else {
      // Entrar en edición pliega los días: así el asa para ordenarlos está
      // desde el primer momento, y cada día se abre con su peldaño.
      setExpandedDayIds(new Set());
    }
    setIsEditing(!isEditing);
  };

  // Salir de la pantalla también guarda: el "Volver" no puede ser una vía de
  // escape que tire los cambios.
  const handleBack = () => {
    if (isEditing) commitAllDrafts();
    onBack();
  };

  // Duplicar la rutina (desde el ⋯, o desde "Hacer copia" en una ajena). La
  // copia es tuya (ids nuevos, se sincroniza) y queda sin estrenar; si viene de
  // otra persona arrastra el crédito: su ficha dirá de quién salió.
  const handleDuplicate = () => {
    setShowDuplicateModal(false);
    const copy = duplicateRoutine(
      currentRoutine,
      state.routines.map((r) => r.name)
    );
    dispatch({ type: 'ADD_ROUTINE', payload: copy });
    if (onForked) onForked(copy);
    else
      setToast({
        message: t('Copiada como "{name}"', { name: copy.name }),
        type: 'success',
      });
  };

  const handleOpenInfoModal = () => {
    if (isClosed || !canEdit) return;
    setNameInput(currentRoutine.name);
    setDescriptionInput(currentRoutine.description ?? '');
    setShowInfoModal(true);
  };

  const handleSaveInfo = () => {
    const name = nameInput.trim();
    if (name) {
      dispatch({
        type: 'UPDATE_ROUTINE',
        payload: {
          ...currentRoutine,
          name,
          description: descriptionInput.trim() || undefined,
        },
      });
    }
    setShowInfoModal(false);
  };

  // Enlace que codifica la rutina para compartir por QR (deep link).
  const shareLink = useMemo(
    () => buildRoutineShareLink(currentRoutine),
    [currentRoutine]
  );

  // Rutina en texto plano, lista para pegar en "Crear a partir de texto plano".
  const shareText = useMemo(
    () => buildRoutineShareText(currentRoutine),
    [currentRoutine]
  );

  // Una rutina grande (muchos días/ejercicios) genera un enlace que no cabe en
  // un QR: `react-native-qrcode-svg` LANZA al renderizar (rompía la pantalla).
  // Con ecl "L" (máxima capacidad) el límite práctico ronda los 2900 chars; por
  // encima se ofrece solo el texto plano, que no tiene tope.
  const QR_MAX_CHARS = 2900;
  const qrTooBig = shareLink.length > QR_MAX_CHARS;

  // Consulta si esta rutina ya está publicada (solo con sesión).
  useEffect(() => {
    if (!user) {
      setIsPublic(false);
      return;
    }
    let active = true;
    getPublicRoutineIds(user.id)
      .then((ids) => {
        if (active) setIsPublic(ids.includes(routine.id));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id, routine.id]);

  // Publica/retira la rutina de la comunidad. is_public es un atributo de la nube
  // (el sync no lo pisa). Optimista: refleja al instante y revierte si falla.
  // Marca o desmarca la rutina como pública en la nube.
  const applyPublic = async (next: boolean) => {
    setPublishing(true);
    setIsPublic(next);
    try {
      await setRoutinePublic(routine.id, next);
      setToast({
        message: next
          ? t('Rutina publicada en la comunidad')
          : t('Rutina retirada de la comunidad'),
        type: 'success',
      });
    } catch (e) {
      setIsPublic(!next);
      setToast({ message: (e as Error).message, type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  const handleTogglePublic = async () => {
    if (!user) {
      setToast({
        message: t('Inicia sesión para compartir en la comunidad'),
        type: 'error',
        action: 'sign-in',
      });
      return;
    }
    // Retirarla no pregunta nada; publicarla sí, si vas a salir de incógnito.
    if (isPublic) {
      await applyPublic(false);
      return;
    }
    if (!profileVisible) {
      setVisibleNameInput(myProfile?.display_name?.trim() ?? '');
      setShowAnonModal(true);
      return;
    }
    await applyPublic(true);
  };

  // Sale del anonimato y publica en el mismo gesto: pone el nombre visible (si
  // falta) y marca el perfil como público. El editor de perfil sigue estando
  // para lo demás (foto y bio), pero publicar ya no obliga a ir hasta allí.
  const handlePublishVisible = async () => {
    if (!user) return;
    const name = visibleNameInput.trim();
    if (!name) return;
    setShowAnonModal(false);
    setPublishing(true);
    try {
      await updateProfile(user.id, { display_name: name, is_public: true });
      await loadMyProfile(user.id, true);
    } catch (e) {
      setToast({ message: (e as Error).message, type: 'error' });
      setPublishing(false);
      return;
    }
    setPublishing(false);
    await applyPublic(true);
  };

  const handlePublishAnonymous = async () => {
    setShowAnonModal(false);
    await applyPublic(true);
  };

  const handleCopyPlainText = async () => {
    try {
      await Clipboard.setStringAsync(shareText);
      setToast({
        message: t('Rutina copiada al portapapeles'),
        type: 'success',
      });
    } catch {
      setToast({ message: t('No se pudo copiar la rutina'), type: 'error' });
    }
  };

  // Abre "Editar día": nombre + icono en un solo sitio. El nombre no tenía
  // ningún camino de edición (había que borrar el día y rehacerlo, perdiendo su
  // historial) y el icono gastaba un modal propio.
  const handleOpenDayModal = (dayId: string) => {
    const day = currentRoutine.days.find((d) => d.id === dayId);
    if (!day) return;
    setDayNameInput(getDisplayDayName(day.name));
    setDayIconDraft(resolveDayIcon(day.emoji, day.name));
    setDayToEditId(dayId);
  };

  const handleSaveDay = () => {
    const day = currentRoutine.days.find((d) => d.id === dayToEditId);
    if (!day) return;
    // Mismo formato que `renumberDays`: el número vive en el nombre y
    // `getDisplayDayName` lo limpia al pintarlo.
    const title = dayNameInput.trim();
    dispatch({
      type: 'UPDATE_DAY',
      payload: {
        routineId: currentRoutine.id,
        dayId: day.id,
        day: {
          ...day,
          name: title
            ? `${t('Día')} ${day.dayNumber} - ${title}`
            : `${t('Día')} ${day.dayNumber}`,
          emoji: dayIconDraft ?? day.emoji,
        },
      },
    });
    setDayToEditId(null);
  };

  // Plegar / desplegar un día.
  const toggleDay = (day: WorkoutDay) => {
    const rows = dayRows(day);
    // Plegar con una fila de ejercicio abierta la guarda, igual que hace el ✓ de
    // la propia fila: un borrador no se puede quedar colgando fuera de vista.
    if (
      expandedDayIds.has(day.id) &&
      rows.some((row) => row.id === editingExerciseId)
    ) {
      commitDay(day.id, rows);
      setEditingExerciseId(null);
    }
    setExpandedDayIds((previous) => {
      const next = new Set(previous);
      if (next.has(day.id)) next.delete(day.id);
      else next.add(day.id);
      return next;
    });
  };

  const addExercise = (day: WorkoutDay) => {
    const exercise = createEmptyExercise();
    // Sin nombre todavía: se queda en el borrador y se guarda al plegarla.
    updateDayRows(day, (rows) => [...rows, exercise], false);
    setEditingExerciseId(exercise.id);
  };

  // Recuento que se pinta con el día plegado. En edición manda el borrador (lo
  // que se está viendo); en lectura, el plan guardado.
  const exerciseCountLabel = (day: WorkoutDay): string =>
    exerciseCountText(isEditing ? dayRows(day).length : day.exercises.length);

  const removeExercise = (day: WorkoutDay, exerciseId: string) => {
    updateDayRows(
      day,
      (rows) =>
        rows.length <= 1 ? rows : rows.filter((row) => row.id !== exerciseId),
      true
    );
  };

  // Reordena un ejercicio dentro del día: la fila `from` cae en el hueco `to`
  // (arrastre por el asa). Las demás se corren; nada se intercambia. El id de
  // cada fila viaja intacto (ver buildWorkoutExercises), así que el historial
  // sigue apuntando a su ejercicio.
  const moveExerciseTo = (day: WorkoutDay, from: number, to: number) => {
    updateDayRows(
      day,
      (rows) => {
        if (from === to || from < 0 || to < 0 || from >= rows.length) {
          return rows;
        }
        const next = [...rows];
        const [moved] = next.splice(from, 1);
        next.splice(Math.min(to, next.length), 0, moved);
        return next;
      },
      true
    );
  };

  // Renumera los días tras reordenar o borrar: `dayNumber` y el prefijo "Día N"
  // del nombre embeben el número (ver getDisplayDayName). El id de cada día no
  // cambia, así que los logs (que apuntan por `dayId`) siguen a su día.
  const renumberDays = (days: typeof currentRoutine.days) =>
    days.map((day, index) => {
      const title = getDisplayDayName(day.name);
      const number = index + 1;
      return {
        ...day,
        dayNumber: number,
        name: title
          ? `${t('Día')} ${number} - ${title}`
          : `${t('Día')} ${number}`,
      };
    });

  // Arrastre por el asa: el día `from` cae en el hueco `to` y los demás se
  // corren (nada se intercambia). Los ids viajan intactos, así que el historial
  // de cada día sigue apuntando al suyo; solo cambia el número que llevan.
  const handleMoveDayTo = (from: number, to: number) => {
    const days = currentRoutine.days;
    if (from === to || from < 0 || to < 0 || from >= days.length) return;
    const next = [...days];
    const [moved] = next.splice(from, 1);
    next.splice(Math.min(to, next.length), 0, moved);
    dispatch({
      type: 'UPDATE_ROUTINE',
      payload: { ...currentRoutine, days: renumberDays(next) },
    });
  };

  const dayToDelete = currentRoutine.days.find((d) => d.id === dayToDeleteId);
  // ¿El día por borrar tiene entrenamientos? Su historial quedaría huérfano (los
  // logs apuntan por `dayId`), así que se avisa en la confirmación.
  const dayToDeleteHasLogs =
    !!dayToDeleteId && state.logs.some((log) => log.dayId === dayToDeleteId);

  const allDaysCollapsed = currentRoutine.days.every(
    (day) => !expandedDayIds.has(day.id)
  );
  const canDragDays =
    isEditing && canEdit && allDaysCollapsed && currentRoutine.days.length > 1;

  const handleDeleteDay = () => {
    if (!dayToDeleteId || currentRoutine.days.length <= 1) {
      setDayToDeleteId(null);
      return;
    }
    const next = currentRoutine.days.filter((d) => d.id !== dayToDeleteId);
    dispatch({
      type: 'UPDATE_ROUTINE',
      payload: { ...currentRoutine, days: renumberDays(next) },
    });
    setDayToDeleteId(null);
  };

  // Un día de la rutina: cabecera (icono + nombre), sus ejercicios (en lectura
  // como casillas; en edición, editables) y el peldaño de pliegue. `dragHandle`
  // llega cuando los días se están ordenando arrastrando.
  const renderDayBlock = (day: WorkoutDay, dragHandle?: ReactNode) => {
    const accent = getTrainingAccent(day);
    const canDeleteDay = currentRoutine.days.length > 1;
    const rows = dayRows(day);
    const expanded = expandedDayIds.has(day.id);

    return (
      <Animated.View
        key={day.id}
        // Dentro de la lista arrastrable la fila ya se anima sola.
        layout={dragHandle ? undefined : layoutTransition}
        style={[
          styles.dayBlock,
          !!dragHandle && styles.dayBlockSortable,
          { borderColor: accent },
        ]}
      >
        <GradientFill accent={accent} />
        <View
          style={[
            styles.dayHeader,
            // Plegado, la cabecera ES la tarjeta: sin hueco por debajo
            // (mismo criterio que headerCollapsedEmpty en la pantalla de
            // registro).
            !expanded && styles.dayHeaderCollapsed,
          ]}
        >
          {/* Asa de arrastre (la pone SortableList) para ordenar los
                días: solo en edición y con todos plegados. */}
          {dragHandle}
          {/* En edición la cabecera entera abre "Editar día" (nombre +
                icono), con el lápiz que lo delata. En lectura pliega y
                despliega el día, igual que el nombre de un ejercicio en la
                pantalla de registro. */}
          <Pressable
            style={({ pressed }) => [
              styles.dayHeaderLeft,
              pressed && styles.buttonPressed,
            ]}
            onPress={() =>
              isEditing ? handleOpenDayModal(day.id) : toggleDay(day)
            }
            accessibilityRole="button"
            accessibilityLabel={
              isEditing
                ? t('Editar día')
                : expanded
                ? t('Plegar día')
                : t('Desplegar día')
            }
          >
            <View style={styles.dayIconButton}>
              <DayAccentIcon emoji={day.emoji} name={day.name} size={32} />
              {isEditing && (
                <View style={styles.dayIconEditBadge}>
                  <MaterialCommunityIcons
                    name="pencil"
                    size={9}
                    color={theme.colors.onGold}
                  />
                </View>
              )}
            </View>
            <View style={styles.dayTitleWrap}>
              {/* El número del día baja a ceja: es la referencia, no el
                    titular. Antes iba en una píldora dorada que pesaba más
                    que los propios ejercicios. */}
              <Text style={styles.dayEyebrow}>
                {t('Día')} {day.dayNumber}
              </Text>
              <Text style={styles.dayName} numberOfLines={2}>
                {getDisplayDayName(day.name) || `${t('Día')} ${day.dayNumber}`}
              </Text>
            </View>
          </Pressable>

          {/* Plegado, lo único que se dice del contenido: cuántos
                ejercicios hay. A la derecha del todo, que es donde se busca
                un número en una fila que empieza por un nombre. */}
          {!expanded && (
            <Text style={styles.dayCount} numberOfLines={1}>
              {exerciseCountLabel(day)}
            </Text>
          )}
        </View>

        {!expanded ? null : isEditing ? (
          // Los ejercicios se editan AQUÍ mismo, como al crear la rutina.
          // Antes hacía falta entrar en un segundo editor ("Editar
          // ejercicios") con su propio Cancelar/Guardar, y salir de
          // edición tiraba ese borrador sin avisar.
          <Animated.View entering={fadeIn} style={styles.exercisesEditor}>
            {/* Arrastrando por el asa se coloca cada ejercicio donde
                  se quiera. */}
            <SortableList
              items={rows}
              keyOf={(exercise) => exercise.id}
              onMove={(from, to) => moveExerciseTo(day, from, to)}
              renderItem={(exercise, handle) => (
                <ExerciseSummaryRow
                  exercise={exercise}
                  canRemove={rows.length > 1}
                  onEdit={() => setEditingExerciseId(exercise.id)}
                  onRemove={() => removeExercise(day, exercise.id)}
                  dragHandle={handle}
                />
              )}
            />

            {/* El ejercicio abierto se edita en un popup (el lápiz de
                  su fila); cerrarlo ES guardarlo. Un ejercicio que se
                  cierra sin nombre se descarta: no hay nada que guardar. */}
            {(() => {
              const editing = rows.find((row) => row.id === editingExerciseId);
              if (!editing) return null;
              return (
                <ExerciseEditorModal
                  visible
                  exercise={editing}
                  accent={theme.colors.primaryLine}
                  onChange={(changes) =>
                    updateDayRows(
                      day,
                      (previous) =>
                        previous.map((row) =>
                          row.id === editing.id ? { ...row, ...changes } : row
                        ),
                      false
                    )
                  }
                  onDone={() => {
                    if (!editing.name.trim()) {
                      removeExercise(day, editing.id);
                    } else {
                      commitDay(day.id, dayRows(day));
                    }
                    setEditingExerciseId(null);
                  }}
                />
              );
            })()}

            <Pressable
              style={({ pressed }) => [
                styles.addExerciseButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => addExercise(day)}
            >
              <MaterialCommunityIcons
                name="plus-circle-outline"
                size={18}
                color={theme.colors.onGold}
              />
              <Text style={styles.addExerciseText}>
                {t('Añadir ejercicio')}
              </Text>
            </Pressable>

            {/* Borrar el día, con rótulo y apartado de las flechas: antes
                  era una papelera pegada a ellas, y borrar un día se lleva
                  por delante su historial. */}
            {canDeleteDay && (
              <Pressable
                style={({ pressed }) => [
                  styles.removeDayButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setDayToDeleteId(day.id)}
                accessibilityRole="button"
                accessibilityLabel={t('Quitar día')}
              >
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={16}
                  color={theme.colors.error}
                />
                <Text style={styles.removeDayText}>{t('Quitar día')}</Text>
              </Pressable>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={fadeIn}>
            {/* Casillas con el GIF grande, como las opciones del perfil;
                  el mismo dibujo que en una rutina de la comunidad. */}
            <ExerciseTileGrid exercises={day.exercises} accent={accent} />
          </Animated.View>
        )}

        {/* Peldaño de pliegue al pie de la tarjeta: la MISMA barra con
              chevron que cierra las tarjetas de la pantalla de registro. Va
              la última porque es el borde inferior del bloque. */}
        <Pressable
          style={({ pressed }) => [
            styles.collapseBar,
            pressed && styles.collapseBarPressed,
          ]}
          onPress={() => toggleDay(day)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? t('Plegar día') : t('Desplegar día')}
        >
          <LinearGradient
            colors={theme.gradients.heroStep}
            locations={STEP_SHADE_STOPS}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={accent}
          />
        </Pressable>
      </Animated.View>
    );
  };

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
        {/* Cabecera de la rutina: la MISMA ficha que la de una rutina de la
            comunidad (degradado, nombre e intensidad a la derecha), para que
            una rutina se vea igual entres por donde entres. Solo es pulsable
            (editar nombre/descripción) en modo edición. */}
        <Pressable
          style={styles.infoBlock}
          onPress={handleOpenInfoModal}
          disabled={!isEditing || isClosed || !canEdit}
        >
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.infoHead}>
            <Text style={styles.infoName}>{currentRoutine.name}</Text>
            {totalSets > 0 && (
              <RoutineIntensityPill level={routineIntensity(totalSets)} />
            )}
            {isEditing && canEdit && (
              <View
                style={[
                  styles.infoEditChip,
                  !isClosed && styles.infoEditChipEditable,
                ]}
              >
                <MaterialCommunityIcons
                  name={isClosed ? 'lock-outline' : 'pencil'}
                  size={16}
                  color={
                    isClosed ? theme.colors.textSecondary : theme.colors.onGold
                  }
                />
              </View>
            )}
          </View>
          {/* De quién es la rutina, y con enlace a su perfil. La enlazada no es
              tuya (por eso no se edita) y la copia sí, pero el crédito se queda
              escrito. Antes la enlazada lo decía en la ceja y la copia en la
              marca: el mismo dato en dos sitios distintos, y ninguno llevaba a
              ningún lado. */}
          {(isLinked || !!currentRoutine.sourceAuthor) && (
            <RoutineOriginPill
              author={currentRoutine.sourceAuthor}
              copied={!isLinked}
              ownerId={routineAuthorId(currentRoutine)}
              onOpenProfile={onOpenProfile}
            />
          )}
          {!!currentRoutine.description && (
            <Text style={styles.infoDescription}>
              {currentRoutine.description}
            </Text>
          )}
        </Pressable>

        {/* En edición, con todos los días plegados, se ordenan arrastrando por
            el asa, como los ejercicios; con alguno abierto las alturas bailan
            y el arrastre no tiene sentido, así que vuelven a la lista fija. */}
        {canDragDays ? (
          <View style={styles.daysSortable}>
            <SortableList
              items={currentRoutine.days}
              keyOf={(day) => day.id}
              gap={12}
              onMove={handleMoveDayTo}
              handleWidth={44}
              handleIconSize={28}
              handleStyle={styles.dayDragHandle}
              renderItem={(day, handle) => renderDayBlock(day, handle)}
            />
          </View>
        ) : (
          currentRoutine.days.map((day) => renderDayBlock(day))
        )}
        {isEditing && !allDaysCollapsed && currentRoutine.days.length > 1 && (
          <Text style={styles.dragHint}>
            {t('Pliega todos los días para ordenarlos arrastrando')}
          </Text>
        )}

        {/* El descanso entre series ya no es de la rutina: es un ajuste de la
            persona y se toca desde Configuración (o desde el ⋯ del registro). */}

        {/* Una sola acción de compartir: la hoja de dentro ofrece QR y texto. */}
        <Pressable
          style={({ pressed }) => [
            styles.settingRow,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setShowShareModal(true)}
        >
          <MaterialCommunityIcons
            name="share-variant"
            size={20}
            color={theme.colors.text}
          />
          <View style={styles.settingRowTextWrap}>
            <Text style={styles.settingRowLabel}>{t('Compartir rutina')}</Text>
            <Text style={styles.settingRowHint}>
              {t('Por QR o copiando el texto')}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={theme.colors.textSecondary}
          />
        </Pressable>

        {/* Publicar en la comunidad (tablón). is_public vive en la nube; requiere
            sesión. Es un interruptor visible, no un gesto oculto. Una rutina
            ajena no se republica: no es tuya. */}
        {!isLinked && (
          <Pressable
            style={({ pressed }) => [
              styles.settingRow,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleTogglePublic}
            disabled={publishing}
          >
            <MaterialCommunityIcons
              name={isPublic ? 'earth' : 'earth-off'}
              size={20}
              color={isPublic ? theme.colors.success : theme.colors.text}
            />
            <View style={styles.settingRowTextWrap}>
              <Text style={styles.settingRowLabel}>
                {t('Compartir en la comunidad')}
              </Text>
              <Text style={styles.settingRowHint}>
                {!user
                  ? t('Inicia sesión para compartir')
                  : isPublic
                  ? profileVisible
                    ? t('Pública · aparece en el tablón')
                    : t('Pública · firmada como «Anónimo»')
                  : t('Privada · solo tú la ves')}
              </Text>
            </View>
            <Text style={[styles.publicPill, isPublic && styles.publicPillOn]}>
              {isPublic ? t('Pública') : t('Privada')}
            </Text>
          </Pressable>
        )}

        {/* Rutina ajena: se dice qué se puede y qué no, con la salida al lado.
            Nada de un botón muerto sin explicación. */}
        {isLinked && (
          <View style={styles.linkedNote}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={20}
              color={theme.colors.textSecondary}
            />
            <View style={styles.settingRowTextWrap}>
              <Text style={styles.settingRowLabel}>
                {t('Rutina de la comunidad')}
              </Text>
              <Text style={styles.settingRowHint}>
                {t(
                  'Puedes entrenarla tal cual. Para cambiarla, haz una copia tuya.'
                )}
              </Text>
            </View>
          </View>
        )}
      </StretchScrollView>

      {/* La misma barra que el Detalle de una sesión: título = qué es (el
          nombre, como la ficha de una rutina pública), subtítulo = un dato vivo
          (su estado y sus días), la acción principal a la vista y lo raro en el
          ⋮. Antes titulaba "Rutina" a secas con un eslogan debajo. */}
      <GlassTopBar
        title={currentRoutine.name}
        icon="book-open-variant"
        subtitle={statusSubtitle}
        topInset={insets.top}
        onLayout={onTopBarLayout}
        menuItems={[
          {
            icon: 'content-copy',
            label: t('Duplicar rutina'),
            onPress: () => setShowDuplicateModal(true),
          },
          // Borrar, con la misma regla que la lista de Rutinas: solo una
          // rutina sin entrenamientos (con historial se borraría también).
          ...(canDelete
            ? [
                {
                  icon: 'delete-outline' as const,
                  label: t('Eliminar rutina'),
                  onPress: () => setShowDeleteModal(true),
                },
              ]
            : []),
        ]}
        rightElement={
          // Lo ajeno no se edita: en su lugar, el botón ofrece la salida real
          // (sacar una copia tuya, que sí se puede tocar).
          canEdit ? (
            <TopBarActionButton
              label={isEditing ? t('Hecho') : t('Editar')}
              icon={isEditing ? 'check' : 'pencil'}
              active={isEditing}
              onPress={toggleEditing}
            />
          ) : (
            <TopBarActionButton
              label={t('Hacer copia')}
              icon="content-copy"
              onPress={() => setShowDuplicateModal(true)}
            />
          )
        }
      />

      <FloatingBackButton onPress={handleBack} bottom={floatingBackBottom} />

      {/* Un solo "Editar día": nombre + icono. El nombre no se podía cambiar de
          ninguna forma y el icono gastaba un modal entero para él solo. */}
      <AppModal
        visible={!!dayToEditId}
        onRequestClose={() => setDayToEditId(null)}
        title={t('Editar día')}
        icon="pencil"
        align="left"
        footer={
          <View style={styles.modalButtonRow}>
            <Button
              title={t('Cancelar')}
              onPress={() => setDayToEditId(null)}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            <Button
              title={t('Guardar')}
              onPress={handleSaveDay}
              variant="primary"
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
        <Text style={styles.fieldLabel}>{t('Nombre del día:')}</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={t('Ej: Push pesado')}
          placeholderTextColor={theme.colors.textSecondary}
          value={dayNameInput}
          onChangeText={setDayNameInput}
          maxLength={30}
        />
        <Text style={styles.fieldLabel}>{t('Icono:')}</Text>
        <GymIconGrid
          style={styles.iconGrid}
          activeIcon={dayIconDraft}
          onSelect={(icon) => setDayIconDraft(icon)}
        />
      </AppModal>

      <AppModal
        visible={showInfoModal}
        onRequestClose={() => setShowInfoModal(false)}
        title={t('Editar rutina')}
        icon="pencil"
        align="left"
        footer={
          <View style={styles.modalButtonRow}>
            <Button
              title={t('Cancelar')}
              onPress={() => setShowInfoModal(false)}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            <Button
              title={t('Guardar')}
              onPress={handleSaveInfo}
              variant="primary"
              disabled={!nameInput.trim()}
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
        <Text style={styles.fieldLabel}>{t('Nombre:')}</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={t('Nombre de la rutina')}
          placeholderTextColor={theme.colors.textSecondary}
          value={nameInput}
          onChangeText={setNameInput}
          maxLength={40}
        />
        <Text style={styles.fieldLabel}>{t('Descripción:')}</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={t('Descripción (opcional)')}
          placeholderTextColor={theme.colors.textSecondary}
          value={descriptionInput}
          onChangeText={setDescriptionInput}
          maxLength={80}
        />
      </AppModal>

      <AppModal
        visible={showShareModal}
        onRequestClose={() => setShowShareModal(false)}
        title={t('Compartir rutina')}
        icon="share-variant"
        message={
          qrTooBig
            ? t(
                'Esta rutina es demasiado grande para un código QR. Cópiala como texto para pegarla en «Crear a partir de texto plano».'
              )
            : t(
                'Escanea el QR con la cámara de otro móvil o copia la rutina como texto para pegarla en «Crear a partir de texto plano».'
              )
        }
        footer={
          <View style={styles.shareModalFooter}>
            <Button
              title={t('Copiar en texto plano')}
              onPress={handleCopyPlainText}
              variant="primary"
              size="medium"
            />
            <Button
              title={t('Cerrar')}
              onPress={() => setShowShareModal(false)}
              variant="secondary"
              size="medium"
            />
          </View>
        }
      >
        {qrTooBig ? (
          <View style={styles.qrTooBig}>
            <MaterialCommunityIcons
              name="qrcode-remove"
              size={40}
              color={theme.colors.textSecondary}
            />
          </View>
        ) : (
          <View style={styles.qrCanvas}>
            <QRCode
              value={shareLink}
              size={232}
              ecl="L"
              backgroundColor={theme.colors.qrLight}
              color={theme.colors.qrDark}
            />
          </View>
        )}
      </AppModal>

      {/* Publicar con el perfil en privado: se dice lo que va a pasar y se
          ofrece arreglarlo aquí mismo, en vez de mandar al usuario a Perfil →
          Editar perfil a tres toques de distancia. Las dos salidas publican;
          la diferencia es con qué firma. */}
      <AppModal
        visible={showAnonModal}
        onRequestClose={() => setShowAnonModal(false)}
        title={t('Saldrás como «Anónimo»')}
        icon="incognito"
        align="left"
        message={
          hasProfileFilled(myProfile)
            ? t(
                'Tu perfil está en privado: la rutina aparecerá en el tablón sin tu nombre ni tu foto, y nadie podrá abrir tu perfil ni seguirte desde ella.'
              )
            : t(
                'Todavía no tienes nombre visible, así que la rutina aparecerá en el tablón firmada como «Anónimo» y nadie podrá seguirte desde ella.'
              )
        }
        footer={
          <>
            <Button
              title={t('Hacerme visible y publicar')}
              onPress={handlePublishVisible}
              variant="primary"
              size="medium"
              disabled={publishing || !visibleNameInput.trim()}
            />
            <Button
              title={t('Publicar como «Anónimo»')}
              onPress={handlePublishAnonymous}
              variant="secondary"
              size="medium"
              disabled={publishing}
            />
          </>
        }
      >
        <Text style={styles.fieldLabel}>{t('Nombre visible')}</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={t('Nombre visible')}
          placeholderTextColor={theme.colors.textSecondary}
          value={visibleNameInput}
          onChangeText={setVisibleNameInput}
          maxLength={40}
        />
      </AppModal>

      <ConfirmModal
        visible={!!dayToDeleteId}
        icon="trash-can-outline"
        title={t('¿Eliminar el día?')}
        message={
          dayToDeleteHasLogs
            ? t(
                'Este día tiene entrenamientos registrados; su historial dejará de verse.'
              )
            : t('Se elimina «{name}» de la rutina y los días se renumeran.', {
                name: dayToDelete ? getDisplayDayName(dayToDelete.name) : '',
              })
        }
        confirmLabel={t('Eliminar')}
        onConfirm={handleDeleteDay}
        onCancel={() => setDayToDeleteId(null)}
      />

      <ConfirmModal
        visible={showDeleteModal}
        icon="delete-outline"
        title={t('¿Eliminar rutina?')}
        message={t('Esta acción no se puede deshacer. ¿Estás seguro?')}
        confirmLabel={t('Eliminar')}
        onConfirm={() => {
          setShowDeleteModal(false);
          // El reducer reajusta la rutina activa y la seleccionada si era una
          // de ellas; la pantalla se cierra porque ya no hay nada que enseñar.
          dispatch({ type: 'DELETE_ROUTINE', payload: currentRoutine.id });
          onDeleted?.();
        }}
        onCancel={() => setShowDeleteModal(false)}
      />

      <ConfirmModal
        visible={showDuplicateModal}
        icon="content-copy"
        title={t('¿Duplicar la rutina?')}
        message={t(
          'Se crea una copia de «{name}» en tus rutinas, sin estrenar. La original no cambia.',
          { name: currentRoutine.name }
        )}
        confirmLabel={t('Duplicar')}
        onConfirm={handleDuplicate}
        onCancel={() => setShowDuplicateModal(false)}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          actionLabel={
            toast.action === 'sign-in' && onOpenAccount
              ? t('Iniciar sesión')
              : undefined
          }
          onAction={
            toast.action === 'sign-in' && onOpenAccount
              ? onOpenAccount
              : undefined
          }
          onDismiss={() => setToast(null)}
        />
      )}
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
      marginTop: 0,
    },
    // Cabecera de la rutina: banner con fondo dorado tenue, insignia e "eyebrow".
    // Deliberadamente distinto de las tarjetas de día (que son transparentes con
    // borde izquierdo de acento) para que no se lea como un día más.
    infoBlock: {
      backgroundColor: theme.colors.primaryMuted,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.primary + '55',
      padding: theme.spacing.md,
      marginBottom: 16,
      overflow: 'hidden',
      gap: 6,
    },
    // Nombre + intensidad (+ lápiz en edición) arriba a la derecha. Alineados
    // arriba para que, con un nombre a dos líneas, acompañen a la primera.
    infoHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    infoName: {
      flex: 1,
      fontSize: 22,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 31,
    },
    infoEditChip: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    // Editable = oro vivo con tinta oscura; bloqueada se queda neutra (candado).
    infoEditChipEditable: {
      backgroundColor: theme.colors.primaryFill,
      borderColor: theme.colors.primaryFillDark,
    },
    infoDescription: {
      fontSize: 14,
      lineHeight: 19,
      color: theme.colors.textSecondary,
    },
    // La lista arrastrable pinta ella el hueco entre días (gap): el bloque
    // deja su margen y el envoltorio pone el de después del último.
    daysSortable: {
      marginBottom: 12,
    },
    dayBlockSortable: {
      marginBottom: 0,
    },
    // El asa de arrastre de los días se sale del `padding` de la tarjeta
    // (margen negativo) para quedar a ras de su borde izquierdo, y del alto de
    // la cabecera para llegar al alto real de la tarjeta: mientras se arrastra
    // todos los días están plegados (`allDaysCollapsed`), así que la cabecera
    // ES la tarjeta y el asa queda centrada con ella de punta a punta.
    dayDragHandle: {
      marginLeft: -theme.spacing.md,
      marginVertical: -theme.spacing.md,
    },
    dragHint: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: -4,
      marginBottom: 12,
    },
    // Quitar el día: rotulado y al pie del bloque, lejos de las flechas. Borrar
    // un día se lleva por delante su historial, así que no puede estar pegado a
    // los controles que más se pulsan.
    removeDayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 2,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    removeDayText: {
      color: theme.colors.error,
      fontSize: 13,
      fontWeight: '800',
    },
    dayBlock: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderLeftWidth: 4,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginBottom: 12,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      gap: 8,
    },
    // Plegado no hay nada debajo salvo el peldaño del pliegue: el hueco de 10
    // solo hacía la tarjeta más alta sin separar nada.
    dayHeaderCollapsed: {
      marginBottom: 0,
    },
    // Recuento de ejercicios del día plegado. Es un dato de apoyo, no el
    // titular: mismo peso visual que el "4x8" de la lista de ejercicios.
    dayCount: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    dayHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    // El icono lleva el micro-badge de lápiz que delata la cabecera como
    // editable (en edición, tocarla abre "Editar día": nombre + icono).
    dayIconButton: {
      marginRight: 10,
      paddingTop: 2,
    },
    dayIconEditBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 15,
      height: 15,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryFill,
    },
    dayTitleWrap: {
      flex: 1,
      minWidth: 0,
    },
    // "Día 3" como ceja: es la referencia, no el titular. Antes era una píldora
    // dorada que pesaba más que los propios ejercicios del día.
    dayEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
      lineHeight: 14,
    },
    dayName: {
      fontSize: 20,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 28,
    },
    // Peldaño del pliegue al pie del bloque de día. Copia exacta del de las
    // tarjetas de registro (components/ExerciseInputField.tsx): los márgenes
    // negativos valen el padding del bloque (theme.spacing.md = 16), así que la
    // barra llega a los tres bordes y hace de filo inferior de la tarjeta.
    collapseBar: {
      marginTop: 4,
      marginHorizontal: -theme.spacing.md,
      marginBottom: -theme.spacing.md,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderBottomLeftRadius: theme.borderRadius.md,
      borderBottomRightRadius: theme.borderRadius.md,
    },
    collapseBarPressed: {
      opacity: 0.7,
    },
    // El plan de series, apartado a la derecha en vez de pegado al nombre con
    // un guion ("Sentadilla — 4x8").
    modalButtonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    modalButton: {
      flex: 1,
    },
    fieldLabel: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    fieldInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.colors.text,
      backgroundColor: theme.colors.inputBg,
    },
    // Editor de ejercicios inline dentro de la tarjeta del día.
    exercisesEditor: {
      gap: 10,
      marginTop: 4,
    },
    addExerciseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primaryFillDark,
      backgroundColor: theme.colors.primaryFill,
    },
    addExerciseText: {
      color: theme.colors.onGold,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
    },
    iconGrid: {
      marginBottom: theme.spacing.sm,
    },
    buttonPressed: {
      opacity: 0.8,
    },
    // Fila de ajuste (temporizador, compartir): superficie con borde, discreta.
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
      ...theme.shadow.soft,
    },
    // Misma forma que una fila de ajuste, pero informativa: no se pulsa.
    linkedNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    settingRowTextWrap: {
      flex: 1,
    },
    settingRowLabel: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 20,
    },
    settingRowHint: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 17,
    },
    // Pastilla de estado público/privado a la derecha de la fila de comunidad.
    publicPill: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.borderRadius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
      overflow: 'hidden',
      lineHeight: 16,
    },
    publicPillOn: {
      color: theme.colors.onGold,
      backgroundColor: theme.colors.success,
    },
    shareModalFooter: {
      gap: 10,
    },
    qrCanvas: {
      alignSelf: 'center',
      backgroundColor: theme.colors.qrLight,
      padding: 16,
      borderRadius: theme.borderRadius.md,
      marginTop: theme.spacing.md,
    },
    qrTooBig: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.lg,
      marginTop: theme.spacing.sm,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
