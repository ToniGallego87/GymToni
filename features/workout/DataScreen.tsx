import { subscribeTheme } from '@lib/themeStore';
import React, { useCallback, useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Button,
  ConfirmModal,
  SignOutConfirmModal,
  PasswordField,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  OptionToggle,
  Toast,
  StretchScrollView,
} from '@components';
import { View, Text, StyleSheet, TextInput, Platform } from 'react-native';
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
import { AutoBackupFile, listAutoBackups } from '@lib/backup';
import { ACCOUNT_DELETION_GRACE_DAYS, weekdayDayMonth } from '@lib/utils';
import {
  useSession,
  signUp,
  signIn,
  verifySignUpCode,
  resendSignUpCode,
  requestPasswordReset,
  verifyRecoveryCode,
  updatePassword,
  authErrorMessage,
  signOutOtherDevices,
  verifyCurrentPassword,
  requestAccountDeletion,
} from '@lib/cloud/auth';
import { backupToCloud, restoreFromCloud } from '@lib/cloud/backup';
import { syncNow, markSynced, getLastSync } from '@lib/cloud/sync';
import { clearOutbox } from '@lib/db';
import { saveAppData, loadAppData } from '@lib/storage';
import type { WorkoutAppData } from '../../types';

interface DataScreenProps {
  onImportData: () => Promise<void>;
  onRestoreAutoBackup: (fileName: string) => Promise<void>;
  onExportData: () => Promise<void>;
  onBackupNow: () => Promise<void>;
  onClearData: () => Promise<void> | void;
  onBack: () => void;
}

// Longitud del código de confirmación por correo. Supabase la deja elegir
// entre 6 y 10 (Auth → Providers → Email → OTP Length): no fijar el 6 aquí
// para que cambiar ese ajuste no deje la app sin poder confirmar.
const OTP_MIN_LENGTH = 6;
const OTP_MAX_LENGTH = 10;
// Mínimo de Supabase Auth por defecto. Se comprueba antes de gastar el código
// de recuperación: si la nube rechazara la contraseña después, habría que
// pedir otro código.
const PASSWORD_MIN_LENGTH = 6;
// Espera mínima de Supabase Auth entre dos códigos al mismo email.
const RESEND_COOLDOWN_S = 60;

type PendingCode =
  | { kind: 'signup'; email: string }
  | { kind: 'recovery'; email: string; verified: boolean };

