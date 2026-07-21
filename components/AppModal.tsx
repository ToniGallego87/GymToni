import { subscribeTheme } from '@lib/themeStore';
import React, { ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

interface AppModalProps {
  visible: boolean;
  onRequestClose: () => void;
  title: string;
  /** Icono MaterialCommunityIcons junto al título. */
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** Texto explicativo bajo el título. */
  message?: string;
  /**
   * `center` (por defecto) para diálogos cortos —confirmaciones, avisos—, y
   * `left` cuando el cuerpo es un formulario y el título encabeza campos.
   */
  align?: 'center' | 'left';
  /** Cuerpo: campos, rejilla de iconos, QR… */
  children?: ReactNode;
  /**
   * Botones de acción al pie. Se apilan con separación; para ponerlos en fila
   * hay que envolverlos en una `View` propia (los modales tienen de una a tres
   * acciones y no todos las reparten igual). La coherencia la da usar `Button`
   * en todos, no el contenedor.
   */
  footer?: ReactNode;
}

/**
 * Carpintería común de TODOS los modales de la app: overlay, tarjeta, título
 * con icono, mensaje y pie de botones. Antes cada pantalla repetía su propio
 * `Modal` + overlay + tarjeta con medidas y colores ligeramente distintos.
 *
 * No impone el contenido: el cuerpo y los botones los pone quien lo usa (con
 * `Button`, para que las acciones también se vean igual en todos).
 * `ConfirmModal` es la especialización para confirmar/cancelar.
 */
export function AppModal({
  visible,
  onRequestClose,
  title,
  icon,
  message,
  align = 'center',
  children,
  footer,
}: AppModalProps) {
  const centered = align === 'center';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.titleRow, centered && styles.titleRowCentered]}>
            {!!icon && (
              <MaterialCommunityIcons
                name={icon}
                size={18}
                color={theme.colors.text}
              />
            )}
            <Text style={[styles.title, centered && styles.titleCentered]}>
              {title}
            </Text>
          </View>

          {!!message && (
            <Text style={[styles.message, centered && styles.messageCentered]}>
              {message}
            </Text>
          )}

          {children}

          {!!footer && <View style={styles.footer}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = () => StyleSheet.create({
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
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  titleRowCentered: {
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 24,
  },
  titleCentered: {
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
  messageCentered: {
    textAlign: 'center',
  },
  footer: {
    gap: 10,
    marginTop: 18,
  },
});

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
