import React, { useState } from 'react';
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
import { saveAppData } from '@lib/storage';
import type { WorkoutAppData } from '../../types';

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
    'signin' | 'signup' | 'backup' | 'restore' | 'signout' | null
  >(null);
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

  const handleBackup = async () => {
    if (!user) return;
    setBusy('backup');
    try {
      await backupToCloud(currentAppData(), user.id);
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
      const restored = await restoreFromCloud(user.id);
      await saveAppData(restored);
      dispatch({ type: 'SET_APP_DATA', payload: restored });
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
          { paddingTop: topBarHeight + 28, paddingBottom: backButtonSpace + 24 },
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
                  'Sube una copia de tus datos a la nube, o restáuralos en este dispositivo.'
                )}
              </Text>
              <View style={styles.actions}>
                <Button
                  title={
                    busy === 'backup'
                      ? t('Subiendo…')
                      : t('Copia de seguridad ahora')
                  }
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
                <Button
                  title={t('Cerrar sesión')}
                  variant="secondary"
                  onPress={handleSignOut}
                  disabled={busy !== null}
                />
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
                  title={busy === 'signin' ? t('Entrando…') : t('Iniciar sesión')}
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

      <GlassTopBar title={t('Cuenta y nube')} icon="cloud-outline" topInset={insets.top} />

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
