import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { t } from '@lib/i18n';
import { AppModal } from './AppModal';
import { Button } from './Button';
import { CheckRow } from './CheckRow';

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
  /** Contenido extra entre el mensaje y la casilla (ej: pedir la contraseña). */
  children?: React.ReactNode;
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
  children,
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
      {children}
      {!!checkLabel && (
        <CheckRow
          checked={checked}
          onToggle={() => onToggleCheck?.()}
          style={styles.checkRow}
        >
          {checkLabel}
        </CheckRow>
      )}
    </AppModal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    checkRow: {
      marginTop: 16,
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
