import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
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
  getProfile,
  getUserPublicRoutines,
  getFollowerCount,
  isFollowing,
  followUser,
  unfollowUser,
  cloneablePublicRoutine,
  Profile,
  PublicRoutineSummary,
} from '@lib/cloud/social';

interface UserProfileScreenProps {
  userId: string;
  name: string;
  onBack: () => void;
  // Abre una rutina pública en solo lectura (mismo destino que el tablón).
  onOpenRoutine?: (routineId: string, name: string, authorName: string) => void;
}

// Perfil público de otro usuario (Fase 4): nombre, bio, seguidores, botón de
// seguir y sus rutinas públicas (clonables). Solo lectura de lo ajeno.
export function UserProfileScreen({
  userId,
  name,
  onBack,
  onOpenRoutine,
}: UserProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const { user } = useSession();
  const isSelf = user?.id === userId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [routines, setRoutines] = useState<PublicRoutineSummary[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyFollow, setBusyFollow] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  // Misma altura del "Volver" que el resto de pantallas.
  const floatingBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const backButtonSpace = FLOATING_BACK_BUTTON_HEIGHT + floatingBackBottom;

  const notify = (message: string, type: 'success' | 'error') =>
    setToast({ message, type });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prof, routs, follc, foll] = await Promise.all([
        getProfile(userId),
        getUserPublicRoutines(userId),
        getFollowerCount(userId),
        user && user.id !== userId
          ? isFollowing(user.id, userId)
          : Promise.resolve(false),
      ]);
      setProfile(prof);
      setRoutines(routs);
      setFollowers(follc);
      setFollowing(foll);
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleFollow = async () => {
    if (!user) {
      notify(t('Inicia sesión para seguir'), 'error');
      return;
    }
    const next = !following;
    setBusyFollow(true);
    setFollowing(next);
    setFollowers((n) => n + (next ? 1 : -1));
    try {
      if (next) await followUser(user.id, userId);
      else await unfollowUser(user.id, userId);
    } catch (e) {
      setFollowing(!next);
      setFollowers((n) => n + (next ? -1 : 1));
      notify((e as Error).message, 'error');
    } finally {
      setBusyFollow(false);
    }
  };

  const handleClone = async (routineId: string) => {
    setCloningId(routineId);
    try {
      const clone = await cloneablePublicRoutine(
        routineId,
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

  const displayName = profile?.display_name || name;

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
        <View style={styles.card}>
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.headerRow}>
            <Avatar uri={profile?.avatar_url} size={52} />
            <View style={styles.headerInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.followers}>
                {followers === 1
                  ? t('1 seguidor')
                  : t('{n} seguidores', { n: followers })}
              </Text>
            </View>
          </View>

          {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          {!isSelf && (
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

        <Text style={styles.sectionTitle}>{t('Rutinas públicas')}</Text>

        {loading ? (
          <Text style={styles.muted}>{t('Cargando…')}</Text>
        ) : routines.length === 0 ? (
          <Text style={styles.muted}>
            {t('Este usuario no tiene rutinas públicas.')}
          </Text>
        ) : (
          routines.map((r) => (
            <Pressable
              key={r.id}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={() => onOpenRoutine?.(r.id, r.name, displayName)}
              disabled={!onOpenRoutine}
              accessibilityRole="button"
              accessibilityLabel={t('Ver rutina')}
            >
              <GradientFill accent={theme.colors.primaryLine} />
              <Text style={styles.routineName} numberOfLines={1}>
                {r.name}
              </Text>
              {!!r.description && (
                <Text style={styles.description} numberOfLines={2}>
                  {r.description}
                </Text>
              )}
              <Button
                title={
                  cloningId === r.id
                    ? t('Añadiendo…')
                    : t('Añadir a mis rutinas')
                }
                onPress={() => handleClone(r.id)}
                variant="secondary"
                disabled={cloningId !== null}
              />
            </Pressable>
          ))
        )}
      </StretchScrollView>

      <GlassTopBar
        title={displayName}
        icon="account-circle-outline"
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

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
    name: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 26,
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
    sectionTitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 4,
    },
    routineName: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 24,
    },
    description: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 19,
    },
    muted: { color: theme.colors.textMuted, fontSize: 14 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
