import { subscribeTheme } from '@lib/themeStore';
import React, { useCallback, useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Button,
  ConfirmModal,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  OptionToggle,
  Toast,
  StretchScrollView,
} from '@components';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import { theme } from '@lib/theme';
import { t, dateLocale, formatAgo } from '@lib/i18n';
import {
  getAutoBackupEnabled,
  setAutoBackupEnabled,
  getLastAutoBackupAt,
} from '@lib/appSettings';
import { canWriteLocalBackup } from '@lib/fileIO';
import { useSession, signUp, signIn, signOut } from '@lib/cloud/auth';
import { backupToCloud, restoreFromCloud } from '@lib/cloud/backup';
import { syncNow, markSynced, getLastSync } from '@lib/cloud/sync';
import { clearOutbox } from '@lib/db';
import { saveAppData, loadAppData } from '@lib/storage';
import type { WorkoutAppData } from '../../types';

interface DataScreenProps {
  onImportData: () => Promise<void>;
  onExportData: () => Promise<void>;
  onBackupNow: () => Promise<void>;
  onClearData: () => Promise<void> | void;
  onBack: () => void;
}

// Toda acción con espera propia, para deshabilitar el resto mientras corre.
type BusyAction =
  | 'import'
  | 'export'
  | 'backup'
  | 'signin'
  | 'signup'
  | 'signout'
  | 'sync'
  | 'cloud-backup'
  | 'restore'
  | null;

/**
 * "Datos y nube": TODO lo que responde a "¿dónde están mis datos y cómo los
 * muevo?", en una sola pantalla y en tres bloques.
 *
 * Antes esto vivía partido en dos pantallas del menú de Perfil ("Datos" y
 * "Cuenta y nube") con cuatro conceptos de copia repartidos entre ellas y dos
 * botones casi homónimos con destinos distintos ("Hacer backup ahora" iba a un
 * fichero local, "Copia de seguridad ahora" a la nube). Aquí el orden es el de
 * la pregunta del usuario: primero quién eres (cuenta y sincronización), luego
 * la copia de este móvil, y al final lo que reemplaza o borra datos.
 */
