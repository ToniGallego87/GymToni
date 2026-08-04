import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { AppModal } from './AppModal';
import { Button } from './Button';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  /** Icono MaterialCommunityIcons junto al título (default: alert-outline). */
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  confirmLabel: string;
  /** Variante del botón de confirmar (default: danger, el caso habitual). */
  confirmVariant?: 'primary' | 'danger';
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Deshabilita el botón de confirmar (acción en curso). */
  busy?: boolean;
  /**
   * Check opcional entre el mensaje y los botones, para matizar la acción
   * (ej: "Borrar también el cardio"). Sin `checkLabel` no se pinta nada.
   */
  checkLabel?: string;
  checked?: boolean;
  onToggleCheck?: () => void;
}

/**
 * Diálogo de confirmación único de la app (eliminar rutina/entrenamiento,
 * importar/limpiar datos…): `AppModal` con el par cancelar/confirmar ya puesto.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  icon = 'alert-outline',
  confirmLabel,
  confirmVariant = 'danger',
  cancelLabel = t('Cancelar'),
  onConfirm,
  onCancel,
  busy = false,
  checkLabel,
  checked = false,
  onToggleCheck,
}: ConfirmModalProps) {
  return (
    <AppModal
      visible={visible}
      onRequestClose={onCancel}
      title={title}
      icon={icon}
      message={message}
      footer={
        <View style={styles.buttonRow}>
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
      }
    >
      {!!checkLabel && (
        <Pressable style={styles.checkRow} onPress={onToggleCheck}>
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked && (
              <MaterialCommunityIcons
                name="check-bold"
                size={14}
                color={theme.colors.onGold}
              />
            )}
          </View>
          <Text style={styles.checkLabel}>{checkLabel}</Text>
        </Pressable>
      )}
    </AppModal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 16,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.primaryLine,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    checkboxChecked: {
      backgroundColor: theme.colors.primaryFill,
    },
    checkLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      lineHeight: 19,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    button: {
      flex: 1,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
