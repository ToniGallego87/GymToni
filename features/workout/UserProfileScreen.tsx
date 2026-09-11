import React, { useCallback, useEffect, useState } from 'react';
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
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  ReportModal,
  SaveRoutineButton,
  Toast,
  StretchScrollView,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import { findSavedRoutine } from '@lib/routines';
import { hideId } from '@lib/moderation';
import { useSession } from '@lib/cloud/auth';
import {
  getProfile,
  getUserPublicRoutines,
  getFollowerCount,
  isFollowing,
  followUser,
  unfollowUser,
  linkablePublicRoutine,
  reportContent,
  Profile,
  PublicRoutineSummary,
} from '@lib/cloud/social';

interface UserProfileScreenProps {
  userId: string;
  name: string;
  onBack: () => void;
  // Abre una rutina pública en solo lectura (mismo destino que el tablón).
  onOpenRoutine?: (routineId: string, name: string, authorName: string) => void;
  // Pantalla de cuenta (Datos y nube): destino del aviso de "inicia sesión".
  onOpenAccount?: () => void;
}

// Perfil público de otro usuario (Fase 4): nombre, bio, seguidores, botón de
// seguir y sus rutinas públicas (adoptables). Solo lectura de lo ajeno.
export function UserProfileScreen({
  userId,
  name,
  onBack,
  onOpenRoutine,
  onOpenAccount,
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
  const [savingId, setSavingId] = useState<string | null>(null);
  // Reportar el perfil: null = cerrado, 'open' = preguntando, 'busy' = enviando.
  const [reporting, setReporting] = useState<'open' | 'busy' | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    // Aviso con salida: "inicia sesión para…" lleva a la pantalla de cuenta.
    action?: 'sign-in';
  } | null>(null);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
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
      notifySignIn(t('Inicia sesión para seguir'));
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

  const displayName = profile?.display_name || name;

  const handleReport = async (reason: string) => {
    if (!user) {
      setReporting(null);
      notifySignIn(t('Inicia sesión para reportar'));
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

  // Añadir enlaza la rutina de esta persona (no la copia): se entrena tal cual
  // y sigue siendo suya. La copia se saca luego, al querer editarla.
  const handleSave = async (routineId: string) => {
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
              {/* Guardar es una píldora al lado del nombre, no un CTA a fila
                  completa: así caben más rutinas de un vistazo. */}
              <View style={styles.routineHeader}>
                <Text style={styles.routineName} numberOfLines={1}>
                  {r.name}
                </Text>
                <SaveRoutineButton
                  saved={!!findSavedRoutine(state.routines, r.id)}
                  busy={savingId === r.id}
                  onPress={() => handleSave(r.id)}
                />
              </View>
              {!!r.description && (
                <Text style={styles.description} numberOfLines={2}>
                  {r.description}
                </Text>
              )}
            </Pressable>
          ))
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
        icon="account-circle-outline"
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
    routineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    routineName: {
      flex: 1,
      minWidth: 0,
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
