import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  GestureResponderEvent,
  ViewStyle,
} from 'react-native';
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
  const getBackgroundColor = () => {
    if (disabled) return theme.colors.lightGray;
    switch (variant) {
      case 'secondary':
        return theme.colors.surface;
      case 'danger':
        return theme.colors.error;
      default:
        return theme.colors.primary;
    }
  };

  const getTextColor = () => {
    if (variant === 'secondary' && !disabled) return theme.colors.text;
    return theme.colors.darkGray;
  };

  const getBorderColor = () => {
    if (variant === 'secondary') return theme.colors.border;
    return undefined;
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
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'secondary' ? 1 : 0,
          ...getPadding(),
        },
        pressed && !disabled && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.soft,
  },
  text: {
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
