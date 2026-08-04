import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  GestureResponderEvent,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@lib/theme';

interface ButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
  size?: 'small' | 'medium' | 'large';
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  size = 'medium',
}: ButtonProps) {
  // Degradado por variante: da sensación de volumen (claro arriba → oscuro
  // abajo), igual que el botón "Guardar" de registrar un día. En render para
  // leer los gradientes del tema VIVO (cambio de tema en caliente).
  const GRADIENTS: Record<'primary' | 'danger', [string, string, string]> = {
    primary: theme.gradients.primary,
    danger: theme.gradients.danger,
  };
  const isFilled = !disabled && (variant === 'primary' || variant === 'danger');

  const getFlatBackgroundColor = () => {
    if (disabled) return theme.colors.lightGray;
    if (variant === 'secondary') return theme.colors.surface;
    return theme.colors.primaryFill;
  };

  const getTextColor = () => {
    if (variant === 'secondary' && !disabled) return theme.colors.text;
    // Cada relleno tiene su tinta: oscura sobre el oro vivo (onGold) y blanca
    // sobre el rojo profundo de día (onDanger). Ver theme.ts.
    if (variant === 'danger' || disabled) return theme.colors.onDanger;
    return theme.colors.onGold;
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 12 };
      case 'large':
        return { paddingVertical: 14, paddingHorizontal: 24 };
      default:
        // Horizontal contenido (12, no 16): en filas de 3 botones dentro de un
        // modal cada botón se reparte 1/3 del ancho y una etiqueta larga como
        // "Cancelar" se quedaba sin sitio y saltaba a dos líneas ("Cancela\nr").
        return { paddingVertical: 12, paddingHorizontal: 12 };
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View
        style={[
          styles.inner,
          getPadding(),
          {
            backgroundColor: isFilled
              ? 'transparent'
              : getFlatBackgroundColor(),
            borderColor:
              variant === 'secondary' ? theme.colors.border : 'transparent',
            borderWidth: variant === 'secondary' ? 1 : 0,
          },
        ]}
      >
        {isFilled && (
          <>
            <LinearGradient
              colors={GRADIENTS[variant === 'danger' ? 'danger' : 'primary']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={theme.gradients.sheen}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.sheen}
              pointerEvents="none"
            />
          </>
        )}
        <Text
          // La etiqueta de un botón es SIEMPRE de una línea: nunca debe partirse
          // en dos (como el "Cancela / r" de las notas). Si aun así no cupiera,
          // que la reduzca un poco antes de recortar con puntos suspensivos.
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={[
            styles.text,
            {
              color: getTextColor(),
              fontSize: size === 'small' ? 13 : size === 'large' ? 17 : 15,
              lineHeight: size === 'small' ? 18 : size === 'large' ? 24 : 20,
            },
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    button: {
      borderRadius: theme.borderRadius.md,
      ...theme.shadow.card,
    },
    inner: {
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    sheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '55%',
    },
    text: {
      fontWeight: '800',
    },
    pressed: {
      opacity: 0.92,
      transform: [{ scale: 0.99 }],
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
