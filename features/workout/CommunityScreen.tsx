import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  InteractionManager,
  FlatList,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  RoutineIntensityPill,
  SaveRoutineButton,
  SegmentedFilter,
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
import {
  getPopularRoutines,
  getFollowingFeed,
  getLikeInfo,
  searchProfiles,
  getProfilesByIds,
  getFollowerCount,
  likeRoutine,
  unlikeRoutine,
  linkablePublicRoutine,
  getRoutineSetTotals,
  getCommentCounts,
  getFollowingCount,
  getPublicRoutineIds,
  FeedRoutine,
  ProfileLite,
} from '@lib/cloud/social';
import { hasProfileFilled, useMyProfile } from '@hooks/useMyProfile';
import { loadHiddenIds } from '@lib/moderation';

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
    ownerId: string
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
  // Comentarios del hilo de la rutina. Llega con el mismo lote que las series y
  // es solo informativo: el hilo vive en la ficha de la rutina.
  comments?: number;
}

// Caché en memoria del último tablón/feed (por pestaña), para pintar al instante
// al reabrir Comunidad y refrescar en segundo plano. Vive a nivel de módulo, así
// que sobrevive a desmontar/montar la pantalla (es una pestaña de la barra).
const boardCache: Record<
  Tab,
  { items: RoutineItem[]; avatars: Map<string, ProfileLite> } | undefined
