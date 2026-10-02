import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppModal,
  Avatar,
  Button,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  StretchScrollView,
} from '@components';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import { useSession } from '@lib/cloud/auth';
import { readSocialCache, writeSocialCache } from '@lib/socialCache';
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

/**
 * Lo último que se trajo de cada lista, por modo y usuario. La navegación
 * desmonta la pantalla, así que sin esto entrar y salir de un perfil ponía la
 * lista a "Cargando…" otra vez para traer lo mismo. Con la copia se pinta al
 * instante y se refresca por detrás (mismo patrón que el `boardCache` del
 * tablón y el `profileCache` del perfil). Además se guarda en disco
 * (lib/socialCache.ts), porque esta copia en memoria muere al cerrar la app y
 * cada arranque volvía a esperar a la red para enseñar lo mismo.
 */
const listCache = new Map<string, ProfileLite[]>();

const cacheKey = (mode: string, userId: string) => `${mode}:${userId}`;

// Lista de personas (seguidos o seguidores). Cada una abre su perfil.
export function FollowingScreen({
  mode,
  onBack,
  onOpenProfile,
}: FollowingScreenProps) {
  const insets = useSafeAreaInsets();
  const { user, loading: sessionLoading } = useSession();

  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  // Arranca cargando: hasta que la sesión se resuelve no se sabe si hay lista,
  // y dar por hecho que está vacía era lo que colaba un "no te sigue nadie"
  // entre la rueda y los datos.
  const [loading, setLoading] = useState(true);
  const [privateNotice, setPrivateNotice] = useState(false);

  // Subtítulo de la barra: el recuento en cuanto hay lista, y qué es la lista
  // mientras carga o si está vacía (el cuerpo ya se encarga de ese caso).
  const listSubtitle =
    profiles.length === 0 || sessionLoading || loading
      ? mode === 'followers'
        ? t('Quién sigue tus entrenos')
        : t('Perfiles que sigues')
      : mode === 'followers'
      ? profiles.length === 1
        ? t('1 persona te sigue')
        : t('{n} personas te siguen', { n: profiles.length })
      : profiles.length === 1
      ? t('Sigues a 1 persona')
      : t('Sigues a {n} personas', { n: profiles.length });

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  // Misma altura del "Volver" que el resto de pantallas.
  const { bottom: floatingBackBottom } = getFloatingBackButtonMetrics(
    insets.bottom
  );
  const backButtonSpace = FLOATING_BACK_BUTTON_HEIGHT + floatingBackBottom;

  const load = useCallback(async () => {
    // Sesión sin resolver todavía: no se sabe de quién es la lista, así que no
    // hay nada que cargar NI que vaciar. Al llegar, este efecto se repite.
    if (sessionLoading) return;
    if (!user) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    const key = cacheKey(mode, user.id);
    // Lo de la última visita, ya: se pinta al instante y el refresco de abajo
    // ocurre por detrás, sin devolver la rueda sobre datos buenos. En memoria si
    // la app sigue abierta desde entonces; si no, la copia de disco.
    const hit = listCache.get(key) ?? (await readSocialCache<ProfileLite[]>(key));
    if (hit?.length) {
      listCache.set(key, hit);
      setProfiles(hit);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const rows =
        mode === 'followers'
          ? await getFollowerProfiles(user.id)
          : await getFollowingProfiles(user.id);
      setProfiles(rows);
      listCache.set(key, rows);
      writeSocialCache(key, rows);
    } catch {
      // Silencioso: si falla se queda lo que hubiera (la copia de la última
      // visita, o la lista vacía en la primera).
    } finally {
      setLoading(false);
    }
  }, [user?.id, mode, sessionLoading]);

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
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
            paddingBottom: backButtonSpace + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {profiles.length === 0 && (sessionLoading || loading) ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.muted}>{t('Cargando…')}</Text>
          </View>
        ) : profiles.length === 0 ? (
          <Text style={styles.muted}>
            {mode === 'followers'
              ? t('Aún no te sigue nadie.')
              : t('Aún no sigues a nadie. Busca usuarios en Comunidad.')}
          </Text>
        ) : (
          profiles.map((p) =>
            p.private && !p.display_name && !p.avatar_url ? (
              // Perfil privado SIN relación (la RLS no lo devuelve): sale en
              // la lista (si no, el contador no cuadra) pero no se puede
              // abrir; tocarlo lo explica. Con relación llega entero y se
              // pinta abajo como uno más, con candado.
              <Pressable
                key={p.id}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => setPrivateNotice(true)}
                accessibilityRole="button"
                accessibilityLabel={t('Perfil privado')}
              >
                <Avatar uri={null} size={44} />
                <Text
                  style={[styles.name, styles.namePrivate]}
                  numberOfLines={1}
                >
                  {t('Perfil privado')}
                </Text>
                <MaterialCommunityIcons
                  name="lock-outline"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            ) : (
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
                {p.private && (
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                )}
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            )
          )
        )}
      </StretchScrollView>

      <AppModal
        visible={privateNotice}
        onRequestClose={() => setPrivateNotice(false)}
        onOverlayPress={() => setPrivateNotice(false)}
        icon="lock-outline"
        title={t('Perfil privado')}
        message={t(
          'Esta persona tiene el perfil en privado: solo ella puede verlo.'
        )}
        footer={
          <Button
            title={t('Entendido')}
            variant="secondary"
            onPress={() => setPrivateNotice(false)}
          />
        }
      />

      <GlassTopBar
        title={mode === 'followers' ? t('Seguidores') : t('A quién sigo')}
        // Cuántos son: la lista no lo dice en ninguna parte y es el dato que se
        // viene a ver. Mientras carga (o si está vacía, que ya lo explica el
        // cuerpo) el subtítulo se queda en lo que ES la lista.
        subtitle={listSubtitle}
        icon="account-multiple-outline"
        topInset={insets.top}
        onLayout={onTopBarLayout}
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
    namePrivate: { color: theme.colors.textSecondary, fontStyle: 'italic' },
    pressed: { opacity: 0.6 },
    muted: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
    // Mismo bloque de carga que el tablón: la rueda y su rótulo, centrados.
    loadingBox: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
