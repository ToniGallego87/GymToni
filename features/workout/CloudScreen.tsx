import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
  Toast,
  StretchScrollView,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { useSession, signUp, signIn, signOut } from '@lib/cloud/auth';
import { backupToCloud, restoreFromCloud } from '@lib/cloud/backup';
import { syncNow, markSynced, getLastSync } from '@lib/cloud/sync';
import { clearOutbox } from '@lib/db';
import { saveAppData, loadAppData } from '@lib/storage';
import type { WorkoutAppData } from '../../types';

// "hace 3 min", "hace 2 h"… para el estado de última sincronización.
function formatAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return t('hace un momento');
  const m = Math.round(s / 60);
  if (m < 60) return `${t('hace')} ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${t('hace')} ${h} h`;
  const d = Math.round(h / 24);
  return `${t('hace')} ${d} d`;
}

interface CloudScreenProps {
  onBack: () => void;
}

export function CloudScreen({ onBack }: CloudScreenProps) {
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
      const at = Date.now();
      await backupToCloud(currentAppData(), user.id);
      // La nube queda sembrada con este estado: fija el cursor a este instante
      // para que el pull incremental no rebaje de vuelta todo lo recién subido.
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
      dispatch({ type: 'SET_APP_DATA', payload: restored });
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
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
  actions: { gap: 10, marginTop: 4 },
});
