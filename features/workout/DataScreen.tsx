import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Button, Toast } from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { theme } from '@lib/theme';

interface DataScreenProps {
  onImportData: () => Promise<void>;
  onExportData: () => Promise<void>;
  onClearData: () => Promise<void> | void;
}

export function DataScreen({
  onImportData,
  onExportData,
  onClearData,
}: DataScreenProps) {
  const { state } = useWorkout();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [busyAction, setBusyAction] = useState<'import' | 'export' | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const hasNoData = state.routines.length === 0 && state.logs.length === 0;

  const handleAction = async (
    action: 'import' | 'export',
    callback: () => Promise<void>
  ) => {
    try {
      setBusyAction(action);
      await callback();
      setToast({
        message: action === 'import' ? '✅ Datos importados' : '✅ Datos exportados',
        type: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la acción';
      setToast({
        message: `❌ ${message}`,
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗂️ Datos</Text>
        <Text style={styles.subtitle}>Importa, exporta o limpia la información</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!hasNoData && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>📊 Resumen actual</Text>
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
            <Text style={styles.actionTitle}>📤 Exportar datos</Text>
            <Text style={styles.actionSubtitle}>
              Descarga un fichero con todas las rutinas y entrenamientos.
            </Text>
            <Button
              title={busyAction === 'export' ? 'Exportando…' : '📤 Exportar'}
              onPress={() => handleAction('export', onExportData)}
              disabled={busyAction !== null}
              size="large"
            />
          </View>
        )}

        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>📥 Importar datos</Text>
          <Text style={styles.actionSubtitle}>
            Carga un fichero exportado con rutinas y entrenamientos.
          </Text>
          <Button
            title={busyAction === 'import' ? 'Importando…' : '📥 Importar'}
            onPress={() => setShowImportModal(true)}
            disabled={busyAction !== null}
            variant="primary"
            size="large"
          />
        </View>

        {!hasNoData && (
          <View style={[styles.actionCard, styles.dangerCard]}>
            <Text style={[styles.actionTitle, styles.dangerTitle]}>🗑️ Limpiar datos</Text>
            <Text style={[styles.actionSubtitle, styles.dangerSubtitle]}>
              Elimina todas las rutinas y entrenamientos guardados.
            </Text>
            <Button
              title="🗑️ Limpiar"
              onPress={() => setShowClearModal(true)}
              variant="danger"
              size="large"
            />
          </View>
        )}
      </ScrollView>

      <Modal visible={showImportModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ Importar datos</Text>
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
            <Text style={styles.modalTitle}>⚠️ Limpiar datos</Text>
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
                  setToast({ message: '✅ Datos eliminados', type: 'success' });
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    marginTop: theme.spacing.md,
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
    marginBottom: 12,
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
    marginBottom: 8,
    lineHeight: 24,
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
