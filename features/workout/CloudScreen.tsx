import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  ConfirmModal,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  OptionToggle,
  Toast,
  StretchScrollView,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t, formatAgo } from '@lib/i18n';
import { useSession, signUp, signIn, signOut } from '@lib/cloud/auth';
import { backupToCloud, restoreFromCloud } from '@lib/cloud/backup';
import { syncNow, markSynced, getLastSync } from '@lib/cloud/sync';
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  getFollowingCount,
  getFollowerCount,
} from '@lib/cloud/social';
import { clearOutbox } from '@lib/db';
import { saveAppData, loadAppData } from '@lib/storage';
import type { WorkoutAppData } from '../../types';

interface CloudScreenProps {
  onBack: () => void;
  onOpenFollowing?: () => void;
  onOpenFollowers?: () => void;
}

export function CloudScreen({
  onBack,
  onOpenFollowing,
  onOpenFollowers,
}: CloudScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const { session, user, loading } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<
    'signin' | 'signup' | 'backup' | 'restore' | 'signout' | 'sync' | null
  >(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  // Perfil público (Fase 4): nombre visible, bio y visibilidad.
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profilePublic, setProfilePublic] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const backButtonSpace =
    FLOATING_BACK_BUTTON_HEIGHT + FLOATING_BACK_BUTTON_MARGIN + insets.bottom;

  const notify = (message: string, type: 'success' | 'error') =>
    setToast({ message, type });

  const currentAppData = (): WorkoutAppData => ({
    routines: state.routines,
    activeRoutineId: state.activeRoutineId,
    selectedRoutineId: state.selectedRoutineId,
    logs: state.logs,
  });

  const handleAuth = async (mode: 'signin' | 'signup') => {
    if (!email.trim() || !password) {
      notify(t('Escribe email y contraseña'), 'error');
      return;
    }
    setBusy(mode);
    try {
      const { data, error } =
        mode === 'signup'
          ? await signUp(email, password)
          : await signIn(email, password);
      if (error) {
        notify(error.message, 'error');
      } else if (mode === 'signup' && !data.session) {
        notify(t('Revisa tu correo para confirmar la cuenta'), 'success');
      } else {
        setPassword('');
        notify(t('Sesión iniciada'), 'success');
      }
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  // Aplica al estado en memoria lo que el sync haya bajado a la BD.
  const refreshFromDb = useCallback(async () => {
    const data = await loadAppData();
    if (data) dispatch({ type: 'SET_APP_DATA', payload: data });
  }, [dispatch]);

  const doSync = useCallback(
    async (announce: boolean) => {
      if (!user) return;
      setBusy('sync');
      try {
        const { pulled } = await syncNow(user.id);
        if (pulled > 0) await refreshFromDb();
        setLastSync(await getLastSync(user.id));
        if (announce) notify(t('Sincronizado'), 'success');
      } catch (e) {
        if (announce) notify((e as Error).message, 'error');
      } finally {
        setBusy(null);
      }
    },
    [user, refreshFromDb]
  );

  // Al abrir la pantalla con sesión: cargar la última sync y sincronizar en
  // silencio (el disparo global también corre; el mutex evita solapes).
  useEffect(() => {
    if (!user) {
      setLastSync(null);
      return;
    }
    let active = true;
    getLastSync(user.id).then((ts) => {
      if (active) setLastSync(ts);
    });
    doSync(false);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleBackup = async () => {
    if (!user) return;
    setBusy('backup');
    try {
      const at = await backupToCloud(currentAppData(), user.id);
      // La nube queda sembrada con este estado: fija el cursor al instante que
      // llevan las filas subidas, para que el pull incremental no rebaje de
      // vuelta todo lo recién subido.
      await markSynced(user.id, at);
      setLastSync(await getLastSync(user.id));
      notify(t('Copia de seguridad subida'), 'success');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!user) return;
    setShowRestoreConfirm(false);
    setBusy('restore');
    try {
      const at = Date.now();
      const restored = await restoreFromCloud(user.id);
      await saveAppData(restored);
      // El estado local se acaba de reemplazar por el de la nube: los deltas
      // pendientes del outbox referían al estado viejo y ya no aplican.
      await clearOutbox();
      // Releer de la BD (y no pintar `restored` a pelo): lo guardado pasa por la
      // normalización, que es la que quita duplicados heredados de la nube.
      await refreshFromDb();
      // Ya tenemos todo el estado de la nube: fija el cursor a este instante para
      // que el sync incremental parta de aquí y no vuelva a bajarlo entero.
      await markSynced(user.id, at);
      setLastSync(await getLastSync(user.id));
      notify(t('Datos restaurados desde la nube'), 'success');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  // Carga el perfil público al iniciar sesión (nombre, bio, visibilidad).
  useEffect(() => {
    if (!user) return;
    let active = true;
    getProfile(user.id)
      .then((p) => {
        if (!active || !p) return;
        setProfileName(p.display_name ?? '');
        setProfileBio(p.bio ?? '');
        setProfilePublic(p.is_public);
        setProfileAvatar(p.avatar_url ?? null);
      })
      .catch(() => {});
    Promise.all([getFollowingCount(user.id), getFollowerCount(user.id)])
      .then(([fg, fr]) => {
        if (!active) return;
        setFollowingCount(fg);
        setFollowersCount(fr);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Selecciona una foto, la recorta a cuadrado y la reduce a 256px jpeg. Se sube
  // al bucket `avatars` de Storage (URL ligera); si no está configurado, cae a
  // guardar el base64 en el propio perfil.
  const handlePickAvatar = async () => {
    try {
      setPickingAvatar(true);
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const manip = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 256 } }],
        {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      if (!manip.base64) return;
      const dataUri = `data:image/jpeg;base64,${manip.base64}`;
      if (user) {
        try {
          setProfileAvatar(await uploadAvatar(user.id, manip.base64));
        } catch {
          // Bucket de Storage sin configurar o subida fallida: guardamos el
          // base64 en el perfil (funciona igual, solo más pesado).
          setProfileAvatar(dataUri);
        }
      } else {
        setProfileAvatar(dataUri);
      }
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setPickingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateProfile(user.id, {
        display_name: profileName.trim() || null,
        bio: profileBio.trim() || null,
        is_public: profilePublic,
        avatar_url: profileAvatar,
      });
      notify(t('Perfil guardado'), 'success');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    setBusy('signout');
    try {
      await signOut();
    } finally {
      setBusy(null);
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

          {loading ? (
            <Text style={styles.muted}>{t('Cargando…')}</Text>
          ) : session && user ? (
            <>
              <Text style={styles.status}>{t('Sesión iniciada como')}</Text>
              <Text style={styles.email}>{user.email}</Text>
              <Text style={styles.hint}>
                {t(
                  'Tus cambios se sincronizan solos con la nube y con tus otros dispositivos.'
                )}
              </Text>
              <Text style={styles.syncStatus}>
                {busy === 'sync'
                  ? t('Sincronizando…')
                  : lastSync
                  ? `${t('Última sincronización')}: ${formatAgo(lastSync)}`
                  : t('Aún sin sincronizar')}
              </Text>
              <View style={styles.actions}>
                <Button
                  title={
                    busy === 'sync'
                      ? t('Sincronizando…')
                      : t('Sincronizar ahora')
                  }
                  onPress={() => doSync(true)}
                  disabled={busy !== null}
                />
                <Button
                  title={t('Cerrar sesión')}
                  variant="secondary"
                  onPress={handleSignOut}
                  disabled={busy !== null}
                />
              </View>

              <View style={styles.advanced}>
                <Text style={styles.advancedTitle}>{t('Avanzado')}</Text>
                <Text style={styles.hint}>
                  {t(
                    'Copia de seguridad manual completa, o reemplazar este dispositivo con lo que hay en la nube.'
                  )}
                </Text>
                <View style={styles.actions}>
                  <Button
                    title={
                      busy === 'backup'
                        ? t('Subiendo…')
                        : t('Copia de seguridad ahora')
                    }
                    variant="secondary"
                    onPress={handleBackup}
                    disabled={busy !== null}
                  />
                  <Button
                    title={
                      busy === 'restore'
                        ? t('Restaurando…')
                        : t('Restaurar desde la nube')
                    }
                    variant="secondary"
                    onPress={() => setShowRestoreConfirm(true)}
                    disabled={busy !== null}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.status}>{t('Cuenta y nube')}</Text>
              <Text style={styles.hint}>
                {t(
                  'Crea una cuenta para guardar tus datos en la nube y usarlos en varios dispositivos. La app funciona igual sin cuenta.'
                )}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t('Email')}
                placeholderTextColor={theme.colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                placeholder={t('Contraseña')}
                placeholderTextColor={theme.colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <View style={styles.actions}>
                <Button
                  title={
                    busy === 'signin' ? t('Entrando…') : t('Iniciar sesión')
                  }
                  onPress={() => handleAuth('signin')}
                  disabled={busy !== null}
                />
                <Button
                  title={busy === 'signup' ? t('Creando…') : t('Crear cuenta')}
                  variant="secondary"
                  onPress={() => handleAuth('signup')}
                  disabled={busy !== null}
                />
              </View>
            </>
          )}
        </View>

        {session && user && (
          <View style={styles.card}>
            <GradientFill accent={theme.colors.primaryLine} />
            <Text style={styles.status}>{t('Perfil público')}</Text>
            <Text style={styles.hint}>
              {t('Así te ven en la comunidad cuando publicas una rutina.')}
            </Text>
            <View style={styles.countsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.countItem,
                  pressed && styles.countPressed,
                ]}
                onPress={onOpenFollowing}
                disabled={!onOpenFollowing}
              >
                <Text style={styles.countValue}>{followingCount}</Text>
                <Text style={styles.countLabel}>{t('Siguiendo')}</Text>
              </Pressable>
              <View style={styles.countDivider} />
              <Pressable
                style={({ pressed }) => [
                  styles.countItem,
                  pressed && styles.countPressed,
                ]}
                onPress={onOpenFollowers}
                disabled={!onOpenFollowers}
              >
                <Text style={styles.countValue}>{followersCount}</Text>
                <Text style={styles.countLabel}>
                  {followersCount === 1 ? t('Seguidor') : t('Seguidores')}
                </Text>
              </Pressable>
            </View>
            <View style={styles.avatarRow}>
              {profileAvatar ? (
                <Image
                  source={{ uri: profileAvatar }}
                  style={styles.avatarPreview}
                />
              ) : (
                <View style={[styles.avatarPreview, styles.avatarPlaceholder]}>
                  <MaterialCommunityIcons
                    name="account"
                    size={30}
                    color={theme.colors.textMuted}
                  />
                </View>
              )}
              <Button
                title={pickingAvatar ? t('Abriendo…') : t('Cambiar foto')}
                variant="secondary"
                onPress={handlePickAvatar}
                disabled={pickingAvatar}
                style={styles.avatarButton}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder={t('Nombre visible')}
              placeholderTextColor={theme.colors.textMuted}
              value={profileName}
              onChangeText={setProfileName}
              maxLength={40}
            />
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder={t('Bio (opcional)')}
              placeholderTextColor={theme.colors.textMuted}
              value={profileBio}
              onChangeText={setProfileBio}
              multiline
              maxLength={160}
            />
            <OptionToggle
              options={[
                { value: true, label: t('Público') },
                { value: false, label: t('Privado') },
              ]}
              value={profilePublic}
              onChange={setProfilePublic}
            />
            <Text style={styles.hint}>
              {profilePublic
                ? t('Otros pueden ver tu perfil y seguirte.')
                : t('Tu perfil no aparece para otros.')}
            </Text>
            <Button
              title={savingProfile ? t('Guardando…') : t('Guardar perfil')}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            />
          </View>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Cuenta y nube')}
        icon="cloud-outline"
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={insets.bottom} />

      <ConfirmModal
        visible={showRestoreConfirm}
        title={t('Restaurar desde la nube')}
        message={t(
          'Se reemplazarán los datos de este dispositivo por los de la nube. ¿Continuar?'
        )}
        confirmLabel={t('Restaurar')}
        onConfirm={handleRestore}
        onCancel={() => setShowRestoreConfirm(false)}
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
    status: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
    email: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
    hint: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
    syncStatus: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    advanced: {
      marginTop: 8,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 12,
    },
    advancedTitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    muted: { color: theme.colors.textMuted, fontSize: 14 },
    input: {
      backgroundColor: theme.colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.colors.text,
      fontSize: 16,
    },
    bioInput: {
      minHeight: 76,
      textAlignVertical: 'top',
    },
    countsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 10,
    },
    countItem: { flex: 1, alignItems: 'center' },
    countPressed: { opacity: 0.6 },
    countValue: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 24,
    },
    countLabel: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
    countDivider: {
      width: 1,
      height: 28,
      backgroundColor: theme.colors.border,
    },
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatarPreview: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.colors.surfaceAlt,
    },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    avatarButton: { flex: 1 },
    actions: { gap: 10, marginTop: 4 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
