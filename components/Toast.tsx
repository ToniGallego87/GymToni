import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect } from 'react';
import { Text, StyleSheet, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lib/theme';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss?: () => void;
  /** Offset inferior manual. Por defecto flota sobre el control inferior. */
  bottom?: number;
}

export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
  bottom,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const opacity = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start(() => {
        onDismiss?.();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss, opacity]);

  const backgroundColor =
    type === 'success'
      ? theme.colors.success
      : type === 'error'
      ? theme.colors.error
      : theme.colors.surfaceAlt;

  // Flota por encima del control inferior más alto (barra de navegación 70 o
  // botón "Volver" 58, ambos con su margen). Así no queda tapado.
  const resolvedBottom = bottom ?? Math.max(insets.bottom, 10) + 94;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { backgroundColor, opacity, bottom: resolvedBottom },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const makeStyles = () => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 60,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
    elevation: 24,
  },
  text: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },
});

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
