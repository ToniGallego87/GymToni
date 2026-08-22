import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  StretchScrollView,
} from '@components';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import { useSession } from '@lib/cloud/auth';
import {
  getFollowingProfiles,
  getFollowerProfiles,
  ProfileLite,
} from '@lib/cloud/social';

interface FollowingScreenProps {
  // 'following' = a quién sigo; 'followers' = quién me sigue.
  mode: 'following' | 'followers';
  onBack: () => void;
  onOpenProfile?: (userId: string, name: string) => void;
}

// Lista de personas (seguidos o seguidores). Cada una abre su perfil.
export function FollowingScreen({
  mode,
  onBack,
  onOpenProfile,
}: FollowingScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  // Misma altura del "Volver" que el resto de pantallas.
  const floatingBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const backButtonSpace = FLOATING_BACK_BUTTON_HEIGHT + floatingBackBottom;

  const load = useCallback(async () => {
    if (!user) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setProfiles(
        mode === 'followers'
          ? await getFollowerProfiles(user.id)
          : await getFollowingProfiles(user.id)
      );
    } catch {
      // Silencioso: la lista queda vacía si falla.
    } finally {
      setLoading(false);
    }
  }, [user?.id, mode]);

  useEffect(() => {
    load();
  }, [load]);

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
        ) : profiles.length === 0 ? (
          <Text style={styles.muted}>
            {mode === 'followers'
              ? t('Aún no te sigue nadie.')
              : t('Aún no sigues a nadie. Busca usuarios en Comunidad.')}
          </Text>
        ) : (
          profiles.map((p) => (
            <Pressable
              key={p.id}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() =>
                onOpenProfile?.(p.id, p.display_name || t('Anónimo'))
              }
            >
              <Avatar uri={p.avatar_url} size={44} />
              <Text style={styles.name} numberOfLines={1}>
                {p.display_name || t('Anónimo')}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          ))
        )}
      </StretchScrollView>

      <GlassTopBar
        title={mode === 'followers' ? t('Seguidores') : t('A quién sigo')}
        icon="account-multiple-outline"
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, gap: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    name: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    pressed: { opacity: 0.6 },
    muted: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
