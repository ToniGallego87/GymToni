import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect } from 'react';
import { Text, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lib/theme';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss?: () => void;
  /** Offset inferior manual. Por defecto flota sobre el control inferior. */
  bottom?: number;
  /**
   * Rótulo de la acción del aviso (p. ej. "Iniciar sesión"). Con acción el
   * aviso deja de ser un cartel y se puede tocar: un aviso que dice lo que te
   * falta tiene que llevarte a arreglarlo, no dejarte adivinando dónde está.
   */
  actionLabel?: string;
  onAction?: () => void;
}

// Con acción el aviso dura más: hay que leerlo Y decidir tocarlo.
const ACTION_DURATION_MS = 6000;

export function Toast({
  message,
  type = 'info',
  duration,
  onDismiss,
  bottom,
  actionLabel,
  onAction,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const opacity = React.useRef(new Animated.Value(1)).current;
  const actionable = !!onAction && !!actionLabel;
  const resolvedDuration = duration ?? (actionable ? ACTION_DURATION_MS : 3000);

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
    }, resolvedDuration);

    return () => clearTimeout(timer);
  }, [resolvedDuration, onDismiss, opacity]);

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
      pointerEvents={actionable ? 'auto' : 'none'}
      style={[
        styles.container,
        { backgroundColor, opacity, bottom: resolvedBottom },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
      {actionable && (
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={() => {
            onAction?.();
            onDismiss?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          <MaterialCommunityIcons
            name="arrow-right"
            size={16}
            color={theme.colors.text}
          />
        </Pressable>
      )}
    </Animated.View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
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
    // La acción va debajo del mensaje y ocupa todo el ancho: es lo que se
    // busca tocar cuando el aviso dice que falta algo.
    action: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
      borderColor: theme.colors.text,
    },
    actionText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    pressed: { opacity: 0.7 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
