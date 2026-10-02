import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

interface TopBarActionButtonProps {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  /** Relleno de oro: el modo que el botón activa está en marcha ("Hecho"). */
  active?: boolean;
}

/**
 * La acción principal de una pantalla de CONSULTA, rotulada y a la vista en la
 * barra superior (`rightElement` de `GlassTopBar`): "Editar" en el Detalle de
 * una sesión y en la ficha de una rutina (que además la alterna con "Hecho" y,
 * en una rutina ajena, ofrece "Hacer copia"). Lo raro queda en el ⋮. Antes cada
 * pantalla lo resolvía a su manera: la ficha con este botón y el Detalle con
 * "Editar" como primera entrada de un menú de cinco.
 */
export function TopBarActionButton({
  label,
  icon,
  onPress,
  active = false,
}: TopBarActionButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        active && styles.buttonActive,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons
        name={icon}
        size={16}
        color={active ? theme.colors.onGold : theme.colors.primary}
      />
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    // Lectura = superficie con borde y tinta dorada; activo = oro de relleno
    // con tinta oscura.
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      height: 34,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
    },
    buttonActive: {
      backgroundColor: theme.colors.primaryFill,
      borderColor: theme.colors.primaryFillDark,
    },
    pressed: {
      opacity: 0.8,
    },
    text: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.primary,
      lineHeight: 16,
    },
    textActive: {
      color: theme.colors.onGold,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
