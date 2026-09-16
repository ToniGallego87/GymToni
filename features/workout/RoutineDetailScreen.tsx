import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
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
  ExerciseFormRow,
  ExerciseSummaryRow,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  GymIconGrid,
  resolveDayIcon,
  RoutineOriginPill,
  StretchScrollView,
  Toast,
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
  duplicateRoutine,
  exerciseCountText,
  isLinkedRoutine,
  routineAuthorId,
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
const fadeOut = FadeOut.duration(140);

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

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
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
  const canEdit = !isLinked;

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
    }
    setIsEditing(!isEditing);
  };

  // Salir de la pantalla también guarda: el "Volver" no puede ser una vía de
  // escape que tire los cambios.
  const handleBack = () => {
    if (isEditing) commitAllDrafts();
    onBack();
  };

  // Sacar una copia editable de una rutina ajena. La copia es tuya (ids nuevos,
  // se sincroniza) pero arrastra el crédito: su ficha dirá de quién salió.
  const handleFork = () => {
    const copy = duplicateRoutine(
      currentRoutine,
      state.routines.map((r) => r.name)
    );
    dispatch({ type: 'ADD_ROUTINE', payload: copy });
    if (onForked) onForked(copy);
    else
      setToast({ message: t('Copia creada en tus rutinas'), type: 'success' });
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

  // Reordena un ejercicio dentro del día. El id de cada fila viaja intacto (ver
  // buildWorkoutExercises), así que el historial sigue apuntando a su ejercicio:
  // los resultados pasados se muestran en la nueva posición, no se recalculan.
  const moveExercise = (
    day: WorkoutDay,
    exerciseId: string,
    direction: -1 | 1
  ) => {
    updateDayRows(
      day,
      (rows) => {
        const index = rows.findIndex((row) => row.id === exerciseId);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= rows.length) return rows;
        const next = [...rows];
        [next[index], next[target]] = [next[target], next[index]];
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

  const handleMoveDay = (dayId: string, direction: -1 | 1) => {
    const index = currentRoutine.days.findIndex((d) => d.id === dayId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= currentRoutine.days.length) {
      return;
    }
    const next = [...currentRoutine.days];
    [next[index], next[target]] = [next[target], next[index]];
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
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera de la rutina. Solo es pulsable (editar nombre/descripción)
            en modo edición; en lectura es un banner de identidad. */}
        <Pressable
          style={styles.infoBlock}
          onPress={handleOpenInfoModal}
          disabled={!isEditing || isClosed || !canEdit}
        >
          <View style={styles.infoTopRow}>
            <View style={styles.infoBadge}>
              <MaterialCommunityIcons
                name={
                  isLinked
                    ? 'account-arrow-right-outline'
                    : 'clipboard-text-outline'
                }
                size={22}
                color={theme.colors.onGold}
              />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoEyebrow}>{t('Rutina')}</Text>
              <Text style={styles.infoName}>{currentRoutine.name}</Text>
            </View>
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

        {currentRoutine.days.map((day, index) => {
          const accent = getTrainingAccent(day);
          const isFirst = index === 0;
          const isLast = index === currentRoutine.days.length - 1;
          const canDeleteDay = currentRoutine.days.length > 1;
          const rows = dayRows(day);
          const expanded = expandedDayIds.has(day.id);

          return (
            <Animated.View
              key={day.id}
              layout={layoutTransition}
              style={[styles.dayBlock, { borderColor: accent }]}
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
                    <DayAccentIcon
                      emoji={day.emoji}
                      name={day.name}
                      size={32}
                    />
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
                      {getDisplayDayName(day.name) ||
                        `${t('Día')} ${day.dayNumber}`}
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

                {/* Mover el día, pegado al día que mueve. Antes eran tres
                    cuadros idénticos en una fila aparte, alineados a la derecha
                    y despegados de su día: con 4 días, doce iconos iguales. */}
                {isEditing && (
                  <View style={styles.dayMoveGroup}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.dayMoveButton,
                        isFirst && styles.controlDisabled,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => handleMoveDay(day.id, -1)}
                      disabled={isFirst}
                      accessibilityRole="button"
                      accessibilityLabel={t('Subir día')}
                    >
                      <MaterialCommunityIcons
                        name="chevron-up"
                        size={22}
                        color={
                          isFirst
                            ? theme.colors.textSecondary
                            : theme.colors.text
                        }
                      />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.dayMoveButton,
                        isLast && styles.controlDisabled,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => handleMoveDay(day.id, 1)}
                      disabled={isLast}
                      accessibilityRole="button"
                      accessibilityLabel={t('Bajar día')}
                    >
                      <MaterialCommunityIcons
                        name="chevron-down"
                        size={22}
                        color={
                          isLast
                            ? theme.colors.textSecondary
                            : theme.colors.text
                        }
                      />
                    </Pressable>
                  </View>
                )}
              </View>

              {!expanded ? null : isEditing ? (
                // Los ejercicios se editan AQUÍ mismo, como al crear la rutina.
                // Antes hacía falta entrar en un segundo editor ("Editar
                // ejercicios") con su propio Cancelar/Guardar, y salir de
                // edición tiraba ese borrador sin avisar.
                <Animated.View
                  entering={fadeIn}
                  exiting={fadeOut}
                  style={styles.exercisesEditor}
                >
                  {rows.map((exercise, exIndex) => {
                    const expanded =
                      editingExerciseId === exercise.id ||
                      !exercise.name.trim();

                    return expanded ? (
                      <ExerciseFormRow
                        key={exercise.id}
                        exercise={exercise}
                        accent={theme.colors.primaryLine}
                        canRemove={rows.length > 1}
                        onChange={(changes) =>
                          updateDayRows(
                            day,
                            (previous) =>
                              previous.map((row) =>
                                row.id === exercise.id
                                  ? { ...row, ...changes }
                                  : row
                              ),
                            false
                          )
                        }
                        onRemove={() => removeExercise(day, exercise.id)}
                        // Plegar la fila ES guardarla: no hay botón "Guardar".
                        onCollapse={() => {
                          commitDay(day.id, dayRows(day));
                          setEditingExerciseId(null);
                        }}
                      />
                    ) : (
                      <ExerciseSummaryRow
                        key={exercise.id}
                        exercise={exercise}
                        canRemove={rows.length > 1}
                        onEdit={() => setEditingExerciseId(exercise.id)}
                        onRemove={() => removeExercise(day, exercise.id)}
                        onMoveUp={() => moveExercise(day, exercise.id, -1)}
                        onMoveDown={() => moveExercise(day, exercise.id, 1)}
                        canMoveUp={exIndex > 0}
                        canMoveDown={exIndex < rows.length - 1}
                      />
                    );
                  })}

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
                      <Text style={styles.removeDayText}>
                        {t('Quitar día')}
                      </Text>
                    </Pressable>
                  )}
                </Animated.View>
              ) : (
                <Animated.View
                  entering={fadeIn}
                  exiting={fadeOut}
                  style={styles.exerciseList}
                >
                  {day.exercises.map((exercise) => (
                    <View key={exercise.id} style={styles.exerciseRow}>
                      <View
                        style={[
                          styles.exerciseDot,
                          { backgroundColor: accent },
                        ]}
                      />
                      {/* El ejercicio es EL contenido de la pantalla: tinta
                          primaria y su interlineado. Antes iba en secundario a
                          16/18, con las líneas tocándose. */}
                      <Text style={styles.exerciseText}>{exercise.name}</Text>
                      <Text style={styles.exerciseSets}>
                        {exercise.targetSets || '-'}x
                        {exercise.targetReps || '-'}
                      </Text>
                    </View>
                  ))}
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
                accessibilityLabel={
                  expanded ? t('Plegar día') : t('Desplegar día')
                }
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
        })}

        {/* El descanso entre series ya no es de la rutina: es un ajuste de la
            persona y se toca desde Perfil (o desde el ⋯ del registro). */}

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

      <GlassTopBar
        title={t('Rutina')}
        icon="file-document-edit-outline"
        subtitle={currentRoutine.name}
        topInset={insets.top}
        rightElement={
          // Lo ajeno no se edita: en su lugar, el botón ofrece la salida real
          // (sacar una copia tuya, que sí se puede tocar).
          <Pressable
            style={({ pressed }) => [
              styles.editToggle,
              isEditing && canEdit && styles.editToggleActive,
              pressed && styles.buttonPressed,
            ]}
            onPress={canEdit ? toggleEditing : handleFork}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={
              !canEdit ? t('Hacer copia') : isEditing ? t('Hecho') : t('Editar')
            }
          >
            <MaterialCommunityIcons
              name={!canEdit ? 'content-copy' : isEditing ? 'check' : 'pencil'}
              size={16}
              color={
                isEditing && canEdit
                  ? theme.colors.onGold
                  : theme.colors.primary
              }
            />
            <Text
              style={[
                styles.editToggleText,
                isEditing && canEdit && styles.editToggleTextActive,
              ]}
            >
              {!canEdit
                ? t('Hacer copia')
                : isEditing
                ? t('Hecho')
                : t('Editar')}
            </Text>
          </Pressable>
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
    // Toggle lectura/edición en la barra superior. Editable = oro vivo con
    // tinta oscura (activo); lectura = superficie con borde y tinta dorada.
    editToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      height: 34,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
    },
    editToggleActive: {
      backgroundColor: theme.colors.primaryFill,
      borderColor: theme.colors.primaryFillDark,
    },
    editToggleText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.primary,
      lineHeight: 16,
    },
    editToggleTextActive: {
      color: theme.colors.onGold,
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
      gap: 10,
    },
    infoTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    // Insignia y eyebrow de la rutina en oro vivo con tinta oscura (como el
    // selector Fuerza/Cardio): el amarillo brillante solo lee como relleno.
    infoBadge: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryFill,
      borderWidth: 1,
      borderColor: theme.colors.primaryFillDark,
    },
    infoTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    infoEyebrow: {
      alignSelf: 'flex-start',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.onGold,
      backgroundColor: theme.colors.primaryFill,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.sm,
      overflow: 'hidden',
      marginBottom: 4,
    },
    infoName: {
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
    // Subir/bajar el día, junto al día que mueven y a tamaño de dedo.
    dayMoveGroup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dayMoveButton: {
      width: 40,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    controlDisabled: {
      opacity: 0.4,
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
    exerciseList: {
      gap: 8,
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    exerciseDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
    },
    // Los ejercicios SON el contenido de la ficha: tinta primaria y su
    // interlineado. Iban en secundario a 16/18, un interlineado más corto que la
    // propia fuente, así que dos renglones se tocaban.
    exerciseText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      color: theme.colors.text,
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
    exerciseSets: {
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 22,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
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