> = { popular: undefined, following: undefined };

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
  const [socialCounts, setSocialCounts] = useState({
    followers: 0,
    following: 0,
  });
  const [news, setNews] = useState({ followers: 0, likes: 0, comments: 0 });
  // Rutinas y perfiles que TÚ has reportado: no vuelven a aparecerte aquí.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const [tab, setTab] = useState<Tab>('popular');
  const [intensity, setIntensity] = useState<IntensityFilter>('all');
  // Raíl de intensidad desplegado (lo abre su botón del raíl de pestañas).
  const [intensityOpen, setIntensityOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileLite[]>([]);
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
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    // Aviso con salida: "inicia sesión para…" lleva a la pantalla de cuenta.
    action?: 'sign-in';
  } | null>(null);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
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
        setItems(rows);
        if (!background) setLoading(false);
        const avs = await getProfilesByIds(rows.map((r) => r.owner_id));
        setAvatars(avs);
        boardCache[tab] = { items: rows, avatars: avs };
        // Series y comentarios de cada rutina (distintivo de intensidad y
        // recuento del hilo): van después de pintar, y si fallan el tablón se
        // queda sin esos dos datos pero entero.
        try {
          const ids = rows.map((r) => r.id);
          const [totals, commentCounts] = await Promise.all([
            getRoutineSetTotals(ids),
            getCommentCounts(ids).catch(() => new Map<string, number>()),
          ]);
          const withMeta = rows.map((r) => ({
            ...r,
            total_sets: totals.get(r.id),
            comments: commentCounts.get(r.id),
          }));
          setItems(withMeta);
          boardCache[tab] = { items: withMeta, avatars: avs };
        } catch {
          // Sin totales: las tarjetas se quedan sin distintivo.
        }
      } catch (e) {
        if (!background) {
          setError((e as Error).message);
          setLoading(false);
        }
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
    const cached = boardCache[tab];
    if (cached) {
      setItems(cached.items);
      setAvatars(cached.avatars);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
    }
    const task = InteractionManager.runAfterInteractions(() => {
      load(!!cached);
    });
    return () => task.cancel();
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

  // Búsqueda de usuarios, con un pequeño retardo para no consultar en cada tecla.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchProfiles(q)
        .then((r) => {
          if (active) setSearchResults(r);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Qué ha pasado desde la última visita a Comunidad: seguidores nuevos y, en
  // TUS rutinas publicadas, me gusta y comentarios nuevos. Comparamos los
  // recuentos actuales con los guardados (por usuario) en AsyncStorage. No es
  // una notificación push (eso exigiría servidor): es un aviso al abrir la
  // pantalla. La primera vez se siembra con los valores actuales, para no
  // anunciar como "nuevo" todo el histórico.
  //
  // De paso deja los contadores de seguidores/siguiendo para tu tarjeta de
  // arriba: es la misma consulta.
  useEffect(() => {
    if (!user || !active) return;
    let alive = true;
    const key = `gymbro_social_seen_${user.id}`;
    // Tras el primer render, para no sumar red al abrir la pantalla.
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const [followers, following] = await Promise.all([
          getFollowerCount(user.id),
          getFollowingCount(user.id),
        ]);
        if (!alive) return;
        setSocialCounts({ followers, following });

        // Actividad de lo tuyo: me gusta y comentarios de tus rutinas públicas.
        let likes = 0;
        let comments = 0;
        const mine = await getPublicRoutineIds(user.id);
        if (mine.length) {
          const [likeInfo, commentCounts] = await Promise.all([
            getLikeInfo(mine, user.id),
            getCommentCounts(mine).catch(() => new Map<string, number>()),
          ]);
          for (const id of mine) {
            likes += likeInfo.get(id)?.likes ?? 0;
            comments += commentCounts.get(id) ?? 0;
          }
        }

        const raw = await AsyncStorage.getItem(key);
        const seen = raw
          ? (JSON.parse(raw) as {
              followers: number;
              likes: number;
              comments: number;
            })
          : { followers, likes, comments };
        if (alive) {
          setNews({
            followers: Math.max(0, followers - (seen.followers ?? 0)),
            likes: Math.max(0, likes - (seen.likes ?? 0)),
            comments: Math.max(0, comments - (seen.comments ?? 0)),
          });
        }
        await AsyncStorage.setItem(
          key,
          JSON.stringify({ followers, likes, comments })
        );
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
      notifySignIn(t('Inicia sesión para dar like'));
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
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  const showingSearch = query.trim().length > 0;
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
    socialCounts.followers === 1 ? t('Seguidor') : t('Seguidores');

  // Aviso de novedades: una sola frase con lo que haya (seguidores, me gusta y
  // comentarios). Si no hay nada nuevo, no hay aviso.
  const newsLabel = (() => {
    const parts: string[] = [];
    if (news.followers > 0) {
      parts.push(
        news.followers === 1
          ? t('1 nuevo seguidor')
          : t('{n} nuevos seguidores', { n: news.followers })
      );
    }
    if (news.likes > 0) {
      parts.push(
        news.likes === 1
          ? t('1 me gusta nuevo')
          : t('{n} me gusta nuevos', { n: news.likes })
      );
    }
    if (news.comments > 0) {
      parts.push(
        news.comments === 1
          ? t('1 comentario nuevo')
          : t('{n} comentarios nuevos', { n: news.comments })
      );
    }
    return parts.join(' · ');
  })();

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

  const renderRoutineCard = (item: RoutineItem) => {
    const level =
      item.total_sets != null ? routineIntensity(item.total_sets) : null;
    const saved = !!findSavedRoutine(state.routines, item.id);
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() =>
          onOpenRoutine?.(item.id, item.name, authorName(item), item.owner_id)
        }
        disabled={!onOpenRoutine}
        accessibilityRole="button"
        accessibilityLabel={t('Ver rutina')}
      >
        <GradientFill accent={theme.colors.primaryLine} />
        <View style={styles.cardHead}>
          {/* Quién la hizo: UNA sola diana con foto y nombre, la misma fila que
              usa la ficha de la rutina pública. Antes la foto y el nombre eran
              dos `Pressable` distintos para exactamente la misma acción. */}
          <Pressable
            style={({ pressed }) => [
              styles.authorRow,
              pressed && styles.pressed,
            ]}
            onPress={() => onOpenProfile?.(item.owner_id, authorName(item))}
            disabled={!onOpenProfile}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('Ver perfil de {name}', {
              name: authorName(item),
            })}
          >
            <Avatar
              uri={avatars.get(item.owner_id)?.avatar_url ?? null}
              size={26}
            />
            <Text style={styles.author} numberOfLines={1}>
              {t('por {name}', { name: authorName(item) })}
            </Text>
          </Pressable>

          {/* El nombre se queda con la fila entera: es el dato que decide si se
              abre la rutina. Antes compartía renglón con el avatar y las dos
              acciones, y le quedaban ~125 px (unos 12 caracteres). */}
          <Text style={styles.routineName} numberOfLines={2}>
            {item.name}
          </Text>
        </View>

        {!!item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {/* Pie de la tarjeta: a la izquierda cuánta caña lleva la semana (el
            dato que dice si la rutina te sirve sin abrirla) y a la derecha las
            dos acciones sociales, del mismo tamaño entre sí. */}
        <View style={styles.footerRow}>
          {level && (
            <>
              <RoutineIntensityPill level={level} />
              <Text style={styles.metaText}>
                {item.total_sets === 1
                  ? t('1 serie')
                  : t('{n} series', { n: item.total_sets ?? 0 })}
              </Text>
            </>
          )}
          {/* Cuánta conversación tiene. Es un DATO, no un botón: por eso va con
              la intensidad y no con las acciones. El hilo se abre entrando en
              la rutina, que es lo que hace la tarjeta entera. */}
          {!!item.comments && (
            <View style={styles.commentCount}>
              <MaterialCommunityIcons
                name="comment-outline"
                size={14}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.metaText}>{item.comments}</Text>
            </View>
          )}
          <View style={styles.footerSpacer} />
          <SaveRoutineButton
            saved={saved}
            busy={savingId === item.id}
            onPress={() => handleSave(item)}
          />
          {item.likes !== undefined && (
            <Pressable
              style={({ pressed }) => [
                styles.likeButton,
                pressed && styles.pressed,
              ]}
              onPress={() => handleToggleLike(item)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('Me gusta')}
            >
              <MaterialCommunityIcons
                name={item.liked_by_me ? 'heart' : 'heart-outline'}
                size={20}
                color={
                  item.liked_by_me
                    ? theme.colors.error
                    : theme.colors.textSecondary
                }
              />
              <Text style={styles.likeCount}>{item.likes}</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  };

  // Las cuatro intensidades. Ya no son un SegmentedFilter: ver `filterChip`.
  const intensityOptions: {
    id: IntensityFilter;
    label: string;
    icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  }[] = [
    { id: 'all', label: t('Todas') },
    { id: 'soft', label: t('Suave'), icon: 'speedometer-slow' },
    { id: 'medium', label: t('Medio'), icon: 'speedometer-medium' },
    { id: 'hard', label: t('Intenso'), icon: 'speedometer' },
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
            onPress={onOpenFollowers}
            disabled={!onOpenFollowers}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={followersLabel}
          >
            <Text style={styles.meCountValue}>{socialCounts.followers}</Text>
            <Text style={styles.meCountLabel}>{followersLabel}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.meCount, pressed && styles.pressed]}
            onPress={onOpenFollowing}
            disabled={!onOpenFollowing}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('Siguiendo')}
          >
            <Text style={styles.meCountValue}>{socialCounts.following}</Text>
            <Text style={styles.meCountLabel}>{t('Siguiendo')}</Text>
          </Pressable>
        </Pressable>
      )}

      {/* Qué ha pasado desde la última visita. Un solo aviso para las tres
          cosas: seguidores, me gusta y comentarios en tus rutinas. Publicar
          dejaba de tener respuesta en cuanto cerrabas la app. */}
      {!!newsLabel && (
        <Pressable
          style={({ pressed }) => [
            styles.newFollowersBanner,
            pressed && styles.pressed,
          ]}
          onPress={() => {
            setNews({ followers: 0, likes: 0, comments: 0 });
            if (user) onOpenProfile?.(user.id, myName);
          }}
        >
          <MaterialCommunityIcons
            name="bell-ring-outline"
            size={20}
            color={theme.colors.onGold}
          />
          <Text style={styles.newFollowersText}>{newsLabel}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.colors.onGold}
          />
        </Pressable>
      )}

      {/* Un solo raíl por defecto: de dónde salen las rutinas. La intensidad
          es un segundo eje que casi nadie toca, así que vive tras su botón
          (visible, con su icono y su estado) y solo baja cuando se abre —o
          cuando hay un filtro puesto, para que nunca quede un filtro activo
          escondido. */}
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
        {/* Buscar personas es puntual, así que se pliega tras su lupa en vez de
            ocupar una caja de 46 px permanente encima del tablón. Mismo patrón
            que el botón de intensidad, con el que comparte fila: control
            visible con su icono y su estado, contenido que baja al abrirlo. */}
        <Pressable
          style={({ pressed }) => [
            styles.intensityButton,
            (searchOpen || showingSearch) && styles.intensityButtonActive,
            pressed && styles.pressed,
          ]}
          onPress={() => {
            // Al cerrar se vacía la búsqueda: si no, el tablón se quedaría
            // filtrado por un texto que ya no se ve en ninguna parte.
            if (searchOpen) setQuery('');
            setSearchOpen((open) => !open);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: searchOpen }}
          accessibilityLabel={t('Buscar personas')}
        >
          <MaterialCommunityIcons
            name="account-search-outline"
            size={20}
            color={showingSearch ? theme.colors.primary : theme.colors.text}
          />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.intensityButton,
            intensityOpen && styles.intensityButtonActive,
            pressed && styles.pressed,
          ]}
          onPress={() => setIntensityOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: intensityOpen }}
          accessibilityLabel={t('Filtrar por intensidad')}
        >
          <MaterialCommunityIcons
            name="speedometer"
            size={20}
            color={
              intensity === 'all' ? theme.colors.text : theme.colors.primary
            }
          />
          {intensity !== 'all' && <View style={styles.intensityDot} />}
        </Pressable>
      </View>

      {/* La intensidad NO es otro raíl segmentado: eran dos controles gemelos
          apilados (mismo alto, mismos chips, activo relleno de oro) para dos
          ejes distintos, y ninguno decía qué filtraba. Aquí va rotulada y en
          chips de filtro —más pequeños, a la izquierda, con su velocímetro y
          el activo en oro apagado—, que se leen como lo que son: un filtro
          sobre la lista que manda el raíl de arriba. */}
      {(intensityOpen || intensity !== 'all') && (
        <View style={styles.filterGroup}>
          <Text style={styles.sectionEyebrow}>{t('Intensidad')}</Text>
          <View style={styles.filterChips}>
            {intensityOptions.map((option) => {
              const activeChip = option.id === intensity;
              const color = activeChip
                ? theme.colors.primary
                : theme.colors.textSecondary;
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.filterChip,
                    activeChip && styles.filterChipActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setIntensity(option.id)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: activeChip }}
                >
                  {!!option.icon && (
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={14}
                      color={color}
                    />
                  )}
                  <Text style={[styles.filterChipText, { color }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* El campo de buscar personas, desplegado BAJO los filtros. Antes era una
          caja permanente encima del tablón para algo puntual; ahora cuelga de su
          lupa, junto al filtro de intensidad. Sigue montado mientras haya texto
          aunque se pliegue: un filtro activo no puede quedar escondido (misma
          regla que la intensidad y su punto). */}
      {(searchOpen || showingSearch) && (
        <View style={styles.searchBox}>
          <MaterialCommunityIcons
            name="account-search-outline"
            size={20}
            color={theme.colors.textMuted}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t('Buscar personas')}
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {showingSearch && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={theme.colors.textMuted}
              />
            </Pressable>
          )}
        </View>
      )}

      {/* Los resultados, pegados a su campo: una sección rotulada con su cierre,
          y el tablón sigue debajo. Buscar es un filtro temporal, no un modo que
          sustituya la pantalla. */}
      {showingSearch && (
        <View style={styles.peopleSection}>
          <Text style={styles.sectionEyebrow}>{t('Personas')}</Text>
          {searchResults.length > 0 ? (
            searchResults.map(renderUserRow)
          ) : (
            <Text style={styles.muted}>
              {searching ? t('Buscando…') : t('Sin resultados')}
            </Text>
          )}
          {/* Cierre de la sección: debajo vuelve a empezar el tablón. */}
          <View style={styles.sectionEnd} />
        </View>
      )}
    </View>
  );

  // Estado vacío de la lista (según buscando / cargando / error / sin datos).
  const listEmpty = loading ? (
    <View style={styles.loadingBox}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={styles.muted}>{t('Cargando…')}</Text>
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
          : t('Sigue a alguien para ver aquí sus rutinas públicas.')}
      </Text>
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

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

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
            paddingTop: topBarHeight + 28,
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
        subtitle={t('Descubre y comparte rutinas')}
        topInset={insets.top}
      />

      {/* Barra de navegación fija en app/App.tsx (fuera del pager). */}

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
    meCount: { alignItems: 'center', minWidth: 54 },
    meCountValue: {
      color: theme.colors.primary,
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 21,
    },
    meCountLabel: { color: theme.colors.textMuted, fontSize: 11 },
    newFollowersBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primaryFill,
    },
    newFollowersText: {
      flex: 1,
      color: theme.colors.onGold,
      fontSize: 14,
      fontWeight: '800',
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
    // Sección de resultados de personas: vive ENCIMA del tablón, no en su
    // lugar. El separador de abajo es su cierre.
    peopleSection: { gap: 8 },
    sectionEnd: {
      marginTop: 4,
      height: 1,
      backgroundColor: theme.colors.border,
    },
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
    filterGroup: { gap: 8 },
    filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    // Activo en oro APAGADO (contorno + fondo velado), no relleno macizo: el
    // relleno de oro es del raíl de pestañas, que es el control que manda.
    filterChipActive: {
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.primaryMuted,
    },
    filterChipText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.1 },
    // Raíl de pestañas + botón de intensidad en la misma línea.
    railRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    railFilter: {
      flex: 1,
    },
    intensityButton: {
      width: 42,
      height: 42,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    intensityButtonActive: {
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.primaryMuted,
    },
    // Punto de "hay un filtro puesto" sobre el icono.
    intensityDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primaryFill,
    },
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
    // Firma y título, juntos y apretados: son la misma idea (qué rutina es y de
    // quién), y el resto de la tarjeta respira con el `gap` de la tarjeta.
    cardHead: { gap: 6 },
    // Fila de autor pulsable (foto + "por X"), igual que en la ficha de una
    // rutina pública. `alignSelf` para que la diana mida lo que mide el texto y
    // no toda la anchura de la tarjeta, que ya es otro botón.
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    // Pie: intensidad y series a la izquierda, acciones a la derecha.
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    footerSpacer: { flex: 1 },
    commentCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { color: theme.colors.textSecondary, fontSize: 13 },
    routineName: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 24,
    },
    author: { color: theme.colors.textMuted, fontSize: 13, flexShrink: 1 },
    description: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 19,
    },
    likeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.surfaceAlt,
    },
    likeCount: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: '800',
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
    loadingBox: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
