import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import { theme } from '@lib/theme';
import { t, dateLocale } from '@lib/i18n';
import {
  getAutoBackupEnabled,
  setAutoBackupEnabled,
  getLastAutoBackupAt,
} from '@lib/appSettings';
import { canWriteLocalBackup } from '@lib/fileIO';

interface DataScreenProps {
  onImportData: () => Promise<void>;
  onExportData: () => Promise<void>;
  onBackupNow: () => Promise<void>;
  onClearData: () => Promise<void> | void;
  onBack: () => void;
}

export function DataScreen({
  onImportData,
  onExportData,
  onBackupNow,
  onClearData,
  onBack,
}: DataScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [busyAction, setBusyAction] = useState<
    'import' | 'export' | 'backup' | null
  >(null);
  // Estado del backup automático (se lee de appSettings, no del estado de la
  // app). `lastBackupAt` se refresca al hacer un backup manual desde aquí.
  const [autoBackup, setAutoBackup] = useState(() => getAutoBackupEnabled());
  const [lastBackupAt, setLastBackupAt] = useState(() => getLastAutoBackupAt());
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const backBottom = Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding = backBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  const hasNoData = state.routines.length === 0 && state.logs.length === 0;

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
      setToast({
        message,
        type: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportPress = async () => {
    setShowImportModal(false);
    await handleAction('import', onImportData);
  };

  const canBackup = canWriteLocalBackup();

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
        {!hasNoData && canBackup && (
          <View style={styles.actionCard}>
            <GradientFill accent={theme.colors.primaryLine} />
            <View style={styles.titleRow}>
              <MaterialCommunityIcons
                name="backup-restore"
                size={18}
                color={theme.colors.text}
              />
              <Text style={styles.actionTitle}>{t('Backup automático')}</Text>
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
            <Text style={styles.backupMeta}>
              {t('Último backup: {date}', {
                date: formatBackupDate(lastBackupAt),
              })}
            </Text>
            <Button
              title={
                busyAction === 'backup'
                  ? t('Guardando…')
                  : t('Hacer backup ahora')
              }
              onPress={handleBackupNow}
              disabled={busyAction !== null}
              variant="secondary"
              size="large"
            />
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
              disabled={busyAction !== null}
              size="large"
            />
          </View>
        )}

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
            disabled={busyAction !== null}
            variant="primary"
            size="large"
          />
        </View>

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
        title={t('Datos')}
        icon="folder-cog-outline"
        subtitle={t('Importa, exporta o limpia la información')}
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
    backupMeta: {
      fontSize: 13,
      color: theme.colors.textSecondary,
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
