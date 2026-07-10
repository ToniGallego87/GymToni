import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { Button } from './Button';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  /** Icono MaterialCommunityIcons junto al título (default: alert-outline). */
  icon?: string;
  confirmLabel: string;
  /** Variante del botón de confirmar (default: danger, el caso habitual). */
  confirmVariant?: 'primary' | 'danger';
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Deshabilita el botón de confirmar (acción en curso). */
  busy?: boolean;
}

/**
 * Diálogo de confirmación único de la app (eliminar rutina/entrenamiento,
 * importar/limpiar datos…). Centraliza overlay, tarjeta y botones para que
 * todas las confirmaciones se vean y se comporten igual.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  icon = 'alert-outline',
  confirmLabel,
  confirmVariant = 'danger',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons
              name={icon as any}
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <Button
              title={cancelLabel}
              onPress={onCancel}
              variant="secondary"
              size="medium"
              style={styles.button}
            />
            <Button
              title={confirmLabel}
              onPress={onConfirm}
              variant={confirmVariant}
              disabled={busy}
              size="medium"
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 24,
  },
  message: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  button: {
    flex: 1,
  },
});
