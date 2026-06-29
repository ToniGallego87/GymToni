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

// Degradado por variante: da sensación de volumen (claro arriba → oscuro abajo),
// igual que el botón "Guardar" de registrar un día.
const GRADIENTS: Record<'primary' | 'danger', [string, string, string]> = {
  primary: ['#F9D85A', '#F7CC3D', '#E0B226'],
  danger: ['#F59898', '#F06A6A', '#D85555'],
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  size = 'medium',
}: ButtonProps) {
  const isFilled = !disabled && (variant === 'primary' || variant === 'danger');

  const getFlatBackgroundColor = () => {
    if (disabled) return theme.colors.lightGray;
    if (variant === 'secondary') return theme.colors.surface;
    return theme.colors.primary;
  };

  const getTextColor = () => {
    if (variant === 'secondary' && !disabled) return theme.colors.text;
    return theme.colors.darkGray;
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 12 };
      case 'large':
        return { paddingVertical: 14, paddingHorizontal: 24 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 16 };
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
              colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.sheen}
              pointerEvents="none"
            />
          </>
        )}
        <Text
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

const styles = StyleSheet.create({
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