// Toda acción con espera propia, para deshabilitar el resto mientras corre.
type BusyAction =
  | 'import'
  | 'export'
  | 'backup'
  | 'signin'
  | 'signup'
  | 'verify'
  | 'resend'
  | 'recover'
  | 'delete-account'
  | 'change-password'
  | 'sync'
  | 'cloud-backup'
  | 'restore'
  | 'local-restore'
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
  onRestoreAutoBackup,
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
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  // Casilla "Entiendo que no se puede deshacer" del popup de borrar la cuenta.
  const [deleteAck, setDeleteAck] = useState(false);
  const [autoBackups, setAutoBackups] = useState<AutoBackupFile[]>([]);
  // Copia automática elegida para restaurar, pendiente de confirmar.
  const [pendingBackup, setPendingBackup] = useState<AutoBackupFile | null>(
    null
  );
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  // Estado del backup automático (se lee de appSettings, no del estado de la
  // app). `lastBackupAt` se refresca al hacer un backup manual desde aquí.
  const [autoBackup, setAutoBackup] = useState(() => getAutoBackupEnabled());
  const [lastBackupAt, setLastBackupAt] = useState(() => getLastAutoBackupAt());
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Código por correo en curso. Mientras no sea null, el bloque de cuenta
  // muestra el del código en vez del login: del registro, o de recuperar la
  // contraseña, que además pide la nueva. `verified`: el código de recuperación
  // ya abrió sesión y solo falta fijar la contraseña (un fallo ahí se reintenta
  // sin pedir otro código).
  const [pending, setPending] = useState<PendingCode | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  // Popups de cambiar la contraseña y de borrar la cuenta: la actual (para
  // confirmar que eres tú) y el error, dentro del popup porque el toast queda
  // debajo de él.
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  // Segundos hasta poder reenviar el código: Supabase no deja pedir otro antes
  // de 60 s, y sin cuenta atrás el usuario solo se encontraba el error.
  const [resendIn, setResendIn] = useState(0);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: backBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  const hasNoData = state.routines.length === 0 && state.logs.length === 0;
  const canBackup = canWriteLocalBackup();
  const busy = busyAction !== null;

  const notify = (message: string, type: 'success' | 'error') =>
    setToast({ message, type });

  // Tras cambiar la contraseña se cierran las demás sesiones; si eso falla
  // hay que decirlo, porque quien la cambia puede hacerlo por una intrusión.
  const notifyPasswordChanged = (othersClosed: boolean) =>
    othersClosed
      ? notify(t('Contraseña cambiada'), 'success')
      : notify(
          t(
            'Contraseña cambiada, pero no se pudo cerrar la sesión en tus otros dispositivos.'
          ),
          'error'
        );

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
        notify(authErrorMessage(error), 'error');
      } else if (
        mode === 'signup' &&
        !data.session &&
        data.user?.identities?.length === 0
      ) {
        // Supabase responde con un "éxito" sin identidades cuando el email ya
        // tiene cuenta confirmada (para no revelar qué emails existen). No envía
        // ningún correo, así que no hay que mandar al usuario a esperar un código.
        notify(t('Ese email ya tiene cuenta. Inicia sesión.'), 'error');
      } else if (mode === 'signup' && !data.session) {
        setPending({ kind: 'signup', email: email.trim() });
        setCode('');
        setResendIn(RESEND_COOLDOWN_S);
        notify(t('Te hemos enviado un código a tu correo'), 'success');
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

  // Cuenta atrás del reenvío: un tic por segundo mientras quede.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // "¿Has olvidado la contraseña?": pide el código al email escrito arriba y
  // pasa al bloque del código. El aviso no dice si la cuenta existe.
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      notify(t('Escribe tu email para recuperar la contraseña'), 'error');
      return;
    }
    setBusyAction('recover');
    try {
      const { error } = await requestPasswordReset(email);
      if (error) {
        notify(authErrorMessage(error), 'error');
      } else {
        setPending({ kind: 'recovery', email: email.trim(), verified: false });
        setCode('');
        setNewPassword('');
        setResendIn(RESEND_COOLDOWN_S);
        notify(
          t('Si hay una cuenta con ese email, te llegará un código'),
          'success'
        );
      }
    } catch (e) {
      notify(authErrorMessage(e), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  // Sale del bloque del código. La contraseña del login se conserva: "Cambiar
  // email" solo corrige el email. En una recuperación ya verificada la sesión
  // queda abierta: el código demostró que la cuenta es suya.
  const leavePendingCode = () => {
    setPending(null);
    setCode('');
    setNewPassword('');
  };

  const handleVerifyCode = async () => {
    if (!pending) return;
    const needsCode = !(pending.kind === 'recovery' && pending.verified);
    if (needsCode && code.trim().length < OTP_MIN_LENGTH) {
      notify(t('Escribe el código del correo'), 'error');
      return;
    }
    if (
      pending.kind === 'recovery' &&
      newPassword.length < PASSWORD_MIN_LENGTH
    ) {
      notify(
        t('La contraseña necesita al menos {n} caracteres', {
          n: PASSWORD_MIN_LENGTH,
        }),
        'error'
      );
      return;
    }
    setBusyAction('verify');
    try {
      if (pending.kind === 'signup') {
        const { error } = await verifySignUpCode(pending.email, code);
        if (error) {
          notify(authErrorMessage(error), 'error');
        } else {
          // verifyOtp devuelve sesión: useSession la recoge por onAuthStateChange.
          leavePendingCode();
          setPassword('');
          notify(t('Cuenta confirmada'), 'success');
        }
        return;
      }

      // Recuperación: el código abre sesión (una vez) y con ella se fija la
      // contraseña. Si fijarla falla (igual que la anterior, rechazada…), la
      // sesión se queda y se reintenta solo esto, sin gastar otro código.
      if (!pending.verified) {
        const { error } = await verifyRecoveryCode(pending.email, code);
        if (error) {
          notify(authErrorMessage(error), 'error');
          return;
        }
        setPending({ ...pending, verified: true });
        setCode('');
      }
      const { error: updateError } = await updatePassword(newPassword);
      if (updateError) {
        notify(authErrorMessage(updateError), 'error');
        return;
      }
      const { error: othersError } = await signOutOtherDevices();
      leavePendingCode();
      setPassword('');
      notifyPasswordChanged(!othersError);
    } catch (e) {
      notify(authErrorMessage(e), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleResendCode = async () => {
    if (!pending || resendIn > 0) return;
    setBusyAction('resend');
    try {
      const { error } =
        pending.kind === 'recovery'
          ? await requestPasswordReset(pending.email)
          : await resendSignUpCode(pending.email);
      if (error) {
        notify(authErrorMessage(error), 'error');
      } else {
        setResendIn(RESEND_COOLDOWN_S);
        notify(t('Código reenviado'), 'success');
      }
    } catch (e) {
      notify(authErrorMessage(e), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  // Recuperación en curso: manda sobre la sesión al pintar. El código abre
  // sesión ANTES de fijar la contraseña, y sin esto el bloque saltaba a
  // "Sincronización" a mitad del cambio.
  const recovering = pending?.kind === 'recovery';

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
      closeAccountModals();
      return;
    }
    let active = true;
    getLastSync(user.id).then((ts) => {
      if (active) setLastSync(ts);
    });
    // Sesión abierta por un código de recuperación: aquí aún se está fijando
    // la contraseña y el botón ocupado es ese. El sync global (useCloudSync)
    // ya corre al iniciar sesión.
    if (!recovering) doSync(false);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const closeAccountModals = () => {
    setShowChangePassword(false);
    setShowDeleteAccount(false);
    setDeleteAck(false);
    setCurrentPassword('');
    setNewPassword('');
    setModalError(null);
  };

  // Salida de los dos popups para quien no sabe su contraseña (la olvidó, o
  // dejó la recuperación "para luego"): el código por correo, sin cerrar sesión.
  const handleForgotFromModal = async () => {
    if (!user?.email) return;
    const accountEmail = user.email;
    setBusyAction('recover');
    setModalError(null);
    try {
      const { error } = await requestPasswordReset(accountEmail);
      if (error) {
        setModalError(authErrorMessage(error));
        return;
      }
      closeAccountModals();
      setPending({ kind: 'recovery', email: accountEmail, verified: false });
      setCode('');
      setResendIn(RESEND_COOLDOWN_S);
    } catch (e) {
      setModalError(authErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const forgotButton = (
    <Button
      title={
        busyAction === 'recover'
          ? t('Enviando…')
          : t('¿Has olvidado la contraseña?')
      }
      variant="secondary"
      onPress={handleForgotFromModal}
      disabled={busy}
    />
  );

  // Cambiar la contraseña con la sesión iniciada. Pide la actual y, como al
  // recuperarla, cierra las demás sesiones: si se cambia porque alguien entró,
  // que no siga dentro.
  const handleChangePassword = async () => {
    if (!user?.email) return;
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setModalError(
        t('La contraseña necesita al menos {n} caracteres', {
          n: PASSWORD_MIN_LENGTH,
        })
      );
      return;
    }
    if (newPassword === currentPassword) {
      setModalError(
        t('La contraseña nueva tiene que ser distinta de la anterior.')
      );
      return;
    }
    setBusyAction('change-password');
    setModalError(null);
    try {
      if (!(await verifyCurrentPassword(user.email, currentPassword))) {
        setModalError(t('La contraseña actual no es correcta.'));
        return;
      }
      const { error } = await updatePassword(newPassword);
      if (error) {
        setModalError(authErrorMessage(error));
        return;
      }
      const { error: othersError } = await signOutOtherDevices();
      closeAccountModals();
      notifyPasswordChanged(!othersError);
    } catch (e) {
      setModalError(authErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  // Pide borrar la cuenta (lib/cloud/auth.ts → requestAccountDeletion: la
  // oculta y cierra la sesión; el borrado real llega pasado el plazo de gracia).
  // Con la contraseña delante: es irreversible y el móvil puede estar en otras
  // manos. Lo de la cuenta en el móvil lo olvida useForgetSignedOutAccount.
  const handleDeleteAccount = async () => {
    if (!user?.email) return;
    setBusyAction('delete-account');
    setModalError(null);
    try {
      if (!(await verifyCurrentPassword(user.email, currentPassword))) {
        setModalError(t('La contraseña no es correcta.'));
        return;
      }
      await requestAccountDeletion();
    } catch (e) {
      // Reintentar es seguro: pedirlo dos veces no alarga el plazo.
      setModalError(
        authErrorMessage(
          e,
          t(
            'No se pudo eliminar la cuenta. Comprueba la conexión e inténtalo de nuevo.'
          )
        )
      );
      return;
    } finally {
      setBusyAction(null);
    }
    closeAccountModals();
    notify(
      t(
        'Se eliminará en {n} días. Si cambias de idea, inicia sesión antes. Tus datos siguen en este móvil.',
        { n: ACCOUNT_DELETION_GRACE_DAYS }
      ),
      'success'
    );
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

  const refreshAutoBackups = useCallback(async () => {
    if (canBackup) setAutoBackups(await listAutoBackups());
  }, [canBackup]);

  useEffect(() => {
    refreshAutoBackups();
  }, [refreshAutoBackups]);

  const handleRestoreAutoBackup = async () => {
    const backup = pendingBackup;
    setPendingBackup(null);
    if (!backup) return;
    try {
      setBusyAction('local-restore');
      await onRestoreAutoBackup(backup.fileName);
      notify(t('Copia restaurada'), 'success');
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : t('No se pudo completar la acción'),
        'error'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const formatBackupLabel = (backup: AutoBackupFile) =>
    backup.date ? weekdayDayMonth(backup.date) : backup.fileName;

  const formatBackupSize = (bytes: number) =>
    `${Math.max(1, Math.round(bytes / 1024))} KB`;

  const handleBackupNow = async () => {
    try {
      setBusyAction('backup');
      await onBackupNow();
      await refreshAutoBackups();
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
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
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
            <Text
              style={styles.actionTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {session && user ? t('Sincronización') : t('Cuenta')}
            </Text>
          </View>

          {sessionLoading ? (
            <Text style={styles.actionSubtitle}>{t('Cargando…')}</Text>
          ) : pending ? (
            // Antes que la sesión: el código de recuperación la abre antes de
            // fijar la contraseña (ver `recovering`).
            <>
              <Text style={styles.actionSubtitle}>
                {recovering
                  ? pending.kind === 'recovery' && pending.verified
                    ? t('Código correcto. Elige la contraseña nueva para')
                    : t(
                        'Para cambiar la contraseña, escribe el código enviado a'
                      )
                  : t('Te hemos enviado un código a')}{' '}
                <Text style={styles.emailHighlight}>{pending.email}</Text>
              </Text>
              {!(pending.kind === 'recovery' && pending.verified) && (
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="······"
                  placeholderTextColor={theme.colors.textMuted}
                  value={code}
                  onChangeText={(v) =>
                    setCode(v.replace(/\D/g, '').slice(0, OTP_MAX_LENGTH))
                  }
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={OTP_MAX_LENGTH}
                />
              )}
              {recovering && (
                <PasswordField
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t('Nueva contraseña')}
                  isNew
                />
              )}
              <Button
                title={
                  busyAction === 'verify'
                    ? t('Confirmando…')
                    : recovering
                    ? t('Cambiar contraseña')
                    : t('Confirmar')
                }
                onPress={handleVerifyCode}
                disabled={busy}
                size="large"
              />
              {!(pending.kind === 'recovery' && pending.verified) && (
                <Button
                  title={
                    busyAction === 'resend'
                      ? t('Reenviando…')
                      : resendIn > 0
                      ? t('Reenviar código en {n} s', { n: resendIn })
                      : t('Reenviar código')
                  }
                  variant="secondary"
                  onPress={handleResendCode}
                  disabled={busy || resendIn > 0}
                />
              )}
              <Button
                title={
                  pending.kind === 'recovery' && pending.verified
                    ? t('Dejarlo para luego')
                    : recovering
                    ? session
                      ? t('Cancelar')
                      : t('Volver a iniciar sesión')
                    : t('Cambiar email')
                }
                variant="secondary"
                onPress={leavePendingCode}
                disabled={busy}
              />
            </>
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
                onPress={() => setShowSignOut(true)}
                disabled={busy}
              />
              <Button
                title={t('Cambiar contraseña')}
                variant="secondary"
                onPress={() => setShowChangePassword(true)}
                disabled={busy}
              />
              <Button
                title={t('Eliminar la cuenta')}
                variant="danger"
                onPress={() => setShowDeleteAccount(true)}
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
              <Button
                title={
                  busyAction === 'recover'
                    ? t('Enviando…')
                    : t('¿Has olvidado la contraseña?')
                }
                variant="secondary"
                onPress={handleForgotPassword}
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
              <Text
                style={styles.actionTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t('Copia automática')}
              </Text>
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
              <Text
                style={styles.actionTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t('Exportar datos')}
              </Text>
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
            <Text
              style={styles.actionTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {t('Importar datos')}
            </Text>
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

        {/* Va aunque la app esté vacía: es justo cuando más falta hace. */}
        {autoBackups.length > 0 && (
          <View style={styles.actionCard}>
            <GradientFill accent={theme.colors.primaryLine} />
            <View style={styles.titleRow}>
              <MaterialCommunityIcons
                name="history"
                size={18}
                color={theme.colors.text}
              />
              <Text
                style={styles.actionTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t('Restaurar una copia del móvil')}
              </Text>
            </View>
            <Text style={styles.actionSubtitle}>
              {t(
                'Vuelve a los datos de una de las copias automáticas de los últimos días.'
              )}
            </Text>
            {autoBackups.map((backup) => (
              <View key={backup.fileName} style={styles.backupRow}>
                <View style={styles.backupInfo}>
                  <Text style={styles.backupDate}>
                    {formatBackupLabel(backup)}
                  </Text>
                  <Text style={styles.metaLine}>
                    {formatBackupSize(backup.size)}
                  </Text>
                </View>
                <Button
                  title={t('Restaurar')}
                  variant="secondary"
                  onPress={() => setPendingBackup(backup)}
                  disabled={busy}
                />
              </View>
            ))}
          </View>
        )}

        {!!user && (
          <View style={styles.actionCard}>
            <GradientFill accent={theme.colors.primaryLine} />
            <View style={styles.titleRow}>
              <MaterialCommunityIcons
                name="cloud-download-outline"
                size={18}
                color={theme.colors.text}
              />
              <Text
                style={styles.actionTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t('Restaurar')}
              </Text>
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
              <Text
                style={[styles.actionTitle, styles.dangerTitle]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
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

      {/* El subtítulo resume las tres secciones de la pantalla, en su orden:
          "Tu cuenta", "Copias de seguridad" y "Reemplazar o borrar". Antes
          prometía "tu historial", que no es ninguna de ellas —la tercera es
          justo lo contrario: deshacer y vaciar—. */}
      <GlassTopBar
        title={t('Datos y nube')}
        icon="folder-cog-outline"
        subtitle={
          sessionLoading
            ? undefined
            : session && user
            ? lastSync
              ? `${t('Última sincronización')}: ${formatAgo(lastSync)}`
              : t('Aún sin sincronizar')
            : t('Sin cuenta: tus datos solo están en este móvil')
        }
        subtitleNumberOfLines={1}
        topInset={insets.top}
        onLayout={onTopBarLayout}
      />

      <FloatingBackButton onPress={onBack} bottom={backBottom} />

      <SignOutConfirmModal
        visible={showSignOut}
        onClose={() => setShowSignOut(false)}
      />

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

      {/* Borrar la cuenta: al acabar el plazo es irreversible, así que además
          de confirmar hay que marcar que se entiende. Lo del móvil se queda
          (la app va sin cuenta). */}
      <ConfirmModal
        visible={showDeleteAccount}
        icon="account-remove-outline"
        title={t('Eliminar la cuenta')}
        message={t(
          'Tu cuenta se oculta ahora y se borrará en {n} días; hasta entonces puedes recuperarla iniciando sesión. Se borrarán tu email, perfil, foto, entrenos, rutinas privadas, actividad, likes y seguidores. Tus rutinas públicas y tus comentarios se quedan en Comunidad sin tu nombre, como «Cuenta eliminada»: revisa que no incluyan datos personales. Lo que hay en este móvil se queda.',
          { n: ACCOUNT_DELETION_GRACE_DAYS }
        )}
        confirmLabel={
          busyAction === 'delete-account'
            ? t('Eliminando…')
            : t('Eliminar la cuenta')
        }
        checkLabel={t('Entiendo que pasado el plazo no se puede deshacer')}
        checked={deleteAck}
        onToggleCheck={() => setDeleteAck((v) => !v)}
        busy={busyAction === 'delete-account' || !deleteAck || !currentPassword}
        onConfirm={handleDeleteAccount}
        onCancel={() => {
          // Con el borrado ya en marcha, cerrar el popup no lo para: mejor no
          // cerrarlo que hacer creer que se ha cancelado.
          if (busyAction !== 'delete-account') closeAccountModals();
        }}
      >
        <View style={styles.modalFields}>
          <PasswordField
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder={t('Contraseña')}
          />
          {forgotButton}
          {!!modalError && (
            <Text style={styles.modalError} accessibilityLiveRegion="polite">
              {modalError}
            </Text>
          )}
        </View>
      </ConfirmModal>

      <ConfirmModal
        visible={showChangePassword}
        icon="lock-reset"
        title={t('Cambiar contraseña')}
        message={t(
          'Al cambiarla se cerrará la sesión en tus otros dispositivos.'
        )}
        confirmLabel={
          busyAction === 'change-password'
            ? t('Confirmando…')
            : t('Cambiar contraseña')
        }
        confirmVariant="primary"
        busy={
          busyAction === 'change-password' || !currentPassword || !newPassword
        }
        onConfirm={handleChangePassword}
        onCancel={() => {
          if (busyAction !== 'change-password') closeAccountModals();
        }}
      >
        <View style={styles.modalFields}>
          <PasswordField
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder={t('Contraseña actual')}
          />
          <PasswordField
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('Nueva contraseña')}
            isNew
          />
          {forgotButton}
          {!!modalError && (
            <Text style={styles.modalError} accessibilityLiveRegion="polite">
              {modalError}
            </Text>
          )}
        </View>
      </ConfirmModal>

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
        visible={!!pendingBackup}
        title={t('Restaurar una copia del móvil')}
        message={t(
          'Se reemplazarán los datos actuales por los de la copia del {date}. ¿Continuar?',
          { date: pendingBackup ? formatBackupLabel(pendingBackup) : '' }
        )}
        confirmLabel={t('Restaurar')}
        confirmVariant="primary"
        onConfirm={handleRestoreAutoBackup}
        onCancel={() => setPendingBackup(null)}
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
      // Ocupa el ancho que queda a la derecha del icono. Sin crecer, Android
      // medía la caja del título al ancho de su palabra más larga y "Copia
      // automática" se partía en dos líneas con media tarjeta vacía al lado.
      // Aun así Android seguía MIDIENDO ese título a dos líneas (pintándolo
      // en una): la caja salía una línea más alta, con hueco arriba y abajo.
      // Por eso cada título lleva `numberOfLines={1}` (con
      // `adjustsFontSizeToFit` para los largos): la caja no puede medir más
      // de una línea.
      flexGrow: 1,
      flexShrink: 1,
      fontSize: 21,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 30,
      // Anton pega el glifo al borde superior de su caja, así que en una fila
      // centrada el texto se veía más bajo que el icono que lo acompaña. Mismo
      // remedio que el resto de la app (ver lib/textStyles.ts): quitar el
      // relleno de fuente y empujar el glifo, sin agrandar la caja de línea.
      includeFontPadding: false,
      textAlignVertical: 'center',
      transform: [{ translateY: Platform.OS === 'android' ? 3 : 5 }],
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
    modalFields: { gap: 10, marginTop: 14 },
    modalError: { color: theme.colors.error, fontSize: 13 },
    codeInput: {
      textAlign: 'center',
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: 6,
    },
    backupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backupInfo: {
      flex: 1,
    },
    backupDate: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    emailHighlight: {
      color: theme.colors.text,
      fontWeight: '700',
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