export function DataScreen({
  onImportData,
  onExportData,
  onBackupNow,
  onClearData,
  onBack,
}: DataScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const { session, user, loading: sessionLoading } = useSession();

  const [showImportModal, setShowImportModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  // Estado del backup automático (se lee de appSettings, no del estado de la
  // app). `lastBackupAt` se refresca al hacer un backup manual desde aquí.
  const [autoBackup, setAutoBackup] = useState(() => getAutoBackupEnabled());
  const [lastBackupAt, setLastBackupAt] = useState(() => getLastAutoBackupAt());
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: backBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  const hasNoData = state.routines.length === 0 && state.logs.length === 0;
  const canBackup = canWriteLocalBackup();
  const busy = busyAction !== null;

  const notify = (message: string, type: 'success' | 'error') =>
    setToast({ message, type });

  // ── Cuenta y sincronización ──────────────────────────────────────────────

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
    setBusyAction(mode);
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
      setBusyAction(null);
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
      setBusyAction('sync');
      try {
        const { pulled } = await syncNow(user.id);
        if (pulled > 0) await refreshFromDb();
        setLastSync(await getLastSync(user.id));
        if (announce) notify(t('Sincronizado'), 'success');
      } catch (e) {
        if (announce) notify((e as Error).message, 'error');
      } finally {
        setBusyAction(null);
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

  const handleSignOut = async () => {
    setBusyAction('signout');
    try {
      await signOut();
    } finally {
      setBusyAction(null);
    }
  };

  // ── Copia en este móvil ──────────────────────────────────────────────────

  const handleAction = async (
    action: 'import' | 'export',
    callback: () => Promise<void>
  ) => {
    try {
      setBusyAction(action);
      await callback();
      setToast({
        message:
          action === 'import' ? t('Datos importados') : t('Datos exportados'),
        type: 'success',
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('No se pudo completar la acción');
      setToast({ message, type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportPress = async () => {
    setShowImportModal(false);
    await handleAction('import', onImportData);
  };

  const handleToggleAutoBackup = (enabled: boolean) => {
    if (enabled === autoBackup) return;
    setAutoBackup(enabled);
    setAutoBackupEnabled(enabled);
  };

  const handleBackupNow = async () => {
    try {
      setBusyAction('backup');
      await onBackupNow();
      setLastBackupAt(getLastAutoBackupAt());
      setToast({
        message: t('Backup guardado en el dispositivo'),
        type: 'success',
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('No se pudo completar la acción');
      setToast({ message, type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const formatBackupDate = (timestamp: number) =>
    timestamp ? new Date(timestamp).toLocaleDateString(dateLocale) : t('Nunca');

  // ── Reemplazar o borrar ──────────────────────────────────────────────────

  const handleCloudBackup = async () => {
    if (!user) return;
    setBusyAction('cloud-backup');
    try {
      const at = await backupToCloud(currentAppData(), user.id);
      // La nube queda sembrada con este estado: fija el cursor al instante que
      // llevan las filas subidas, para que el pull incremental no rebaje de
      // vuelta todo lo recién subido.
      await markSynced(user.id, at);
      setLastSync(await getLastSync(user.id));
      notify(t('Copia subida a la nube'), 'success');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestore = async () => {
    if (!user) return;
    setShowRestoreConfirm(false);
    setBusyAction('restore');
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
      setBusyAction(null);
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
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 1. Cuenta ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>{t('Tu cuenta')}</Text>

        <View style={styles.actionCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.titleRow}>
            <MaterialCommunityIcons
              name="cloud-outline"
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.actionTitle}>
              {session && user ? t('Sincronización') : t('Cuenta')}
            </Text>
          </View>

          {sessionLoading ? (
            <Text style={styles.actionSubtitle}>{t('Cargando…')}</Text>
          ) : session && user ? (
            <>
              <Text style={styles.email}>{user.email}</Text>
              <Text style={styles.actionSubtitle}>
                {t(
                  'Tus cambios se sincronizan solos con la nube y con tus otros dispositivos.'
                )}
              </Text>
              <Text style={styles.metaLine}>
                {busyAction === 'sync'
                  ? t('Sincronizando…')
                  : lastSync
                  ? `${t('Última sincronización')}: ${formatAgo(lastSync)}`
                  : t('Aún sin sincronizar')}
              </Text>
              <Button
                title={
                  busyAction === 'sync'
                    ? t('Sincronizando…')
                    : t('Sincronizar ahora')
                }
                onPress={() => doSync(true)}
                disabled={busy}
                size="large"
              />
              <Button
                title={t('Cerrar sesión')}
                variant="secondary"
                onPress={handleSignOut}
                disabled={busy}
              />
            </>
          ) : (
            <>
              <Text style={styles.actionSubtitle}>
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
              <Button
                title={
                  busyAction === 'signin' ? t('Entrando…') : t('Iniciar sesión')
                }
                onPress={() => handleAuth('signin')}
                disabled={busy}
                size="large"
              />
              <Button
                title={
                  busyAction === 'signup' ? t('Creando…') : t('Crear cuenta')
                }
                variant="secondary"
                onPress={() => handleAuth('signup')}
                disabled={busy}
              />
            </>
          )}
        </View>

        {/* ─── 2. Copias ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>{t('Copias de seguridad')}</Text>

        {!hasNoData && canBackup && (
          <View style={styles.actionCard}>
            <GradientFill accent={theme.colors.primaryLine} />
            <View style={styles.titleRow}>
              <MaterialCommunityIcons
                name="backup-restore"
                size={18}
                color={theme.colors.text}
              />
              <Text style={styles.actionTitle}>{t('Copia automática')}</Text>
            </View>
            <Text style={styles.actionSubtitle}>
              {t(
                'Guarda una copia en el dispositivo al abrir la app, una vez al día.'
              )}
            </Text>
            <OptionToggle
              options={[
                { value: true, label: t('Activado') },
                { value: false, label: t('Desactivado') },
              ]}
              value={autoBackup}
              onChange={handleToggleAutoBackup}
            />
            <Text style={styles.metaLine}>
              {t('Última copia: {date}', {
                date: formatBackupDate(lastBackupAt),
              })}
            </Text>
            {/* Los dos destinos posibles, uno al lado del otro y con el destino
                en el propio rótulo: antes se llamaban casi igual ("Hacer backup
                ahora" / "Copia de seguridad ahora") en dos pantallas distintas. */}
            <Button
              title={
                busyAction === 'backup'
                  ? t('Guardando…')
                  : t('Guardar copia en el móvil')
              }
              onPress={handleBackupNow}
              disabled={busy}
              variant="secondary"
              size="large"
            />
            {!!user && (
              <Button
                title={
                  busyAction === 'cloud-backup'
                    ? t('Subiendo…')
                    : t('Subir copia a la nube')
                }
                onPress={handleCloudBackup}
                disabled={busy}
                variant="secondary"
                size="large"
              />
            )}
          </View>
        )}

        {!hasNoData && (
          <View style={styles.actionCard}>
            <GradientFill accent={theme.colors.primaryLine} />
            <View style={styles.titleRow}>
              <MaterialCommunityIcons
                name="export-variant"
                size={18}
                color={theme.colors.text}
              />
              <Text style={styles.actionTitle}>{t('Exportar datos')}</Text>
            </View>
            <Text style={styles.actionSubtitle}>
              {t('Descarga un fichero con todas las rutinas y entrenamientos.')}
            </Text>
            <Button
              title={busyAction === 'export' ? t('Exportando…') : t('Exportar')}
              onPress={() => handleAction('export', onExportData)}
              disabled={busy}
              size="large"
            />
          </View>
        )}

        {/* ─── 3. Reemplazar o borrar ────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>{t('Reemplazar o borrar')}</Text>

        <View style={styles.actionCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.titleRow}>
            <MaterialCommunityIcons
              name="import"
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.actionTitle}>{t('Importar datos')}</Text>
          </View>
          <Text style={styles.actionSubtitle}>
            {t('Carga un fichero exportado con rutinas y entrenamientos.')}
          </Text>
          <Button
            title={busyAction === 'import' ? t('Importando…') : t('Importar')}
            onPress={() => setShowImportModal(true)}
            disabled={busy}
            variant="primary"
            size="large"
          />
        </View>

        {!!user && (
          <View style={styles.actionCard}>
            <GradientFill accent={theme.colors.primaryLine} />
            <View style={styles.titleRow}>
              <MaterialCommunityIcons
                name="cloud-download-outline"
                size={18}
                color={theme.colors.text}
              />
              <Text style={styles.actionTitle}>{t('Restaurar')}</Text>
            </View>
            <Text style={styles.actionSubtitle}>
              {t(
                'Reemplaza lo que hay en este móvil por lo que haya guardado en la nube.'
              )}
            </Text>
            <Button
              title={
                busyAction === 'restore'
                  ? t('Restaurando…')
                  : t('Restaurar desde la nube')
              }
              variant="secondary"
              onPress={() => setShowRestoreConfirm(true)}
              disabled={busy}
              size="large"
            />
          </View>
        )}

        {!hasNoData && (
          <View style={[styles.actionCard, styles.dangerCard]}>
            <GradientFill accent={theme.colors.error} />
            <View style={styles.titleRow}>
              <MaterialCommunityIcons
                name="delete-outline"
                size={18}
                color={theme.colors.error}
              />
              <Text style={[styles.actionTitle, styles.dangerTitle]}>
                {t('Borrar datos')}
              </Text>
            </View>
            <Text style={[styles.actionSubtitle, styles.dangerSubtitle]}>
              {t('Elimina todas las rutinas y entrenamientos guardados.')}
            </Text>
            <Button
              title={t('Borrar')}
              onPress={() => setShowClearModal(true)}
              variant="danger"
              size="large"
            />
          </View>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Datos y nube')}
        icon="folder-cog-outline"
        subtitle={t('Tu cuenta, tus copias y tu historial')}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={backBottom} />

      <ConfirmModal
        visible={showImportModal}
        title={t('Importar datos')}
        message={t(
          'Esta acción eliminará los datos actuales y los reemplazará con los del fichero. ¿Estás seguro?'
        )}
        confirmLabel={t('Importar')}
        confirmVariant="primary"
        busy={busyAction === 'import'}
        onConfirm={handleImportPress}
        onCancel={() => setShowImportModal(false)}
      />

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

      <ConfirmModal
        visible={showClearModal}
        title={t('Borrar datos')}
        message={t(
          'Esta acción borrará toda la información guardada en la app.'
        )}
        confirmLabel={t('Borrar')}
        onConfirm={async () => {
          setShowClearModal(false);
          await onClearData();
          setToast({ message: t('Datos eliminados'), type: 'success' });
        }}
        onCancel={() => setShowClearModal(false)}
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
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: 0,
      marginTop: 0,
      gap: 20,
    },
    // Rótulo de bloque: separa "cuenta" de "copias" de "reemplazar o borrar"
    // sin meter otra tarjeta en medio.
    sectionLabel: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
      marginBottom: -8,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: 10,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    actionTitle: {
      // Ocupa el ancho que queda a la derecha del icono. Sin esto, Android
      // medía la caja del título al ancho de su palabra más larga y "Copia
      // automática" se partía en dos líneas con media tarjeta vacía al lado.
      flex: 1,
      fontSize: 21,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 30,
    },
    actionSubtitle: {
      fontSize: 14,
      lineHeight: 19,
      color: theme.colors.textSecondary,
    },
    email: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    metaLine: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    input: {
      backgroundColor: theme.colors.backgroundElevated,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.colors.text,
      fontSize: 16,
    },
    dangerCard: {
      borderColor: theme.colors.error,
    },
    dangerTitle: {
      color: theme.colors.error,
    },
    dangerSubtitle: {
      color: theme.colors.errorLight,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
