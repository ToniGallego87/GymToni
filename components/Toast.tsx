import React, { useEffect } from 'react';
import { Text, StyleSheet, Animated, Easing } from 'react-native';
import { theme } from '@lib/theme';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss?: () => void;
}

export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
}: ToastProps) {
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

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, opacity },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: theme.borderRadius.md,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  text: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },
});
