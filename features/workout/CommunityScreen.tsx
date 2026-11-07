import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  InteractionManager,
  FlatList,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  SegmentedFilter,
  PublicRoutineCard,
  PublicRoutineCardSkeleton,
  intensityColor,
  Toast,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { theme } from '@lib/theme';
import {
  findSavedRoutine,
  routineIntensity,
  RoutineIntensity,
} from '@lib/routines';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import { useSession } from '@lib/cloud/auth';
import { readSocialCache, writeSocialCache } from '@lib/socialCache';
import {
  getPopularRoutines,
  getFollowingFeed,
  getLikeInfo,
  searchProfiles,
  searchPublicRoutines,
  getProfilesByIds,
  getFollowerCount,
  likeRoutine,
  unlikeRoutine,
  linkablePublicRoutine,
  DELETED_ACCOUNT_ID,
  getRoutinePlanStats,
  getCommentCounts,
  getSaveCounts,
  recordRoutineSave,
  getFollowingCount,
  getPublicRoutineIds,
  FeedRoutine,
  ProfileLite,
} from '@lib/cloud/social';
import { hasProfileFilled, useMyProfile } from '@hooks/useMyProfile';
import { loadHiddenIds } from '@lib/moderation';
import { RoutineNews } from '@lib/communityNews';
import {
  dismissFollowersNews,
  dismissRoutineNews,
  refreshCommunityNews,
  useCommunityNews,
} from '@hooks/useCommunityNews';

interface CommunityScreenProps {
  // La pantalla se mantiene montada (keep-alive) aunque no se vea; `active` dice
  // si está a la vista, para consultar la nube solo entonces.
  active?: boolean;
  onOpenProfile?: (userId: string, name: string) => void;
  // Abre la rutina en solo lectura (sus días y ejercicios) antes de adoptarla.
  onOpenRoutine?: (
    routineId: string,
    name: string,
    authorName: string,
    ownerId: string,
    // Abrirla en sus comentarios nuevos (viene de un aviso).
    focusNewComments?: boolean
  ) => void;
  onOpenFollowing?: () => void;
  onOpenFollowers?: () => void;
  // Pantalla de cuenta (Datos y nube): destino de los avisos de "inicia sesión".
  onOpenAccount?: () => void;
}

type Tab = 'popular' | 'following';

// Fila unificada de rutina (tablón y feed comparten tarjeta). `likes` solo en el
// tablón de populares.
interface RoutineItem {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  author_name: string | null;
  likes?: number;
  liked_by_me?: boolean;
  // Series planificadas en toda la rutina. Llega en segundo plano (una consulta
  // por lote para todo el tablón), así que puede faltar en el primer pintado:
  // mientras falta, la tarjeta simplemente no lleva distintivo de intensidad.
  total_sets?: number;
  // Días de la rutina: mismo lote que las series (burbuja de la tarjeta).
  total_days?: number;
  // Comentarios del hilo de la rutina. Llega con el mismo lote que las series y
  // es solo informativo: el hilo vive en la ficha de la rutina.
  comments?: number;
  // Personas que la han añadido a sus rutinas: va junto al marcador de añadir.
  // Mismo lote que los comentarios.
  saves?: number;
}

// Caché en memoria del último tablón/feed (por pestaña), para pintar al instante
// al reabrir Comunidad y refrescar en segundo plano. Vive a nivel de módulo, así
// que sobrevive a desmontar/montar la pantalla (es una pestaña de la barra), y se
// guarda en disco (lib/socialCache.ts) porque esta copia muere con la app y cada
// arranque volvía a esperar a la red para enseñar el mismo tablón.
const boardCache: Record<
  Tab,
  { items: RoutineItem[]; avatars: Map<string, ProfileLite> } | undefined
> = { popular: undefined, following: undefined };

// El `Map` de avatares no sobrevive a JSON.stringify: se guarda como pares.
interface StoredBoard {
  items: RoutineItem[];
  avatars: [string, ProfileLite][];
}

function storeBoard(tab: Tab, board: NonNullable<(typeof boardCache)[Tab]>) {
  boardCache[tab] = board;
  writeSocialCache<StoredBoard>(`board_${tab}`, {
    items: board.items,
    avatars: [...board.avatars.entries()],
  });
}

/** Siembra `boardCache` desde el disco. Devuelve lo sembrado, o null. */
async function hydrateBoard(tab: Tab) {
  if (boardCache[tab]) return boardCache[tab];
  const stored = await readSocialCache<StoredBoard>(`board_${tab}`);
  if (!stored?.items?.length) return null;
  const board = {
    items: stored.items,
    avatars: new Map(stored.avatars ?? []),
  };
  boardCache[tab] = board;
  return board;
}

