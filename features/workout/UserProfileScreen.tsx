import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  LevelPill,
  LoadMoreButton,
  PublicRoutineCard,
  ReportModal,
  SectionLegend,
  SegmentedFilter,
  ActivityList,
  Toast,
  StretchScrollView,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import { findSavedRoutine } from '@lib/routines';
import { animateLayout } from '@lib/layoutAnimation';
import { hideId } from '@lib/moderation';
import { useSession } from '@lib/cloud/auth';
import {
  getProfile,
  getUserPublicRoutines,
  getFollowerCount,
  getRoutineSetTotals,
  getCommentCounts,
  getLikeInfo,
  likeRoutine,
  unlikeRoutine,
  isFollowing,
  followUser,
  unfollowUser,
  linkablePublicRoutine,
  reportContent,
  Profile,
  PublicRoutineSummary,
} from '@lib/cloud/social';
import { getActivity, getActivityCounts } from '@lib/cloud/activity';
import { readSocialCache, writeSocialCache } from '@lib/socialCache';
import { useAccountLevel } from '@hooks/useAccountLevel';
import { ActivityItem, ActivityCounts } from '@lib/activity';

interface UserProfileScreenProps {
  userId: string;
  name: string;
  onBack: () => void;
  // Abre una rutina pública en solo lectura (mismo destino que el tablón).
  onOpenRoutine?: (routineId: string, name: string, authorName: string) => void;
  // Pantalla de cuenta (Datos y nube): destino del aviso de "inicia sesión".
  onOpenAccount?: () => void;
  // Perfil propio (donde se edita): única acción cuando este perfil eres tú.
  onOpenOwnProfile?: () => void;
}

/**
 * Lo último que se trajo de cada perfil visitado, para que volver de una rutina
 * no cueste otra ronda de siete consultas y otro parpadeo de esqueletos: se
 * pinta al instante y se refresca por detrás. Mismo patrón que el `boardCache`
 * del tablón. Vive en el módulo (no en el estado) porque la navegación desmonta
 * la pantalla a cada salto, y además se guarda en disco (lib/socialCache.ts):
 * esta copia muere al cerrar la app, y cada arranque volvía a esperar a la red
 * para enseñar un perfil ya visto.
 */
const profileCache = new Map<
  string,
  {
    profile: Profile | null;
    routines: PublicRoutineSummary[];
    followers: number;
    following: boolean;
    activity: ActivityItem[];
    activityMore: boolean;
    counts: ActivityCounts | null;
  }
>();

type CachedProfile = NonNullable<ReturnType<typeof profileCache.get>>;

/** Guarda en la caché lo que acaba de llegar, sin pisar lo que no viene. */
function cacheMerge(userId: string, patch: Partial<CachedProfile>): void {
  profileCache.set(userId, {
    profile: null,
    routines: [],
    followers: 0,
    following: false,
    activity: [],
    activityMore: false,
    counts: null,
    ...profileCache.get(userId),
    ...patch,
  });
  const entry = profileCache.get(userId);
  if (entry) writeSocialCache(`profile_${userId}`, entry);
}

/**
 * Siembra la caché en memoria con la copia de disco del último arranque. Devuelve
 * lo sembrado para poder pintarlo ya; si no hay copia (o caducó), null.
 */
async function hydrateProfileCache(
  userId: string
): Promise<CachedProfile | null> {
  if (profileCache.has(userId)) return profileCache.get(userId) ?? null;
  const stored = await readSocialCache<CachedProfile>(`profile_${userId}`);
  if (!stored) return null;
  profileCache.set(userId, stored);
  return stored;
}

/** "12 insignias · 34 retos · 128 días", saltando lo que esté a cero. */
function activityCountsLabel(counts: ActivityCounts): string {
  const { badges, challenges, days } = counts;
  return [
    badges > 0 &&
      (badges === 1 ? t('1 insignia') : t('{n} insignias', { n: badges })),
    challenges > 0 &&
      (challenges === 1 ? t('1 reto') : t('{n} retos', { n: challenges })),
    days > 0 && (days === 1 ? t('1 día') : t('{n} días', { n: days })),
  ]
    .filter(Boolean)
    .join(' · ');
}

