import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
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
  Button,
  FloatingPrimaryNav,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  SegmentedFilter,
  Toast,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { hasAnyCardio } from '@lib/cardio';
import { theme } from '@lib/theme';
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
  cloneablePublicRoutine,
  PopularRoutine,
  FeedRoutine,
  ProfileLite,
} from '@lib/cloud/social';

interface CommunityScreenProps {
  // La pantalla se mantiene montada (keep-alive) aunque no se vea; `active` dice
  // si está a la vista, para consultar la nube solo entonces.
  active?: boolean;
  onOpenProfile?: (userId: string, name: string) => void;
  onOpenFollowing?: () => void;
  onOpenFollowers?: () => void;
  onNavigateHome?: () => void;
  onNavigateCardio?: () => void;
  onNavigateCalendar?: () => void;
  onNavigateProfile?: () => void;
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
}

// Caché en memoria del último tablón/feed (por pestaña), para pintar al instante
// al reabrir Comunidad y refrescar en segundo plano. Vive a nivel de módulo, así
// que sobrevive a desmontar/montar la pantalla (es una pestaña de la barra).
const boardCache: Record<
  Tab,
  { items: RoutineItem[]; avatars: Map<string, ProfileLite> } | undefined
> = { popular: undefined, following: undefined };

// Avatar pequeño (foto del autor) o marcador si no tiene.
function Avatar({ uri, size = 40 }: { uri: string | null; size?: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatarPlaceholder,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <MaterialCommunityIcons
        name="account"
        size={size * 0.6}
        color={theme.colors.textMuted}
      />
    </View>
  );
}

export function CommunityScreen({
  active = true,
  onOpenProfile,
  onOpenFollowing,
  onOpenFollowers,
  onNavigateHome,
  onNavigateCardio,
  onNavigateCalendar,
  onNavigateProfile,
}: CommunityScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const { user } = useSession();
  const [newFollowers, setNewFollowers] = useState(0);

  const [tab, setTab] = useState<Tab>('popular');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileLite[]>([]);
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
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: floatingNavBottom, scrollBottomPadding } =
    getFloatingPrimaryNavMetrics(insets.bottom);

  const notify = (message: string, type: 'success' | 'error') =>
    setToast({ message, type });

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

  // Búsqueda de usuarios, con un pequeño retardo para no consultar en cada tecla.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      searchProfiles(q)
        .then((r) => {
          if (active) setSearchResults(r);
        })
        .catch(() => {});
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Aviso de nuevos seguidores desde la última visita a Comunidad. Comparamos el
  // recuento actual con el guardado (por usuario) en AsyncStorage. No es una
  // notificación push (eso exigiría servidor): es un aviso al abrir la pantalla.
  useEffect(() => {
    if (!user || !active) return;
    let alive = true;
    const key = `gymbro_followers_seen_${user.id}`;
    // Tras el primer render, para no sumar red al abrir la pantalla.
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const count = await getFollowerCount(user.id);
        const raw = await AsyncStorage.getItem(key);
        const seen = raw != null ? Number(raw) : count;
        if (alive && count > seen) setNewFollowers(count - seen);
        await AsyncStorage.setItem(key, String(count));
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
      notify(t('Inicia sesión para dar like'), 'error');
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

  const handleClone = async (item: RoutineItem) => {
    setCloningId(item.id);
    try {
      const clone = await cloneablePublicRoutine(
        item.id,
        state.routines.map((r) => r.name)
      );
      if (!clone) {
        notify(t('Esta rutina ya no está disponible'), 'error');
        return;
      }
      dispatch({ type: 'ADD_ROUTINE', payload: clone });
      notify(t('Añadida a tus rutinas'), 'success');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setCloningId(null);
    }
  };

  const showingSearch = query.trim().length > 0;

  const renderUserRow = (p: ProfileLite) => (
    <Pressable
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
    <View style={styles.card}>
      <GradientFill accent={theme.colors.primaryLine} />
      <View style={styles.cardHeader}>
        <Pressable
          onPress={() => onOpenProfile?.(item.owner_id, authorName(item))}
          hitSlop={6}
          disabled={!onOpenProfile}
        >
          <Avatar uri={avatars.get(item.owner_id)?.avatar_url ?? null} />
        </Pressable>
        <View style={styles.cardInfo}>
          <Text style={styles.routineName} numberOfLines={1}>
            {item.name}
          </Text>
          <Pressable
            onPress={() => onOpenProfile?.(item.owner_id, authorName(item))}
            hitSlop={6}
            disabled={!onOpenProfile}
          >
            <Text style={styles.author} numberOfLines={1}>
              {t('por {name}', { name: authorName(item) })}
            </Text>
          </Pressable>
        </View>
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

      {!!item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <Button
        title={
          cloningId === item.id ? t('Añadiendo…') : t('Añadir a mis rutinas')
        }
        onPress={() => handleClone(item)}
        variant="secondary"
        disabled={cloningId !== null}
      />
    </View>
  );

  // Cabecera fija de la lista (aviso + buscador + pestañas). Va como
  // ListHeaderComponent para que la FlatList virtualice solo las tarjetas.
  const header = (
    <View style={styles.headerGap}>
      {newFollowers > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.newFollowersBanner,
            pressed && styles.pressed,
          ]}
          onPress={() => {
            setNewFollowers(0);
            onOpenFollowers?.();
          }}
        >
          <MaterialCommunityIcons
            name="account-heart"
            size={20}
            color={theme.colors.onGold}
          />
          <Text style={styles.newFollowersText}>
            {newFollowers === 1
              ? t('Tienes 1 nuevo seguidor')
              : t('Tienes {n} nuevos seguidores', { n: newFollowers })}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.colors.onGold}
          />
        </Pressable>
      )}

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={theme.colors.textMuted}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t('Buscar usuarios')}
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
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
        {!!onOpenFollowing && (
          <Pressable
            style={({ pressed }) => [
              styles.followingButton,
              pressed && styles.pressed,
            ]}
            onPress={onOpenFollowing}
            accessibilityRole="button"
            accessibilityLabel={t('A quién sigo')}
          >
            <MaterialCommunityIcons
              name="account-multiple-outline"
              size={22}
              color={theme.colors.text}
            />
          </Pressable>
        )}
      </View>

      {!showingSearch && (
        <SegmentedFilter
          options={[
            { id: 'popular', label: t('Populares') },
            { id: 'following', label: t('Siguiendo') },
          ]}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />
      )}
    </View>
  );

  // Estado vacío de la lista (según buscando / cargando / error / sin datos).
  const listEmpty = showingSearch ? (
    <Text style={styles.muted}>{t('Sin resultados')}</Text>
  ) : loading ? (
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

  const data: (RoutineItem | ProfileLite)[] = showingSearch
    ? searchResults
    : items;

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

      <FlatList
        style={styles.scroll}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          showingSearch
            ? renderUserRow(item as ProfileLite)
            : renderRoutineCard(item as RoutineItem)
        }
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
          showingSearch ? undefined : (
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
          )
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

      <FloatingPrimaryNav
        bottom={floatingNavBottom}
        activeTab="community"
        showCardio={hasAnyCardio(state.logs)}
        onPressHome={onNavigateHome}
        onPressCardio={onNavigateCardio}
        onPressCalendar={onNavigateCalendar}
        onPressProfile={onNavigateProfile}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
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
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    searchBox: {
      flex: 1,
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
    followingButton: {
      width: 46,
      height: 46,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    card: {
      borderRadius: 20,
      overflow: 'hidden',
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardInfo: { flex: 1, minWidth: 0 },
    routineName: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 24,
    },
    author: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
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
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
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