// Filtro de intensidad del tablón: 'all' = sin filtrar.
type IntensityFilter = RoutineIntensity | 'all';

export function CommunityScreen({
  active = true,
  onOpenProfile,
  onOpenRoutine,
  onOpenFollowing,
  onOpenFollowers,
  onOpenAccount,
}: CommunityScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const { user } = useSession();
  const { profile: myProfile } = useMyProfile();
  // Tus contadores (para tu tarjeta) y lo que ha pasado desde la última visita.
  // Se siembran con la copia del último arranque (lib/socialCache.ts): nacían en
  // 0 y se leían como el dato, así que tu tarjeta decía "0 seguidores" y un
  // segundo después saltaba a los de verdad.
  const [socialCounts, setSocialCounts] = useState<{
    followers: number;
    following: number;
  } | null>(null);
  const news = useCommunityNews();
  // Rutinas y perfiles que TÚ has reportado: no vuelven a aparecerte aquí.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const [tab, setTab] = useState<Tab>('popular');
  const [intensity, setIntensity] = useState<IntensityFilter>('all');
  // Raíl de intensidad desplegado (lo abre su botón del raíl de pestañas).
  const [intensityOpen, setIntensityOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileLite[]>([]);
  // Rutinas públicas que casan con la búsqueda: el tablón trae solo las 50 más
  // populares, y el resto no se alcanzaba de ninguna forma.
  const [routineResults, setRoutineResults] = useState<RoutineItem[]>([]);
  // Hay una consulta de personas en vuelo: la sección de resultados es ahora
  // permanente, así que sin esto parpadearía "Sin resultados" en cada tecla.
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<RoutineItem[]>(
    () => boardCache.popular?.items ?? []
  );
  const [avatars, setAvatars] = useState<Map<string, ProfileLite>>(
    () => boardCache.popular?.avatars ?? new Map()
  );
  // Si ya hay algo en caché para la pestaña inicial, no arrancamos en "Cargando".
  const [loading, setLoading] = useState(!boardCache.popular);
  const [refreshing, setRefreshing] = useState(false);
  // Segundo tramo de la carga (fotos, series y comentarios): el tablón ya está
  // pintado, pero las tarjetas aún van a cambiar. Una rueda al pie lo dice.
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    // Aviso con salida: "inicia sesión para…" lleva a la pantalla de cuenta.
    action?: 'sign-in';
  } | null>(null);

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { scrollBottomPadding } = getFloatingPrimaryNavMetrics(insets.bottom);

  const notify = (message: string, type: 'success' | 'error') =>
    setToast({ message, type });

  // Aviso de sesión: dice qué falta Y lleva a arreglarlo (la cuenta vive tres
  // pantallas más allá, en Perfil → Ajustes → Datos y nube).
  const notifySignIn = (message: string) =>
    setToast({ message, type: 'error', action: 'sign-in' });

  // Carga el tablón/feed de la pestaña. `background` = refresco silencioso (no
  // muestra "Cargando" ni pisa el contenido con un error si falla). Al terminar
  // guarda en la caché de módulo para el próximo montaje.
  const load = useCallback(
    async (background: boolean) => {
      if (!background) {
        setLoading(true);
        setError(null);
      }
      try {
        let rows: RoutineItem[] = [];
        if (tab === 'popular') {
          rows = await getPopularRoutines();
        } else if (user) {
          const feed = await getFollowingFeed(user.id);
          // El feed no trae likes de serie: se enriquecen para poder dar like
          // también aquí (coherencia con el tablón).
          const likeInfo = await getLikeInfo(
            feed.map((r) => r.id),
            user.id
          );
          rows = feed.map((r: FeedRoutine) => ({
            ...r,
            author_name: null,
            likes: likeInfo.get(r.id)?.likes ?? 0,
            liked_by_me: likeInfo.get(r.id)?.liked ?? false,
          }));
        }
        // Pinta las rutinas ya (sin esperar a las fotos): el tablón aparece en
        // cuanto llega la lista y los avatares entran un instante después.
        // En un refresco en segundo plano se conservan los metadatos que ya
        // están pintados (intensidad, series, comentarios): la consulta de abajo
        // los vuelve a traer, y mientras tanto quitarlos devolvía los esqueletos
        // sobre datos buenos, que es lo que hacía parecer que todo recargaba.
        if (background) {
          const previous = new Map(
            (boardCache[tab]?.items ?? []).map((r) => [r.id, r])
          );
          setItems(
            rows.map((r) => {
              const old = previous.get(r.id);
              return old
                ? {
                    ...r,
                    total_sets: r.total_sets ?? old.total_sets,
                    total_days: r.total_days ?? old.total_days,
                    comments: r.comments ?? old.comments,
                    saves: r.saves ?? old.saves,
                  }
                : r;
            })
          );
        } else {
          setItems(rows);
          setLoading(false);
        }
        if (rows.length && !background) setLoadingMeta(true);
        const avs = await getProfilesByIds(rows.map((r) => r.owner_id));
        setAvatars(avs);
        storeBoard(tab, { items: rows, avatars: avs });
        // Series y comentarios de cada rutina (distintivo de intensidad y
        // recuento del hilo): van después de pintar, y si fallan el tablón se
        // queda sin esos dos datos pero entero.
        try {
          const ids = rows.map((r) => r.id);
          const [totals, commentCounts, saveCounts] = await Promise.all([
            getRoutinePlanStats(rows),
            getCommentCounts(ids).catch(() => new Map<string, number>()),
            getSaveCounts(ids).catch(() => new Map<string, number>()),
          ]);
          const withMeta = rows.map((r) => ({
            ...r,
            total_sets: totals.get(r.id)?.sets,
            total_days: totals.get(r.id)?.days,
            comments: commentCounts.get(r.id),
            saves: saveCounts.get(r.id),
          }));
          setItems(withMeta);
          storeBoard(tab, { items: withMeta, avatars: avs });
        } catch {
          // Sin totales: las tarjetas se quedan sin distintivo.
        }
      } catch (e) {
        if (!background) {
          setError((e as Error).message);
          setLoading(false);
        }
      } finally {
        setLoadingMeta(false);
      }
    },
    [tab, user?.id]
  );

  // Al cambiar de pestaña: si hay caché, pinta al instante; si no, muestra
  // "Cargando". La consulta a la nube se LANZA TRAS EL PRIMER RENDER
  // (runAfterInteractions), para que la vista se abra ya y la red no bloquee la
  // navegación (antes parecía "congelado" al pulsar la pestaña).
  useEffect(() => {
    if (!active) return;
    let alive = true;
    // La copia de disco se lee en el acto si en memoria no hay nada: es lo que
    // hace que tras cerrar la app el tablón no vuelva a empezar por la rueda.
    let cached = boardCache[tab];
    if (cached) {
      setItems(cached.items);
      setAvatars(cached.avatars);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
    }
    const task = InteractionManager.runAfterInteractions(async () => {
      if (!cached) {
        const stored = await hydrateBoard(tab);
        if (!alive) return;
        if (stored) {
          cached = stored;
          setItems(stored.items);
          setAvatars(stored.avatars);
          setLoading(false);
          setError(null);
        }
      }
      load(!!cached);
    });
    return () => {
      alive = false;
      task.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.id, active]);

  // Lo reportado se recarga cada vez que se vuelve a la pestaña: puedes haber
  // reportado algo desde la ficha de una rutina y al volver no debe seguir ahí.
  useEffect(() => {
    if (!active) return;
    let alive = true;
    loadHiddenIds().then((ids) => {
      if (alive) setHiddenIds(new Set(ids));
    });
    return () => {
      alive = false;
    };
  }, [active]);

  // Búsqueda de personas y rutinas, con un pequeño retardo para no consultar en
  // cada tecla. Si una de las dos falla, la otra se enseña igual.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      setRoutineResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      Promise.all([
        searchProfiles(q)
          .then((r) => {
            if (active) setSearchResults(r);
          })
          .catch(() => {}),
        searchPublicRoutines(q)
          .then(async (routines) => {
            const authors = await getProfilesByIds(
              routines.map((r) => r.owner_id)
            ).catch(() => new Map<string, ProfileLite>());
            if (!active) return;
            setAvatars((prev) => new Map([...prev, ...authors]));
            setRoutineResults(
              routines.map((r) => ({ ...r, author_name: null }))
            );
          })
          .catch(() => {}),
      ]).finally(() => {
        if (active) setSearching(false);
      });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Los contadores guardados, para pintar la tarjeta ya hecha mientras se
  // confirman con la nube.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    readSocialCache<{ followers: number; following: number }>(
      `counts_${user.id}`
    ).then((stored) => {
      if (alive && stored) setSocialCounts((prev) => prev ?? stored);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Contadores de tu tarjeta y, al entrar, los avisos al día.
  useEffect(() => {
    if (!user || !active) return;
    let alive = true;
    // Tras el primer render, para no sumar red al abrir la pantalla.
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const [followers, following] = await Promise.all([
          getFollowerCount(user.id),
          getFollowingCount(user.id),
        ]);
        if (!alive) return;
        setSocialCounts({ followers, following });
        writeSocialCache(`counts_${user.id}`, { followers, following });

        await refreshCommunityNews(user.id);
      } catch {
        // Sin red: no se avisa esta vez.
      }
    });
    return () => {
      alive = false;
      task.cancel();
    };
  }, [user?.id, active]);

  const authorName = (item: RoutineItem) =>
    avatars.get(item.owner_id)?.display_name ||
    item.author_name ||
    t('Anónimo');

  const handleToggleLike = async (item: RoutineItem) => {
    if (!user) {
      notifySignIn(t('Crea una cuenta para dar like'));
      return;
    }
    const liked = !!item.liked_by_me;
    setItems((prev) =>
      prev.map((r) =>
        r.id === item.id
          ? {
              ...r,
              liked_by_me: !liked,
              likes: (r.likes ?? 0) + (liked ? -1 : 1),
            }
          : r
      )
    );
    try {
      if (liked) await unlikeRoutine(item.id, user.id);
      else await likeRoutine(item.id, user.id);
    } catch (e) {
      setItems((prev) =>
        prev.map((r) =>
          r.id === item.id
            ? {
                ...r,
                liked_by_me: liked,
                likes: (r.likes ?? 0) + (liked ? 1 : -1),
              }
            : r
        )
      );
      notify((e as Error).message, 'error');
    }
  };

  // Añadir NO copia: enlaza la rutina del autor (ids originales), así que se
  // entrena tal cual y se ve de quién es. Para cambiarla, su ficha ofrece
  // sacar una copia.
  const handleSave = async (item: RoutineItem) => {
    // Sin cuenta no hay sync, y una rutina enlazada vive del sync (sigue los
    // cambios de su autor): sin sesión el enlace quedaría congelado.
    if (!user) {
      notifySignIn(t('Crea una cuenta para añadir rutinas'));
      return;
    }
    setSavingId(item.id);
    try {
      const linked = await linkablePublicRoutine(
        item.id,
        item.owner_id,
        authorName(item)
      );
      if (!linked) {
        notify(t('Esta rutina ya no está disponible'), 'error');
        return;
      }
      dispatch({ type: 'ADD_ROUTINE', payload: linked });
      notify(t('Añadida a tus rutinas'), 'success');
      // Una persona más en su recuento (si ya se la había llevado antes, la
      // nube no suma: el recuento lo trae bien el próximo refresco).
      setItems((prev) =>
        prev.map((r) =>
          r.id === item.id && r.saves !== undefined
            ? { ...r, saves: r.saves + 1 }
            : r
        )
      );
      recordRoutineSave(item.id, user.id).catch(() => {});
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  const showingSearch = query.trim().length > 0;
  const visibleRoutineResults = routineResults.filter(
    (r) => !hiddenIds.has(r.id) && !hiddenIds.has(r.owner_id)
  );
  // Buscador plegado por defecto: se despliega con su lupa (junto al filtro de
  // intensidad) y se cierra vaciando lo tecleado.
  const [searchOpen, setSearchOpen] = useState(false);

  // Cómo apareces tú en la pestaña. Sin nombre visible todavía, se dice así en
  // vez de dejar la tarjeta en blanco.
  const myName = hasProfileFilled(myProfile)
    ? (myProfile?.display_name as string)
    : t('Sin nombre visible');
  // Singular con uno: "1 Seguidores" es lo primero que ve quien acaba de
  // estrenar el perfil. Mismo criterio que el perfil público ajeno.
  const followersLabel =
    socialCounts?.followers === 1 ? t('Seguidor') : t('Seguidores');

  // Novedades de tus rutinas (comentarios y me gusta), una fila por rutina en
  // UNA tarjeta: antes cada una era un banner de oro macizo y, con varias, el
  // tablón empezaba a media pantalla. Los seguidores nuevos no van aquí: son
  // un "+N" sobre su contador, que ya lleva a esa misma lista.
  const routineNewsLabel = (routine: RoutineNews) => {
    const parts: string[] = [];
    if (routine.comments > 0) {
      parts.push(
        routine.comments === 1
          ? t('1 comentario nuevo')
          : t('{n} comentarios nuevos', { n: routine.comments })
      );
    }
    if (routine.likes > 0) {
      parts.push(
        routine.likes === 1
          ? t('1 me gusta nuevo')
          : t('{n} me gusta nuevos', { n: routine.likes })
      );
    }
    return parts.join(' · ');
  };
  const newsItems = news.routines.map((routine) => {
    const name =
      state.routines.find((r) => r.id === routine.id)?.name ?? t('Tu rutina');
    return {
      key: routine.id,
      name,
      detail: routineNewsLabel(routine),
      onPress: () => {
        if (!user) return;
        dismissRoutineNews(user.id, routine.id);
        onOpenRoutine?.(
          routine.id,
          name,
          myName,
          user.id,
          routine.comments > 0
        );
      },
    };
  });
  // Abrir Seguidores descarta su aviso (como hacía el banner).
  const openFollowers = () => {
    if (user && news.followers > 0) dismissFollowersNews(user.id);
    onOpenFollowers?.();
  };

  const renderUserRow = (p: ProfileLite) => (
    <Pressable
      key={p.id}
      style={({ pressed }) => [styles.userRow, pressed && styles.pressed]}
      onPress={() => onOpenProfile?.(p.id, p.display_name || t('Anónimo'))}
    >
      <Avatar uri={p.avatar_url} />
      <Text style={styles.userName} numberOfLines={1}>
        {p.display_name || t('Anónimo')}
      </Text>
      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );

  const renderRoutineCard = (item: RoutineItem) => (
    // La tarjeta es compartida con el perfil de su autor
    // (components/PublicRoutineCard.tsx): la misma rutina se ve igual por las
    // dos puertas. Aquí lleva la firma del autor, que allí sobra.
    <PublicRoutineCard
      item={item}
      saved={!!findSavedRoutine(state.routines, item.id)}
      savingBusy={savingId === item.id}
      loadingMeta={loadingMeta}
      author={{
        name: authorName(item),
        avatarUrl: avatars.get(item.owner_id)?.avatar_url ?? null,
        onPress:
          onOpenProfile && item.owner_id !== DELETED_ACCOUNT_ID
            ? () => onOpenProfile(item.owner_id, authorName(item))
            : undefined,
      }}
      onPress={
        onOpenRoutine
          ? () =>
              onOpenRoutine(item.id, item.name, authorName(item), item.owner_id)
          : undefined
      }
      onSave={() => handleSave(item)}
      onToggleLike={() => handleToggleLike(item)}
    />
  );

  // Las cuatro intensidades, con el rayo y el color de cada tramo: lo mismo que
  // la píldora de las tarjetas, para que al filtrar "Intensa" se reconozca la
  // píldora roja de lo que queda. Antes eran velocímetros en oro.
  const intensityOptions: { id: IntensityFilter; label: string }[] = [
    { id: 'all', label: t('Todas') },
    { id: 'soft', label: t('Suave') },
    { id: 'medium', label: t('Media') },
    { id: 'hard', label: t('Intensa') },
  ];

  // Cabecera fija de la lista (aviso + buscador + personas + pestañas). Va como
  // ListHeaderComponent para que la FlatList virtualice solo las tarjetas.
  const header = (
    <View style={styles.headerGap}>
      {/* TÚ, arriba del todo: la pestaña hablaba solo de los demás y para verte
          como te ve la gente había que dar la vuelta por Perfil → Editar
          perfil, donde los contadores vivían dentro de un formulario. */}
      {!!user && (
        <Pressable
          style={({ pressed }) => [styles.meCard, pressed && styles.pressed]}
          onPress={() => onOpenProfile?.(user.id, myName)}
          disabled={!onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={t('Ver mi perfil público')}
        >
          <GradientFill accent={theme.colors.primaryLine} />
          <Avatar uri={myProfile?.avatar_url ?? null} size={44} />
          <View style={styles.meInfo}>
            <Text style={styles.meName} numberOfLines={1}>
              {myName}
            </Text>
            <Text style={styles.meHint} numberOfLines={1}>
              {hasProfileFilled(myProfile) && myProfile?.is_public
                ? t('Así te ve la comunidad')
                : t('Tu perfil no aparece para otros')}
            </Text>
          </View>
          {/* Los contadores SON los caminos a las dos listas: antes solo se
              llegaba a "Seguidores" por el aviso, y solo cuando subía. */}
          <Pressable
            style={({ pressed }) => [styles.meCount, pressed && styles.pressed]}
            onPress={openFollowers}
            disabled={!onOpenFollowers}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={
              news.followers > 0
                ? `${followersLabel}. ${
                    news.followers === 1
                      ? t('1 nuevo seguidor')
                      : t('{n} nuevos seguidores', { n: news.followers })
                  }`
                : followersLabel
            }
          >
            <Text style={styles.meCountValue}>
              {socialCounts?.followers ?? '—'}
            </Text>
            <Text style={styles.meCountLabel}>{followersLabel}</Text>
            {/* Seguidores nuevos desde la última visita: antes un banner de
                oro aparte que llevaba a esta misma lista. */}
            {news.followers > 0 && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>+{news.followers}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.meCount, pressed && styles.pressed]}
            onPress={onOpenFollowing}
            disabled={!onOpenFollowing}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('Siguiendo')}
          >
            <Text style={styles.meCountValue}>
              {socialCounts?.following ?? '—'}
            </Text>
            <Text style={styles.meCountLabel}>{t('Siguiendo')}</Text>
          </Pressable>
        </Pressable>
      )}

      {/* Sin cuenta, el mismo hueco lo ocupa la invitación: arriba siempre hay
          una tarjeta de identidad (la tuya o esta). Antes la pestaña callaba
          qué desbloquea la cuenta y se descubría a golpes, toast a toast. */}
      {!user && !!onOpenAccount && (
        <View style={styles.meCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <MaterialCommunityIcons
            name="account-plus-outline"
            size={30}
            color={theme.colors.primary}
          />
          <View style={styles.meInfo}>
            <Text style={styles.meName}>{t('Sin cuenta')}</Text>
            <Text style={styles.noAccountHint}>
              {t(
                'Crea una cuenta para añadir rutinas, dar like y seguir a gente'
              )}
            </Text>
          </View>
          <Button
            title={t('Crear cuenta')}
            onPress={onOpenAccount}
            variant="primary"
            size="small"
          />
        </View>
      )}

      {/* Qué ha pasado en tus rutinas desde la última visita (comentarios y
          me gusta), en UNA tarjeta: una fila por rutina, que la abre (en los
          comentarios nuevos si los hay) y descarta su aviso. */}
      {newsItems.length > 0 && (
        <View style={styles.newsCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.newsHead}>
            <MaterialCommunityIcons
              name="bell-ring-outline"
              size={16}
              color={theme.colors.primary}
            />
            <Text style={styles.newsTitle}>{t('Novedades')}</Text>
          </View>
          {newsItems.map((item, index) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.newsRow,
                index > 0 && styles.newsRowDivided,
                pressed && styles.pressed,
              ]}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}: ${item.detail}`}
            >
              <View style={styles.newsRowText}>
                <Text style={styles.newsRowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.newsRowDetail} numberOfLines={1}>
                  {item.detail}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          ))}
        </View>
      )}

      {/* Un solo raíl por defecto: de dónde salen las rutinas. Buscar y la
          intensidad son puntuales y viven tras sus botones (visibles, con su
          icono y su estado); lo suyo baja al abrirlos —o mientras haya algo
          puesto, para que nunca quede un filtro activo escondido—. */}
      <View style={styles.railRow}>
        <SegmentedFilter
          style={styles.railFilter}
          options={[
            { id: 'popular', label: t('Populares') },
            { id: 'following', label: t('Siguiendo') },
          ]}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />
        <Pressable
          style={({ pressed }) => [
            styles.railButton,
            (searchOpen || showingSearch) && styles.railButtonActive,
            pressed && styles.pressed,
          ]}
          onPress={() => {
            // Al cerrar se vacía la búsqueda: si no, quedaría un filtro puesto
            // que ya no se ve en ninguna parte.
            if (searchOpen) setQuery('');
            setSearchOpen((open) => !open);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: searchOpen }}
          accessibilityLabel={t('Buscar personas o rutinas')}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={showingSearch ? theme.colors.primary : theme.colors.text}
          />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.railButton,
            intensityOpen && styles.railButtonActive,
            pressed && styles.pressed,
          ]}
          onPress={() => setIntensityOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: intensityOpen }}
          accessibilityLabel={t('Filtrar por intensidad')}
        >
          <MaterialCommunityIcons
            name="lightning-bolt"
            size={20}
            color={
              intensity === 'all'
                ? theme.colors.text
                : intensityColor(intensity)
            }
          />
          {intensity !== 'all' && (
            <View
              style={[
                styles.railDot,
                { backgroundColor: intensityColor(intensity) },
              ]}
            />
          )}
        </Pressable>
      </View>

      {/* El campo de búsqueda, el PRIMERO bajo el raíl: pegado a su lupa.
          Sigue montado mientras haya texto aunque se pliegue (un filtro activo
          no puede quedar escondido). */}
      {(searchOpen || showingSearch) && (
        <View style={styles.searchBox}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={theme.colors.textMuted}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t('Buscar personas o rutinas')}
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {showingSearch && (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('Borrar búsqueda')}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={theme.colors.textMuted}
              />
            </Pressable>
          )}
        </View>
      )}

      {/* La intensidad: rótulo y chips de filtro (no un segundo raíl), cada uno
          con el rayo y el color de su tramo. */}
      {(intensityOpen || intensity !== 'all') && (
        <View style={styles.filterGroup}>
          <Text style={styles.sectionEyebrow}>{t('Intensidad')}</Text>
          <View style={styles.filterChips}>
            {intensityOptions.map((option) => {
              const activeChip = option.id === intensity;
              const tone =
                option.id === 'all'
                  ? theme.colors.primaryLine
                  : intensityColor(option.id);
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.filterChip,
                    activeChip && {
                      borderColor: tone,
                      backgroundColor:
                        option.id === 'all'
                          ? theme.colors.primaryMuted
                          : `${tone}22`,
                    },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setIntensity(option.id)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: activeChip }}
                >
                  {option.id !== 'all' && (
                    <MaterialCommunityIcons
                      name="lightning-bolt"
                      size={14}
                      color={tone}
                    />
                  )}
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: activeChip
                          ? option.id === 'all'
                            ? theme.colors.primary
                            : tone
                          : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Resultados en un panel propio, con título y su cierre: antes iban con
          la misma tarjeta justo encima del tablón entero y no se veía dónde
          acababan. Sigue siendo un filtro temporal: el tablón sigue debajo. */}
      {showingSearch && (
        <View style={styles.resultsPanel}>
          <View style={styles.resultsHead}>
            <Text style={styles.resultsTitle} numberOfLines={1}>
              {t('Resultados para «{q}»', { q: query.trim() })}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.resultsClose,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                setQuery('');
                setSearchOpen(false);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('Cerrar búsqueda')}
            >
              <MaterialCommunityIcons
                name="close"
                size={18}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          </View>
          {searchResults.length === 0 && visibleRoutineResults.length === 0 ? (
            <Text style={styles.muted}>
              {searching
                ? t('Buscando…')
                : t('Nada para «{q}»', { q: query.trim() })}
            </Text>
          ) : (
            <>
              {searchResults.length > 0 && (
                <>
                  <Text style={styles.sectionEyebrow}>{t('Personas')}</Text>
                  {searchResults.map(renderUserRow)}
                </>
              )}
              {visibleRoutineResults.length > 0 && (
                <>
                  <Text
                    style={[
                      styles.sectionEyebrow,
                      searchResults.length > 0 && styles.sectionEyebrowNext,
                    ]}
                  >
                    {t('Rutinas')}
                  </Text>
                  <View style={styles.routineResults}>
                    {visibleRoutineResults.map((item) => (
                      <React.Fragment key={item.id}>
                        {renderRoutineCard(item)}
                      </React.Fragment>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );

  // Estado vacío de la lista (según buscando / cargando / error / sin datos).
  const listEmpty = loading ? (
    <View style={styles.skeletonList}>
      <PublicRoutineCardSkeleton />
      <PublicRoutineCardSkeleton />
      <PublicRoutineCardSkeleton />
    </View>
  ) : error ? (
    <View style={styles.card}>
      <GradientFill accent={theme.colors.error} />
      <Text style={styles.hint}>{error}</Text>
      <Button
        title={t('Reintentar')}
        onPress={() => load(false)}
        variant="secondary"
      />
    </View>
  ) : intensity !== 'all' && items.length > 0 ? (
    <View style={styles.card}>
      <GradientFill accent={theme.colors.primaryLine} />
      <Text style={styles.emptyTitle}>
        {t('Sin rutinas de esa intensidad')}
      </Text>
      <Button
        title={t('Todas')}
        onPress={() => setIntensity('all')}
        variant="secondary"
      />
    </View>
  ) : (
    <View style={styles.card}>
      <GradientFill accent={theme.colors.primaryLine} />
      <Text style={styles.emptyTitle}>
        {tab === 'popular'
          ? t('Aún no hay rutinas')
          : t('Nada por aquí todavía')}
      </Text>
      <Text style={styles.hint}>
        {tab === 'popular'
          ? t(
              'Publica una de tus rutinas desde su detalle para que aparezca aquí.'
            )
          : user
          ? t('Sigue a alguien para ver aquí sus rutinas públicas.')
          : t('Crea una cuenta para seguir a gente y ver aquí sus rutinas.')}
      </Text>
      {/* Sin sesión, "Siguiendo" no puede llenarse: la salida es la cuenta,
          y su botón ya está arriba, en la tarjeta de invitación. */}
    </View>
  );

  // Rutinas que pasan el filtro de intensidad, quitando lo que hayas reportado
  // (rutinas y autores): reportar algo tiene que quitártelo de delante sin
  // esperar a que nadie revise el parte. Las que aún no tienen su total de
  // series (llega en segundo plano) no se ocultan al filtrar: desaparecerían y
  // volverían solas un instante después.
  const visibleItems = (
    intensity === 'all'
      ? items
      : items.filter(
          (r) =>
            r.total_sets == null || routineIntensity(r.total_sets) === intensity
        )
  ).filter((r) => !hiddenIds.has(r.id) && !hiddenIds.has(r.owner_id));

  // Subtítulo de la barra: un dato vivo, como el resto de pantallas
  // principales (antes, el eslogan "Rutinas y gente que entrena"). Siempre hay
  // texto, para que la barra no cambie de alto al llegar el tablón.
  const tabLabel = tab === 'popular' ? t('Populares') : t('Siguiendo');
  const boardSubtitle =
    loading && visibleItems.length === 0
      ? tabLabel
      : `${tabLabel} · ${
          visibleItems.length === 1
            ? t('1 rutina')
            : t('{n} rutinas', { n: visibleItems.length })
        }`;

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

      {/* Los datos que llegan tarde (intensidad, series) se avisan EN la
          tarjeta con sus huecos reservados, no con una rueda al pie de la
          lista, lejos de lo que está cambiando. */}
      <FlatList
        style={styles.scroll}
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderRoutineCard(item)}
        ListHeaderComponent={header}
        ListEmptyComponent={listEmpty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load(true);
              } finally {
                setRefreshing(false);
              }
            }}
            // El spinner cae por debajo de la GlassTopBar (que es fija y
            // translúcida) en vez de quedarse escondido tras ella.
            progressViewOffset={topBarHeight}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
      />

      <GlassTopBar
        title={t('Comunidad')}
        icon="account-group-outline"
        subtitle={boardSubtitle}
        topInset={insets.top}
        onLayout={onTopBarLayout}
      />

      {/* Barra de navegación fija en app/App.tsx (fuera del pager). */}

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
    content: { paddingHorizontal: 16, flexGrow: 1 },
    headerGap: { gap: 12, marginBottom: 12 },
    separator: { height: 12 },
    // Tu tarjeta: foto, nombre y los dos contadores, que son los caminos a las
    // listas de seguidores y seguidos.
    meCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    meInfo: { flex: 1, minWidth: 0 },
    meName: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 21,
    },
    meHint: { color: theme.colors.textMuted, fontSize: 12, marginTop: 1 },
    // Dos líneas caben: la invitación dice las tres cosas que da la cuenta.
    noAccountHint: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    meCount: { alignItems: 'center', minWidth: 54 },
    // "+N" de seguidores nuevos, en la esquina del contador.
    newBadge: {
      position: 'absolute',
      top: -6,
      right: -4,
      minWidth: 22,
      paddingHorizontal: 5,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryFill,
    },
    newBadgeText: {
      color: theme.colors.onGold,
      fontSize: 11,
      fontWeight: '800',
    },
    meCountValue: {
      color: theme.colors.primary,
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 21,
    },
    meCountLabel: { color: theme.colors.textMuted, fontSize: 11 },
    // Novedades: tarjeta neutra con borde de oro (no relleno: el oro macizo
    // es de la acción primaria) y una fila por rutina.
    newsCard: {
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 4,
    },
    newsHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    newsTitle: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.primary,
      lineHeight: 14,
    },
    newsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
      paddingVertical: 6,
    },
    newsRowDivided: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    newsRowText: { flex: 1, minWidth: 0 },
    newsRowName: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    newsRowDetail: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      marginTop: 1,
    },
    // Caja del buscador de personas, desplegada bajo los filtros. Ya no comparte
    // fila con nada (antes iba junto a un botón de "a quién sigo" que duplicaba
    // el contador de "Siguiendo" de tu tarjeta), así que ocupa el ancho entero.
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      height: 46,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 16,
      padding: 0,
    },
    // Resultados de la búsqueda: un panel propio (fondo distinto, título y
    // cierre) encima del tablón, no en su lugar.
    resultsPanel: {
      gap: 8,
      padding: 12,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resultsHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    resultsTitle: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    resultsClose: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    // "Rutinas" va tras "Personas" en el mismo panel: aire para separarlas.
    sectionEyebrowNext: { marginTop: 8 },
    routineResults: { gap: 10 },
    // Rótulo de sección/filtro: dice qué es lo que viene debajo. Mismo
    // tratamiento que la ceja "Día N" de la ficha de una rutina.
    sectionEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
      lineHeight: 14,
    },
    // Filtro de intensidad: rótulo + chips, no un segundo raíl segmentado.
    // El activo toma el color de su tramo (contorno y velo), como la píldora.
    filterGroup: { gap: 8 },
    filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minHeight: 36,
      paddingHorizontal: 13,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    filterChipText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.1 },
    // Raíl de pestañas + botones de buscar e intensidad en la misma línea.
    railRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    railFilter: {
      flex: 1,
    },
    railButton: {
      width: 42,
      height: 42,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    railButtonActive: {
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.primaryMuted,
    },
    // Punto de "hay un filtro puesto" sobre el icono, del color del tramo.
    railDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    card: {
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      // El mismo padding que `routineCard` en Rutinas: son la misma cosa en
      // dos pestañas vecinas y con 20 la Comunidad parecía otra app.
      padding: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 10,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    userName: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    pressed: { opacity: 0.6 },
    emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
    hint: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
    muted: { color: theme.colors.textMuted, fontSize: 14 },
    skeletonList: { gap: 12 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