// Perfil público de otro usuario (Fase 4): nombre, bio, seguidores, botón de
// seguir y sus rutinas públicas (adoptables). Solo lectura de lo ajeno.
export function UserProfileScreen({
  userId,
  name,
  onBack,
  onOpenRoutine,
  onOpenAccount,
  onOpenOwnProfile,
}: UserProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const { user, loading: sessionLoading } = useSession();
  const isSelf = user?.id === userId;
  // Nivel local (lo que ve Perfil): solo se usa si este perfil eres tú.
  const { level: localLevel } = useAccountLevel();

  // Lo que ya se trajo de este perfil, si se ha visitado antes: se pinta de
  // entrada y se refresca por detrás (ver `profileCache`).
  const cached = profileCache.get(userId);
  const [profile, setProfile] = useState<Profile | null>(
    () => cached?.profile ?? null
  );
  const [routines, setRoutines] = useState<PublicRoutineSummary[]>(
    () => cached?.routines ?? []
  );
  // `null` mientras no se sabe: la cabecera no puede afirmar "0 seguidores"
  // antes de haber preguntado (ver `followersLabel`).
  const [followers, setFollowers] = useState<number | null>(
    () => cached?.followers ?? null
  );
  // `null` mientras no se sabe, igual que `followers`: nacía en `false` y el
  // botón enseñaba "Seguir" en oro a quien YA seguías, así que tocarlo en ese
  // instante ejecutaba un unfollow creyendo empezar a seguir.
  const [following, setFollowing] = useState<boolean | null>(
    () => cached?.following ?? null
  );
  const [loading, setLoading] = useState(!cached);
  // Qué sección se enseña. Las dos se apilaban, así que con unas cuantas
  // rutinas la actividad quedaba a un scroll largo de distancia y no se
  // encontraba; ahora se turnan en el mismo sitio, bajo la tarjeta.
  const [section, setSection] = useState<'routines' | 'activity'>('routines');
  // Actividad: los hitos de esta persona (insignias, retos y días entrenados),
  // paginados. Vacía = no la comparte (o no tiene), y entonces no hay pestaña.
  const [activity, setActivity] = useState<ActivityItem[]>(
    () => profileCache.get(userId)?.activity ?? []
  );
  const [activityMore, setActivityMore] = useState(
    () => profileCache.get(userId)?.activityMore ?? false
  );
  // Totales de verdad (los cuenta el servidor): lo que rotula la cabecera.
  const [activityCounts, setActivityCounts] = useState<ActivityCounts | null>(
    () => profileCache.get(userId)?.counts ?? null
  );
  const [loadingActivity, setLoadingActivity] = useState(
    () => !profileCache.has(userId)
  );
  // Series, comentarios y likes de las rutinas: llegan tras el primer pintado,
  // y mientras tanto las tarjetas reservan su hueco en vez de crecer al llegar.
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [busyFollow, setBusyFollow] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Reportar el perfil: null = cerrado, 'open' = preguntando, 'busy' = enviando.
  const [reporting, setReporting] = useState<'open' | 'busy' | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    // Aviso con salida: "inicia sesión para…" lleva a la pantalla de cuenta.
    action?: 'sign-in';
  } | null>(null);

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  // Misma altura del "Volver" que el resto de pantallas.
  const { bottom: floatingBackBottom } = getFloatingBackButtonMetrics(
    insets.bottom
  );
  const backButtonSpace = FLOATING_BACK_BUTTON_HEIGHT + floatingBackBottom;

  const notify = (message: string, type: 'success' | 'error') =>
    setToast({ message, type });

  // El aviso de sesión no se queda en el reproche: lleva a la cuenta.
  const notifySignIn = (message: string) =>
    setToast({ message, type: 'error', action: 'sign-in' });

  const load = useCallback(async () => {
    // Con datos ya en pantalla (de la caché) el refresco es silencioso: poner
    // `loading` otra vez devolvería los esqueletos sobre datos buenos. Si en
    // memoria no hay nada, se intenta la copia de disco antes de rendirse.
    const stored = await hydrateProfileCache(userId);
    if (stored) {
      setProfile(stored.profile);
      setRoutines(stored.routines);
      setFollowers(stored.followers);
      setFollowing(stored.following);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const [prof, routs, follc, foll] = await Promise.all([
        getProfile(userId),
        getUserPublicRoutines(userId),
        getFollowerCount(userId),
        // Sin sesión resuelta no se puede saber si le sigues: se deja en
        // `null` (el botón espera) en vez de afirmar que no.
        sessionLoading
          ? Promise.resolve(null)
          : user && user.id !== userId
          ? isFollowing(user.id, userId)
          : Promise.resolve(false),
      ]);
      setProfile(prof);
      setRoutines(routs);
      setFollowers(follc);
      if (foll !== null) setFollowing(foll);
      cacheMerge(userId, {
        profile: prof,
        routines: routs,
        followers: follc,
        ...(foll !== null ? { following: foll } : {}),
      });
      // Series y comentarios de cada rutina (intensidad y recuento del hilo) y
      // sus likes: lo mismo que enseña el tablón, para que la rutina se vea
      // igual por las dos puertas. Van DESPUÉS de pintar y, si fallan, las
      // tarjetas se quedan sin esos datos pero enteras.
      if (routs.length) {
        setLoadingMeta(true);
        const ids = routs.map((r) => r.id);
        const [totals, commentCounts, likes] = await Promise.all([
          getRoutineSetTotals(ids).catch(() => new Map<string, number>()),
          getCommentCounts(ids).catch(() => new Map<string, number>()),
          getLikeInfo(ids, user?.id ?? null).catch(
            () => new Map<string, { likes: number; liked: boolean }>()
          ),
        ]);
        const withMeta = routs.map((r) => ({
          ...r,
          total_sets: totals.get(r.id),
          comments: commentCounts.get(r.id),
          likes: likes.get(r.id)?.likes ?? 0,
          liked_by_me: !!likes.get(r.id)?.liked,
        }));
        setRoutines(withMeta);
        cacheMerge(userId, { routines: withMeta });
        setLoadingMeta(false);
      }
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id, sessionLoading]);

  // La actividad va por su cuenta: es la sección de abajo y no debe retrasar la
  // cabecera ni las rutinas. Si la tabla no existe todavía (SQL sin ejecutar) o
  // la RLS no deja leerla, la sección simplemente no aparece.
  const loadActivity = useCallback(async () => {
    const stored = await hydrateProfileCache(userId);
    if (stored?.activity.length) {
      setActivity(stored.activity);
      setActivityMore(stored.activityMore);
      setActivityCounts(stored.counts);
      setLoadingActivity(false);
    } else {
      setLoadingActivity(true);
    }
    try {
      // Los totales los cuenta el servidor: contar lo cargado daría el tamaño
      // de la página y cambiaría a cada "Cargar más".
      const [{ items, hasMore }, counts] = await Promise.all([
        getActivity(userId),
        getActivityCounts(userId),
      ]);
      setActivity(items);
      setActivityMore(hasMore);
      setActivityCounts(counts);
      cacheMerge(userId, { activity: items, activityMore: hasMore, counts });
    } catch {
      setActivity([]);
      setActivityMore(false);
      setActivityCounts(null);
    } finally {
      setLoadingActivity(false);
    }
  }, [userId]);

  const loadMoreActivity = async () => {
    try {
      const { items, hasMore } = await getActivity(userId, {
        offset: activity.length,
      });
      setActivity((prev) => {
        const next = [...prev, ...items];
        cacheMerge(userId, { activity: next, activityMore: hasMore });
        return next;
      });
      setActivityMore(hasMore);
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const handleToggleFollow = async () => {
    if (!user) {
      notifySignIn(t('Crea una cuenta para seguir'));
      return;
    }
    const next = !following;
    setBusyFollow(true);
    setFollowing(next);
    setFollowers((n) => (n == null ? n : n + (next ? 1 : -1)));
    try {
      if (next) await followUser(user.id, userId);
      else await unfollowUser(user.id, userId);
    } catch (e) {
      setFollowing(!next);
      setFollowers((n) => (n == null ? n : n + (next ? -1 : 1)));
      notify((e as Error).message, 'error');
    } finally {
      setBusyFollow(false);
    }
  };

  const displayName = profile?.display_name || name;

  const handleReport = async (reason: string) => {
    if (!user) {
      setReporting(null);
      notifySignIn(t('Crea una cuenta para reportar'));
      return;
    }
    setReporting('busy');
    try {
      await reportContent(user.id, 'profile', userId, reason);
      await hideId(userId);
      notify(t('Gracias, lo revisaremos'), 'success');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setReporting(null);
    }
  };

  // Las rutinas de este perfil que siguen siendo públicas: solo esas se enlazan
  // desde la actividad (una rutina puede haberse retirado del tablón después de
  // que el día se publicara, y entonces el enlace no llevaría a ninguna parte).
  // Hay actividad que enseñar: lo que decide si existe la pestaña. Mientras
  // carga no se da por hecho que no hay (si no, el conmutador aparecería de
  // golpe un segundo después y movería la lista bajo el dedo).
  // El nivel que se enseña: el propio se calcula aquí (local), el ajeno es el
  // que su dueño subió al perfil.
  const shownLevel = isSelf ? localLevel.level : profile?.level;
  const hasActivity = loadingActivity || activity.length > 0;
  // Sin pestaña de actividad, las rutinas se enseñan siempre.
  const showRoutines = !hasActivity || section === 'routines';

  const publicRoutineIds = useMemo(
    () => new Set(routines.map((r) => r.id)),
    [routines]
  );

  // Like de una rutina desde el perfil: antes solo se podía dar entrando por el
  // tablón. Optimista, con vuelta atrás si falla (igual que en Comunidad).
  const handleToggleLike = async (routine: PublicRoutineSummary) => {
    if (!user) {
      notifySignIn(t('Crea una cuenta para dar like'));
      return;
    }
    const liked = !!routine.liked_by_me;
    const apply = (value: boolean) =>
      setRoutines((prev) =>
        prev.map((r) =>
          r.id === routine.id
            ? {
                ...r,
                liked_by_me: value,
                likes: Math.max(0, (r.likes ?? 0) + (value ? 1 : -1)),
              }
            : r
        )
      );
    apply(!liked);
    try {
      if (liked) await unlikeRoutine(routine.id, user.id);
      else await likeRoutine(routine.id, user.id);
    } catch (e) {
      apply(liked);
      notify((e as Error).message, 'error');
    }
  };

  // Añadir enlaza la rutina de esta persona (no la copia): se entrena tal cual
  // y sigue siendo suya. La copia se saca luego, al querer editarla.
  const handleSave = async (routineId: string) => {
    // Sin cuenta no hay sync, y la rutina enlazada vive del sync.
    if (!user) {
      notifySignIn(t('Crea una cuenta para añadir rutinas'));
      return;
    }
    setSavingId(routineId);
    try {
      const linked = await linkablePublicRoutine(
        routineId,
        userId,
        displayName
      );
      if (!linked) {
        notify(t('Esta rutina ya no está disponible'), 'error');
        return;
      }
      dispatch({ type: 'ADD_ROUTINE', payload: linked });
      notify(t('Añadida a tus rutinas'), 'success');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setSavingId(null);
    }
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
            paddingBottom: backButtonSpace + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* La identidad es la ÚNICA tarjeta dorada de la pantalla: sus rutinas
            y su actividad van en superficie neutra. Antes las tres llevaban el
            mismo gradiente y la persona no pesaba más que su tercera rutina.
            El nombre no se repite aquí: vive en la barra superior, que es fija
            y siempre visible. */}
        <View style={styles.card}>
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.headerRow}>
            <Avatar uri={profile?.avatar_url} size={72} loading={loading} />
            <View style={styles.headerInfo}>
              <View style={styles.metaRow}>
                {/* Mientras no se sabe, un hueco del alto del texto en vez de
                    "0 seguidores": ese 0 no es un estado de carga, es una
                    afirmación falsa sobre una persona. */}
                {followers == null ? (
                  <View style={styles.followersSkeleton} />
                ) : (
                  <Text style={styles.followers}>
                    {followers === 1
                      ? t('1 seguidor')
                      : t('{n} seguidores', { n: followers })}
                  </Text>
                )}
                {/* En tu propio perfil, el nivel LOCAL: es la verdad del
                    dispositivo, y la columna de la nube puede ir atrasada (se
                    sube al superar un reto y no se reintenta hasta el
                    siguiente), así que Perfil y esta pantalla enseñaban números
                    distintos a un toque de distancia. */}
                {!!shownLevel && <LevelPill level={shownLevel} />}
              </View>
              {isSelf && (
                <Text style={styles.selfHint}>{t('Así te ve la gente')}</Text>
              )}
            </View>
          </View>

          {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          {isSelf ? (
            // Tu propio perfil no se sigue ni se reporta, así que sin esto se
            // quedaba sin una sola acción. Editar vive en Perfil: se lleva allí.
            !!onOpenOwnProfile && (
              <Button
                title={t('Editar perfil')}
                onPress={onOpenOwnProfile}
                variant="secondary"
              />
            )
          ) : following == null ? (
            // Hueco del alto del botón mientras no se sabe si ya le sigues: un
            // "Seguir" en oro que en realidad haría unfollow es peor que esperar.
            <View style={styles.followSkeleton} />
          ) : (
            <Button
              title={
                busyFollow
                  ? t('Guardando…')
                  : following
                  ? t('Siguiendo')
                  : t('Seguir')
              }
              onPress={handleToggleFollow}
              variant={following ? 'secondary' : 'primary'}
              disabled={busyFollow}
            />
          )}
        </View>

        {/* Rutinas y Actividad se turnan en el mismo sitio. Apiladas, con unas
            cuantas rutinas la actividad quedaba a un scroll largo y no se
            encontraba. El conmutador solo aparece si hay las dos cosas: con una
            sola, dos pestañas para un destino serían ruido. */}
        {hasActivity && (
          <SegmentedFilter
            options={[
              {
                id: 'routines',
                label: t('Rutinas'),
                icon: 'clipboard-text-outline',
              },
              { id: 'activity', label: t('Actividad'), icon: 'timeline-text-outline' },
            ]}
            value={section}
            onChange={(id) => {
              animateLayout();
              setSection(id as 'routines' | 'activity');
            }}
          />
        )}

        {showRoutines && (
          <>
            {/* La misma cabecera de sección que los historiales de Inicio y
                Cardio, con el recuento en su rótulo derecho. */}
            {/* Con el conmutador delante, la pestaña activa ya dice dónde
                estás: la cabecera se queda solo con el recuento. */}
            <SectionLegend
              title={hasActivity ? undefined : t('Rutinas públicas')}
              hint={
                loading || routines.length === 0
                  ? undefined
                  : routines.length === 1
                  ? t('1 rutina')
                  : t('{n} rutinas', { n: routines.length })
              }
            />

            {loading ? (
              <Text style={styles.muted}>{t('Cargando…')}</Text>
            ) : routines.length === 0 ? (
              <Text style={styles.muted}>
                {t('Este usuario no tiene rutinas públicas.')}
              </Text>
            ) : (
              routines.map((r) => (
                // La misma tarjeta que el tablón, sin la firma del autor
                // (sobra: estás en su perfil). Trae intensidad, series,
                // comentarios y "me gusta", que antes solo existían entrando
                // por el tablón.
                <PublicRoutineCard
                  key={r.id}
                  item={r}
                  saved={!!findSavedRoutine(state.routines, r.id)}
                  savingBusy={savingId === r.id}
                  loadingMeta={loadingMeta}
                  onPress={
                    onOpenRoutine
                      ? () => onOpenRoutine(r.id, r.name, displayName)
                      : undefined
                  }
                  onSave={() => handleSave(r.id)}
                  onToggleLike={() => handleToggleLike(r)}
                />
              ))
            )}
          </>
        )}

        {/* Actividad: la trayectoria de esta persona. Si no comparte nada (lo
            tiene apagado o aún no ha publicado), la RLS devuelve vacío y no hay
            ni pestaña ni sección: un "no hay nada" no se podría distinguir de
            "no lo comparte". */}
        {hasActivity && section === 'activity' && (
          <View style={styles.activitySection}>
            <SectionLegend
              title={hasActivity ? undefined : t('Actividad')}
              hint={
                activityCounts ? activityCountsLabel(activityCounts) : undefined
              }
            />
            <ActivityList
              items={activity}
              publicRoutineIds={publicRoutineIds}
              onOpenRoutine={
                onOpenRoutine
                  ? (routineId, routineName) =>
                      onOpenRoutine(routineId, routineName, displayName)
                  : undefined
              }
            />
            {activityMore && (
              <LoadMoreButton
                onPress={loadMoreActivity}
                // Cuánto queda de verdad: el total del servidor menos lo traído.
                remaining={
                  activityCounts
                    ? Math.max(0, activityCounts.total - activity.length)
                    : undefined
                }
              />
            )}
          </View>
        )}

        {/* Reportar el perfil: discreto pero visible, al pie. Es contenido de
            otra persona (nombre, bio) y tiene que haber una salida. */}
        {!isSelf && (
          <Pressable
            style={({ pressed }) => [
              styles.reportRow,
              pressed && styles.cardPressed,
            ]}
            onPress={() => setReporting('open')}
            accessibilityRole="button"
            accessibilityLabel={t('Reportar este perfil')}
          >
            <MaterialCommunityIcons
              name="flag-outline"
              size={16}
              color={theme.colors.textMuted}
            />
            <Text style={styles.reportText}>{t('Reportar este perfil')}</Text>
          </Pressable>
        )}
      </StretchScrollView>

      <ReportModal
        visible={reporting !== null}
        what={t('este perfil')}
        busy={reporting === 'busy'}
        onCancel={() => setReporting(null)}
        onConfirm={handleReport}
      />

      <GlassTopBar
        title={displayName}
        // Sin subtítulo a propósito: seguidores y nivel viven en la tarjeta,
        // junto al avatar, y repetirlos aquí era el mismo eco que el del nombre.
        icon="account-circle-outline"
        topInset={insets.top}
        onLayout={onTopBarLayout}
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
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, gap: 12 },
    card: {
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    cardPressed: { opacity: 0.85 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headerInfo: { flex: 1, minWidth: 0 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    // Hueco del alto exacto del texto de seguidores mientras no se sabe
    // cuántos son: así la cabecera no cambia de alto al llegar el dato (y el
    // botón "Seguir" no se mueve bajo el dedo).
    followersSkeleton: {
      width: 92,
      height: 15,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
    },
    // Hueco del alto exacto de un Button `medium` (paddingVertical 12 + 12 +
    // lineHeight 20 = 44) mientras no se sabe si ya le sigues.
    followSkeleton: {
      height: 44,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.border,
    },
    // "Así te ve la gente": solo en tu propio perfil, que no se sigue ni se
    // reporta y antes se quedaba sin decir que eras tú.
    selfHint: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 6,
    },
    // La actividad va algo más separada: es otra sección, con su cabecera.
    activitySection: {
      marginTop: 4,
      gap: 4,
    },
    followers: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    bio: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    muted: { color: theme.colors.textMuted, fontSize: 14 },
    // Reportar: visible pero sin peso, al pie del todo.
    reportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
    },
    reportText: { color: theme.colors.textMuted, fontSize: 13 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
