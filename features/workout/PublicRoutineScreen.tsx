import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TextInput,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Collapsible,
  ConfirmModal,
  DayAccentIcon,
  ExerciseTileGrid,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  LikeButton,
  ReportModal,
  RoutineIntensityPill,
  SaveRoutineButton,
  seriesExplanation,
  daysExplanation,
  StatBubble,
  StretchScrollView,
  Toast,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { WorkoutRoutine } from '../../types';
import { getDisplayDayName, getTrainingAccent, theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { formatAgo, t } from '@lib/i18n';
import {
  countRoutineSets,
  duplicateRoutine,
  findSavedRoutine,
  isLinkedRoutine,
  linkPublicRoutine,
  routineIntensity,
} from '@lib/routines';
import { useSession } from '@lib/cloud/auth';
import { readSocialCache, writeSocialCache } from '@lib/socialCache';
import { useMyProfile } from '@hooks/useMyProfile';
import {
  addRoutineComment,
  COMMENT_MAX_LENGTH,
  deleteRoutineComment,
  fetchPublicRoutine,
  getLikeInfo,
  getProfile,
  getProfilesByIds,
  getRoutineComments,
  likeRoutine,
  reportContent,
  unlikeRoutine,
  ProfileLite,
  ReportTarget,
  RoutineComment,
} from '@lib/cloud/social';
import { hideId, loadHiddenIds } from '@lib/moderation';

// Mismos tiempos que la ficha de una rutina propia: el pliegue de un día se ve
// igual venga de donde venga.
const layoutTransition = LinearTransition.duration(220).easing(
  Easing.inOut(Easing.ease)
);
const fadeIn = FadeIn.duration(180);
const fadeOut = FadeOut.duration(140);

// Sombreado del "peldaño" del pliegue al pie de la tarjeta (mismos cortes que en
// RoutineDetailScreen y ExerciseInputField).
const STEP_SHADE_STOPS = [0, 0.35, 0.72, 1];

interface PublicRoutineScreenProps {
  routineId: string;
  // Nombre y autor que ya tenía la tarjeta del tablón: se pintan mientras baja
  // el plan, para que la vista no abra en blanco.
  name: string;
  authorName?: string;
  // Dueño de la rutina: hace falta para enlazarla (marcar de quién es) y para
  // poder abrir su perfil desde aquí.
  ownerId?: string;
  onBack: () => void;
  onOpenProfile?: (userId: string, name: string) => void;
  // Pantalla de cuenta (Datos y nube): destino del aviso de "inicia sesión"
  // cuando alguien sin sesión intenta comentar.
  onOpenAccount?: () => void;
}

/**
 * Consulta de una rutina PÚBLICA de la comunidad: sus días y ejercicios en solo
 * lectura, más el botón de guardarla. Antes el tablón solo enseñaba nombre y
 * descripción, así que para saber qué traía dentro había que copiarla primero y
 * borrarla si no gustaba. Aquí no se toca nada del espacio del usuario hasta que
 * pulsa el botón.
 *
 * Lo ajeno es SOLO lectura: nada de editar ni reordenar (eso vive en
 * RoutineDetailScreen, sobre las rutinas propias). Guardarla tampoco la copia:
 * la ENLAZA (ver `linkPublicRoutine`).
 */
export function PublicRoutineScreen({
  routineId,
  name,
  authorName,
  ownerId,
  onBack,
  onOpenProfile,
  onOpenAccount,
}: PublicRoutineScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const { user } = useSession();
  const { profile: myProfile } = useMyProfile();

  const [routine, setRoutine] = useState<WorkoutRoutine | null>(null);
  const [author, setAuthor] = useState<{
    name: string;
    avatarUrl: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Likes de la rutina (nº y si le diste tú), como en la tarjeta del tablón.
  const [likeInfo, setLikeInfo] = useState<{ likes: number; liked: boolean }>({
    likes: 0,
    liked: false,
  });
  // La lista de días nace OCULTA tras "Ver días de ejercicio": lo que se viene
  // a decidir aquí es "¿me la quedo?", y la cabecera con intensidad, días y
  // series ya lo dice; el plan se despliega solo cuando interesa mirarlo.
  const [daysOpen, setDaysOpen] = useState(false);
  // Días desplegados dentro de la lista. Cada día nace PLEGADO, igual que en la
  // ficha de una rutina propia: de un vistazo se ve cuántos días trae y cuántos
  // ejercicios cada uno, en vez de un rollo de 30 ejercicios.
  const [expandedDayIds, setExpandedDayIds] = useState<Set<string>>(
    () => new Set()
  );
  // Hilo de comentarios de la rutina. Se pide aparte del plan: que la rutina se
  // vea no puede depender de que el hilo cargue (ni al revés).
  const [comments, setComments] = useState<RoutineComment[]>([]);
  const [commentAuthors, setCommentAuthors] = useState<
    Map<string, ProfileLite>
  >(() => new Map());
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [commentToDeleteId, setCommentToDeleteId] = useState<string | null>(
    null
  );
  // Qué se está reportando (la rutina o un comentario) y qué se ha ocultado ya
  // en este dispositivo.
  const [reportTarget, setReportTarget] = useState<{
    type: ReportTarget;
    id: string;
    what: string;
  } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    // Aviso con salida: "inicia sesión para…" lleva a la pantalla de cuenta.
    action?: 'sign-in';
  } | null>(null);

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: floatingBackBottom } = getFloatingBackButtonMetrics(
    insets.bottom
  );
  const backButtonSpace = FLOATING_BACK_BUTTON_HEIGHT + floatingBackBottom;

  const load = useCallback(async () => {
    // La copia del último arranque, ya: entrar en una rutina del tablón volvía a
    // esperar su plan entero cada vez, también la segunda y la tercera vez que
    // se abría la misma. El refresco de abajo la confirma.
    const stored = await readSocialCache<WorkoutRoutine>(
      `routine_${routineId}`
    );
    if (stored) {
      setRoutine(stored);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const fetched = await fetchPublicRoutine(routineId);
      if (!fetched) {
        setError(t('Esta rutina ya no está disponible'));
        return;
      }
      setRoutine(fetched);
      writeSocialCache(`routine_${routineId}`, fetched);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useEffect(() => {
    load();
  }, [load]);

  // Likes aparte del plan (y silencioso si falla): la rutina se ve igual.
  useEffect(() => {
    let alive = true;
    getLikeInfo([routineId], user?.id ?? null)
      .then((info) => {
        const entry = info.get(routineId);
        if (alive && entry) setLikeInfo(entry);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [routineId, user?.id]);

  const handleToggleLike = async () => {
    if (!user) {
      setToast({
        message: t('Crea una cuenta para dar like'),
        type: 'error',
        action: 'sign-in',
      });
      return;
    }
    const previous = likeInfo;
    setLikeInfo({
      likes: Math.max(0, previous.likes + (previous.liked ? -1 : 1)),
      liked: !previous.liked,
    });
    try {
      if (previous.liked) await unlikeRoutine(routineId, user.id);
      else await likeRoutine(routineId, user.id);
    } catch (e) {
      setLikeInfo(previous);
      setToast({ message: (e as Error).message, type: 'error' });
    }
  };

  // Foto y nombre actuales del autor, para que la firma sea una cara pulsable y
  // no un texto muerto. Silencioso si falla: la firma cae al nombre que ya trajo
  // la tarjeta de origen.
  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    getProfile(ownerId)
      .then((profile) => {
        if (!alive || !profile) return;
        setAuthor({
          name: profile.display_name || authorName || t('Anónimo'),
          avatarUrl: profile.avatar_url ?? null,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ownerId, authorName]);

  const displayAuthor = author?.name ?? authorName;

  // Enlaza lo ya descargado (ids originales) en vez de volver a bajarlo: la
  // vista ya tiene el plan entero delante. Añadir NO copia: apunta a la rutina
  // del autor, que se entrena tal cual pero no se edita.
  // La otra vía, sin cuenta: una copia PROPIA (ids nuevos, editable, con el
  // crédito al autor) que no necesita sync y por tanto no necesita sesión. El
  // enlace ("Añadir", que sigue al autor) sí la exige. Sin esto, un recién
  // instalado podía mirar la Comunidad entera sin poder llevarse ninguna rutina.
  const [showCopyModal, setShowCopyModal] = useState(false);
  const handleCopy = () => {
    setShowCopyModal(false);
    if (!routine || !ownerId) return;
    const copy = duplicateRoutine(
      linkPublicRoutine(routine, ownerId, displayAuthor),
      state.routines.map((r) => r.name)
    );
    dispatch({ type: 'ADD_ROUTINE', payload: copy });
    setToast({
      message: t('Copiada como "{name}"', { name: copy.name }),
      type: 'success',
    });
  };

  const handleSave = () => {
    if (!routine || !ownerId) return;
    // Sin cuenta no hay sync, y la rutina enlazada vive del sync.
    if (!user) {
      setToast({
        message: t('Crea una cuenta para añadir rutinas'),
        type: 'error',
        action: 'sign-in',
      });
      return;
    }
    setSaving(true);
    try {
      const linked = linkPublicRoutine(routine, ownerId, displayAuthor);
      dispatch({ type: 'ADD_ROUTINE', payload: linked });
      setToast({ message: t('Añadida a tus rutinas'), type: 'success' });
    } catch (e) {
      setToast({ message: (e as Error).message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Comentarios y las fichas de quienes los escribieron (una consulta por lote
  // para todo el hilo, no una por comentario).
  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const rows = await getRoutineComments(routineId);
      setComments(rows);
      const authors = await getProfilesByIds(rows.map((c) => c.user_id));
      setCommentAuthors(authors);
    } catch {
      // Sin red o sin la tabla creada todavía: el hilo se queda vacío, pero la
      // rutina se sigue viendo entera.
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [routineId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Lo que ya reportaste no vuelve a aparecerte.
  useEffect(() => {
    let alive = true;
    loadHiddenIds().then((ids) => {
      if (alive) setHiddenIds(new Set(ids));
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleReport = async (reason: string) => {
    const target = reportTarget;
    if (!target) return;
    if (!user) {
      setReportTarget(null);
      setToast({
        message: t('Crea una cuenta para reportar'),
        type: 'error',
        action: 'sign-in',
      });
      return;
    }
    setReporting(true);
    try {
      await reportContent(user.id, target.type, target.id, reason);
      setHiddenIds(await hideId(target.id));
      setToast({
        message: t('Gracias, lo revisaremos'),
        type: 'success',
      });
    } catch (e) {
      setToast({ message: (e as Error).message, type: 'error' });
    } finally {
      setReporting(false);
      setReportTarget(null);
    }
  };

  const commentAuthorName = (userId: string) =>
    commentAuthors.get(userId)?.display_name?.trim() || t('Anónimo');

  // Borra el autor del comentario y, como moderación mínima de su propio hilo,
  // el dueño de la rutina. La RLS aplica la misma regla en el servidor.
  const canDeleteComment = (comment: RoutineComment) =>
    !!user && (comment.user_id === user.id || user.id === ownerId);

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    if (!user) {
      setToast({
        message: t('Crea una cuenta para comentar'),
        type: 'error',
        action: 'sign-in',
      });
      return;
    }
    setSendingComment(true);
    try {
      const created = await addRoutineComment(routineId, user.id, text);
      setComments((previous) => [...previous, created]);
      setCommentText('');
      // Mi propia ficha, para que el comentario recién enviado salga con mi
      // nombre y mi foto sin volver a pedir los perfiles del hilo.
      setCommentAuthors((previous) => {
        if (previous.has(user.id)) return previous;
        const next = new Map(previous);
        next.set(user.id, {
          id: user.id,
          display_name: myProfile?.display_name ?? null,
          avatar_url: myProfile?.avatar_url ?? null,
        });
        return next;
      });
    } catch (e) {
      setToast({ message: (e as Error).message, type: 'error' });
    } finally {
      setSendingComment(false);
    }
  };

  const handleDeleteComment = async () => {
    const id = commentToDeleteId;
    setCommentToDeleteId(null);
    if (!id) return;
    const previous = comments;
    setComments((rows) => rows.filter((c) => c.id !== id));
    try {
      await deleteRoutineComment(id);
    } catch (e) {
      setComments(previous);
      setToast({ message: (e as Error).message, type: 'error' });
    }
  };

  const toggleDay = (dayId: string) =>
    setExpandedDayIds((previous) => {
      const next = new Set(previous);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });

  // Los comentarios que reportaste desaparecen de tu hilo sin esperar a que
  // nadie revise el parte.
  const visibleComments = comments.filter(
    (comment) => !hiddenIds.has(comment.id)
  );

  const savedRoutine = findSavedRoutine(state.routines, routineId);
  const saved = !!savedRoutine;
  // Quitarla solo si es el ENLACE (no una copia tuya, que ya es otra rutina) y
  // no tiene entrenamientos: con historial rige la misma regla que en Rutinas,
  // donde no se puede borrar. En ese caso el botón queda como estado.
  const canUnsave =
    !!savedRoutine &&
    isLinkedRoutine(savedRoutine) &&
    !state.logs.some((log) => log.routineId === savedRoutine.id);
  const handleUnsave = () => {
    if (!savedRoutine) return;
    dispatch({ type: 'DELETE_ROUTINE', payload: savedRoutine.id });
    setToast({ message: t('Quitada de tus rutinas'), type: 'success' });
  };

  const totalSets = routine ? countRoutineSets(routine) : 0;
  const level = routineIntensity(totalSets);

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
            paddingBottom: backButtonSpace + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera: quién la hizo, de qué va y cuánto pesa la semana. La
            intensidad va arriba a la derecha, junto al nombre, como en la
            tarjeta del tablón y en Rutinas. */}
        <View style={styles.infoBlock}>
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.infoHead}>
            <Text style={styles.infoName}>{routine?.name ?? name}</Text>
            {!!routine && <RoutineIntensityPill level={level} />}
          </View>
          {/* La firma lleva al perfil de quien la hizo: si la rutina gusta, lo
              siguiente que se quiere es ver qué más tiene y seguirle. */}
          {!!displayAuthor && (
            <Pressable
              style={({ pressed }) => [
                styles.authorRow,
                pressed && styles.pressed,
              ]}
              onPress={() => ownerId && onOpenProfile?.(ownerId, displayAuthor)}
              disabled={!ownerId || !onOpenProfile}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('Ver perfil de {name}', {
                name: displayAuthor,
              })}
            >
              <Avatar uri={author?.avatarUrl ?? null} size={26} />
              <Text style={styles.author} numberOfLines={1}>
                {t('por {name}', { name: displayAuthor })}
              </Text>
              {!!ownerId && !!onOpenProfile && (
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              )}
            </Pressable>
          )}
          {!!routine?.description && (
            <Text style={styles.description}>{routine.description}</Text>
          )}
          {/* Pie como el de la tarjeta del tablón: los datos (días y series)
              como burbujas a la izquierda —se tocan y explican qué miden— y, a
              la derecha, el mismo par de acciones. Aquí el marcador además
              QUITA la rutina si ya estaba enlazada y sin historial. */}
          {!!routine && (
            <View style={styles.metaRow}>
              <StatBubble
                icon="calendar-outline"
                value={routine.days.length}
                label={
                  routine.days.length === 1
                    ? t('1 día')
                    : t('{n} días', { n: routine.days.length })
                }
                explanation={daysExplanation()}
              />
              <StatBubble
                icon="repeat"
                value={totalSets}
                label={
                  totalSets === 1
                    ? t('1 serie')
                    : t('{n} series', { n: totalSets })
                }
                explanation={seriesExplanation()}
              />
              <View style={styles.metaSpacer} />
              {!!ownerId && (
                <>
                  <SaveRoutineButton
                    saved={saved}
                    busy={saving}
                    onPress={handleSave}
                    onUnsave={canUnsave ? handleUnsave : undefined}
                  />
                  <LikeButton
                    likes={likeInfo.likes}
                    liked={likeInfo.liked}
                    onPress={handleToggleLike}
                  />
                </>
              )}
            </View>
          )}
          {/* Peldaño que despliega/pliega la lista de días (con la animación
              de altura de las semanas de Inicio). */}
          {!!routine && (
            <Pressable
              style={({ pressed }) => [
                styles.daysToggle,
                pressed && styles.pressed,
              ]}
              onPress={() => setDaysOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: daysOpen }}
              accessibilityLabel={
                daysOpen
                  ? t('Ocultar días de ejercicio')
                  : t('Ver días de ejercicio')
              }
            >
              <MaterialCommunityIcons
                name={daysOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.primary}
              />
              <Text style={styles.daysToggleText}>
                {daysOpen
                  ? t('Ocultar días de ejercicio')
                  : t('Ver días de ejercicio')}
              </Text>
            </Pressable>
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
          <Collapsible open={daysOpen}>
            <View style={styles.daysList}>
              {routine?.days.map((day) => {
                const accent = getTrainingAccent(day);
                const expanded = expandedDayIds.has(day.id);
                const count = day.exercises.length;

                return (
                  <Animated.View
                    key={day.id}
                    layout={layoutTransition}
                    style={[styles.dayBlock, { borderColor: accent }]}
                  >
                    <GradientFill accent={accent} />
                    <Pressable
                      style={({ pressed }) => [
                        styles.dayHeader,
                        // Plegado, la cabecera ES la tarjeta: sin hueco por debajo.
                        !expanded && styles.dayHeaderCollapsed,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => toggleDay(day.id)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        expanded ? t('Plegar día') : t('Desplegar día')
                      }
                    >
                      <View style={styles.dayHeaderLeft}>
                        <DayAccentIcon
                          emoji={day.emoji}
                          name={day.name}
                          size={32}
                        />
                        <View style={styles.dayTitleWrap}>
                          {/* El número del día como ceja, no como badge suelto
                          arriba a la derecha: es la referencia, no el titular. */}
                          <Text style={styles.dayEyebrow}>
                            {t('Día')} {day.dayNumber}
                          </Text>
                          <Text style={styles.dayName} numberOfLines={2}>
                            {getDisplayDayName(day.name) ||
                              `${t('Día')} ${day.dayNumber}`}
                          </Text>
                        </View>
                      </View>

                      {/* Plegado, lo único que se dice del contenido: cuántos
                      ejercicios trae. */}
                      {!expanded && (
                        <Text style={styles.dayCount} numberOfLines={1}>
                          {count === 1
                            ? t('1 ejercicio')
                            : t('{n} ejercicios', { n: count })}
                        </Text>
                      )}
                    </Pressable>

                    {/* Las mismas casillas que el modo lectura de una rutina
                        propia: GIF grande, nombre y plan de series. */}
                    {expanded && (
                      <Animated.View entering={fadeIn} exiting={fadeOut}>
                        <ExerciseTileGrid
                          exercises={day.exercises}
                          accent={accent}
                        />
                      </Animated.View>
                    )}

                    {/* Peldaño de pliegue al pie de la tarjeta: la MISMA barra con
                    chevron que cierra los días de una rutina propia. */}
                    <Pressable
                      style={({ pressed }) => [
                        styles.collapseBar,
                        pressed && styles.collapseBarPressed,
                      ]}
                      onPress={() => toggleDay(day.id)}
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
            </View>
          </Collapsible>
        )}

        {/* Hilo de comentarios: va al pie, después del plan. Se pregunta por la
            rutina que se acaba de leer, así que primero el plan y luego la
            conversación sobre él. */}
        {!error && (
          <View style={styles.commentsBlock}>
            <View style={styles.commentsHeader}>
              <MaterialCommunityIcons
                name="comment-multiple-outline"
                size={18}
                color={theme.colors.text}
              />
              <Text style={styles.commentsTitle}>
                {visibleComments.length === 1
                  ? t('1 comentario')
                  : t('{n} comentarios', { n: visibleComments.length })}
              </Text>
            </View>

            {loadingComments ? (
              <Text style={styles.muted}>{t('Cargando…')}</Text>
            ) : visibleComments.length === 0 ? (
              <Text style={styles.muted}>
                {t('Todavía no hay comentarios. Rompe el hielo.')}
              </Text>
            ) : (
              visibleComments.map((comment) => (
                <View key={comment.id} style={styles.commentRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.commentWho,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      onOpenProfile?.(
                        comment.user_id,
                        commentAuthorName(comment.user_id)
                      )
                    }
                    disabled={!onOpenProfile}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={t('Ver perfil de {name}', {
                      name: commentAuthorName(comment.user_id),
                    })}
                  >
                    <Avatar
                      uri={
                        commentAuthors.get(comment.user_id)?.avatar_url ?? null
                      }
                      size={30}
                    />
                  </Pressable>
                  <View style={styles.commentBody}>
                    <View style={styles.commentMetaRow}>
                      <Text style={styles.commentAuthor} numberOfLines={1}>
                        {commentAuthorName(comment.user_id)}
                      </Text>
                      <Text style={styles.commentTime}>
                        {formatAgo(comment.created_at)}
                      </Text>
                    </View>
                    <Text style={styles.commentText}>{comment.body}</Text>
                  </View>
                  {/* Una sola acción por comentario: si puedes borrarlo (es tuyo
                      o es tu rutina), la papelera; si no, reportarlo. */}
                  {canDeleteComment(comment) ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.commentDelete,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => setCommentToDeleteId(comment.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('Eliminar comentario')}
                    >
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={18}
                        color={theme.colors.textSecondary}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.commentDelete,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        setReportTarget({
                          type: 'comment',
                          id: comment.id,
                          what: t('este comentario'),
                        })
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('Reportar comentario')}
                    >
                      <MaterialCommunityIcons
                        name="flag-outline"
                        size={18}
                        color={theme.colors.textMuted}
                      />
                    </Pressable>
                  )}
                </View>
              ))
            )}

            {/* Escribir. Sin sesión no se esconde la caja: se dice qué falta y
                se lleva a arreglarlo, como el resto de avisos de Comunidad. */}
            {user ? (
              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder={t('Escribe un comentario')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={COMMENT_MAX_LENGTH}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.commentSend,
                    (!commentText.trim() || sendingComment) &&
                      styles.commentSendDisabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleSendComment}
                  disabled={!commentText.trim() || sendingComment}
                  accessibilityRole="button"
                  accessibilityLabel={t('Enviar comentario')}
                >
                  <MaterialCommunityIcons
                    name="send"
                    size={20}
                    color={theme.colors.onGold}
                  />
                </Pressable>
              </View>
            ) : (
              <Button
                title={t('Crea una cuenta para comentar')}
                variant="secondary"
                size="medium"
                onPress={() => onOpenAccount?.()}
              />
            )}
          </View>
        )}

        {/* Reportar la rutina: discreto pero visible, al pie del todo. Es
            contenido de otra persona y tiene que haber una salida. */}
        {!error && !!routine && (
          <Pressable
            style={({ pressed }) => [
              styles.reportRow,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              setReportTarget({
                type: 'routine',
                id: routineId,
                what: t('esta rutina'),
              })
            }
            accessibilityRole="button"
            accessibilityLabel={t('Reportar esta rutina')}
          >
            <MaterialCommunityIcons
              name="flag-outline"
              size={16}
              color={theme.colors.textMuted}
            />
            <Text style={styles.reportText}>{t('Reportar esta rutina')}</Text>
          </Pressable>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={routine?.name ?? name}
        icon="book-open-variant"
        subtitle={t('Rutina de la comunidad')}
        topInset={insets.top}
        onLayout={onTopBarLayout}
        menuItems={
          routine && ownerId
            ? [
                {
                  icon: 'content-copy',
                  label: t('Hacer copia'),
                  onPress: () => setShowCopyModal(true),
                },
              ]
            : undefined
        }
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          actionLabel={
            toast.action === 'sign-in' && onOpenAccount
              ? t('Crear cuenta')
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

      <ReportModal
        visible={!!reportTarget}
        what={reportTarget?.what ?? ''}
        busy={reporting}
        onCancel={() => setReportTarget(null)}
        onConfirm={handleReport}
      />

      <ConfirmModal
        visible={!!commentToDeleteId}
        icon="trash-can-outline"
        title={t('¿Eliminar el comentario?')}
        message={t('Esta acción no se puede deshacer. ¿Estás seguro?')}
        confirmLabel={t('Eliminar')}
        onConfirm={handleDeleteComment}
        onCancel={() => setCommentToDeleteId(null)}
      />

      <ConfirmModal
        visible={showCopyModal}
        icon="content-copy"
        title={t('¿Hacer una copia?')}
        message={t(
          'Se crea una copia tuya de «{name}», editable y sin cuenta. No seguirá los cambios del autor: para eso está «Añadir».',
          { name: routine?.name ?? name }
        )}
        confirmLabel={t('Hacer copia')}
        onConfirm={handleCopy}
        onCancel={() => setShowCopyModal(false)}
      />
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1 },
    content: { paddingHorizontal: theme.spacing.md, gap: 12 },
    // Los días dentro del acordeón: mismo hueco entre tarjetas que el resto
    // del scroll (el `gap` del contenido no llega dentro de `Collapsible`).
    daysList: { gap: 12 },
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
    // Nombre + intensidad arriba a la derecha. Alineados arriba para que, con
    // un nombre a dos líneas, la píldora acompañe a la primera.
    infoHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    // Peldaño que abre/cierra la lista de días, al pie de la cabecera.
    daysToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 6,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
    },
    daysToggleText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.primary,
      lineHeight: 17,
    },
    infoName: {
      flex: 1,
      fontSize: 22,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 31,
    },
    // La firma es una fila pulsable (foto + "por X" + chevron), no un rótulo.
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingVertical: 2,
    },
    author: { color: theme.colors.textMuted, fontSize: 13 },
    pressed: { opacity: 0.7 },
    description: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 19,
    },
    // Pie de la ficha: burbujas de dato a la izquierda, acciones a la derecha,
    // el mismo dibujo que la tarjeta del tablón.
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    metaSpacer: { flex: 1 },
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
    // Con el día plegado la cabecera es toda la tarjeta: el hueco de debajo lo
    // pone el propio peldaño de pliegue.
    dayHeaderCollapsed: {
      marginBottom: -10,
    },
    dayHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    dayTitleWrap: {
      flex: 1,
      minWidth: 0,
    },
    // "Día 3" como ceja: la referencia, no el titular (igual que en la ficha de
    // una rutina propia).
    dayEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
      lineHeight: 14,
    },
    dayName: {
      fontSize: 18,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 25,
    },
    dayCount: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    // Peldaño del pliegue al pie del bloque: los márgenes negativos valen el
    // padding del bloque (theme.spacing.md), así que la barra llega a los tres
    // bordes y hace de filo inferior de la tarjeta.
    collapseBar: {
      // Sin margen propio: el hueco lo pone el `gap` del bloque de día.
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
    // Hilo de comentarios al pie de la ficha.
    commentsBlock: {
      marginTop: 4,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: 12,
      ...theme.shadow.soft,
    },
    commentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    commentsTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    commentWho: { paddingTop: 2 },
    commentBody: { flex: 1, minWidth: 0, gap: 2 },
    commentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    commentAuthor: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text,
    },
    commentTime: { fontSize: 12, color: theme.colors.textMuted },
    commentText: {
      fontSize: 15,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },
    commentDelete: { paddingTop: 4 },
    commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    commentInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.colors.text,
      backgroundColor: theme.colors.inputBg,
      textAlignVertical: 'top',
    },
    commentSend: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryFill,
    },
    commentSendDisabled: { opacity: 0.45 },
    // Reportar: visible pero sin peso, al pie del todo.
    reportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
    },
    reportText: { color: theme.colors.textMuted, fontSize: 13 },
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
