import { subscribeTheme } from '@lib/themeStore';
import React, { ReactNode } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

interface CheckRowProps {
  checked: boolean;
  onToggle: () => void;
  /** El rótulo: texto, o texto con enlaces (`Text` con `onPress`) dentro. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Casilla con su rótulo; toda la fila la marca o desmarca. La única de la app:
 * la usan `ConfirmModal` (matizar la acción) y el alta de la cuenta (aceptar
 * los textos legales y el consentimiento para datos de salud).
 */
export function CheckRow({
  checked,
  onToggle,
  children,
  style,
  textStyle,
}: CheckRowProps) {
  return (
    <Pressable
      style={[styles.row, style]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && (
          <MaterialCommunityIcons
            name="check-bold"
            size={14}
            color={theme.colors.onGold}
          />
        )}
      </View>
      <Text style={[styles.label, textStyle]}>{children}</Text>
    </Pressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    box: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.primaryLine,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    boxChecked: {
      backgroundColor: theme.colors.primaryFill,
    },
    label: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      lineHeight: 19,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
