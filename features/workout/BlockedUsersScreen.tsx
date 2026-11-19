import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  StretchScrollView,
  Toast,
  useGlassTopBarHeight,
} from '@components';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import { useSession } from '@lib/cloud/auth';
import { getProfilesByIds, ProfileLite } from '@lib/cloud/social';
import { registerSocialMemoryCache } from '@lib/socialCache';
import { setUserBlocked, useBlockedUsers } from '@hooks/useBlockedUsers';

interface BlockedUsersScreenProps {
  onBack: () => void;
  onOpenProfile?: (userId: string, name: string) => void;
}

// Nombre y foto de cada bloqueado ya traídos: al volver de un perfil la lista
// sale al instante. Es de la cuenta que miraba (lib/socialCache.ts).
const profileCache = new Map<string, ProfileLite>();
registerSocialMemoryCache(() => profileCache.clear());

/**
 * Cuentas bloqueadas (Configuración), cada una con su "Desbloquear". Sin esta
 * lista solo se podía desbloquear desde el perfil del bloqueado, y llegar a él
 * costaba: sus rutinas ya no salen en el tablón ni en la búsqueda.
 *
 * Un perfil privado que no te sigue no se puede leer (RLS): sale como "Perfil
 * privado", sin abrirse, pero se puede desbloquear igual.
 */
export function BlockedUsersScreen({
  onBack,
  onOpenProfile,
}: BlockedUsersScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const blocked = useBlockedUsers();
  const ids = [...blocked];
  const idsKey = ids.join(',');

  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(
    () => new Map(profileCache)
  );
  const [loading, setLoading] = useState(
    () => !ids.every((id) => profileCache.has(id))
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  // Nombres y fotos de los que aún no se tienen.
  useEffect(() => {
    const missing = idsKey
      ? idsKey.split(',').filter((id) => !profileCache.has(id))
      : [];
    if (!missing.length) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getProfilesByIds(missing)
      .then((found) => {
        found.forEach((profile, id) => profileCache.set(id, profile));
        if (active) setProfiles(new Map(profileCache));
      })
      .catch(() => {
        // Sin red: se pintan sin nombre, y se pueden desbloquear igual.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [idsKey]);

  const handleUnblock = async (id: string, name: string) => {
    if (!user) return;
    setBusyId(id);
    try {
      await setUserBlocked(user.id, id, false);
      setToast({
        message: t('Has desbloqueado a {name}', { name }),
        type: 'success',
      });
    } catch (e) {
      setToast({ message: (e as Error).message, type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const subtitle =
    ids.length === 0
      ? t('Nadie bloqueado')
      : ids.length === 1
      ? t('1 cuenta')
      : t('{n} cuentas', { n: ids.length });

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
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hint}>
          {t(
            'No ves sus rutinas, comentarios ni actividad, y no pueden seguirte ni comentar tus rutinas. No se les avisa al bloquearlas ni al desbloquearlas.'
          )}
        </Text>

        {ids.length === 0 ? (
          <Text style={styles.muted}>
            {t(
              'No has bloqueado a nadie. Se bloquea desde el perfil de cada persona.'
            )}
          </Text>
        ) : (
          ids.map((id) => {
            const profile = profiles.get(id);
            const known = !!profile?.display_name;
            const name = profile?.display_name || t('Perfil privado');
            const row = (
              <>
                <Avatar uri={profile?.avatar_url ?? null} size={44} />
                <Text
                  style={[styles.name, !known && styles.namePrivate]}
                  numberOfLines={1}
                >
                  {!profile && loading ? t('Cargando…') : name}
                </Text>
              </>
            );
            return (
              <View key={id} style={styles.row}>
                {known && onOpenProfile ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.identity,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => onOpenProfile(id, name)}
                    accessibilityRole="button"
                    accessibilityLabel={name}
                  >
                    {row}
                  </Pressable>
                ) : (
                  <View style={styles.identity}>{row}</View>
                )}
                <Button
                  title={busyId === id ? t('Guardando…') : t('Desbloquear')}
                  variant="secondary"
                  size="small"
                  onPress={() => handleUnblock(id, name)}
                  disabled={busyId !== null}
                />
              </View>
            );
          })
        )}

        {loading && ids.length > 0 && profiles.size === 0 && (
          <ActivityIndicator color={theme.colors.primary} />
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Cuentas bloqueadas')}
        subtitle={subtitle}
        icon="account-cancel-outline"
        topInset={insets.top}
        onLayout={onTopBarLayout}
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
    content: { paddingHorizontal: theme.spacing.md, gap: 10 },
    hint: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    identity: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minWidth: 0,
    },
    name: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    namePrivate: { color: theme.colors.textSecondary, fontStyle: 'italic' },
    pressed: { opacity: 0.6 },
    muted: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
