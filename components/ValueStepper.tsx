import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

interface ValueStepperProps {
  /** Valor YA formateado tal cual se lee ("2:30"). */
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Tope inferior alcanzado: la flecha izquierda se apaga. */
  atMin?: boolean;
  /** Tope superior alcanzado: la flecha derecha se apaga. */
  atMax?: boolean;
  /** Para lectores de pantalla ("Temporizador de descanso"). */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Ajuste de UN valor a saltos, con una flecha a cada lado y la cifra en medio.
 *
 * Es el hermano de `OptionToggle` para los ajustes que no son una lista cerrada
 * de opciones: misma altura, mismo borde y mismo radio, así que en Configuración
 * el temporizador de descanso se lee igual que el tema y el idioma. Antes ese
 * ajuste era una fila-enlace con un lápiz que abría un modal con un campo de
 * texto: mismo aspecto que "Datos y nube", que sí lleva a otra pantalla, y tres
 * toques (abrir, teclear, guardar) para subir medio minuto.
 *
 * Quien lo usa decide el salto y los topes; aquí solo se dibuja y se apagan las
 * flechas cuando ya no hay a dónde ir.
 */
export function ValueStepper({
  value,
  onDecrement,
  onIncrement,
  atMin = false,
  atMax = false,
  label,
  style,
}: ValueStepperProps) {
  const arrow = (
    direction: 'left' | 'right',
    onPress: () => void,
    disabled: boolean
  ) => (
    <Pressable
      style={({ pressed }) => [
        styles.arrow,
        disabled && styles.arrowDisabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={
        direction === 'left' ? `${label ?? ''} −` : `${label ?? ''} +`
      }
      accessibilityState={{ disabled }}
    >
      <MaterialCommunityIcons
        name={direction === 'left' ? 'chevron-left' : 'chevron-right'}
        size={26}
        color={disabled ? theme.colors.textMuted : theme.colors.primary}
      />
    </Pressable>
  );

  return (
    <View style={[styles.row, style]}>
      {arrow('left', onDecrement, atMin)}
      <View style={styles.valueBox}>
        <Text
          style={styles.value}
          numberOfLines={1}
          accessibilityLabel={label ? `${label}: ${value}` : value}
        >
          {value}
        </Text>
      </View>
      {arrow('right', onIncrement, atMax)}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    arrow: {
      width: 56,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.primaryMuted,
    },
    // En el tope, la flecha se queda en la piel neutra del segmentado apagado:
    // sigue estando (nada se mueve de sitio) pero ya no invita a pulsarla.
    arrowDisabled: {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    valueBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    value: {
      fontSize: 20,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.5,
      color: theme.colors.text,
      lineHeight: 28,
      fontVariant: ['tabular-nums'],
    },
    pressed: {
      opacity: 0.85,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
