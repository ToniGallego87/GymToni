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
   * Tarjeta corta en el centro de la pantalla en vez de cartel al pie: para
   * celebraciones de un vistazo ("Récord") que no deben competir con el
   * descanso flotante ni con "Volver". Ignora `bottom` y la acción.
   */
  centered?: boolean;
  /** Solo con `centered`: ráfaga de confeti detrás de la tarjeta (récord). */
  celebrate?: boolean;
  /**
   * Solo con `centered`: el dato en grande ("Récord", "+4,4 %"); `message` va
   * debajo como rótulo. Sin él, `message` hace de dato.
   */
  headline?: string;
  /** Solo con `centered`: icono de la tarjeta (trofeo, tendencia...). */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /**
   * Solo con `centered`: color del icono, el dato y el filo de la tarjeta.
   * Oro para el récord, verde para la mejora, neutro sin mejora. Por defecto
   * sale de `type`.
   */
  tone?: CenteredTone;
}

type CenteredTone = 'gold' | 'success' | 'neutral';

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
  headline,
  icon,
  tone,
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
    // Tarjeta de superficie, como las de la app. Antes era una píldora de
    // color de estado con tinta clara encima (verde con blanco), que apenas
    // contrastaba: ahora el color va en el icono, el dato y el filo.
    const resolvedTone: CenteredTone =
      tone ?? (type === 'success' ? 'success' : 'neutral');
    const toneColor =
      resolvedTone === 'gold'
        ? theme.colors.primary
        : resolvedTone === 'success'
        ? theme.colors.success
        : theme.colors.textSecondary;
    const toneTint =
      resolvedTone === 'gold'
        ? theme.colors.primaryMuted
        : resolvedTone === 'success'
        ? theme.colors.successMuted
        : theme.colors.surfaceAlt;
    const title = headline ?? message;
    const detail = headline ? message : '';
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.centerLayer, { opacity }]}
      >
        {celebrate && <ConfettiBurst />}
        <View style={[styles.centerCard, { borderColor: toneColor }]}>
          <View style={[styles.centerIcon, { backgroundColor: toneTint }]}>
            <MaterialCommunityIcons
              name={icon ?? statusIcon}
              size={28}
              color={toneColor}
            />
          </View>
          <Text style={[styles.centerHeadline, { color: toneColor }]}>
            {title}
          </Text>
          {!!detail && <Text style={styles.centerDetail}>{detail}</Text>}
        </View>
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
    // Velo oscuro detrás de la tarjeta: sobre el registro se perdía. Se funde
    // con ella (va en la misma capa con opacidad).
    centerLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.scrim,
      zIndex: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerCard: {
      minWidth: 200,
      maxWidth: 300,
      alignItems: 'center',
      gap: 4,
      paddingTop: 18,
      paddingBottom: 18,
      paddingHorizontal: 28,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 2,
      backgroundColor: theme.colors.surface,
      ...theme.shadow.card,
      elevation: 24,
    },
    centerIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    // El dato, en la fuente de los titulares (Anton), como las cifras grandes
    // del registro.
    centerHeadline: {
      fontFamily: theme.fonts.display,
      fontSize: 34,
      lineHeight: 46,
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    centerDetail: {
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
