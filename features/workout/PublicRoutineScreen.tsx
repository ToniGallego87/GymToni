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
  ConfirmModal,
  DayAccentIcon,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  ReportModal,
  RoutineIntensityPill,
  SaveRoutineButton,
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
  findSavedRoutine,
  linkPublicRoutine,
  routineIntensity,
} from '@lib/routines';
import { useSession } from '@lib/cloud/auth';
import { useMyProfile } from '@hooks/useMyProfile';
import {
  addRoutineComment,
  COMMENT_MAX_LENGTH,
  deleteRoutineComment,
  fetchPublicRoutine,
  getProfile,
  getProfilesByIds,
  getRoutineComments,
  reportContent,
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
  // Días desplegados. La rutina ajena nace PLEGADA entera, igual que la ficha de
  // una rutina propia: de un vistazo se ve cuántos días trae y cuántos
  // ejercicios cada uno, en vez de un rollo de 30 ejercicios que obliga a
  // hacer scroll para saber si hay un cuarto día.
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

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: floatingBackBottom } = getFloatingBackButtonMetrics(
    insets.bottom
  );
  const backButtonSpace = FLOATING_BACK_BUTTON_HEIGHT + floatingBackBottom;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchPublicRoutine(routineId);
      if (!fetched) {
        setError(t('Esta rutina ya no está disponible'));
        return;
      }
      setRoutine(fetched);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useEffect(() => {
    load();
  }, [load]);

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
  const handleSave = () => {
    if (!routine || !ownerId) return;
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
        message: t('Inicia sesión para reportar'),
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
        message: t('Inicia sesión para comentar'),
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

  const saved = !!findSavedRoutine(state.routines, routineId);

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
            paddingTop: topBarHeight + 28,
            paddingBottom: backButtonSpace + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera: quién la hizo, de qué va y cuánto pesa la semana. */}
        <View style={styles.infoBlock}>
          <GradientFill accent={theme.colors.primaryLine} />
          <Text style={styles.infoName}>{routine?.name ?? name}</Text>
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
          {!!routine && (
            <View style={styles.metaRow}>
              <RoutineIntensityPill level={level} />
              <Text style={styles.metaText}>
                {routine.days.length === 1
                  ? t('1 día')
                  : t('{n} días', { n: routine.days.length })}
                {' · '}
                {totalSets === 1
                  ? t('1 serie')
                  : t('{n} series', { n: totalSets })}
              </Text>
            </View>
          )}
          {/* Quedarse la rutina es lo ÚNICO que se viene a decidir aquí, así que
              va con su rótulo y a lo ancho de la cabecera. En el tablón sigue
              siendo un icono suelto: allí hay una por tarjeta y no sobra ancho,
              aquí solo hay una y un marcador sin texto no dice qué hace. */}
          {!!routine && !!ownerId && (
            <SaveRoutineButton
              saved={saved}
              busy={saving}
              onPress={handleSave}
              withLabel
              style={styles.saveButton}
            />
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
          routine?.days.map((day) => {
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

                {/* Mismo listado que el modo lectura de una rutina propia:
                    punto de acento, el ejercicio en tinta primaria y el plan de
                    series apartado a la derecha. */}
                {expanded && (
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
          })
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
                title={t('Inicia sesión para comentar')}
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
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

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
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1 },
    content: { paddingHorizontal: theme.spacing.md, gap: 12 },
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
    // Guardar, a lo ancho de la cabecera: es la acción de la pantalla.
    saveButton: {
      alignSelf: 'stretch',
      justifyContent: 'center',
      paddingVertical: 10,
      marginTop: 6,
    },
    infoName: {
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
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    metaText: { color: theme.colors.textSecondary, fontSize: 13 },
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
    exerciseList: { gap: 8 },
    exerciseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    exerciseDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    // Los ejercicios SON el contenido de la ficha: tinta primaria y su
    // interlineado, como en una rutina propia.
    exerciseText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      color: theme.colors.text,
    },
    exerciseSets: {
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 22,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
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
