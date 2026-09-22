import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface AnchorMenuItem {
  icon: IconName;
  label: string;
  onPress: () => void;
}

interface AnchorMenuProps {
  visible: boolean;
  onClose: () => void;
  /** El botón (⋯) al que se ancla el menú; se mide en coordenadas de ventana. */
  anchorRef: React.RefObject<View>;
  items: AnchorMenuItem[];
}

const MENU_WIDTH = 220;
// Aire entre el menú y los bordes de la pantalla / el botón.
const EDGE_GAP = 8;

/**
 * Menú desplegable anclado a un botón ⋯, con el mismo dibujo que el de la
 * barra superior (`GlassTopBar`: lista de icono + texto, cierre al tocar
 * fuera). Aquí va dentro de un `Modal` transparente porque el botón vive en
 * una tarjeta dentro de un scroll: un hermano absoluto quedaría recortado por
 * la tarjeta y su fondo no cubriría la pantalla. No es un diálogo (no lleva
 * tarjeta, título ni pie), por eso no es un `AppModal`.
 *
 * Se abre debajo del botón, alineado a su borde derecho; si no cabe por abajo
 * se abre por encima.
 */
export function AnchorMenu({
  visible,
  onClose,
  anchorRef,
  items,
}: AnchorMenuProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [position, setPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);

  // Al abrir se mide el botón; hasta tenerlo no se pinta nada (un frame).
  useEffect(() => {
    if (!visible) {
      setPosition(null);
      return;
    }
    const node = anchorRef.current;
    if (!node || typeof node.measureInWindow !== 'function') {
      setPosition({ top: EDGE_GAP, right: EDGE_GAP });
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      const menuHeight = items.length * 44 + 8;
      const below = y + h + 4;
      const top =
        below + menuHeight > windowHeight - EDGE_GAP
          ? Math.max(EDGE_GAP, y - menuHeight - 4)
          : below;
      const right = Math.max(EDGE_GAP, windowWidth - (x + w));
      setPosition({ top, right });
    });
  }, [visible, anchorRef, items.length, windowWidth, windowHeight]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      {position && (
        <View style={[styles.menu, position]}>
          {items.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={20}
                color={theme.colors.text}
              />
              <Text style={styles.itemText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Modal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject },
    // Misma caja que `themeMenu` de GlassTopBar.
    menu: {
      position: 'absolute',
      width: MENU_WIDTH,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 4,
      overflow: 'hidden',
      ...theme.shadow.card,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    itemPressed: {
      backgroundColor: theme.colors.surfaceAlt,
    },
    itemText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      lineHeight: 20,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
