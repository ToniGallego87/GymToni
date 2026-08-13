import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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
  likeRoutine,
  unlikeRoutine,
  cloneablePublicRoutine,
  PopularRoutine,
} from '@lib/cloud/social';

interface CommunityScreenProps {
  onBack: () => void;
  onOpenProfile?: (userId: string, name: string) => void;
}

// Tablón de rutinas populares (Fase 4). Lista las rutinas públicas por nº de
// likes; permite dar/quitar like (con sesión) y clonar cualquiera a tus rutinas.
export function CommunityScreen({
  onBack,
  onOpenProfile,
}: CommunityScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const { user } = useSession();

  const [routines, setRoutines] = useState<PopularRoutine[]>([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoutines(await getPopularRoutines());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleLike = async (item: PopularRoutine) => {
    if (!user) {
      notify(t('Inicia sesión para dar like'), 'error');
      return;
    }
    const liked = item.liked_by_me;
    // Optimista: refleja el like al instante y revierte si falla.
    setRoutines((prev) =>
      prev.map((r) =>
        r.id === item.id
          ? { ...r, liked_by_me: !liked, likes: r.likes + (liked ? -1 : 1) }
          : r
      )
    );
    try {
      if (liked) await unlikeRoutine(item.id, user.id);
      else await likeRoutine(item.id, user.id);
    } catch (e) {
      setRoutines((prev) =>
        prev.map((r) =>
          r.id === item.id
            ? { ...r, liked_by_me: liked, likes: r.likes + (liked ? 1 : -1) }
            : r
        )
      );
      notify((e as Error).message, 'error');
    }
  };

  const handleClone = async (item: PopularRoutine) => {
    setCloningId(item.id);
    try {
      // Ids nuevos (como al duplicar una propia) para no cruzar historiales.
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
        ) : routines.length === 0 ? (
          <View style={styles.card}>
            <GradientFill accent={theme.colors.primaryLine} />
            <Text style={styles.emptyTitle}>{t('Aún no hay rutinas')}</Text>
            <Text style={styles.hint}>
              {t(
                'Publica una de tus rutinas desde su detalle para que aparezca aquí.'
              )}
            </Text>
          </View>
        ) : (
          routines.map((item) => (
            <View key={item.id} style={styles.card}>
              <GradientFill accent={theme.colors.primaryLine} />
              <View style={styles.cardHeader}>
                <View style={styles.cardInfo}>
                  <Text style={styles.routineName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {/* El autor es pulsable: abre su perfil público. */}
                  <Pressable
                    onPress={() =>
                      onOpenProfile?.(
                        item.owner_id,
                        item.author_name || t('Anónimo')
                      )
                    }
                    hitSlop={6}
                    disabled={!onOpenProfile}
                  >
                    <Text style={styles.author} numberOfLines={1}>
                      {t('por {name}', {
                        name: item.author_name || t('Anónimo'),
                      })}
                    </Text>
                  </Pressable>
                </View>
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
      </StretchScrollView>

      <GlassTopBar
        title={t('Comunidad')}
        icon="account-group-outline"
        subtitle={t('Rutinas populares de otros usuarios')}
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
    card: {
      borderRadius: 20,
      overflow: 'hidden',
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    cardInfo: { flex: 1, minWidth: 0 },
    routineName: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 24,
    },
    author: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
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
    pressed: { opacity: 0.6 },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    hint: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
    muted: { color: theme.colors.textMuted, fontSize: 14 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
