import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Button,
  FloatingPrimaryNav,
  FLOATING_GLASS_BAR_HEIGHT,
  FLOATING_GLASS_BAR_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  Toast,
} from '@components';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import { theme } from '@lib/theme';

interface DataScreenProps {
  onImportData: () => Promise<void>;
  onExportData: () => Promise<void>;
  onClearData: () => Promise<void> | void;
  onNavigateHome?: () => void;
  onNavigateRoutines?: () => void;
  onNavigateCalendar?: () => void;
  onNavigateData?: () => void;
}

export function DataScreen({
  onImportData,
  onExportData,
  onClearData,
  onNavigateHome,
  onNavigateRoutines,
  onNavigateCalendar,
  onNavigateData,
}: DataScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [busyAction, setBusyAction] = useState<'import' | 'export' | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingNavBottom = Math.max(insets.bottom, 10) + FLOATING_GLASS_BAR_MARGIN;
  const scrollBottomPadding = floatingNavBottom + FLOATING_GLASS_BAR_HEIGHT + 28;

  const hasNoData = state.routines.length === 0 && state.logs.length === 0;

  const handleAction = async (
    action: 'import' | 'export',
    callback: () => Promise<void>
  ) => {
    try {
      setBusyAction(action);
      await callback();
      setToast({
        message: action === 'import' ? 'Datos importados' : 'Datos exportados',
        type: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la acción';
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + 12,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!hasNoData && (
          <View style={styles.summaryCard}>
            <View style={styles.titleRow}>
              <MaterialCommunityIcons name="chart-box-outline" size={18} color={theme.colors.text} />
              <Text style={styles.summaryTitle}>Resumen actual</Text>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{state.routines.length}</Text>
                <Text style={styles.summaryLabel}>Rutinas</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{state.logs.length}</Text>
                <Text style={styles.summaryLabel}>Entrenamientos</Text>
              </View>
            </View>
          </View>
        )}

        {!hasNoData && (
          <View style={styles.actionCard}>
            <View style={styles.titleRow}>
              <MaterialCommunityIcons name="export-variant" size={18} color={theme.colors.text} />
              <Text style={styles.actionTitle}>Exportar datos</Text>
            </View>
            <Text style={styles.actionSubtitle}>
              Descarga un fichero con todas las rutinas y entrenamientos.
            </Text>
            <Button
              title={busyAction === 'export' ? 'Exportando…' : 'Exportar'}
              onPress={() => handleAction('export', onExportData)}
              disabled={busyAction !== null}
              size="large"
            />
          </View>
        )}

        <View style={styles.actionCard}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="import" size={18} color={theme.colors.text} />
            <Text style={styles.actionTitle}>Importar datos</Text>
          </View>
          <Text style={styles.actionSubtitle}>
            Carga un fichero exportado con rutinas y entrenamientos.
          </Text>
          <Button
            title={busyAction === 'import' ? 'Importando…' : 'Importar'}
            onPress={() => setShowImportModal(true)}
            disabled={busyAction !== null}
            variant="primary"
            size="large"
          />
        </View>

        {!hasNoData && (
          <View style={[styles.actionCard, styles.dangerCard]}>
            <View style={styles.titleRow}>
              <MaterialCommunityIcons name="delete-outline" size={18} color={theme.colors.error} />
              <Text style={[styles.actionTitle, styles.dangerTitle]}>Limpiar datos</Text>
            </View>
            <Text style={[styles.actionSubtitle, styles.dangerSubtitle]}>
              Elimina todas las rutinas y entrenamientos guardados.
            </Text>
            <Button
              title="Limpiar"
              onPress={() => setShowClearModal(true)}
              variant="danger"
              size="large"
            />
          </View>
        )}
      </ScrollView>

      <GlassTopBar
        title="Datos"
        titleElement={(
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="folder-cog-outline" size={18} color={theme.colors.text} />
            <Text style={styles.topBarTitle}>Datos</Text>
          </View>
        )}
        subtitle="Importa, exporta o limpia la información"
        topInset={insets.top}
      />

      <FloatingPrimaryNav
        bottom={floatingNavBottom}
        activeTab="data"
        onPressHome={onNavigateHome}
        onPressRoutines={onNavigateRoutines}
        onPressCalendar={onNavigateCalendar}
        onPressData={onNavigateData}
      />

      <Modal visible={showImportModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalTitleRow}>
              <MaterialCommunityIcons name="alert-outline" size={18} color={theme.colors.text} />
              <Text style={styles.modalTitle}>Importar datos</Text>
            </View>
            <Text style={styles.modalText}>
              Esta acción eliminará los datos actuales y los reemplazará con los del fichero. ¿Estás seguro?
            </Text>

            <View style={styles.modalButtons}>
              <Button
                title="Cancelar"
                onPress={() => setShowImportModal(false)}
                variant="secondary"
                size="medium"
                style={styles.modalButton}
              />
              <Button
                title="Importar"
                onPress={handleImportPress}
                disabled={busyAction === 'import'}
                size="medium"
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showClearModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalTitleRow}>
              <MaterialCommunityIcons name="alert-outline" size={18} color={theme.colors.text} />
              <Text style={styles.modalTitle}>Limpiar datos</Text>
            </View>
            <Text style={styles.modalText}>
              Esta acción borrará toda la información guardada en la app.
            </Text>

            <View style={styles.modalButtons}>
              <Button
                title="Cancelar"
                onPress={() => setShowClearModal(false)}
                variant="secondary"
                size="medium"
                style={styles.modalButton}
              />
              <Button
                title="Limpiar"
                onPress={async () => {
                  setShowClearModal(false);
                  await onClearData();
                  setToast({ message: 'Datos eliminados', type: 'success' });
                }}
                variant="danger"
                size="medium"
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

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
    gap: 12,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    padding: theme.spacing.md,
    ...theme.shadow.soft,
  },
  summaryTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
  summaryDivider: {
    width: 1,
    height: 42,
    backgroundColor: theme.colors.border,
  },
  actionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    padding: theme.spacing.md,
    gap: 10,
    ...theme.shadow.soft,
  },
  actionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 24,
  },
  actionSubtitle: {
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  dangerCard: {
    borderLeftColor: theme.colors.error,
  },
  dangerTitle: {
    color: theme.colors.error,
  },
  dangerSubtitle: {
    color: theme.colors.errorLight,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: theme.colors.overlay,
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 0,
    lineHeight: 24,
  },
  modalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  modalText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
  },
});
