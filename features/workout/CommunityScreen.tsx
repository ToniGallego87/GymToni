import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  SegmentedFilter,
  Toast,
  StretchScrollView,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import { useSession } from '@lib/cloud/auth';
import {
  getPopularRoutines,
  getFollowingFeed,
  searchProfiles,
  getProfilesByIds,
  likeRoutine,
  unlikeRoutine,
  cloneablePublicRoutine,
  PopularRoutine,
  FeedRoutine,
  ProfileLite,
} from '@lib/cloud/social';

interface CommunityScreenProps {
  onBack: () => void;
  onOpenProfile?: (userId: string, name: string) => void;
  onOpenFollowing?: () => void;
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
  onBack,
  onOpenProfile,
  onOpenFollowing,
}: CommunityScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const { user } = useSession();

  const [tab, setTab] = useState<Tab>('popular');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileLite[]>([]);
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [avatars, setAvatars] = useState<Map<string, ProfileLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const backButtonSpace =
    FLOATING_BACK_BUTTON_HEIGHT + FLOATING_BACK_BUTTON_MARGIN + insets.bottom;

  const notify = (message: string, type: 'success' | 'error') =>
    setToast({ message, type });

  // Trae la foto/nombre de los autores para pintar el avatar en cada rutina.
  const enrichAvatars = useCallback(async (ownerIds: string[]) => {
    try {
      setAvatars(await getProfilesByIds(ownerIds));
    } catch {
      // El avatar es decorativo: si falla, se sigue con el marcador.
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'popular') {
        const rows = await getPopularRoutines();
        setItems(rows);
        await enrichAvatars(rows.map((r) => r.owner_id));
      } else {
        if (!user) {
          setItems([]);
          return;
        }
        const rows = await getFollowingFeed(user.id);
        setItems(rows.map((r: FeedRoutine) => ({ ...r, author_name: null })));
        await enrichAvatars(rows.map((r) => r.owner_id));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, user?.id, enrichAvatars]);

  useEffect(() => {
    load();
  }, [load]);

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
        keyboardShouldPersistTaps="handled"
      >
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

        {showingSearch ? (
          searchResults.length === 0 ? (
            <Text style={styles.muted}>{t('Sin resultados')}</Text>
          ) : (
            searchResults.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [
                  styles.userRow,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  onOpenProfile?.(p.id, p.display_name || t('Anónimo'))
                }
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
            ))
          )
        ) : (
          <>
            <SegmentedFilter
              options={[
                { id: 'popular', label: t('Populares') },
                { id: 'following', label: t('Siguiendo') },
              ]}
              value={tab}
              onChange={(id) => setTab(id as Tab)}
            />

            {loading ? (
              <Text style={styles.muted}>{t('Cargando…')}</Text>
            ) : error ? (
              <View style={styles.card}>
                <GradientFill accent={theme.colors.error} />
                <Text style={styles.hint}>{error}</Text>
                <Button
                  title={t('Reintentar')}
                  onPress={load}
                  variant="secondary"
                />
              </View>
            ) : items.length === 0 ? (
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
            ) : (
              items.map((item) => (
                <View key={item.id} style={styles.card}>
                  <GradientFill accent={theme.colors.primaryLine} />
                  <View style={styles.cardHeader}>
                    <Pressable
                      onPress={() =>
                        onOpenProfile?.(item.owner_id, authorName(item))
                      }
                      hitSlop={6}
                      disabled={!onOpenProfile}
                    >
                      <Avatar
                        uri={avatars.get(item.owner_id)?.avatar_url ?? null}
                      />
                    </Pressable>
                    <View style={styles.cardInfo}>
                      <Text style={styles.routineName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Pressable
                        onPress={() =>
                          onOpenProfile?.(item.owner_id, authorName(item))
                        }
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
                      cloningId === item.id
                        ? t('Añadiendo…')
                        : t('Añadir a mis rutinas')
                    }
                    onPress={() => handleClone(item)}
                    variant="secondary"
                    disabled={cloningId !== null}
                  />
                </View>
              ))
            )}
          </>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Comunidad')}
        icon="account-group-outline"
        subtitle={t('Descubre y comparte rutinas')}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={insets.bottom} />

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
    content: { paddingHorizontal: 16, gap: 12 },
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
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
