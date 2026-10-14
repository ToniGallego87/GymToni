import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect } from 'react';
import {
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lib/theme';
import { GlassBlur } from './GlassBlur';
import { ConfettiBurst } from './ConfettiBurst';
import {
  GLASS_BACK_BUTTON_BORDER,
  GLASS_BACK_BUTTON_OVERLAY,
  GLASS_BACK_BUTTON_TEXT,
  GLASS_REST_TIMER_BG,
} from './glassTokens';

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
  /**
   * Píldora corta en el centro de la pantalla en vez de cartel al pie: para
   * celebraciones de un vistazo ("Récord") que no deben competir con el
   * descanso flotante ni con "Volver". Ignora `bottom` y la acción.
   */
  centered?: boolean;
  /** Solo con `centered`: ráfaga de confeti detrás de la píldora (récord). */
  celebrate?: boolean;
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
  centered = false,
  celebrate = false,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const opacity = React.useRef(new Animated.Value(1)).current;
  const actionable = !!onAction && !!actionLabel;
  const resolvedDuration = duration ?? (actionable ? ACTION_DURATION_MS : 3000);

  // `onDismiss` va por ref y NO en las dependencias: los padres lo pasan como
  // función en línea, nueva en cada render, y el efecto reiniciaba la cuenta en
  // cada uno. En el registro el descanso re-renderiza cada segundo, así que un
  // aviso de 2,5 s se quedaba en pantalla hasta que acababa el descanso.
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    opacity.setValue(1);
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start(() => {
        onDismissRef.current?.();
      });
    }, resolvedDuration);

    return () => clearTimeout(timer);
  }, [resolvedDuration, opacity, message]);

  const backgroundColor =
    type === 'success'
      ? theme.colors.success
      : type === 'error'
      ? theme.colors.error
      : theme.colors.surfaceAlt;

  // El cartel al pie es cristal oscuro (el del descanso flotante, que vive en
  // el mismo rincón del registro), no un bloque de color: el estado lo dice el
  // icono. Un verde a toda la anchura con la acción en contorno blanco parecía
  // otra app y la acción no leía como botón; y una tarjeta opaca tapaba la
  // serie que "Deshacer" está a punto de devolver.
  const accentColor =
    type === 'success'
      ? theme.colors.success
      : type === 'error'
      ? theme.colors.error
      : theme.colors.primary;
  const statusIcon =
    type === 'success'
      ? 'check-circle'
      : type === 'error'
      ? 'alert-circle'
      : 'information';

  // Flota por encima del control inferior más alto (barra de navegación 70 o
  // botón "Volver" 58, ambos con su margen). Así no queda tapado.
  const resolvedBottom = bottom ?? Math.max(insets.bottom, 10) + 94;

  if (centered) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.centerLayer, { opacity }]}
      >
        {celebrate && <ConfettiBurst />}
        <Animated.View style={[styles.centerPill, { backgroundColor }]}>
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      pointerEvents={actionable ? 'auto' : 'none'}
      style={[styles.container, { opacity, bottom: resolvedBottom }]}
    >
      <GlassBlur tint={GLASS_REST_TIMER_BG} style={styles.blur} />
      <View style={styles.glassOverlay} pointerEvents="none" />
      <MaterialCommunityIcons name={statusIcon} size={22} color={accentColor} />
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      {actionable && (
        <Pressable
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={() => {
            onAction?.();
            onDismiss?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      paddingVertical: 10,
      paddingLeft: 16,
      paddingRight: 10,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: GLASS_BACK_BUTTON_BORDER,
      // Fondo de respaldo con el mismo tinte (si no hay desenfoque nativo).
      backgroundColor: GLASS_REST_TIMER_BG,
      overflow: 'hidden',
      ...theme.shadow.card,
      elevation: 24,
    },
    blur: {
      ...StyleSheet.absoluteFillObject,
    },
    glassOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: GLASS_BACK_BUTTON_OVERLAY,
    },
    centerLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerPill: {
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderRadius: theme.borderRadius.pill,
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
    // Tinta clara en ambos temas: el cristal es oscuro también de día.
    message: {
      flex: 1,
      color: GLASS_BACK_BUTTON_TEXT,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    // La acción es un botón dorado a la derecha, como los primarios de la app:
    // es lo que se busca tocar cuando el aviso ofrece arreglar algo.
    action: {
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.primaryFill,
    },
    actionText: {
      color: theme.colors.onGold,
      fontSize: 14,
      fontWeight: '800',
    },
    pressed: { opacity: 0.7 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
